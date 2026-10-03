import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { sql } from './db.js';
import { HttpError } from './http.js';

export const COOKIE_NAME = 'medistock_session';
export const PAGE_KEYS = ['dashboard', 'products', 'stockIn', 'stockOut', 'patients', 'alerts'];
const SESSION_SECONDS = 60 * 60 * 8;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new HttpError(500, 'SESSION_SECRET missing or too short. Set a random secret (32+ characters) in Vercel.');
  return value;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !String(stored).startsWith('scrypt$')) return false;
  const [, salt, expected] = String(stored).split('$');
  if (!salt || !expected) return false;
  const actual = scryptSync(String(password), salt, 64).toString('hex');
  return safeEqual(actual, expected);
}

function defaultAdminUsername(email) {
  const local = String(email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return /^[a-z0-9][a-z0-9._-]{2,49}$/.test(local) ? local : 'admin';
}

export function normalizeUsername(value) {
  const username = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(username)) {
    throw new HttpError(400, 'Username 3-50 charactersનું હોવું જોઈએ; letters, numbers, dot, underscore અથવા hyphen વાપરો.');
  }
  return username;
}

export async function ensureBootstrapAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  const username = String(process.env.ADMIN_USERNAME || defaultAdminUsername(email)).trim().toLowerCase();
  if (!email || !password || password.length < 10) {
    throw new HttpError(500, 'Vercelમાં ADMIN_EMAIL અને ઓછામાં ઓછા 10 charactersનો ADMIN_PASSWORD સેટ કરો.');
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(username)) {
    throw new HttpError(500, 'ADMIN_USERNAME 3-50 charactersનું valid username હોવું જોઈએ.');
  }
  secret();
  const found = await sql`SELECT id, role, username FROM public.app_users WHERE email = ${email} LIMIT 1`;
  const collision = found[0]
    ? await sql`SELECT id FROM public.app_users WHERE lower(username) = ${username} AND id <> ${found[0].id} LIMIT 1`
    : await sql`SELECT id FROM public.app_users WHERE lower(username) = ${username} LIMIT 1`;
  if (collision[0]) throw new HttpError(409, 'ADMIN_USERNAME બીજા accountમાં વપરાય છે. Vercelમાં અલગ username સેટ કરો.');
  if (!found[0]) {
    // Admin's actual password is checked against the Vercel secret; this random hash is never used for login.
    const unusedHash = hashPassword(randomBytes(48).toString('hex'));
    await sql`
      INSERT INTO public.app_users (full_name, username, email, password_hash, role, page_permissions, is_active)
      VALUES (${process.env.ADMIN_NAME || 'Admin'}, ${username}, ${email}, ${unusedHash}, 'admin', ${JSON.stringify(PAGE_KEYS)}::jsonb, true)
      ON CONFLICT (email) DO NOTHING
    `;
  } else {
    await sql`
      UPDATE public.app_users
         SET username = ${username}, role = 'admin', page_permissions = ${JSON.stringify(PAGE_KEYS)}::jsonb,
             is_active = true, updated_at = now()
       WHERE id = ${found[0].id}
    `;
  }
  return username;
}

export function publicUser(row) {
  const permissions = row.role === 'admin'
    ? PAGE_KEYS
    : (Array.isArray(row.page_permissions) ? row.page_permissions : []);
  return {
    id: row.id,
    name: row.full_name,
    username: row.username,
    email: row.email,
    role: row.role,
    pagePermissions: permissions,
    active: row.is_active,
  };
}

function signature(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function makeSessionCookie(userId, request) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + SESSION_SECONDS * 1000 })).toString('base64url');
  const token = `${payload}.${signature(payload)}`;
  const url = new URL(request.url);
  const secure = url.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(request) {
  const url = new URL(request.url);
  const secure = url.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}

function getCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  const part = raw.split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}

export async function currentUser(request) {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) throw new HttpError(401, 'Login જરૂરી છે.');
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(signature(payload), sig)) throw new HttpError(401, 'Session invalid છે. ફરી login કરો.');
  let session;
  try { session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch { throw new HttpError(401, 'Session invalid છે. ફરી login કરો.'); }
  if (!session.sub || !session.exp || session.exp < Date.now()) throw new HttpError(401, 'Session expire થઈ ગઈ છે. ફરી login કરો.');
  const rows = await sql`
    SELECT id, full_name, username, email, role, page_permissions, is_active
      FROM public.app_users
     WHERE id = ${session.sub}
     LIMIT 1
  `;
  const row = rows[0];
  if (!row || !row.is_active) throw new HttpError(401, 'આ account active નથી. Adminનો સંપર્ક કરો.');
  return publicUser(row);
}

export async function requirePage(request, page) {
  const user = await currentUser(request);
  if (user.role !== 'admin' && !user.pagePermissions.includes(page)) {
    throw new HttpError(403, 'Adminએ આ pageની permission આપી નથી.');
  }
  return user;
}

export async function requireAdmin(request) {
  const user = await currentUser(request);
  if (user.role !== 'admin') throw new HttpError(403, 'આ કામ ફક્ત Admin કરી શકે.');
  return user;
}

export function normalizePermissions(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter(key => PAGE_KEYS.includes(key)))];
}

export async function loginUser(usernameInput, password) {
  const bootstrapUsername = await ensureBootstrapAdmin();
  const username = normalizeUsername(usernameInput);
  if (!password) throw new HttpError(400, 'Username અને password બંને જરૂરી છે.');
  const rows = await sql`
    SELECT id, full_name, username, email, role, page_permissions, is_active, password_hash
      FROM public.app_users
     WHERE lower(username) = ${username}
     LIMIT 1
  `;
  const row = rows[0];
  if (!row || !row.is_active) throw new HttpError(401, 'Username અથવા password ખોટું છે.');
  const valid = username === bootstrapUsername
    ? safeEqual(password, process.env.ADMIN_PASSWORD)
    : verifyPassword(password, row.password_hash);
  if (!valid) throw new HttpError(401, 'Username અથવા password ખોટું છે.');
  return publicUser(row);
}
