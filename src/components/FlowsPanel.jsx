import { useState, useEffect, useMemo } from 'react';
import { queryFlowValues, queryFlowSeries } from '../api/klaviyo';
import MetricCard from './MetricCard';
import TimeSeriesChart from './TimeSeriesChart';

const CONVERSION_METRIC_ID = import.meta.env.VITE_KLAVIYO_CONVERSION_METRIC_ID;

const FLOW_STATS = [
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

export default function FlowsPanel({ flows, loading }) {
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [seriesData, setSeriesData] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (flows.length > 0 && !selectedFlow) {
      setSelectedFlow(flows[0]);
    }
  }, [flows, selectedFlow]);

  useEffect(() => {
    if (!selectedFlow) return;

    async function fetchReport() {
      setFetching(true);
      setError(null);
      try {
        const filter = `equals(flow_id,'${selectedFlow.id}')`;
        const [values, series] = await Promise.all([
          queryFlowValues({ statistics: FLOW_STATS, filter, timeframe: 'last_30_days', conversionMetricId: CONVERSION_METRIC_ID }),
          queryFlowSeries({ statistics: ['recipients', 'opens', 'clicks'], filter, timeframe: 'last_30_days', interval: 'daily', conversionMetricId: CONVERSION_METRIC_ID }),
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
  }, [selectedFlow]);

  const results = reportData?.data?.attributes?.results || [];

  // Sum up aggregate stats from all result groupings
  const aggregateStats = useMemo(() => {
    if (!results.length) return {};
    const merged = {};
    results.forEach((r) => {
      Object.entries(r.statistics).forEach(([key, val]) => {
        // Values in the "values" endpoint are single numbers
        if (typeof val === 'number') {
          merged[key] = (merged[key] || 0) + val;
        }
      });
    });
    // Recalculate rates
    const out = { ...merged };
    if (out.recipients && out.opens) out.open_rate = out.opens / out.recipients;
    if (out.recipients && out.clicks) out.click_rate = out.clicks / out.recipients;
    if (out.recipients && out.bounced) out.bounce_rate = out.bounced / out.recipients;
    if (out.recipients && out.unsubscribes) out.unsubscribe_rate = out.unsubscribes / out.recipients;
    return out;
  }, [results]);

  // Series: each result has statistics with arrays (daily values)
  // Build chart data: array of { date, metric1: value, metric2: value, ... }
  const seriesChartData = useMemo(() => {
    if (!seriesData?.data?.attributes?.results?.length) return [];
    const seriesResults = seriesData.data.attributes.results;
    
    // We need to align by date index. The groupings have flow_id, send_channel, flow_message_id
    // The statistics arrays are indexed by date
    // Build a map: dateIndex -> { recipients, opens, clicks }
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
      <div className="flex items-center gap-4">
        <label className="text-sm text-slate-400">Select Flow:</label>
        <select
          value={selectedFlow?.id || ''}
          onChange={(e) => setSelectedFlow(flows.find((f) => f.id === e.target.value))}
          className="bg-slate-800 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[300px]"
        >
          {flows.map((flow) => (
            <option key={flow.id} value={flow.id}>
              {flow.attributes.name} ({flow.attributes.status})
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
            {FLOW_STATS.map((stat) => (
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

      {!fetching && selectedFlow && results.length === 0 && (
        <div className="text-slate-500 text-sm py-8 text-center">
          No reporting data available for this flow in the last 30 days.
        </div>
      )}
    </div>
  );
}
