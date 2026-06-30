import { useEffect, useRef, useState } from 'react';
import { formatSeriesLabel, SERIES_LENGTH_OPTIONS } from '../constants';

export default function SeriesFormatSelect({ value, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

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

  const handleSelect = (n) => {
    onChange(n);
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
        {formatSeriesLabel(value)}
      </button>
      {open && (
        <ul className="series-format-menu custom-scroll" role="listbox">
          {SERIES_LENGTH_OPTIONS.map((n) => (
            <li key={n} role="option" aria-selected={n === value}>
              <button
                type="button"
                className={`series-format-option${n === value ? ' is-active' : ''}`}
                onClick={() => handleSelect(n)}
              >
                {formatSeriesLabel(n)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
