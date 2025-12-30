const STYLE_PRICES = {
  'classic-garland': { name: 'Classic Garland', price: 250 },
  'boho-arch': { name: 'Boho Chic Arch', price: 350 },
  'dynamic-splash': { name: 'Dynamic Splash', price: 200 },
  'sleek-modern': { name: 'Sleek & Modern', price: 300 },
  'whimsical-theme': { name: 'Whimsical Theme', price: 275 }
};

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json(STYLE_PRICES);
}
