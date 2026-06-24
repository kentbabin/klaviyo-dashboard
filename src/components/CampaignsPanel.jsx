import { useState, useEffect, useMemo } from 'react';
import { queryCampaignValues, queryCampaignSeries } from '../api/klaviyo';
import MetricCard from './MetricCard';
import TimeSeriesChart from './TimeSeriesChart';

const CONVERSION_METRIC_ID = import.meta.env.VITE_KLAVIYO_CONVERSION_METRIC_ID;

const CAMPAIGN_STATS = [
  'recipients',
  'opens',
  'open_rate',
  'clicks',
  'click_rate',
  'bounced',
  'bounce_rate',
  'unsubscribes',
  'unsubscribe_rate',
  'delivery_rate',
];

export default function CampaignsPanel({ campaigns, loading }) {
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [seriesData, setSeriesData] = useState(null);
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
        const [values, series] = await Promise.all([
          queryCampaignValues({ statistics: CAMPAIGN_STATS, filter, timeframe: 'last_30_days', conversionMetricId: CONVERSION_METRIC_ID }),
          queryCampaignSeries({ statistics: ['recipients', 'opens', 'clicks'], filter, timeframe: 'last_30_days', interval: 'daily', conversionMetricId: CONVERSION_METRIC_ID }),
        ]);
        setReportData(values);
        setSeriesData(series);
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
    const out = { ...merged };
    if (out.recipients && out.opens) out.open_rate = out.opens / out.recipients;
    if (out.recipients && out.clicks) out.click_rate = out.clicks / out.recipients;
    if (out.recipients && out.bounced) out.bounce_rate = out.bounced / out.recipients;
    if (out.recipients && out.unsubscribes) out.unsubscribe_rate = out.unsubscribes / out.recipients;
    return out;
  }, [results]);

  const seriesChartData = useMemo(() => {
    if (!seriesData?.data?.attributes?.results?.length) return [];
    const seriesResults = seriesData.data.attributes.results;
    const dateMap = {};
    
    seriesResults.forEach((r) => {
      const stats = r.statistics;
      const len = stats.recipients?.length || 0;
      for (let i = 0; i < len; i++) {
        if (!dateMap[i]) dateMap[i] = { index: i };
        Object.entries(stats).forEach(([key, arr]) => {
          if (Array.isArray(arr)) {
            dateMap[i][key] = (dateMap[i][key] || 0) + (arr[i] || 0);
          }
        });
      }
    });
    
    return Object.values(dateMap).sort((a, b) => a.index - b.index).map((row) => ({
      ...row,
      displayDate: `Day ${row.index + 1}`,
    }));
  }, [seriesData]);

  const formatLabel = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {CAMPAIGN_STATS.map((stat) => (
              <MetricCard
                key={stat}
                label={formatLabel(stat)}
                value={aggregateStats[stat]}
                isRate={stat.includes('rate')}
              />
            ))}
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Performance Over Time (30 days)</h3>
            <TimeSeriesChart
              seriesData={seriesChartData}
              chartMetrics={['recipients', 'opens', 'clicks']}
              formatLabel={formatLabel}
            />
          </div>
        </>
      )}

      {!fetching && selectedCampaign && results.length === 0 && (
        <div className="text-slate-500 text-sm py-8 text-center">
          No reporting data available for this campaign in the last 30 days.
        </div>
      )}
    </div>
  );
}
