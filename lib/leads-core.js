/**
 * Shared lead capture: Supabase insert + Resend notification, run
 * independently — one failing never blocks the other, and the CLIENT never
 * blocks the render reveal on this endpoint at all (it reveals on submit
 * regardless of outcome; this is the tenant's lead pipeline, not a gate).
 *
 * Used by api/leads.js (Vercel) and server/index.js (Express dev).
 */
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const FROM_EMAIL = 'Phoenix Balloon Decor AI Studio <studio@abemedia.online>';

function getEnv(name) {
  const value = process.env[name]?.trim();
  return value && value !== 'undefined' ? value : null;
}

// Naive in-memory per-IP rate limit (10/min). Serverless instances each keep
// their own window, which is acceptable at this scale.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hitsByIp = new Map();

export function isRateLimited(ip) {
  const now = Date.now();
  const hits = (hitsByIp.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT) {
    hitsByIp.set(ip, hits);
    return true;
  }
  hits.push(now);
  hitsByIp.set(ip, hits);
  return false;
}

export function validateLead(body) {
  const lead = {
    name: String(body?.name || '').trim(),
    email: String(body?.email || '').trim(),
    phone: String(body?.phone || '').trim(),
    eventDate: String(body?.eventDate || '').trim() || null,
    styleId: String(body?.styleId || '').trim() || null,
    colors: Array.isArray(body?.colors) ? body.colors.slice(0, 3) : [],
    renderIncluded: Boolean(body?.renderIncluded)
  };
  if (!lead.name || !lead.email || !lead.phone) {
    throw Object.assign(new Error('Missing required contact fields.'), { status: 400 });
  }
  if (lead.eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(lead.eventDate)) {
    throw Object.assign(new Error('Invalid event date.'), { status: 400 });
  }
  return lead;
}

async function persistLead(tenant, lead) {
  const url = getEnv('SUPABASE_URL');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return { ok: false, detail: 'Supabase env vars not configured — persist skipped.' };
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await supabase.from('balloon_leads').insert({
    tenant_id: tenant.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    event_date: lead.eventDate,
    style_id: lead.styleId,
    colors: lead.colors
  });

  if (error) return { ok: false, detail: `Supabase insert failed: ${error.message}` };
  return { ok: true, detail: 'Persisted to balloon_leads.' };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildLeadEmailHtml(tenant, lead, style) {
  const esc = escapeHtml;
  const primary = tenant.theme?.primary || '#1A5E63';
  const colorNames = lead.colors.map((c) => (typeof c === 'string' ? c : c?.name)).filter(Boolean);
  const row = (label, value) =>
    `<tr><td style="padding:6px 14px 6px 0;color:#777;font-size:13px;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0;color:#222;font-size:14px;font-weight:600">${value}</td></tr>`;

  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f4f6f6;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e3e8e8;padding:28px">
    <h1 style="margin:0 0 4px;font-size:20px;color:${primary}">New AI Visualizer Lead</h1>
    <p style="margin:0 0 18px;color:#777;font-size:13px">${esc(tenant.businessName)} · ${esc(new Date().toISOString())}</p>
    <table style="border-collapse:collapse;width:100%">
      ${row('Name', esc(lead.name))}
      ${row('Email', esc(lead.email))}
      ${row('Phone', esc(lead.phone))}
      ${row('Event date', esc(lead.eventDate || 'Not provided'))}
      ${row('Style', esc(style ? style.name : lead.styleId || '—'))}
      ${row('Estimated price', style ? `$${style.price}` : '—')}
      ${row('Colors', esc(colorNames.join(', ') || '—'))}
      ${row('AI render generated?', lead.renderIncluded ? 'Yes' : 'No')}
    </table>
    <p style="margin:18px 0 0;color:#999;font-size:12px">Captured by the ${esc(tenant.businessName)} AI visualizer lead gate.</p>
  </div>
</body></html>`;
}

async function emailLead(tenant, lead, style) {
  const apiKey = getEnv('RESEND_API_KEY');
  const to = tenant.contact?.notifyEmail?.trim();
  if (!apiKey) return { ok: false, detail: 'RESEND_API_KEY not configured — email skipped.' };
  if (!to) return { ok: false, detail: 'No contact.notifyEmail on this tenant — email skipped.' };

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `New AI Visualizer Lead — ${lead.name}`,
    html: buildLeadEmailHtml(tenant, lead, style)
  });

  if (error) return { ok: false, detail: `Resend send failed: ${error.message}` };
  return { ok: true, detail: `Emailed lead to ${to}.` };
}

/**
 * Runs both delivery actions. Never throws for delivery failures — returns
 * their outcomes so the endpoint can log them and still 200.
 */
export async function deliverLead(tenant, lead) {
  const style = (tenant.styles || []).find((s) => s.id === lead.styleId) || null;

  const [persisted, emailed] = await Promise.all([
    persistLead(tenant, lead).catch((error) => ({
      ok: false,
      detail: `Supabase insert threw: ${error?.message || error}`
    })),
    emailLead(tenant, lead, style).catch((error) => ({
      ok: false,
      detail: `Resend send threw: ${error?.message || error}`
    }))
  ]);

  if (!persisted.ok) console.error('[leads]', persisted.detail);
  if (!emailed.ok) console.error('[leads]', emailed.detail);

  return { ok: persisted.ok || emailed.ok, persisted, emailed };
}
