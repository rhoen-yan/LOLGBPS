import { useCallback, useRef } from 'react';

function parseTime(value) {
  if (!value) return { min: '', sec: '' };
  const [min = '', sec = ''] = value.split(':');
  return {
    min: min.replace(/\D/g, '').slice(0, 2),
    sec: sec.replace(/\D/g, '').slice(0, 2),
  };
}

function buildTime(min, sec) {
  if (!min && !sec) return '';
  if (!sec) return min;
  return `${min}:${sec}`;
}

function clampSeconds(sec) {
  if (!sec) return '';
  if (sec.length < 2) return sec;
  const n = Math.min(59, parseInt(sec, 10) || 0);
  return String(n).padStart(2, '0');
}

export default function EventTimeInput({ value, onChange, onSecondsComplete }) {
  const { min, sec } = parseTime(value);
  const minRef = useRef(null);
  const secRef = useRef(null);

  const emit = useCallback(
    (nextMin, nextSec) => {
      onChange(buildTime(nextMin, nextSec));
    },
    [onChange],
  );

  const handleMinChange = (e) => {
    const nextMin = e.target.value.replace(/\D/g, '').slice(0, 2);
    emit(nextMin, sec);
    if (nextMin.length === 2) {
      requestAnimationFrame(() => secRef.current?.focus());
    }
  };

  const handleSecChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    const nextSec = raw.length === 2 ? clampSeconds(raw) : raw;
    emit(min, nextSec);
    if (raw.length === 2) {
      requestAnimationFrame(() => onSecondsComplete?.());
    }
  };

  const handleSecBlur = () => {
    if (!sec) return;
    const clamped = clampSeconds(sec);
    if (clamped !== sec) emit(min, clamped);
  };

  const handleMinKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === ':') {
      e.preventDefault();
      secRef.current?.focus();
    }
  };

  const handleSecKeyDown = (e) => {
    if (e.key === 'ArrowRight' && sec.length >= 2) {
      e.preventDefault();
      onSecondsComplete?.();
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      minRef.current?.focus();
      return;
    }
    if (e.key === 'Backspace' && sec === '') {
      e.preventDefault();
      minRef.current?.focus();
    }
  };

  return (
    <div className="history-event-time-group">
      <input
        ref={minRef}
        type="text"
        inputMode="numeric"
        className="history-event-time-part"
        placeholder="分"
        value={min}
        maxLength={2}
        onChange={handleMinChange}
        onKeyDown={handleMinKeyDown}
        aria-label="分"
      />
      <span className="history-event-time-sep">:</span>
      <input
        ref={secRef}
        type="text"
        inputMode="numeric"
        className="history-event-time-part"
        placeholder="秒"
        value={sec}
        maxLength={2}
        onChange={handleSecChange}
        onBlur={handleSecBlur}
        onKeyDown={handleSecKeyDown}
        aria-label="秒"
      />
    </div>
  );
}
