import { getCached, setCached } from './cache';

// Use Vercel proxy to avoid CORS issues
const PROXY_BASE = '/api/proxy';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function klaviyoFetch(endpoint, options = {}, retryCount = 0) {
  // Build URL with path as query param
  const mainPath = endpoint.split('?')[0];
  const queryString = endpoint.includes('?') ? endpoint.split('?')[1] : '';
  const url = `${PROXY_BASE}?path=${encodeURIComponent(mainPath)}${queryString ? '&' + queryString : ''}`;

  const fetchOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  };

  // Don't send body on GET/HEAD requests
  if (fetchOptions.method && fetchOptions.method !== 'GET' && fetchOptions.method !== 'HEAD') {
    // body is already set in options
  } else {
    delete fetchOptions.body;
  }

  const response = await fetch(url, fetchOptions);

  // Handle rate limiting: respect Retry-After header, then exponential backoff with jitter
  if (response.status === 429 && retryCount < MAX_RETRIES) {
    const retryAfter = response.headers.get('Retry-After');
    let delay;
    if (retryAfter) {
      delay = parseInt(retryAfter, 10) * 1000;
    } else {
      delay = BASE_DELAY_MS * Math.pow(2, retryCount);
    }
    // Add jitter (±25%) to avoid thundering herd
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    return klaviyoFetch(endpoint, options, retryCount + 1);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = error?.errors?.[0]?.detail || error?.error || error?.message || `API error: ${response.status}`;
    throw new Error(detail);
  }
  return response.json();
}

// Get all flows (cached for 5 minutes)
export async function getFlows() {
  const cacheKey = 'flows';
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await klaviyoFetch('/flows?page[size]=50');
  setCached(cacheKey, data);
  return data;
}

// Get all forms (cached for 5 minutes)
export async function getForms() {
  const cacheKey = 'forms';
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await klaviyoFetch('/forms?page[size]=100');
  setCached(cacheKey, data);
  return data;
}

// Get all campaigns (channel filter is required by Klaviyo API, cached for 5 minutes)
export async function getCampaigns(channel = 'email') {
  const cacheKey = `campaigns_${channel}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const data = await klaviyoFetch(`/campaigns?filter=equals(messages.channel,'${channel}')&page[size]=100`);
  setCached(cacheKey, data);
  return data;
}

// Query Campaign Values (reporting)
export async function queryCampaignValues({ statistics, filter, timeframe = 'last_30_days', conversionMetricId }) {
  const body = {
    data: {
      type: 'campaign-values-report',
      attributes: {
        statistics,
        ...(filter && { filter }),
        timeframe: { key: timeframe },
        ...(conversionMetricId && { conversion_metric_id: conversionMetricId }),
      },
    },
  };
  return klaviyoFetch('/campaign-values-reports', { method: 'POST', body: JSON.stringify(body) });
}

// Query Flow Values (reporting)
export async function queryFlowValues({ statistics, filter, timeframe = 'last_30_days', conversionMetricId }) {
  const body = {
    data: {
      type: 'flow-values-report',
      attributes: {
        statistics,
        ...(filter && { filter }),
        timeframe: { key: timeframe },
        ...(conversionMetricId && { conversion_metric_id: conversionMetricId }),
      },
    },
  };
  return klaviyoFetch('/flow-values-reports', { method: 'POST', body: JSON.stringify(body) });
}

// Query Flow Series (time-series data)
export async function queryFlowSeries({ statistics, filter, timeframe = 'last_30_days', interval = 'daily', conversionMetricId }) {
  const body = {
    data: {
      type: 'flow-series-report',
      attributes: {
        statistics,
        ...(filter && { filter }),
        timeframe: { key: timeframe },
        interval,
        ...(conversionMetricId && { conversion_metric_id: conversionMetricId }),
      },
    },
  };
  return klaviyoFetch('/flow-series-reports', { method: 'POST', body: JSON.stringify(body) });
}

// Query Campaign Series (time-series data)
export async function queryCampaignSeries({ statistics, filter, timeframe = 'last_30_days', interval = 'daily', conversionMetricId }) {
  const body = {
    data: {
      type: 'campaign-series-report',
      attributes: {
        statistics,
        ...(filter && { filter }),
        timeframe: { key: timeframe },
        interval,
        ...(conversionMetricId && { conversion_metric_id: conversionMetricId }),
      },
    },
  };
  return klaviyoFetch('/campaign-series-reports', { method: 'POST', body: JSON.stringify(body) });
}

// Form values report
export async function queryFormValues({ statistics, filter, timeframe = 'last_30_days' }) {
  const body = {
    data: {
      type: 'form-values-report',
      attributes: {
        statistics,
        ...(filter && { filter }),
        timeframe: { key: timeframe },
      },
    },
  };
  return klaviyoFetch('/form-values-reports', { method: 'POST', body: JSON.stringify(body) });
}

// Form series report
export async function queryFormSeries({ statistics, filter, timeframe = 'last_30_days', interval = 'daily', conversionMetricId }) {
  const body = {
    data: {
      type: 'form-series-report',
      attributes: {
        statistics,
        ...(filter && { filter }),
        timeframe: { key: timeframe },
        interval,
        ...(conversionMetricId && { conversion_metric_id: conversionMetricId }),
      },
    },
  };
  return klaviyoFetch('/form-series-reports', { method: 'POST', body: JSON.stringify(body) });
}
