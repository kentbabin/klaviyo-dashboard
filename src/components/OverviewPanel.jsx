import { useState, useEffect, useMemo } from 'react';
import { queryCampaignValues, queryMetricAggregates } from '../api/klaviyo';

const CONVERSION_METRIC_ID = import.meta.env.VITE_KLAVIYO_CONVERSION_METRIC_ID;

const STATS = ['delivered', 'opens_unique', 'clicks_unique', 'unsubscribes', 'bounced'];

// Metric IDs
const METRIC = {
  SUBSCRIBED_LIST: 'XtG8sP',
  UNSUBSCRIBED_LIST: 'Xx8rjx',
  OPENED_EMAIL: 'W4a2xR',
  CLICKED_EMAIL: 'UfJ93n',
  RECEIVED_EMAIL: 'XdyRrH',
};

// Date helpers
function getDateRange(daysAgo) {
  const now = new Date();
  const end = new Date(now.getTime() - (daysAgo - 1) * 86400000);
  const start = new Date(now.getTime() - daysAgo * 86400000);
  return {
    start: start.toISOString().slice(0, 19),
    end: end.toISOString().slice(0, 19),
  };
}

function buildDateFilter(start, end) {
  return [
    `greater-or-equal(datetime,${start})`,
    `less-than(datetime,${end})`,
  ];
}

async function fetchMetricSum(metricId, measurements, daysAgo) {
  const { start, end } = getDateRange(daysAgo);
  const filter = buildDateFilter(start, end);
  const res = await queryMetricAggregates({ metricId, measurements, filter, interval: 'day' });
  const attrData = res.data?.attributes?.data;
  if (!attrData || attrData.length === 0) return 0;
  const values = attrData[0]?.measurements?.[measurements[0]] || [];
  return values.reduce((sum, v) => sum + (v || 0), 0);
}

