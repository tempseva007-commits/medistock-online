import { sql } from '../lib/db.js';
import { requireAdmin, requirePage } from '../lib/auth.js';
import { fail, HttpError, json } from '../lib/http.js';
import { todayISO } from '../lib/date.js';

function daysUntil(date) {
  if (!date) return null;
  const today = new Date(`${todayISO()}T00:00:00Z`);
  const target = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target - today) / 86400000);
}

async function getProducts() {
  return sql`
    SELECT id, content_name AS "contentName", brand_name AS "brandName",
           packing, uses, demand, usage_category AS category, created_at AS "createdAt"
      FROM public.products
     ORDER BY lower(content_name), lower(brand_name)
  `;
}

async function getPatients() {
  return sql`
    SELECT id, name, patient_code AS "patientId", phone, age, gender, notes,
           created_at AS "createdAt"
      FROM public.patients
     ORDER BY lower(name)
  `;
}

async function getStockEntries() {
  return sql`
    SELECT se.id, se.product_id AS "productId", p.content_name AS "contentName",
           p.brand_name AS "brandName", p.packing, p.uses,
           p.usage_category AS category, se.batch_no AS "batchNo",
           se.qty_in AS "qtyIn", se.expiry_date AS "expiryDate",
           se.entry_date AS "entryDate", se.created_at AS "createdAt",
           COALESCE(SUM(so.qty_out), 0) AS "qtyOut",
           se.qty_in - COALESCE(SUM(so.qty_out), 0) AS "currentStock"
      FROM public.stock_entries se
      JOIN public.products p ON p.id = se.product_id
      LEFT JOIN public.stock_outs so ON so.stock_entry_id = se.id
     GROUP BY se.id, p.id
     ORDER BY se.created_at DESC
  `;
}

async function getStockOuts() {
  return sql`
    SELECT so.id, so.stock_entry_id AS "lotId", se.product_id AS "productId",
           p.content_name AS "contentName", p.brand_name AS "brandName",
           p.packing, p.uses, p.usage_category AS category,
           se.expiry_date AS "expiryDate", so.patient_id AS "patientId",
           pt.name AS "patientName", pt.patient_code AS "patientCode",
           so.qty_out AS qty, so.issue_date AS date, so.created_at AS "createdAt"
      FROM public.stock_outs so
      JOIN public.stock_entries se ON se.id = so.stock_entry_id
      JOIN public.products p ON p.id = se.product_id
      JOIN public.patients pt ON pt.id = so.patient_id
     ORDER BY so.created_at DESC
  `;
}

async function getExpiryDays() {
  const rows = await sql`SELECT expiry_alert_days AS days FROM public.app_settings WHERE id = 1`;
  return Number(rows[0]?.days ?? 30);
}

async function getDashboard() {
  const [products, entries, expiryDays] = await Promise.all([getProducts(), getStockEntries(), getExpiryDays()]);
  const today = todayISO();
  const stockByProduct = new Map(products.map(p => [p.id, 0]));
  const usableEntries = entries.filter(e => String(e.expiryDate) >= today && Number(e.currentStock) > 0);
  for (const e of usableEntries) stockByProduct.set(e.productId, (stockByProduct.get(e.productId) || 0) + Number(e.currentStock));
  const lowStock = products
    .map(p => ({ ...p, currentStock: stockByProduct.get(p.id) || 0 }))
    .filter(p => p.currentStock <= Number(p.demand || 0))
    .slice(0, 8);
  const expiring = entries
    .map(e => ({ ...e, daysLeft: daysUntil(e.expiryDate) }))
    .filter(e => Number(e.currentStock) > 0 && e.daysLeft !== null && e.daysLeft <= expiryDays)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 8);
  const recentIn = await sql`
    SELECT 'in' AS kind, p.content_name AS "contentName", p.brand_name AS "brandName",
           se.qty_in AS qty, se.entry_date AS date, se.created_at AS "createdAt"
      FROM public.stock_entries se JOIN public.products p ON p.id = se.product_id
     ORDER BY se.created_at DESC LIMIT 5
  `;
  const recentOut = await sql`
    SELECT 'out' AS kind, p.content_name AS "contentName", p.brand_name AS "brandName",
           so.qty_out AS qty, so.issue_date AS date, so.created_at AS "createdAt"
      FROM public.stock_outs so
      JOIN public.stock_entries se ON se.id = so.stock_entry_id
      JOIN public.products p ON p.id = se.product_id
     ORDER BY so.created_at DESC LIMIT 5
  `;
  const recent = [...recentIn, ...recentOut]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 7);
  const patients = await sql`SELECT count(*)::int AS count FROM public.patients`;
  return {
    summary: {
      productCount: products.length,
      patientCount: Number(patients[0]?.count || 0),
      units: [...stockByProduct.values()].reduce((a, b) => a + b, 0),
      lowCount: products.filter(p => (stockByProduct.get(p.id) || 0) <= Number(p.demand || 0)).length,
      expiringCount: entries.filter(e => Number(e.currentStock) > 0 && daysUntil(e.expiryDate) !== null && daysUntil(e.expiryDate) <= expiryDays).length,
      expiryDays,
    },
    lowStock,
    expiring,
    recent,
  };
}

