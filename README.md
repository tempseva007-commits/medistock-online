# MediStock Online (Neon + Vercel)

Vercel-hosted frontend and API with Neon PostgreSQL. The browser never receives the database connection string.

## Important environment variables

Set these in Vercel Project Settings → Environment Variables:

- `DATABASE_URL`: the **new, pooled** Neon connection string (keep it secret; do not prefix with `VITE_`).
- `ADMIN_NAME` (optional): name shown for the first Admin; defaults to `Admin`.
- `ADMIN_EMAIL`: email for the first Admin.
- `ADMIN_PASSWORD`: initial Admin password (at least 10 characters). The bootstrap Admin is created automatically when the login endpoint first runs. Change this value in Vercel if you want to rotate the bootstrap login.
- `SESSION_SECRET`: a long random secret (at least 32 characters) used to sign secure login cookies.

Do not commit `.env.local` or share secrets in chat.

## Database setup

In Neon Console → SQL Editor, run `db/setup.sql`. It creates the inventory tables, `app_users` permissions table, expiry setting and atomic Stock OUT function. It is safe to run on top of the matching tables created from the earlier MediStock guide.

## Deploy

1. Push this folder's contents to a private GitHub repository.
2. Import that repository in Vercel.
3. Set the four environment variables above for Production (and Preview if required).
4. Build command: `npm run build`; output: `dist`.
5. Deploy, then visit `/api/health` to confirm the API can reach Neon.
6. Sign in using the Admin email/password from Vercel.
7. In Admin → Users & rights, create Member accounts and choose their page permissions.

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

Page keys are: `dashboard`, `products`, `stockIn`, `stockOut`, `patients`, `alerts`.
