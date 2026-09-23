/* =====================================================================================
   STATE
===================================================================================== */
const SPECIALTIES = ['Cardiology','Orthopedics','Pediatrics','General','Neurology','ENT'];
const TIME_SLOTS = ['09:00 AM','10:30 AM','12:00 PM','02:00 PM','03:30 PM','05:00 PM'];

let state = {
  citizenUser: null,
  adminUser: null,
  activeHospitalId: null,
  activeSpecialtyFilter: null,
  citizenTab: 'search',
  adminTab: 'beds',
  ambuCondition: null,
  hospitals: [],
  appointments: [],
  ambulanceRequests: [],
  chat: [],
  caseData: null,
  hospitalCaseResult: null,
};

function uid(p){ return p + '_' + Math.random().toString(36).slice(2,9); }
function escapeHtml(s){ const d=document.createElement('div'); d.innerText=s==null?'':s; return d.innerHTML; }

function seedData(){
  state.hospitals = [
    { id:'h1', name:'City Care Hospital', area:'Anna Nagar', distanceKm:1.2, specialties:['Cardiology','General'],
      beds:{General:{total:40,available:14},ICU:{total:10,available:2}},
      doctors:[{id:uid('d'),name:'Dr. Kavya Iyer',role:'Cardiologist',status:'Available'},{id:uid('d'),name:'Dr. Ramesh Nair',role:'General Physician',status:'On Duty'}],
      staff:[{id:uid('s'),name:'Nurse Priya S.',role:'ICU Nurse',shift:'Day',status:'Available'}] },
    { id:'h2', name:'Sunrise Multispecialty', area:'T. Nagar', distanceKm:2.4, specialties:['Orthopedics','General'],
      beds:{General:{total:30,available:9},ICU:{total:6,available:1}},
      doctors:[{id:uid('d'),name:'Dr. Sana Fathima',role:'Orthopedic',status:'Available'}],
      staff:[{id:uid('s'),name:'Nurse Arjun T.',role:'OT Nurse',shift:'Day',status:'Off'}] },
    { id:'h3', name:'St. Mary General Hospital', area:'Adyar', distanceKm:3.1, specialties:['Pediatrics','General'],
      beds:{General:{total:25,available:11},ICU:{total:5,available:4}},
      doctors:[{id:uid('d'),name:'Dr. Anita George',role:'Pediatrician',status:'Available'}],
      staff:[{id:uid('s'),name:'Nurse Farhan Ali',role:'Ward Nurse',shift:'Night',status:'On Duty'}] },
    { id:'h4', name:'Sunshine Neuro Institute', area:'Velachery', distanceKm:4.6, specialties:['Neurology','ENT','General'],
      beds:{General:{total:35,available:3},ICU:{total:12,available:5}},
      doctors:[{id:uid('d'),name:'Dr. Vikram Rao',role:'Neurologist',status:'On Duty'}],
      staff:[{id:uid('s'),name:'Nurse Meera K.',role:'ICU Nurse',shift:'Night',status:'Available'}] },
  ];
  state.appointments = [];
  state.ambulanceRequests = [];
}
seedData();

/* =====================================================================================
   ROUTER
===================================================================================== */
function go(viewId){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+viewId).classList.add('active');
  window.scrollTo(0,0);
  renderNav();
  if(viewId==='citizenDash') renderCitizenDash();
  if(viewId==='adminDash') renderAdminDash();
  if(viewId==='bot') loadChatHistory();
}
function renderNav(){
  const el = document.getElementById('navRight');
  if(state.citizenUser){
    el.innerHTML = `<span class="nav-user">${escapeHtml(state.citizenUser.name)}</span><span class="role-chip">Citizen</span>
      <button class="nav-link-quiet" onclick="go('ambulance')">Ambulance</button>
      <button class="nav-link-quiet" onclick="go('bot')">Care Assistant</button>
      <button class="nav-pill" onclick="logoutCitizen()">Sign out</button>`;
  } else if(state.adminUser){
    el.innerHTML = `<span class="nav-user">${escapeHtml(state.adminUser.name)}</span><span class="role-chip">Admin</span>
      <button class="nav-pill" onclick="logoutAdmin()">Sign out</button>`;
  } else {
    el.innerHTML = `<button class="nav-link-quiet" onclick="go('citizenAuth')">Citizen sign in</button>
      <button class="nav-pill" onclick="go('adminAuth')">Admin sign in</button>`;
  }
}

/* live fluctuation across the app, simulating the shared real-time database */
setInterval(()=>{
  state.hospitals.forEach(h=>{
    Object.values(h.beds).forEach(b=>{
      const delta = Math.random() < 0.55 ? 0 : (Math.random()<0.5?-1:1);
      b.available = Math.max(0, Math.min(b.total, b.available + delta));
    });
  });
  if(document.getElementById('view-citizenDash').classList.contains('active') && state.citizenTab==='search') renderHospitalList();
  if(document.getElementById('view-hospitalDetail').classList.contains('active')) renderHospitalDetail(state.activeHospitalId);
}, 5000);

/* =====================================================================================
   TOASTS
===================================================================================== */
function toast(msg, kind){
  const stack = document.getElementById('toast-stack');
  const t = document.createElement('div');
  t.className = 'toast' + (kind==='amber'?' amber':'');
  t.textContent = msg;
  stack.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),300); }, 3600);
}

