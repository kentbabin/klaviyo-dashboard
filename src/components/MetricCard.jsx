export default function MetricCard({ label, value, isRate = false }) {
  if (value === undefined || value === null) return null;

  const formatNumber = (n) => {
    if (isRate) {
      return (n * 100).toFixed(1) + '%';
    }
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
    return Math.round(n).toLocaleString();
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{formatNumber(value)}</div>
    </div>
  );
}
