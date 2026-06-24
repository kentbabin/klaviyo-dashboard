// Use Vercel proxy to avoid CORS issues
const PROXY_BASE = '/api';

async function klaviyoFetch(endpoint, options = {}) {
  const url = `${PROXY_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  });
  
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

// Get all campaigns (requires channel filter)
export async function getCampaigns(channel = 'email') {
  return klaviyoFetch(`/campaigns?filter=equals(messages.channel,'${channel}')&page[size]=100`);
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