/* =====================================================================================
   CITIZEN AUTH
===================================================================================== */
let citizenAuthMode = 'login';
function setCitizenAuthMode(mode){
  citizenAuthMode = mode;
  document.getElementById('cAuthTabLogin').classList.toggle('on', mode==='login');
  document.getElementById('cAuthTabSignup').classList.toggle('on', mode==='signup');
  document.getElementById('cNameField').style.display = mode==='signup' ? 'block':'none';
  document.getElementById('cAuthTitle').textContent = mode==='signup' ? 'Create your account' : 'Welcome back';
  document.getElementById('cAuthSub').textContent = mode==='signup' ? 'Sign up to search hospitals and send requests.' : 'Sign in to search hospitals and manage your requests.';
  document.getElementById('cAuthSubmit').textContent = mode==='signup' ? 'Create account' : 'Sign in';
}
function submitCitizenAuth(e){
  e.preventDefault();
  const contact = document.getElementById('cContact').value.trim();
  const name = document.getElementById('cName').value.trim();
  const savedId = localStorage.getItem('mednexus_patient_' + contact.toLowerCase());
  const patientId = savedId || ('MN-P' + Math.random().toString(36).slice(2,8).toUpperCase());
  state.citizenUser = { name: (citizenAuthMode==='signup' && name) ? name : (contact.split('@')[0] || 'Citizen'), contact, patientId };
  localStorage.setItem('mednexus_patient_' + contact.toLowerCase(), patientId);
  api('/api/patients/' + patientId, 'PUT', state.citizenUser).catch(()=>toast('Local mode: start the server to persist records.', 'amber'));
  toast(citizenAuthMode==='signup' ? 'Account created. Welcome to MedNexus.' : 'Signed in successfully.');
  go('citizenDash');
}
function logoutCitizen(){ state.citizenUser=null; go('home'); }

/* =====================================================================================
   ADMIN AUTH
===================================================================================== */
let adminAuthMode = 'login';
function setAdminAuthMode(mode){
  adminAuthMode = mode;
  document.getElementById('aAuthTabLogin').classList.toggle('on', mode==='login');
  document.getElementById('aAuthTabSignup').classList.toggle('on', mode==='signup');
  document.getElementById('aNameField').style.display = mode==='signup' ? 'block':'none';
  document.getElementById('aRegField').style.display = mode==='signup' ? 'block':'none';
  document.getElementById('aAuthTitle').textContent = mode==='signup' ? 'Register your hospital' : 'Admin sign in';
  document.getElementById('aAuthSub').textContent = mode==='signup' ? 'Registration is checked against your license number before the portal unlocks.' : 'Only verified hospital admins can manage beds, staff and appointments.';
  document.getElementById('aAuthSubmit').textContent = mode==='signup' ? 'Register & verify' : 'Sign in';
}
function submitAdminAuth(e){
  e.preventDefault();
  const name = document.getElementById('aName').value.trim();
  const reg = document.getElementById('aReg').value.trim();
  const contact = document.getElementById('aContact').value.trim();
  if(adminAuthMode==='signup'){
    if(!reg){ toast('A registration / license number is required to verify your hospital.', 'amber'); return; }
    const h = { id:uid('h'), name: name || 'New Hospital', area:'Unspecified', distanceKm:0, specialties:['General'],
      beds:{General:{total:20,available:20},ICU:{total:5,available:5}}, doctors:[], staff:[] };
    state.hospitals.push(h);
    state.adminUser = { name: h.name, hospitalId: h.id, contact };
    toast('Hospital verified and registered. Portal unlocked.');
  } else {
    let h = state.hospitals.find(x=>x.name.toLowerCase()===name.toLowerCase()) || state.hospitals[0];
    state.adminUser = { name: h.name, hospitalId: h.id, contact };
    toast('Signed in as ' + h.name);
  }
  document.getElementById('adminDashName').textContent = state.adminUser.name;
  go('adminDash');
}
function logoutAdmin(){ state.adminUser=null; go('home'); }

/* =====================================================================================
   CITIZEN DASHBOARD — search & booking
===================================================================================== */
function setCitizenTab(tab){
  state.citizenTab = tab;
  document.querySelectorAll('.dash-tab').forEach(b=>b.classList.toggle('on', b.dataset.ctab===tab));
  document.getElementById('cTab-search').style.display = tab==='search' ? 'block':'none';
  ['search','appts','cases','profile'].forEach(t=>document.getElementById('cTab-'+t).style.display = tab===t ? 'block':'none');
  if(tab==='appts') renderMyAppointments();
  if(tab==='cases') renderPatientCaseTracker();
  if(tab==='profile') renderPatientProfile();
}
function renderCitizenDash(){
  document.getElementById('citizenGreeting').textContent = 'Hello, ' + (state.citizenUser ? state.citizenUser.name : 'Citizen');
  renderSpecialtyFilters();
  renderHospitalList();
  setCitizenTab(state.citizenTab);
}
function renderSpecialtyFilters(){
  const row = document.getElementById('specialtyFilters');
  row.innerHTML = SPECIALTIES.map(s=>`<button class="filter-chip ${state.activeSpecialtyFilter===s?'on':''}" onclick="toggleSpecialtyFilter('${s}')">${s}</button>`).join('');
}
function toggleSpecialtyFilter(s){
  state.activeSpecialtyFilter = state.activeSpecialtyFilter===s ? null : s;
  renderSpecialtyFilters();
  renderHospitalList();
}
function runSearch(term){ renderHospitalList(); }
function renderHospitalList(){
  const box = document.getElementById('hospitalList');
  const term = (document.getElementById('hospitalSearchInput').value || '').toLowerCase();
  let list = state.hospitals.filter(h=>{
    const mTerm = !term || h.name.toLowerCase().includes(term) || h.area.toLowerCase().includes(term) || h.specialties.some(s=>s.toLowerCase().includes(term));
    const mSpec = !state.activeSpecialtyFilter || h.specialties.includes(state.activeSpecialtyFilter);
    return mTerm && mSpec;
  }).sort((a,b)=>a.distanceKm-b.distanceKm);
  if(list.length===0){ box.innerHTML = `<div class="empty-state">No hospitals match that search. Try a different name, area, or specialty.</div>`; return; }
  box.innerHTML = list.map(h=>{
    const g = h.beds.General;
    const low = g.total ? (g.available/g.total) <= 0.15 : true;
    return `<div class="hosp-card">
      <div>
        <div class="hosp-name">${escapeHtml(h.name)}</div>
        <div class="hosp-meta">${h.specialties.join(', ')} &middot; ${h.distanceKm} km</div>
        <div class="hosp-avail ${low?'low':''}">${g.available>0 ? g.available+' beds available' : 'No general beds free'}</div>
      </div>
      <div class="hosp-meta">ICU: ${h.beds.ICU.available}/${h.beds.ICU.total} &middot; ${h.doctors.length} doctor${h.doctors.length===1?'':'s'} on record</div>
      <button class="btn btn-primary btn-sm" onclick="openHospitalDetail('${h.id}')">View &amp; book</button>
    </div>`;
  }).join('');
}

