const firebaseConfig = {
  apiKey: "AIzaSyCMdmZYh6--CVR9yuHWCmbzWPXtyAAHduk",
  authDomain: "velora-booking-59896.firebaseapp.com",
  projectId: "velora-booking-59896",
  storageBucket: "velora-booking-59896.firebasestorage.app",
  messagingSenderId: "719631771230",
  appId: "1:719631771230:web:89a81cf9e8e8205ce476cf",
  measurementId: "G-YCE9NFGLRT"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const stockRef = db.collection('settings').doc('stock');
const blockedRef = db.collection('settings').doc('blocked');
const priceRef = db.collection('settings').doc('prices');
const contentRef = db.collection('settings').doc('content');
const ordersRef = db.collection('orders');
const usageRef = db.collection('usage');
const dailyStockRef = db.collection('settings').doc('dailyStock');
const DEFAULT_CONTENT = {
  whatsapp: '6285717835248',
  qrisSrc: 'assets/qris.jpeg',
  gallerySubtitle: 'Banyak model lainnya di IG @velora.id — silakan SS & request ke admin 🌸',
  galleryNote: '📸 <strong>Ingin model tertentu?</strong> Lihat koleksi lengkap di <strong>@velora.id</strong>, screenshot model yang disukai & kirim ke admin. <strong>Free request!</strong>',
  gallery: [
    { src:'assets/foto1.jpeg', alt:'Papan Kubah Pink', caption:'Papan Kubah · Pink · Sidang Wisuda' },
    { src:'assets/foto2.jpeg', alt:'Papan Kubah Red', caption:'Papan Kubah · Merah · Sidang Wisuda' },
    { src:'assets/foto3.jpeg', alt:'Convex Mirror Pink', caption:'Convex Mirror · Pink · Sidang Wisuda' },
    { src:'assets/foto4.jpeg', alt:'Convex Mirror Pink Indoor', caption:'Convex Mirror · Pink · Indoor Event' },
    { src:'assets/foto5.jpeg', alt:'Multiple Boards', caption:'Koleksi Lengkap · Berbagai Model' },
    { src:'assets/foto6.jpeg', alt:'Papan Gantung', caption:'Papan Gantung · Pink/Merah · Event & Wisuda' }
  ],
  // ── Hero ──
  heroLogo: 'assets/logo.jpeg',
  heroTitleMain: 'velora',
  heroTitleAccent: '.id',
  heroSubtitle: 'Beauty Reflections — Sewa Papan Ucapan Wisuda & Event',
  // ── Feature cards di beranda ──
  features: [
    { icon:'🪞', title:'Convex Mirror', desc:'Tampilan elegan & modern, cocok untuk semua acara' },
    { icon:'⭕', title:'Papan Bulat', desc:'Desain melingkar cantik dengan dekorasi bunga' },
    { icon:'🏛️', title:'Papan Kubah', desc:'Bentuk arch klasik yang timeless dan elegan' },
    { icon:'🌸', title:'Free Request', desc:'Bebas request model & warna bunga favoritmu' }
  ],
  // ── Jenis papan ──
  boardTypes: {
    'Convex': { label:'Convex Mirror', icon:'🪞', active:true },
    'Papan Bulat': { label:'Papan Bulat', icon:'⭕', active:true },
    'Papan Kubah': { label:'Papan Kubah', icon:'🏛️', active:true },
    'Papan Gantung': { label:'Papan Gantung', icon:'🪷', active:true }
  },
  // ── Pilihan warna bunga ──
  warnaOptions: ['Pink', 'Merah', 'Biru', 'Coklat/Cream'],
  warnaOptionsGantung: ['Pink', 'Merah'],
  // ── Teks lain ──
  successTitle: 'Pesanan Diterima!',
  successDesc: 'Terima kasih telah memesan di <strong>Velora.id</strong>. Pesananmu sudah kami catat. Jangan lupa kirim bukti DP/Pelunasan ke admin ya!',
  paymentNote: '<strong>NB:</strong> Order minimal harus DP 50% atau bisa lunas 100% dari harga sewa. Jika pesan tapi tidak melakukan minimal DP dianggap tidak pesan.<br>Kirim bukti DP/Pelunasan ke admin Velora.id.',
  waButtonText: 'Hubungi Admin',
  waDefaultMessage: 'Halo Admin Velora, saya ingin bertanya tentang sewa papan ucapan.'
};
let siteContent = JSON.parse(JSON.stringify(DEFAULT_CONTENT));

const EVENT_TYPES = ['Sidang', 'Wedding', 'Lamaran', 'Event'];
const DEFAULT_PRICE_MAP = {
  'Sidang': { 'Convex': 85000, 'Papan Bulat': 60000, 'Papan Kubah': 55000, 'Papan Gantung': 85000 },
  'Wedding': { 'Convex': 100000, 'Papan Bulat': 65000, 'Papan Kubah': 60000, 'Papan Gantung': 100000 },
  'Lamaran': { 'Convex': 100000, 'Papan Bulat': 65000, 'Papan Kubah': 60000, 'Papan Gantung': 100000 },
  'Event': { 'Convex': 100000, 'Papan Bulat': 65000, 'Papan Kubah': 60000, 'Papan Gantung': 100000 }
};
const PAPAN_TYPES = [
  { key:'Convex', label:'Convex Mirror', icon:'🪞' },
  { key:'Papan Bulat', label:'Papan Bulat', icon:'⭕' },
  { key:'Papan Kubah', label:'Papan Kubah', icon:'🏛️' },
  { key:'Papan Gantung', label:'Papan Gantung', icon:'🪷' }
];
const DEFAULT_STOCK = { 'Convex':2, 'Papan Bulat':2, 'Papan Kubah':2, 'Papan Gantung':1 };
let orders = [], blockedDates = [], stockTotal = { ...DEFAULT_STOCK }, dailyStockByDate = {}, usageByDate = {}, priceMap = JSON.parse(JSON.stringify(DEFAULT_PRICE_MAP));
let isAdmin = false, ordersUnsub = null;
const today = new Date();
let calYear = today.getFullYear(), calMonth = today.getMonth();

function firebaseReady(){ return firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('ISI_'); }
function toast(msg){ const el=document.getElementById('toast'); if(!el) return alert(msg); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2800); }
function err(e){ console.error(e); toast('Firebase belum siap atau izin database ditolak. Cek config dan rules.'); }
function mergePriceMap(source={}){
  const merged = JSON.parse(JSON.stringify(DEFAULT_PRICE_MAP));
  Object.keys(source || {}).forEach(event => {
    merged[event] = { ...(merged[event] || {}), ...(source[event] || {}) };
  });
  const boards = typeof allPapanList === 'function' ? allPapanList(true) : PAPAN_TYPES;
  EVENT_TYPES.forEach(event => {
    merged[event] = { ...(merged[event] || {}), ...(source[event] || {}) };
    boards.forEach(p => { if(merged[event][p.key] == null) merged[event][p.key]=0; });
  });
  return merged;
}
function mergeContent(source={}){
  const boardTypes = {};
  const sourceBoards = source.boardTypes || {};
  [...new Set([...Object.keys(DEFAULT_CONTENT.boardTypes), ...Object.keys(sourceBoards)])].forEach(k => {
    const fallback = DEFAULT_CONTENT.boardTypes[k] || { label:k, icon:'✨', active:true };
    boardTypes[k] = { ...fallback, ...(sourceBoards[k] || {}) };
    if(boardTypes[k].deleted) boardTypes[k].active = false;
    else if(boardTypes[k].active !== false) boardTypes[k].active = true;
  });
  return {
    ...DEFAULT_CONTENT,
    ...source,
    gallery: Array.isArray(source.gallery) && source.gallery.length ? source.gallery : DEFAULT_CONTENT.gallery,
    features: Array.isArray(source.features) && source.features.length ? source.features : DEFAULT_CONTENT.features,
    warnaOptions: Array.isArray(source.warnaOptions) && source.warnaOptions.length ? source.warnaOptions : DEFAULT_CONTENT.warnaOptions,
    warnaOptionsGantung: Array.isArray(source.warnaOptionsGantung) && source.warnaOptionsGantung.length ? source.warnaOptionsGantung : DEFAULT_CONTENT.warnaOptionsGantung,
    boardTypes
  };
}
function allPapanList(includeInactive=false){
  const boardTypes = siteContent.boardTypes || DEFAULT_CONTENT.boardTypes;
  const keys = [...new Set([...PAPAN_TYPES.map(p=>p.key), ...Object.keys(boardTypes || {})])];
  return keys.map(key => {
    const base = PAPAN_TYPES.find(p=>p.key===key) || { key, label:key, icon:'✨' };
    const item = { ...base, ...(boardTypes[key] || {}) };
    if(item.deleted) item.active = false;
    else if(item.active !== false) item.active = true;
    return item;
  }).filter(p => !p.deleted && (includeInactive || p.active !== false));
}
function papanList(){ return allPapanList(false); }
function boardKeyFromLabel(label){
  const base=String(label||'Papan Baru').trim().replace(/\s+/g,' ') || 'Papan Baru';
  let key=base, i=2;
  const existing=new Set(allPapanList(true).map(p=>p.key));
  while(existing.has(key)){ key=`${base} ${i}`; i++; }
  return key;
}
function stockBase(items={}){ const base={}; allPapanList(true).forEach(p=>base[p.key]=0); return {...base,...DEFAULT_STOCK,...items}; }
function boardFieldId(field,key){ return `board-${field}-${key}`.replace(/[^a-zA-Z0-9_-]/g,'-'); }
function stockValueId(key){ return `sv-${key}`.replace(/[^a-zA-Z0-9_-]/g,'-'); }
function encodeBoardKey(key){ return encodeURIComponent(key); }
function decodeBoardKey(key){ return decodeURIComponent(key); }
function refresh(){ const a=document.querySelector('.page.active'); renderContent(); renderPriceTable(); updatePrice(); updateAvailability(); if(!a) return; if(a.id==='page-cek') renderCalendar(); if(a.id==='page-admin'&&isAdmin) renderAdmin(); }
function toDateStr(date){ return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'); }
function formatDate(d){ return d ? new Date(d+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '-'; }
function formatMoney(n){ return 'Rp '+(Number(n)||0).toLocaleString('id-ID'); }
function dateRange(start,end){
  if(!start||!end) return [];
  const a=new Date(start+'T00:00:00'), b=new Date(end+'T00:00:00'), dates=[];
  if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime())||a>b) return dates;
  for(let d=new Date(a); d<=b; d.setDate(d.getDate()+1)) dates.push(toDateStr(d));
  return dates;
}
function rentalDays(start,end){ return Math.max(1,dateRange(start,end).length); }
function formatDateRange(start,end){ return start&&end&&start!==end ? `${formatDate(start)} - ${formatDate(end)}` : formatDate(start||end); }
function compactDate(dateStr){ return String(dateStr || toDateStr(new Date())).replace(/-/g,''); }
function orderMillis(o){ return o.createdAt?.toDate ? o.createdAt.toDate().getTime() : (o.createdAtText ? new Date(o.createdAtText).getTime() : 0); }
function createdLabel(o){ return o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString('id-ID') : (o.createdAtText ? new Date(o.createdAtText).toLocaleString('id-ID') : '-'); }
function paidAmount(o){ return Number(o.paidAmount ?? o.dpAmount ?? 0); }
function remainingAmount(o){ return Math.max(0,(Number(o.harga)||0)-paidAmount(o)); }