export async function GET(request) {
  try {
    const page = new URL(request.url).searchParams.get('page') || '';
    if (page === 'export') {
      await requireAdmin(request);
      const [products, patients, stockEntries, stockOuts] = await Promise.all([getProducts(), getPatients(), getStockEntries(), getStockOuts()]);
      return json({ products, patients, stockEntries, stockOuts, expiryDays: await getExpiryDays() });
    }
    if (page === 'dashboard') {
      await requirePage(request, page);
      return json(await getDashboard());
    }
    if (page === 'products') {
      await requirePage(request, page);
      const [products, entries] = await Promise.all([getProducts(), getStockEntries()]);
      const stockByProduct = new Map(products.map(p => [p.id, 0]));
      for (const e of entries) if (String(e.expiryDate) >= todayISO()) stockByProduct.set(e.productId, (stockByProduct.get(e.productId) || 0) + Number(e.currentStock));
      return json({ products: products.map(p => ({ ...p, currentStock: stockByProduct.get(p.id) || 0 })) });
    }
    if (page === 'patients') {
      await requirePage(request, page);
      return json({ patients: await getPatients() });
    }
    if (page === 'stockIn') {
      await requirePage(request, page);
      const [products, stockEntries, expiryDays] = await Promise.all([getProducts(), getStockEntries(), getExpiryDays()]);
      return json({ products, stockEntries, expiryDays });
    }
    if (page === 'stockOut') {
      await requirePage(request, page);
      const [products, patients, stockEntries, stockOuts] = await Promise.all([getProducts(), getPatients(), getStockEntries(), getStockOuts()]);
      const today = todayISO();
      const stockByProduct = new Map(products.map(p => [p.id, 0]));
      for (const e of stockEntries) if (String(e.expiryDate) >= today) stockByProduct.set(e.productId, (stockByProduct.get(e.productId) || 0) + Number(e.currentStock));
      return json({ products: products.map(p => ({ ...p, currentStock: stockByProduct.get(p.id) || 0 })), patients, stockEntries, stockOuts });
    }
    if (page === 'alerts') {
      await requirePage(request, page);
      const [products, stockEntries, expiryDays] = await Promise.all([getProducts(), getStockEntries(), getExpiryDays()]);
      const today = todayISO();
      const stockByProduct = new Map(products.map(p => [p.id, 0]));
      for (const e of stockEntries) if (String(e.expiryDate) >= today) stockByProduct.set(e.productId, (stockByProduct.get(e.productId) || 0) + Number(e.currentStock));
      const lowStock = products.map(p => ({ ...p, currentStock: stockByProduct.get(p.id) || 0 })).filter(p => p.currentStock <= Number(p.demand || 0));
      const expiring = stockEntries.map(e => ({ ...e, daysLeft: daysUntil(e.expiryDate) })).filter(e => Number(e.currentStock) > 0 && e.daysLeft !== null && e.daysLeft <= expiryDays).sort((a, b) => a.daysLeft - b.daysLeft);
      return json({ lowStock, expiring, expiryDays });
    }
    throw new HttpError(400, 'આ page data માટે request માન્ય નથી.');
  } catch (error) {
    return fail(error);
  }
}
