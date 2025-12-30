import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
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

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Balloon style prices
const STYLE_PRICES = {
  'classic-garland': { name: 'Classic Garland', price: 250 },
  'boho-arch': { name: 'Boho Chic Arch', price: 350 },
  'dynamic-splash': { name: 'Dynamic Splash', price: 200 },
  'sleek-modern': { name: 'Sleek & Modern', price: 300 },
  'whimsical-theme': { name: 'Whimsical Theme', price: 275 }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get pricing info
app.get('/api/prices', (req, res) => {
  res.json(STYLE_PRICES);
});

// Generate balloon visualization
app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error: API key not set' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { prompt, styleId, colors } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'No prompt provided' });
    }

    // Convert image buffer to base64
    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Get the model - using gemini-2.0-flash-exp for image generation
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    });

    // Create the content with image and prompt
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: imageBase64
        }
      },
      { text: prompt }
    ]);

    const response = result.response;

    // Extract image and text from response
    let generatedImage = null;
    let generatedText = '';

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const { mimeType: imgMime, data } = part.inlineData;
        generatedImage = `data:${imgMime};base64,${data}`;
      } else if (part.text) {
        generatedText += part.text;
      }
    }

    if (!generatedImage) {
      return res.status(422).json({
        error: 'AI did not generate an image. Try a different photo or style.',
        details: generatedText
      });
    }

    // Get price info if styleId provided
    const priceInfo = styleId && STYLE_PRICES[styleId] ? STYLE_PRICES[styleId] : null;

    res.json({
      success: true,
      image: generatedImage,
      text: generatedText,
      price: priceInfo,
      colors: colors ? JSON.parse(colors) : []
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({
      error: 'Failed to generate visualization',
      details: error.message
    });
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
  API endpoint: http://localhost:${PORT}/api/generate

  Make sure GEMINI_API_KEY is set in .env
  ========================================
  `);
});
