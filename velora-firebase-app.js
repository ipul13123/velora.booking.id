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
const ordersRef = db.collection('orders');
const usageRef = db.collection('usage');
const ADMIN_WHATSAPP = '6285717835248';

const PRICE_MAP = {
  'Sidang': { 'Convex': 85000, 'Papan Bulat': 60000, 'Papan Kubah': 55000 },
  'Wedding': { 'Convex': 100000, 'Papan Bulat': 65000, 'Papan Kubah': 60000 },
  'Lamaran': { 'Convex': 100000, 'Papan Bulat': 65000, 'Papan Kubah': 60000 },
  'Event': { 'Convex': 100000, 'Papan Bulat': 65000, 'Papan Kubah': 60000 }
};
const PAPAN_TYPES = [
  { key:'Convex', label:'Convex Mirror', icon:'🪞' },
  { key:'Papan Bulat', label:'Papan Bulat', icon:'⭕' },
  { key:'Papan Kubah', label:'Papan Kubah', icon:'🏛️' }
];
const DEFAULT_STOCK = { 'Convex':2, 'Papan Bulat':2, 'Papan Kubah':2 };
let orders = [], blockedDates = [], stockTotal = { ...DEFAULT_STOCK }, usageByDate = {};
let isAdmin = false, ordersUnsub = null;
const today = new Date();
let calYear = today.getFullYear(), calMonth = today.getMonth();

