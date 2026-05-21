import React from 'react';
import { TrendingDown, Calendar, AlertTriangle, CheckCircle2, AlertOctagon, ChevronRight } from 'lucide-react';

interface ForecastResult {
  country: string;
  departureDate: string;
  rollingPeriod: number;
  maxDays: number;
  daysSpentOnDate: number;
  daysRemaining: number;
  windowStart: string;
  status: 'safe' | 'warning' | 'critical' | 'exceeded';
}

interface LimitAlert {
  country: string;
  maxDays: number;
  rollingPeriod: number;
  daysSpentCurrentWindow: number;
  status: string;
}

interface ForecastWidgetProps {
  alerts: LimitAlert[];
}

export const ForecastWidget: React.FC<ForecastWidgetProps> = ({ alerts }) => {
  // One departure-date picker per country
  const [dates, setDates] = React.useState<Record<string, string>>({});
  const [forecasts, setForecasts] = React.useState<Record<string, ForecastResult | null>>({});
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const today = new Date().toISOString().split('T')[0];

  const fetchForecast = async (country: string, departureDate: string) => {
    setLoading(prev => ({ ...prev, [country]: true }));
    setErrors(prev => ({ ...prev, [country]: '' }));
    try {
      const res = await fetch(
        `/api/settings/forecast?country=${encodeURIComponent(country)}&departureDate=${departureDate}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Forecast failed');
      }
      const data: ForecastResult = await res.json();
      setForecasts(prev => ({ ...prev, [country]: data }));
    } catch (err: any) {
      setErrors(prev => ({ ...prev, [country]: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, [country]: false }));
    }
  };

  if (alerts.length === 0) return null;

  return (
    <div className="glass-card" style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <TrendingDown size={20} style={{ color: 'var(--color-primary)' }} />
        Days Remaining Forecast
      </h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Pick a hypothetical departure date to see projected days consumed and remaining in the rolling window — assumes continuous stay in the last-logged country until that date.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {alerts.map(alert => {
          const forecast = forecasts[alert.country];
          const isLoading = loading[alert.country];
          const error = errors[alert.country];
          const chosenDate = dates[alert.country] || '';

          const statusColor = forecast
            ? forecast.status === 'exceeded' ? 'var(--color-danger)'
            : forecast.status === 'critical'  ? '#f97316'
            : forecast.status === 'warning'   ? 'var(--color-warning)'
            : 'var(--color-success)'
            : 'var(--color-primary)';

          return (
            <div
              key={alert.country}
              style={{
                border: '1px solid var(--glass-border)',
                borderRadius: '10px',
                padding: '1rem 1.25rem',
                background: 'rgba(255,255,255,0.01)'
              }}
            >
              {/* Country header + current usage */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>{alert.country}</span>
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {alert.daysSpentCurrentWindow} / {alert.maxDays} days used today &nbsp;·&nbsp; {alert.rollingPeriod}-day window
                  </span>
                </div>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '20px',
                  background: alert.status === 'exceeded' ? 'rgba(239,68,68,0.15)'
                            : alert.status === 'warning'  ? 'rgba(245,158,11,0.15)'
                            : 'rgba(16,185,129,0.15)',
                  color: alert.status === 'exceeded' ? '#fca5a5'
                       : alert.status === 'warning'  ? '#fcd34d'
                       : '#6ee7b7'
                }}>
                  {alert.status.toUpperCase()}
                </span>
              </div>

              {/* Progress bar — current usage */}
              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '4px', height: '6px', marginBottom: '1rem' }}>
                <div style={{
                  height: '100%',
                  borderRadius: '4px',
                  width: `${Math.min(100, (alert.daysSpentCurrentWindow / alert.maxDays) * 100)}%`,
                  background: alert.status === 'exceeded' ? 'var(--color-danger)'
                            : alert.status === 'warning'  ? 'var(--color-warning)'
                            : 'var(--color-primary)',
                  transition: 'width 0.3s ease'
                }} />
              </div>

              {/* Date picker row */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <Calendar size={14} />
                  Departure date:
                </div>
                <input
                  type="date"
                  className="form-control"
                  style={{ width: '180px', fontSize: '0.85rem', padding: '0.35rem 0.6rem' }}
                  min={today}
                  value={chosenDate}
                  onChange={e => setDates(prev => ({ ...prev, [alert.country]: e.target.value }))}
                />
                <button
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  disabled={!chosenDate || isLoading}
                  onClick={() => fetchForecast(alert.country, chosenDate)}
                >
                  {isLoading ? 'Calculating…' : <><ChevronRight size={14} /> Project</>}
                </button>
              </div>

              {/* Error */}
              {error && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--color-danger)' }}>{error}</p>
              )}

              {/* Forecast result */}
              {forecast && (
                <div style={{
                  marginTop: '0.9rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  background: `color-mix(in srgb, ${statusColor} 8%, transparent)`,
                  borderLeft: `3px solid ${statusColor}`,
                  display: 'flex',
                  gap: '2rem',
                  flexWrap: 'wrap',
                  alignItems: 'center'
                }}>
                  {forecast.status === 'exceeded'
                    ? <AlertOctagon size={18} color="var(--color-danger)" />
                    : forecast.status === 'critical' || forecast.status === 'warning'
                    ? <AlertTriangle size={18} color="var(--color-warning)" />
                    : <CheckCircle2 size={18} color="var(--color-success)" />
                  }
                  <div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Days consumed by {forecast.departureDate}</p>
                    <p style={{ fontSize: '1.3rem', fontWeight: 700 }}>{forecast.daysSpentOnDate}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Days remaining</p>
                    <p style={{ fontSize: '1.3rem', fontWeight: 700, color: statusColor }}>{forecast.daysRemaining}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Window start</p>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{forecast.windowStart}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
