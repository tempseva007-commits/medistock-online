import { sql } from '../lib/db.js';
import { requireAdmin } from '../lib/auth.js';
import { assertSameOrigin, fail, HttpError, json, readJson } from '../lib/http.js';
import { todayISO } from '../lib/date.js';

const text = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const qty = v => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const dateOk = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());

async function saveProduct(p) {
  const contentName = text(p?.contentName, 180);
  if (!contentName) throw new HttpError(400, 'Excel importમાં Content Name ખાલી છે.');
  const brandName = text(p.brandName, 180);
  const packing = text(p.packing, 120);
  const uses = text(p.uses, 400);
  const category = text(p.category, 120);
  const demand = p.demand === '' || p.demand == null ? 0 : qty(p.demand);
  if (demand < 0) throw new HttpError(400, `Product ${contentName} માટે Demand ખોટી છે.`);
  const found = await sql`
    SELECT id FROM public.products
     WHERE lower(content_name) = lower(${contentName})
       AND lower(brand_name) = lower(${brandName})
       AND lower(packing) = lower(${packing})
     LIMIT 1
  `;
  if (found[0]) {
    await sql`
      UPDATE public.products
         SET uses = ${uses}, demand = ${demand}, usage_category = ${category}
       WHERE id = ${found[0].id}
    `;
    return found[0].id;
  }
  const inserted = await sql`
    INSERT INTO public.products (content_name, brand_name, packing, uses, demand, usage_category)
    VALUES (${contentName}, ${brandName}, ${packing}, ${uses}, ${demand}, ${category})
    RETURNING id
  `;
  return inserted[0].id;
}

async function savePatient(p) {
  const name = text(p?.name, 180);
  if (!name) throw new HttpError(400, 'Excel importમાં Patient Name ખાલી છે.');
  const patientId = text(p.patientId, 80);
  const phone = text(p.phone, 40);
  const age = p.age === '' || p.age == null ? null : qty(p.age);
  if (age !== null && (!Number.isInteger(age) || age < 0 || age > 130)) throw new HttpError(400, `Patient ${name} માટે Age ખોટી છે.`);
  let found = [];
  if (patientId) {
    found = await sql`SELECT id FROM public.patients WHERE lower(patient_code) = lower(${patientId}) LIMIT 1`;
  } else {
    found = await sql`SELECT id FROM public.patients WHERE lower(name) = lower(${name}) AND COALESCE(phone, '') = ${phone} LIMIT 1`;
  }
  if (found[0]) {
    await sql`
      UPDATE public.patients
         SET name = ${name}, patient_code = ${patientId || null}, phone = ${phone}, age = ${age},
             gender = ${text(p.gender, 40)}, notes = ${text(p.notes, 1000)}
       WHERE id = ${found[0].id}
    `;
    return found[0].id;
  }
  const inserted = await sql`
    INSERT INTO public.patients (name, patient_code, phone, age, gender, notes)
    VALUES (${name}, ${patientId || null}, ${phone}, ${age}, ${text(p.gender, 40)}, ${text(p.notes, 1000)})
    RETURNING id
  `;
  return inserted[0].id;
}

