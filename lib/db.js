import { neon } from '@neondatabase/serverless';

let client;

function getClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Missing DATABASE_URL. Add the pooled Neon URL in Vercel Environment Variables.');
  if (!client) client = neon(url);
  return client;
}

// Lazy initialization keeps missing/malformed env configuration inside the
// function request handler, so Vercel returns a useful JSON error instead of
// failing the function while importing this module.
export const sql = (strings, ...values) => getClient()(strings, ...values);
