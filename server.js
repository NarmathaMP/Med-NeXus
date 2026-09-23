/** MedNexus local API + persistent JSON database. Run: npm start */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = __dirname;
const dbFile = path.join(root, 'data', 'mednexus.json');

function readDb() {
  const empty = { patients: {}, hospitals: {}, cases: {}, accessRequests: {}, ambulanceRequests: {}, chats: {} };
  if (!fs.existsSync(dbFile)) return empty;
  return { ...empty, ...JSON.parse(fs.readFileSync(dbFile, 'utf8')) };
}
function writeDb(db) { fs.mkdirSync(path.dirname(dbFile), { recursive: true }); fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }
function id(prefix) { return `${prefix}_${crypto.randomUUID().slice(0, 8)}`; }
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); }
function body(req) { return new Promise((resolve, reject) => { let raw=''; req.on('data', c => raw += c); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); } }); }); }
function patientCase(db, patientId) { return db.cases[patientId] || { patientId, visits: [], prescriptions: [], reports: [] }; }
function hospitalCanEdit(db, patientId, hospitalId) { return Object.values(db.accessRequests).some(r => r.patientId === patientId && r.hospitalId === hospitalId && r.status === 'approved'); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`); const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (parts[0] === 'api') {
      const db = readDb(); const data = await (['POST','PUT','DELETE'].includes(req.method) ? body(req) : Promise.resolve({}));
      if (req.method === 'PUT' && parts[1] === 'patients' && parts[2]) { db.patients[parts[2]] = { ...(db.patients[parts[2]] || {}), ...data, patientId: parts[2] }; writeDb(db); return json(res,200,db.patients[parts[2]]); }
      if (req.method === 'DELETE' && parts[1] === 'patients' && parts[2]) { delete db.patients[parts[2]]; delete db.cases[parts[2]]; Object.keys(db.accessRequests).forEach(k=>{if(db.accessRequests[k].patientId===parts[2]) delete db.accessRequests[k];}); writeDb(db); return json(res,200,{deleted:true}); }
      if (req.method === 'PUT' && parts[1] === 'hospitals' && parts[2]) { db.hospitals[parts[2]] = { ...(db.hospitals[parts[2]] || {}), ...data, hospitalId: parts[2] }; writeDb(db); return json(res,200,db.hospitals[parts[2]]); }
      if (req.method === 'DELETE' && parts[1] === 'hospitals' && parts[2]) { delete db.hospitals[parts[2]]; writeDb(db); return json(res,200,{deleted:true}); }
      if (req.method === 'GET' && parts[1] === 'cases' && parts[2]) return json(res,200,{ case: patientCase(db,parts[2]), access: parts[3] ? hospitalCanEdit(db,parts[2],parts[3]) : true, patient: db.patients[parts[2]] || null });
      if (req.method === 'POST' && parts[1] === 'cases' && parts[2] && parts[3] === 'visits') { if(data.editorHospitalId && !hospitalCanEdit(db,parts[2],data.editorHospitalId)) return json(res,403,{error:'Patient consent is required'}); const c=patientCase(db,parts[2]); c.visits.push({id:id('visit'),...data,createdAt:new Date().toISOString()}); db.cases[parts[2]]=c; writeDb(db); return json(res,201,c); }
      if (req.method === 'POST' && parts[1] === 'cases' && parts[2] && (parts[3] === 'reports' || parts[3] === 'prescriptions')) { if(data.editorHospitalId && !hospitalCanEdit(db,parts[2],data.editorHospitalId)) return json(res,403,{error:'Patient consent is required'}); const c=patientCase(db,parts[2]); c[parts[3]].push({id:id(parts[3].slice(0,-1)),...data,createdAt:new Date().toISOString()}); db.cases[parts[2]]=c; writeDb(db); return json(res,201,c); }
      if (req.method === 'PUT' && parts[1] === 'cases' && parts[2] && parts[3] && parts[4]) { if(data.editorHospitalId && !hospitalCanEdit(db,parts[2],data.editorHospitalId)) return json(res,403,{error:'Patient consent is required'}); const c=patientCase(db,parts[2]); const item=(c[parts[3]]||[]).find(x=>x.id===parts[4]); if(!item) return json(res,404,{error:'Record not found'}); Object.assign(item,data,{updatedAt:new Date().toISOString()}); db.cases[parts[2]]=c; writeDb(db); return json(res,200,c); }
      if (req.method === 'DELETE' && parts[1] === 'cases' && parts[2] && parts[3] && parts[4]) { if(data.editorHospitalId && !hospitalCanEdit(db,parts[2],data.editorHospitalId)) return json(res,403,{error:'Patient consent is required'}); const c=patientCase(db,parts[2]); c[parts[3]]=(c[parts[3]]||[]).filter(x=>x.id!==parts[4]); db.cases[parts[2]]=c; writeDb(db); return json(res,200,c); }
      if (req.method === 'POST' && parts[1] === 'access-requests') { const key=id('access'); db.accessRequests[key]={id:key,...data,status:'pending',createdAt:new Date().toISOString()}; writeDb(db); return json(res,201,db.accessRequests[key]); }
      if (req.method === 'GET' && parts[1] === 'access-requests' && parts[2]) return json(res,200,Object.values(db.accessRequests).filter(r=>r.patientId===parts[2]));
      if (req.method === 'PUT' && parts[1] === 'access-requests' && parts[2]) { const r=db.accessRequests[parts[2]]; if(!r) return json(res,404,{error:'Request not found'}); r.status=data.status; r.updatedAt=new Date().toISOString(); writeDb(db); return json(res,200,r); }
      if (req.method === 'GET' && parts[1] === 'ambulance-requests') return json(res,200,Object.values(db.ambulanceRequests));
      if (req.method === 'POST' && parts[1] === 'ambulance-requests') { const key=id('ambulance'); db.ambulanceRequests[key]={id:key,...data,status:'Awaiting dispatch',createdAt:new Date().toISOString()}; writeDb(db); return json(res,201,db.ambulanceRequests[key]); }
      if (req.method === 'PUT' && parts[1] === 'ambulance-requests' && parts[2]) { const r=db.ambulanceRequests[parts[2]]; if(!r) return json(res,404,{error:'Request not found'}); Object.assign(r,data,{updatedAt:new Date().toISOString()}); writeDb(db); return json(res,200,r); }
      if (req.method === 'GET' && parts[1] === 'chats' && parts[2]) return json(res,200,db.chats[parts[2]] || []);
      if (req.method === 'POST' && parts[1] === 'chats' && parts[2]) { const message={id:id('msg'),...data,createdAt:new Date().toISOString()}; db.chats[parts[2]]=[...(db.chats[parts[2]] || []),message]; writeDb(db); return json(res,201,message); }
      return json(res,404,{error:'API route not found'});
    }
    let file = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const filePath = path.resolve(root,file); if (!filePath.startsWith(root) || !fs.existsSync(filePath)) { res.writeHead(404); return res.end('Not found'); }
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
    res.writeHead(200,{'Content-Type':types[path.extname(filePath)] || 'application/octet-stream'}); fs.createReadStream(filePath).pipe(res);
  } catch (error) { json(res,400,{error:error.message}); }
});
server.listen(process.env.PORT || 3000, () => console.log('MedNexus running at http://localhost:3000'));