export async function POST(request) {
  try {
    assertSameOrigin(request);
    await requireAdmin(request);
    const body = await readJson(request);
    const products = Array.isArray(body.products) ? body.products : [];
    const patients = Array.isArray(body.patients) ? body.patients : [];
    const entries = Array.isArray(body.stockEntries) ? body.stockEntries : [];
    const outs = Array.isArray(body.stockOuts) ? body.stockOuts : [];
    if (!products.length && !patients.length && !entries.length && !outs.length) throw new HttpError(400, 'Workbookમાં import કરવા records નથી.');

    const productIds = new Map();
    const patientIds = new Map();
    let addedProducts = 0, addedPatients = 0, addedEntries = 0, addedOuts = 0, duplicatesSkipped = 0;
    for (const p of products) {
      const key = [text(p.contentName), text(p.brandName), text(p.packing)].map(x => x.toLowerCase()).join('|');
      const before = await sql`SELECT id FROM public.products WHERE lower(content_name)=lower(${text(p.contentName)}) AND lower(brand_name)=lower(${text(p.brandName)}) AND lower(packing)=lower(${text(p.packing)}) LIMIT 1`;
      const id = await saveProduct(p);
      if (!before[0]) addedProducts++;
      productIds.set(key, id);
    }
    for (const p of patients) {
      const key = p.patientId ? `id:${text(p.patientId).toLowerCase()}` : `name:${text(p.name).toLowerCase()}|${text(p.phone)}`;
      const before = p.patientId
        ? await sql`SELECT id FROM public.patients WHERE lower(patient_code)=lower(${text(p.patientId)}) LIMIT 1`
        : await sql`SELECT id FROM public.patients WHERE lower(name)=lower(${text(p.name)}) AND COALESCE(phone,'')=${text(p.phone)} LIMIT 1`;
      const id = await savePatient(p);
      if (!before[0]) addedPatients++;
      patientIds.set(key, id);
    }
    async function getProductId(p) {
      const key = [text(p.contentName), text(p.brandName), text(p.packing)].map(x => x.toLowerCase()).join('|');
      if (productIds.has(key)) return productIds.get(key);
      const id = await saveProduct(p);
      productIds.set(key, id);
      return id;
    }
    async function getPatientId(p) {
      const key = p.patientId ? `id:${text(p.patientId).toLowerCase()}` : `name:${text(p.name).toLowerCase()}|${text(p.phone)}`;
      if (patientIds.has(key)) return patientIds.get(key);
      if (!p.patientId && text(p.name)) {
        const byName = await sql`SELECT id FROM public.patients WHERE lower(name)=lower(${text(p.name)}) ORDER BY created_at LIMIT 1`;
        if (byName[0]) { patientIds.set(key, byName[0].id); return byName[0].id; }
      }
      const id = await savePatient(p);
      patientIds.set(key, id);
      return id;
    }

    for (const e of entries) {
      const productId = await getProductId(e.product || e);
      const amount = qty(e.qtyIn ?? e.stockIn ?? e.qty);
      const expiry = String(e.expiryDate || '');
      const entryDate = dateOk(e.entryDate) ? e.entryDate : todayISO();
      if (amount <= 0 || !dateOk(expiry)) throw new HttpError(400, 'Stock Entryમાં quantity અથવા expiry date ખોટી છે.');
      const duplicate = await sql`
        SELECT id FROM public.stock_entries
         WHERE product_id = ${productId} AND qty_in = ${amount}
           AND expiry_date = ${expiry}::date AND entry_date = ${entryDate}::date
         LIMIT 1
      `;
      if (duplicate[0]) { duplicatesSkipped++; continue; }
      await sql`
        INSERT INTO public.stock_entries (product_id, batch_no, qty_in, expiry_date, entry_date)
        VALUES (${productId}, ${text(e.batchNo, 100)}, ${amount}, ${expiry}::date, ${entryDate}::date)
      `;
      addedEntries++;
    }

    for (const o of outs) {
      const productId = await getProductId(o.product || o);
      const patientName = text(o.patientName || o.patient, 180);
      if (!patientName) throw new HttpError(400, `Stock OUTમાં Patient ખાલી છે (${text(o.product?.contentName || o.contentName)}).`);
      const patientId = await getPatientId(o.patientRecord || { name: patientName, patientId: text(o.patientId), phone: text(o.phone) });
      const amount = qty(o.qtyOut ?? o.stockOut ?? o.qty);
      const issueDate = dateOk(o.issueDate || o.date) ? (o.issueDate || o.date) : todayISO();
      const expiry = String(o.expiryDate || '');
      if (amount <= 0 || !dateOk(expiry)) throw new HttpError(400, 'Stock OUTમાં quantity અથવા expiry date ખોટી છે.');
      const duplicate = await sql`
        SELECT so.id FROM public.stock_outs so
        JOIN public.stock_entries se ON se.id = so.stock_entry_id
         WHERE se.product_id = ${productId} AND so.patient_id = ${patientId}
           AND so.qty_out = ${amount} AND so.issue_date = ${issueDate}::date
           AND se.expiry_date = ${expiry}::date
         LIMIT 1
      `;
      if (duplicate[0]) { duplicatesSkipped++; continue; }
      const lots = await sql`
        SELECT se.id, se.qty_in - COALESCE(SUM(so.qty_out),0) AS balance
          FROM public.stock_entries se
          LEFT JOIN public.stock_outs so ON so.stock_entry_id = se.id
         WHERE se.product_id = ${productId} AND se.expiry_date = ${expiry}::date
         GROUP BY se.id
         HAVING se.qty_in - COALESCE(SUM(so.qty_out),0) > 0
         ORDER BY se.entry_date, se.created_at
      `;
      let remaining = amount;
      for (const lot of lots) {
        if (remaining <= 0) break;
        const available = Number(lot.balance) || 0;
        const issueQty = Math.min(remaining, available);
        if (issueQty > 0) {
          await sql`SELECT public.issue_stock(${lot.id}, ${patientId}, ${issueQty}, ${issueDate}::date)`;
          remaining -= issueQty;
          addedOuts++;
        }
      }
      if (remaining > 0) throw new HttpError(409, `Import અટક્યું: ${patientName} માટે ${text(o.product?.contentName || o.contentName)}ના આ expiry batchમાં પૂરતો stock નથી.`);
    }

    return json({ ok: true, counts: { products: addedProducts, patients: addedPatients, stockEntries: addedEntries, stockOuts: addedOuts, duplicatesSkipped } });
  } catch (error) {
    return fail(error);
  }
}
