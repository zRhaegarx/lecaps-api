
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

const TICKERS = [
  'S16M6','S17A6','S30A6','S29Y6','TTJ26',
  'T30J6','S31L6','S31G6','TTS26','TO26',
  'S3OO6','S3ON6','TTD26','T15E7','T30A7',
  'T31Y7','T30J7','TY3OP'
];

async function getDatosTicker(ticker, token) {
  const url = `${IOL_API_URL}/bCBA/Titulos/${ticker}/CotizacionDetalle`;
  const r = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!r.ok) return null;
  const d = await r.json();

  // Extraer todos los datos que necesitamos
  const precio     = d.ultimoPrecio || d.cierreAnterior || null;
  const vencimiento = d.fechaVencimiento || d.vencimiento || null;
  const pagoFinal  = d.laminaMinima || d.valorNominal || d.pagoAlVencimiento || 100;

  return { ticker, precio, vencimiento, pagoFinal };
}

app.get('/lecaps', async (req, res) => {
  try {
    const token = await getToken();
    const resultados = [];

    for (const ticker of TICKERS) {
      try {
        const datos = await getDatosTicker(ticker, token);
        if (datos && datos.precio) resultados.push(datos);
      } catch(e) {}
      await new Promise(r => setTimeout(r, 150));
    }

    res.json({ instrumentos: resultados, actualizadoEn: new Date().toISOString() });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint de debug — muestra todos los campos que devuelve IOL para un ticker
app.get('/debug/:ticker', async (req, res) => {
  try {
    const token = await getToken();
    const r = await fetch(
      `${IOL_API_URL}/bCBA/Titulos/${req.params.ticker}/CotizacionDetalle`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!r.ok) return res.status(r.status).json({ error: 'Ticker no encontrado' });
    res.json(await r.json());
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/test', async (req, res) => {
  try { await getToken(); res.json({ ok: true, msg: 'Auth IOL OK' }); }
  catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/', (req, res) => res.json({ status: 'ok', msg: 'LECAPS API funcionando' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
