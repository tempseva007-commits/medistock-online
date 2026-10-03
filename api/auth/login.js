import { loginUser, makeSessionCookie } from '../../lib/auth.js';
import { assertSameOrigin, fail, json, readJson } from '../../lib/http.js';

export async function POST(request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const user = await loginUser(body.username, body.password);
    return json({ user }, 200, { 'Set-Cookie': makeSessionCookie(user.id, request) });
  } catch (error) {
    return fail(error);
  }
}
