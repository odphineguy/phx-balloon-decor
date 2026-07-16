/**
 * Tenant config loader. TENANT_ID (env) selects tenants/<id>.json — one file
 * per vendor, zero code changes per tenant. Style prompts are server-only:
 * anything browser-bound must go through publicConfig().
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TENANTS_DIR = path.join(__dirname, '..', 'tenants');
const DEFAULT_TENANT_ID = 'phoenix-balloon-decor';

const cache = new Map();

function tenantId() {
  const id = process.env.TENANT_ID?.trim();
  return id && id !== 'undefined' ? id : DEFAULT_TENANT_ID;
}

export function getTenant(id = tenantId()) {
  // Filenames are trusted config, but the id can come from env — keep it to
  // slug characters so it can never traverse out of tenants/.
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error(`Invalid tenant id: ${id}`);
  }
  if (cache.has(id)) return cache.get(id);

  const file = path.join(TENANTS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Unknown tenant: ${id} (no tenants/${id}.json)`);
  }
  const tenant = JSON.parse(fs.readFileSync(file, 'utf8'));
  cache.set(id, tenant);
  return tenant;
}

/**
 * The browser-safe subset served by /api/config. Strips style prompts,
 * notifyEmail, and any _-prefixed documentation keys. Do not add prompts
 * back here — prompts are the product.
 */
export function publicConfig(tenant = getTenant()) {
  return {
    id: tenant.id,
    businessName: tenant.businessName,
    tagline: tenant.tagline,
    logo: tenant.logo,
    theme: tenant.theme,
    contact: {
      phone: tenant.contact?.phone || '',
      email: tenant.contact?.email || ''
    },
    ui: tenant.ui || {},
    leadGate: tenant.leadGate || { enabled: false, fields: [] },
    colors: tenant.colors || [],
    styles: (tenant.styles || []).map(({ id, name, description, price }) => ({
      id,
      name,
      description,
      price
    }))
  };
}

export function findStyle(tenant, styleId) {
  return (tenant.styles || []).find((s) => s.id === styleId) || null;
}

/** Legacy /api/prices shape: { [styleId]: { name, price } } */
export function stylePrices(tenant = getTenant()) {
  const prices = {};
  for (const s of tenant.styles || []) {
    prices[s.id] = { name: s.name, price: s.price };
  }
  return prices;
}
