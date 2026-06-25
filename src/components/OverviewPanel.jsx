import { useState, useEffect, useMemo } from 'react';
import { queryCampaignValues } from '../api/klaviyo';

const CONVERSION_METRIC_ID = import.meta.env.VITE_KLAVIYO_CONVERSION_METRIC_ID;

const STATS = ['delivered', 'opens_unique', 'clicks_unique', 'unsubscribes', 'bounced'];

function formatLabel(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function OverviewPanel({ campaigns }) {
  const [campaignStats, setCampaignStats] = useState({});
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

        // Map stats by campaign_id (from groupings)
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

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">{error}</div>
      )}

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
