import { downloadXlsx, readXlsx } from './xlsx-lite.js';
import { detectCsvSheet, parseCsv } from './csv-lite.js';
import './style.css';

const PAGE_INFO = {
  dashboard: { title: 'Overview', gu: 'ઝાંખી', desc: 'Stock, alerts અને તાજેતરની activity એક જ જગ્યાએ જુઓ.', icon: 'grid' },
  products: { title: 'Product Master', gu: 'પ્રોડક્ટ માસ્ટર', desc: 'દવાઓ અને medical productsની master વિગતો સંચાલિત કરો.', icon: 'box' },
  stockIn: { title: 'Stock Entry', gu: 'સ્ટોક એન્ટ્રી', desc: 'નવો batch ઉમેરો અને expiry પ્રમાણે બાકી stock track કરો.', icon: 'up' },
  stockOut: { title: 'Stock Out', gu: 'સ્ટોક આઉટ', desc: 'Patientને stock issue કરો; યોગ્ય batch પસંદ કરો.', icon: 'down' },
  patients: { title: 'Patient Master', gu: 'પેશન્ટ માસ્ટર', desc: 'દર્દીઓની વિગતો સાચવો અને stock issue વખતે પસંદ કરો.', icon: 'users' },
  alerts: { title: 'Alerts', gu: 'ચેતવણીઓ', desc: 'Low-stock અને near-expiry batches પર નજર રાખો.', icon: 'bell' },
  users: { title: 'Users & Rights', gu: 'યુઝર અને પરવાનગીઓ', desc: 'Member બનાવો અને તેને કયા pages વાપરવા તે પસંદ કરો.', icon: 'shield' },
};
const PAGE_KEYS = ['dashboard', 'products', 'stockIn', 'stockOut', 'patients', 'alerts'];
const DATA_PAGES = ['products','stockIn','stockOut','patients'];
const SHEET_BY_PAGE = { products:'Product Master', stockIn:'Stock Entry', stockOut:'Stock Out', patients:'Patient Master' };
const LABELS = { dashboard:'Overview', products:'Product Master', stockIn:'Stock Entry', stockOut:'Stock Out', patients:'Patient Master', alerts:'Alerts' };
const state = { user: null, page: 'dashboard', data: {}, query: '', busy: false };
let toastTimer;

const iconPaths = {
  grid:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="4" rx="1.5"/><rect x="13.5" y="10.5" width="7" height="10" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/>',
  box:'<path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z"/><path d="m3.8 7.7 8.2 4.5 8.2-4.5M12 12.2V21"/>',
  pill:'<path d="M9.2 3.5a3.5 3.5 0 0 1 4.95 0l6.35 6.35a3.5 3.5 0 0 1 0 4.95l-2.12 2.12a3.5 3.5 0 0 1-4.95 0l-6.35-6.35a3.5 3.5 0 0 1 0-4.95L9.2 3.5Z"/><path d="m8.4 7.1 8.4 8.4"/>',
  users:'<path d="M16 20v-1.7a3.3 3.3 0 0 0-3.3-3.3H7.3A3.3 3.3 0 0 0 4 18.3V20m6-8a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9-1v6m-3-3h6"/>',
  bell:'<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
  up:'<path d="M12 16V3m0 0L7.5 7.5M12 3l4.5 4.5M4 14.5v4A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-4"/>',
  down:'<path d="M12 8v13m0 0-4.5-4.5M12 21l4.5-4.5M4 9.5v-4A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"/>',
  trash:'<path d="M3.5 6h17M9 6V4h6v2m3 0-.8 14H6.8L6 6m4 4v6m4-6v6"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  file:'<path d="M7 3.5h7l5 5v12H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"/><path d="M14 3.5v5h5M8.5 13h7M8.5 16.5h7"/>',
  download:'<path d="M12 3v13m0 0 4.5-4.5M12 16l-4.5-4.5M4 16v3.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V16"/>',
  shield:'<path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17"/>',
  warning:'<path d="M10.3 4.7 2.8 18a1.6 1.6 0 0 0 1.4 2.4h15.6a1.6 1.6 0 0 0 1.4-2.4L13.7 4.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3h.01"/>',
  activity:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  check:'<path d="m5 12.5 4.2 4.2L19 7"/>',
  logout:'<path d="M10 17l5-5-5-5m5 5H3m9-9h5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
};
function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.info}</svg>`; }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function qty(v) { return new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(Number(v)||0); }
function today() {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${v.year}-${v.month}-${v.day}`;
}
function dateText(v) {
  if (!v) return '—';
  const d = new Date(`${String(v).slice(0,10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? esc(v) : new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric'}).format(d);
}
function monthYearText(v) {
  if (!v) return '—';
  const match=String(v).slice(0,10).match(/^(\d{4})-(\d{2})/);
  return match?`${match[2]}/${match[1].slice(-2)}`:esc(v);
}
function monthYearToISO(value) {
  const match=String(value||'').trim().match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if(!match)throw new Error('Expiry Date MM/YY formatમાં લખો, જેમ કે 08/27.');
  const month=Number(match[1]),year=2000+Number(match[2]),lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
  return `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
}
function daysLeft(v) {
  if (!v) return null;
  const a = new Date(`${today()}T00:00:00Z`), b = new Date(`${String(v).slice(0,10)}T00:00:00Z`);
  return Number.isNaN(b.getTime()) ? null : Math.round((b-a)/86400000);
}
function canPage(page) { return state.user?.role === 'admin' || state.user?.pagePermissions?.includes(page); }
function showToast(text, error=false) {
  const root = document.getElementById('toast-root');
  root.innerHTML = `<div class="toast ${error?'error':''} show">${esc(text)}</div>`;
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>{ const t=root.querySelector('.toast'); if(t)t.classList.remove('show'); },3500);
}
async function api(path, options={}) {
  const init = { credentials:'same-origin', ...options, headers:{ ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers||{}) } };
  const response = await fetch(path, init);
  let data=null;
  try { data=await response.json(); } catch {}
  if (response.status===401 && state.user) { state.user=null; renderLogin('Session expire થઈ ગઈ છે. ફરી login કરો.'); throw new Error('Login session expire થઈ.'); }
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  if (!data || typeof data!=='object' || Array.isArray(data)) throw new Error('APIનો JSON જવાબ મળ્યો નથી. Local previewમાં login માટે Vercel API જરૂરી છે.');
  return data;
}
async function postAction(type,payload={}) { return api('/api/action',{method:'POST',body:JSON.stringify({type,payload})}); }

function renderLogin(message='') {
  document.getElementById('app').innerHTML = `
    <main class="login-page">
      <section class="login-showcase">
        <div class="login-brand"><span class="brand-mark">${icon('pill')}</span><span>MediStock</span></div>
        <div class="login-copy"><div class="kicker">MEDICAL INVENTORY</div><h1>તમારો stock,<br>સુરક્ષિત અને સરળ.</h1><p>Products, batch expiry, patient issue અને alerts એક જ જગ્યાએ સંભાળો. Sign in કર્યા પછી જ authorized staffને data દેખાશે.</p></div>
        <div class="login-foot">MediStock Online · Private workspace</div>
      </section>
      <section class="login-form-wrap"><div class="login-card"><h2>Welcome back</h2><p>તમારા MediStock accountથી sign in કરો.</p><div class="login-error ${message?'show':''}" id="loginError">${esc(message)}</div><form class="login-form" id="loginForm"><div class="field"><label>Username</label><input name="username" type="text" autocomplete="username" required placeholder="તમારું username" /></div><div class="field"><label>Password</label><input name="password" type="password" autocomplete="current-password" required placeholder="Password" /></div><button class="btn primary" type="submit">Sign in ${icon('logout')}</button></form><div class="login-links"><button type="button" data-action="forgot-password">Forgot password?</button></div><p style="margin:9px 0 0;font-size:9px">Admin login Vercelના ADMIN_USERNAME / ADMIN_PASSWORDથી થશે. ADMIN_USERNAME ન હોય તો username એ ADMIN_EMAILનું @ પહેલાંનું નામ છે.</p></div></section>
    </main>`;
  document.getElementById('loginForm')?.addEventListener('submit', async e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget), button=e.currentTarget.querySelector('button');
    button.disabled=true; button.textContent='Signing in…';
    try { const out=await api('/api/auth/login',{method:'POST',body:JSON.stringify({username:f.get('username'),password:f.get('password')})}); await enterApp(out.user); }
    catch(err) { const box=document.getElementById('loginError'); box.textContent=err.message; box.classList.add('show'); button.disabled=false; button.innerHTML=`Sign in ${icon('logout')}`; }
  });
}

