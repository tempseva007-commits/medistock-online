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

function currentMonthIndex() {
  const [year, month] = todayISO().slice(0, 7).split('-').map(Number);
  return year * 12 + month - 1;
}

function expiryMonthIndex(date) {
  const match = String(date || '').slice(0, 7).match(/^(\d{4})-(\d{2})$/);
  return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
}

function isWithinExpiryMonths(date, months) {
  const index = expiryMonthIndex(date);
  const current = currentMonthIndex();
  return index !== null && index >= current && index < current + months;
}

function usableStockByProduct(products, entries) {
  const stock = new Map(products.map(product => [product.id, 0]));
  const today = todayISO();
  for (const entry of entries) {
    if (String(entry.expiryDate) >= today && Number(entry.currentStock) > 0) {
      stock.set(entry.productId, (stock.get(entry.productId) || 0) + Number(entry.currentStock));
    }
  }
  return stock;
}

// Treat Demand as one content-level threshold, not a per-brand amount.
// If variant rows differ, the highest entered Demand is used conservatively.
function lowStockByContent(products, entries) {
  const stockByProduct = usableStockByProduct(products, entries);
  const groups = new Map();
  for (const product of products) {
    const key = String(product.contentName || '').trim().toLowerCase();
    if (!key) continue;
    let group = groups.get(key);
    if (!group) {
      group = { contentName: product.contentName, brandNames: new Set(), currentStock: 0, demand: 0, variantCount: 0 };
      groups.set(key, group);
    }
    if (product.brandName) group.brandNames.add(product.brandName);
    group.currentStock += stockByProduct.get(product.id) || 0;
    group.demand = Math.max(group.demand, Number(product.demand) || 0);
    group.variantCount++;
  }
  return [...groups.values()]
    .map(group => ({ ...group, brandNames: [...group.brandNames].sort((a, b) => a.localeCompare(b)) }))
    .filter(group => group.currentStock < group.demand)
    .sort((a, b) => (a.currentStock / (a.demand || 1)) - (b.currentStock / (b.demand || 1)) || a.contentName.localeCompare(b.contentName));
}

function expiringEntries(entries, expiryMonths) {
  return entries
    .map(entry => ({ ...entry, daysLeft: daysUntil(entry.expiryDate) }))
    .filter(entry => Number(entry.currentStock) > 0 && entry.daysLeft !== null && (entry.daysLeft < 0 || isWithinExpiryMonths(entry.expiryDate, expiryMonths)))
    .sort((a, b) => a.daysLeft - b.daysLeft);
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
           p.brand_name AS "brandName", p.packing, p.uses, p.demand,
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
           p.packing, p.uses, p.demand, p.usage_category AS category,
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

async function getExpiryMonths() {
  // Fixed requirement: current calendar month plus the following month.
  return 2;
}

async function getDashboard() {
  const [products, entries, expiryMonths] = await Promise.all([getProducts(), getStockEntries(), getExpiryMonths()]);
  const stockByProduct = usableStockByProduct(products, entries);
  const lowStock = lowStockByContent(products, entries);
  const expiring = expiringEntries(entries, expiryMonths).slice(0, 8);
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
      lowCount: lowStock.length,
      expiringCount: expiringEntries(entries, expiryMonths).length,
      expiryMonths,
    },
    lowStock: lowStock.slice(0, 8),
    expiring,
    recent,
  };
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '';
    if (page === 'export') {
      await requireAdmin(request);
      const section = url.searchParams.get('section') || '';
      if (section === 'products') return json({ products: await getProducts() });
      if (section === 'stockIn') return json({ stockEntries: await getStockEntries() });
      if (section === 'stockOut') return json({ stockOuts: await getStockOuts() });
      if (section === 'patients') return json({ patients: await getPatients() });
      throw new HttpError(400, 'Export માટે એક જ tab પસંદ કરો.');
    }
    if (page === 'dashboard') {
      await requirePage(request, page);
      return json(await getDashboard());
    }
    if (page === 'products') {
      await requirePage(request, page);
      const [products, entries] = await Promise.all([getProducts(), getStockEntries()]);
      const stockByProduct = usableStockByProduct(products, entries);
      return json({ products: products.map(product => ({ ...product, currentStock: stockByProduct.get(product.id) || 0 })) });
    }
    if (page === 'patients') {
      await requirePage(request, page);
      return json({ patients: await getPatients() });
    }
    if (page === 'stockIn') {
      await requirePage(request, page);
      const [products, stockEntries, expiryMonths] = await Promise.all([getProducts(), getStockEntries(), getExpiryMonths()]);
      return json({ products, stockEntries, expiryMonths });
    }
    if (page === 'stockOut') {
      await requirePage(request, page);
      const [products, patients, stockEntries, stockOuts] = await Promise.all([getProducts(), getPatients(), getStockEntries(), getStockOuts()]);
      const stockByProduct = usableStockByProduct(products, stockEntries);
      return json({ products: products.map(product => ({ ...product, currentStock: stockByProduct.get(product.id) || 0 })), patients, stockEntries, stockOuts });
    }
    if (page === 'alerts') {
      await requirePage(request, page);
      const [products, stockEntries, expiryMonths] = await Promise.all([getProducts(), getStockEntries(), getExpiryMonths()]);
      return json({ lowStock: lowStockByContent(products, stockEntries), expiring: expiringEntries(stockEntries, expiryMonths), expiryMonths });
    }
    throw new HttpError(400, 'આ page data માટે request માન્ય નથી.');
  } catch (error) {
    return fail(error);
  }
}
