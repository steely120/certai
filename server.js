const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const https = require('https');
const fs = require('fs');

const app = express();
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://192.168.1.34:11434';
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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

app.get('/health', (req, res) => res.json({ status: 'ok', ollama: OLLAMA_URL }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CertAI running on http://0.0.0.0:${PORT}`);
  console.log(`Ollama: ${OLLAMA_URL}`);
});
