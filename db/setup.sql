-- MediStock Neon setup / migration
-- Run this in Neon Console > SQL Editor. Safe to re-run for the schema from the earlier guide.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_name text NOT NULL,
  brand_name text NOT NULL DEFAULT '',
  packing text NOT NULL DEFAULT '',
  uses text NOT NULL DEFAULT '',
  demand numeric(12,2) NOT NULL DEFAULT 0 CHECK (demand >= 0),
  usage_category text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS products_identity
  ON public.products (lower(content_name), lower(brand_name), lower(packing));

CREATE TABLE IF NOT EXISTS public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  patient_code text,
  phone text,
  age integer CHECK (age IS NULL OR age BETWEEN 0 AND 130),
  gender text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS patients_patient_code_unique
  ON public.patients (lower(patient_code))
  WHERE patient_code IS NOT NULL AND btrim(patient_code) <> '';

CREATE TABLE IF NOT EXISTS public.stock_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_no text,
  qty_in numeric(12,2) NOT NULL CHECK (qty_in > 0),
  expiry_date date NOT NULL,
  entry_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_entries ADD COLUMN IF NOT EXISTS batch_no text;
CREATE INDEX IF NOT EXISTS stock_entries_product_expiry
  ON public.stock_entries (product_id, expiry_date);

CREATE TABLE IF NOT EXISTS public.stock_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_entry_id uuid NOT NULL REFERENCES public.stock_entries(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  qty_out numeric(12,2) NOT NULL CHECK (qty_out > 0),
  issue_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_outs_entry
  ON public.stock_outs (stock_entry_id);

-- Users and per-page access. Admin has all rights; Members have selected page keys.
CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  username text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  page_permissions jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(page_permissions) = 'array'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Migrate existing accounts to usernames based on the email local-part. When
-- multiple accounts share that local-part, add a short ID suffix to avoid
-- collisions. Email remains profile data and is no longer a login identifier.
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS username text;
WITH identities AS (
  SELECT id,
         lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g')) AS base_username,
         count(*) OVER (
           PARTITION BY lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g'))
         ) AS local_count
    FROM public.app_users
   WHERE username IS NULL OR btrim(username) = ''
)
UPDATE public.app_users AS u
   SET username = CASE
     WHEN length(i.base_username) < 3 THEN 'user_' || replace(i.id::text, '-', '')
     WHEN i.local_count = 1 THEN left(i.base_username, 50)
     ELSE left(i.base_username, 41) || '_' || left(replace(i.id::text, '-', ''), 8)
   END
  FROM identities AS i
 WHERE u.id = i.id;
ALTER TABLE public.app_users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_lower_unique
  ON public.app_users (lower(username));
CREATE INDEX IF NOT EXISTS app_users_role_active ON public.app_users (role, is_active);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  expiry_alert_days integer NOT NULL DEFAULT 30 CHECK (expiry_alert_days BETWEEN 0 AND 365),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (id, expiry_alert_days)
VALUES (1, 30)
ON CONFLICT (id) DO NOTHING;

-- Batch balance view (stock in minus all stock out records for that batch).
CREATE OR REPLACE VIEW public.stock_batch_balance AS
SELECT
  se.id AS stock_entry_id,
  se.product_id,
  se.batch_no,
  se.expiry_date,
  se.entry_date,
  se.qty_in,
  se.qty_in - COALESCE(SUM(so.qty_out), 0) AS current_stock
FROM public.stock_entries AS se
LEFT JOIN public.stock_outs AS so ON so.stock_entry_id = se.id
GROUP BY se.id;

-- Atomic stock issue. A row lock prevents two Members dispensing more than the batch contains.
-- Historical imported issues are allowed only if their issue_date was on/before expiry.
CREATE OR REPLACE FUNCTION public.issue_stock(
  p_stock_entry_id uuid,
  p_patient_id uuid,
  p_qty_out numeric,
  p_issue_date date DEFAULT current_date
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_qty_in numeric(12,2);
  v_expiry_date date;
  v_already_out numeric(12,2);
  v_new_id uuid;
BEGIN
  IF p_qty_out IS NULL OR p_qty_out <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  SELECT qty_in, expiry_date
    INTO v_qty_in, v_expiry_date
    FROM public.stock_entries
   WHERE id = p_stock_entry_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock batch not found';
  END IF;

  IF v_expiry_date < p_issue_date THEN
    RAISE EXCEPTION 'Cannot dispense from an expired batch';
  END IF;

  SELECT COALESCE(SUM(qty_out), 0)
    INTO v_already_out
    FROM public.stock_outs
   WHERE stock_entry_id = p_stock_entry_id;

  IF (v_qty_in - v_already_out) < p_qty_out THEN
    RAISE EXCEPTION 'Not enough stock in this batch';
  END IF;

  INSERT INTO public.stock_outs (stock_entry_id, patient_id, qty_out, issue_date)
  VALUES (p_stock_entry_id, p_patient_id, p_qty_out, p_issue_date)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
