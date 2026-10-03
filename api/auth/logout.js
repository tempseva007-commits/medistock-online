import { clearSessionCookie } from '../../lib/auth.js';
import { assertSameOrigin, json } from '../../lib/http.js';

export async function POST(request) {
  try {
    assertSameOrigin(request);
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) });
  } catch {
    return json({ error: 'Logout request rejected.' }, 403);
  }
}
