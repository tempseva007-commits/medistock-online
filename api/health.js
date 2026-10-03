import { sql } from '../lib/db.js';
import { fail, json } from '../lib/http.js';

export async function GET() {
  try {
    const rows = await sql`SELECT now() AS database_time`;
    return json({ ok: true, database: 'connected', time: rows[0].database_time });
  } catch (error) {
    return fail(error);
  }
}
