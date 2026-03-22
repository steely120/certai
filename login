<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>CertAI — Sign In</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0a;--bg2:#111;--bg3:#1a1a1a;--border:#252525;--blue:#3b6ef8;--blue2:#2d5ce8;--text:#f0f0f0;--text2:#888;--red:#ef4444;--green:#22c55e}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}
.logo-wrap{text-align:center;margin-bottom:32px}
.logo-badge{width:52px;height:52px;background:var(--blue);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 10px}
.logo-text{font-size:1.5rem;font-weight:700;color:var(--blue)}
.logo-sub{font-size:.75rem;color:var(--text2);margin-top:3px}
.card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:32px;width:100%;max-width:400px}
.card-title{font-size:1.1rem;font-weight:700;margin-bottom:4px}
.card-sub{font-size:.75rem;color:var(--text2);margin-bottom:24px}
.f{display:flex;flex-direction:column;gap:4px;margin-bottom:16px}
.f label{font-size:.62rem;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--text2)}
.f input{background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:10px 12px;border-radius:7px;font-size:.85rem;outline:none;font-family:'Inter',sans-serif;transition:border-color .15s}
.f input:focus{border-color:var(--blue)}
.btn{width:100%;padding:11px;background:var(--blue);color:#fff;border:none;border-radius:7px;font-size:.88rem;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:all .15s;margin-top:4px}
.btn:hover{background:var(--blue2)}
.btn:disabled{background:#333;color:#666;cursor:not-allowed}
.btn-sec{background:transparent;color:var(--text2);border:1px solid var(--border);margin-top:8px}
.btn-sec:hover{background:var(--bg3);color:var(--text);background:var(--bg3)}
.err{display:none;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:var(--red);padding:8px 12px;border-radius:6px;font-size:.72rem;margin-bottom:12px;line-height:1.5}
.err.on{display:block}
.ok{display:none;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:var(--green);padding:8px 12px;border-radius:6px;font-size:.72rem;margin-bottom:12px}
.ok.on{display:block}
.switch{text-align:center;margin-top:16px;font-size:.72rem;color:var(--text2)}
.switch a{color:var(--blue);cursor:pointer;text-decoration:none}
.switch a:hover{text-decoration:underline}
.panel{display:none}
.panel.active{display:block}
.divider{height:1px;background:var(--border);margin:16px 0}
.setup-badge{background:rgba(59,110,248,.12);border:1px solid rgba(59,110,248,.3);color:var(--blue);padding:8px 12px;border-radius:6px;font-size:.72rem;margin-bottom:16px;line-height:1.5}
</style>
</head>
<body>
<div class="logo-wrap">
  <div class="logo-badge">⚡</div>
  <div class="logo-text">CertAI</div>
  <div class="logo-sub">Electrical Certificate Management</div>
</div>

<div class="card">
  <div class="err" id="errMsg"></div>
  <div class="ok" id="okMsg"></div>

  <!-- LOGIN PANEL -->
  <div class="panel active" id="loginPanel">
    <div class="card-title">Sign in</div>
    <div class="card-sub">Welcome back</div>
    <div class="f"><label>Email</label><input type="email" id="loginEmail" placeholder="you@example.com" autocomplete="email"></div>
    <div class="f"><label>Password</label><input type="password" id="loginPassword" placeholder="••••••••" autocomplete="current-password"></div>
    <button class="btn" onclick="doLogin()" id="loginBtn">Sign In</button>
    <div class="switch">Don't have an account? <a onclick="showPanel('registerPanel')">Register with invite</a></div>
  </div>

  <!-- REGISTER PANEL -->
  <div class="panel" id="registerPanel">
    <div class="card-title">Create account</div>
    <div class="card-sub" id="registerSub">Enter your invite token to register</div>
    <div class="setup-badge" id="setupBadge" style="display:none">👋 First user — you'll become the admin. No invite token needed.</div>
    <div class="f" id="inviteField"><label>Invite Token</label><input type="text" id="inviteToken" placeholder="Paste token from your admin"></div>
    <div class="divider"></div>
    <div class="f"><label>Full Name</label><input type="text" id="regName" placeholder="JJ Steele" autocomplete="name"></div>
    <div class="f"><label>Company</label><input type="text" id="regCompany" placeholder="JJS Electrical" autocomplete="organization"></div>
    <div class="f"><label>Email</label><input type="email" id="regEmail" placeholder="you@example.com" autocomplete="email"></div>
    <div class="f"><label>Password</label><input type="password" id="regPassword" placeholder="Choose a strong password" autocomplete="new-password"></div>
    <button class="btn" onclick="doRegister()" id="registerBtn">Create Account</button>
    <button class="btn btn-sec" onclick="showPanel('loginPanel')">← Back to sign in</button>
  </div>
</div>

<script>
const BASE = '';

async function checkSetup() {
  try {
    const r = await fetch(BASE + '/api/setup/status');
    const d = await r.json();
    if (d.needsSetup) {
      document.getElementById('setupBadge').style.display = 'block';
      document.getElementById('inviteField').style.display = 'none';
      showPanel('registerPanel');
    }
  } catch(e) {}
}

function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  clearMsgs();
}
function showErr(msg) { const e = document.getElementById('errMsg'); e.textContent = msg; e.classList.add('on'); document.getElementById('okMsg').classList.remove('on'); }
function showOk(msg) { const e = document.getElementById('okMsg'); e.textContent = msg; e.classList.add('on'); document.getElementById('errMsg').classList.remove('on'); }
function clearMsgs() { document.getElementById('errMsg').classList.remove('on'); document.getElementById('okMsg').classList.remove('on'); }

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { showErr('Please enter your email and password'); return; }
  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'Signing in...';
  try {
    const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const d = await r.json();
    if (!r.ok) { showErr(d.error || 'Login failed'); return; }
    localStorage.setItem('certai_token', d.token);
    localStorage.setItem('certai_user', JSON.stringify(d.user));
    window.location.href = '/dashboard.html';
  } catch(e) { showErr('Cannot connect to server. Check your connection.'); }
  finally { btn.disabled = false; btn.textContent = 'Sign In'; }
}

async function doRegister() {
  const name = document.getElementById('regName').value.trim();
  const company = document.getElementById('regCompany').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const inviteToken = document.getElementById('inviteToken').value.trim();
  if (!name || !email || !password) { showErr('Name, email and password are required'); return; }
  if (password.length < 6) { showErr('Password must be at least 6 characters'); return; }
  const btn = document.getElementById('registerBtn');
  btn.disabled = true; btn.textContent = 'Creating account...';
  try {
    const r = await fetch(BASE + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, company, email, password, inviteToken }) });
    const d = await r.json();
    if (!r.ok) { showErr(d.error || 'Registration failed'); return; }
    localStorage.setItem('certai_token', d.token);
    localStorage.setItem('certai_user', JSON.stringify(d.user));
    window.location.href = '/dashboard.html';
  } catch(e) { showErr('Cannot connect to server.'); }
  finally { btn.disabled = false; btn.textContent = 'Create Account'; }
}

// Enter key support
document.addEventListener('keydown', e => { if (e.key === 'Enter') { if (document.getElementById('loginPanel').classList.contains('active')) doLogin(); else doRegister(); } });

// Check if already logged in
const token = localStorage.getItem('certai_token');
if (token) window.location.href = '/dashboard.html';

checkSetup();
</script>
</body>
</html>
