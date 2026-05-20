import React from 'react';
import { Save, Trash2, ShieldAlert, ShieldCheck, Plus, Globe, Building } from 'lucide-react';
import { LimitSetting, LimitAlert, Country, City } from '../types';

interface LimitsSettingsProps {
  limits: LimitSetting[];
  alerts: LimitAlert[];
  onSaveLimit: (limit: { country: string; max_days: number; rolling_period_days: number }) => Promise<void>;
  onDeleteLimit: (id: number) => Promise<void>;
}

export const LimitsSettings: React.FC<LimitsSettingsProps> = ({
  limits,
  alerts,
  onSaveLimit,
  onDeleteLimit
}) => {
  const [country, setCountry] = React.useState('');
  const [maxDays, setMaxDays] = React.useState('90');
  const [rollingPeriod, setRollingPeriod] = React.useState('180');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Countries and Cities settings state
  const [countriesList, setCountriesList] = React.useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = React.useState<Country | null>(null);
  const [citiesList, setCitiesList] = React.useState<City[]>([]);
  const [newCountryName, setNewCountryName] = React.useState('');
  const [newCityName, setNewCityName] = React.useState('');

  const loadCountries = async () => {
    try {
      const res = await fetch('/api/settings/countries');
      if (res.ok) {
        const data = await res.json();
        setCountriesList(data);
        // Reselect if already selected
        if (selectedCountry) {
          const stillExists = data.find((c: Country) => c.id === selectedCountry.id);
          if (!stillExists) setSelectedCountry(null);
        }
      }
    } catch (err) {
      console.error('Error fetching countries list:', err);
    }
  };

  const loadCities = async (countryId: number) => {
    try {
      const res = await fetch(`/api/settings/countries/${countryId}/cities`);
      if (res.ok) setCitiesList(await res.json());
    } catch (err) {
      console.error('Error fetching cities list:', err);
    }
  };

  React.useEffect(() => {
    loadCountries();
  }, []);

  React.useEffect(() => {
    if (selectedCountry) {
      loadCities(selectedCountry.id);
    } else {
      setCitiesList([]);
    }
  }, [selectedCountry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!country.trim()) {
      return setError('Country name is required.');
    }
    if (!maxDays || parseInt(maxDays) <= 0) {
      return setError('Maximum days must be a positive integer.');
    }
    if (!rollingPeriod || parseInt(rollingPeriod) <= 0) {
      return setError('Rolling period must be a positive integer.');
    }

    try {
      setLoading(true);
      await onSaveLimit({
        country: country.trim(),
        max_days: parseInt(maxDays),
        rolling_period_days: parseInt(rollingPeriod)
      });
      // Reset form
      setCountry('');
      setMaxDays('90');
      setRollingPeriod('180');
    } catch (err: any) {
      setError(err.message || 'Error occurred while saving limit setting.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSelect = (limit: LimitSetting) => {
    setCountry(limit.country);
    setMaxDays(limit.max_days.toString());
    setRollingPeriod(limit.rolling_period_days.toString());
  };

  const handleAddCountry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCountryName.trim()) return;
    try {
      const res = await fetch('/api/settings/countries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCountryName.trim() })
      });
      if (res.ok) {
        setNewCountryName('');
        await loadCountries();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add country');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCountry = async (id: number) => {
    if (!window.confirm('Delete this country? This will also delete all its registered cities.')) return;
    try {
      const res = await fetch(`/api/settings/countries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadCountries();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCountry || !newCityName.trim()) return;
    try {
      const res = await fetch(`/api/settings/countries/${selectedCountry.id}/cities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCityName.trim() })
      });
      if (res.ok) {
        setNewCityName('');
        await loadCities(selectedCountry.id);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add city');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCity = async (id: number) => {
    if (!window.confirm('Delete this city?')) return;
    try {
      const res = await fetch(`/api/settings/cities/${id}`, { method: 'DELETE' });
      if (res.ok && selectedCountry) {
        await loadCities(selectedCountry.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="grid-2">
        {/* Save Settings Form */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1.25rem' }}>Configure Country Day Limit Rule</h3>
          
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', borderLeft: '4px solid var(--color-danger)', borderRadius: '6px', color: '#fca5a5', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Country Name</label>
              {/* Closed searchable list fallback */}
              <select
                className="form-control"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
              >
                <option value="">-- Choose European Country --</option>
                {countriesList.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Max Allowed Days</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="e.g., 90" 
                  value={maxDays}
                  onChange={(e) => setMaxDays(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Rolling Period (Days)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="e.g., 180" 
                  value={rollingPeriod}
                  onChange={(e) => setRollingPeriod(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
              <Save size={16} /> {loading ? 'Saving Rule...' : 'Save Limit Configuration'}
            </button>
          </form>
          
          <div style={{ marginTop: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              Understanding Stays & Rolling Periods
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              The <strong>Schengen Zone</strong> restricts visits to <strong>90 days</strong> in any <strong>180-day</strong> rolling period. 
              The system tracks every date spent in that country and checks if you exceed the limit in any possible sliding window.
            </p>
          </div>
        </div>

        {/* Rules list */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1.25rem' }}>Active Stay Rules & Warnings</h3>
          
          {limits.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>
              No limit rules configured. Stays will not trigger limit warnings.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto' }}>
              {limits.map((rule) => {
                const matchingAlert = alerts.find(a => a.country.toLowerCase() === rule.country.toLowerCase());
                const isExceeded = matchingAlert?.status === 'exceeded' || matchingAlert?.peakExceeded;
                const isWarning = matchingAlert?.status === 'warning';
                
                return (
                  <div 
                    key={rule.id} 
                    style={{
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      padding: '1rem',
                      background: 'rgba(255, 255, 255, 0.01)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{rule.country}</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          Limit: <strong>{rule.max_days} days</strong> in a rolling <strong>{rule.rolling_period_days}-day</strong> period.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          onClick={() => handleEditSelect(rule)}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '0.35rem', borderRadius: '4px' }}
                          onClick={() => onDeleteLimit(rule.id!)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    
                    {matchingAlert && (
                      <div style={{ 
                        marginTop: '0.5rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        fontSize: '0.82rem',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        background: isExceeded 
                          ? 'rgba(239, 68, 68, 0.08)' 
                          : isWarning 
                            ? 'rgba(245, 158, 11, 0.08)' 
                            : 'rgba(16, 185, 129, 0.08)',
                        borderLeft: `3px solid ${
                          isExceeded 
                            ? 'var(--color-danger)' 
                            : isWarning 
                              ? 'var(--color-warning)' 
                              : 'var(--color-success)'
                        }`,
                        color: isExceeded 
                          ? '#fca5a5' 
                          : isWarning 
                            ? '#fcd34d' 
                            : '#a7f3d0'
                      }}>
                        {isExceeded ? (
                          <ShieldAlert size={14} />
                        ) : (
                          <ShieldCheck size={14} />
                        )}
                        <span>
                          Stays (Current Window): <strong>{matchingAlert.daysSpentCurrentWindow} / {rule.max_days} days</strong>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Country and City List Editor Widget */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Globe size={18} style={{ color: 'var(--color-primary)' }} /> Edit European Countries & Cities Lists
        </h3>
        
        <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Countries list */}
          <div>
            <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 600 }}>Countries List</h4>
            <form onSubmit={handleAddCountry} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Add new country..."
                value={newCountryName}
                onChange={(e) => setNewCountryName(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 0.75rem' }}>
                <Plus size={16} />
              </button>
            </form>

            <div style={{ border: '1px solid var(--glass-border)', borderRadius: '6px', maxHeight: '300px', overflowY: 'auto' }}>
              {countriesList.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => setSelectedCountry(c)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    background: selectedCountry?.id === c.id ? 'rgba(59,130,246,0.1)' : 'transparent',
                    borderBottom: '1px solid var(--glass-border)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '0.88rem', fontWeight: selectedCountry?.id === c.id ? 700 : 400 }}>{c.name}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteCountry(c.id); }}
                    style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '0.2rem' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Cities list */}
          <div>
            <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 600 }}>
              Cities in {selectedCountry ? selectedCountry.name : '(Select a Country)'}
            </h4>
            
            {selectedCountry ? (
              <>
                <form onSubmit={handleAddCity} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Add new city..."
                    value={newCityName}
                    onChange={(e) => setNewCityName(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 0.75rem' }}>
                    <Plus size={16} />
                  </button>
                </form>

                <div style={{ border: '1px solid var(--glass-border)', borderRadius: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                  {citiesList.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '1rem', textAlign: 'center', margin: 0 }}>
                      No cities added yet.
                    </p>
                  ) : (
                    citiesList.map(city => (
                      <div 
                        key={city.id} 
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          borderBottom: '1px solid var(--glass-border)'
                        }}
                      >
                        <span style={{ fontSize: '0.88rem' }}>{city.name}</span>
                        <button 
                          onClick={() => handleDeleteCity(city.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '0.2rem' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div style={{ border: '1px dashed var(--glass-border)', borderRadius: '6px', padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                <Building size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                <p style={{ margin: 0 }}>Please select a country on the left to edit its list of cities.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
