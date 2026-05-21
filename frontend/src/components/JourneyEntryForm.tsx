import React from 'react';
import { X, Upload } from 'lucide-react';
import { JourneyEntry, Country, City } from '../types';

interface JourneyEntryFormProps {
  entry?: JourneyEntry;
  prefillDate?: string; // YYYY-MM-DD from calendar click
  onSave: (formData: FormData, isEdit: boolean, entryId?: number) => Promise<void>;
  onClose: () => void;
}

// Reusable Type-Ahead Searchable Dropdown component
const SearchableDropdown: React.FC<{
  label: string;
  placeholder: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}> = ({ label, placeholder, options, value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm(value); // Reset search term to current selected value
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt =>
      opt.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  const handleSelect = (option: string) => {
    onChange(option);
    setSearchTerm(option);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  return (
    <div className="form-group" ref={wrapperRef} style={{ position: 'relative' }}>
      <label className="form-label">{label}</label>
      <input
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => { if (!disabled) setIsOpen(true); }}
        disabled={disabled}
      />
      {isOpen && !disabled && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#0f172a',
          border: '1px solid var(--glass-border)',
          borderRadius: '6px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 100,
          marginTop: '4px'
        }}>
          {filteredOptions.length === 0 ? (
            <div style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              No matches found.
            </div>
          ) : (
            filteredOptions.map((opt, idx) => (
              <div
                key={idx}
                onClick={() => handleSelect(opt)}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  background: opt.toLowerCase() === value.toLowerCase() ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = opt.toLowerCase() === value.toLowerCase() ? 'rgba(59, 130, 246, 0.2)' : 'transparent';
                }}
              >
                {opt}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const JourneyEntryForm: React.FC<JourneyEntryFormProps> = ({
  entry,
  prefillDate,
  onSave,
  onClose
}) => {
  const [countries, setCountries] = React.useState<Country[]>([]);
  const [cities, setCities] = React.useState<City[]>([]);
  
  const [country, setCountry] = React.useState(entry?.country || '');
  const [city, setCity] = React.useState(entry?.city || '');
  const [entryTime, setEntryTime] = React.useState('');
  const [notes, setNotes] = React.useState(entry?.notes || '');
  const [file, setFile] = React.useState<File | null>(null);
  
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(
    entry?.file_path ? `/uploads/${entry.file_path}` : null
  );

  // Initialize entry date: editing > prefill date from calendar > now
  React.useEffect(() => {
    if (entry?.entry_time) {
      setEntryTime(entry.entry_time.substring(0, 10));
    } else if (prefillDate) {
      setEntryTime(prefillDate);
    } else {
      setEntryTime(new Date().toISOString().split('T')[0]);
    }
  }, [entry, prefillDate]);

  // Load countries
  React.useEffect(() => {
    const loadCountries = async () => {
      try {
        const res = await fetch('/api/settings/countries');
        if (res.ok) setCountries(await res.json());
      } catch (err) {
        console.error('Error fetching countries:', err);
      }
    };
    loadCountries();
  }, []);

  // Load cities when country selection changes
  React.useEffect(() => {
    const selectedCountryObj = countries.find(c => c.name.toLowerCase() === country.toLowerCase());
    if (!selectedCountryObj) {
      setCities([]);
      return;
    }

    const loadCities = async () => {
      try {
        const res = await fetch(`/api/settings/countries/${selectedCountryObj.id}/cities`);
        if (res.ok) setCities(await res.json());
      } catch (err) {
        console.error('Error fetching cities:', err);
      }
    };
    loadCities();
  }, [country, countries]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!country.trim()) return setError('Country is required.');
    if (!city.trim()) return setError('City is required.');
    if (!entryTime) return setError('Date is required.');

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append('country', country.trim());
      formData.append('city', city.trim());
      // Convert HTML date YYYY-MM-DD to database friendly YYYY-MM-DD 12:00
      formData.append('entry_time', `${entryTime} 12:00`);
      formData.append('notes', notes);
      if (file) formData.append('file', file);

      await onSave(formData, !!entry, entry?.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the journey entry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ maxWidth: '600px', width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 700 }}>
            {entry ? 'Edit Journey Entry' : 'Log New Presence Entry'}
          </h2>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', borderLeft: '4px solid var(--color-danger)', borderRadius: '6px', color: '#fca5a5', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          <div className="grid-2">
            <SearchableDropdown
              label="Country"
              placeholder="e.g., France"
              options={countries.map(c => c.name)}
              value={country}
              onChange={(val) => {
                setCountry(val);
                setCity(''); // Clear city on country change
              }}
            />
            <SearchableDropdown
              label="City"
              placeholder={country ? "e.g., Lille" : "Select a country first"}
              options={cities.map(c => c.name)}
              value={city}
              onChange={setCity}
              disabled={!country}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Date</label>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                className="form-control"
                value={entryTime}
                onChange={(e) => setEntryTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <textarea
              className="form-control"
              placeholder="Provide context, e.g., Train ticket details or proof notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Styled File Upload / Dropzone */}
          <div className="form-group">
            <label className="form-label">Attached Proof (Receipt / Ticket / Boarding Pass)</label>
            <div 
              style={{
                border: '2px dashed var(--glass-border)',
                borderRadius: '8px',
                padding: '1.5rem',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.01)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'border-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
            >
              <input
                type="file"
                accept="image/*"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer'
                }}
                onChange={handleFileChange}
              />
              
              {previewUrl ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <img 
                    src={previewUrl} 
                    alt="Receipt preview" 
                    style={{ maxHeight: '120px', borderRadius: '4px', border: '1px solid var(--glass-border)' }} 
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {file ? file.name : (entry ? entry.file_name : 'Uploaded file')}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>Click or drag to replace image</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <Upload size={24} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    Click to browse or drag image here
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    PNG, JPG, or GIF up to 20MB
                  </span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Saving entry...' : (entry ? 'Update Entry' : 'Log Presence Entry')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
