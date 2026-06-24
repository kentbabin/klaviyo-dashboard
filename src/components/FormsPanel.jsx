import { useState, useEffect, useMemo } from 'react';
import { queryFormValues, queryFormSeries } from '../api/klaviyo';
import MetricCard from './MetricCard';
import TimeSeriesChart from './TimeSeriesChart';

const CONVERSION_METRIC_ID = import.meta.env.VITE_KLAVIYO_CONVERSION_METRIC_ID;

// Forms: submissions metric
const FORM_STATS = [
  'viewed_form',
  'submits',
];

export default function FormsPanel({ loading }) {
  const [reportData, setReportData] = useState(null);
  const [seriesData, setSeriesData] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchReport() {
      setFetching(true);
      setError(null);
      try {
        const values = await queryFormValues({ statistics: FORM_STATS, timeframe: 'last_30_days', conversionMetricId: CONVERSION_METRIC_ID });
        await new Promise((r) => setTimeout(r, 300));
        const series = await queryFormSeries({ statistics: ['submits'], timeframe: 'last_30_days', interval: 'daily', conversionMetricId: CONVERSION_METRIC_ID });
        setReportData(values);
        setSeriesData(series);
      } catch (err) {
        setError(err.message);
      } finally {
        setFetching(false);
      }
    }
    fetchReport();
  }, []);

  const results = reportData?.data?.attributes?.results || [];

  const aggregateStats = useMemo(() => {
    if (!results.length) return {};
    const merged = {};
    results.forEach((r) => {
      Object.entries(r.statistics).forEach(([key, val]) => {
        merged[key] = (merged[key] || 0) + parseFloat(val || 0);
      });
    });
    return merged;
  }, [results]);

  const seriesByDate = useMemo(() => {
    if (!seriesData?.data?.attributes?.results?.length) return [];
    const results = seriesData.data.attributes.results;

    let maxLen = 0;
    results.forEach((r) => {
      Object.values(r.statistics).forEach((arr) => {
        if (Array.isArray(arr) && arr.length > maxLen) maxLen = arr.length;
      });
    });

    const rows = [];
    for (let i = 0; i < maxLen; i++) {
      const row = { index: i, displayDate: `Day ${i + 1}` };
      results.forEach((r) => {
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

  const formatLabel = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">{error}</div>
      )}

      {fetching && (
        <div className="text-slate-400 text-sm">Loading report data...</div>
      )}

      {!fetching && results.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(aggregateStats).map(([stat, val]) => (
              <MetricCard
                key={stat}
                label={formatLabel(stat)}
                value={val}
                isRate={stat.includes('rate')}
              />
            ))}
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Submissions Over Time (30 days)</h3>
            <TimeSeriesChart
              seriesData={seriesByDate}
              chartMetrics={Object.keys(aggregateStats).slice(0, 3)}
              formatLabel={formatLabel}
            />
          </div>
        </>
      )}

      {!fetching && results.length === 0 && (
        <div className="text-slate-500 text-sm py-8 text-center">
          No form submission data available in the last 30 days.
        </div>
      )}
    </div>
  );
}
