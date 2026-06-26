import { useState, useEffect } from 'react';
import { getCached, setCached } from '../api/cache';

const CACHE_KEY = 'lists_counts';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Count profiles in a list by paginating through all pages
async function countListProfiles(listId) {
  const cacheKey = `list_count_${listId}`;
  const cached = getCached(cacheKey, CACHE_TTL);
  if (cached !== null) return cached;

  let count = 0;
  let url = `/lists/${listId}/profiles/?page_size=100`;

  while (url) {
    const response = await fetch(`/api/proxy?path=${encodeURIComponent(url)}`);
    const data = await response.json();
    count += data.data?.length || 0;
    url = data.links?.next || null;
  }

  setCached(cacheKey, count);
  return count;
}

export default function ListsPanel({ lists }) {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!lists || lists.length === 0) return;

    // Check if all counts are cached
    const allCached = lists.every((l) => getCached(`list_count_${l.id}`, CACHE_TTL) !== null);
    if (allCached) {
      const cachedCounts = {};
      lists.forEach((l) => {
        cachedCounts[l.id] = getCached(`list_count_${l.id}`, CACHE_TTL);
      });
      setCounts(cachedCounts);
      return;
    }

    // Fetch counts for all lists
    async function fetchCounts() {
      setLoading(true);
      setError(null);
      try {
        const newCounts = {};
        for (const list of lists) {
          newCounts[list.id] = await countListProfiles(list.id);
        }
        setCounts(newCounts);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchCounts();
  }, [lists.length, lists.map(l => l.id).join(',')]);

  const totalProfiles = Object.values(counts).reduce((sum, c) => sum + c, 0);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">{error}</div>
      )}

      {/* Summary */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-white">{lists.length}</span>
          <span className="text-sm text-slate-400">lists</span>
          <span className="text-slate-600 mx-2">|</span>
          <span className="text-2xl font-bold text-white">{totalProfiles.toLocaleString()}</span>
          <span className="text-sm text-slate-400">total profiles</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Profile counts cached for 24 hours. {loading && 'Loading...'}
        </p>
      </div>

      {/* Lists Table */}
      <div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">List Name</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-left px-4 py-3">Opt-in</th>
                <th className="text-right px-4 py-3">Profiles</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((list) => {
                const count = counts[list.id];
                return (
                  <tr key={list.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-white">{list.attributes.name}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {list.attributes.created
                        ? new Date(list.attributes.created).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
                        {list.attributes.opt_in_process || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {loading && count === undefined ? (
                        <span className="text-slate-500">...</span>
                      ) : (
                        count?.toLocaleString() || '0'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