function renderShell() {
  const user=state.user;
  const nav=PAGE_KEYS.filter(canPage).map(key=>`<button class="nav-link ${state.page===key?'active':''}" data-page="${key}">${icon(PAGE_INFO[key].icon)}<span class="nav-text">${esc(PAGE_INFO[key].title)}</span></button>`).join('');
  const usersNav=user?.role==='admin'?`<button class="nav-link ${state.page==='users'?'active':''}" data-page="users">${icon('shield')}<span class="nav-text">Users & Rights</span></button>`:'';
  const sheetActions=user?.role==='admin'&&DATA_PAGES.includes(state.page)?`<button class="btn" data-action="template" title="${esc(SHEET_BY_PAGE[state.page])} માટે template">${icon('file')}<span>Template</span></button><button class="btn" data-action="import" title="માત્ર આ tab import થશે">${icon('up')}<span>Import</span></button><button class="btn primary" data-action="export" title="માત્ર આ tab export થશે">${icon('download')}<span>Export Excel</span></button>`:'';
  document.getElementById('app').innerHTML=`<div class="app-shell"><aside class="sidebar" id="sidebar"><div class="brand"><span class="brand-mark">${icon('pill')}</span><div class="brand-copy"><div class="brand-name">MediStock</div><div class="brand-sub">Online inventory</div></div></div><div class="nav-caption">WORKSPACE</div><nav class="nav-list">${nav}${usersNav}</nav><div class="sidebar-spacer"></div><div class="sidebar-user"><span class="user-avatar">${esc((user?.name||'M').slice(0,1))}</span><div class="sidebar-user-copy"><b>${esc(user?.name)}</b><span>${user?.role==='admin'?'ADMIN':'MEMBER'} · ${esc(user?.email)}</span></div><button class="logout-btn" data-action="logout" title="Sign out">${icon('logout')}</button></div></aside><input id="excelInput" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" hidden><div class="main"><header class="topbar"><button class="btn mobile-menu" data-action="mobile-menu">☰</button><div class="crumb">MediStock&nbsp; › &nbsp;<b id="crumb"></b></div><div class="top-actions"><label class="search-box">${icon('search')}<input id="searchInput" type="search" placeholder="આ પેજમાં શોધો…" value="${esc(state.query)}"></label>${sheetActions}</div></header><main class="content"><div class="page-head"><div><div class="eyebrow" id="eyebrow"></div><h1 id="title"></h1><p class="page-desc" id="desc"></p></div><div class="page-actions" id="pageActions"></div></div><div class="page-body" id="pageBody"><div class="loading-screen">Data લોડ થઈ રહ્યો છે…</div></div></main></div></div>`;
  document.getElementById('searchInput')?.addEventListener('input',e=>{state.query=e.target.value;renderPage();});
  renderPageHeader();
}
function renderPageHeader() {
  const info=PAGE_INFO[state.page]||PAGE_INFO.dashboard;
  document.getElementById('crumb').textContent=info.title;
  document.getElementById('eyebrow').textContent=state.page==='users'?'ADMINISTRATION':state.page.toUpperCase();
  document.getElementById('title').textContent=info.title;
  document.getElementById('desc').textContent=info.desc;
  let buttons='';
  if(state.page==='products')buttons=`<button class="btn primary" data-action="add-product">${icon('plus')}<span>Add Product</span></button>`;
  if(state.page==='patients')buttons=`<button class="btn primary" data-action="add-patient">${icon('plus')}<span>Add Patient</span></button>`;
  if(state.page==='stockIn')buttons=`<button class="btn primary" data-action="add-stock-in">${icon('up')}<span>Add Stock IN</span></button>`;
  if(state.page==='stockOut')buttons=`<button class="btn primary" data-action="add-stock-out">${icon('down')}<span>Add Stock OUT</span></button>`;
  if(state.page==='users')buttons=`<button class="btn primary" data-action="add-member">${icon('plus')}<span>Create Member</span></button>`;
  if(state.page==='dashboard')buttons=`${canPage('products')?`<button class="btn" data-action="add-product">${icon('plus')}<span>Add Product</span></button>`:''}${canPage('stockIn')?`<button class="btn primary" data-action="add-stock-in">${icon('up')}<span>Stock IN</span></button>`:''}`;
  document.getElementById('pageActions').innerHTML=buttons;
}

