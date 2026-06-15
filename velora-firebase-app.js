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
  ]
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
  EVENT_TYPES.forEach(event => {
    merged[event] = { ...merged[event], ...(source[event] || {}) };
  });
  return merged;
}
function mergeContent(source={}){
  return { ...DEFAULT_CONTENT, ...source, gallery: Array.isArray(source.gallery) ? source.gallery : DEFAULT_CONTENT.gallery };
}
function refresh(){ const a=document.querySelector('.page.active'); renderContent(); renderPriceTable(); updatePrice(); if(!a) return; if(a.id==='page-cek') renderCalendar(); if(a.id==='page-admin'&&isAdmin) renderAdmin(); }
function toDateStr(date){ return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'); }
function formatDate(d){ return d ? new Date(d+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '-'; }
function dateRange(start,end){
  if(!start||!end) return [];
  const a=new Date(start+'T00:00:00'), b=new Date(end+'T00:00:00'), dates=[];
  if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime())||a>b) return dates;
  for(let d=new Date(a); d<=b; d.setDate(d.getDate()+1)) dates.push(toDateStr(d));
  return dates;
}
function rentalDays(start,end){ return Math.max(1,dateRange(start,end).length); }
function formatDateRange(start,end){ return start&&end&&start!==end ? `${formatDate(start)} - ${formatDate(end)}` : formatDate(start||end); }
function orderMillis(o){ return o.createdAt?.toDate ? o.createdAt.toDate().getTime() : (o.createdAtText ? new Date(o.createdAtText).getTime() : 0); }
function createdLabel(o){ return o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString('id-ID') : (o.createdAtText ? new Date(o.createdAtText).toLocaleString('id-ID') : '-'); }

