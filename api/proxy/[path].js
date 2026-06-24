const API_BASE = 'https://a.klaviyo.com/api';
const REVISION = '2026-04-15';

export default async function handler(req, res) {
  const { path } = req.query;
  
  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  try {
    // path comes as a string like "flows?page[size]=50"
    const [basePath, queryString] = String(path).split('?');
    const url = `${API_BASE}/${basePath}${queryString ? '?' + queryString : ''}`;
    
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
