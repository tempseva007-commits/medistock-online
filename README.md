# MediStock Online (Neon + Vercel)

Vercel-hosted frontend and API with Neon PostgreSQL. The browser never receives the database connection string.

## Important environment variables

Set these in Vercel Project Settings → Environment Variables:

- `DATABASE_URL`: the **new, pooled** Neon connection string (keep it secret; do not prefix with `VITE_`).
- `ADMIN_NAME` (optional): name shown for the first Admin; defaults to `Admin`.
- `ADMIN_USERNAME` (recommended): username for the bootstrap Admin; 3–50 letters/numbers/dot/underscore/hyphen. If omitted, it defaults to the part of `ADMIN_EMAIL` before `@`.
- `ADMIN_EMAIL`: profile/bootstrap email for the first Admin. Email is not accepted as a login name.
- `ADMIN_PASSWORD`: initial Admin password (at least 10 characters). The bootstrap Admin is created automatically when the login endpoint first runs. Change this value in Vercel and redeploy to rotate the bootstrap password.
- `SESSION_SECRET`: a long random secret (at least 32 characters) used to sign secure login cookies.

Sign in with **username + password**. Existing accounts receive a username based on the email local-part when `db/setup.sql` is rerun; duplicate names get a short suffix. Admins can set/change Member usernames in Users & Rights. Email remains profile data only.

Do not commit `.env.local` or share secrets in chat.

## Database setup

In Neon Console → SQL Editor, run `db/setup.sql`. It creates the inventory tables, `app_users` permissions table, expiry setting and atomic Stock OUT function. It is safe to run on top of the matching tables created from the earlier MediStock guide.

## Deploy

1. Push this folder's contents to a private GitHub repository.
2. Import that repository in Vercel.
3. Set the four required environment variables above for Production (and Preview if required); optionally set `ADMIN_USERNAME`.
4. Build command: `npm run build`; output: `dist`.
5. Deploy, then visit `/api/health` to confirm the API can reach Neon.
6. Sign in using `ADMIN_USERNAME` (or the `ADMIN_EMAIL` local-part if not set) and `ADMIN_PASSWORD`.
7. In Admin → Users & rights, create Member usernames and choose their page permissions.

## Local development

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your own credentials. Do not commit it.
npx vercel dev
```

`npm run dev` starts the Vite-only static frontend; `npx vercel dev` is the recommended way to test `/api` Functions locally.

## Import and export

- Admin can import `.xlsx` workbooks or individual `.csv` tables. CSV needs a header row; import one table per CSV (`Product Master`, `Stock Entry`/`Stock IN`, `Stock Out`, or `Patient Master`). Common comma-, semicolon-, and tab-delimited UTF-8 CSV files are supported.
- Import merges with existing records. Stock transactions can be duplicated if the same file is imported again; download a backup and review the confirmation before importing.
- Admin can export the full workbook and download the `.xlsx` template. CSV export is not provided.

## Roles

- Admin: full access, including managing Member accounts, page permissions, imports and record deletion.
- Member: access only to pages enabled by Admin. API endpoints enforce the same permission checks; hiding a menu item alone is not used as security.
- Password recovery is Admin-managed: Admin sets a Member's new password in Users & Rights. To reset the bootstrap Admin password, change `ADMIN_PASSWORD` in Vercel and redeploy. Username alone is not treated as proof of identity.

Page keys are: `dashboard`, `products`, `stockIn`, `stockOut`, `patients`, `alerts`.
