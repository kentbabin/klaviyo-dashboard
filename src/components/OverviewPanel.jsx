import { useState, useEffect, useMemo } from 'react';
import { queryCampaignValues } from '../api/klaviyo';

const CONVERSION_METRIC_ID = import.meta.env.VITE_KLAVIYO_CONVERSION_METRIC_ID;

const STATS = ['opens_unique', 'clicks_unique', 'unsubscribes', 'bounced'];

function calcRate(stat, delivered) {
  if (!delivered) return null;
  return (stat / delivered) * 100;
}

function calcPctChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export default function OverviewPanel({ campaigns }) {
  const [currentStats, setCurrentStats] = useState(null);
  const [prevStats, setPrevStats] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  // Get last 5 sent campaigns, sorted by send_time desc
  const recentCampaigns = useMemo(() => {
    return campaigns
      .filter((c) => c.attributes?.status === 'Sent' && c.attributes?.send_time)
      .sort((a, b) => new Date(b.attributes.send_time) - new Date(a.attributes.send_time))
      .slice(0, 5);
  }, [campaigns]);

  useEffect(() => {
    if (recentCampaigns.length === 0) return;

    const campaignIds = recentCampaigns.map((c) => c.id);
    const idFilter = campaignIds.map((id) => `equals(campaign_id,'${id}')`).join(',');

    async function fetchStats() {
      setFetching(true);
      setError(null);
      try {
        // Current 30 days
        const currentRes = await queryCampaignValues({
          statistics: [...STATS, 'delivered'],
          timeframe: { key: 'last_30_days' },
          conversionMetricId: CONVERSION_METRIC_ID,
          filter: `any(${idFilter})`,
        });

        // Previous 30 days (31-60 days ago)
        const now = new Date();
        const prevEnd = new Date(now.getTime() - 31 * 86400000).toISOString();
        const prevStart = new Date(now.getTime() - 60 * 86400000).toISOString();
        const prevRes = await queryCampaignValues({
          statistics: [...STATS, 'delivered'],
          timeframe: { start: prevStart, end: prevEnd },
          conversionMetricId: CONVERSION_METRIC_ID,
          filter: `any(${idFilter})`,
        });

        // Sum up current
        const curr = {};
        currentRes.data?.attributes?.results?.forEach((r) => {
          Object.entries(r.statistics).forEach(([k, v]) => {
            if (typeof v === 'number') curr[k] = (curr[k] || 0) + v;
          });
        });
        setCurrentStats(curr);

        // Sum up previous
        const prev = {};
        prevRes.data?.attributes?.results?.forEach((r) => {
          Object.entries(r.statistics).forEach(([k, v]) => {
            if (typeof v === 'number') prev[k] = (prev[k] || 0) + v;
          });
        });
        setPrevStats(prev);
      } catch (err) {
        setError(err.message);
      } finally {
        setFetching(false);
      }
    }
    fetchStats();
  }, [recentCampaigns.length > 0 ? recentCampaigns.map((c) => c.id).join(',') : null]);

  const rates = useMemo(() => {
    if (!currentStats) return [];
    const delivered = currentStats.delivered || 0;
    const prevDelivered = prevStats?.delivered || 0;
    return STATS.map((stat) => {
      const current = calcRate(currentStats[stat] || 0, delivered);
      const previous = calcRate(prevStats?.[stat] || 0, prevDelivered);
      const change = current !== null && previous !== null ? calcPctChange(current, previous) : null;
      return { stat, current, previous, change, raw: currentStats[stat] || 0 };
    });
  }, [currentStats, prevStats]);

  const formatLabel = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">{error}</div>
      )}

      {/* Aggregate Rates */}
      <div>
        <h2 className="text-sm font-medium text-slate-400 mb-4">Aggregate Rates (Last 30 Days vs Previous 30 Days)</h2>
        {fetching ? (
          <div className="text-slate-500 text-sm">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {rates.map(({ stat, current, change, raw }) => (
              <div key={stat} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{formatLabel(stat)} Rate</div>
                <div className="text-2xl font-bold text-white">
                  {current !== null ? `${current.toFixed(1)}%` : '—'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{raw} total</div>
                {change !== null && (
                  <div className={`text-xs mt-1 ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}% vs prev
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
                <th className="text-right px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentCampaigns.map((c) => (
                <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-white">{c.attributes.name}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {c.attributes.send_time
                      ? new Date(c.attributes.send_time).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/30 text-emerald-400">
                      {c.attributes.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentCampaigns.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500 text-sm">
                    No sent campaigns found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-2">Click on the Campaigns tab to see detailed metrics per campaign.</p>
      </div>
    </div>
  );
}
