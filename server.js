const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://192.168.1.34:11434';
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || '/data/certai';
const JWT_SECRET = process.env.JWT_SECRET || 'certai-secret-change-me';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

[DATA_DIR,
 path.join(DATA_DIR,'uploads'),
 path.join(DATA_DIR,'certs'),
 path.join(DATA_DIR,'users'),
 path.join(DATA_DIR,'logos')
].forEach(d=>{ if(!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true}); });

// Load persisted config (API keys etc)
try {
  const configFile = path.join(DATA_DIR, 'config.json');
  if (fs.existsSync(configFile)) {
    const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (cfg.openAIKey) { process.env._OPENAI_KEY_PERSISTED = cfg.openAIKey; }
  }
} catch(e) {}

const storage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null, file.fieldname==='logo'?path.join(DATA_DIR,'logos'):path.join(DATA_DIR,'uploads')),
  filename:(req,file,cb)=>cb(null,Date.now()+'-'+Math.round(Math.random()*1e6)+path.extname(file.originalname))
});
const upload = multer({storage,limits:{fileSize:20*1024*1024}});

app.use(cors());
app.use(express.json({limit:'25mb'}));
app.use(express.static(path.join(__dirname,'public')));
app.use('/uploads',express.static(path.join(DATA_DIR,'uploads')));
app.use('/logos',express.static(path.join(DATA_DIR,'logos')));
app.use('/docs',express.static(path.join(__dirname,'docs')));

function signToken(payload){
  const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const b=Buffer.from(JSON.stringify({...payload,iat:Date.now(),exp:Date.now()+7*24*60*60*1000})).toString('base64url');
  const s=crypto.createHmac('sha256',JWT_SECRET).update(h+'.'+b).digest('base64url');
  return h+'.'+b+'.'+s;
}
function verifyToken(token){
  try{
    const[h,b,s]=token.split('.');
    const exp=crypto.createHmac('sha256',JWT_SECRET).update(h+'.'+b).digest('base64url');
    if(s!==exp)return null;
    const p=JSON.parse(Buffer.from(b,'base64url').toString());
    return p.exp<Date.now()?null:p;
  }catch{return null;}
}
function hashPw(pw){return crypto.createHmac('sha256',JWT_SECRET).update(pw).digest('hex');}

function auth(req,res,next){
  const a=req.headers.authorization;
  if(!a||!a.startsWith('Bearer '))return res.status(401).json({error:'Unauthorized'});
  const p=verifyToken(a.slice(7));
  if(!p)return res.status(401).json({error:'Invalid or expired token'});
  req.user=p;next();
}
function adminAuth(req,res,next){
  auth(req,res,()=>{
    if(req.user.role!=='admin')return res.status(403).json({error:'Admin required'});
    next();
  });
}

function getUsers(){
  const f=path.join(DATA_DIR,'users','users.json');
  return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):[];
}
function saveUsers(u){fs.writeFileSync(path.join(DATA_DIR,'users','users.json'),JSON.stringify(u,null,2));}
function safeUser(u){const{password,...s}=u;return s;}

// AUTH
app.get('/api/setup/status',(req,res)=>{
  res.json({needsSetup:getUsers().length===0});
});

app.post('/api/auth/register',(req,res)=>{
  const{email,password,name,company,inviteToken}=req.body;
  if(!email||!password||!name)return res.status(400).json({error:'Email, password and name required'});
  const users=getUsers();
  if(users.find(u=>u.email.toLowerCase()===email.toLowerCase()))return res.status(409).json({error:'Email already registered'});
  const isFirst=users.length===0;
  if(!isFirst){
    const expected=hashPw('invite-'+email.toLowerCase());
    if(!inviteToken||inviteToken!==expected)return res.status(403).json({error:'Valid invite token required'});
  }
  const user={
    id:'u-'+Date.now(),
    email:email.toLowerCase(),
    password:hashPw(password),
    name,company:company||'',
    role:isFirst?'admin':'user',
    createdAt:new Date().toISOString(),
    profile:{regNumber:'',qualifications:'',signature:'',logoUrl:'',
      equipment:{mft:'',continuity:'',ir:'',zel:'',rcd:''},
      defaultSupplyType:'TN-C-S',defaultEarthConductor:'16mm²',defaultBondConductor:'10mm²'}
  };
  users.push(user);saveUsers(users);
  const token=signToken({id:user.id,email:user.email,role:user.role,name:user.name});
  res.json({ok:true,token,user:safeUser(user)});
});

app.post('/api/auth/login',(req,res)=>{
  const{email,password}=req.body;
  if(!email||!password)return res.status(400).json({error:'Email and password required'});
  const user=getUsers().find(u=>u.email.toLowerCase()===email.toLowerCase());
  if(!user||user.password!==hashPw(password))return res.status(401).json({error:'Invalid email or password'});
  const token=signToken({id:user.id,email:user.email,role:user.role,name:user.name});
  res.json({ok:true,token,user:safeUser(user)});
});

app.get('/api/auth/me',auth,(req,res)=>{
  const user=getUsers().find(u=>u.id===req.user.id);
  if(!user)return res.status(404).json({error:'User not found'});
  res.json(safeUser(user));
});

