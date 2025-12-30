import { GoogleGenerativeAI } from '@google/generative-ai';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

const STYLE_PRICES = {
  'classic-garland': { name: 'Classic Garland', price: 250 },
  'boho-arch': { name: 'Boho Chic Arch', price: 350 },
  'dynamic-splash': { name: 'Dynamic Splash', price: 200 },
  'sleek-modern': { name: 'Sleek & Modern', price: 300 },
  'whimsical-theme': { name: 'Whimsical Theme', price: 275 }
};

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

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

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error: API key not set' });
    }

    // Parse form data
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    const [fields, files] = await form.parse(req);

    const file = files.image?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' });
    }

    const prompt = fields.prompt?.[0];
    if (!prompt) {
      return res.status(400).json({ error: 'No prompt provided' });
    }

    const styleId = fields.styleId?.[0];
    const colors = fields.colors?.[0];

    // Read file and convert to base64
    const imageBuffer = fs.readFileSync(file.filepath);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = file.mimetype;

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    });

    // Generate content
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

    // Clean up temp file
    fs.unlinkSync(file.filepath);

    return res.status(200).json({
      success: true,
      image: generatedImage,
      text: generatedText,
      price: priceInfo,
      colors: colors ? JSON.parse(colors) : []
    });

  } catch (error) {
    console.error('Generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate visualization',
      details: error.message
    });
  }
}