/* =====================================================================================
   HOSPITAL DETAIL
===================================================================================== */
function openHospitalDetail(id){ state.activeHospitalId = id; go('hospitalDetail'); renderHospitalDetail(id); }
function renderHospitalDetail(id){
  const h = state.hospitals.find(x=>x.id===id);
  if(!h) return;
  const box = document.getElementById('hospitalDetailContent');
  box.innerHTML = `
    <div class="detail-grid">
      <div>
        <div class="detail-panel">
          <h3>${escapeHtml(h.name)}</h3>
          <div class="hosp-meta">${escapeHtml(h.area)} &middot; ${h.distanceKm} km away &middot; ${h.specialties.join(', ')}</div>
          <table style="width:100%;margin-top:14px;border-collapse:collapse;">
            <thead><tr><th style="text-align:left;font-size:.75rem;opacity:.6;padding-bottom:8px;">Ward</th><th style="text-align:left;font-size:.75rem;opacity:.6;">Available</th><th style="text-align:left;font-size:.75rem;opacity:.6;">Total</th></tr></thead>
            <tbody>
              ${Object.entries(h.beds).map(([k,b])=>`<tr><td style="padding:8px 0;border-top:1px solid var(--line-soft);">${k}</td><td style="padding:8px 0;border-top:1px solid var(--line-soft);font-weight:700;color:${b.available===0?'var(--red)':'var(--ink-blue-deep)'}">${b.available}</td><td style="padding:8px 0;border-top:1px solid var(--line-soft);">${b.total}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="detail-panel">
          <h4 style="font-size:1.02rem;margin-bottom:8px;">Doctor profiles</h4>
          ${h.doctors.length ? h.doctors.map(d=>`<div class="doc-row"><span>${escapeHtml(d.name)} &middot; ${escapeHtml(d.role)}</span><span style="opacity:.6;">${d.status}</span></div>`).join('') : '<p style="opacity:.6;font-size:.85rem;">No doctors listed yet.</p>'}
        </div>
      </div>
      <div class="detail-panel">
        <h4 style="font-size:1.02rem;margin-bottom:6px;">Book an appointment</h4>
        <p style="font-size:.84rem;opacity:.65;margin-bottom:16px;">Availability is shown before booking. The hospital must approve before it's confirmed.</p>
        <button class="btn btn-amber btn-block" onclick="openApptModal('${h.id}')">Book appointment</button>
      </div>
    </div>`;
}

/* =====================================================================================
   APPOINTMENT BOOKING
===================================================================================== */
function openApptModal(hospitalId){
  if(!state.citizenUser){ toast('Please sign in as a citizen first.', 'amber'); go('citizenAuth'); return; }
  const h = state.hospitals.find(x=>x.id===hospitalId);
  document.getElementById('apptModalSub').textContent = h.name + ' — ' + h.area;
  document.getElementById('apptDept').innerHTML = h.specialties.map(s=>`<option>${s}</option>`).join('');
  document.getElementById('apptDoctor').innerHTML = (h.doctors.length ? h.doctors : [{name:'Any available doctor'}]).map(d=>`<option>${escapeHtml(d.name)}</option>`).join('');
  document.getElementById('apptTime').innerHTML = TIME_SLOTS.map(t=>`<option>${t}</option>`).join('');
  document.getElementById('apptForm').dataset.hospitalId = hospitalId;
  document.getElementById('apptModalBackdrop').classList.add('show');
}
function closeApptModal(){ document.getElementById('apptModalBackdrop').classList.remove('show'); }
function submitAppointment(e){
  e.preventDefault();
  const hospitalId = document.getElementById('apptForm').dataset.hospitalId;
  const h = state.hospitals.find(x=>x.id===hospitalId);
  state.appointments.push({
    id: uid('a'), hospitalId, hospitalName: h.name, patientName: state.citizenUser.name,
    dept: document.getElementById('apptDept').value, doctor: document.getElementById('apptDoctor').value,
    date: document.getElementById('apptDate').value, time: document.getElementById('apptTime').value,
    reason: document.getElementById('apptReason').value, status: 'Pending',
  });
  closeApptModal();
  toast('Appointment requested. Waiting on hospital approval.');
  document.getElementById('apptForm').reset();
  if(state.citizenTab==='appts') renderMyAppointments();
}
function renderMyAppointments(){
  const box = document.getElementById('myApptList');
  const mine = state.appointments.filter(a=> state.citizenUser && a.patientName === state.citizenUser.name);
  if(mine.length===0){ box.innerHTML = `<div class="empty-state">No appointments yet. Search a hospital and book one to see it here.</div>`; return; }
  box.innerHTML = mine.slice().reverse().map(a=>`
    <div class="appt-row">
      <div class="appt-info"><b>${escapeHtml(a.hospitalName)} &middot; ${a.dept}</b>
        <div class="sub">${escapeHtml(a.doctor)} &middot; ${a.date || 'Date TBD'} ${a.time || ''}</div></div>
      <span class="status-badge ${a.status.toLowerCase()}">${a.status==='Confirmed' ? 'Confirmed — tracked live' : a.status}</span>
    </div>`).join('');
}

/* =====================================================================================
   AMBULANCE
===================================================================================== */
const HIGH_RISK_WORDS = ['unconscious','not breathing','difficulty breathing','breathless','severe bleeding','seizure','chest pain','cardiac','stroke','unresponsive','ventilator'];
function setCondition(c){
  state.ambuCondition = c;
  document.getElementById('condNormalBtn').classList.toggle('on', c==='Normal');
  document.getElementById('condNormalBtn').classList.toggle('normal', c==='Normal');
  document.getElementById('condSeriousBtn').classList.toggle('on', c==='Serious');
  document.getElementById('condSeriousBtn').classList.toggle('serious', c==='Serious');
}
function runAmbulancePrediction(){
  const symptoms = (document.getElementById('ambuSymptoms').value || '').toLowerCase();
  const name = document.getElementById('ambuName').value.trim();
  if(!name){ toast('Enter the patient name first.', 'amber'); return; }
  if(!state.ambuCondition){ toast('Select Normal or Serious condition.', 'amber'); return; }
  const hits = HIGH_RISK_WORDS.filter(k=>symptoms.includes(k));
  const isVentilator = state.ambuCondition === 'Serious' || hits.length > 0;
  const confidence = Math.min(96, 55 + hits.length*13 + (state.ambuCondition==='Serious'?18:0));
  const panel = document.getElementById('ambuResultPanel');
  panel.innerHTML = `
    <div style="font-size:.8rem;opacity:.6;">Smart ambulance match</div>
    <div class="result-type ${isVentilator?'ventilator':'normal'}">${isVentilator ? 'Ventilator-support ambulance' : 'Normal ambulance'}</div>
    <div class="confidence-bar"><div class="${isVentilator?'hi':''}" style="width:${confidence}%"></div></div>
    <div style="font-size:.8rem;opacity:.6;margin-bottom:14px;">${confidence}% match to reported condition &amp; symptoms</div>
    <button class="btn ${isVentilator?'btn-amber':'btn-primary'} btn-block" onclick="dispatchAmbulance('${escapeHtml(name)}',${isVentilator})">Confirm request</button>
    <div class="mini-flow"><div><b>1.</b> Request captured</div><div><b>2.</b> Matched to ${isVentilator?'ventilator-support':'normal'}</div><div><b>3.</b> Syncing to admin…</div><div><b>4.</b> Awaiting dispatch</div></div>
  `;
}
function dispatchAmbulance(name, isVentilator){
  const request = { patientName:name, condition:state.ambuCondition, type:isVentilator?'Ventilator-support':'Normal', citizen: state.citizenUser ? state.citizenUser.name : name, patientId:state.citizenUser?.patientId || null };
  api('/api/ambulance-requests','POST',request).then(saved=>{state.ambulanceRequests.push(saved);toast('Request saved and synced to hospital admin. Awaiting dispatch confirmation.', 'amber');}).catch(()=>{state.ambulanceRequests.push({id:uid('r'),...request,status:'Awaiting dispatch'});toast('Request saved locally. Start the server to sync it.', 'amber');});
}
function directAmbulanceCall(){ toast('Connecting you directly to ambulance dispatch…', 'amber'); }

/* =====================================================================================
   CARE ASSISTANT BOT
===================================================================================== */
function botSeedGreeting(){
  addChatMsg('bot', "Hi, I'm the Care Assistant Bot. Tell me your symptom and how long it's lasted — I'll give safe, general self-care guidance. I never suggest medicines or dosages.");
}
function addChatMsg(who, text, save=true){
  state.chat.push({who, text});
  const log = document.getElementById('chatLog');
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  const patientId=state.citizenUser?.patientId;
  if(save && patientId) api('/api/chats/'+encodeURIComponent(patientId),'POST',{who,text}).catch(()=>{});
}
async function loadChatHistory(){
  const log=document.getElementById('chatLog'); const patientId=state.citizenUser?.patientId;
  if(!patientId){ if(state.chat.length===0)botSeedGreeting(); return; }
  try { const history=await api('/api/chats/'+encodeURIComponent(patientId)); state.chat=[];log.innerHTML=''; history.forEach(m=>addChatMsg(m.who,m.text,false)); if(history.length===0)botSeedGreeting(); }
  catch(e){if(state.chat.length===0)botSeedGreeting();}
}
function sendChat(){
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if(!text) return;
  addChatMsg('user', text);
  input.value = '';
  setTimeout(()=>{ const reply = botReply(text); addChatMsg('bot', reply); speak(reply); }, 300);
}
function botReply(text){
  const t = text.toLowerCase();
  const dayMatch = t.match(/(\d+)\s*day/);
  const days = dayMatch ? parseInt(dayMatch[1],10) : null;
  const highRisk = ['unconscious','severe',"can't breathe",'cannot breathe','chest pain','bleeding heavily','seizure'];
  if(highRisk.some(k=>t.includes(k))) return "That sounds serious and shouldn't wait on home care. Please use Ambulance Booking right away or go to the nearest hospital.";
  if(days !== null && days >= 3) return `Since it's crossed ${days} days, please visit a doctor. Based on your location, the nearest hospital is City Care, 1.2 km away 📍`;
  if(t.includes('cold')) return "That's under 3 days. Avoid cold water and ice cream, rest well and stay hydrated. Let me know if it's still there after day 3.";
  if(t.includes('fever')) return "For a mild fever: rest, fluids, and a light diet, and keep the room cool. If it crosses 3 days or feels very high, please visit a hospital — I can't advise on medicines.";
  if(t.includes('cough') || t.includes('sore throat')) return "Warm fluids and steam inhalation usually help with a mild cough. If it continues past 3 days or breathing feels tight, please book a hospital visit.";
  if(t.includes('headache')) return "Try resting in a dim, quiet room and staying hydrated. If it's sudden, very severe, or lasts past 3 days, that's worth a hospital visit.";
  if(t.includes('stomach') || t.includes('vomit')) return "Small sips of water or ORS and bland food can help. If it lasts beyond 3 days or there's severe pain, please see a hospital.";
  return "Thanks for sharing that. Let me know how many days it's been so I can advise better — and if anything feels serious, please use Ambulance Booking instead of waiting.";
}
let recognition = null, listening = false;
function initRecognition(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return null;
  const r = new SR();
  r.lang = 'en-IN'; r.interimResults = false; r.maxAlternatives = 1;
  r.onresult = (e)=>{ document.getElementById('chatInput').value = e.results[0][0].transcript; sendChat(); };
  r.onend = ()=>{ listening=false; document.getElementById('micBtn').classList.remove('listening'); };
  return r;
}
function toggleMic(){
  if(!recognition) recognition = initRecognition();
  if(!recognition){ toast('Voice input is not supported in this browser.', 'amber'); return; }
  if(listening){ recognition.stop(); listening=false; document.getElementById('micBtn').classList.remove('listening'); return; }
  try{ recognition.start(); listening=true; document.getElementById('micBtn').classList.add('listening'); } catch(err){}
}
function speak(text){
  if(!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-IN'; u.rate = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/* =====================================================================================
   ADMIN DASHBOARD
===================================================================================== */
function setAdminTab(tab){
  state.adminTab = tab;
  document.querySelectorAll('.hdash-tab').forEach(b=>b.classList.toggle('on', b.dataset.atab===tab));
  ['beds','staff','appts','ambulance','reports','cases','profile'].forEach(t=>{ document.getElementById('aTab-'+t).style.display = (t===tab) ? 'block':'none'; });
  renderAdminTabContent();
}
function currentHospital(){ return state.hospitals.find(h=>h.id === state.adminUser.hospitalId); }
function renderAdminDash(){ document.getElementById('adminDashName').textContent = state.adminUser.name; setAdminTab(state.adminTab); loadAmbulanceRequests(); }
async function loadAmbulanceRequests(){ try { state.ambulanceRequests=await api('/api/ambulance-requests'); if(state.adminTab==='ambulance')renderAmbulanceTab(currentHospital()); } catch(e){} }
function renderAdminTabContent(){
  const h = currentHospital();
  if(state.adminTab==='beds') renderBedsTab(h);
  if(state.adminTab==='staff') renderStaffTab(h);
  if(state.adminTab==='appts') renderApptsTab(h);
  if(state.adminTab==='ambulance') renderAmbulanceTab(h);
  if(state.adminTab==='reports') renderReportsTab(h);
  if(state.adminTab==='cases') renderHospitalCaseTracker(h);
  if(state.adminTab==='profile') renderHospitalProfile(h);
}

function renderBedsTab(h){
  const box = document.getElementById('aTab-beds');
  box.innerHTML = `
    <div class="section-head"><h3 style="font-size:1.15rem;">Bed availability by ward</h3></div>
    <table class="data-table">
      <thead><tr><th>Ward</th><th>Available</th><th>Total capacity</th><th></th></tr></thead>
      <tbody>
        ${Object.entries(h.beds).map(([ward,b])=>`
          <tr>
            <td>${ward}</td>
            <td><input type="number" min="0" value="${b.available}" onchange="updateBed('${ward}','available',this.value)" /></td>
            <td><input type="number" min="0" value="${b.total}" onchange="updateBed('${ward}','total',this.value)" /></td>
            <td class="row-actions">${!['General','ICU'].includes(ward) ? `<button class="icon-btn danger" onclick="deleteWard('${ward}')">Delete</button>` : ''}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="add-inline">
      <div><label style="font-size:.74rem;opacity:.6;">New ward name</label><input id="newWardName" placeholder="e.g. Maternity" /></div>
      <div><label style="font-size:.74rem;opacity:.6;">Total beds</label><input id="newWardTotal" type="number" min="0" value="10" /></div>
      <button class="btn btn-primary btn-sm" onclick="addWard()">Add ward</button>
    </div>`;
}
function updateBed(ward, field, val){
  const h = currentHospital(); val = Math.max(0, parseInt(val,10) || 0);
  h.beds[ward][field] = val;
  if(field==='total' && h.beds[ward].available > val) h.beds[ward].available = val;
  toast('Bed record updated.');
}
function addWard(){
  const h = currentHospital();
  const name = document.getElementById('newWardName').value.trim();
  const total = Math.max(0, parseInt(document.getElementById('newWardTotal').value,10) || 0);
  if(!name){ toast('Enter a ward name first.', 'amber'); return; }
  h.beds[name] = { total, available: total };
  renderBedsTab(h); toast('Ward added.');
}
function deleteWard(ward){ const h = currentHospital(); delete h.beds[ward]; renderBedsTab(h); toast('Ward removed.'); }

function renderStaffTab(h){
  const box = document.getElementById('aTab-staff');
  box.innerHTML = `
    <div class="section-head"><h3 style="font-size:1.15rem;">Staff roster</h3></div>
    <table class="data-table">
      <thead><tr><th>Name</th><th>Role</th><th>Shift</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${h.staff.map(s=>`
          <tr>
            <td><input value="${escapeHtml(s.name)}" onchange="updateStaff('${s.id}','name',this.value)" /></td>
            <td><input value="${escapeHtml(s.role)}" onchange="updateStaff('${s.id}','role',this.value)" /></td>
            <td><select onchange="updateStaff('${s.id}','shift',this.value)"><option ${s.shift==='Day'?'selected':''}>Day</option><option ${s.shift==='Night'?'selected':''}>Night</option></select></td>
            <td><select onchange="updateStaff('${s.id}','status',this.value)"><option ${s.status==='Available'?'selected':''}>Available</option><option ${s.status==='On Duty'?'selected':''}>On Duty</option><option ${s.status==='Off'?'selected':''}>Off</option></select></td>
            <td><button class="icon-btn danger" onclick="deleteStaff('${s.id}')">Delete</button></td>
          </tr>`).join('') || `<tr><td colspan="5" style="opacity:.6;">No staff added yet.</td></tr>`}
      </tbody>
    </table>
    <div class="add-inline">
      <div><label style="font-size:.74rem;opacity:.6;">Name</label><input id="newStaffName" placeholder="Name" /></div>
      <div><label style="font-size:.74rem;opacity:.6;">Role</label><input id="newStaffRole" placeholder="Role" /></div>
      <div><label style="font-size:.74rem;opacity:.6;">Shift</label><select id="newStaffShift"><option>Day</option><option>Night</option></select></div>
      <button class="btn btn-primary btn-sm" onclick="addStaff()">Add staff</button>
    </div>`;
}
function updateStaff(id, field, val){ const h = currentHospital(); const s = h.staff.find(x=>x.id===id); s[field] = val; toast('Staff record updated.'); }
function addStaff(){
  const h = currentHospital();
  const name = document.getElementById('newStaffName').value.trim();
  const role = document.getElementById('newStaffRole').value.trim();
  const shift = document.getElementById('newStaffShift').value;
  if(!name || !role){ toast('Enter both name and role.', 'amber'); return; }
  h.staff.push({id:uid('s'), name, role, shift, status:'Available'});
  renderStaffTab(h); toast('Staff added.');
}
function deleteStaff(id){ const h = currentHospital(); h.staff = h.staff.filter(s=>s.id!==id); renderStaffTab(h); toast('Staff removed.'); }

function renderApptsTab(h){
  const box = document.getElementById('aTab-appts');
  const list = state.appointments.filter(a=>a.hospitalId===h.id);
  box.innerHTML = `
    <div class="section-head"><h3 style="font-size:1.15rem;">Incoming appointment requests</h3></div>
    ${list.length===0 ? '<div class="empty-state">No appointment requests yet.</div>' : `
    <div class="appt-list">
      ${list.slice().reverse().map(a=>`
        <div class="appt-row">
          <div class="appt-info"><b>${escapeHtml(a.patientName)} &middot; ${a.dept}</b><div class="sub">${escapeHtml(a.doctor)} &middot; ${a.date||'Date TBD'} ${a.time||''}</div></div>
          <div class="row-actions" style="align-items:center;">
            <span class="status-badge ${a.status.toLowerCase()}">${a.status}</span>
            ${a.status==='Pending' ? `<button class="icon-btn" onclick="setApptStatus('${a.id}','Confirmed')">Accept</button><button class="icon-btn" onclick="setApptStatus('${a.id}','Rescheduled')">Reschedule</button><button class="icon-btn danger" onclick="setApptStatus('${a.id}','Rejected')">Reject</button>` : ''}
          </div>
        </div>`).join('')}
    </div>`}`;
}
function setApptStatus(id, status){
  const a = state.appointments.find(x=>x.id===id); a.status = status;
  renderApptsTab(currentHospital());
  toast(status==='Confirmed' ? 'Appointment accepted. Confirmation sent to citizen.' : status+'.', status==='Rejected'?'amber':null);
}

function renderAmbulanceTab(h){
  const box = document.getElementById('aTab-ambulance');
  box.innerHTML = `
    <div class="section-head"><h3 style="font-size:1.15rem;">Ambulance requests synced from citizens</h3></div>
    ${state.ambulanceRequests.length===0 ? '<div class="empty-state">No ambulance requests yet.</div>' : `
    <div class="appt-list">
      ${state.ambulanceRequests.slice().reverse().map(r=>`
        <div class="appt-row">
          <div class="appt-info"><b>${escapeHtml(r.patientName)} &middot; ${r.type}</b><div class="sub">Condition: ${r.condition} &middot; requested by ${escapeHtml(r.citizen)}</div></div>
          <div class="row-actions" style="align-items:center;">
            <span class="status-badge ${r.status==='Dispatched'?'confirmed':'pending'}">${r.status}</span>
            ${r.status!=='Dispatched' ? `<button class="icon-btn" onclick="dispatchFromAdmin('${r.id}')">Confirm dispatch</button>` : ''}
          </div>
        </div>`).join('')}
    </div>`}`;
}
function dispatchFromAdmin(id){
  const r = state.ambulanceRequests.find(x=>x.id===id); r.status = 'Dispatched';
  api('/api/ambulance-requests/'+id,'PUT',{status:'Dispatched'}).catch(()=>{});
  renderAmbulanceTab(currentHospital()); toast('Ambulance dispatched. Citizen notified.');
}

function renderReportsTab(h){
  const box = document.getElementById('aTab-reports');
  const totalBeds = Object.values(h.beds).reduce((s,b)=>s+b.total,0);
  const availBeds = Object.values(h.beds).reduce((s,b)=>s+b.available,0);
  const occupancyPct = totalBeds ? Math.round(((totalBeds-availBeds)/totalBeds)*100) : 0;
  const pendingAppts = state.appointments.filter(a=>a.hospitalId===h.id && a.status==='Pending').length;
  const inflow = [12,18,15,22,19,26,21];
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const maxInflow = Math.max(...inflow);
  box.innerHTML = `
    <div class="kpi-row">
      <div class="kpi-card"><span class="lbl">Occupancy rate</span><span class="val">${occupancyPct}%</span></div>
      <div class="kpi-card"><span class="lbl">Beds available now</span><span class="val">${availBeds}/${totalBeds}</span></div>
      <div class="kpi-card"><span class="lbl">Pending appointments</span><span class="val">${pendingAppts}</span></div>
      <div class="kpi-card"><span class="lbl">Ambulance requests today</span><span class="val ${state.ambulanceRequests.length>2?'alert':''}">${state.ambulanceRequests.length}</span></div>
    </div>
    <div class="bar-chart">
      <h4>Daily patient inflow (last 7 days)</h4>
      <div class="bars">
        ${inflow.map((v,i)=>`<div class="bar-col"><div class="bar" style="height:${(v/maxInflow*100)}%"></div><span class="lbl">${days[i]}</span></div>`).join('')}
      </div>
    </div>
    <div class="bar-chart">
      <h4>Emergency alerts</h4>
      <div class="alert-list">
        ${occupancyPct>=85 ? `<div class="alert-row"><span>ICU occupancy is above 85% — consider redirecting non-critical admissions.</span></div>` : ''}
        ${availBeds===0 ? `<div class="alert-row"><span>No general beds available — new appointment requests may need to be rescheduled.</span></div>` : ''}
        ${(occupancyPct<85 && availBeds>0) ? `<div style="font-size:.85rem;opacity:.55;">No active alerts. Capacity is within normal range.</div>` : ''}
      </div>
    </div>`;
}

/* =====================================================================================
   CASE TRACKER + CONSENT + PROFILES (persistent API)
===================================================================================== */
async function api(path, method='GET', data){
  const response = await fetch(path,{method,headers:{'Content-Type':'application/json'},body:data ? JSON.stringify(data) : undefined});
  if(!response.ok) throw new Error((await response.json()).error || 'Request failed');
  return response.json();
}
function recordForm(kind, patientId, actorHospitalId='', record=null){
  const key=`${kind}:${record?.id || 'new'}:${patientId}`; const isVisit=kind==='visits';
  return `<div class="case-form" id="caseForm-${key.replace(/[^a-zA-Z0-9]/g,'_')}"><div class="case-form-grid">${isVisit?`<div class="field"><label>Hospital name</label><input data-case="hospital" value="${escapeHtml(record?.hospital || (actorHospitalId?currentHospital().name:''))}" placeholder="Hospital name"></div><div class="field"><label>Date</label><input data-case="date" type="date" value="${escapeHtml(record?.date || new Date().toISOString().slice(0,10))}"></div><div class="field case-form-full"><label>Reason / case note</label><textarea data-case="reason" rows="3" placeholder="Reason for visit or case details">${escapeHtml(record?.reason || '')}</textarea></div>`:`<div class="field"><label>${kind==='reports'?'Report name':'Prescription name'}</label><input data-case="title" value="${escapeHtml(record?.title || '')}" placeholder="e.g. Blood test report"></div><div class="field"><label>Date</label><input data-case="date" type="date" value="${escapeHtml(record?.date || new Date().toISOString().slice(0,10))}"></div><div class="field case-form-full"><label>Upload ${kind==='reports'?'report':'prescription'}</label><input data-case="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"><div class="field-hint">${record?.fileName ? 'Current file: '+escapeHtml(record.fileName) : 'PDF, image, or document'}</div></div><div class="field case-form-full"><label>Notes</label><textarea data-case="details" rows="2" placeholder="Optional notes">${escapeHtml(record?.details || '')}</textarea></div>`}</div><div class="row-actions"><button class="btn btn-primary btn-sm" onclick="saveCaseRecord('${kind}','${patientId}','${record?.id || ''}','${actorHospitalId}')">${record?'Update':'Save'}</button><button class="icon-btn" onclick="cancelCaseForm()">Cancel</button></div></div>`;
}
function caseRecords(title, records, kind, editable, patientId, actorHospitalId=''){
  const newKey=`${kind}:new:${patientId}`; const showNew=state.caseForm===newKey;
  return `<section class="case-section"><div class="section-head"><h3>${title}</h3>${editable?`<button class="btn btn-primary btn-sm" onclick="showCaseForm('${newKey}')">Add ${kind==='visits'?'case':kind.slice(0,-1)}</button>`:''}</div>${showNew?recordForm(kind,patientId,actorHospitalId):''}${records.length?records.slice().reverse().map(r=>{const editKey=`${kind}:${r.id}:${patientId}`;return `<div class="case-record"><div><b>${escapeHtml(r.title || r.hospital || 'Record')}</b><div class="sub">${escapeHtml(r.date || '')}${r.reason?' · '+escapeHtml(r.reason):''}${r.details?' · '+escapeHtml(r.details):''}${r.fileName?' · File: '+escapeHtml(r.fileName):''}</div></div><div class="row-actions">${r.fileData?`<button class="icon-btn" onclick="openCaseFile('${kind}','${r.id}')">Open file</button>`:''}${editable?`<button class="icon-btn" onclick="showCaseForm('${editKey}')">Edit</button><button class="icon-btn danger" onclick="deleteCaseRecord('${kind}','${r.id}','${patientId}','${actorHospitalId}')">Delete</button>`:''}</div></div>${state.caseForm===editKey?recordForm(kind,patientId,actorHospitalId,r):''}`}).join(''):`<p class="case-empty">No ${title.toLowerCase()} added yet.</p>`}</section>`;
}
async function renderPatientCaseTracker(){
  const box=document.getElementById('cTab-cases'), p=state.citizenUser;
  if(!p) return; box.innerHTML='<div class="empty-state">Loading your secure health record…</div>';
  try { const result=await api('/api/cases/'+encodeURIComponent(p.patientId)); state.caseData=result.case; const requests=await api('/api/access-requests/'+encodeURIComponent(p.patientId));
    box.innerHTML=`<div class="tracker-hero"><div><span class="tag">YOUR UNIQUE PATIENT ID</span><h3>${escapeHtml(p.patientId)}</h3><p>Share this ID with a hospital only when you want them to request access. You approve every edit.</p></div><button class="btn btn-ghost btn-sm" onclick="navigator.clipboard?.writeText('${p.patientId}');toast('Patient ID copied.')">Copy ID</button></div>${caseRecords('Hospital visits',result.case.visits,'visits',true,p.patientId)}${caseRecords('Prescriptions',result.case.prescriptions,'prescriptions',true,p.patientId)}${caseRecords('Reports',result.case.reports,'reports',true,p.patientId)}<section class="case-section"><div class="section-head"><h3>Hospital access requests</h3></div>${requests.length?requests.map(r=>`<div class="case-record"><div><b>${escapeHtml(r.hospitalName || 'Hospital')}</b><div class="sub">Requested ${new Date(r.createdAt).toLocaleDateString()} · <span class="access-${r.status}">${r.status}</span></div></div>${r.status==='pending'?`<div class="row-actions"><button class="icon-btn" onclick="respondAccess('${r.id}','approved')">Allow access</button><button class="icon-btn danger" onclick="respondAccess('${r.id}','denied')">Decline</button></div>`:''}</div>`).join(''):'<p class="case-empty">No hospital access requests.</p>'}</section>`;
  } catch(e) { box.innerHTML='<div class="empty-state">Case tracker needs the MedNexus server. Run <b>npm start</b>, then open localhost:3000.</div>'; }
}
function showCaseForm(key){state.caseForm=key; refreshCaseView();} function cancelCaseForm(){state.caseForm=null;refreshCaseView();}
function refreshCaseView(){if(state.citizenTab==='cases')renderPatientCaseTracker();else if(state.adminTab==='cases')renderHospitalCaseTracker(currentHospital());}
function openCaseFile(kind,id){const c=state.citizenTab==='cases'?state.caseData:state.hospitalCaseResult?.case;const record=c?.[kind]?.find(x=>x.id===id);if(record?.fileData)window.open(record.fileData,'_blank');}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{if(!file)return resolve(undefined);const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});}
async function saveCaseRecord(kind,patientId,id,actorHospitalId){const f=document.querySelector(`[id^="caseForm-"]`);if(!f)return;const get=n=>f.querySelector(`[data-case="${n}"]`)?.value.trim()||'';const file=f.querySelector('[data-case="file"]')?.files[0];let payload=kind==='visits'?{hospital:get('hospital'),date:get('date'),reason:get('reason')}:{title:get('title'),date:get('date'),details:get('details'),fileName:file?.name||undefined,fileData:await fileToDataUrl(file)};if(actorHospitalId)payload.editorHospitalId=actorHospitalId;if(kind==='visits'&&(!payload.hospital||!payload.date)){toast('Enter hospital name and date.','amber');return;}if(kind!=='visits'&&!payload.title){toast('Enter a document name.','amber');return;}await api('/api/cases/'+encodeURIComponent(patientId)+'/'+kind+(id?'/'+id:''),id?'PUT':'POST',payload);state.caseForm=null;toast(id?'Record updated.':'Record added.');if(actorHospitalId)searchPatientCase();else renderPatientCaseTracker();}
async function deleteCaseRecord(kind,id,patientId,actorHospitalId=''){const payload=actorHospitalId?{editorHospitalId:actorHospitalId}:undefined;await api('/api/cases/'+encodeURIComponent(patientId)+'/'+kind+'/'+id,'DELETE',payload);toast('Record deleted.');if(actorHospitalId)searchPatientCase();else renderPatientCaseTracker();}
async function respondAccess(id,status){ await api('/api/access-requests/'+id,'PUT',{status}); toast(status==='approved'?'Hospital access granted.':'Access request declined.'); renderPatientCaseTracker(); }
function renderPatientProfile(){ const p=state.citizenUser; document.getElementById('cTab-profile').innerHTML=`<div class="profile-card"><h3>Patient profile</h3><p class="sub">Keep your identity and contact details accurate.</p><div class="profile-grid"><div class="field"><label>Full name</label><input id="profilePatientName" value="${escapeHtml(p.name)}"></div><div class="field"><label>Contact</label><input id="profilePatientContact" value="${escapeHtml(p.contact)}"></div></div><p class="patient-id-line">Patient ID: <b>${escapeHtml(p.patientId)}</b></p><div class="row-actions"><button class="btn btn-primary" onclick="savePatientProfile()">Save changes</button><button class="icon-btn danger" onclick="deletePatientProfile()">Delete profile</button></div></div>`; }
async function savePatientProfile(){ const p=state.citizenUser;p.name=document.getElementById('profilePatientName').value.trim()||p.name;p.contact=document.getElementById('profilePatientContact').value.trim()||p.contact;await api('/api/patients/'+p.patientId,'PUT',p);toast('Profile saved.');renderNav(); }
async function deletePatientProfile(){if(!confirm('This permanently deletes your profile and case records. Continue?'))return;await api('/api/patients/'+state.citizenUser.patientId,'DELETE');localStorage.removeItem('mednexus_patient_'+state.citizenUser.contact.toLowerCase());toast('Profile deleted.');logoutCitizen();}

function renderHospitalCaseTracker(h){ const box=document.getElementById('aTab-cases'); const found=state.hospitalCaseResult; box.innerHTML=`<div class="case-search"><h3>Patient case tracker</h3><p class="sub">Search by the patient's unique MedNexus ID. Editing is enabled only after the patient grants your hospital access.</p><div class="search-row"><input id="casePatientId" placeholder="e.g. MN-PABC123" value="${found?escapeHtml(found.patientId):''}"><button class="btn btn-primary" onclick="searchPatientCase()">Search patient</button></div></div>${found?renderHospitalCaseResult(found,h):''}`; }
function renderHospitalCaseResult(result,h){const c=result.case;const canEdit=result.access;return `<div class="tracker-hero"><div><span class="tag">PATIENT CASE</span><h3>${escapeHtml(result.patient?.name || 'Patient')} · ${escapeHtml(result.patientId)}</h3><p>${canEdit?'Access granted — you can add, edit, update, and delete this patient case.':'Access is not granted. Request patient consent to view and edit records.'}</p></div>${canEdit?'':`<button class="btn btn-amber btn-sm" onclick="requestCaseAccess('${result.patientId}')">Request access</button>`}</div>${caseRecords('Hospital visits',c.visits,'visits',canEdit,result.patientId,canEdit?h.id:'')}${caseRecords('Prescriptions',c.prescriptions,'prescriptions',canEdit,result.patientId,canEdit?h.id:'')}${caseRecords('Reports',c.reports,'reports',canEdit,result.patientId,canEdit?h.id:'')}`;}
async function searchPatientCase(){const patientId=document.getElementById('casePatientId').value.trim().toUpperCase();if(!patientId)return;try{const r=await api('/api/cases/'+encodeURIComponent(patientId)+'/'+state.adminUser.hospitalId);if(!r.patient){toast('No patient found for that ID.','amber');return;}state.hospitalCaseResult={...r,patientId};renderHospitalCaseTracker(currentHospital());}catch(e){toast('Could not find this patient.','amber');}}
async function requestCaseAccess(patientId){const h=currentHospital();await api('/api/access-requests','POST',{patientId,hospitalId:h.id,hospitalName:h.name});toast('Consent request sent to the patient.');renderHospitalCaseTracker(h);}
function renderHospitalProfile(h){document.getElementById('aTab-profile').innerHTML=`<div class="profile-card"><h3>Hospital profile</h3><p class="sub">Update the public details shown to patients.</p><div class="profile-grid"><div class="field"><label>Hospital name</label><input id="hospitalProfileName" value="${escapeHtml(h.name)}"></div><div class="field"><label>Area</label><input id="hospitalProfileArea" value="${escapeHtml(h.area)}"></div><div class="field"><label>Specialties (comma separated)</label><input id="hospitalProfileSpecialties" value="${escapeHtml(h.specialties.join(', '))}"></div></div><div class="row-actions"><button class="btn btn-primary" onclick="saveHospitalProfile()">Save changes</button><button class="icon-btn danger" onclick="deleteHospitalProfile()">Delete hospital profile</button></div></div>`;}
async function saveHospitalProfile(){const h=currentHospital();h.name=document.getElementById('hospitalProfileName').value.trim()||h.name;h.area=document.getElementById('hospitalProfileArea').value.trim()||h.area;h.specialties=document.getElementById('hospitalProfileSpecialties').value.split(',').map(x=>x.trim()).filter(Boolean);await api('/api/hospitals/'+h.id,'PUT',h);state.adminUser.name=h.name;toast('Hospital profile saved.');renderAdminDash();renderNav();}
async function deleteHospitalProfile(){if(!confirm('Delete this hospital profile?'))return;const h=currentHospital();await api('/api/hospitals/'+h.id,'DELETE');state.hospitals=state.hospitals.filter(x=>x.id!==h.id);toast('Hospital profile deleted.');logoutAdmin();}

/* =====================================================================================
   INIT
===================================================================================== */
renderNav();
go('home');
