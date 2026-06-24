import { useState, useEffect, useCallback } from 'react';
import { getFlows, getCampaigns } from './api/klaviyo';
import FlowsPanel from './components/FlowsPanel';
import CampaignsPanel from './components/CampaignsPanel';
import FormsPanel from './components/FormsPanel';

const TABS = ['Flows', 'Campaigns', 'Forms'];

export default function App() {
  const [activeTab, setActiveTab] = useState('Flows');
  const [flows, setFlows] = useState([]);
  const [campaigns, setCampaigns] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch flows first, then campaigns (avoid concurrent 429s on initial load)
      const flowsRes = await getFlows();
      const campaignsRes = await getCampaigns('email');
      setFlows((flowsRes.data || []).filter((f) => f.attributes?.status !== 'draft'));
      setCampaigns((campaignsRes.data || []).filter((c) => !['draft', 'scheduled', 'cancelled'].includes(c.attributes?.status)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">Klaviyo Dashboard</h1>
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-md text-white transition-colors"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <nav className="border-b border-slate-700 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
            <strong>Error:</strong> {error}
          </div>
        )}

        {activeTab === 'Flows' && <FlowsPanel flows={flows} loading={loading} />}
        {activeTab === 'Campaigns' && <CampaignsPanel campaigns={campaigns} loading={loading} />}
        {activeTab === 'Forms' && <FormsPanel loading={loading} />}
      </main>
    </div>
  );
}
