const fetch = require('node-fetch');

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ticker = req.query.ticker;
  if (!ticker) return res.status(400).json({ error: 'Falta ticker' });

  try {
    const token = await getToken();
    const r = await fetch(
      `${IOL_API_URL}/bCBA/Titulos/${ticker}/CotizacionDetalle`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!r.ok) return res.status(r.status).json({ error: 'Ticker no encontrado' });
    res.status(200).json(await r.json());
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
