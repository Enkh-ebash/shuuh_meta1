const API = ''; // same-origin; set to e.g. 'https://api.example.mn' if frontend is hosted separately
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const views = ['gate', 'dash', 'intro', 'feedback', 'longqueue', 'news', 'calendar', 'admin'];

let userToken = localStorage.getItem('khovd457_token') || null;
let currentUser = JSON.parse(localStorage.getItem('khovd457_user') || 'null');
let adminToken = null;

function showView(name) {
  views.forEach((v) => $('#' + v + 'View').classList.toggle('hidden', v !== name));
  window.scrollTo(0, 0);
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function fmtPhone(p) {
  return p.replace(/\D/g, '').slice(0, 8);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function api(path, { method = 'GET', body, admin = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = admin ? adminToken : userToken;
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) throw new Error(data.error || 'Алдаа гарлаа');
  return data;
}

// ---------- boot ----------
if (userToken && currentUser) {
  enterDashboard();
} else {
  showView('gate');
}

function enterDashboard() {
  $('#userChip').textContent = currentUser.ovog + ' ' + currentUser.ner + ' · ' + currentUser.register;
  $('#userChip').classList.remove('hidden');
  $('#adminBtn').classList.remove('hidden');
  $('#logoutBtn').classList.remove('hidden');
  $('#dashName').textContent = currentUser.ner;
  showView('dash');
  loadAboutInfo();
}


// ---------- registration / login ----------
$('#regSubmit').addEventListener('click', async () => {
  const ovog = $('#regOvog').value.trim();
  const ner = $('#regNer').value.trim();
  const register = $('#regRegister').value.trim().toUpperCase();
  const phone = fmtPhone($('#regPhone').value.trim());
  const err = $('#regErr');
  err.style.display = 'none';

  if (!ovog || !ner || !register || phone.length < 8) {
    err.textContent = 'Бүх талбарыг зөв бөглөнө үү (утас 8 оронтой).';
    err.style.display = 'block';
    return;
  }

  try {
    const data = await api('/api/auth/register-or-login', { method: 'POST', body: { ovog, ner, register, phone } });
    userToken = data.token;
    currentUser = data.user;
    localStorage.setItem('khovd457_token', userToken);
    localStorage.setItem('khovd457_user', JSON.stringify(currentUser));
    enterDashboard();
  } catch (e) {
    err.textContent = e.message;
    err.style.display = 'block';
  }
});

$('#logoutBtn').addEventListener('click', () => {
  userToken = null;
  currentUser = null;
  localStorage.removeItem('khovd457_token');
  localStorage.removeItem('khovd457_user');
  $('#userChip').classList.add('hidden');
  $('#adminBtn').classList.add('hidden');
  $('#logoutBtn').classList.add('hidden');
  showView('gate');
});

$('#adminBtn').addEventListener('click', () => showView('admin'));

$$('.tile').forEach((t) => {
  const activate = () => {
    const go = t.dataset.go;
    showView(go);
    if (go === 'news') loadNews();
    if (go === 'calendar') renderCalendar();
    if (go === 'feedback') loadMyFeedback();
  };
  t.addEventListener('click', activate);
  t.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
  });
});

$$('[data-back]').forEach((b) => b.addEventListener('click', () => showView('dash')));

// ---------- feedback ----------
$('#fbSubmit').addEventListener('click', async () => {
  const title = $('#fbTitle').value.trim();
  const body = $('#fbBody').value.trim();
  const err = $('#fbErr');
  err.style.display = 'none';
  if (!title || !body) {
    err.textContent = 'Гарчиг болон агуулгыг бөглөнө үү.';
    err.style.display = 'block';
    return;
  }
  try {
    await api('/api/feedback', { method: 'POST', body: { title, body } });
    $('#fbTitle').value = '';
    $('#fbBody').value = '';
    loadMyFeedback();
  } catch (e) {
    err.textContent = e.message;
    err.style.display = 'block';
  }
});

async function loadMyFeedback() {
  const el = $('#myFeedbackList');
  el.innerHTML = '<div class="empty">Ачааллаж байна...</div>';
  try {
    const { items } = await api('/api/feedback/mine');
    el.innerHTML = items.length
      ? items.map((i) => `<div class="news-item"><div class="d">${new Date(i.created_at).toLocaleString('mn-MN')}</div><h3>${escapeHtml(i.title)}</h3><p>${escapeHtml(i.body)}</p></div>`).join('')
      : '<div class="empty">Одоогоор илгээсэн хүсэлт байхгүй.</div>';
  } catch (e) {
    el.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
  }
}