async function enterApp(user) {
  state.user=user;
  const first=PAGE_KEYS.find(p=>canPage(p));
  state.page=canPage('dashboard')?'dashboard':(first||'dashboard');
  renderShell();
  if(!first){document.getElementById('pageBody').innerHTML=emptyMessage('હજુ કોઈ page permission નથી','Adminને Users & Rightsમાં તમારા account માટે pages પસંદ કરવા કહો.');return;}
  await loadPage(state.page);
}
async function loadPage(page) {
  if(page!=='users' && !canPage(page)) { showToast('આ page માટે Admin permission જરૂરી છે.',true); return; }
  if(page==='users' && state.user?.role!=='admin') { showToast('Users & Rights ફક્ત Admin માટે છે.',true); return; }
  state.page=page; state.query=''; renderShell();
  try {
    if(page==='users') state.data=await api('/api/users');
    else state.data=await api(`/api/data?page=${encodeURIComponent(page)}`);
    renderPage();
  } catch(err) {
    document.getElementById('pageBody').innerHTML=`<div class="notice">${icon('info')}<span>${esc(err.message)}<br><br>Vercel API, database schema અને environment variables ચકાસો.</span></div>`;
  }
}
function refreshCurrent() { return loadPage(state.page); }
function match(values) { const q=state.query.trim().toLowerCase(); return !q||values.filter(x=>x!=null).join(' ').toLowerCase().includes(q); }
function tableCard(title,rows,headers,hint='') {
  const body=rows.length?`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:`<div class="empty"><span class="empty-icon">${icon('box')}</span><h3>હજુ કોઈ record નથી</h3><p>ઉપરનું action button વાપરો અથવા Admin તરીકે Excel import કરો.</p></div>`;
  return `<section class="table-card"><div class="table-toolbar"><div class="table-title">${esc(title)} <span class="count">${rows.length}</span></div><span class="table-note">${esc(hint)}</span></div>${body}</section>`;
}
function emptyMessage(title,text,action='') { return `<div class="empty"><span class="empty-icon">${icon('info')}</span><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`; }
function renderPage() {
  const root=document.getElementById('pageBody'); if(!root)return;
  renderPageHeader();
  if(state.page==='dashboard')root.innerHTML=renderDashboard(state.data);
  else if(state.page==='products')root.innerHTML=renderProducts(state.data);
  else if(state.page==='patients')root.innerHTML=renderPatients(state.data);
  else if(state.page==='stockIn')root.innerHTML=renderStockIn(state.data);
  else if(state.page==='stockOut')root.innerHTML=renderStockOut(state.data);
  else if(state.page==='alerts')root.innerHTML=renderAlerts(state.data);
  else if(state.page==='users')root.innerHTML=renderUsers(state.data);
}
function renderDashboard(d={}) {
  const s=d.summary||{};
  const low=(d.lowStock||[]).filter(p=>match([p.contentName,p.brandName,p.packing,p.currentStock,p.demand])).slice(0,5);
  const exp=(d.expiring||[]).filter(x=>match([x.contentName,x.brandName,x.packing,x.expiryDate,x.currentStock])).slice(0,5);
  const recent=(d.recent||[]).filter(x=>match([x.contentName,x.brandName,x.kind,x.date]));
  return `<section class="hero"><div class="hero-copy"><div class="hero-kicker">MEDICAL STOCK OVERVIEW</div><h2>નમસ્તે, ${esc(state.user?.name||'')}!</h2><p>તમારી stock સ્થિતિ, expiry dates અને તાજેતરની activity જુઓ. દરેક entry online databaseમાં સાચવાય છે.</p><div class="hero-actions">${canPage('stockIn')?`<button class="btn primary" data-action="add-stock-in">${icon('up')} Stock ઉમેરો</button>`:''}${canPage('stockOut')?`<button class="btn" data-action="add-stock-out">${icon('down')} Patientને issue કરો</button>`:''}</div></div><div class="hero-mark">＋</div></section><section class="stats"><div class="stat"><div class="stat-label">કુલ products</div><div class="stat-value">${qty(s.productCount)}</div><div class="stat-note">Product Masterમાં</div></div><div class="stat"><div class="stat-label">Usable units</div><div class="stat-value">${qty(s.units)}</div><div class="stat-note">Expired batch ગણતરીમાં નથી</div></div><div class="stat"><div class="stat-label">Low stock</div><div class="stat-value">${qty(s.lowCount)}</div><div class="stat-note">Usable stock ≤ Demand</div></div><div class="stat"><div class="stat-label">Expiry alert</div><div class="stat-value">${qty(s.expiringCount)}</div><div class="stat-note">આગામી ${qty(s.expiryDays)} દિવસ</div></div></section><section class="dash-grid"><div class="panel"><div class="panel-head"><div><h3>Low-stock alert</h3><p>Demand જેટલો અથવા તેનાથી ઓછો usable stock</p></div>${canPage('alerts')?`<button class="btn small ghost" data-page="alerts">બધા જુઓ →</button>`:''}</div><div class="panel-body">${low.map(p=>`<div class="mini-row"><span class="mini-ico">${icon('pill')}</span><div class="mini-copy"><b>${esc(p.contentName)} · ${esc(p.brandName||'')}</b><span>${esc(p.packing||'')} · Demand ${qty(p.demand)}</span></div><span class="mini-value">${qty(p.currentStock)} left</span></div>`).join('')||emptyMessage('Low stock alert નથી','હાલમાં products Demand limitથી ઉપર છે.')}</div></div><div class="panel"><div class="panel-head"><div><h3>Expiry નજીક</h3><p>આગામી ${qty(s.expiryDays)} દિવસના batches</p></div>${canPage('alerts')?`<button class="btn small ghost" data-page="alerts">બધા જુઓ →</button>`:''}</div><div class="panel-body">${exp.map(x=>`<div class="mini-row"><span class="mini-ico amber">${icon('calendar')}</span><div class="mini-copy"><b>${esc(x.contentName)} · ${esc(x.brandName||'')}</b><span>${monthYearText(x.expiryDate)} · ${qty(x.currentStock)} units</span></div><span class="mini-value">${Number(x.daysLeft)<0?'Expired':`${qty(x.daysLeft)}d`}</span></div>`).join('')||emptyMessage('Expiry alert નથી','Alert windowમાં કોઈ batch નથી.')}</div></div></section><section class="panel"><div class="panel-head"><div><h3>Recent activity</h3><p>તાજેતરની Stock IN / Stock OUT</p></div></div><div class="activity">${recent.map(x=>`<div class="activity-row"><span class="activity-mark ${x.kind==='out'?'out':''}">${icon(x.kind==='out'?'down':'up')}</span><div class="activity-copy"><b>${esc(x.contentName)} ${x.kind==='out'?'issued':'stock added'}</b><span>${dateText(x.date)} · ${esc(x.brandName||'')}</span></div><span class="activity-qty">${x.kind==='out'?'−':'+'}${qty(x.qty)}</span></div>`).join('')||emptyMessage('હજુ activity નથી','Stock IN અથવા Stock OUT પછી અહીં દેખાશે.')}</div></section>`;
}
function renderProducts(d={}) {
  const rows=(d.products||[]).filter(p=>match([p.contentName,p.brandName,p.packing,p.uses,p.category,p.demand,p.currentStock])).map(p=>`<tr><td><span class="cell-main">${esc(p.contentName)}</span></td><td>${esc(p.brandName||'—')}</td><td>${esc(p.packing||'—')}</td><td><span class="num">${qty(p.currentStock)}</span></td><td>${qty(p.demand)}</td><td>${esc(p.uses||'—')}</td><td>${esc(p.category||'—')}</td><td><div class="row-actions"><button class="icon-btn" data-action="edit-product" data-id="${esc(p.id)}" title="Edit">${icon('edit')}</button>${state.user?.role==='admin'?`<button class="icon-btn delete" data-action="delete-product" data-id="${esc(p.id)}" title="Delete">${icon('trash')}</button>`:''}</div></td></tr>`);
  return `<div class="notice">${icon('info')}<span><b>Demand</b> low-stock threshold છે. Current Stock non-expired batchesમાંથી ગણાય છે.</span></div>${tableCard('Product Master',rows,['Content Name','Brand Name','Packing','Current Stock','Demand','Uses','usage category','Actions'],'Current stock auto-calculated')}`;
}
function renderPatients(d={}) {
  const rows=(d.patients||[]).filter(p=>match([p.name,p.patientId,p.phone,p.age,p.gender,p.notes])).map(p=>`<tr><td><span class="cell-main">${esc(p.name)}</span></td><td>${esc(p.patientId||'—')}</td><td>${esc(p.phone||'—')}</td><td>${esc(p.age??'—')}</td><td>${esc(p.gender||'—')}</td><td>${esc(p.notes||'—')}</td><td><div class="row-actions"><button class="icon-btn" data-action="edit-patient" data-id="${esc(p.id)}">${icon('edit')}</button>${state.user?.role==='admin'?`<button class="icon-btn delete" data-action="delete-patient" data-id="${esc(p.id)}">${icon('trash')}</button>`:''}</div></td></tr>`);
  return `<div class="notice">${icon('info')}<span>Patient Name જરૂરી છે. Patient ID અને phone optional છે. Patient details authorized users સુધી મર્યાદિત છે.</span></div>${tableCard('Patient Master',rows,['Patient Name','Patient ID','Phone','Age','Gender','Notes','Actions'])}`;
}
function renderStockIn(d={}) {
  const expiryWindow=Number(d.expiryDays??30);
  const rows=(d.stockEntries||[]).filter(e=>match([e.contentName,e.brandName,e.packing,e.expiryDate,e.entryDate,e.currentStock,e.qtyIn])).map(e=>{
    const days=daysLeft(e.expiryDate), badge=days!==null&&days<0?'<span class="status danger">Expired</span>':days!==null&&days<=expiryWindow?`<span class="status warn">${days===0?'Today':days+' days'}</span>`:`<span>${monthYearText(e.expiryDate)}</span>`;
    return `<tr><td><span class="cell-main">${esc(e.contentName)}</span></td><td>${esc(e.brandName||'—')}</td><td>${esc(e.packing||'—')}</td><td><span class="num">${qty(e.currentStock)}</span></td><td>${qty(e.qtyIn)}</td><td>${badge}</td><td>${esc(e.uses||'—')}</td><td>${esc(e.category||'—')}</td><td>${dateText(e.entryDate)}</td><td>${state.user?.role==='admin'?`<button class="icon-btn delete" data-action="delete-stock-in" data-id="${esc(e.id)}">${icon('trash')}</button>`:'—'}</td></tr>`;
  });
  return `<div class="notice">${icon('info')}<span>દરેક Stock IN એક expiry batch છે. Batch balanceમાંથી Stock OUT બાદ બાકી રહેલો stock બતાવે છે.</span></div>${tableCard('Stock Entry batches',rows,['Content Name','Brand Name','Packing','Current Stock','Stock IN','Expiry Date','Uses','usage category','Entry Date','Actions'])}`;
}
function renderStockOut(d={}) {
  const products=d.products||[], rows=(d.stockOuts||[]).filter(o=>match([o.contentName,o.brandName,o.patientName,o.patientCode,o.expiryDate,o.date,o.qty])).map(o=>{
    const current=(products.find(p=>p.id===o.productId)?.currentStock)||0;
    return `<tr><td><span class="cell-main">${esc(o.contentName)}</span></td><td>${esc(o.brandName||'—')}</td><td>${esc(o.packing||'—')}</td><td><span class="num">${qty(current)}</span></td><td>${qty(o.qty)}</td><td>${esc(o.patientName)}<div class="cell-sub">${esc(o.patientCode||'')}</div></td><td>${monthYearText(o.expiryDate)}</td><td>${esc(o.uses||'—')}</td><td>${esc(o.category||'—')}</td><td>${dateText(o.date)}</td><td>${state.user?.role==='admin'?`<button class="icon-btn delete" data-action="undo-stock-out" data-id="${esc(o.id)}">${icon('trash')}</button>`:'—'}</td></tr>`;
  });
  return `<div class="notice">${icon('info')}<span>માત્ર non-expired batchમાંથી Stock OUT થાય છે. FEFO પ્રમાણે વહેલી expiryવાળો batch પહેલાં સૂચવાય છે.</span></div>${tableCard('Stock Out history',rows,['Content Name','Brand Name','Packing','Current Stock','Stock OUT','Patient','Expiry Date','Uses','usage category','Date','Actions'])}`;
}
function renderAlerts(d={}) {
  const low=(d.lowStock||[]).filter(p=>match([p.contentName,p.brandName,p.packing,p.currentStock,p.demand]));
  const exp=(d.expiring||[]).filter(e=>match([e.contentName,e.brandName,e.expiryDate,e.currentStock,e.daysLeft]));
  return `<div class="notice">${icon('info')}<span>Low stockમાં expired batches ગણાતા નથી. Expiry alertsમાં expired stock પણ critical alert તરીકે દેખાશે.</span></div><div class="alert-grid"><section class="panel"><div class="panel-head"><div><h3>Low stock <span class="count">${low.length}</span></h3><p>Usable stock ≤ Demand</p></div></div>${low.map(p=>`<div class="alert-row"><span class="alert-symbol red">${icon('warning')}</span><div class="alert-copy"><b>${esc(p.contentName)} · ${esc(p.brandName||'')}</b><span>${esc(p.packing||'')} · ${esc(p.uses||'')}</span></div><div class="alert-right">${qty(p.currentStock)} / ${qty(p.demand)}<small>Usable / Demand</small></div></div>`).join('')||emptyMessage('Low-stock alert નથી','હાલમાં કોઈ product Demand limitથી નીચે નથી.')}</section><section class="panel"><div class="panel-head"><div><h3>Near expiry <span class="count">${exp.length}</span></h3><p>આગામી ${qty(d.expiryDays)} દિવસ</p></div></div>${exp.map(e=>`<div class="alert-row"><span class="alert-symbol ${Number(e.daysLeft)<0?'red':''}">${icon('calendar')}</span><div class="alert-copy"><b>${esc(e.contentName)} · ${esc(e.brandName||'')}</b><span>${esc(e.packing||'')} · ${qty(e.currentStock)} units · ${monthYearText(e.expiryDate)}</span></div><div class="alert-right">${Number(e.daysLeft)<0?'Expired':Number(e.daysLeft)===0?'Today':`${qty(e.daysLeft)} days`}<small>${Number(e.daysLeft)<0?'Do not dispense':'Expiry countdown'}</small></div></div>`).join('')||emptyMessage('Expiry alert નથી','Alert windowમાં કોઈ batch નથી.')}</section></div><section class="panel"><div class="panel-head"><div><h3>Expiry alert window</h3><p>Near-expiry કેટલા દિવસ પહેલાં બતાવવું</p></div></div><div style="padding:15px;display:flex;align-items:center;gap:9px"><input id="expiryDays" type="number" min="0" max="365" value="${esc(d.expiryDays??30)}" style="width:90px;padding:9px;border:1px solid #e1e8e1;border-radius:9px"><span style="color:#839087;font-size:10px">દિવસ</span>${state.user?.role==='admin'?`<button class="btn primary small" data-action="save-expiry-days">Save</button>`:'<span class="field-hint">આ value ફક્ત Admin બદલી શકે.</span>'}</div></section>`;
}
function renderUsers(d={}) {
  const users=d.users||[];
  const rows=users.map(u=>`<div class="user-row"><span class="user-avatar">${esc((u.name||'?').slice(0,1))}</span><div class="user-copy"><b>${esc(u.name)} <span class="role-badge member">Member</span> ${u.active?'<span class="status">Active</span>':'<span class="status danger">Inactive</span>'}</b><span>Username: ${esc(u.username)} · ${esc(u.email)}</span><div>${(u.pagePermissions||[]).map(k=>`<span class="permission-chip">${esc(LABELS[k]||k)}</span>`).join('')||'<span class="cell-sub">No page access assigned</span>'}</div></div><div class="row-actions"><button class="btn small" data-action="edit-member" data-id="${esc(u.id)}">Rights / Edit</button><button class="btn small ${u.active?'danger':''}" data-action="toggle-member" data-id="${esc(u.id)}" data-active="${u.active?'true':'false'}">${u.active?'Disable':'Enable'}</button></div></div>`).join('');
  return `<div class="notice">${icon('shield')}<span><b>Admin:</b> દરેક pageનો access. <b>Member:</b> નીચે પસંદ કરેલા pages જ જોઈ/વાપરી શકે. Permissions UI અને server API બંનેમાં ચકાસાય છે.</span></div><section class="panel"><div class="panel-head"><div><h3>Member accounts</h3><p>Admin Memberની page-wise access પસંદ કરે છે.</p></div><span class="count">${users.length}</span></div><div class="user-list">${rows||emptyMessage('હજુ Member બનાવ્યો નથી','Create Member દબાવી email, password અને page rights આપો.')}</div></section>`;
}

function field(label,name,value='',opts={}) {
  const type=opts.type||'text', req=opts.required?'required':'', min=opts.min!=null?`min="${esc(opts.min)}"`:'', step=opts.step?`step="${esc(opts.step)}"`:'';
  const placeholder=opts.placeholder||'', full=opts.full?'full':'';
  if(type==='textarea')return `<div class="field ${full}"><label>${esc(label)}${opts.required?'<span class="req">*</span>':''}</label><textarea name="${esc(name)}" placeholder="${esc(placeholder)}" ${req}>${esc(value)}</textarea></div>`;
  return `<div class="field ${full}"><label>${esc(label)}${opts.required?'<span class="req">*</span>':''}</label><input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${req} ${min} ${step} ${opts.attrs||''}></div>`;
}
function modal({title,subtitle,body,type,id='',wide=false,submit='Save',note=''}) {
  document.getElementById('modal-root').innerHTML=`<div class="modal-backdrop" data-action="backdrop-close"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true"><div class="modal-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle||'')}</p></div><button class="modal-close" data-action="close-modal">${icon('close')}</button></div><form id="entityForm" data-type="${esc(type)}" data-id="${esc(id)}"><div class="modal-body">${body}</div><div class="modal-foot"><span class="modal-foot-note">${esc(note)}</span><div class="modal-foot-actions"><button type="button" class="btn" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">${esc(submit)}</button></div></div></form></section></div>`;
  document.getElementById('entityForm')?.querySelector('input,select,textarea')?.focus();
}
function openProductForm(product=null) {
  modal({title:product?'Edit Product':'Add Product',subtitle:'Product Masterની વિગતો ભરો.',type:product?'product.update':'product.create',id:product?.id||'',note:'* જરૂરી field',body:`<div class="form-grid">${field('Content Name','contentName',product?.contentName||'',{required:true,placeholder:'ઉદા. Paracetamol'})}${field('Brand Name','brandName',product?.brandName||'',{placeholder:'ઉદા. Crocin'})}${field('Packing','packing',product?.packing||'',{placeholder:'10 tablets / 100 ml'})}${field('Demand','demand',product?.demand??'',{type:'number',min:0,step:'any',placeholder:'Low-stock limit'})}${field('Uses','uses',product?.uses||'',{placeholder:'Fever, pain relief'})}${field('usage category','category',product?.category||'',{placeholder:'Antibiotic / General'})}</div>`});
}
function openPatientForm(patient=null) {
  modal({title:patient?'Edit Patient':'Add Patient',subtitle:'Patient Masterમાં વિગતો સાચવો.',type:patient?'patient.update':'patient.create',id:patient?.id||'',note:'* જરૂરી field',body:`<div class="form-grid">${field('Patient Name','name',patient?.name||'',{required:true,placeholder:'દર્દીનું પૂરું નામ'})}${field('Patient ID','patientId',patient?.patientId||'',{placeholder:'PT-001'})}${field('Phone','phone',patient?.phone||'',{type:'tel',placeholder:'Mobile number'})}${field('Age','age',patient?.age??'',{type:'number',min:0})}<div class="field"><label>Gender</label><select name="gender"><option value="">પસંદ કરો</option>${['Female','Male','Other'].map(x=>`<option ${patient?.gender===x?'selected':''}>${x}</option>`).join('')}</select></div>${field('Notes','notes',patient?.notes||'',{full:true})}</div>`});
}
function cascadeKey(value){return value?`v:${encodeURIComponent(value)}`:'__empty__';}
function cascadeValue(value){if(value==='__empty__')return '';if(!String(value||'').startsWith('v:'))return '';try{return decodeURIComponent(String(value).slice(2));}catch{return '';}}
function distinctValues(values){const map=new Map();for(const value of values){const text=String(value??'').trim(),key=text.toLowerCase();if(!map.has(key))map.set(key,text);}return [...map.values()].sort((a,b)=>a.localeCompare(b));}
function bindProductCascade(products,{contentId,brandId,packingId,onSelect}){
  const content=document.getElementById(contentId),brand=document.getElementById(brandId),packing=document.getElementById(packingId);
  if(!content||!brand||!packing)return;
  const norm=value=>String(value??'').trim().toLowerCase();
  const setOptions=(select,values,label)=>{
    const unique=distinctValues(values);
    select.innerHTML=`<option value="">${esc(label)}</option>${unique.map(value=>`<option value="${esc(cascadeKey(value))}">${esc(value||'Not specified')}</option>`).join('')}`;
    select.disabled=!unique.length;
  };
  const resetPacking=()=>{setOptions(packing,[],'પહેલા brand પસંદ કરો');onSelect(null);};
  const updateBrands=()=>{
    const matches=products.filter(p=>norm(p.contentName)===norm(content.value));
    content.setCustomValidity(matches.length?'':'Database listમાંથી Content Name પસંદ કરો.');
    setOptions(brand,matches.map(p=>p.brandName),'Brand Name પસંદ કરો');
    resetPacking();
  };
  content.addEventListener('input',updateBrands);
  content.addEventListener('change',updateBrands);
  brand.addEventListener('change',()=>{
    const brandValue=cascadeValue(brand.value),matches=products.filter(p=>norm(p.contentName)===norm(content.value)&&norm(p.brandName)===norm(brandValue));
    setOptions(packing,matches.map(p=>p.packing),'Packing પસંદ કરો');
    onSelect(null);
  });
  packing.addEventListener('change',()=>{
    const brandValue=cascadeValue(brand.value),packingValue=cascadeValue(packing.value);
    const product=products.find(p=>norm(p.contentName)===norm(content.value)&&norm(p.brandName)===norm(brandValue)&&norm(p.packing)===norm(packingValue));
    onSelect(product||null);
  });
}
function patientChoice(p){return `${p.name}${p.patientId?` · ${p.patientId}`:p.phone?` · ${p.phone}`:` · ${String(p.id).slice(0,6)}`}`;}
function openStockInForm() {
  const products=state.data.products||[];
  if(!products.length){showToast('પહેલા Product Masterમાં Content Name ઉમેરો.',true);return;}
  const contents=distinctValues(products.map(p=>p.contentName));
  modal({title:'Add Stock IN',subtitle:'Content Name → Brand Name → Packing પસંદ કરો.',type:'stockIn.create',note:'Expiry MM/YYમાં લખો; Entry Date પસંદ કરો.',body:`<div class="form-grid"><div class="field full"><label>Content Name <span class="req">*</span></label><input name="contentName" id="stockInContent" list="stockInContentList" autocomplete="off" required placeholder="Content Name લખવાનું શરૂ કરો"><datalist id="stockInContentList">${contents.map(value=>`<option value="${esc(value)}"></option>`).join('')}</datalist><span class="field-hint">Databaseમાં રહેલા Content Nameમાંથી પસંદ કરો.</span></div><div class="field"><label>Brand Name <span class="req">*</span></label><select name="brandChoice" id="stockInBrand" required disabled><option value="">પહેલા Content Name પસંદ કરો</option></select></div><div class="field"><label>Packing <span class="req">*</span></label><select name="packingChoice" id="stockInPacking" required disabled><option value="">પહેલા Brand Name પસંદ કરો</option></select></div><input type="hidden" name="productId" id="stockInProductId">${field('Stock IN','qtyIn','',{type:'number',required:true,min:'0.01',step:'any',placeholder:'જથ્થો'})}${field('Entry Date','entryDate',today(),{type:'date',required:true})}${field('Expiry Date (MM/YY)','expiryMonth','',{required:true,placeholder:'MM/YY',attrs:'inputmode="text" maxlength="5" pattern="(0[1-9]|1[0-2])/[0-9]{2}"'})}</div>`});
  bindProductCascade(products,{contentId:'stockInContent',brandId:'stockInBrand',packingId:'stockInPacking',onSelect:product=>{document.getElementById('stockInProductId').value=product?.id||'';}});
}
function openStockOutForm() {
  const d=state.data, patients=d.patients||[], lots=(d.stockEntries||[]).filter(e=>Number(e.currentStock)>0&&String(e.expiryDate)>=today());
  const stockedProducts=(d.products||[]).filter(p=>lots.some(l=>l.productId===p.id));
  if(!patients.length||!lots.length||!stockedProducts.length){showToast(!patients.length?'Stock OUT પહેલાં Patient Masterમાં patient ઉમેરો.':'Issue માટે non-expired stock batch ઉપલબ્ધ નથી.',true);return;}
  const contents=distinctValues(stockedProducts.map(p=>p.contentName));
  const patientOptions=patients.map(p=>`<option value="${esc(patientChoice(p))}"></option>`).join('');
  modal({title:'Add Stock OUT',subtitle:'Content Name → Brand Name → Packing → Expiry batch પસંદ કરો.',type:'stockOut.create',note:'Non-expired batches જ દેખાશે; વહેલી expiry પહેલાં સૂચવાશે.',body:`<div class="form-grid"><div class="field full"><label>Content Name <span class="req">*</span></label><input name="contentName" id="outContent" list="outContentList" autocomplete="off" required placeholder="Content Name લખવાનું શરૂ કરો"><datalist id="outContentList">${contents.map(value=>`<option value="${esc(value)}"></option>`).join('')}</datalist><span class="field-hint">Databaseમાં રહેલા Content Nameમાંથી પસંદ કરો.</span></div><div class="field"><label>Brand Name <span class="req">*</span></label><select name="brandChoice" id="outBrand" required disabled><option value="">પહેલા Content Name પસંદ કરો</option></select></div><div class="field"><label>Packing <span class="req">*</span></label><select name="packingChoice" id="outPacking" required disabled><option value="">પહેલા Brand Name પસંદ કરો</option></select></div><input type="hidden" name="productId" id="outProductId"><div class="field full"><label>Expiry Date / Available Stock <span class="req">*</span></label><select name="lotId" id="outLot" required disabled><option value="">Product પસંદ કર્યા પછી batch દેખાશે</option></select><span class="field-hint" id="outLotHint">આ product/packing માટે available batch પસંદ કરો.</span></div>${field('Stock OUT','qtyOut','',{type:'number',required:true,min:'0.01',step:'any',placeholder:'જથ્થો'})}<div class="field"><label>Patient Name <span class="req">*</span></label><input name="patientSearch" id="outPatientSearch" list="outPatientList" autocomplete="off" required placeholder="Patientનું નામ લખો"><datalist id="outPatientList">${patientOptions}</datalist><input type="hidden" name="patientId" id="outPatientId"><span class="field-hint">Databaseની listમાંથી દર્દી પસંદ કરો.</span></div>${field('Issue Date','issueDate',today(),{type:'date',required:true})}</div>`});
  bindProductCascade(stockedProducts,{contentId:'outContent',brandId:'outBrand',packingId:'outPacking',onSelect:product=>{
    document.getElementById('outProductId').value=product?.id||'';
    const lotSelect=document.getElementById('outLot'),hint=document.getElementById('outLotHint');
    const available=product?lots.filter(l=>l.productId===product.id).sort((a,b)=>String(a.expiryDate).localeCompare(String(b.expiryDate))):[];
    lotSelect.innerHTML=`<option value="">Expiry batch પસંદ કરો</option>${available.map(l=>`<option value="${esc(l.id)}">${monthYearText(l.expiryDate)} · ${qty(l.currentStock)} available</option>`).join('')}`;
    lotSelect.disabled=!available.length;
    if(hint)hint.textContent=available.length?'Expiry batch પસંદ કરો; available quantity dropdownમાં દેખાશે.':'આ selection માટે usable stock નથી.';
    const qtyInput=document.querySelector('#entityForm [name="qtyOut"]');if(qtyInput){qtyInput.value='';qtyInput.removeAttribute('max');}
  }});
  document.getElementById('outLot')?.addEventListener('change',()=>{
    const lot=lots.find(item=>item.id===document.getElementById('outLot').value),hint=document.getElementById('outLotHint'),qtyInput=document.querySelector('#entityForm [name="qtyOut"]');
    if(hint)hint.textContent=lot?`${monthYearText(lot.expiryDate)} batchમાં ${qty(lot.currentStock)} units ઉપલબ્ધ છે.`:'Expiry batch પસંદ કરો.';
    if(qtyInput){if(lot)qtyInput.max=lot.currentStock;else qtyInput.removeAttribute('max');}
  });
  const patientInput=document.getElementById('outPatientSearch');
  patientInput?.addEventListener('input',()=>{
    const patient=patients.find(p=>patientChoice(p)===patientInput.value);
    document.getElementById('outPatientId').value=patient?.id||'';
    patientInput.setCustomValidity(patient?'':'Databaseની patient listમાંથી નામ પસંદ કરો.');
  });
  patientInput?.addEventListener('change',()=>patientInput.dispatchEvent(new Event('input')));
}
function openMemberForm(member=null) {
  const checked=new Set(member?.pagePermissions||[]);
  const permissions=PAGE_KEYS.map(key=>`<label class="check-option"><input type="checkbox" name="pagePermissions" value="${key}" ${checked.has(key)?'checked':''}><span>${esc(LABELS[key])}</span></label>`).join('');
  modal({title:member?'Edit Member rights':'Create Member',subtitle:'Memberનું નામ, username અને page access પસંદ કરો.',type:member?'member.update':'member.create',id:member?.id||'',wide:true,submit:member?'Save permissions':'Create Member',note:'Username login માટે વપરાશે. Password ઓછામાં ઓછો 10 charactersનો રાખો.',body:`<div class="form-grid">${field('Member Name','name',member?.name||'',{required:true,placeholder:'Staffનું નામ'})}${field('Username','username',member?.username||'',{required:true,placeholder:'e.g. staff01'})}${field('Profile email (login માટે નહીં)','email',member?.email||'',{type:'email',required:true,placeholder:'staff@example.com'})}${field(member?'નવો Password (optional)':'Password','password','',{type:'password',required:!member,placeholder:member?'ખાલી રાખો તો password બદલાશે નહીં':'At least 10 characters',full:true})}<div class="field full"><label>Page Rights</label><div class="checkbox-grid">${permissions}</div></div></div>`});
}
function confirmDelete(title,text,fn) { if(confirm(`${title}\n\n${text}`)) fn(); }