function startRealtimeData(){
  if(!firebaseReady()){ toast('Isi konfigurasi Firebase dulu di file HTML.'); return; }
  stockRef.onSnapshot(async d=>{ if(d.exists&&d.data().items) stockTotal=stockBase(d.data().items); else await stockRef.set({items:DEFAULT_STOCK,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}); refresh(); }, err);
  blockedRef.onSnapshot(async d=>{ if(d.exists&&Array.isArray(d.data().dates)) blockedDates=d.data().dates; else await blockedRef.set({dates:[]}); refresh(); }, err);
  priceRef.onSnapshot(d=>{ priceMap=d.exists&&d.data().items ? mergePriceMap(d.data().items) : mergePriceMap(); refresh(); }, err);
  contentRef.onSnapshot(d=>{ siteContent=d.exists ? mergeContent(d.data()) : mergeContent(); refresh(); }, err);
  usageRef.onSnapshot(s=>{ usageByDate={}; s.forEach(d=>usageByDate[d.id]=d.data().counts||{}); refresh(); }, err);
  dailyStockRef.onSnapshot(d=>{ dailyStockByDate=d.exists&&d.data().items ? d.data().items : {}; refresh(); }, err);
}
function listenAdminOrders(){
  if(ordersUnsub) ordersUnsub();
  ordersUnsub=ordersRef.orderBy('createdAt','desc').onSnapshot(s=>{ orders=s.docs.map(d=>({id:d.id,...d.data()})); if(document.getElementById('page-admin')?.classList.contains('active')) renderAdmin(); }, err);
}
function getStockBaseOnDate(dateStr){ return dailyStockByDate[dateStr] ? stockBase(dailyStockByDate[dateStr]) : stockBase(stockTotal); }
function getStockOnDate(dateStr){ const used=usageByDate[dateStr]||{}, base=getStockBaseOnDate(dateStr), r={}; allPapanList(true).forEach(p=>r[p.key]=Math.max(0,(base[p.key]||0)-(used[p.key]||0))); return r; }

function showPage(p){ if(p==='admin'&&!isAdmin){showAdminOverlay();return;} document.querySelectorAll('.page').forEach(el=>el.classList.remove('active')); document.getElementById('page-'+p).classList.add('active'); if(p==='cek') renderCalendar(); if(p==='admin') renderAdmin(); window.scrollTo(0,0); }
function triggerAdmin(){ isAdmin ? showPage('admin') : showAdminOverlay(); }
function showAdminOverlay(){ document.getElementById('admin-login-overlay').classList.add('active'); setTimeout(()=>document.getElementById('admin-email-input').focus(),100); }
function closeAdminOverlay(){
  document.getElementById('admin-login-overlay').classList.remove('active');
  document.getElementById('admin-err').style.display='none';
  document.getElementById('admin-email-input').value='';
  document.getElementById('admin-pass-input').value='';
}
function showAdminError(message){
  const el=document.getElementById('admin-err');
  el.textContent=message;
  el.style.display='block';
}
async function checkAdminLogin(){
  const email=document.getElementById('admin-email-input').value.trim();
  const password=document.getElementById('admin-pass-input').value;
  if(!email||!password){ showAdminError('Isi email dan password admin.'); return; }
  try{
    await auth.signInWithEmailAndPassword(email,password);
  }catch(e){
    console.error(e);
    const code=e.code||'';
    if(code.includes('unauthorized-domain')) showAdminError('Domain website belum diizinkan di Firebase Authentication.');
    else if(code.includes('user-not-found')||code.includes('invalid-credential')) showAdminError('Email admin belum terdaftar atau password salah.');
    else if(code.includes('wrong-password')) showAdminError('Password admin salah.');
    else if(code.includes('invalid-email')) showAdminError('Format email admin belum benar.');
    else if(code.includes('network-request-failed')) showAdminError('Koneksi internet bermasalah. Coba lagi.');
    else showAdminError('Login gagal. Cek Firebase Authentication dan domain Netlify.');
  }
}
async function adminLogout(){ await auth.signOut(); showPage('home'); }
auth.onAuthStateChanged(u=>{ isAdmin=!!u; document.getElementById('admin-badge').style.display=isAdmin?'inline':'none'; if(isAdmin){ closeAdminOverlay(); listenAdminOrders(); } else { orders=[]; if(ordersUnsub) ordersUnsub(); if(document.getElementById('page-admin')?.classList.contains('active')) showPage('home'); } });

