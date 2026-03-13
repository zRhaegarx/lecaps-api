const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors({ origin: '*', methods: ['GET','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.options('*', cors());
app.use(express.json());

const IOL_TOKEN_URL = 'https://api.invertironline.com/token';
const IOL_API_URL   = 'https://api.invertironline.com/api/v2';

let cachedToken = null, tokenExpiry = null;

async function getToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) return cachedToken;
  const resp = await fetch(IOL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username: process.env.IOL_USER,
      password: process.env.IOL_PASS,
      grant_type: 'password'
    })
  });
  if (!resp.ok) throw new Error(`IOL auth failed: ${resp.status}`);
  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

const LECAPS_DATA = {
  'S16M6': { vencimiento: '2026-03-16', pagoFinal: 104.6210 },
  'S17A6': { vencimiento: '2026-04-17', pagoFinal: 110.1251 },
  'S30A6': { vencimiento: '2026-04-30', pagoFinal: 127.4860 },
  'S29Y6': { vencimiento: '2026-05-29', pagoFinal: 132.0440 },
  'T30J6': { vencimiento: '2026-06-30', pagoFinal: 144.8960 },
  'S31L6': { vencimiento: '2026-07-31', pagoFinal: 117.6770 },
  'S31G6': { vencimiento: '2026-08-31', pagoFinal: 127.0640 },
  'S30O6': { vencimiento: '2026-10-30', pagoFinal: 135.2780 },
  'S30N6': { vencimiento: '2026-11-30', pagoFinal: 129.8880 },
  'T15E7': { vencimiento: '2027-01-15', pagoFinal: 161.1040 },
  'T30A7': { vencimiento: '2027-04-30', pagoFinal: 157.3410 },
  'T31Y7': { vencimiento: '2027-05-31', pagoFinal: 151.5630 },
  'T30J7': { vencimiento: '2027-06-30', pagoFinal: 156.0370 },
};

const CER_DATA = {
  'TZXM6': { vencimiento: '2026-03-31', pagoFinal: 100, tipo: 'LECER' },
  'X15Y6': { vencimiento: '2026-05-15', pagoFinal: 100, tipo: 'LECER' },
  'X29Y6': { vencimiento: '2026-05-29', pagoFinal: 100, tipo: 'LECER' },
  'TZX26': { vencimiento: '2026-06-30', pagoFinal: 100, tipo: 'LECER' },
  'X31L6': { vencimiento: '2026-07-31', pagoFinal: 100, tipo: 'LECER' },
  'TX26':  { vencimiento: '2026-11-09', pagoFinal: 100, tipo: 'BONCER' },
  'TZXO6': { vencimiento: '2026-10-31', pagoFinal: 100, tipo: 'LECER' },
  'TZXD6': { vencimiento: '2026-12-31', pagoFinal: 100, tipo: 'LECER' },
  'TZXM7': { vencimiento: '2027-03-31', pagoFinal: 100, tipo: 'LECER' },
  'TZXA7': { vencimiento: '2027-04-30', pagoFinal: 100, tipo: 'LECER' },
  'TZXY7': { vencimiento: '2027-05-31', pagoFinal: 100, tipo: 'LECER' },
  'TZX27': { vencimiento: '2027-06-30', pagoFinal: 100, tipo: 'LECER' },
  'TX28':  { vencimiento: '2028-09-13', pagoFinal: 100, tipo: 'BONCER' },
  'TZXD7': { vencimiento: '2027-12-31', pagoFinal: 100, tipo: 'LECER' },
  'TZX28': { vencimiento: '2028-06-30', pagoFinal: 100, tipo: 'LECER' },
  'TX31':  { vencimiento: '2031-11-23', pagoFinal: 100, tipo: 'BONCER' },
};

async function getPrecioDetalle(ticker, token) {
  const r = await fetch(
    `${IOL_API_URL}/bCBA/Titulos/${ticker}/CotizacionDetalle`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!r.ok) return null;
  const d = await r.json();
  return {
    precio: d.ultimoPrecio || d.cierreAnterior || null,
    cierreAnterior: d.cierreAnterior || null
  };
}

async function getMEP(token) {
  const [pesos, dolares] = await Promise.all([
    getPrecioDetalle('AL30', token),
    getPrecioDetalle('AL30D', token)
  ]);
  if (!pesos?.precio || !dolares?.precio) return null;
  return pesos.precio / dolares.precio;
}

async function fetchInstrumentos(dataMap, token) {
  const resultados = [];
  for (const [ticker, info] of Object.entries(dataMap)) {
    try {
      const detalle = await getPrecioDetalle(ticker, token);
      if (detalle?.precio) {
        resultados.push({
          ticker,
          precio: detalle.precio,
          cierreAnterior: detalle.cierreAnterior,
          vencimiento: info.vencimiento,
          pagoFinal: info.pagoFinal,
          ...(info.tipo ? { tipo: info.tipo } : {}),
        });
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  return resultados;
}

app.get('/lecaps', async (req, res) => {
  try {
    const token = await getToken();
    const mepPromise = getMEP(token);
    const instrumentos = await fetchInstrumentos(LECAPS_DATA, token);
    const mep = await mepPromise;
    res.json({ instrumentos, mep: mep ? +mep.toFixed(2) : null, actualizadoEn: new Date().toISOString() });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/cer', async (req, res) => {
  try {
    const token = await getToken();
    const mepPromise = getMEP(token);
    const instrumentos = await fetchInstrumentos(CER_DATA, token);
    const mep = await mepPromise;
    res.json({ instrumentos, mep: mep ? +mep.toFixed(2) : null, actualizadoEn: new Date().toISOString() });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/debug/:ticker', async (req, res) => {
  try {
    const token = await getToken();
    const r = await fetch(`${IOL_API_URL}/bCBA/Titulos/${req.params.ticker}/CotizacionDetalle`,
      { headers: { 'Authorization': `Bearer ${token}` } });
    if (!r.ok) return res.status(r.status).json({ error: 'Ticker no encontrado' });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/test', async (req, res) => {
  try { await getToken(); res.json({ ok: true, msg: 'Auth IOL OK' }); }
  catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/', (req, res) => res.json({ status: 'ok', msg: 'LECAPS API funcionando' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