async function submitForm(e) {
  const form=e.target.closest('#entityForm'); if(!form)return;
  e.preventDefault(); if(!form.reportValidity())return;
  const type=form.dataset.type,id=form.dataset.id,fd=new FormData(form);
  const payload=Object.fromEntries([...fd.entries()].filter(([k])=>k!=='pagePermissions'));
  if(type.startsWith('member.'))payload.pagePermissions=fd.getAll('pagePermissions');
  if(id)payload.id=id;
  try {
    if(type==='stockIn.create'){
      if(!payload.productId)throw new Error('Database listમાંથી Content Name, Brand Name અને Packing પસંદ કરો.');
      payload.expiryDate=monthYearToISO(payload.expiryMonth);
      delete payload.expiryMonth;delete payload.brandChoice;delete payload.packingChoice;delete payload.contentName;
    }
    if(type==='stockOut.create'){
      if(!payload.productId)throw new Error('Content Name, Brand Name અને Packing પસંદ કરો.');
      if(!payload.patientId)throw new Error('Databaseની listમાંથી Patient Name પસંદ કરો.');
      delete payload.patientSearch;delete payload.contentName;delete payload.brandChoice;delete payload.packingChoice;delete payload.productId;
    }
    if(type.startsWith('member.')) {
      if(type==='member.create')await api('/api/users',{method:'POST',body:JSON.stringify(payload)});
      else await api('/api/users',{method:'PATCH',body:JSON.stringify(payload)});
    } else await postAction(type,payload);
    closeModal(); await refreshCurrent(); showToast(type.endsWith('create')?'Record ઉમેરાયો.':'ફેરફાર save થયો.');
  } catch(err){showToast(err.message,true);}
}
function closeModal(){document.getElementById('modal-root').innerHTML='';}
function openForgotPasswordHelp(){
  document.getElementById('modal-root').innerHTML=`<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><h2>Forgot password?</h2><p>Username ઓળખ માટે છે; તે એકલું password બદલવાની મંજૂરી આપતું નથી.</p></div><button class="modal-close" data-action="close-modal">${icon('close')}</button></div><div class="modal-body"><p style="font-size:12px;line-height:1.7;color:#53645a"><b>Member:</b> તમારું username Adminને આપો. Admin Users & Rightsમાં account edit કરીને નવો password સેટ કરી આપશે.<br><br><b>Admin:</b> Vercel Project → Settings → Environment Variablesમાં <code>ADMIN_PASSWORD</code> બદલો અને નવી deployment redeploy કરો. Login username <code>ADMIN_USERNAME</code> હશે; તે સેટ ન હોય તો <code>ADMIN_EMAIL</code>ના @ પહેલાંનો ભાગ વાપરો.</p></div><div class="modal-foot"><span class="modal-foot-note">Email login ઉપલબ્ધ નથી.</span><div class="modal-foot-actions"><button type="button" class="btn primary" data-action="close-modal">સમજાયું</button></div></div></section></div>`;
}

