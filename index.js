const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const IOL_TOKEN_URL = 'https://api.invertironline.com/token';
const IOL_API_URL   = 'https://api.invertironline.com/api/v2';

let cachedToken = null;
let tokenExpiry  = null;

async function getToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) return cachedToken;
  const resp = await fetch(IOL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username:   process.env.IOL_USER,
      password:   process.env.IOL_PASS,
      grant_type: 'password'
    })
  });
  if (!resp.ok) throw new Error('No se pudo autenticar con IOL');
  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiry  = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

app.get('/lecaps', async (req, res) => {
  const TICKERS = [
    'S16Y5','S30Y5','S13J5','S27J5','S11L5','S25L5',
    'S15G5','S29G9','S12S5','S30S5','S17O5','S31O5',
    'S14N5','S28N5','S12D5','S26D5','S16E6','S30E6',
    'S13F6','S27F6'
  ];
  try {
    const token = await getToken();
    const precios = {};
    for (const ticker of TICKERS) {
      try {
        const r = await fetch(`${IOL_API_URL}/bCBA/Titulos/${ticker}/CotizacionDetalle`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (r.ok) {
          const d = await r.json();
          const p = d.ultimoPrecio || d.cierreAnterior;
          if (p) precios[ticker] = p;
        }
      } catch(e) {}
      await new Promise(r => setTimeout(r, 150));
    }
    res.json({ precios, actualizadoEn: new Date().toISOString() });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'ok', msg: 'LECAPS API funcionando' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
