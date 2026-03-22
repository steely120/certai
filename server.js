const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://192.168.1.34:11434';
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || '/data/certai';

// Ensure data directories exist
[DATA_DIR, path.join(DATA_DIR, 'uploads'), path.join(DATA_DIR, 'certs')].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(DATA_DIR, 'uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));

// Serve BS7671 PDF if present
app.use('/docs', express.static(path.join(__dirname, 'docs')));

// ── OLLAMA PROXY ──────────────────────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Ollama error:', err.message);
    res.status(502).json({ error: 'Could not reach Ollama', detail: err.message });
  }
});

app.get('/api/tags', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    res.json(await response.json());
  } catch (err) {
    res.status(502).json({ error: 'Could not reach Ollama' });
  }
});

// ── FILE UPLOAD ───────────────────────────────────────────────────────────────
app.post('/api/upload', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({
    ok: true,
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`,
    size: req.file.size
  });
});

// Upload and return as base64 for AI scanning
app.post('/api/upload-scan', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filePath = path.join(DATA_DIR, 'uploads', req.file.filename);
  const b64 = fs.readFileSync(filePath).toString('base64');
  const mime = req.file.mimetype || 'image/jpeg';
  res.json({ ok: true, base64: b64, mime, filename: req.file.filename, url: `/uploads/${req.file.filename}` });
});

// ── CERTIFICATE SAVE / LOAD ───────────────────────────────────────────────────
app.post('/api/cert/save', (req, res) => {
  try {
    const cert = req.body;
    if (!cert.id) cert.id = `cert-${Date.now()}`;
    cert.savedAt = new Date().toISOString();
    const filePath = path.join(DATA_DIR, 'certs', cert.id + '.json');
    fs.writeFileSync(filePath, JSON.stringify(cert, null, 2));
    res.json({ ok: true, id: cert.id });
  } catch (err) {
    res.status(500).json({ error: 'Save failed', detail: err.message });
  }
});

app.get('/api/cert/list', (req, res) => {
  try {
    const certsDir = path.join(DATA_DIR, 'certs');
    const files = fs.readdirSync(certsDir).filter(f => f.endsWith('.json'));
    const certs = files.map(f => {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(certsDir, f), 'utf8'));
        return { id: raw.id, type: raw.type, client: raw.client, address: raw.address, inspDate: raw.inspDate, savedAt: raw.savedAt };
      } catch (e) { return null; }
    }).filter(Boolean).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    res.json({ certs });
  } catch (err) {
    res.json({ certs: [] });
  }
});

app.get('/api/cert/:id', (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, 'certs', req.params.id + '.json');
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch (err) {
    res.status(500).json({ error: 'Load failed' });
  }
});

app.delete('/api/cert/:id', (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, 'certs', req.params.id + '.json');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ollama: OLLAMA_URL }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ CertAI running on http://0.0.0.0:${PORT}`);
  console.log(`🤖 Ollama: ${OLLAMA_URL}`);
  console.log(`💾 Data: ${DATA_DIR}`);
});
