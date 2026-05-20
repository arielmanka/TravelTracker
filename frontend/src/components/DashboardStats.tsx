import React from 'react';
import { ShieldAlert, Compass, Receipt, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { JourneyEntry, LimitAlert } from '../types';

interface DashboardStatsProps {
  entries: JourneyEntry[];
  alerts: LimitAlert[];
  onNavigateToLimits: () => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ entries, alerts, onNavigateToLimits }) => {
  // Aggregate statistics
  const totalEntries = entries.length;
  
  const visitedCountries = React.useMemo(() => {
    const countries = new Set<string>();
    entries.forEach(e => {
      if (e.country) countries.add(e.country.trim().toLowerCase());
    });
    return countries.size;
  }, [entries]);

  const activeWarnings = alerts.filter(a => a.status === 'warning' || a.status === 'exceeded' || a.peakExceeded);

  return (
    <div>
      <div className="grid-3" style={{ marginBottom: '2rem' }}>
        <div className="glass-card interactive">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>PRESENCE ENTRIES</p>
              <h3 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>{totalEntries}</h3>
            </div>
            <div style={{ padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', color: 'var(--color-primary)' }}>
              <Receipt size={24} />
            </div>
          </div>
        </div>

        <div className="glass-card interactive">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>COUNTRIES VISITED</p>
              <h3 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>{visitedCountries}</h3>
            </div>
            <div style={{ padding: '0.75rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '50%', color: 'var(--color-secondary)' }}>
              <Compass size={24} />
            </div>
          </div>
        </div>

        <div className="glass-card interactive">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>LIMIT WARNINGS</p>
              <h3 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>{activeWarnings.length}</h3>
            </div>
            <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', color: 'var(--color-danger)' }}>
              <ShieldAlert size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Travel Limit Notifications & Warnings
        </h3>
        
        {activeWarnings.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', borderLeft: '4px solid var(--color-success)' }}>
            <CheckCircle2 color="var(--color-success)" size={20} />
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              All stays are currently within limits. No rolling alerts or historical exceedances active.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activeWarnings.map((alert, idx) => {
              const isExceeded = alert.status === 'exceeded' || alert.peakExceeded;
              return (
                <div 
                  key={idx} 
                  className={`alert-card ${isExceeded ? 'exceeded' : ''}`}
                  style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isExceeded ? (
                      <AlertOctagon color="var(--color-danger)" size={18} />
                    ) : (
                      <AlertTriangle color="var(--color-warning)" size={18} />
                    )}
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: isExceeded ? '#fca5a5' : '#fcd34d' }}>
                      {alert.country} Limit Alert
                    </span>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{alert.message}</p>
                  {alert.peakExceeded && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Note: Historical peak spent was {alert.maxDaysSpentAnyWindow} days (exceeds limit of {alert.maxDays} days) in the window ending on {alert.peakWindowEnd}.
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <span>Current Stay Window: <strong>{alert.daysSpentCurrentWindow} / {alert.maxDays} days</strong></span>
                    <span>Rolling Period: <strong>{alert.rollingPeriod} days</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <button 
          className="btn btn-secondary" 
          onClick={onNavigateToLimits}
          style={{ marginTop: '1.25rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
        >
          Manage Country Limits Settings
        </button>
      </div>
    </div>
  );
};
