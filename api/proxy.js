export default function handler(req, res) {
  const apiPath = req.query.path || req.query['path[]'];
  const path = Array.isArray(apiPath) ? apiPath.join('/') : String(apiPath || '');
  
  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  const url = `https://a.klaviyo.com/api/${path}`;

  const fetchOptions = {
    method: req.method,
    headers: {
      'Authorization': `Klaviyo-API-Key ${process.env.VITE_KLAVIYO_API_KEY}`,
      'revision': '2026-04-15',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  // Only include body for POST/PUT/PATCH
  if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
    fetchOptions.body = JSON.stringify(req.body);
  }

  fetch(url, fetchOptions)
    .then((response) => response.json())
    .then((data) => res.status(200).json(data))
    .catch((err) => res.status(500).json({ error: err.message }));
}