app.get('/api/users',adminAuth,(req,res)=>{
  res.json({users:getUsers().map(safeUser)});
});

app.put('/api/users/profile',auth,(req,res)=>{
  const users=getUsers();
  const idx=users.findIndex(u=>u.id===req.user.id);
  if(idx===-1)return res.status(404).json({error:'Not found'});
  const{password,role,id,email,...updates}=req.body;
  users[idx]={...users[idx],...updates};
  saveUsers(users);
  res.json({ok:true,user:safeUser(users[idx])});
});

app.put('/api/users/:id',adminAuth,(req,res)=>{
  const users=getUsers();
  const idx=users.findIndex(u=>u.id===req.params.id);
  if(idx===-1)return res.status(404).json({error:'Not found'});
  const{password:newPw,...updates}=req.body;
  users[idx]={...users[idx],...updates};
  if(newPw)users[idx].password=hashPw(newPw);
  saveUsers(users);
  res.json({ok:true,user:safeUser(users[idx])});
});

app.delete('/api/users/:id',adminAuth,(req,res)=>{
  if(req.params.id===req.user.id)return res.status(400).json({error:'Cannot delete yourself'});
  saveUsers(getUsers().filter(u=>u.id!==req.params.id));
  res.json({ok:true});
});

app.post('/api/users/invite',adminAuth,(req,res)=>{
  const{email}=req.body;
  if(!email)return res.status(400).json({error:'Email required'});
  const token=hashPw('invite-'+email.toLowerCase());
  res.json({ok:true,email,inviteToken:token});
});

app.post('/api/auth/change-password',auth,(req,res)=>{
  const{currentPassword,newPassword}=req.body;
  const users=getUsers();
  const idx=users.findIndex(u=>u.id===req.user.id);
  if(users[idx].password!==hashPw(currentPassword))return res.status(401).json({error:'Current password incorrect'});
  users[idx].password=hashPw(newPassword);
  saveUsers(users);
  res.json({ok:true});
});

app.post('/api/upload/logo',auth,upload.single('logo'),(req,res)=>{
  if(!req.file)return res.status(400).json({error:'No file'});
  const url='/logos/'+req.file.filename;
  const users=getUsers();
  const idx=users.findIndex(u=>u.id===req.user.id);
  if(idx!==-1){users[idx].profile=users[idx].profile||{};users[idx].profile.logoUrl=url;saveUsers(users);}
  res.json({ok:true,url});
});

// ── GPT-4o VISION SCAN ────────────────────────────────────────────────────────
const BOARD_SCAN_PROMPT = `You are analysing a photo of a UK domestic electrical consumer unit (fuse board).

STRICT RULES:
- Only extract information that is CLEARLY VISIBLE and LEGIBLE in the image.
- Do NOT guess, infer, or invent circuit labels, amperage, or breaker types.
- If a label is unclear or missing, set it to null. Do not substitute a typical or common value.
- Count the physical breakers you can actually see. Return exactly that many circuits — no more, no fewer.
- If you cannot read the board make or rating, set those fields to null.
- Do not add circuits that are not physically present in the image.

Return ONLY valid JSON with no explanation, no markdown, no code fences — raw JSON only:
{
  "board_make": "string or null",
  "board_rating": "string or null",
  "circuits": [
    {
      "position": 1,
      "label": "string or null",
      "rating_amps": number or null,
      "mcb_type": "string or null",
      "is_rcbo": true or false
    }
  ]
}`;

app.post('/api/vision/scan',auth,async(req,res)=>{
  const{image,mime}=req.body;
  if(!image)return res.status(400).json({error:'No image provided'});
  const apiKey=runtimeOpenAIKey;
  if(!apiKey)return res.status(500).json({error:'No OpenAI API key configured. Go to Settings → Connection to add your key.'});
  try{
    const r=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body:JSON.stringify({
        model:'gpt-4o-mini',
        max_tokens:2048,
        temperature:0,
        messages:[
          {
            role:'system',
            content:'You are a precise electrical inspection assistant. You only report what you can clearly see. You never guess or invent data. You always respond with raw JSON only.'
          },
          {
            role:'user',
            content:[
              {type:'image_url',image_url:{url:'data:'+(mime||'image/jpeg')+';base64,'+image,detail:'high'}},
              {type:'text',text:BOARD_SCAN_PROMPT}
            ]
          }
        ]
      })
    });
    if(!r.ok){const e=await r.json();return res.status(r.status).json({error:e.error?.message||'OpenAI error'});}
    const d=await r.json();
    res.json({response:d.choices?.[0]?.message?.content||'',model:'gpt-4o-mini',tokens_used:d.usage?.total_tokens});
  }catch(e){res.status(502).json({error:'OpenAI request failed: '+e.message});}
});

