import { useState, useEffect, useMemo } from 'react';
import { queryCampaignValues } from '../api/klaviyo';
import MetricCard from './MetricCard';

const CONVERSION_METRIC_ID = import.meta.env.VITE_KLAVIYO_CONVERSION_METRIC_ID;

const CAMPAIGN_STATS = [
  'recipients',
  'delivered',
  'opens_unique',
  'clicks_unique',
  'bounced',
  'unsubscribes',
];

export default function CampaignsPanel({ campaigns, loading }) {
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (campaigns.length > 0 && !selectedCampaign) {
      setSelectedCampaign(campaigns[0]);
    }
  }, [campaigns, selectedCampaign]);

  useEffect(() => {
    if (!selectedCampaign) return;

    async function fetchReport() {
      setFetching(true);
      setError(null);
      try {
        const filter = `equals(campaign_id,'${selectedCampaign.id}')`;
        const values = await queryCampaignValues({ statistics: CAMPAIGN_STATS, filter, timeframe: 'last_365_days', conversionMetricId: CONVERSION_METRIC_ID });
        setReportData(values);
      } catch (err) {
        setError(err.message);
      } finally {
        setFetching(false);
      }
    }
    fetchReport();
  }, [selectedCampaign]);

  const results = reportData?.data?.attributes?.results || [];

  const aggregateStats = useMemo(() => {
    if (!results.length) return {};
    const merged = {};
    results.forEach((r) => {
      Object.entries(r.statistics).forEach(([key, val]) => {
        if (typeof val === 'number') {
          merged[key] = (merged[key] || 0) + val;
        }
      });
    });
    return merged;
  }, [results]);

  const formatLabel = (key) => {
    const label = key
      .replace(/_unique/g, ' unique')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/^Unique /, 'Unique ');
    return label;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <label className="text-sm text-slate-400">Select Campaign:</label>
        <select
          value={selectedCampaign?.id || ''}
          onChange={(e) => setSelectedCampaign(campaigns.find((c) => c.id === e.target.value))}
          className="bg-slate-800 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[300px]"
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.attributes.name} — {c.attributes.status}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">{error}</div>
      )}

      {fetching && (
        <div className="text-slate-400 text-sm">Loading report data...</div>
      )}

      {!fetching && results.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {CAMPAIGN_STATS.map((stat) => (
            <MetricCard
              key={stat}
              label={formatLabel(stat)}
              value={aggregateStats[stat]}
            />
          ))}
        </div>
      )}

      {!fetching && selectedCampaign && results.length === 0 && (
        <div className="text-slate-500 text-sm py-8 text-center">
          No reporting data available for this campaign in the last 30 days.
        </div>
      )}
    </div>
  );
}
