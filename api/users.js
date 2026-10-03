import { sql } from '../lib/db.js';
import { hashPassword, normalizePermissions, normalizeUsername, publicUser, requireAdmin } from '../lib/auth.js';
import { assertSameOrigin, fail, HttpError, json, readJson } from '../lib/http.js';

export async function GET(request) {
  try {
    await requireAdmin(request);
    const rows = await sql`
      SELECT id, full_name, username, email, role, page_permissions, is_active
        FROM public.app_users
       WHERE role = 'member'
       ORDER BY lower(full_name)
    `;
    return json({ users: rows.map(publicUser) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request) {
  try {
    assertSameOrigin(request);
    await requireAdmin(request);
    const body = await readJson(request);
    const name = String(body.name || '').trim();
    const username = normalizeUsername(body.username);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!name || !email.includes('@')) throw new HttpError(400, 'Memberનું નામ અને profile email જરૂરી છે.');
    if (password.length < 10) throw new HttpError(400, 'Password ઓછામાં ઓછો 10 charactersનો રાખો.');
    const permissions = normalizePermissions(body.pagePermissions);
    const rows = await sql`
      INSERT INTO public.app_users (full_name, username, email, password_hash, role, page_permissions, is_active)
      VALUES (${name}, ${username}, ${email}, ${hashPassword(password)}, 'member', ${JSON.stringify(permissions)}::jsonb, true)
      RETURNING id, full_name, username, email, role, page_permissions, is_active
    `;
    return json({ user: publicUser(rows[0]) }, 201);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request) {
  try {
    assertSameOrigin(request);
    await requireAdmin(request);
    const body = await readJson(request);
    const id = String(body.id || '');
    if (!id) throw new HttpError(400, 'User ID જરૂરી છે.');
    const existing = await sql`
      SELECT id, full_name, username, email, role, page_permissions, is_active
        FROM public.app_users
       WHERE id = ${id} AND role = 'member'
       LIMIT 1
    `;
    if (!existing[0]) throw new HttpError(404, 'Member મળ્યો નથી.');
    const current = existing[0];
    const name = String(body.name ?? current.full_name).trim();
    const username = normalizeUsername(body.username ?? current.username);
    const email = String(body.email ?? current.email).trim().toLowerCase();
    if (!name || !email.includes('@')) throw new HttpError(400, 'નામ અને યોગ્ય profile email જરૂરી છે.');
    const permissions = body.pagePermissions === undefined
      ? (Array.isArray(current.page_permissions) ? current.page_permissions : [])
      : normalizePermissions(body.pagePermissions);
    const active = body.active === undefined ? current.is_active : Boolean(body.active);
    const newPassword = String(body.password || '');
    let rows;
    if (newPassword) {
      if (newPassword.length < 10) throw new HttpError(400, 'નવો password ઓછામાં ઓછો 10 charactersનો રાખો.');
      rows = await sql`
        UPDATE public.app_users
           SET full_name = ${name}, username = ${username}, email = ${email},
               page_permissions = ${JSON.stringify(permissions)}::jsonb,
               is_active = ${active}, password_hash = ${hashPassword(newPassword)}, updated_at = now()
         WHERE id = ${id}
         RETURNING id, full_name, username, email, role, page_permissions, is_active
      `;
    } else {
      rows = await sql`
        UPDATE public.app_users
           SET full_name = ${name}, username = ${username}, email = ${email},
               page_permissions = ${JSON.stringify(permissions)}::jsonb,
               is_active = ${active}, updated_at = now()
         WHERE id = ${id}
         RETURNING id, full_name, username, email, role, page_permissions, is_active
      `;
    }
    return json({ user: publicUser(rows[0]) });
  } catch (error) {
    return fail(error);
  }
}
