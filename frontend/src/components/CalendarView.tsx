import React from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Edit3 } from 'lucide-react';
import { JourneyEntry } from '../types';

interface CalendarViewProps {
  entries: JourneyEntry[];
  onDayClick: (dateStr: string, existingEntry: JourneyEntry | null) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ entries, onDayClick }) => {
  const [currentDate, setCurrentDate] = React.useState(new Date());

  // Stable hash → rich HSL color for a country
  const getCountryColor = React.useCallback((country: string) => {
    let hash = 0;
    for (let i = 0; i < country.length; i++) {
      hash = country.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return {
      solid: `hsl(${hue}, 70%, 55%)`,
      light: `hsla(${hue}, 70%, 55%, 0.15)`,
      badge: `hsla(${hue}, 70%, 50%, 0.25)`,
      border: `hsl(${hue}, 70%, 65%)`
    };
  }, []);

  // Find all entries that claim a given date (inclusive for transit days)
  const getCountriesForDate = React.useCallback((dateStr: string): JourneyEntry[] => {
    const matched: JourneyEntry[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const start = entry.startDate || '';
      const end   = entry.endDate   || '';
      if (dateStr >= start && dateStr <= end) {
        matched.push(entry);
      }
    }
    return matched;
  }, [entries]);

  // Which entry has this exact entry date? (for the edit path)
  const getEntryForDate = React.useCallback((dateStr: string): JourneyEntry | null => {
    return entries.find(e => e.entry_time.substring(0, 10) === dateStr) ?? null;
  }, [entries]);

  const handlePrevMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const handleNextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const handleGoToToday = () =>
    setCurrentDate(new Date());

  // Build grid cells (42 cells: leading/trailing month padding + current month)
  const daysInMonth = React.useMemo(() => {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay       = new Date(year, month, 1).getDay();
    const totalDays      = new Date(year, month + 1, 0).getDate();
    const prevMonthDays  = new Date(year, month, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Leading padding (previous month)
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      days.push({
        dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        dayNum: d.getDate(),
        isCurrentMonth: false
      });
    }

    // Current month
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        dayNum: i,
        isCurrentMonth: true
      });
    }

    // Trailing padding (next month)
    for (let i = 1; days.length < 42; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        dayNum: d.getDate(),
        isCurrentMonth: false
      });
    }

    return days;
  }, [currentDate]);

  // Countries visible in the current month view (for legend)
  const visibleCountries = React.useMemo(() => {
    const seen = new Set<string>();
    daysInMonth.forEach(cell => {
      const stays = getCountriesForDate(cell.dateStr);
      stays.forEach(stay => seen.add(stay.country));
    });
    return Array.from(seen);
  }, [daysInMonth, getCountriesForDate]);

  const todayStr  = new Date().toISOString().split('T')[0];
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const yearNum   = currentDate.getFullYear();

  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarIcon size={20} style={{ color: 'var(--color-primary)' }} />
          <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Presence Map</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Click any day to log or edit an entry
          </span>
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
            onClick={handleGoToToday}
          >
            Today
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '3fr 1fr', gap: '1.5rem' }}>
        {/* Calendar Grid */}
        <div>
          {/* Month navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{monthName} {yearNum}</h4>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button className="btn btn-secondary btn-icon" onClick={handlePrevMonth} style={{ padding: '0.25rem' }}>
                <ChevronLeft size={16} />
              </button>
              <button className="btn btn-secondary btn-icon" onClick={handleNextMonth} style={{ padding: '0.25rem' }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
            {/* Weekday headers */}
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(wd => (
              <div key={wd} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', paddingBottom: '0.5rem' }}>
                {wd}
              </div>
            ))}

            {/* Day cells */}
            {daysInMonth.map((cell, idx) => {
              const matchedStays = getCountriesForDate(cell.dateStr);
              const dateEntry    = getEntryForDate(cell.dateStr);
              const isToday      = cell.dateStr === todayStr;
              const isEntryDate   = !!dateEntry;

              let cellBackground = 'rgba(255,255,255,0.01)';
              let borderLeftStyle = isToday ? '2px solid var(--color-primary)' : '1px solid var(--glass-border)';
              let cellBoxShadow = 'none';
              let badgeColor = 'var(--text-muted)';

              let titleText = 'Click to log entry';
              if (dateEntry) {
                titleText = `Edit: ${dateEntry.city}, ${dateEntry.country} — click to edit`;
              } else if (matchedStays.length === 1) {
                titleText = `${matchedStays[0].city}, ${matchedStays[0].country} — click to add entry`;
              } else if (matchedStays.length > 1) {
                titleText = `Transition: ${matchedStays[0].city}, ${matchedStays[0].country} → ${matchedStays[1].city}, ${matchedStays[1].country} — click to add entry`;
              }

              let badgeElement = null;

              if (matchedStays.length === 1) {
                const colors = getCountryColor(matchedStays[0].country);
                cellBackground = colors.light;
                borderLeftStyle = `4px solid ${isEntryDate ? colors.solid : colors.solid + 'aa'}`;
                if (isEntryDate) {
                  cellBoxShadow = `0 0 8px ${colors.solid}66`;
                  badgeColor = colors.solid;
                }
                badgeElement = (
                  <span style={{
                    fontSize: '0.6rem',
                    background: colors.badge,
                    border: `1px solid ${colors.border}`,
                    color: '#ffffff',
                    padding: '1px 3px',
                    borderRadius: '2px',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 600
                  }}>
                    {matchedStays[0].city}
                  </span>
                );
              } else if (matchedStays.length > 1) {
                const colors1 = getCountryColor(matchedStays[0].country);
                const colors2 = getCountryColor(matchedStays[1].country);
                cellBackground = `linear-gradient(135deg, ${colors1.light} 50%, ${colors2.light} 50%)`;
                // Show arrival country's color as the solid left border, indicating entry day
                borderLeftStyle = `4px solid ${isEntryDate ? colors2.solid : colors2.solid + 'aa'}`;
                if (isEntryDate) {
                  cellBoxShadow = `0 0 8px ${colors2.solid}66`;
                  badgeColor = colors2.solid;
                }
                badgeElement = (
                  <span style={{
                    fontSize: '0.55rem',
                    background: `linear-gradient(135deg, ${colors1.badge} 50%, ${colors2.badge} 50%)`,
                    border: `1px solid ${colors2.border}`,
                    color: '#ffffff',
                    padding: '1px 3px',
                    borderRadius: '2px',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 600
                  }}>
                    {matchedStays[0].city} → {matchedStays[1].city}
                  </span>
                );
              }

              return (
                <div
                  key={idx}
                  onClick={() => cell.isCurrentMonth ? onDayClick(cell.dateStr, dateEntry) : undefined}
                  title={titleText}
                  style={{
                    aspectRatio: '1',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '4px 6px',
                    borderRadius: '6px',
                    cursor: cell.isCurrentMonth ? 'pointer' : 'default',
                    fontSize: '0.85rem',
                    background: cellBackground,
                    opacity: cell.isCurrentMonth ? 1 : 0.3,
                    border: isToday
                      ? `2px solid var(--color-primary)`
                      : '1px solid var(--glass-border)',
                    borderLeft: borderLeftStyle,
                    boxShadow: cellBoxShadow,
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={e => {
                    if (cell.isCurrentMonth) {
                      (e.currentTarget as HTMLDivElement).style.opacity = '0.8';
                      (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.04)';
                    }
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.opacity = cell.isCurrentMonth ? '1' : '0.3';
                    (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                  }}
                >
                  {/* Day number row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{
                      fontWeight: isToday ? 700 : 400,
                      color: isToday ? 'var(--color-primary)' : (matchedStays.length > 0 ? '#ffffff' : 'var(--text-primary)'),
                      fontSize: '0.8rem'
                    }}>
                      {cell.dayNum}
                    </span>
                    {cell.isCurrentMonth && (
                      <span style={{
                        fontSize: '0.6rem',
                        color: badgeColor,
                        opacity: 0.7
                      }}>
                        {isEntryDate ? <Edit3 size={9} /> : <Plus size={9} />}
                      </span>
                    )}
                  </div>

                  {/* City badge */}
                  {badgeElement}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend Panel */}
        <div style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Legend
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {visibleCountries.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No stays logged for this month.
              </p>
            ) : (
              visibleCountries.map(c => {
                const colors = getCountryColor(c);
                return (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: colors.solid, flexShrink: 0 }}></div>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c}</span>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Edit3 size={10} /> Edit entry (entry date)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={10} /> Log new entry
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
