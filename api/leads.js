import { getTenant } from '../lib/tenant.js';
import { validateLead, deliverLead, isRateLimited } from '../lib/leads-core.js';

export const config = {
  maxDuration: 30,
};

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return first?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (isRateLimited(getClientIp(req))) {
    return res.status(429).json({ error: 'Too many requests — try again in a minute.' });
  }

  try {
    // The server's own tenant is authoritative — a client-sent tenantId is
    // ignored so leads can't be filed against another vendor.
    const tenant = getTenant();
    const lead = validateLead(req.body);
    const outcome = await deliverLead(tenant, lead);
    return res.status(200).json(outcome);
  } catch (error) {
    const status = error.status || 500;
    if (status === 500) console.error('Lead error:', error);
    return res.status(status).json({ error: error.message || 'Failed to record lead' });
  }
}