function firebaseReady(){ return firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('ISI_'); }
function toast(msg){ const el=document.getElementById('toast'); if(!el) return alert(msg); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2800); }
function err(e){ console.error(e); toast('Firebase belum siap atau izin database ditolak. Cek config dan rules.'); }
function refresh(){ const a=document.querySelector('.page.active'); if(!a) return; if(a.id==='page-cek') renderCalendar(); if(a.id==='page-admin'&&isAdmin) renderAdmin(); }
function toDateStr(date){ return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'); }
function formatDate(d){ return d ? new Date(d+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '-'; }
function orderMillis(o){ return o.createdAt?.toDate ? o.createdAt.toDate().getTime() : (o.createdAtText ? new Date(o.createdAtText).getTime() : 0); }
function createdLabel(o){ return o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString('id-ID') : (o.createdAtText ? new Date(o.createdAtText).toLocaleString('id-ID') : '-'); }

function startRealtimeData(){
  if(!firebaseReady()){ toast('Isi konfigurasi Firebase dulu di file HTML.'); return; }
  stockRef.onSnapshot(async d=>{ if(d.exists&&d.data().items) stockTotal={...DEFAULT_STOCK,...d.data().items}; else await stockRef.set({items:DEFAULT_STOCK,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}); refresh(); }, err);
  blockedRef.onSnapshot(async d=>{ if(d.exists&&Array.isArray(d.data().dates)) blockedDates=d.data().dates; else await blockedRef.set({dates:[]}); refresh(); }, err);
  usageRef.onSnapshot(s=>{ usageByDate={}; s.forEach(d=>usageByDate[d.id]=d.data().counts||{}); refresh(); }, err);
}
function listenAdminOrders(){
  if(ordersUnsub) ordersUnsub();
  ordersUnsub=ordersRef.orderBy('createdAt','desc').onSnapshot(s=>{ orders=s.docs.map(d=>({id:d.id,...d.data()})); if(document.getElementById('page-admin')?.classList.contains('active')) renderAdmin(); }, err);
}
function getStockOnDate(dateStr){ const used=usageByDate[dateStr]||{}, r={}; PAPAN_TYPES.forEach(p=>r[p.key]=Math.max(0,(stockTotal[p.key]||0)-(used[p.key]||0))); return r; }

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
  document.getElementById('f-tgl').value=dateStr;
}
function updatePrice(){ const a=document.getElementById('f-acara').value, p=document.getElementById('f-papan').value, g=document.getElementById('price-group'); if(a&&p&&PRICE_MAP[a]?.[p]){ document.getElementById('price-show').innerHTML=`<span>Rp </span>${PRICE_MAP[a][p].toLocaleString('id-ID')}`; g.style.display='block'; } else g.style.display='none'; }
function getWhatsAppLink(message){
  return `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`;
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
    `Tanggal: ${formatDate(order.tanggal)}`,
    `Jam: ${order.jam}`,
    `Durasi: ${order.durasi}`,
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
async function submitOrder(){
  if(!firebaseReady()){toast('Isi konfigurasi Firebase dulu.');return;}
  const fields=[['f-nama','Nama Penyewa'],['f-hp','No. HP'],['f-id','Identitas'],['f-tgl','Tanggal Sewa'],['f-jam','Jam'],['f-durasi','Durasi'],['f-lokasi','Lokasi'],['f-warna','Warna Bunga'],['f-acara','Kebutuhan Acara'],['f-papan','Jenis Papan'],['f-ucapan','Ucapan']];
  for(const [id,lbl] of fields){ const el=document.getElementById(id); if(!el||!el.value.trim()){toast('Mohon isi: '+lbl); if(el)el.focus(); return;} }
  const tanggal=document.getElementById('f-tgl').value, papan=document.getElementById('f-papan').value, acara=document.getElementById('f-acara').value, harga=PRICE_MAP[acara]?.[papan]||0;
  const order={nama:document.getElementById('f-nama').value.trim(),hp:document.getElementById('f-hp').value.trim(),identitas:document.getElementById('f-id').value,tanggal,jam:document.getElementById('f-jam').value,durasi:document.getElementById('f-durasi').value,lokasi:document.getElementById('f-lokasi').value.trim(),warna:document.getElementById('f-warna').value,acara,papan,harga,ucapan:document.getElementById('f-ucapan').value.trim(),status:'Pending',createdAt:firebase.firestore.FieldValue.serverTimestamp(),createdAtText:new Date().toISOString()};
  const newOrder=ordersRef.doc();
  try{
    await db.runTransaction(async tx=>{
      const sd=await tx.get(stockRef), bd=await tx.get(blockedRef), ud=await tx.get(usageRef.doc(tanggal));
      const stock=sd.exists&&sd.data().items?{...DEFAULT_STOCK,...sd.data().items}:DEFAULT_STOCK;
      const blocked=bd.exists&&Array.isArray(bd.data().dates)?bd.data().dates:[];
      const counts=ud.exists&&ud.data().counts?ud.data().counts:{};
      if(blocked.includes(tanggal)) throw new Error('blocked');
      if((stock[papan]||0)-(counts[papan]||0)<=0) throw new Error('out');
      tx.set(newOrder,order);
      tx.set(usageRef.doc(tanggal),{counts:{...counts,[papan]:(counts[papan]||0)+1}},{merge:true});
    });
  }catch(e){ if(e.message==='blocked') toast('Tanggal ini sedang tidak tersedia.'); else if(e.message==='out') toast('Stok papan ini sudah habis di tanggal tersebut.'); else err(e); return; }
  document.getElementById('success-summary').innerHTML=`<div class="row"><span>Nama</span><span>${order.nama}</span></div><div class="row"><span>Tanggal</span><span>${formatDate(order.tanggal)} · ${order.jam}</span></div><div class="row"><span>Jenis</span><span>${order.papan} · ${order.acara}</span></div><div class="row"><span>Lokasi</span><span>${order.lokasi}</span></div><div class="row"><span>Durasi</span><span>${order.durasi}</span></div><div class="row"><span>Total Sewa</span><span>Rp ${order.harga.toLocaleString('id-ID')}</span></div><div class="row"><span>Min. DP (50%)</span><span style="color:var(--pink-deep)">Rp ${Math.ceil(order.harga*0.5).toLocaleString('id-ID')}</span></div>`;
  const waMessage = buildOrderWhatsAppMessage(order);
  const waLink = getWhatsAppLink(waMessage);
  const waBtn = document.getElementById('wa-success-btn');
  if(waBtn){
    waBtn.style.display='inline-flex';
    waBtn.onclick=()=>window.open(waLink,'_blank');
  }
  ['f-nama','f-hp','f-tgl','f-jam','f-lokasi','f-ucapan'].forEach(id=>document.getElementById(id).value='');
  ['f-id','f-durasi','f-warna','f-acara','f-papan'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('price-group').style.display='none'; showPage('sukses');
  setTimeout(()=>window.open(waLink,'_blank'), 350);
}

function renderAdmin(){
  const total=orders.length,pending=orders.filter(o=>o.status==='Pending').length,dp=orders.filter(o=>o.status==='DP').length,lunas=orders.filter(o=>o.status==='Lunas').length,revenue=orders.filter(o=>o.status!=='Batal').reduce((a,o)=>a+(Number(o.harga)||0),0);
  document.getElementById('stats-row').innerHTML=`<div class="stat-card"><div class="num">${total}</div><div class="lbl">Total Pesanan</div></div><div class="stat-card"><div class="num" style="color:#856404">${pending}</div><div class="lbl">Pending</div></div><div class="stat-card"><div class="num" style="color:#084298">${dp}</div><div class="lbl">Sudah DP</div></div><div class="stat-card"><div class="num" style="color:#0a3622">${lunas}</div><div class="lbl">Lunas</div></div><div class="stat-card"><div class="num" style="font-size:1.2rem;color:var(--pink-deep)">Rp ${(revenue/1000).toFixed(0)}rb</div><div class="lbl">Total Revenue</div></div>`;
  renderBlockedList(); renderStockInputs(); renderTable();
}
function renderTable(){
  const filter=document.getElementById('filter-status').value, filtered=filter?orders.filter(o=>o.status===filter):[...orders]; filtered.sort((a,b)=>orderMillis(b)-orderMillis(a));
  const tbody=document.getElementById('orders-tbody'); if(!filtered.length){tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">Belum ada pesanan</td></tr>';return;}
  tbody.innerHTML=filtered.map((o,i)=>`<tr><td>${i+1}</td><td><strong>${o.nama}</strong><br><span style="color:var(--muted);font-size:.75rem">${o.hp}</span></td><td>${formatDate(o.tanggal)}<br><span style="color:var(--muted);font-size:.75rem">${o.jam} · ${o.durasi}</span></td><td>${o.acara}</td><td>${o.papan}</td><td style="font-weight:600;color:var(--pink-deep)">Rp ${(Number(o.harga)||0).toLocaleString('id-ID')}</td><td><span class="badge badge-${String(o.status).toLowerCase().replace(' ','')}">${o.status}</span></td><td><div class="action-btns"><button class="action-btn confirm" onclick="viewOrder('${o.id}')">👁</button>${o.status==='Pending'?`<button class="action-btn dp" onclick="setStatus('${o.id}','DP')">DP</button>`:''}${o.status!=='Lunas'&&o.status!=='Batal'?`<button class="action-btn confirm" onclick="setStatus('${o.id}','Lunas')">Lunas</button>`:''}${o.status!=='Batal'?`<button class="action-btn cancel" onclick="setStatus('${o.id}','Batal')">Batal</button>`:''}<button class="action-btn delete" onclick="deleteOrder('${o.id}')">🗑</button></div></td></tr>`).join('');
}
async function adjustUsage(tx,tanggal,papan,delta){ if(!tanggal||!papan||!delta)return; const ref=usageRef.doc(tanggal), d=await tx.get(ref), counts=d.exists&&d.data().counts?d.data().counts:{}; counts[papan]=Math.max(0,(counts[papan]||0)+delta); tx.set(ref,{counts},{merge:true}); }
async function setStatus(id,status){ const old=orders.find(o=>o.id===id); if(!old)return; await db.runTransaction(async tx=>{ tx.update(ordersRef.doc(id),{status,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}); if(old.status!=='Batal'&&status==='Batal') await adjustUsage(tx,old.tanggal,old.papan,-1); if(old.status==='Batal'&&status!=='Batal') await adjustUsage(tx,old.tanggal,old.papan,1); }); toast('Status diubah ke '+status); }
async function deleteOrder(id){ if(!confirm('Hapus pesanan ini?'))return; const old=orders.find(o=>o.id===id); await db.runTransaction(async tx=>{ if(old&&old.status!=='Batal') await adjustUsage(tx,old.tanggal,old.papan,-1); tx.delete(ordersRef.doc(id)); }); toast('Pesanan dihapus'); }
function viewOrder(id){
  const o=orders.find(x=>x.id===id); if(!o)return;
  document.getElementById('modal-content').innerHTML=`<div class="detail-row"><span class="key">Nama</span><span class="val">${o.nama}</span></div><div class="detail-row"><span class="key">No. HP</span><span class="val">${o.hp}</span></div><div class="detail-row"><span class="key">Identitas</span><span class="val">${o.identitas}</span></div><div class="detail-row"><span class="key">Tanggal</span><span class="val">${formatDate(o.tanggal)} · ${o.jam}</span></div><div class="detail-row"><span class="key">Durasi</span><span class="val">${o.durasi}</span></div><div class="detail-row"><span class="key">Lokasi</span><span class="val">${o.lokasi}</span></div><div class="detail-row"><span class="key">Warna Bunga</span><span class="val">${o.warna}</span></div><div class="detail-row"><span class="key">Acara</span><span class="val">${o.acara}</span></div><div class="detail-row"><span class="key">Jenis Papan</span><span class="val">${o.papan}</span></div><div class="detail-row"><span class="key">Harga</span><span class="val" style="color:var(--pink-deep);font-weight:700">Rp ${(Number(o.harga)||0).toLocaleString('id-ID')}</span></div><div class="detail-row"><span class="key">Status</span><span class="val"><span class="badge badge-${String(o.status).toLowerCase()}">${o.status}</span></span></div><div class="detail-row"><span class="key">Ucapan</span><span class="val" style="white-space:pre-wrap">${o.ucapan}</span></div><div class="detail-row"><span class="key">Dipesan</span><span class="val">${createdLabel(o)}</span></div>`;
  document.getElementById('modal-actions').innerHTML=`${o.status==='Pending'?`<button class="action-btn dp" onclick="setStatus('${o.id}','DP');closeModal()">Konfirmasi DP</button>`:''}${o.status!=='Lunas'&&o.status!=='Batal'?`<button class="action-btn confirm" onclick="setStatus('${o.id}','Lunas');closeModal()">Tandai Lunas</button>`:''}`;
  document.getElementById('detail-modal').classList.add('active');
}
function closeModal(){document.getElementById('detail-modal').classList.remove('active');}
function renderBlockedList(){ const list=document.getElementById('blocked-list-display'); list.innerHTML=blockedDates.length?blockedDates.map(d=>`<div class="blocked-chip">${formatDate(d)} <button onclick="removeBlock('${d}')">×</button></div>`).join(''):'<span style="color:var(--muted);font-size:.82rem">Belum ada tanggal yang diblocked</span>'; }
function renderStockInputs(){ const row=document.getElementById('stock-input-row'); if(!row)return; row.innerHTML=PAPAN_TYPES.map(p=>`<div class="stock-input-item"><label>${p.icon} ${p.label}</label><div class="stock-ctrl"><button onclick="changeStock('${p.key}', -1)">−</button><span class="stock-val" id="sv-${p.key.replace(' ','-')}">${stockTotal[p.key]||0}</span><button onclick="changeStock('${p.key}', 1)">+</button></div></div>`).join(''); }
function changeStock(key,delta){ stockTotal[key]=Math.max(0,(stockTotal[key]||0)+delta); const el=document.getElementById('sv-'+key.replace(' ','-')); if(el)el.textContent=stockTotal[key]; }
async function saveStock(){ await stockRef.set({items:stockTotal,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); toast('Stok berhasil disimpan!'); }
async function addBlockedDate(){ const d=document.getElementById('block-date-input').value; if(!d){toast('Pilih tanggal dulu');return;} if(!blockedDates.includes(d)){ await blockedRef.set({dates:[...blockedDates,d].sort()},{merge:true}); toast(formatDate(d)+' sudah diblocked'); } else toast('Tanggal sudah diblocked'); document.getElementById('block-date-input').value=''; }
async function removeBlock(d){ await blockedRef.set({dates:blockedDates.filter(x=>x!==d)},{merge:true}); toast('Block dihapus: '+formatDate(d)); }
function exportCSV(){ if(!orders.length){toast('Belum ada pesanan');return;} const header=['ID','Nama','HP','Identitas','Tanggal','Jam','Durasi','Lokasi','Warna','Acara','Papan','Harga','Ucapan','Status','Dibuat']; const rows=orders.map(o=>[o.id,o.nama,o.hp,o.identitas,o.tanggal,o.jam,o.durasi,'"'+o.lokasi+'"',o.warna,o.acara,o.papan,o.harga,'"'+String(o.ucapan||'').replace(/"/g,"'")+'"',o.status,createdLabel(o)]); const csv=[header,...rows].map(r=>r.join(',')).join('\n'); const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv); a.download='velora_pesanan_'+new Date().toISOString().slice(0,10)+'.csv'; a.click(); toast('CSV berhasil diexport'); }
function copyText(text){ navigator.clipboard.writeText(text).catch(()=>{}); toast('Nomor '+text+' disalin!'); }

document.getElementById('admin-pass-input').addEventListener('keydown',e=>{if(e.key==='Enter')checkAdminLogin();});
document.getElementById('admin-email-input').addEventListener('keydown',e=>{if(e.key==='Enter')checkAdminLogin();});
startRealtimeData();
renderCalendar();



