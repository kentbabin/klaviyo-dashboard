export default function handler(req, res) {
  const { path, ...rest } = req.query;

  if (!path) {
    return res.status(400).json({ error: 'Missing path' });
  }

  const apiPath = Array.isArray(path) ? path.join('/') : String(path);
  const url = `https://a.klaviyo.com/api/${apiPath}`;

  // Forward query params (excluding `path`)
  const params = new URLSearchParams();
  Object.entries(rest).forEach(([key, value]) => {
    if (value !== undefined) {
      params.append(key, value);
    }
  });
  const query = params.toString();
  const finalUrl = `${url}${query ? '?' + query : ''}`;

  fetch(finalUrl, {
    method: req.method,
    headers: {
      'Authorization': `Klaviyo-API-Key ${process.env.VITE_KLAVIYO_API_KEY}`,
      'revision': '2026-04-15',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    ...(req.body && { body: JSON.stringify(req.body) }),
  })
    .then((response) => response.json())
    .then((data) => res.status(200).json(data))
    .catch((err) => res.status(500).json({ error: err.message }));
}
