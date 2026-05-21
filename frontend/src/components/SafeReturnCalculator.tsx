import React from 'react';
import { Navigation, CalendarCheck, AlertTriangle, Loader2 } from 'lucide-react';

interface SafeReturnResult {
  country: string;
  stayDays: number;
  earliestReturnDate: string | null;
  daysAvailableOnReturn: number;
  rollingPeriod: number;
  maxDays: number;
  message?: string;
}

interface LimitSetting {
  id?: number;
  country: string;
  max_days: number;
  rolling_period_days: number;
}

interface SafeReturnCalculatorProps {
  limits: LimitSetting[];
}

export const SafeReturnCalculator: React.FC<SafeReturnCalculatorProps> = ({ limits }) => {
  const [country, setCountry] = React.useState('');
  const [stayDays, setStayDays] = React.useState('7');
  const [result, setResult] = React.useState<SafeReturnResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!country) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/settings/safe-return?country=${encodeURIComponent(country)}&stayDays=${Math.max(1, parseInt(stayDays, 10) || 1)}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Calculation failed');
      }
      setResult(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

  const daysUntilReturn = result?.earliestReturnDate
    ? Math.max(0, Math.round(
        (new Date(result.earliestReturnDate + 'T00:00:00Z').getTime() - new Date().setUTCHours(0,0,0,0)) / 86400000
      ))
    : null;

  return (
    <div className="glass-card" style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Navigation size={20} style={{ color: 'var(--color-secondary)' }} />
        Safe Return Date Calculator
      </h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Find the earliest date you can return to a country for a planned stay without breaching your rolling-window limit.
      </p>

      <form onSubmit={handleCalculate} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0, minWidth: '200px', flex: 1 }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>Country</label>
          <select
            className="form-control"
            style={{ fontSize: '0.88rem' }}
            value={country}
            onChange={e => { setCountry(e.target.value); setResult(null); }}
            required
          >
            <option value="">— Select country —</option>
            {limits.map(l => (
              <option key={l.id} value={l.country}>{l.country}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ margin: 0, width: '140px' }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>Planned stay (days)</label>
          <input
            type="number"
            className="form-control"
            style={{ fontSize: '0.88rem' }}
            min="1"
            max="365"
            value={stayDays}
            onChange={e => { setStayDays(e.target.value); setResult(null); }}
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ fontSize: '0.85rem', padding: '0.5rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          disabled={loading || !country}
        >
          {loading
            ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Calculating…</>
            : <><CalendarCheck size={14} /> Calculate</>
          }
        </button>
      </form>

      {error && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', borderLeft: '3px solid var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={16} color="var(--color-danger)" />
          <span style={{ fontSize: '0.88rem', color: '#fca5a5' }}>{error}</span>
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1.25rem' }}>
          {result.earliestReturnDate ? (
            <div style={{
              padding: '1.25rem',
              borderRadius: '10px',
              background: 'rgba(139,92,246,0.07)',
              border: '1px solid rgba(139,92,246,0.2)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '2rem',
              alignItems: 'center'
            }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>EARLIEST SAFE RETURN</p>
                <p style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-secondary)', lineHeight: 1 }}>
                  {formatDate(result.earliestReturnDate)}
                </p>
                {daysUntilReturn !== null && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    {daysUntilReturn === 0
                      ? '→ You can return tomorrow'
                      : `→ ${daysUntilReturn} day${daysUntilReturn !== 1 ? 's' : ''} from today`}
                  </p>
                )}
              </div>

              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>DAYS AVAILABLE ON RETURN</p>
                <p style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-success)', lineHeight: 1 }}>
                  {result.daysAvailableOnReturn}
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  of {result.maxDays} max in {result.rollingPeriod}-day window
                </p>
              </div>

              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>PLANNED STAY</p>
                <p style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>{result.stayDays}d</p>
              </div>
            </div>
          ) : (
            <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', borderLeft: '3px solid var(--color-danger)' }}>
              <p style={{ fontSize: '0.9rem', color: '#fca5a5' }}>
                {result.message || `No viable return date found for a ${result.stayDays}-day stay within the next year.`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
