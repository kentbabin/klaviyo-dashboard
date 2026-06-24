import { useState, useEffect, useMemo } from 'react';
import { queryFormValues } from '../api/klaviyo';
import MetricCard from './MetricCard';

// Forms: submissions metric
const FORM_STATS = [
  'viewed_form',
  'submits',
];

export default function FormsPanel({ loading }) {
  const [reportData, setReportData] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchReport() {
      setFetching(true);
      setError(null);
      try {
        const values = await queryFormValues({ statistics: FORM_STATS, timeframe: 'last_365_days' });
        setReportData(values);
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(aggregateStats).map(([stat, val]) => (
            <MetricCard
              key={stat}
              label={formatLabel(stat)}
              value={val}
            />
          ))}
        </div>
      )}

      {!fetching && results.length === 0 && (
        <div className="text-slate-500 text-sm py-8 text-center">
          No form submission data available in the last 365 days.
        </div>
      )}
    </div>
  );
}
