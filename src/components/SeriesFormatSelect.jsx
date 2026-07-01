import { useEffect, useRef, useState } from 'react';
import {
  BO_SERIES_LENGTH_OPTIONS,
  GAME_COUNT_OPTIONS,
  formatSeriesLabel,
  normalizeSeriesLength,
  normalizeSeriesMode,
} from '../constants';

export default function SeriesFormatSelect({ mode, value, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const normalizedMode = normalizeSeriesMode(mode);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (nextMode, nextValue) => {
    onChange(nextMode, normalizeSeriesLength(nextValue, nextMode));
    setOpen(false);
  };

  return (
    <div className="series-format-dropdown" ref={rootRef}>
      <button
        type="button"
        className="series-format-trigger"
        disabled={disabled}
        title={disabled ? '系列賽進行中無法更改賽制' : '選擇系列賽制'}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        {formatSeriesLabel(value, normalizedMode)}
      </button>
      {open && (
        <ul className="series-format-menu custom-scroll" role="listbox">
          <li className="series-format-group-label">BO</li>
          {BO_SERIES_LENGTH_OPTIONS.map((n) => (
            <li key={`bo-${n}`} role="option" aria-selected={normalizedMode === 'bo' && n === value}>
              <button
                type="button"
                className={`series-format-option${normalizedMode === 'bo' && n === value ? ' is-active' : ''}`}
                onClick={() => handleSelect('bo', n)}
              >
                {formatSeriesLabel(n, 'bo')}
              </button>
            </li>
          ))}
          <li className="series-format-group-label">場數</li>
          {GAME_COUNT_OPTIONS.map((n) => (
            <li key={`games-${n}`} role="option" aria-selected={normalizedMode === 'games' && n === value}>
              <button
                type="button"
                className={`series-format-option${normalizedMode === 'games' && n === value ? ' is-active' : ''}`}
                onClick={() => handleSelect('games', n)}
              >
                {formatSeriesLabel(n, 'games')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
