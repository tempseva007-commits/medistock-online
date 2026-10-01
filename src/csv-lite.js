// Small CSV reader for UTF-8, comma/semicolon/tab-delimited files.
// Handles quoted fields, escaped double quotes, CRLF, and newlines inside quotes.
function sniffDelimiter(text) {
  const candidates = [',', ';', '\t'];
  const counts = new Map(candidates.map(ch => [ch, 0]));
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted && (ch === '\n' || ch === '\r')) break;
    else if (!quoted && counts.has(ch)) counts.set(ch, counts.get(ch) + 1);
  }
  return candidates.reduce((best, ch) => counts.get(ch) > counts.get(best) ? ch : best, ',');
}

export function parseCsv(input) {
  const text = String(input ?? '').replace(/^\uFEFF/, '');
  if (!text.trim()) return [];
  const delimiter = sniffDelimiter(text);
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      row.push(cell); cell = '';
      if (row.some(value => String(value).trim() !== '')) rows.push(row);
      row = [];
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else cell += ch;
  }
  if (quoted) throw new Error('CSV fileમાં બંધ ન થયેલું quote છે. Fileને ફરી UTF-8 CSV તરીકે save કરો.');
  row.push(cell);
  if (row.some(value => String(value).trim() !== '')) rows.push(row);
  return rows;
}

function normalizeHeader(value) { return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

export function detectCsvSheet(rows, filename = '') {
  const file = normalizeHeader(String(filename).replace(/\.csv$/i, ''));
  const headerIndex = rows.findIndex(row => row.some(value => String(value ?? '').trim()));
  const headers = new Set((rows[headerIndex] || []).map(normalizeHeader));
  const has = (...keys) => keys.some(key => headers.has(key));
  if (file.includes('stockout') || file.includes('stockissue')) return 'Stock Out';
  if (has('stockout', 'qtyout', 'quantityout', 'issuedquantity', 'quantityissued')) return 'Stock Out';
  if (has('contentname', 'content') && has('patient', 'patientname') && has('expirydate', 'expiry', 'issuedate')) return 'Stock Out';
  if (file.includes('stockentry') || file.includes('stockin')) return 'Stock Entry';
  if (has('stockin', 'qtyin', 'quantityin', 'receivedquantity')) return 'Stock Entry';
  if (has('contentname', 'content') && has('expirydate', 'expiry') && has('qty', 'quantity', 'currentstock')) return 'Stock Entry';
  if (!has('contentname', 'content') && has('patientname', 'patientid', 'patientcode', 'phone', 'mobile')) return 'Patient Master';
  if (file.includes('patient')) return 'Patient Master';
  if (has('contentname', 'content', 'brandname', 'brand', 'packing', 'pack')) return 'Product Master';
  if (file.includes('product')) return 'Product Master';
  return '';
}
