const fetch = require('node-fetch');

const IOL_TOKEN_URL = 'https://api.invertironline.com/token';

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
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    await getToken();
    res.status(200).json({ ok: true, msg: 'Auth IOL OK' });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