// ---------- long queue ----------
const LQ_RELATIONS = ['Аав', 'Ээж', 'Ах/Эгч', 'Дүү', 'Хүүхэд', 'Эхнэр/Нөхөр', 'Өвөө/Эмээ', 'бусад'];

$('#lqDate').value = todayISO();
$('#lqLoad').addEventListener('click', () => renderLongQueue($('#lqDate').value));

function entryLine(p) {
  const who = p.prisoner_ovog || p.prisoner_ner
    ? ` — хоригдол: ${escapeHtml(p.prisoner_ovog)} ${escapeHtml(p.prisoner_ner)}${p.relation ? ` (${escapeHtml(p.relation)})` : ''}`
    : '';
  return `<div>• ${escapeHtml(p.ovog)} ${escapeHtml(p.ner)} <span class="mono">(${p.register})</span>${who}</div>`;
}

function bookingFormHtml() {
  return `<div class="card" id="lqBookForm" style="margin-top:10px">
    <label>Хоригдлын овог</label>
    <input type="text" id="lqPrisonerOvog" maxlength="80" placeholder="Овог">
    <label style="margin-top:8px">Хоригдлын нэр</label>
    <input type="text" id="lqPrisonerNer" maxlength="80" placeholder="Нэр">
    <label style="margin-top:8px">Хоригдолтой ямар хамааралтай вэ?</label>
    <select id="lqRelation">
      <option value="">-- Сонгоно уу --</option>
      ${LQ_RELATIONS.map((r) => `<option value="${escapeHtml(r)}">${r === 'бусад' ? 'Бусад' : escapeHtml(r)}</option>`).join('')}
    </select>
    <input type="text" id="lqRelationOther" maxlength="80" placeholder="Хамаарлаа бичнэ үү" style="margin-top:8px;display:none">
    <button class="btn-primary" id="lqConfirmBtn" style="margin-top:12px">Баталгаажуулах</button>
  </div>`;
}

async function renderLongQueue(date) {
  if (!date) return;
  const el = $('#lqResult');
  el.innerHTML = '<div class="empty">Ачааллаж байна...</div>';
  try {
    const info = await api(`/api/queue/long/${date}`);
    const full = info.status === 'full';
    el.innerHTML = `<div class="slot">
      <div class="date">${date}</div>
      <span class="status ${full ? 'full' : 'open'}">${full ? 'Дүүрсэн' : 'Захиалга авч байна (' + info.entries.length + '/' + info.capacity + ')'}</span>
      <div class="who">${info.entries.map(entryLine).join('') || '<div>Одоогоор хэн ч бүртгүүлээгүй.</div>'}</div>
      ${full ? `<div class="unlock-note">72 цагийн дараа буюу ${new Date(info.lockedUntil).toLocaleString('mn-MN')} үед дараагийн иргэд бүртгүүлэх боломжтой болно.</div>` : ''}
      <button class="take" id="lqTakeBtn" ${full || info.alreadyIn ? 'disabled' : ''}>${info.alreadyIn ? 'Та энэ ээлжинд аль хэдийн бүртгэлтэй' : (full ? 'Дүүрсэн' : 'Энэ өдөрт цаг авах')}</button>
    </div>`;
    const btn = $('#lqTakeBtn');
    if (btn && !btn.disabled) {
      btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.insertAdjacentHTML('afterend', bookingFormHtml());
        const relationSel = $('#lqRelation');
        const otherInput = $('#lqRelationOther');
        relationSel.addEventListener('change', () => {
          otherInput.style.display = relationSel.value === 'бусад' ? '' : 'none';
        });
        $('#lqConfirmBtn').addEventListener('click', async () => {
          const prisonerOvog = $('#lqPrisonerOvog').value.trim();
          const prisonerNer = $('#lqPrisonerNer').value.trim();
          const relation = relationSel.value;
          const relationOther = otherInput.value.trim();
          if (!prisonerOvog || !prisonerNer) return alert('Хоригдлын овог, нэрийг бөглөнө үү.');
          if (!relation) return alert('Хоригдолтой ямар хамааралтайгаа сонгоно уу.');
          if (relation === 'бусад' && !relationOther) return alert('Хамаарлаа бичнэ үү.');
          $('#lqConfirmBtn').disabled = true;
          try {
            await api(`/api/queue/long/${date}`, {
              method: 'POST',
              body: { prisonerOvog, prisonerNer, relation, relationOther },
            });
          } catch (e) {
            alert(e.message);
          }
          renderLongQueue(date);
        });
      });
    }
  } catch (e) {
    el.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
  }
}
renderLongQueue(todayISO());

