/**
 * Shared render pipeline: venue photo + tenant style -> OpenAI image edit.
 * Used by both api/generate.js (Vercel) and server/index.js (Express dev).
 *
 * Prompt assembly happens HERE, server-side, from tenant config. The browser
 * sends only styleId + colors — style prompt templates never leave the server.
 *
 * Model: gpt-image-2 (default; override with OPENAI_IMAGE_MODEL). gpt-image-2
 * processes input images at high fidelity natively and REJECTS the
 * input_fidelity param — it is sent only for models that accept it
 * (gpt-image-1 / gpt-image-1.5), matching the Waterloo reference pipeline.
 */
import OpenAI, { toFile } from 'openai';
import { findStyle } from './tenant.js';

const OPENAI_IMAGE_MODEL = (() => {
  const value = process.env.OPENAI_IMAGE_MODEL?.trim();
  return value && value !== 'undefined' ? value : 'gpt-image-2';
})();
const supportsInputFidelity = OPENAI_IMAGE_MODEL !== 'gpt-image-2';

export const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_COLORS = 3;

// Supported output sizes for gpt-image edits. Pick the one whose aspect
// ratio is closest to the uploaded photo's so the render aligns with the
// original when compared side by side.
const OUTPUT_SIZES = [
  { size: '1536x1024', ratio: 1536 / 1024 },
  { size: '1024x1024', ratio: 1 },
  { size: '1024x1536', ratio: 1024 / 1536 }
];

export function pickOutputSize(width, height) {
  if (!width || !height) return '1536x1024';
  const sourceRatio = width / height;
  let best = OUTPUT_SIZES[0];
  for (const candidate of OUTPUT_SIZES) {
    if (
      Math.abs(Math.log(sourceRatio / candidate.ratio)) <
      Math.abs(Math.log(sourceRatio / best.ratio))
    ) {
      best = candidate;
    }
  }
  return best.size;
}

export function buildColorString(colorNames) {
  if (colorNames.length === 1) return colorNames[0];
  if (colorNames.length === 2) return `${colorNames[0]} and ${colorNames[1]}`;
  return `${colorNames.slice(0, -1).join(', ')}, and ${colorNames[colorNames.length - 1]}`;
}

/**
 * Validates the request against the tenant and normalizes colors.
 * Throws { status, message } on invalid input.
 */
export function validateGenerateRequest(tenant, { styleId, colors }) {
  const style = findStyle(tenant, styleId);
  if (!style) {
    throw Object.assign(new Error('Unknown style.'), { status: 400 });
  }

  let parsed = colors;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw Object.assign(new Error('Invalid colors payload.'), { status: 400 });
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_COLORS) {
    throw Object.assign(new Error(`Select between 1 and ${MAX_COLORS} colors.`), { status: 400 });
  }

  // Only accept colors this tenant actually offers; use canonical names.
  const offered = new Map((tenant.colors || []).map((c) => [c.name, c]));
  const selected = parsed.map((c) => {
    const name = typeof c === 'string' ? c : c?.name;
    const match = offered.get(name);
    if (!match) {
      throw Object.assign(new Error(`Unknown color: ${name}`), { status: 400 });
    }
    return match;
  });

  return { style, colors: selected };
}

/**
 * Runs the image edit. Returns { image (data URL), price, colors }.
 */
export async function generateVisualization({
  tenant,
  imageBuffer,
  mimeType,
  filename,
  styleId,
  colors,
  sourceWidth,
  sourceHeight
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error('Server configuration error: API key not set'), {
      status: 500
    });
  }

  const { style, colors: selectedColors } = validateGenerateRequest(tenant, {
    styleId,
    colors
  });

  const prompt = style.prompt.replace(
    '{colors}',
    buildColorString(selectedColors.map((c) => c.name))
  );

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const result = await client.images.edit({
    model: OPENAI_IMAGE_MODEL,
    image: await toFile(imageBuffer, filename || 'venue-photo.png', { type: mimeType }),
    prompt,
    size: pickOutputSize(Number(sourceWidth), Number(sourceHeight)),
    // Medium quality: high input fidelity degrades noticeably at "low".
    quality: 'medium',
    ...(supportsInputFidelity ? { input_fidelity: 'high' } : {})
  });

  const b64 = result?.data?.[0]?.b64_json;
  if (!b64) {
    throw Object.assign(
      new Error('AI did not generate an image. Try a different photo or style.'),
      { status: 422 }
    );
  }

  return {
    image: `data:image/png;base64,${b64}`,
    price: { name: style.name, price: style.price },
    colors: selectedColors
  };
}

export { OPENAI_IMAGE_MODEL };