function startRealtimeData(){
  if(!firebaseReady()){ toast('Isi konfigurasi Firebase dulu di file HTML.'); return; }
  stockRef.onSnapshot(async d=>{ if(d.exists&&d.data().items) stockTotal={...DEFAULT_STOCK,...d.data().items}; else await stockRef.set({items:DEFAULT_STOCK,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}); refresh(); }, err);
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
function getStockBaseOnDate(dateStr){ return dailyStockByDate[dateStr] ? {...DEFAULT_STOCK,...dailyStockByDate[dateStr]} : stockTotal; }
function getStockOnDate(dateStr){ const used=usageByDate[dateStr]||{}, base=getStockBaseOnDate(dateStr), r={}; PAPAN_TYPES.forEach(p=>r[p.key]=Math.max(0,(base[p.key]||0)-(used[p.key]||0))); return r; }

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
    const date=new Date(calYear,calMonth,d), ds=toDateStr(date), past=date<new Date(today.getFullYear(),today.getMonth(),today.getDate()), blocked=blockedDates.includes(ds), stock=getStockOnDate(ds), full=blocked||PAPAN_TYPES.every(p=>stock[p.key]===0);
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
  const stock=getStockOnDate(dateStr), blocked=blockedDates.includes(dateStr), allOut=PAPAN_TYPES.every(p=>stock[p.key]===0);
  document.getElementById('cek-result').style.display='block';
  document.getElementById('cek-banner').innerHTML=blocked||allOut ? `<div class="status-banner unavailable"><strong>Maaf, tanggal ${formatDate(dateStr)} tidak tersedia.</strong><br>Silakan pilih tanggal lain.</div>` : `<div class="status-banner available"><strong>Tanggal ${formatDate(dateStr)} tersedia.</strong><br>Kamu bisa lanjut melakukan pemesanan.</div>`;
  document.getElementById('cek-stock-wrap').style.display='block';
  document.getElementById('cek-stock-grid').innerHTML=PAPAN_TYPES.map(p=>{ const s=stock[p.key], total=stockTotal[p.key]||0; let cls='stock-card', text=''; if(blocked){cls+=' full';text='Tidak Tersedia';} else if(s===0){cls+=' full';text='Habis';} else if(s<=1){cls+=' low';text='Hampir Habis';} else {cls+=' ready';text='Tersedia';} return `<div class="${cls}"><div class="papan-icon">${p.icon}</div><div class="papan-name">${p.label}</div><div class="stock-num">${blocked?0:s}</div><div class="stock-lbl">${text}</div><div class="stock-of">dari ${total} unit</div></div>`; }).join('');
  const startEl=document.getElementById('f-tgl-mulai') || document.getElementById('f-tgl');
  const endEl=document.getElementById('f-tgl-selesai');
  if(startEl) startEl.value=dateStr;
  if(endEl&&!endEl.value) endEl.value=dateStr;
  updatePrice();
}
function renderPriceTable(){
  const tbody = document.getElementById('price-table-body');
  if(!tbody) return;
  tbody.innerHTML = EVENT_TYPES.map(event => `<tr><td>${event}</td>${PAPAN_TYPES.map(p => `<td style="color:var(--pink-deep);font-weight:600">Rp ${(priceMap[event]?.[p.key] || 0).toLocaleString('id-ID')}</td>`).join('')}</tr>`).join('');
}
function updateColorOptions(){
  const papan = document.getElementById('f-papan')?.value;
  const warna = document.getElementById('f-warna');
  if(!warna) return;
  const current = warna.value;
  const options = papan === 'Papan Gantung'
    ? ['', 'Pink', 'Merah']
    : ['', 'Pink', 'Merah', 'Biru', 'Coklat/Cream'];
  warna.innerHTML = options.map(v => `<option value="${v}">${v || 'Pilih warna...'}</option>`).join('');
  warna.value = options.includes(current) ? current : '';
}
function handleBoardChange(){
  updateColorOptions();
  updatePrice();
  if(document.getElementById('f-papan').value === 'Papan Gantung') toast('Papan Gantung hanya ready bunga Pink dan Merah.');
}
function handleRentDateChange(){
  const start=document.getElementById('f-tgl-mulai'), end=document.getElementById('f-tgl-selesai');
  if(start&&end&&start.value){
    end.min=start.value;
    if(!end.value || end.value<start.value) end.value=start.value;
  }
  updatePrice();
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
function openWhatsAppAdmin(message='Halo Admin Velora, saya ingin bertanya tentang sewa papan ucapan.'){
  window.open(getWhatsAppLink(message), '_blank');
}
function buildOrderWhatsAppMessage(order){
  return [
    'Halo Admin Velora, saya sudah membuat pesanan.',
    '',
    `Nama: ${order.nama}`,
    `No. HP: ${order.hp}`,
    `Tanggal: ${formatDateRange(order.tanggalMulai || order.tanggal, order.tanggalSelesai || order.tanggal)}`,
    `Jam: ${order.jam}`,
    `Durasi: ${order.jumlahHari || rentalDays(order.tanggalMulai || order.tanggal, order.tanggalSelesai || order.tanggal)} hari`,
    `Lokasi: ${order.lokasi}`,
    `Acara: ${order.acara}`,
    `Jenis Papan: ${order.papan}`,
    `Warna Bunga: ${order.warna}`,
    `Total Sewa: Rp ${order.harga.toLocaleString('id-ID')}`,
    `Min. DP 50%: Rp ${Math.ceil(order.harga*0.5).toLocaleString('id-ID')}`,
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
  document.getElementById('content-gallery-subtitle').value=siteContent.gallerySubtitle || '';
  document.getElementById('content-gallery-note').value=(siteContent.galleryNote || '').replace(/<strong>/g,'').replace(/<\/strong>/g,'');
  renderGalleryAdminList();
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
  siteContent=mergeContent({
    whatsapp:document.getElementById('content-whatsapp').value.trim().replace(/\D/g,''),
    qrisSrc:document.getElementById('content-qris').value.trim() || DEFAULT_CONTENT.qrisSrc,
    gallerySubtitle:document.getElementById('content-gallery-subtitle').value.trim(),
    galleryNote:document.getElementById('content-gallery-note').value.trim(),
    gallery
  });
  await contentRef.set({...siteContent, updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  renderContent();
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
  const order={nama:document.getElementById('f-nama').value.trim(),hp:document.getElementById('f-hp').value.trim(),identitas:document.getElementById('f-id').value,tanggal:tanggalMulai,tanggalMulai,tanggalSelesai,tanggalList,jam:document.getElementById('f-jam').value,durasi:`${jumlahHari} Hari`,jumlahHari,lokasi:document.getElementById('f-lokasi').value.trim(),warna:document.getElementById('f-warna').value,acara,papan,hargaSatuan,harga,ucapan:document.getElementById('f-ucapan').value.trim(),status:'Pending',createdAt:firebase.firestore.FieldValue.serverTimestamp(),createdAtText:new Date().toISOString()};
  const newOrder=ordersRef.doc();
  try{
    await db.runTransaction(async tx=>{
      const sd=await tx.get(stockRef), bd=await tx.get(blockedRef), dd=await tx.get(dailyStockRef);
      const stock=sd.exists&&sd.data().items?{...DEFAULT_STOCK,...sd.data().items}:DEFAULT_STOCK;
      const blocked=bd.exists&&Array.isArray(bd.data().dates)?bd.data().dates:[];
      const daily=dd.exists&&dd.data().items?dd.data().items:{};
      const usageDocs=await Promise.all(tanggalList.map(d=>tx.get(usageRef.doc(d))));
      for(let i=0;i<tanggalList.length;i++){
        const d=tanggalList[i], counts=usageDocs[i].exists&&usageDocs[i].data().counts?usageDocs[i].data().counts:{};
        const base=daily[d]?{...stock,...daily[d]}:stock;
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
  document.getElementById('success-summary').innerHTML=`<div class="row"><span>Nama</span><span>${order.nama}</span></div><div class="row"><span>Tanggal</span><span>${formatDateRange(order.tanggalMulai,order.tanggalSelesai)} · ${order.jam}</span></div><div class="row"><span>Jenis</span><span>${order.papan} · ${order.acara}</span></div><div class="row"><span>Lokasi</span><span>${order.lokasi}</span></div><div class="row"><span>Durasi</span><span>${order.jumlahHari} hari</span></div><div class="row"><span>Harga / hari</span><span>Rp ${order.hargaSatuan.toLocaleString('id-ID')}</span></div><div class="row"><span>Total Sewa</span><span>Rp ${order.harga.toLocaleString('id-ID')}</span></div><div class="row"><span>Min. DP (50%)</span><span style="color:var(--pink-deep)">Rp ${Math.ceil(order.harga*0.5).toLocaleString('id-ID')}</span></div>`;
  const waMessage = buildOrderWhatsAppMessage(order);
  const waLink = getWhatsAppLink(waMessage);
  const waBtn = document.getElementById('wa-success-btn');
  if(waBtn){
    waBtn.style.display='inline-flex';
    waBtn.onclick=()=>window.open(waLink,'_blank');
  }
  ['f-nama','f-hp','f-tgl-mulai','f-tgl-selesai','f-jam','f-lokasi','f-ucapan'].forEach(id=>document.getElementById(id).value='');
  ['f-id','f-warna','f-acara','f-papan'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('price-group').style.display='none'; showPage('sukses');
  setTimeout(()=>window.open(waLink,'_blank'), 350);
}

function renderAdmin(){
  const total=orders.length,pending=orders.filter(o=>o.status==='Pending').length,dp=orders.filter(o=>o.status==='DP').length,lunas=orders.filter(o=>o.status==='Lunas').length,revenue=orders.filter(o=>o.status!=='Batal').reduce((a,o)=>a+(Number(o.harga)||0),0);
  document.getElementById('stats-row').innerHTML=`<div class="stat-card"><div class="num">${total}</div><div class="lbl">Total Pesanan</div></div><div class="stat-card"><div class="num" style="color:#856404">${pending}</div><div class="lbl">Pending</div></div><div class="stat-card"><div class="num" style="color:#084298">${dp}</div><div class="lbl">Sudah DP</div></div><div class="stat-card"><div class="num" style="color:#0a3622">${lunas}</div><div class="lbl">Lunas</div></div><div class="stat-card"><div class="num" style="font-size:1.2rem;color:var(--pink-deep)">Rp ${(revenue/1000).toFixed(0)}rb</div><div class="lbl">Total Revenue</div></div>`;
  renderBlockedList(); renderStockInputs(); renderDailyStockInputs(); renderPriceInputs(); renderContentInputs(); renderTable();
}
function renderTable(){
  const filter=document.getElementById('filter-status').value, filtered=filter?orders.filter(o=>o.status===filter):[...orders]; filtered.sort((a,b)=>orderMillis(b)-orderMillis(a));
  const tbody=document.getElementById('orders-tbody'); if(!filtered.length){tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">Belum ada pesanan</td></tr>';return;}
  tbody.innerHTML=filtered.map((o,i)=>`<tr><td>${i+1}</td><td><strong>${o.nama}</strong><br><span style="color:var(--muted);font-size:.75rem">${o.hp}</span></td><td>${formatDateRange(o.tanggalMulai||o.tanggal,o.tanggalSelesai||o.tanggal)}<br><span style="color:var(--muted);font-size:.75rem">${o.jam} · ${o.jumlahHari || rentalDays(o.tanggalMulai||o.tanggal,o.tanggalSelesai||o.tanggal)} hari</span></td><td>${o.acara}</td><td>${o.papan}</td><td style="font-weight:600;color:var(--pink-deep)">Rp ${(Number(o.harga)||0).toLocaleString('id-ID')}</td><td><span class="badge badge-${String(o.status).toLowerCase().replace(' ','')}">${o.status}</span></td><td><div class="action-btns"><button class="action-btn confirm" onclick="viewOrder('${o.id}')">👁</button>${o.status==='Pending'?`<button class="action-btn dp" onclick="setStatus('${o.id}','DP')">DP</button>`:''}${o.status!=='Lunas'&&o.status!=='Batal'?`<button class="action-btn confirm" onclick="setStatus('${o.id}','Lunas')">Lunas</button>`:''}${o.status!=='Batal'?`<button class="action-btn cancel" onclick="setStatus('${o.id}','Batal')">Batal</button>`:''}<button class="action-btn delete" onclick="deleteOrder('${o.id}')">🗑</button></div></td></tr>`).join('');
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
async function deleteOrder(id){ if(!confirm('Hapus pesanan ini?'))return; const old=orders.find(o=>o.id===id); await db.runTransaction(async tx=>{ if(old&&old.status!=='Batal') await adjustUsageRange(tx,old,-1); tx.delete(ordersRef.doc(id)); }); toast('Pesanan dihapus'); }
function viewOrder(id){
  const o=orders.find(x=>x.id===id); if(!o)return;
  document.getElementById('modal-content').innerHTML=`<div class="detail-row"><span class="key">Nama</span><span class="val">${o.nama}</span></div><div class="detail-row"><span class="key">No. HP</span><span class="val">${o.hp}</span></div><div class="detail-row"><span class="key">Identitas</span><span class="val">${o.identitas}</span></div><div class="detail-row"><span class="key">Tanggal</span><span class="val">${formatDateRange(o.tanggalMulai||o.tanggal,o.tanggalSelesai||o.tanggal)} · ${o.jam}</span></div><div class="detail-row"><span class="key">Durasi</span><span class="val">${o.jumlahHari || rentalDays(o.tanggalMulai||o.tanggal,o.tanggalSelesai||o.tanggal)} hari</span></div><div class="detail-row"><span class="key">Lokasi</span><span class="val">${o.lokasi}</span></div><div class="detail-row"><span class="key">Warna Bunga</span><span class="val">${o.warna}</span></div><div class="detail-row"><span class="key">Acara</span><span class="val">${o.acara}</span></div><div class="detail-row"><span class="key">Jenis Papan</span><span class="val">${o.papan}</span></div><div class="detail-row"><span class="key">Harga</span><span class="val" style="color:var(--pink-deep);font-weight:700">Rp ${(Number(o.harga)||0).toLocaleString('id-ID')}</span></div><div class="detail-row"><span class="key">Status</span><span class="val"><span class="badge badge-${String(o.status).toLowerCase()}">${o.status}</span></span></div><div class="detail-row"><span class="key">Ucapan</span><span class="val" style="white-space:pre-wrap">${o.ucapan}</span></div><div class="detail-row"><span class="key">Dipesan</span><span class="val">${createdLabel(o)}</span></div>`;
  document.getElementById('modal-actions').innerHTML=`${o.status==='Pending'?`<button class="action-btn dp" onclick="setStatus('${o.id}','DP');closeModal()">Konfirmasi DP</button>`:''}${o.status!=='Lunas'&&o.status!=='Batal'?`<button class="action-btn confirm" onclick="setStatus('${o.id}','Lunas');closeModal()">Tandai Lunas</button>`:''}`;
  document.getElementById('detail-modal').classList.add('active');
}
function closeModal(){document.getElementById('detail-modal').classList.remove('active');}
function renderBlockedList(){ const list=document.getElementById('blocked-list-display'); list.innerHTML=blockedDates.length?blockedDates.map(d=>`<div class="blocked-chip">${formatDate(d)} <button onclick="removeBlock('${d}')">×</button></div>`).join(''):'<span style="color:var(--muted);font-size:.82rem">Belum ada tanggal yang diblocked</span>'; }
function renderStockInputs(){ const row=document.getElementById('stock-input-row'); if(!row)return; row.innerHTML=PAPAN_TYPES.map(p=>`<div class="stock-input-item"><label>${p.icon} ${p.label}</label><div class="stock-ctrl"><button onclick="changeStock('${p.key}', -1)">−</button><span class="stock-val" id="sv-${p.key.replace(' ','-')}">${stockTotal[p.key]||0}</span><button onclick="changeStock('${p.key}', 1)">+</button></div></div>`).join(''); }
function changeStock(key,delta){ stockTotal[key]=Math.max(0,(stockTotal[key]||0)+delta); const el=document.getElementById('sv-'+key.replace(' ','-')); if(el)el.textContent=stockTotal[key]; }
async function saveStock(){ await stockRef.set({items:stockTotal,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); toast('Stok berhasil disimpan!'); }
function dailyStockInputId(key){ return 'dsv-'+key.replace(/\s+/g,'-'); }
function renderDailyStockInputs(){
  const dateEl=document.getElementById('daily-stock-date'), row=document.getElementById('daily-stock-input-row'), hint=document.getElementById('daily-stock-hint');
  if(!dateEl||!row) return;
  const d=dateEl.value || toDateStr(today), base=dailyStockByDate[d] ? {...DEFAULT_STOCK,...dailyStockByDate[d]} : stockTotal;
  dateEl.value=d;
  row.innerHTML=PAPAN_TYPES.map(p=>`<div class="stock-input-item"><label>${p.icon} ${p.label}</label><input id="${dailyStockInputId(p.key)}" type="number" min="0" step="1" value="${base[p.key]||0}" style="width:100%;background:white;"></div>`).join('');
  if(hint) hint.textContent=dailyStockByDate[d] ? 'Tanggal ini memakai stok khusus.' : 'Tanggal ini masih mengikuti stok total.';
}
async function saveDailyStock(){
  const d=document.getElementById('daily-stock-date')?.value;
  if(!d){ toast('Pilih tanggal stok dulu.'); return; }
  const items={};
  PAPAN_TYPES.forEach(p=>items[p.key]=Math.max(0,Number(document.getElementById(dailyStockInputId(p.key))?.value||0)));
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
  grid.innerHTML=EVENT_TYPES.map(event => PAPAN_TYPES.map(p => {
    const id=priceInputId(event,p.key);
    return `<div class="price-admin-item"><label>${event} - ${p.label}</label><input id="${id}" type="number" min="0" step="1000" value="${priceMap[event]?.[p.key] || 0}"></div>`;
  }).join('')).join('');
}
async function savePrices(){
  const next=mergePriceMap(priceMap);
  EVENT_TYPES.forEach(event => PAPAN_TYPES.forEach(p => {
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
function exportCSV(){ if(!orders.length){toast('Belum ada pesanan');return;} const header=['ID','Nama','HP','Identitas','Tanggal Mulai','Tanggal Selesai','Jam','Durasi Hari','Lokasi','Warna','Acara','Papan','Harga Per Hari','Harga Total','Ucapan','Status','Dibuat']; const rows=orders.map(o=>[o.id,o.nama,o.hp,o.identitas,o.tanggalMulai||o.tanggal,o.tanggalSelesai||o.tanggal,o.jam,o.jumlahHari||rentalDays(o.tanggalMulai||o.tanggal,o.tanggalSelesai||o.tanggal),'"'+o.lokasi+'"',o.warna,o.acara,o.papan,o.hargaSatuan||'',o.harga,'"'+String(o.ucapan||'').replace(/"/g,"'")+'"',o.status,createdLabel(o)]); const csv=[header,...rows].map(r=>r.join(',')).join('\n'); const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv); a.download='velora_pesanan_'+new Date().toISOString().slice(0,10)+'.csv'; a.click(); toast('CSV berhasil diexport'); }
function copyText(text){ navigator.clipboard.writeText(text).catch(()=>{}); toast('Nomor '+text+' disalin!'); }

document.getElementById('admin-pass-input').addEventListener('keydown',e=>{if(e.key==='Enter')checkAdminLogin();});
document.getElementById('admin-email-input').addEventListener('keydown',e=>{if(e.key==='Enter')checkAdminLogin();});
renderPriceTable();
renderContent();
updateColorOptions();
startRealtimeData();
renderCalendar();