// ---------- about (organization info) ----------
function formatAboutValue(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

function buildAboutHtml(d) {
  const items = [
    d.org_type ? ` <div class="k">Байгууллагын төрөл</div><div class="v">${escapeHtml(d.org_type)}</div>` : '',
    d.register_no ? ` <div class="k">Байгууллагын регистрийн дугаар</div><div class="v mono">${escapeHtml(d.register_no)}</div>` : '',
    d.founded_at ? ` <div class="k">Анх үүсгэн байгуулагдсан огноо</div><div class="v">${escapeHtml(d.founded_at)}</div>` : '',
    d.tax_id ? ` <div class="k">Татвар төлөгчийн дугаар</div><div class="v mono">${escapeHtml(d.tax_id)}</div>` : '',
    d.activity_code ? ` <div class="k">Үйл ажиллагааны чиглэл код</div><div class="v mono">${escapeHtml(d.activity_code)}</div>` : '',
    d.activity_main ? ` <div class="k">Үндсэн эрхлэх үйл ажиллагааны чиглэл</div><div class="v">${escapeHtml(d.activity_main)}</div>` : '',
    d.address ? ` <div class="k">Байгууллагын дэлгэрэнгүй хаяг</div><div class="v">${escapeHtml(d.address)}</div>` : '',
    d.responsibilities ? ` <div class="k">Байгууллагын чиг үүрэг</div><div class="v">${escapeHtml(d.responsibilities)}</div>` : '',
    d.budget_admin ? ` <div class="k">Төсвийн ерөнхийлөн захирагч</div><div class="v">${escapeHtml(d.budget_admin)}</div>` : '',
    d.accountant ? ` <div class="k">Нягтлан бодогч</div><div class="v">${escapeHtml(d.accountant)}</div>` : '',
    d.phone ? ` <div class="k">Ажлын утас</div><div class="v mono">${escapeHtml(d.phone)}</div>` : '',
    d.email ? ` <div class="k">И-мэйл</div><div class="v">${escapeHtml(d.email)}</div>` : '',
  ].filter(Boolean);

  if (!items.length) return '<div class="empty">Байгууллагын мэдээлэл хараахан нэмэгдээгүй байна.</div>';

  return `
    <div class="about-wrap">
      <div class="about-head">Байгууллагын мэдээлэл</div>
      <div class="about-grid">${items.join('')}</div>
    </div>`;
}

async function loadAboutInfo() {
  try {
    const d = await api('/api/about');
    const root = $('#aboutInfo');
    if (!root) return;
    root.innerHTML = buildAboutHtml(d);
  } catch {
    const root = $('#aboutInfo');
    if (root) root.innerHTML = '<div class="empty">Байгууллагын мэдээлэл ачаалах боломжгүй байна.</div>';
  }
}

// ---------- news ----------
async function loadNews() {

  const el = $('#newsList');
  el.innerHTML = '<div class="empty">Ачааллаж байна...</div>';
  const { items } = await api('/api/news');
  el.innerHTML = items.length
    ? items.map((i) => `<div class="news-item"><div class="d">${new Date(i.created_at).toLocaleDateString('mn-MN')}</div><h3>${escapeHtml(i.title)}</h3><p>${escapeHtml(i.body)}</p>${i.img_url ? `<img src="${i.img_url}" alt="">` : ''}</div>`).join('')
    : '<div class="empty">Одоогоор мэдээ алга.</div>';
}

// ---------- calendar ----------
let calCursor = new Date();
$('#calPrev').addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() - 1); renderCalendar(); });
$('#calNext').addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() + 1); renderCalendar(); });

async function renderCalendar() {
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  $('#calLabel').textContent = calCursor.toLocaleDateString('mn-MN', { year: 'numeric', month: 'long' });
  $('#calDow').innerHTML = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'].map((d) => `<div class="cal-dow">${d}</div>`).join('');
  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = todayISO();
  const yearMonth = `${y}-${String(m + 1).padStart(2, '0')}`;

  let fullDates = [];
  try {
    const res = await api(`/api/queue/long-status/${yearMonth}`);
    fullDates = res.fullDates;
  } catch { /* ignore */ }

  let cells = '';
  for (let i = 0; i < startOffset; i++) cells += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const isFull = fullDates.includes(dateStr);
    cells += `<div class="cal-day ${isToday ? 'today' : ''} ${isFull ? 'full' : ''}">${d}</div>`;
  }
  $('#calGrid').innerHTML = cells;
}

