// Stars
const starContainer = document.getElementById('stars');
for (let i = 0; i < 45; i++) {
  const s = document.createElement('div');
  s.className = 'star ' + (Math.random() > 0.3 ? 'g' : 'p');
  const size = Math.random() * 3.5 + 1.5;
  s.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*100}%;top:${Math.random()*100}%;--dur:${2.5+Math.random()*4}s;--delay:${Math.random()*6}s`;
  starContainer.appendChild(s);
}

function toggleFaq() {
  document.getElementById('faqToggle').classList.toggle('open');
  document.getElementById('faqPanel').classList.toggle('open');
}

let workbookData = {};
let currentTab = 'all';

const STATUS_MAP = {
  'sent': 'badge-sent', 'no response': 'badge-noresp', 'rejected': 'badge-rejected',
  'phone screen': 'badge-phone', 'interview': 'badge-interview',
  'offer': 'badge-offer', 'withdrawn': 'badge-withdrawn',
};
const STATUS_ORDER = ['Offer','Interview','Phone Screen','Sent','No Response','Rejected','Withdrawn'];
const BOOL_COLS    = ['Cover Letter?', 'Tailored Resume?', 'Follow-Up Done?'];
const STATUS_COLS  = { all: ['Status'], detail: ['Status'], active: ['Stage'] };

function badgeClass(val) { return !val ? 'badge-default' : (STATUS_MAP[val.toLowerCase().trim()] || 'badge-default'); }
function statusBadge(val) { return !val ? '' : `<span class="badge ${badgeClass(val)}">${val}</span>`; }
function boolCell(val) {
  if (!val) return '';
  const v = String(val).toLowerCase();
  if (v === 'yes' || v === 'true') return `<span class="yes">✓ yes</span>`;
  if (v === 'no' || v === 'false' || v === 'n/a') return `<span class="no">${v}</span>`;
  return val;
}
function parseDate(val) { if (!val) return null; const d = new Date(val); return isNaN(d) ? null : d; }

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag'); handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', e => handleFile(e.target.files[0]));

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
    workbookData = {};
    wb.SheetNames.forEach(name => { workbookData[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' }); });
    document.getElementById('emptyPrompt').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    updateStats(); updateFunnel(); renderTable();
  };
  reader.readAsArrayBuffer(file);
}

function getSheetData(tab) {
  if (tab === 'all')    return workbookData['All Applications']     || workbookData[Object.keys(workbookData)[0]] || [];
  if (tab === 'detail') return workbookData['Detailed Applications'] || workbookData[Object.keys(workbookData)[1]] || [];
  return workbookData['Active Pipeline'] || workbookData[Object.keys(workbookData)[2]] || [];
}

function updateStats() {
  const all = getSheetData('all'), active = getSheetData('active');
  const statuses = all.map(r => (r['Status'] || '').toLowerCase());
  const total = all.length;
  const rejected = statuses.filter(s => s === 'rejected').length;
  const interviews = statuses.filter(s => ['phone screen','interview'].includes(s)).length;
  const offers = statuses.filter(s => s === 'offer').length;
  const rate = total > 0 ? Math.round((interviews + offers) / total * 100) : 0;
  document.getElementById('statsRow').innerHTML = [
    { val: total, lbl: 'total applied', accent: false },
    { val: interviews + offers, lbl: 'responses', accent: false },
    { val: rejected, lbl: 'rejections', accent: true },
    { val: active.length, lbl: 'active pipeline', accent: false },
    { val: rate + '%', lbl: 'response rate', accent: false },
  ].map(s => `<div class="stat"><div class="val${s.accent?' accent':''}">${s.val}</div><div class="lbl">${s.lbl}</div></div>`).join('');
}

function updateFunnel() {
  const all = getSheetData('all');
  const stages = ['Sent','No Response','Rejected','Phone Screen','Interview','Offer'];
  const counts = {}; stages.forEach(s => counts[s] = 0);
  all.forEach(r => { const s = (r['Status']||'').trim(); if (counts[s]!==undefined) counts[s]++; });
  const max = Math.max(...Object.values(counts), 1);
  const colors = { 'Sent':'#60a5fa','No Response':'#fbbf24','Rejected':'#f472b6','Phone Screen':'#4ade80','Interview':'#a78bfa','Offer':'#2dd4bf' };
  document.getElementById('funnelRows').innerHTML = stages.map(s => {
    const pct = Math.round(counts[s] / max * 100);
    return `<div class="funnel-row">
      <div class="funnel-label">${s}</div>
      <div class="funnel-bar-bg"><div class="funnel-bar loaded" style="width:${pct}%;background:${colors[s]||'#86efac'}"><span>${counts[s]||''}</span></div></div>
      <div class="funnel-count">${counts[s]}</div>
    </div>`;
  }).join('');
}

function switchTab(tab, el) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderTable();
}

function renderTable() {
  const data = getSheetData(currentTab);
  const search = document.getElementById('searchInput').value.toLowerCase();
  const statusF = document.getElementById('statusFilter').value.toLowerCase();

  let filtered = data.filter(row => {
    const c = String(row['Company']||'').toLowerCase(), r = String(row['Role']||'').toLowerCase();
    const s = String(row['Status']||row['Stage']||'').toLowerCase();
    return (!search || c.includes(search) || r.includes(search)) && (!statusF || s === statusF);
  });

  filtered.sort((a, b) => {
    const sa = String(a['Status']||a['Stage']||''), sb = String(b['Status']||b['Stage']||'');
    const oa = STATUS_ORDER.indexOf(sa) === -1 ? 99 : STATUS_ORDER.indexOf(sa);
    const ob = STATUS_ORDER.indexOf(sb) === -1 ? 99 : STATUS_ORDER.indexOf(sb);
    if (oa !== ob) return oa - ob;
    const da = parseDate(a['Date Applied']||a['Last Activity']);
    const db = parseDate(b['Date Applied']||b['Last Activity']);
    if (da && db) return db - da;
    return da ? -1 : db ? 1 : 0;
  });

  if (!data.length) {
    document.getElementById('tableHead').innerHTML = '';
    document.getElementById('tableBody').innerHTML = `<tr><td colspan="12"><div class="empty"><div class="big">nothing here yet</div><div>this sheet may be empty in your xlsx</div></div></td></tr>`;
    return;
  }

  const cols = Object.keys(data[0]);
  const statusCols = STATUS_COLS[currentTab] || [];

  document.getElementById('tableHead').innerHTML =
    `<tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr>` +
    `<tr><td colspan="${cols.length}" style="background:#1a2e1e;color:#5a8a65;font-size:9px;padding:4px 14px;letter-spacing:0.1em;text-transform:uppercase">sorted: active first · newest within each status ↓</td></tr>`;

  if (!filtered.length) {
    document.getElementById('tableBody').innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center;padding:32px;color:var(--muted)">no results</td></tr>`;
    return;
  }

  let lastStatus = null;
  const rows = [];
  filtered.forEach(row => {
    const status = String(row['Status']||row['Stage']||'(none)');
    if (status !== lastStatus) {
      const count = filtered.filter(r => String(r['Status']||r['Stage']||'(none)') === status).length;
      rows.push(`<tr class="group-divider"><td colspan="${cols.length}">${status} <span style="opacity:0.5;font-weight:400">(${count})</span></td></tr>`);
      lastStatus = status;
    }
    rows.push(`<tr>${cols.map(c => {
      const val = String(row[c]||'');
      if (statusCols.includes(c)) return `<td>${statusBadge(val)}</td>`;
      if (BOOL_COLS.includes(c)) return `<td>${boolCell(val)}</td>`;
      if (c.toLowerCase().includes('date') && val && !isNaN(Date.parse(val)))
        return `<td style="white-space:nowrap">${new Date(val).toLocaleDateString('en-CA')}</td>`;
      return `<td>${val}</td>`;
    }).join('')}</tr>`);
  });

  document.getElementById('tableBody').innerHTML = rows.join('');
}
