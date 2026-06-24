import { useState, useEffect, useMemo } from 'react';
import { queryFlowValues, queryFlowSeries } from '../api/klaviyo';
import MetricCard from './MetricCard';
import TimeSeriesChart from './TimeSeriesChart';

const CONVERSION_METRIC_ID = import.meta.env.VITE_KLAVIYO_CONVERSION_METRIC_ID;

const FLOW_STATS = [
  'recipients',
  'delivered',
  'opens_unique',
  'clicks_unique',
  'bounced',
  'unsubscribes',
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
        const values = await queryFlowValues({ statistics: FLOW_STATS, filter, timeframe: 'last_30_days', conversionMetricId: CONVERSION_METRIC_ID });
        await new Promise((r) => setTimeout(r, 300));
        const series = await queryFlowSeries({ statistics: ['opens_unique', 'clicks_unique', 'delivered'], filter, timeframe: 'last_365_days', interval: 'monthly', conversionMetricId: CONVERSION_METRIC_ID });
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
        if (typeof val === 'number') {
          merged[key] = (merged[key] || 0) + val;
        }
      });
    });
    return merged;
  }, [results]);

  // Series: each result has statistics with arrays indexed by date_times
  // Build chart data: array of { displayDate, opens_unique, clicks_unique, delivered }
  const seriesChartData = useMemo(() => {
    if (!seriesData?.data?.attributes?.results?.length) return [];
    const seriesResults = seriesData.data.attributes.results;
    const dateTimes = seriesData.data.attributes.date_times || [];

    let maxLen = 0;
    seriesResults.forEach((r) => {
      Object.values(r.statistics).forEach((arr) => {
        if (Array.isArray(arr) && arr.length > maxLen) maxLen = arr.length;
      });
    });

    const rows = [];
    for (let i = 0; i < maxLen; i++) {
      const row = { index: i, displayDate: dateTimes[i] ? dateTimes[i].slice(0, 10) : `Day ${i + 1}` };
      seriesResults.forEach((r) => {
        Object.entries(r.statistics).forEach(([key, arr]) => {
          if (Array.isArray(arr)) {
            const val = arr[i];
            if (val !== null && val !== undefined && !isNaN(parseFloat(val))) {
              row[key] = (row[key] || 0) + parseFloat(val);
            }
          }
        });
      });
      rows.push(row);
    }

    return rows;
  }, [seriesData]);

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
              />
            ))}
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Performance Over Time (365 days)</h3>
            <TimeSeriesChart
              seriesData={seriesChartData}
              chartMetrics={['opens_unique', 'clicks_unique', 'delivered']}
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