// ---------- admin ----------
$('#adminEnter').addEventListener('click', async () => {
  const username = $('#adminUser').value.trim();
  const password = $('#adminPass').value;
  const err = $('#adminErr');
  err.style.display = 'none';
  try {
    const data = await api('/api/admin/login', { method: 'POST', body: { username, password } });
    adminToken = data.token;
    $('#adminGate').classList.add('hidden');
    $('#adminPanel').classList.remove('hidden');
    loadAdminTab('users');
  } catch (e) {
    err.textContent = e.message;
    err.style.display = 'block';
  }
});

$$('.tab').forEach((t) => t.addEventListener('click', () => {
  $$('.tab').forEach((x) => x.classList.remove('active'));
  t.classList.add('active');
  loadAdminTab(t.dataset.tab);
}));

async function loadAdminTab(tab) {
  const el = $('#adminContent');
  el.innerHTML = '<div class="empty">Ачааллаж байна...</div>';

  if (tab === 'users') {
    const { items } = await api('/api/admin/users', { admin: true });
    el.innerHTML = items.length ? `<table><thead><tr><th>Овог</th><th>Нэр</th><th>Регистр</th><th>Утас</th><th>Бүртгүүлсэн</th></tr></thead><tbody>
      ${items.map((r) => `<tr><td>${escapeHtml(r.ovog)}</td><td>${escapeHtml(r.ner)}</td><td class="mono">${r.register}</td><td class="mono">${r.phone}</td><td>${new Date(r.created_at).toLocaleDateString('mn-MN')}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">Бүртгэлтэй иргэн алга.</div>';
  }

  if (tab === 'lq') {
    const { items } = await api('/api/admin/queue/long', { admin: true });
    const byDateWave = {};
    items.forEach((r) => {
      const key = r.date + '#' + r.wave;
      (byDateWave[key] = byDateWave[key] || []).push(r);
    });
    const groups = Object.entries(byDateWave);
    el.innerHTML = groups.length ? groups.map(([key, people]) => {
      const [date] = key.split('#');
      return `<div class="slot" style="margin-bottom:10px">
        <div class="date">${date}</div>
        <span class="status ${people.length >= 10 ? 'full' : 'open'}">${people.length}/10</span>
        <div class="who">${people.map((p) => `<div>• ${escapeHtml(p.ovog)} ${escapeHtml(p.ner)} — <span class="mono">(${p.register})</span> — <span class="mono">${p.phone}</span>${p.prisoner_ovog || p.prisoner_ner ? ` — хоригдол: ${escapeHtml(p.prisoner_ovog)} ${escapeHtml(p.prisoner_ner)}${p.relation ? ` (${escapeHtml(p.relation)})` : ''}` : ''}</div>`).join('')}</div>
      </div>`;
    }).join('') : '<div class="empty">Урт хугцааны эргэлтэд бүртгэл алга.</div>';
  }

  if (tab === 'fb') {
    const { items } = await api('/api/admin/feedback', { admin: true });
    el.innerHTML = items.length ? items.map((r) => `
      <div class="news-item">
        <div class="d">${new Date(r.created_at).toLocaleString('mn-MN')} · ${escapeHtml(r.ovog)} ${escapeHtml(r.ner)} · <span class="mono">${r.phone}</span> · ${r.status}</div>
        <h3>${escapeHtml(r.title)}</h3>
        <p>${escapeHtml(r.body)}</p>
      </div>`).join('') : '<div class="empty">Санал хүсэлт алга.</div>';
  }

  if (tab === 'news') {
    el.innerHTML = `
      <label>Гарчиг</label>
      <input id="newsTitle" placeholder="Мэдээний гарчиг">
      <label>Агуулга</label>
      <textarea id="newsBody" rows="4" placeholder="Мэдээний дэлгэрэнгүй..."></textarea>
      <label>Зургийн URL (сонголтоор)</label>
      <input id="newsImg" placeholder="https://... эсвэл jpg зургийн холбоос">
      <button class="btn-primary" id="newsSubmit">Нийтлэх</button>
      <div class="hint">Зургийг та өөрөө URL хэлбэрээр буюу сервер дээрх /frontend/assets/ фолдерт байршуулсны дараа холбоосыг энд оруулна.</div>`;
    $('#newsSubmit').addEventListener('click', async () => {
      const title = $('#newsTitle').value.trim();
      const body = $('#newsBody').value.trim();
      const img_url = $('#newsImg').value.trim();
      if (!title || !body) return;
      await api('/api/admin/news', { method: 'POST', admin: true, body: { title, body, img_url } });
      loadAdminTab('news');
    });
  }
} 