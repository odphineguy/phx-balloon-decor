import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root .env holds the shared secrets (OPENAI/SUPABASE/RESEND/TENANT_ID);
// server/.env can add dev-only overrides like PORT. Neither overwrites vars
// already set in the environment.
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

// Imported after dotenv so lib module-load-time env reads (OPENAI_IMAGE_MODEL)
// see the same values the Vercel runtime would.
const { getTenant, publicConfig, stylePrices } = await import('../lib/tenant.js');
const { generateVisualization, validateGenerateRequest, ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } =
  await import('../lib/generate-core.js');
const { validateLead, deliverLead, isRateLimited } = await import('../lib/leads-core.js');
const { startHeartbeat } = await import('../lib/heartbeat.js');

const app = express();
const PORT = process.env.PORT || 3001;

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_UPLOAD_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from parent directory (the main site)
app.use(express.static(path.join(__dirname, '..')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public tenant config (styles WITHOUT prompts, colors, theme, branding)
app.get('/api/config', (req, res) => {
  try {
    res.json(publicConfig());
  } catch (error) {
    console.error('Config error:', error);
    res.status(500).json({ error: 'Tenant configuration unavailable' });
  }
});

// Get pricing info (legacy shape, now tenant-config-driven)
app.get('/api/prices', (req, res) => {
  try {
    res.json(stylePrices());
  } catch (error) {
    console.error('Prices error:', error);
    res.status(500).json({ error: 'Tenant configuration unavailable' });
  }
});

// Generate balloon visualization
app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const tenant = getTenant();

    // Fast validation gets real status codes; only after it passes do we
    // commit to the streamed 200 (see lib/heartbeat.js for why).
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error: API key not set' });
    }
    validateGenerateRequest(tenant, { styleId: req.body.styleId, colors: req.body.colors });

    const heartbeat = startHeartbeat(res);
    try {
      const result = await generateVisualization({
        tenant,
        imageBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
        filename: req.file.originalname,
        styleId: req.body.styleId,
        colors: req.body.colors,
        sourceWidth: req.body.width,
        sourceHeight: req.body.height
      });
      heartbeat.succeed({
        image: result.image,
        price: result.price,
        colors: result.colors
      });
    } catch (error) {
      console.error('Generation error:', error);
      heartbeat.fail(error.status ? error.message : 'Failed to generate visualization');
    }
  } catch (error) {
    console.error('Generation error:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: status === 500 ? 'Failed to generate visualization' : error.message,
      details: status === 500 ? error.message : undefined
    });
  }
});

// Record a lead (Supabase insert + Resend notification)
app.post('/api/leads', async (req, res) => {
  if (isRateLimited(req.ip || 'unknown')) {
    return res.status(429).json({ error: 'Too many requests — try again in a minute.' });
  }
  try {
    const tenant = getTenant();
    const lead = validateLead(req.body);
    const outcome = await deliverLead(tenant, lead);
    res.json(outcome);
  } catch (error) {
    const status = error.status || 500;
    if (status === 500) console.error('Lead error:', error);
    res.status(status).json({ error: error.message || 'Failed to record lead' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`
  ========================================
  Phoenix Balloon Decor Server
  ========================================
  Server running at: http://localhost:${PORT}
  Tenant: ${process.env.TENANT_ID || 'phoenix-balloon-decor'}

  Requires OPENAI_API_KEY (and SUPABASE_URL /
  SUPABASE_SERVICE_ROLE_KEY / RESEND_API_KEY
  for lead capture) in the root .env
  ========================================
  `);
});
