import { publicConfig } from '../lib/tenant.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    res.status(200).json(publicConfig());
  } catch (error) {
    console.error('Config error:', error);
    res.status(500).json({ error: 'Tenant configuration unavailable' });
  }
}
