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

  // Handle rate limiting with exponential backoff
  if (response.status === 429 && retryCount < MAX_RETRIES) {
    const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return klaviyoFetch(endpoint, options, retryCount + 1);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = error?.errors?.[0]?.detail || error?.error || error?.message || `API error: ${response.status}`;
    throw new Error(detail);
  }
  return response.json();
}

// Get all flows
export async function getFlows() {
  return klaviyoFetch('/flows?page[size]=50');
}

// Get all campaigns (no filter - fetch all, then filter client-side if needed)
export async function getCampaigns(channel = 'email') {
  // Fetch campaigns without filter to avoid filter-syntax errors, filter client-side
  const data = await klaviyoFetch(`/campaigns?page[size]=100`);
  if (channel && data?.data) {
    const filtered = data.data.filter((c) => {
      const msgs = c.attributes?.messages || [];
      return msgs.some((m) => m.channel === channel);
    });
    return { ...data, data: filtered };
  }
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
export async function queryFormValues({ statistics, filter, timeframe = 'last_30_days', conversionMetricId }) {
  const body = {
    data: {
      type: 'form-values-report',
      attributes: {
        statistics,
        ...(filter && { filter }),
        timeframe: { key: timeframe },
        ...(conversionMetricId && { conversion_metric_id: conversionMetricId }),
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