function renderCalendar(){
  const names=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  (document.getElementById('cal-month-label') || document.getElementById('cal-month-year')).textContent=names[calMonth]+' '+calYear;
  const first=new Date(calYear,calMonth,1), last=new Date(calYear,calMonth+1,0), grid=document.getElementById('cal-days');
  let html=''; for(let i=0;i<first.getDay();i++) html+='<button class="cal-day empty"></button>';
  for(let d=1;d<=last.getDate();d++){
    const date=new Date(calYear,calMonth,d), ds=toDateStr(date), past=date<new Date(today.getFullYear(),today.getMonth(),today.getDate()), blocked=blockedDates.includes(ds), stock=getStockOnDate(ds), full=blocked||papanList().every(p=>stock[p.key]===0);
    let cls='cal-day'; if(past) cls+=' past'; else if(full) cls+=' booked'; else if(ds===toDateStr(today)) cls+=' today';
    html+=`<button class="${cls}" ${past||full?'':`onclick="checkDate('${ds}')"`}>${d}</button>`;
  }
  grid.innerHTML=html;
}
function changeMonth(delta){ calMonth+=delta; if(calMonth<0){calMonth=11;calYear--;} if(calMonth>11){calMonth=0;calYear++;} renderCalendar(); }
function prevMonth(){ changeMonth(-1); }
function nextMonth(){ changeMonth(1); }
function checkDate(dateStr){
  document.querySelectorAll('.cal-day').forEach(b=>b.classList.remove('selected'));
  const day=new Date(dateStr+'T00:00:00').getDate(); document.querySelectorAll('.cal-day').forEach(b=>{ if(b.textContent==day&&!b.classList.contains('empty')) b.classList.add('selected'); });
  const stock=getStockOnDate(dateStr), blocked=blockedDates.includes(dateStr), allOut=papanList().every(p=>stock[p.key]===0);
  document.getElementById('cek-result').style.display='block';
  document.getElementById('cek-banner').innerHTML=blocked||allOut ? `<div class="status-banner unavailable"><strong>Maaf, tanggal ${formatDate(dateStr)} tidak tersedia.</strong><br>Silakan pilih tanggal lain.</div>` : `<div class="status-banner available"><strong>Tanggal ${formatDate(dateStr)} tersedia.</strong><br>Kamu bisa lanjut melakukan pemesanan.</div>`;
  document.getElementById('cek-stock-wrap').style.display='block';
  document.getElementById('cek-stock-grid').innerHTML=papanList().map(p=>{ const s=stock[p.key], total=stockTotal[p.key]||0; let cls='stock-card', text=''; if(blocked){cls+=' full';text='Tidak Tersedia';} else if(s===0){cls+=' full';text='Habis';} else if(s<=1){cls+=' low';text='Hampir Habis';} else {cls+=' ready';text='Tersedia';} return `<div class="${cls}"><div class="papan-icon">${p.icon}</div><div class="papan-name">${p.label}</div><div class="stock-num">${blocked?0:s}</div><div class="stock-lbl">${text}</div><div class="stock-of">dari ${total} unit</div></div>`; }).join('');
  const startEl=document.getElementById('f-tgl-mulai') || document.getElementById('f-tgl');
  const endEl=document.getElementById('f-tgl-selesai');
  if(startEl) startEl.value=dateStr;
  if(endEl&&!endEl.value) endEl.value=dateStr;
  updatePrice();
  updateAvailability();
}
function renderPriceTable(){
  const tbody = document.getElementById('price-table-body');
  const thead = document.getElementById('price-table-head');
  const boards = papanList();
  if(thead) thead.innerHTML = `<tr><th>Acara</th>${boards.map(p=>`<th>${p.label}</th>`).join('')}</tr>`;
  if(!tbody) return;
  tbody.innerHTML = EVENT_TYPES.map(event => `<tr><td>${event}</td>${boards.map(p => `<td style="color:var(--pink-deep);font-weight:600">Rp ${(priceMap[event]?.[p.key] || 0).toLocaleString('id-ID')}</td>`).join('')}</tr>`).join('');
}
function updateColorOptions(){
  const papan = document.getElementById('f-papan')?.value;
  const warna = document.getElementById('f-warna');
  if(!warna) return;
  const current = warna.value;
  const options = papan === 'Papan Gantung'
    ? ['', ...(siteContent.warnaOptionsGantung || DEFAULT_CONTENT.warnaOptionsGantung)]
    : ['', ...(siteContent.warnaOptions || DEFAULT_CONTENT.warnaOptions)];
  warna.innerHTML = options.map(v => `<option value="${v}">${v || 'Pilih warna...'}</option>`).join('');
  warna.value = options.includes(current) ? current : '';
}
function handleBoardChange(){
  updateColorOptions();
  updatePrice();
  updateAvailability();
  if(document.getElementById('f-papan').value === 'Papan Gantung') toast('Papan Gantung hanya ready bunga Pink dan Merah.');
}
function handleRentDateChange(){
  const start=document.getElementById('f-tgl-mulai'), end=document.getElementById('f-tgl-selesai');
  if(start&&end&&start.value){
    end.min=start.value;
    if(!end.value || end.value<start.value) end.value=start.value;
  }
  updatePrice();
  updateAvailability();
}
function getAvailabilityCheck(start,end,papan){
  const dates=dateRange(start,end);
  if(!start||!end||!papan) return { ready:null, dates, message:'Pilih tanggal sewa dan jenis papan dulu.' };
  if(!dates.length) return { ready:false, dates, message:'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.' };
  const blocked=dates.filter(d=>blockedDates.includes(d));
  if(blocked.length) return { ready:false, dates, blocked, message:'Tanggal '+blocked.map(formatDate).join(', ')+' sedang tidak tersedia.' };
  const out=dates.filter(d=>(getStockOnDate(d)[papan]||0)<=0);
  if(out.length) return { ready:false, dates, out, message:'Stok '+papan+' habis pada '+out.map(formatDate).join(', ')+'.' };
  const minStock=Math.min(...dates.map(d=>getStockOnDate(d)[papan]||0));
  return { ready:true, dates, minStock, message:`${papan} tersedia untuk ${dates.length} hari. Sisa stok terendah: ${minStock} unit.` };
}
function updateAvailability(){
  const box=document.getElementById('availability-group'), banner=document.getElementById('availability-banner'), btn=document.getElementById('submit-order-btn');
  if(!box||!banner) return;
  const start=document.getElementById('f-tgl-mulai')?.value, end=document.getElementById('f-tgl-selesai')?.value, papan=document.getElementById('f-papan')?.value;
  const check=getAvailabilityCheck(start,end,papan);
  if(check.ready===null){ box.style.display='none'; if(btn) btn.disabled=false; return; }
  box.style.display='block';
  banner.className='status-banner '+(check.ready?'available':'unavailable');
  banner.innerHTML=check.ready
    ? `<strong>Stok tersedia.</strong><br>${check.message}`
    : `<strong>Stok belum tersedia.</strong><br>${check.message}`;
  if(btn) btn.disabled=!check.ready;
}
function updatePrice(){
  const a=document.getElementById('f-acara')?.value, p=document.getElementById('f-papan')?.value, g=document.getElementById('price-group');
  if(!g) return;
  const start=document.getElementById('f-tgl-mulai')?.value || document.getElementById('f-tgl')?.value;
  const end=document.getElementById('f-tgl-selesai')?.value || start;
  if(a&&p&&priceMap[a]?.[p]){
    const days=rentalDays(start,end), unit=priceMap[a][p], total=unit*days;
    document.getElementById('price-show').innerHTML=`<span>Rp </span>${total.toLocaleString('id-ID')}`;
    const note=document.getElementById('price-note');
    if(note) note.textContent=`${days} hari x Rp ${unit.toLocaleString('id-ID')} per hari`;
    g.style.display='block';
  } else g.style.display='none';
}
function getWhatsAppLink(message){
  const phone = String(siteContent.whatsapp || DEFAULT_CONTENT.whatsapp).replace(/\D/g,'');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
function openWhatsAppAdmin(message){
  window.open(getWhatsAppLink(message || siteContent.waDefaultMessage || DEFAULT_CONTENT.waDefaultMessage), '_blank');
}
function buildOrderWhatsAppMessage(order){
  return [
    'Halo Admin Velora, saya sudah membuat pesanan.',
    '',
    `Kode Booking: ${order.bookingCode || order.id || '-'}`,
    `Nama: ${order.nama}`,
    `No. HP: ${order.hp}`,
    `Tanggal: ${formatDateRange(order.tanggalMulai || order.tanggal, order.tanggalSelesai || order.tanggal)}`,
    `Jam: ${order.jam}`,
    `Durasi: ${order.jumlahHari || rentalDays(order.tanggalMulai || order.tanggal, order.tanggalSelesai || order.tanggal)} hari`,
    `Lokasi: ${order.lokasi}`,
    `Acara: ${order.acara}`,
    `Jenis Papan: ${order.papan}`,
    `Warna Bunga: ${order.warna}`,
    `Total Sewa: ${formatMoney(order.harga)}`,
    `Min. DP 50%: ${formatMoney(Math.ceil(order.harga*0.5))}`,
    '',
    `Ucapan: ${order.ucapan}`,
    '',
    'Mohon diproses ya, Admin.'
  ].join('\n');
}
function assetWithVersion(src){
  if(!src) return '';
  if(src.startsWith('http') || src.includes('?')) return src;
  return `${src}?v=20260612`;
}
function renderContent(){
  // Hero
  const heroLogo=document.getElementById('hero-logo');
  if(heroLogo) heroLogo.src=assetWithVersion(siteContent.heroLogo);
  const heroMain=document.getElementById('hero-title-main');
  if(heroMain) heroMain.textContent=siteContent.heroTitleMain;
  const heroAccent=document.getElementById('hero-title-accent');
  if(heroAccent) heroAccent.textContent=siteContent.heroTitleAccent;
  const heroSub=document.getElementById('hero-subtitle');
  if(heroSub) heroSub.textContent=siteContent.heroSubtitle;

  // Feature cards
  const featGrid=document.getElementById('features-grid');
  if(featGrid){
    featGrid.innerHTML=(siteContent.features || []).map(f=>`
      <div style="background:var(--white);border-radius:20px;padding:28px 20px;text-align:center;box-shadow:var(--shadow);">
        <div style="font-size:2.4rem;margin-bottom:12px;">${f.icon || ''}</div>
        <div style="font-family:'Playfair Display',serif;font-size:1rem;margin-bottom:6px;">${f.title || ''}</div>
        <div style="font-size:.82rem;color:var(--muted);">${f.desc || ''}</div>
      </div>`).join('');
  }

  // Jenis papan select (form pesanan)
  const papanSel=document.getElementById('f-papan');
  if(papanSel){
    const current=papanSel.value;
    papanSel.innerHTML='<option value="">Pilih jenis papan...</option>'+papanList().map(p=>`<option value="${p.key}">${p.icon ? p.icon+' ' : ''}${p.label}</option>`).join('');
    papanSel.value=current;
  }

  // Success page
  const sTitle=document.getElementById('success-title');
  if(sTitle) sTitle.textContent=siteContent.successTitle;
  const sDesc=document.getElementById('success-desc');
  if(sDesc) sDesc.innerHTML=siteContent.successDesc;

  // Payment note
  document.querySelectorAll('.payment-nb').forEach(el=>el.innerHTML=siteContent.paymentNote);

  // WhatsApp button texts
  document.querySelectorAll('.wa-btn-text').forEach(el=>el.textContent=siteContent.waButtonText);
  const floatingWa=document.getElementById('floating-wa-btn');
  if(floatingWa) floatingWa.title='Hubungi Admin WhatsApp';

  const subtitle=document.getElementById('gallery-subtitle');
  if(subtitle) subtitle.textContent=siteContent.gallerySubtitle;
  const note=document.getElementById('gallery-note');
  if(note) note.innerHTML=siteContent.galleryNote;
  document.querySelectorAll('.qris-img').forEach(img=>img.src=assetWithVersion(siteContent.qrisSrc));
  const grid=document.getElementById('gallery-grid');
  if(grid){
    grid.innerHTML=(siteContent.gallery || []).map(item=>`
      <div class="gallery-card">
        <img src="${assetWithVersion(item.src)}" alt="${item.alt || item.caption || 'Koleksi Velora'}">
        <div class="caption">${item.caption || ''}</div>
      </div>`).join('');
  }
}
function renderContentInputs(){
  const wa=document.getElementById('content-whatsapp');
  if(!wa) return;
  wa.value=siteContent.whatsapp || '';
  document.getElementById('content-qris').value=siteContent.qrisSrc || '';
  document.getElementById('content-wa-message').value=siteContent.waDefaultMessage || '';
  document.getElementById('content-wa-btn-text').value=siteContent.waButtonText || '';
  document.getElementById('content-hero-logo').value=siteContent.heroLogo || '';
  document.getElementById('content-hero-title-main').value=siteContent.heroTitleMain || '';
  document.getElementById('content-hero-title-accent').value=siteContent.heroTitleAccent || '';
  document.getElementById('content-hero-subtitle').value=siteContent.heroSubtitle || '';
  document.getElementById('content-success-title').value=siteContent.successTitle || '';
  document.getElementById('content-success-desc').value=(siteContent.successDesc || '').replace(/<strong>/g,'').replace(/<\/strong>/g,'');
  document.getElementById('content-payment-note').value=(siteContent.paymentNote || '').replace(/<strong>/g,'').replace(/<\/strong>/g,'').replace(/<br>/g,'\n');
  document.getElementById('content-warna').value=(siteContent.warnaOptions || []).join(', ');
  document.getElementById('content-warna-gantung').value=(siteContent.warnaOptionsGantung || []).join(', ');
  document.getElementById('content-gallery-subtitle').value=siteContent.gallerySubtitle || '';
  document.getElementById('content-gallery-note').value=(siteContent.galleryNote || '').replace(/<strong>/g,'').replace(/<\/strong>/g,'');
  renderFeaturesAdminList();
  renderBoardTypesAdminList();
  renderGalleryAdminList();
}
function renderFeaturesAdminList(){
  const list=document.getElementById('features-admin-list');
  if(!list) return;
  list.innerHTML=(siteContent.features || []).map((f,i)=>`
    <div class="gallery-admin-row" style="grid-template-columns:.6fr 1fr 1.6fr;">
      <input id="feat-icon-${i}" value="${f.icon || ''}" placeholder="🪞">
      <input id="feat-title-${i}" value="${f.title || ''}" placeholder="Judul fitur">
      <input id="feat-desc-${i}" value="${f.desc || ''}" placeholder="Deskripsi singkat">
    </div>`).join('');
}
function addFeatureAdminRow(){
  siteContent.features=[...(siteContent.features || []), {icon:'✨', title:'Fitur Baru', desc:'Deskripsi fitur baru'}];
  renderFeaturesAdminList();
}
function renderBoardTypesAdminList(){
  const list=document.getElementById('board-types-admin-list');
  if(!list) return;
  list.innerHTML=allPapanList(true).map(p=>`
    <div class="board-admin-row">
      <input id="${boardFieldId('icon',p.key)}" value="${p.icon || ''}" placeholder="Ikon">
      <input id="${boardFieldId('label',p.key)}" value="${p.label || ''}" placeholder="Nama papan">
      <label class="board-active-toggle">
        <input id="${boardFieldId('active',p.key)}" type="checkbox" ${p.active!==false?'checked':''}>
        Tampil
      </label>
      <button class="action-btn delete" onclick="deleteBoardType('${encodeBoardKey(p.key)}')">Hapus</button>
    </div>`).join('');
}
function addBoardTypeAdminRow(){
  const key=boardKeyFromLabel('Papan Baru');
  siteContent={
    ...siteContent,
    boardTypes:{
      ...(siteContent.boardTypes || {}),
      [key]:{ label:key, icon:'✨', active:true }
    }
  };
  stockTotal={...stockTotal,[key]:0};
  priceMap=mergePriceMap(priceMap);
  renderBoardTypesAdminList();
  renderStockInputs();
  renderDailyStockInputs();
  renderPriceInputs();
  renderContent();
  renderPriceTable();
}
function deleteBoardType(encodedKey){
  const key=decodeBoardKey(encodedKey);
  if(!confirm('Hapus jenis papan "'+key+'"? Papan ini tidak akan tampil lagi di form pelanggan.')) return;
  const next={...(siteContent.boardTypes || {})};
  if(DEFAULT_CONTENT.boardTypes[key]) next[key]={...(next[key] || DEFAULT_CONTENT.boardTypes[key]), deleted:true, active:false};
  else delete next[key];
  siteContent={...siteContent, boardTypes:next};
  renderBoardTypesAdminList();
  renderContent();
  renderPriceTable();
}
function renderGalleryAdminList(){
  const list=document.getElementById('gallery-admin-list');
  if(!list) return;
  list.innerHTML=(siteContent.gallery || []).map((item,i)=>`
    <div class="gallery-admin-row">
      <input id="gal-src-${i}" value="${item.src || ''}" placeholder="assets/foto1.jpeg">
      <input id="gal-caption-${i}" value="${item.caption || ''}" placeholder="Caption koleksi">
    </div>`).join('');
}
function addGalleryAdminRow(){
  siteContent.gallery=[...(siteContent.gallery || []), {src:'assets/foto-baru.jpeg', alt:'Koleksi Velora', caption:'Caption foto baru'}];
  renderGalleryAdminList();
}
async function saveContent(){
  const gallery=(siteContent.gallery || []).map((item,i)=>({
    src:document.getElementById(`gal-src-${i}`)?.value.trim() || item.src,
    alt:document.getElementById(`gal-caption-${i}`)?.value.trim() || 'Koleksi Velora',
    caption:document.getElementById(`gal-caption-${i}`)?.value.trim() || ''
  })).filter(item=>item.src);
  const features=(siteContent.features || []).map((f,i)=>({
    icon:document.getElementById(`feat-icon-${i}`)?.value.trim() || f.icon,
    title:document.getElementById(`feat-title-${i}`)?.value.trim() || f.title,
    desc:document.getElementById(`feat-desc-${i}`)?.value.trim() || f.desc
  })).filter(f=>f.title);
  const boardTypes={...(siteContent.boardTypes || {})};
  allPapanList(true).forEach(p=>{
    boardTypes[p.key]={
      icon:document.getElementById(boardFieldId('icon',p.key))?.value.trim() || p.icon,
      label:document.getElementById(boardFieldId('label',p.key))?.value.trim() || p.label,
      active:document.getElementById(boardFieldId('active',p.key))?.checked !== false
    };
  });
  const warnaOptions=document.getElementById('content-warna').value.split(',').map(v=>v.trim()).filter(Boolean);
  const warnaOptionsGantung=document.getElementById('content-warna-gantung').value.split(',').map(v=>v.trim()).filter(Boolean);
  siteContent=mergeContent({
    whatsapp:document.getElementById('content-whatsapp').value.trim().replace(/\D/g,''),
    qrisSrc:document.getElementById('content-qris').value.trim() || DEFAULT_CONTENT.qrisSrc,
    waDefaultMessage:document.getElementById('content-wa-message').value.trim() || DEFAULT_CONTENT.waDefaultMessage,
    waButtonText:document.getElementById('content-wa-btn-text').value.trim() || DEFAULT_CONTENT.waButtonText,
    heroLogo:document.getElementById('content-hero-logo').value.trim() || DEFAULT_CONTENT.heroLogo,
    heroTitleMain:document.getElementById('content-hero-title-main').value.trim() || DEFAULT_CONTENT.heroTitleMain,
    heroTitleAccent:document.getElementById('content-hero-title-accent').value.trim() || DEFAULT_CONTENT.heroTitleAccent,
    heroSubtitle:document.getElementById('content-hero-subtitle').value.trim() || DEFAULT_CONTENT.heroSubtitle,
    successTitle:document.getElementById('content-success-title').value.trim() || DEFAULT_CONTENT.successTitle,
    successDesc:document.getElementById('content-success-desc').value.trim() || DEFAULT_CONTENT.successDesc,
    paymentNote:document.getElementById('content-payment-note').value.trim().replace(/\n/g,'<br>') || DEFAULT_CONTENT.paymentNote,
    warnaOptions:warnaOptions.length ? warnaOptions : DEFAULT_CONTENT.warnaOptions,
    warnaOptionsGantung:warnaOptionsGantung.length ? warnaOptionsGantung : DEFAULT_CONTENT.warnaOptionsGantung,
    gallerySubtitle:document.getElementById('content-gallery-subtitle').value.trim(),
    galleryNote:document.getElementById('content-gallery-note').value.trim(),
    features,
    boardTypes,
    gallery
  });
  await contentRef.set({...siteContent, updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  renderContent();
  renderPriceTable();
  renderStockInputs();
  renderDailyStockInputs();
  renderPriceInputs();
  toast('Konten website berhasil disimpan!');
}
async function submitOrder(){
  if(!firebaseReady()){toast('Isi konfigurasi Firebase dulu.');return;}
  const fields=[['f-nama','Nama Penyewa'],['f-hp','No. HP'],['f-id','Identitas'],['f-tgl-mulai','Tanggal Mulai Sewa'],['f-tgl-selesai','Tanggal Selesai Sewa'],['f-jam','Jam'],['f-lokasi','Lokasi'],['f-warna','Warna Bunga'],['f-acara','Kebutuhan Acara'],['f-papan','Jenis Papan'],['f-ucapan','Ucapan']];
  for(const [id,lbl] of fields){ const el=document.getElementById(id); if(!el||!el.value.trim()){toast('Mohon isi: '+lbl); if(el)el.focus(); return;} }
  const tanggalMulai=document.getElementById('f-tgl-mulai').value, tanggalSelesai=document.getElementById('f-tgl-selesai').value, papan=document.getElementById('f-papan').value, acara=document.getElementById('f-acara').value, warna=document.getElementById('f-warna').value, hargaSatuan=priceMap[acara]?.[papan]||0;
  const tanggalList=dateRange(tanggalMulai,tanggalSelesai), jumlahHari=tanggalList.length, harga=hargaSatuan*jumlahHari;
  if(!jumlahHari){ toast('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.'); return; }
  if(papan === 'Papan Gantung' && !['Pink','Merah'].includes(warna)){ toast('Papan Gantung hanya tersedia bunga Pink dan Merah.'); return; }
  const availability=getAvailabilityCheck(tanggalMulai,tanggalSelesai,papan);
  if(availability.ready===false){ toast(availability.message); updateAvailability(); return; }
  const order={nama:document.getElementById('f-nama').value.trim(),hp:document.getElementById('f-hp').value.trim(),identitas:document.getElementById('f-id').value,tanggal:tanggalMulai,tanggalMulai,tanggalSelesai,tanggalList,jam:document.getElementById('f-jam').value,durasi:`${jumlahHari} Hari`,jumlahHari,lokasi:document.getElementById('f-lokasi').value.trim(),warna:document.getElementById('f-warna').value,acara,papan,hargaSatuan,harga,paidAmount:0,paymentStatus:'Belum Bayar',ucapan:document.getElementById('f-ucapan').value.trim(),status:'Pending',createdAt:firebase.firestore.FieldValue.serverTimestamp(),createdAtText:new Date().toISOString()};
  const newOrder=ordersRef.doc();
  try{
    await db.runTransaction(async tx=>{
      const sd=await tx.get(stockRef), bd=await tx.get(blockedRef), dd=await tx.get(dailyStockRef);
      const stock=sd.exists&&sd.data().items?stockBase(sd.data().items):stockBase(DEFAULT_STOCK);
      const blocked=bd.exists&&Array.isArray(bd.data().dates)?bd.data().dates:[];
      const daily=dd.exists&&dd.data().items?dd.data().items:{};
      order.bookingCode=`VEL-${compactDate(toDateStr(new Date()))}-${newOrder.id.slice(0,5).toUpperCase()}`;
      const usageDocs=await Promise.all(tanggalList.map(d=>tx.get(usageRef.doc(d))));
      for(let i=0;i<tanggalList.length;i++){
        const d=tanggalList[i], counts=usageDocs[i].exists&&usageDocs[i].data().counts?usageDocs[i].data().counts:{};
        const base=daily[d]?stockBase({...stock,...daily[d]}):stock;
        if(blocked.includes(d)) throw new Error('blocked:'+d);
        if((base[papan]||0)-(counts[papan]||0)<=0) throw new Error('out:'+d);
      }
      tx.set(newOrder,order);
      tanggalList.forEach((d,i)=>{
        const counts=usageDocs[i].exists&&usageDocs[i].data().counts?usageDocs[i].data().counts:{};
        tx.set(usageRef.doc(d),{counts:{...counts,[papan]:(counts[papan]||0)+1}},{merge:true});
      });
    });
  }catch(e){ if(String(e.message).startsWith('blocked:')) toast('Tanggal '+formatDate(e.message.split(':')[1])+' sedang tidak tersedia.'); else if(String(e.message).startsWith('out:')) toast('Stok papan ini habis pada '+formatDate(e.message.split(':')[1])+'.'); else err(e); return; }
  document.getElementById('success-summary').innerHTML=`<div class="row"><span>Kode Booking</span><span>${order.bookingCode}</span></div><div class="row"><span>Nama</span><span>${order.nama}</span></div><div class="row"><span>Tanggal</span><span>${formatDateRange(order.tanggalMulai,order.tanggalSelesai)} · ${order.jam}</span></div><div class="row"><span>Jenis</span><span>${order.papan} · ${order.acara}</span></div><div class="row"><span>Lokasi</span><span>${order.lokasi}</span></div><div class="row"><span>Durasi</span><span>${order.jumlahHari} hari</span></div><div class="row"><span>Harga / hari</span><span>${formatMoney(order.hargaSatuan)}</span></div><div class="row"><span>Total Sewa</span><span>${formatMoney(order.harga)}</span></div><div class="row"><span>Min. DP (50%)</span><span style="color:var(--pink-deep)">${formatMoney(Math.ceil(order.harga*0.5))}</span></div>`;
  const waMessage = buildOrderWhatsAppMessage(order);
  const waLink = getWhatsAppLink(waMessage);
  const waBtn = document.getElementById('wa-success-btn');
  if(waBtn){
    waBtn.style.display='inline-flex';
    waBtn.onclick=()=>window.open(waLink,'_blank');
  }
  ['f-nama','f-hp','f-tgl-mulai','f-tgl-selesai','f-jam','f-lokasi','f-ucapan'].forEach(id=>document.getElementById(id).value='');
  ['f-id','f-warna','f-acara','f-papan'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('price-group').style.display='none'; updateAvailability(); showPage('sukses');
  setTimeout(()=>window.open(waLink,'_blank'), 350);
}

function renderAdmin(){
  const total=orders.length,pending=orders.filter(o=>o.status==='Pending').length,dp=orders.filter(o=>o.status==='DP').length,lunas=orders.filter(o=>o.status==='Lunas').length,revenue=orders.filter(o=>o.status!=='Batal').reduce((a,o)=>a+(Number(o.harga)||0),0),paid=orders.filter(o=>o.status!=='Batal').reduce((a,o)=>a+paidAmount(o),0);
  document.getElementById('stats-row').innerHTML=`<div class="stat-card"><div class="num">${total}</div><div class="lbl">Total Pesanan</div></div><div class="stat-card"><div class="num" style="color:#856404">${pending}</div><div class="lbl">Pending</div></div><div class="stat-card"><div class="num" style="color:#084298">${dp}</div><div class="lbl">Sudah DP</div></div><div class="stat-card"><div class="num" style="color:#0a3622">${lunas}</div><div class="lbl">Lunas</div></div><div class="stat-card"><div class="num" style="font-size:1.2rem;color:var(--pink-deep)">${formatMoney(paid)}</div><div class="lbl">Uang Masuk</div></div><div class="stat-card"><div class="num" style="font-size:1.2rem;color:var(--pink-deep)">${formatMoney(revenue)}</div><div class="lbl">Total Tagihan</div></div>`;
  renderBlockedList(); renderStockInputs(); renderDailyStockInputs(); renderPriceInputs(); renderContentInputs(); renderTable();
}
function renderTable(){
  const filter=document.getElementById('filter-status').value, filtered=filter?orders.filter(o=>o.status===filter):[...orders]; filtered.sort((a,b)=>orderMillis(b)-orderMillis(a));
  const tbody=document.getElementById('orders-tbody'); if(!filtered.length){tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">Belum ada pesanan</td></tr>';return;}
  tbody.innerHTML=filtered.map((o,i)=>`<tr><td>${i+1}</td><td><strong>${o.nama}</strong><br><span style="color:var(--muted);font-size:.75rem">${o.bookingCode || o.id}</span><br><span style="color:var(--muted);font-size:.75rem">${o.hp}</span></td><td>${formatDateRange(o.tanggalMulai||o.tanggal,o.tanggalSelesai||o.tanggal)}<br><span style="color:var(--muted);font-size:.75rem">${o.jam} · ${o.jumlahHari || rentalDays(o.tanggalMulai||o.tanggal,o.tanggalSelesai||o.tanggal)} hari</span></td><td>${o.acara}</td><td>${o.papan}</td><td style="font-weight:600;color:var(--pink-deep)">${formatMoney(o.harga)}<br><span style="color:#0a3622;font-size:.75rem">Masuk: ${formatMoney(paidAmount(o))}</span><br><span style="color:var(--muted);font-size:.75rem">Sisa: ${formatMoney(remainingAmount(o))}</span></td><td><span class="badge badge-${String(o.status).toLowerCase().replace(' ','')}">${o.status}</span></td><td><div class="action-btns"><button class="action-btn confirm" onclick="viewOrder('${o.id}')">👁</button>${o.status!=='Lunas'&&o.status!=='Batal'?`<button class="action-btn dp" onclick="setPaymentStatus('${o.id}','DP')">DP</button>`:''}${o.status!=='Lunas'&&o.status!=='Batal'?`<button class="action-btn confirm" onclick="setPaymentStatus('${o.id}','Lunas')">Lunas</button>`:''}${o.status!=='Batal'?`<button class="action-btn cancel" onclick="setStatus('${o.id}','Batal')">Batal</button>`:''}<button class="action-btn delete" onclick="deleteOrder('${o.id}')">🗑</button></div></td></tr>`).join('');
}
async function adjustUsageRange(tx,order,delta){
  const dates=order.tanggalList || dateRange(order.tanggalMulai||order.tanggal,order.tanggalSelesai||order.tanggal);
  if(!dates.length||!order.papan||!delta) return;
  const docs=await Promise.all(dates.map(d=>tx.get(usageRef.doc(d))));
  dates.forEach((d,i)=>{
    const counts=docs[i].exists&&docs[i].data().counts?docs[i].data().counts:{};
    counts[order.papan]=Math.max(0,(counts[order.papan]||0)+delta);
    tx.set(usageRef.doc(d),{counts},{merge:true});
  });
}
async function setStatus(id,status){ const old=orders.find(o=>o.id===id); if(!old)return; await db.runTransaction(async tx=>{ if(old.status!=='Batal'&&status==='Batal') await adjustUsageRange(tx,old,-1); if(old.status==='Batal'&&status!=='Batal') await adjustUsageRange(tx,old,1); tx.update(ordersRef.doc(id),{status,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}); }); toast('Status diubah ke '+status); }
async function setPaymentStatus(id,status){
  const old=orders.find(o=>o.id===id); if(!old)return;
  const fallback=status==='Lunas' ? Number(old.harga)||0 : Math.max(paidAmount(old),Math.ceil((Number(old.harga)||0)*0.5));
  const raw=prompt(status==='Lunas' ? 'Masukkan nominal pelunasan yang diterima:' : 'Masukkan nominal DP yang diterima:', fallback);
  if(raw===null) return;
  const amount=Math.max(0,Number(String(raw).replace(/[^\d]/g,''))||0);
  const nextStatus=status==='Lunas'||amount>=Number(old.harga) ? 'Lunas' : 'DP';
  await ordersRef.doc(id).update({status:nextStatus,paymentStatus:nextStatus==='Lunas'?'Lunas':'Sudah DP',paidAmount:amount,paidAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
  toast(nextStatus==='Lunas' ? 'Pembayaran ditandai lunas.' : 'DP berhasil dicatat.');
}
async function deleteOrder(id){ if(!confirm('Hapus pesanan ini?'))return; const old=orders.find(o=>o.id===id); await db.runTransaction(async tx=>{ if(old&&old.status!=='Batal') await adjustUsageRange(tx,old,-1); tx.delete(ordersRef.doc(id)); }); toast('Pesanan dihapus'); }
function viewOrder(id){
  const o=orders.find(x=>x.id===id); if(!o)return;
  document.getElementById('modal-content').innerHTML=`<div class="detail-row"><span class="key">Kode Booking</span><span class="val">${o.bookingCode || o.id}</span></div><div class="detail-row"><span class="key">Nama</span><span class="val">${o.nama}</span></div><div class="detail-row"><span class="key">No. HP</span><span class="val">${o.hp}</span></div><div class="detail-row"><span class="key">Identitas</span><span class="val">${o.identitas}</span></div><div class="detail-row"><span class="key">Tanggal</span><span class="val">${formatDateRange(o.tanggalMulai||o.tanggal,o.tanggalSelesai||o.tanggal)} · ${o.jam}</span></div><div class="detail-row"><span class="key">Durasi</span><span class="val">${o.jumlahHari || rentalDays(o.tanggalMulai||o.tanggal,o.tanggalSelesai||o.tanggal)} hari</span></div><div class="detail-row"><span class="key">Lokasi</span><span class="val">${o.lokasi}</span></div><div class="detail-row"><span class="key">Warna Bunga</span><span class="val">${o.warna}</span></div><div class="detail-row"><span class="key">Acara</span><span class="val">${o.acara}</span></div><div class="detail-row"><span class="key">Jenis Papan</span><span class="val">${o.papan}</span></div><div class="detail-row"><span class="key">Harga</span><span class="val" style="color:var(--pink-deep);font-weight:700">${formatMoney(o.harga)}</span></div><div class="detail-row"><span class="key">Uang Masuk</span><span class="val">${formatMoney(paidAmount(o))}</span></div><div class="detail-row"><span class="key">Sisa Bayar</span><span class="val">${formatMoney(remainingAmount(o))}</span></div><div class="detail-row"><span class="key">Status</span><span class="val"><span class="badge badge-${String(o.status).toLowerCase()}">${o.status}</span></span></div><div class="detail-row"><span class="key">Ucapan</span><span class="val" style="white-space:pre-wrap">${o.ucapan}</span></div><div class="detail-row"><span class="key">Dipesan</span><span class="val">${createdLabel(o)}</span></div>`;
  document.getElementById('modal-actions').innerHTML=`${o.status!=='Lunas'&&o.status!=='Batal'?`<button class="action-btn dp" onclick="setPaymentStatus('${o.id}','DP');closeModal()">Catat DP</button><button class="action-btn confirm" onclick="setPaymentStatus('${o.id}','Lunas');closeModal()">Tandai Lunas</button>`:''}`;
  document.getElementById('detail-modal').classList.add('active');
}
function closeModal(){document.getElementById('detail-modal').classList.remove('active');}
function renderBlockedList(){ const list=document.getElementById('blocked-list-display'); list.innerHTML=blockedDates.length?blockedDates.map(d=>`<div class="blocked-chip">${formatDate(d)} <button onclick="removeBlock('${d}')">×</button></div>`).join(''):'<span style="color:var(--muted);font-size:.82rem">Belum ada tanggal yang diblocked</span>'; }
function renderStockInputs(){ const row=document.getElementById('stock-input-row'); if(!row)return; row.innerHTML=allPapanList(true).map(p=>`<div class="stock-input-item"><label>${p.icon} ${p.label}${p.active===false?' (Disembunyikan)':''}</label><div class="stock-ctrl"><button onclick="changeStock('${encodeBoardKey(p.key)}', -1)">−</button><span class="stock-val" id="${stockValueId(p.key)}">${stockTotal[p.key]||0}</span><button onclick="changeStock('${encodeBoardKey(p.key)}', 1)">+</button></div></div>`).join(''); }
function changeStock(encodedKey,delta){ const key=decodeBoardKey(encodedKey); stockTotal[key]=Math.max(0,(stockTotal[key]||0)+delta); const el=document.getElementById(stockValueId(key)); if(el)el.textContent=stockTotal[key]; }
async function saveStock(){ await stockRef.set({items:stockTotal,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); toast('Stok berhasil disimpan!'); }
function dailyStockInputId(key){ return 'dsv-'+key.replace(/\s+/g,'-'); }
function renderDailyStockInputs(){
  const dateEl=document.getElementById('daily-stock-date'), row=document.getElementById('daily-stock-input-row'), hint=document.getElementById('daily-stock-hint');
  if(!dateEl||!row) return;
  const d=dateEl.value || toDateStr(today), base=dailyStockByDate[d] ? stockBase(dailyStockByDate[d]) : stockBase(stockTotal);
  dateEl.value=d;
  row.innerHTML=allPapanList(true).map(p=>`<div class="stock-input-item"><label>${p.icon} ${p.label}${p.active===false?' (Disembunyikan)':''}</label><input id="${dailyStockInputId(p.key)}" type="number" min="0" step="1" value="${base[p.key]||0}" style="width:100%;background:white;"></div>`).join('');
  if(hint) hint.textContent=dailyStockByDate[d] ? 'Tanggal ini memakai stok khusus.' : 'Tanggal ini masih mengikuti stok total.';
}
async function saveDailyStock(){
  const d=document.getElementById('daily-stock-date')?.value;
  if(!d){ toast('Pilih tanggal stok dulu.'); return; }
  const items={};
  allPapanList(true).forEach(p=>items[p.key]=Math.max(0,Number(document.getElementById(dailyStockInputId(p.key))?.value||0)));
  dailyStockByDate={...dailyStockByDate,[d]:items};
  await dailyStockRef.set({items:dailyStockByDate,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  toast('Stok tanggal '+formatDate(d)+' berhasil disimpan!');
}
async function clearDailyStock(){
  const d=document.getElementById('daily-stock-date')?.value;
  if(!d){ toast('Pilih tanggal stok dulu.'); return; }
  const next={...dailyStockByDate};
  delete next[d];
  dailyStockByDate=next;
  await dailyStockRef.set({items:dailyStockByDate,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  renderDailyStockInputs();
  toast('Stok khusus tanggal '+formatDate(d)+' dihapus.');
}
function priceInputId(event, papan){ return `price-${event}-${papan}`.replace(/[^a-zA-Z0-9_-]/g,'-'); }
function renderPriceInputs(){
  const grid=document.getElementById('price-admin-grid');
  if(!grid) return;
  grid.innerHTML=EVENT_TYPES.map(event => allPapanList(true).map(p => {
    const id=priceInputId(event,p.key);
    return `<div class="price-admin-item"><label>${event} - ${p.label}${p.active===false?' (Disembunyikan)':''}</label><input id="${id}" type="number" min="0" step="1000" value="${priceMap[event]?.[p.key] || 0}"></div>`;
  }).join('')).join('');
}
async function savePrices(){
  const next=mergePriceMap(priceMap);
  EVENT_TYPES.forEach(event => allPapanList(true).forEach(p => {
    const el=document.getElementById(priceInputId(event,p.key));
    next[event][p.key]=Math.max(0, Number(el?.value || 0));
  }));
  priceMap=next;
  await priceRef.set({items:priceMap,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  renderPriceTable();
  updatePrice();
  toast('Harga berhasil disimpan!');
}
async function addBlockedDate(){ const d=document.getElementById('block-date-input').value; if(!d){toast('Pilih tanggal dulu');return;} if(!blockedDates.includes(d)){ await blockedRef.set({dates:[...blockedDates,d].sort()},{merge:true}); toast(formatDate(d)+' sudah diblocked'); } else toast('Tanggal sudah diblocked'); document.getElementById('block-date-input').value=''; }
async function removeBlock(d){ await blockedRef.set({dates:blockedDates.filter(x=>x!==d)},{merge:true}); toast('Block dihapus: '+formatDate(d)); }
function buildOrderRows(){
  const header=['ID','Kode Booking','Nama','HP','Identitas','Tanggal Mulai','Tanggal Selesai','Jam','Durasi Hari','Lokasi','Warna','Acara','Papan','Harga Per Hari','Harga Total','Uang Masuk','Sisa Bayar','Ucapan','Status','Dibuat'];
  const rows=orders.map(o=>[
    o.id, o.bookingCode||'', o.nama, o.hp, o.identitas,
    o.tanggalMulai||o.tanggal, o.tanggalSelesai||o.tanggal, o.jam,
    o.jumlahHari||rentalDays(o.tanggalMulai||o.tanggal,o.tanggalSelesai||o.tanggal),
    o.lokasi, o.warna, o.acara, o.papan,
    o.hargaSatuan||'', o.harga, paidAmount(o), remainingAmount(o),
    o.ucapan, o.status, createdLabel(o)
  ]);
  return { header, rows };
}
function csvCell(v){ return '"'+String(v ?? '').replace(/"/g,'""')+'"'; }
function exportCSV(){
  if(!orders.length){toast('Belum ada pesanan');return;}
  const { header, rows } = buildOrderRows();
  const csv=[header,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);
  a.download='velora_pesanan_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  toast('CSV berhasil diexport');
}
function exportXLSX(){
  if(!orders.length){toast('Belum ada pesanan');return;}
  if(typeof XLSX==='undefined'){ toast('Library Excel belum siap, coba lagi sebentar.'); return; }
  const { header, rows } = buildOrderRows();
  const ws=XLSX.utils.aoa_to_sheet([header,...rows]);
  ws['!cols']=header.map((h,i)=>{
    const longest=Math.max(h.length, ...rows.map(r=>String(r[i] ?? '').length));
    return { wch: Math.min(Math.max(longest+2,10), 40) };
  });
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pesanan');
  XLSX.writeFile(wb, 'velora_pesanan_'+new Date().toISOString().slice(0,10)+'.xlsx');
  toast('Excel berhasil diexport');
}
function copyText(text){ navigator.clipboard.writeText(text).catch(()=>{}); toast('Nomor '+text+' disalin!'); }

document.getElementById('admin-pass-input').addEventListener('keydown',e=>{if(e.key==='Enter')checkAdminLogin();});
document.getElementById('admin-email-input').addEventListener('keydown',e=>{if(e.key==='Enter')checkAdminLogin();});
renderPriceTable();
renderContent();
updateColorOptions();
startRealtimeData();
renderCalendar();
