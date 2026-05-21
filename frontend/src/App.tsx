import React from 'react';
import { 
  LayoutDashboard, 
  CalendarRange, 
  ShieldAlert, 
  Bot, 
  BarChart3, 
  Download, 
  Plus, 
  Edit3, 
  Trash2, 
  MapPin,
  Calendar,
  FileText
} from 'lucide-react';
import { DashboardStats } from './components/DashboardStats';
import { JourneyEntryForm } from './components/JourneyEntryForm';
import { LimitsSettings } from './components/LimitsSettings';
import { LLMAssistant } from './components/LLMAssistant';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { CalendarView } from './components/CalendarView';
import { JourneyEntry, LimitSetting, LimitAlert, Message } from './types';

export default function App() {
  const [activeTab, setActiveTab] = React.useState<'dashboard' | 'timeline' | 'limits' | 'assistant' | 'analytics'>('dashboard');
  
  // Data State
  const [entries, setEntries] = React.useState<JourneyEntry[]>([]);
  const [limits, setLimits] = React.useState<LimitSetting[]>([]);
  const [alerts, setAlerts] = React.useState<LimitAlert[]>([]);
  const [analytics, setAnalytics] = React.useState<{
    countryStays: { country: string; days: number }[];
    trends: Array<{ month: string; [country: string]: string | number }>;
  }>({ countryStays: [], trends: [] });

  const [isLoading, setIsLoading] = React.useState(true);

  // Entry Form Modal
  const [showEntryModal, setShowEntryModal] = React.useState(false);
  const [selectedEntry, setSelectedEntry] = React.useState<JourneyEntry | undefined>(undefined);
  const [prefillDate, setPrefillDate] = React.useState<string | undefined>(undefined);

  // Fetch all dashboard data
  const fetchData = async () => {
    try {
      const [entriesRes, limitsRes, alertsRes, analyticsRes] = await Promise.all([
        fetch('/api/entries'),
        fetch('/api/settings/limits'),
        fetch('/api/settings/status'),
        fetch('/api/reports/analytics')
      ]);

      if (entriesRes.ok) setEntries(await entriesRes.json());
      if (limitsRes.ok) setLimits(await limitsRes.json());
      if (alertsRes.ok) setAlerts(await alertsRes.json());
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
    } catch (err) {
      console.error('Error fetching TravelTracker data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  // Compute start/end dates and stay duration for each entry in the chronological chain
  const computedEntries = React.useMemo(() => {
    return entries.map((entry, idx) => {
      const startStr = entry.entry_time.substring(0, 10);
      const hasNext  = idx < entries.length - 1;

      // Non-last: stay ends on next entry's arrival (exclusive upper-bound).
      // Last:     stay ends on arrival date (1 day presence).
      const endStr = hasNext
        ? entries[idx + 1].entry_time.substring(0, 10)
        : startStr;

      const dStart = new Date(startStr + 'T00:00:00Z');
      const dEnd   = new Date(endStr   + 'T00:00:00Z');
      let durationDays = Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24));
      if (durationDays < 1) durationDays = 1; // always count at least the arrival day
      
      return { ...entry, startDate: startStr, endDate: endStr, durationDays };
    });
  }, [entries]);

  // All entries and analytics — no segment filtering
  const allStats = React.useMemo(() => ({
    entriesList: computedEntries,
    countryStays: analytics.countryStays
  }), [computedEntries, analytics.countryStays]);

  // CRUD Handlers for Journey Entries
  const handleSaveEntry = async (formData: FormData, isEdit: boolean, entryId?: number) => {
    const url = isEdit ? `/api/entries/${entryId}` : '/api/entries';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      body: formData
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save presence entry');
    }

    await fetchData();
  };

  const handleDeleteEntry = async (id: number) => {
    if (!window.confirm('Delete this presence log entry? This will permanently remove the proof of stay and its receipt image.')) {
      return;
    }

    try {
      const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete entry');
      }
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error deleting presence entry');
    }
  };

  // CRUD Handlers for Limits
  const handleSaveLimit = async (limitSetting: { country: string; max_days: number; rolling_period_days: number }) => {
    const res = await fetch('/api/settings/limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(limitSetting)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save limit configuration');
    }

    await fetchData();
  };

  const handleDeleteLimit = async (id: number) => {
    if (!window.confirm('Delete this country limit configuration?')) {
      return;
    }

    try {
      const res = await fetch(`/api/settings/limits/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete limit');
      }
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error deleting limit');
    }
  };

  // LLM Query Handler
  const handleQueryLLM = async (message: string, history: Message[], model: string) => {
    const res = await fetch('/api/llm/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, model })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to query LLM');
    }

    const data = await res.json();
    return data.response;
  };

  // PDF Export Trigger
  const handleExportPDF = () => {
    window.open('/api/reports/export', '_blank');
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255, 255, 255, 0.1)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Orchestrating TravelTracker UI...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Navigation Navbar */}
      <nav className="navbar">
        <div className="nav-brand">
          <CalendarRange size={24} style={{ color: 'var(--color-primary)' }} />
          <span>TravelTracker</span>
        </div>
        
        <div className="nav-links">
          <button 
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>
          <button 
            className={`nav-tab ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            <CalendarRange size={16} /> Travel Timeline
          </button>
          <button 
            className={`nav-tab ${activeTab === 'limits' ? 'active' : ''}`}
            onClick={() => setActiveTab('limits')}
          >
            <ShieldAlert size={16} /> Limit Settings
          </button>
          <button 
            className={`nav-tab ${activeTab === 'assistant' ? 'active' : ''}`}
            onClick={() => setActiveTab('assistant')}
          >
            <Bot size={16} /> AI Chat
          </button>
          <button 
            className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={16} /> Trends & Stays
          </button>
        </div>

        <button className="btn btn-primary" onClick={handleExportPDF}>
          <Download size={16} /> Export PDF Report
        </button>
      </nav>

      {/* Main Workspace Layout */}
      <main className="dashboard-layout">
        
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="section-title">Dashboard Overview</h2>
              <button className="btn btn-primary" onClick={() => { setSelectedEntry(undefined); setShowEntryModal(true); }}>
                <Plus size={16} /> Log Entry (Proof of Presence)
              </button>
            </div>
            
            <DashboardStats 
              entries={allStats.entriesList} 
              alerts={alerts} 
              onNavigateToLimits={() => setActiveTab('limits')} 
            />

            {/* Interactive Calendar — click any day to create/edit entry */}
            <CalendarView
              entries={computedEntries}
              onDayClick={(dateStr, existingEntry) => {
                if (existingEntry) {
                  setSelectedEntry(existingEntry);
                  setPrefillDate(undefined);
                } else {
                  setSelectedEntry(undefined);
                  setPrefillDate(dateStr);
                }
                setShowEntryModal(true);
              }}
            />

            {/* Recent Stays timeline summary */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1.25rem' }}>
                Recent Travels
              </h3>
              
              {allStats.entriesList.length === 0 ? (
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                  No presence entries found. Add your first travel record above!
                </p>
              ) : (
                <div className="timeline">
                  {allStats.entriesList.slice().reverse().slice(0, 3).map(entry => (
                    <div className="timeline-item" key={entry.id}>
                      <div className="timeline-dot"></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                            {entry.city}, {entry.country}
                          </h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            Arrival: {entry.entry_time} | Calculated Stay: <strong>{entry.durationDays} day(s)</strong>
                          </p>
                          {entry.notes && (
                            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                              Note: {entry.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="section-title">Travel Chronological Timeline</h2>
              <button className="btn btn-primary" onClick={() => { setSelectedEntry(undefined); setShowEntryModal(true); }}>
                <Plus size={16} /> Log Entry (Proof of Presence)
              </button>
            </div>

            {computedEntries.length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
                <CalendarRange size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
                <h3 style={{ marginBottom: '0.5rem' }}>No travel presence logged</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  Log an entry containing country, city, date & time, and an attached ticket/receipt to infer stays.
                </p>
                <button className="btn btn-primary" onClick={() => { setSelectedEntry(undefined); setShowEntryModal(true); }}>
                  <Plus size={16} /> Log Entry
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {computedEntries.slice().reverse().map(entry => (
                  <div key={entry.id} className="glass-card">
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <MapPin size={20} color="var(--color-primary)" />
                        <div>
                          <h3 style={{ fontSize: '1.3rem', display: 'inline' }}>{entry.city}, {entry.country}</h3>
                          <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            <Calendar size={14} /> Arrival: <strong>{entry.entry_time}</strong>  |  Stay Duration: <strong>{entry.durationDays} day(s)</strong> (until {entry.endDate})
                          </p>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', height: 'fit-content' }}>
                        <button className="btn btn-secondary" onClick={() => { setSelectedEntry(entry); setShowEntryModal(true); }}>
                          <Edit3 size={14} /> Edit Entry
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDeleteEntry(entry.id!)}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>

                    {/* Entry Details & Proof image */}
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      {entry.file_path && (
                        <div style={{ width: '120px', height: '120px', flexShrink: 0 }}>
                          <img 
                            src={`/uploads/${entry.file_path}`} 
                            alt={entry.file_name} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--glass-border)', cursor: 'pointer' }}
                            onClick={() => window.open(`/uploads/${entry.file_path}`, '_blank')}
                            title="Click to view full size proof image"
                          />
                        </div>
                      )}
                      
                      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {entry.file_name && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileText size={16} color="var(--text-muted)" />
                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{entry.file_name}</span>
                          </div>
                        )}
                        
                        {entry.notes && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', borderLeft: '3px solid var(--glass-border)', paddingLeft: '8px', fontStyle: 'italic', marginTop: '0.25rem' }}>
                            {entry.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'limits' && (
          <div>
            <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>Country Limit Configurations</h2>
            <LimitsSettings 
              limits={limits} 
              alerts={alerts} 
              onSaveLimit={handleSaveLimit} 
              onDeleteLimit={handleDeleteLimit} 
            />
          </div>
        )}

        {activeTab === 'assistant' && (
          <div>
            <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>Query Travel History</h2>
            <LLMAssistant onQueryLLM={handleQueryLLM} />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="section-title">Travel Metrics & Charts</h2>
            </div>
            
            <AnalyticsCharts analytics={{
              countryStays: allStats.countryStays,
              trends: analytics.trends
            }} />
          </div>
        )}

      </main>

      {showEntryModal && (
        <JourneyEntryForm 
          entry={selectedEntry}
          prefillDate={prefillDate}
          onSave={handleSaveEntry}
          onClose={() => { setShowEntryModal(false); setSelectedEntry(undefined); setPrefillDate(undefined); }}
        />
      )}
    </div>
  );
}
