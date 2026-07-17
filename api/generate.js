import formidable from 'formidable';
import fs from 'fs';
import { getTenant } from '../lib/tenant.js';
import {
  generateVisualization,
  validateGenerateRequest,
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES
} from '../lib/generate-core.js';
import { startHeartbeat } from '../lib/heartbeat.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let tempFilepath = null;
  try {
    const form = formidable({
      maxFileSize: MAX_UPLOAD_BYTES,
    });

    const [fields, files] = await form.parse(req);

    const file = files.image?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    tempFilepath = file.filepath;

    if (!ALLOWED_UPLOAD_TYPES.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' });
    }

    const tenant = getTenant();
    const styleId = fields.styleId?.[0];
    const colors = fields.colors?.[0];

    // Fast validation gets real status codes; only after it passes do we
    // commit to the streamed 200 (see lib/heartbeat.js for why).
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error: API key not set' });
    }
    validateGenerateRequest(tenant, { styleId, colors });

    const heartbeat = startHeartbeat(res);
    try {
      const result = await generateVisualization({
        tenant,
        imageBuffer: fs.readFileSync(file.filepath),
        mimeType: file.mimetype,
        filename: file.originalFilename,
        styleId,
        colors,
        sourceWidth: fields.width?.[0],
        sourceHeight: fields.height?.[0]
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
    return;

  } catch (error) {
    console.error('Generation error:', error);
    const status = error.status || 500;
    return res.status(status).json({
      error: status === 500 ? 'Failed to generate visualization' : error.message,
      details: status === 500 ? error.message : undefined
    });
  } finally {
    if (tempFilepath) {
      fs.unlink(tempFilepath, () => {});
    }
  }
}
