import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL. Add the pooled Neon URL in Vercel Environment Variables.');
}

export const sql = neon(process.env.DATABASE_URL);