// OLLAMA
app.post('/api/generate',auth,async(req,res)=>{
  try{const r=await fetch(OLLAMA_URL+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(req.body)});res.json(await r.json());}
  catch(e){res.status(502).json({error:'Ollama unreachable',detail:e.message});}
});
app.get('/api/tags',auth,async(req,res)=>{
  try{const r=await fetch(OLLAMA_URL+'/api/tags');res.json(await r.json());}
  catch(e){res.status(502).json({error:'Ollama unreachable'});}
});

// FILE UPLOAD
app.post('/api/upload',auth,upload.single('photo'),(req,res)=>{
  if(!req.file)return res.status(400).json({error:'No file'});
  res.json({ok:true,filename:req.file.filename,url:'/uploads/'+req.file.filename});
});

// CERTS
function certsDir(userId){
  const d=path.join(DATA_DIR,'certs',userId);
  if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});
  return d;
}

app.post('/api/cert/save',auth,(req,res)=>{
  try{
    const cert=req.body;
    if(!cert.id)cert.id='cert-'+Date.now();
    cert.savedAt=new Date().toISOString();
    cert.userId=req.user.id;
    fs.writeFileSync(path.join(certsDir(req.user.id),cert.id+'.json'),JSON.stringify(cert,null,2));
    res.json({ok:true,id:cert.id});
  }catch(e){res.status(500).json({error:'Save failed',detail:e.message});}
});

app.get('/api/cert/list',auth,(req,res)=>{
  try{
    let dirs=[];
    if(req.user.role==='admin'&&req.query.all==='true'){
      const root=path.join(DATA_DIR,'certs');
      dirs=fs.readdirSync(root).map(d=>path.join(root,d)).filter(d=>fs.statSync(d).isDirectory());
    }else{
      dirs=[certsDir(req.user.id)];
    }
    const certs=[];
    dirs.forEach(dir=>{
      if(!fs.existsSync(dir))return;
      fs.readdirSync(dir).filter(f=>f.endsWith('.json')).forEach(f=>{
        try{
          const raw=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
          certs.push({id:raw.id,type:raw.type,client:raw.client,address:raw.address,inspDate:raw.inspDate,savedAt:raw.savedAt,userId:raw.userId});
        }catch(e){}
      });
    });
    certs.sort((a,b)=>new Date(b.savedAt)-new Date(a.savedAt));
    res.json({certs});
  }catch(e){res.json({certs:[]});}
});

app.get('/api/cert/:id',auth,(req,res)=>{
  try{
    const userDir=certsDir(req.user.id);
    let fp=path.join(userDir,req.params.id+'.json');
    if(!fs.existsSync(fp)&&req.user.role==='admin'){
      const root=path.join(DATA_DIR,'certs');
      fp=fs.readdirSync(root).map(d=>path.join(root,d,req.params.id+'.json')).find(p=>fs.existsSync(p));
    }
    if(!fp||!fs.existsSync(fp))return res.status(404).json({error:'Not found'});
    res.json(JSON.parse(fs.readFileSync(fp,'utf8')));
  }catch(e){res.status(500).json({error:'Load failed'});}
});

app.delete('/api/cert/:id',auth,(req,res)=>{
  try{
    const fp=path.join(certsDir(req.user.id),req.params.id+'.json');
    if(fs.existsSync(fp))fs.unlinkSync(fp);
    res.json({ok:true});
  }catch(e){res.status(500).json({error:'Delete failed'});}
});


// ── RUNTIME CONFIG (API keys set via UI) ──────────────────────────────────────
let runtimeOpenAIKey = OPENAI_API_KEY || process.env._OPENAI_KEY_PERSISTED || ''; // env var > persisted > empty

app.post('/api/config/openai-key', auth, (req, res) => {
  const { key } = req.body;
  if (!key || !key.startsWith('sk-')) return res.status(400).json({ error: 'Invalid API key format — should start with sk-' });
  runtimeOpenAIKey = key;
  // Persist to disk so it survives restarts
  try {
    const configFile = require('path').join(DATA_DIR, 'config.json');
    const existing = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile,'utf8')) : {};
    existing.openAIKey = key;
    fs.writeFileSync(configFile, JSON.stringify(existing, null, 2));
  } catch(e) { console.error('Could not persist config:', e.message); }
  res.json({ ok: true });
});

app.get('/api/vision/test', auth, async (req, res) => {
  const key = runtimeOpenAIKey;
  if (!key) return res.status(500).json({ error: 'No OpenAI API key configured. Go to Settings → Connection to add your key.' });
  try {
    // Test with a minimal request
    const r = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': 'Bearer ' + key }
    });
    if (!r.ok) {
      const e = await r.json();
      return res.status(401).json({ error: e.error?.message || 'Invalid API key' });
    }
    res.json({ ok: true, message: 'OpenAI API key valid' });
  } catch(e) { res.status(502).json({ error: 'Cannot reach OpenAI: ' + e.message }); }
});

app.get('/health',(req,res)=>res.json({status:'ok',ollama:OLLAMA_URL,openai:runtimeOpenAIKey?'configured':'not set'}));

app.listen(PORT,'0.0.0.0',()=>{
  console.log('CertAI on port '+PORT);
  console.log('Ollama: '+OLLAMA_URL);
  console.log('Data: '+DATA_DIR);
});