export default function OverviewPanel({ campaigns }) {
  const [campaignStats, setCampaignStats] = useState({});
  const [metrics, setMetrics] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [metricsFetching, setMetricsFetching] = useState(false);
  const [error, setError] = useState(null);

  // Get last 5 sent campaigns, sorted by send_time desc
  const recentCampaigns = useMemo(() => {
    return campaigns
      .filter((c) => c.attributes?.status === 'Sent' && c.attributes?.send_time)
      .sort((a, b) => new Date(b.attributes.send_time) - new Date(a.attributes.send_time))
      .slice(0, 5);
  }, [campaigns]);

  // Fetch campaign stats for the table
  useEffect(() => {
    if (recentCampaigns.length === 0) return;

    const campaignIds = recentCampaigns.map((c) => c.id);
    const idFilter = `contains-any(campaign_id,[${campaignIds.map(id => `'${id}'`).join(',')}])`;

    async function fetchStats() {
      setFetching(true);
      setError(null);
      try {
        const res = await queryCampaignValues({
          statistics: STATS,
          timeframe: 'last_365_days',
          conversionMetricId: CONVERSION_METRIC_ID,
          filter: idFilter,
        });

        const byCampaign = {};
        res.data?.attributes?.results?.forEach((r) => {
          const campaignId = r.groupings?.campaign_id;
          if (!campaignId) return;
          if (!byCampaign[campaignId]) {
            byCampaign[campaignId] = {};
          }
          Object.entries(r.statistics).forEach(([k, v]) => {
            if (typeof v === 'number') {
              byCampaign[campaignId][k] = (byCampaign[campaignId][k] || 0) + v;
            }
          });
        });

        setCampaignStats(byCampaign);
      } catch (err) {
        setError(err.message);
      } finally {
        setFetching(false);
      }
    }
    fetchStats();
  }, [recentCampaigns.length > 0 ? recentCampaigns.map((c) => c.id).join(',') : null]);

  // Fetch subscriber metrics from Klaviyo events API
  useEffect(() => {
    async function fetchMetrics() {
      setMetricsFetching(true);
      try {
        // Fetch current 30-day and previous 30-day metrics in parallel
        const [currSub, currUnsub, currOpens, currClicks, prevSub, prevUnsub, prevOpens, prevClicks] = await Promise.all([
          fetchMetricSum(METRIC.SUBSCRIBED_LIST, ['count'], 30),
          fetchMetricSum(METRIC.UNSUBSCRIBED_LIST, ['count'], 30),
          fetchMetricSum(METRIC.OPENED_EMAIL, ['unique'], 30),
          fetchMetricSum(METRIC.CLICKED_EMAIL, ['unique'], 30),
          fetchMetricSum(METRIC.SUBSCRIBED_LIST, ['count'], 60),
          fetchMetricSum(METRIC.UNSUBSCRIBED_LIST, ['count'], 60),
          fetchMetricSum(METRIC.OPENED_EMAIL, ['unique'], 60),
          fetchMetricSum(METRIC.CLICKED_EMAIL, ['unique'], 60),
        ]);

        // Subtract current period from previous to get the 30-60 day window
        setMetrics({
          subscribed: currSub,
          subscribedPrev: prevSub - currSub,
          unsubscribed: currUnsub,
          unsubscribedPrev: prevUnsub - currUnsub,
          opens: currOpens,
          opensPrev: prevOpens - currOpens,
          clicks: currClicks,
          clicksPrev: prevClicks - currClicks,
        });
      } catch (err) {
        console.error('Metrics fetch failed:', err);
      } finally {
        setMetricsFetching(false);
      }
    }
    fetchMetrics();
  }, []);

  function calcPctChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  const netSubChange = metrics ? metrics.subscribed - metrics.unsubscribed : null;
  const netSubPrev = metrics ? metrics.subscribedPrev - metrics.unsubscribedPrev : null;
  const subChangePct = calcPctChange(netSubChange ?? 0, netSubPrev ?? 0);

  const openRate = metrics && metrics.subscribed > 0 ? (metrics.opens / metrics.subscribed) * 100 : 0;
  const openRatePrev = metrics && metrics.subscribedPrev > 0 ? (metrics.opensPrev / metrics.subscribedPrev) * 100 : 0;

  const clickRate = metrics && metrics.subscribed > 0 ? (metrics.clicks / metrics.subscribed) * 100 : 0;
  const clickRatePrev = metrics && metrics.subscribedPrev > 0 ? (metrics.clicksPrev / metrics.subscribedPrev) * 100 : 0;

  const unsubRate = metrics && metrics.subscribed > 0 ? (metrics.unsubscribed / metrics.subscribed) * 100 : 0;
  const unsubRatePrev = metrics && metrics.subscribedPrev > 0 ? (metrics.unsubscribedPrev / metrics.subscribedPrev) * 100 : 0;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">{error}</div>
      )}

      {/* Subscriber Growth */}
      <div>
        <h2 className="text-sm font-medium text-slate-400 mb-4">Subscriber Growth (Last 30 Days)</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Net Change */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Net Subscribers</div>
            <div className="text-2xl font-bold text-white">
              {metricsFetching ? '—' : netSubChange !== null ? (netSubChange >= 0 ? '+' : '') + netSubChange : '—'}
            </div>
            {subChangePct !== 0 && (
              <div className={`text-xs mt-1 ${subChangePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {subChangePct >= 0 ? '↑' : '↓'} {Math.abs(subChangePct).toFixed(1)}% vs prev 30d
              </div>
            )}
          </div>

          {/* Open Rate */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Unique Open Rate</div>
            <div className="text-2xl font-bold text-white">
              {metricsFetching ? '—' : `${openRate.toFixed(1)}%`}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{metrics?.opens || 0} opens</div>
          </div>

          {/* Click Rate */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Unique Click Rate</div>
            <div className="text-2xl font-bold text-white">
              {metricsFetching ? '—' : `${clickRate.toFixed(1)}%`}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{metrics?.clicks || 0} clicks</div>
          </div>

          {/* Unsubscribe Rate */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Unsubscribe Rate</div>
            <div className="text-2xl font-bold text-white">
              {metricsFetching ? '—' : `${unsubRate.toFixed(1)}%`}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{metrics?.unsubscribed || 0} unsubs</div>
          </div>

          {/* Bounce Rate placeholder */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 opacity-50">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Bounce Rate</div>
            <div className="text-2xl font-bold text-white">—</div>
            <div className="text-xs text-slate-500 mt-0.5">via campaigns</div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Rates calculated from email events (opens, clicks, unsubscribes) in the last 30 days vs the previous 30 days.
        </p>
      </div>

      {/* Recent Campaigns */}
      <div>
        <h2 className="text-sm font-medium text-slate-400 mb-4">Recent Campaigns</h2>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Campaign</th>
                <th className="text-left px-4 py-3">Sent</th>
                <th className="text-right px-4 py-3">Delivered</th>
                <th className="text-right px-4 py-3">Unique Opens</th>
                <th className="text-right px-4 py-3">Unique Clicks</th>
              </tr>
            </thead>
            <tbody>
              {recentCampaigns.map((c) => {
                const stats = campaignStats[c.id] || {};
                return (
                  <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-white">{c.attributes.name}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {c.attributes.send_time
                        ? new Date(c.attributes.send_time).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {fetching ? '—' : (stats.delivered?.toLocaleString() || '0')}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {fetching ? '—' : (stats.opens_unique?.toLocaleString() || '0')}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {fetching ? '—' : (stats.clicks_unique?.toLocaleString() || '0')}
                    </td>
                  </tr>
                );
              })}
              {recentCampaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                    No sent campaigns found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Metrics reflect the last 365 days for each campaign. Click on the Campaigns tab for full date-range filtering.
        </p>
      </div>
    </div>
  );
}
