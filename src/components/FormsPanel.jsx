import { useState, useEffect, useMemo } from 'react';
import { getForms, queryFormValues } from '../api/klaviyo';
import MetricCard from './MetricCard';

const FORM_STATS = [
  'viewed_form',
  'submits',
];

export default function FormsPanel({ loading }) {
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchForms() {
      try {
        const data = await getForms();
        const allForms = data.data || [];
        setForms(allForms.filter((f) => f.attributes?.status === 'live'));
      } catch (err) {
        setError(err.message);
      }
    }
    fetchForms();
  }, []);

  useEffect(() => {
    if (forms.length > 0 && !selectedForm) {
      setSelectedForm(forms[0]);
    }
  }, [forms, selectedForm]);

  useEffect(() => {
    if (!selectedForm) return;

    async function fetchReport() {
      setFetching(true);
      setError(null);
      try {
        const filter = `equals(form_id,'${selectedForm.id}')`;
        const values = await queryFormValues({ statistics: FORM_STATS, filter, timeframe: 'last_365_days' });
        setReportData(values);
      } catch (err) {
        setError(err.message);
      } finally {
        setFetching(false);
      }
    }
    fetchReport();
  }, [selectedForm]);

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
      <div className="flex items-center gap-4 flex-wrap">
        <label className="text-sm text-slate-400">Select Form:</label>
        <select
          value={selectedForm?.id || ''}
          onChange={(e) => setSelectedForm(forms.find((f) => f.id === e.target.value))}
          className="bg-slate-800 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[300px]"
        >
          {forms.map((form) => (
            <option key={form.id} value={form.id}>
              {form.attributes.name}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FORM_STATS.map((stat) => (
            <MetricCard
              key={stat}
              label={formatLabel(stat)}
              value={aggregateStats[stat]}
            />
          ))}
        </div>
      )}

      {!fetching && selectedForm && results.length === 0 && (
        <div className="text-slate-500 text-sm py-8 text-center">
          No form submission data available for this form in the last 365 days.
        </div>
      )}
    </div>
  );
}
