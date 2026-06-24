const API_BASE = 'https://a.klaviyo.com/api';
const REVISION = '2026-04-15';

export default async function handler(req, res) {
  // Get the path after /api/
  const fullPath = req.query.path || '';
  const path = Array.isArray(fullPath) ? fullPath.join('/') : String(fullPath);
  
  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  try {
    const url = `${API_BASE}/${path}`;
    
    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': `Klaviyo-API-Key ${process.env.VITE_KLAVIYO_API_KEY}`,
        'revision': REVISION,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (req.body && (req.method === 'POST' || req.method === 'PUT')) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
