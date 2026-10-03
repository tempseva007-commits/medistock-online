import { sql } from '../lib/db.js';
import { requireAdmin, requirePage } from '../lib/auth.js';
import { assertSameOrigin, fail, HttpError, json, readJson } from '../lib/http.js';
import { todayISO } from '../lib/date.js';

const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const number = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
};
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

export async function POST(request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const type = String(body.type || '');
    const p = body.payload || {};

    if (type.startsWith('product.')) {
      const user = await requirePage(request, 'products');
      if (type === 'product.create' || type === 'product.update') {
        const contentName = clean(p.contentName, 180);
        const brandName = clean(p.brandName, 180);
        const packing = clean(p.packing, 120);
        const uses = clean(p.uses, 400);
        const category = clean(p.category, 120);
        const demand = p.demand === '' || p.demand == null ? 0 : number(p.demand);
        if (!contentName) throw new HttpError(400, 'Content Name જરૂરી છે.');
        if (!Number.isFinite(demand) || demand < 0) throw new HttpError(400, 'Demand શૂન્ય અથવા તેનાથી વધારે હોવી જોઈએ.');
        if (type === 'product.create') {
          const rows = await sql`
            INSERT INTO public.products (content_name, brand_name, packing, uses, demand, usage_category)
            VALUES (${contentName}, ${brandName}, ${packing}, ${uses}, ${demand}, ${category})
            RETURNING id
          `;
          return json({ ok: true, id: rows[0].id }, 201);
        }
        const id = clean(p.id, 80);
        const rows = await sql`
          UPDATE public.products
             SET content_name = ${contentName}, brand_name = ${brandName}, packing = ${packing},
                 uses = ${uses}, demand = ${demand}, usage_category = ${category}
           WHERE id = ${id}
           RETURNING id
        `;
        if (!rows.length) throw new HttpError(404, 'Product મળ્યો નથી.');
        return json({ ok: true });
      }
      if (type === 'product.delete') {
        if (user.role !== 'admin') throw new HttpError(403, 'Product delete ફક્ત Admin કરી શકે.');
        const rows = await sql`DELETE FROM public.products WHERE id = ${clean(p.id, 80)} RETURNING id`;
        if (!rows.length) throw new HttpError(404, 'Product મળ્યો નથી.');
        return json({ ok: true });
      }
    }

    if (type.startsWith('patient.')) {
      const user = await requirePage(request, 'patients');
      if (type === 'patient.create' || type === 'patient.update') {
        const name = clean(p.name, 180);
        const patientId = clean(p.patientId, 80);
        const phone = clean(p.phone, 40);
        const age = p.age === '' || p.age == null ? null : number(p.age);
        const gender = clean(p.gender, 40);
        const notes = clean(p.notes, 1000);
        if (!name) throw new HttpError(400, 'Patient Name જરૂરી છે.');
        if (age !== null && (!Number.isInteger(age) || age < 0 || age > 130)) throw new HttpError(400, 'Age 0થી 130 વચ્ચે હોવી જોઈએ.');
        if (type === 'patient.create') {
          const rows = await sql`
            INSERT INTO public.patients (name, patient_code, phone, age, gender, notes)
            VALUES (${name}, ${patientId || null}, ${phone}, ${age}, ${gender}, ${notes})
            RETURNING id
          `;
          return json({ ok: true, id: rows[0].id }, 201);
        }
        const rows = await sql`
          UPDATE public.patients
             SET name = ${name}, patient_code = ${patientId || null}, phone = ${phone},
                 age = ${age}, gender = ${gender}, notes = ${notes}
           WHERE id = ${clean(p.id, 80)}
           RETURNING id
        `;
        if (!rows.length) throw new HttpError(404, 'Patient મળ્યો નથી.');
        return json({ ok: true });
      }
      if (type === 'patient.delete') {
        if (user.role !== 'admin') throw new HttpError(403, 'Patient delete ફક્ત Admin કરી શકે.');
        const rows = await sql`DELETE FROM public.patients WHERE id = ${clean(p.id, 80)} RETURNING id`;
        if (!rows.length) throw new HttpError(404, 'Patient મળ્યો નથી.');
        return json({ ok: true });
      }
    }

    if (type === 'stockIn.create') {
      const user = await requirePage(request, 'stockIn');
      const productId = clean(p.productId, 80);
      const qtyIn = number(p.qtyIn);
      const expiryDate = String(p.expiryDate || '');
      const entryDate = p.entryDate && validDate(p.entryDate) ? p.entryDate : todayISO();
      if (!productId || !Number.isFinite(qtyIn) || qtyIn <= 0 || !validDate(expiryDate)) throw new HttpError(400, 'Product, positive quantity અને valid expiry date જરૂરી છે.');
      const rows = await sql`
        INSERT INTO public.stock_entries (product_id, batch_no, qty_in, expiry_date, entry_date)
        VALUES (${productId}, ${clean(p.batchNo, 100)}, ${qtyIn}, ${expiryDate}::date, ${entryDate}::date)
        RETURNING id
      `;
      return json({ ok: true, id: rows[0].id, createdBy: user.id }, 201);
    }

    if (type === 'stockIn.delete') {
      const user = await requireAdmin(request);
      const rows = await sql`DELETE FROM public.stock_entries WHERE id = ${clean(p.id, 80)} RETURNING id`;
      if (!rows.length) throw new HttpError(404, 'Stock IN batch મળ્યો નથી.');
      return json({ ok: true, by: user.id });
    }

    if (type === 'stockOut.create') {
      const user = await requirePage(request, 'stockOut');
      const lotId = clean(p.lotId, 80);
      const patientId = clean(p.patientId, 80);
      const qtyOut = number(p.qtyOut);
      const issueDate = p.issueDate && validDate(p.issueDate) ? p.issueDate : todayISO();
      if (!lotId || !patientId || !Number.isFinite(qtyOut) || qtyOut <= 0) throw new HttpError(400, 'Batch, Patient અને positive Stock OUT quantity જરૂરી છે.');
      const rows = await sql`
        SELECT public.issue_stock(${lotId}, ${patientId}, ${qtyOut}, ${issueDate}::date) AS id
      `;
      return json({ ok: true, id: rows[0].id, createdBy: user.id }, 201);
    }

    if (type === 'stockOut.delete') {
      const user = await requireAdmin(request);
      const rows = await sql`DELETE FROM public.stock_outs WHERE id = ${clean(p.id, 80)} RETURNING id`;
      if (!rows.length) throw new HttpError(404, 'Stock OUT record મળ્યો નથી.');
      return json({ ok: true, by: user.id });
    }

    throw new HttpError(400, 'Action ઓળખાઈ નથી.');
  } catch (error) {
    return fail(error);
  }
}
