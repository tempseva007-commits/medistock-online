export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON.');
  }
}

export function fail(error) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  // Keep database internals and secrets out of the response.
  console.error('MediStock API error:', error?.message || error);
  if (String(error?.message || '').includes('Missing DATABASE_URL')) {
    return json({ error: 'Vercel environment variable DATABASE_URL is missing. Add the new pooled Neon URL and redeploy.' }, 500);
  }
  if (error?.code === '23505') return json({ error: 'આવું record પહેલેથી નોંધાયેલું છે.' }, 409);
  if (error?.code === '23503') return json({ error: 'આ record સાથે સંબંધિત stock history છે; પહેલાં સંબંધિત transaction તપાસો.' }, 409);
  if (String(error?.message || '').includes('Not enough stock')) return json({ error: 'આ batchમાં એટલો stock ઉપલબ્ધ નથી.' }, 409);
  if (String(error?.message || '').includes('expired batch')) return json({ error: 'Expired batchમાંથી Stock OUT કરી શકાતો નથી.' }, 409);
  return json({ error: 'Server error. Vercel Function logs તપાસો.' }, 500);
}

export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || requestUrl.host;
    if (originUrl.host !== forwardedHost) throw new HttpError(403, 'Cross-origin request blocked.');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(403, 'Invalid request origin.');
  }
}