function loadExport(section=state.page) {
  if(!DATA_PAGES.includes(section))throw new Error('Export માટે પહેલા Products, Stock IN, Stock OUT અથવા Patients tab પસંદ કરો.');
  const d=state.data||{},products=d.products||[],sheetName=SHEET_BY_PAGE[section];
  let rows=[];
  if(section==='products')rows=[['Content Name','Brand Name','Packing','Uses','Demand','usage category'],...products.map(p=>[p.contentName,p.brandName,p.packing,p.uses,Number(p.demand)||0,p.category])];
  if(section==='stockIn')rows=[['Content Name','Brand Name','Packing','Current Stock','Stock IN','Expiry Date','Entry Date','Uses','Demand','usage category'],...(d.stockEntries||[]).map(e=>[e.contentName,e.brandName,e.packing,Number(e.currentStock),Number(e.qtyIn),monthYearText(e.expiryDate),e.entryDate,e.uses,Number(e.demand)||0,e.category])];
  if(section==='stockOut'){
    const currentByProduct=new Map(products.map(p=>[p.id,Number(p.currentStock)||0]));
    rows=[['Content Name','Brand Name','Packing','Current Stock','Stock OUT','Patient','Expiry Date','Uses','Demand','usage category','Date'],...(d.stockOuts||[]).map(o=>[o.contentName,o.brandName,o.packing,currentByProduct.get(o.productId)||0,Number(o.qty),o.patientName,monthYearText(o.expiryDate),o.uses,Number(o.demand)||0,o.category,o.date])];
  }
  if(section==='patients')rows=[['Patient Name','Patient ID','Phone','Age','Gender','Notes'],...(d.patients||[]).map(p=>[p.name,p.patientId,p.phone,p.age,p.gender,p.notes])];
  downloadXlsx([{name:sheetName,rows}],`MediStock-${section}-${today()}.xlsx`);
}
function downloadTemplate(section=state.page){
  if(!DATA_PAGES.includes(section))throw new Error('Template માટે પહેલા Products, Stock IN, Stock OUT અથવા Patients tab પસંદ કરો.');
  const templates={
    products:[['Content Name','Brand Name','Packing','Uses','Demand','usage category']],
    stockIn:[['Content Name','Brand Name','Packing','Stock IN','Expiry Date (MM/YY)','Entry Date','Uses','Demand','usage category']],
    stockOut:[['Content Name','Brand Name','Packing','Stock OUT','Patient','Expiry Date (MM/YY)','Date','Uses','Demand','usage category']],
    patients:[['Patient Name','Patient ID','Phone','Age','Gender','Notes']],
  };
  downloadXlsx([{name:SHEET_BY_PAGE[section],rows:templates[section]}],`MediStock-${section}-Template.xlsx`);
}
function normalizeHeader(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function sectionFromSheetName(name){
  const key=normalizeHeader(name);
  if(key.includes('product'))return 'products';
  if(key.includes('patient'))return 'patients';
  if(key.includes('stockout'))return 'stockOut';
  if(key.includes('stockentry')||key==='stockin')return 'stockIn';
  return '';
}
function rowsToObjects(rows){
  if(!rows?.length)return[];const headerIndex=rows.findIndex(r=>r.some(v=>String(v||'').trim()));if(headerIndex<0)return[];
  const headers=rows[headerIndex].map(normalizeHeader);
  return rows.slice(headerIndex+1).filter(r=>r.some(v=>String(v||'').trim()!=='')).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??'']).filter(([h])=>h)));
}
function get(o,...names){for(const n of names){const v=o[normalizeHeader(n)];if(v!==undefined&&String(v).trim()!=='')return v;}return '';}
function parseDate(v){
  if(!v)return '';
  if(v instanceof Date&&!Number.isNaN(v.getTime()))return v.toISOString().slice(0,10);
  if(typeof v==='number'||/^\d{4,6}(\.\d+)?$/.test(String(v).trim())){const serial=Number(v);if(serial>10000&&serial<100000){const d=new Date(Date.UTC(1899,11,30)+serial*86400000);return d.toISOString().slice(0,10);}}
  const s=String(v).trim();
  let m=s.match(/^(0?[1-9]|1[0-2])[-/.](\d{2}|\d{4})$/);
  if(m){const month=Number(m[1]),year=m[2].length===2?2000+Number(m[2]):Number(m[2]),day=new Date(Date.UTC(year,month,0)).getUTCDate();return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
  m=s.match(/^(\d{4})[-/.](0?[1-9]|1[0-2])$/);
  if(m){const year=Number(m[1]),month=Number(m[2]),day=new Date(Date.UTC(year,month,0)).getUTCDate();return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
  m=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  m=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);if(m){let y=Number(m[3]);if(y<100)y+=2000;return `${y}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;}
  const d=new Date(s);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);
}
function productFromRow(o){const contentName=String(get(o,'Content Name','content')).trim();if(!contentName)return null;return{contentName,brandName:String(get(o,'Brand Name','brand')).trim(),packing:String(get(o,'Packing','pack')).trim(),uses:String(get(o,'Uses','use')).trim(),demand:get(o,'Demand')===''?0:Number(String(get(o,'Demand')).replace(/,/g,''))||0,category:String(get(o,'usage category','category')).trim()};}
async function parseAndImport(file){
  const filename=file.name||'import',section=state.page;
  if(!DATA_PAGES.includes(section))throw new Error('Import પહેલાં Products, Stock IN, Stock OUT અથવા Patients tab પસંદ કરો.');
  let sheet;
  if(filename.toLowerCase().endsWith('.xlsx')){
    const workbook=await readXlsx(await file.arrayBuffer());
    sheet=workbook.find(item=>sectionFromSheetName(item.name)===section);
    if(!sheet)throw new Error(`આ workbookમાં ${SHEET_BY_PAGE[section]} tab નથી.`);
  } else if(filename.toLowerCase().endsWith('.csv')){
    const rows=parseCsv(await file.text()),detected=detectCsvSheet(rows,filename),detectedSection=sectionFromSheetName(detected);
    if(!detectedSection)throw new Error('CSVનો પ્રકાર ઓળખાયો નથી. Header row અને Content Name/Patient Name જેવા column તપાસો.');
    if(detectedSection!==section)throw new Error(`તમે ${SHEET_BY_PAGE[section]} tab પસંદ કર્યું છે, પરંતુ આ CSV ${SHEET_BY_PAGE[detectedSection]} માટે છે.`);
    sheet={name:SHEET_BY_PAGE[section],rows};
  } else throw new Error('માત્ર Excel .xlsx અથવા CSV .csv files supported છે.');
  const out={products:[],patients:[],stockEntries:[],stockOuts:[]},objects=rowsToObjects(sheet.rows);
  if(section==='products'){
    for(const o of objects){const p=productFromRow(o);if(p)out.products.push(p);}
  } else if(section==='patients'){
    for(const o of objects){const n=String(get(o,'Patient Name','Name','Patient')).trim();if(n)out.patients.push({name:n,patientId:String(get(o,'Patient ID','ID')).trim(),phone:String(get(o,'Phone','Mobile')).trim(),age:get(o,'Age')===''?null:Number(get(o,'Age'))||null,gender:String(get(o,'Gender')).trim(),notes:String(get(o,'Notes','Address')).trim()});}
  } else if(section==='stockIn'){
    for(const o of objects){const p=productFromRow(o),amount=Number(String(get(o,'Stock IN','Quantity','Qty')).replace(/,/g,''))||Number(String(get(o,'Current Stock')).replace(/,/g,''))||0;if(p&&amount>0)out.stockEntries.push({product:p,qtyIn:amount,expiryDate:parseDate(get(o,'Expiry Date (MM/YY)','Expiry Date','Expiry')),entryDate:parseDate(get(o,'Entry Date','Date'))||today(),batchNo:''});if(p)out.products.push(p);}
  } else if(section==='stockOut'){
    for(const o of objects){const p=productFromRow(o),amount=Number(String(get(o,'Stock OUT','Quantity','Qty')).replace(/,/g,''))||0,patientName=String(get(o,'Patient','Patient Name')).trim();if(p&&amount>0){out.stockOuts.push({product:p,qtyOut:amount,expiryDate:parseDate(get(o,'Expiry Date (MM/YY)','Expiry Date','Expiry')),issueDate:parseDate(get(o,'Date','Issue Date'))||today(),patientName});out.products.push(p);}}
  }
  const productMap=new Map();out.products.forEach(p=>productMap.set([p.contentName,p.brandName,p.packing].map(x=>x.toLowerCase()).join('|'),p));out.products=[...productMap.values()];
  const selectedCount={products:out.products.length,stockIn:out.stockEntries.length,stockOut:out.stockOuts.length,patients:out.patients.length}[section];
  if(!selectedCount)throw new Error(`${SHEET_BY_PAGE[section]} tabમાં import કરવા records મળ્યા નથી.`);
  out.stockOuts=out.stockOuts.map(o=>{const found=out.patients.find(p=>p.name.toLowerCase()===o.patientName.toLowerCase());return{...o,patientRecord:found||{name:o.patientName,patientId:'',phone:''}};});
  const summary=`Selected tab: ${SHEET_BY_PAGE[section]} · Records: ${selectedCount}`;
  if(!confirm(`${filename}\n\n${summary}\n\nફક્ત આ tabનો data import થશે. Existing data સાથે merge થશે; એ જ transaction ફરી import કરવાથી duplicate થઈ શકે. આગળ વધવું છે?`))return;
  const result=await api('/api/import',{method:'POST',body:JSON.stringify(out)});
  await refreshCurrent();
  const c=result.counts||{},saved={products:c.products||0,stockIn:c.stockEntries||0,stockOut:c.stockOuts||0,patients:c.patients||0}[section];
  showToast(`${SHEET_BY_PAGE[section]} import પૂરું: ${saved} records. Duplicate skipped: ${c.duplicatesSkipped||0}.`);
}

async function clickAction(el, event){
  const action=el.dataset.action,id=el.dataset.id;
  if(action==='mobile-menu'){document.getElementById('sidebar')?.classList.toggle('open');return;}
  if(action==='logout'){try{await api('/api/auth/logout',{method:'POST',body:'{}'});}catch{}state.user=null;renderLogin();return;}
  if(action==='close-modal'){closeModal();return;}
  if(action==='forgot-password'){openForgotPasswordHelp();return;}
  if(action==='backdrop-close'&&event.target===el){closeModal();return;}
  if(action==='add-product'){openProductForm();return;}
  if(action==='edit-product'){openProductForm((state.data.products||[]).find(x=>x.id===id));return;}
  if(action==='add-patient'){openPatientForm();return;}
  if(action==='edit-patient'){openPatientForm((state.data.patients||[]).find(x=>x.id===id));return;}
  if(action==='add-stock-in'){if(state.page!=='stockIn'){await loadPage('stockIn');}openStockInForm();return;}
  if(action==='add-stock-out'){if(state.page!=='stockOut'){await loadPage('stockOut');}openStockOutForm();return;}
  if(action==='add-member'){openMemberForm();return;}
  if(action==='edit-member'){openMemberForm((state.data.users||[]).find(x=>x.id===id));return;}
  if(action==='delete-product'){confirmDelete('Delete Product?', 'જો productનો stock history હોય તો delete અટકશે.',()=>runAction('product.delete',{id}));return;}
  if(action==='delete-patient'){confirmDelete('Delete Patient?', 'જો patientની Stock OUT history હોય તો delete અટકશે.',()=>runAction('patient.delete',{id}));return;}
  if(action==='delete-stock-in'){confirmDelete('Delete Stock IN batch?', 'આ batchમાં issued stock હોય તો delete નહીં થાય.',()=>runAction('stockIn.delete',{id}));return;}
  if(action==='undo-stock-out'){confirmDelete('Undo Stock OUT?', 'આ quantity ફરી batchમાં ઉમેરાશે.',()=>runAction('stockOut.delete',{id}));return;}
  if(action==='toggle-member'){
    const user=(state.data.users||[]).find(x=>x.id===id);if(!user)return;
    try{await api('/api/users',{method:'PATCH',body:JSON.stringify({id,active:!user.active})});await refreshCurrent();showToast(user.active?'Member disabled થયો.':'Member ફરી active થયો.');}catch(err){showToast(err.message,true);}return;
  }
  if(action==='save-expiry-days'){
    const days=Number(document.getElementById('expiryDays').value);try{await postAction('settings.expiryDays',{days});await refreshCurrent();showToast('Expiry window update થયું.');}catch(err){showToast(err.message,true);}return;
  }
  if(action==='template'){downloadTemplate();return;}
  if(action==='export'){try{await loadExport();showToast(`${SHEET_BY_PAGE[state.page]} tabનું Excel export download થયું.`);}catch(err){showToast(err.message,true);}return;}
  if(action==='import'){document.getElementById('excelInput')?.click();return;}
}
async function runAction(type,payload){try{await postAction(type,payload);await refreshCurrent();showToast('ફેરફાર save થયો.');}catch(err){showToast(err.message,true);}}

document.addEventListener('click',async e=>{
  const page=e.target.closest('[data-page]');if(page){await loadPage(page.dataset.page);return;}
  const el=e.target.closest('[data-action]');if(el){await clickAction(el,e);return;}
});
document.addEventListener('submit',submitForm);
document.addEventListener('change',e=>{
  if(e.target.id==='excelInput'){
    const file=e.target.files?.[0];e.target.value='';if(file)parseAndImport(file).catch(err=>showToast(err.message,true));
  }
});

async function init(){
  try{const data=await api('/api/auth/me');await enterApp(data.user);}
  catch(error){
    if(error.message==='Login session expire થઈ.')return;
    if(error.message==='Login જરૂરી છે.'||error.message==='Session invalid છે. ફરી login કરો.'||error.message==='Session expire થઈ ગઈ છે. ફરી login કરો.')renderLogin();
    else renderLogin(`API/database setupમાં error: ${error.message}`);
  }
}
init();
