import { useState } from 'react';
import { useBp } from '../context/BpContext';

export default function PasswordGate() {
  const { canEdit, tryUnlockEdit, lockEdit } = useBp();
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const submit = () => {
    if (tryUnlockEdit(value)) {
      setValue('');
      setError(false);
      return;
    }
    setError(true);
  };

  return (
    <div className={`password-gate${canEdit ? ' is-unlocked' : ''}`}>
      {canEdit ? (
        <button type="button" className="password-gate-lock" onClick={lockEdit} aria-label="鎖定編輯">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z" />
          </svg>
        </button>
      ) : (
        <input
          type="password"
          className={`password-gate-input${error ? ' is-error' : ''}`}
          placeholder=""
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          onBlur={() => {
            if (value) submit();
          }}
          autoComplete="off"
        />
      )}
    </div>
  );
}
