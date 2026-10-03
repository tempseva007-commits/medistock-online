import { currentUser } from '../../lib/auth.js';
import { fail, json } from '../../lib/http.js';

export async function GET(request) {
  try {
    const user = await currentUser(request);
    return json({ user });
  } catch (error) {
    return fail(error);
  }
}
