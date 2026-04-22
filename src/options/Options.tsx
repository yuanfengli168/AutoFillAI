import { useEffect, useState } from 'react';
import type { AppState, FieldType } from '../core/types';
import { FIELD_TYPES } from '../core/types';

async function getState(): Promise<AppState> {
  return chrome.runtime.sendMessage({ type: 'GET_STATE' });
}

export function Options() {
  const [state, setState] = useState<AppState | null>(null);
  const [fieldType, setFieldType] = useState<FieldType>('email');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('manual');
  const [message, setMessage] = useState('');

  async function refresh() {
    setState(await getState());
  }

  async function save() {
    if (!value.trim()) return;
    await chrome.runtime.sendMessage({
      type: 'SAVE_PROFILE_VALUE',
      payload: { fieldType, value: value.trim(), label, pinned: false }
    });
    setValue('');
    setLabel('manual');
    setMessage(`Saved ${fieldType} value.`);
    await refresh();
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="app" style={{ maxWidth: 980, margin: '0 auto' }}>
      <div className="card">
        <strong>AutoFillAI settings</strong>
        <div className="muted">Manage saved profile values and inspect learned mappings.</div>
      </div>

      <div className="card">
        <strong>Add profile value</strong>
        <div className="row" style={{ marginTop: 10 }}>
          <select value={fieldType} onChange={(e) => setFieldType(e.target.value as FieldType)}>
            {FIELD_TYPES.filter((type) => type !== 'unknown').map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" />
          <button onClick={() => void save()} disabled={!value.trim()}>Save value</button>
        </div>
        {message ? <div className="muted" style={{ marginTop: 8 }}>{message}</div> : null}
      </div>

      <div className="card">
        <strong>Profile value store</strong>
        <div className="field-list" style={{ marginTop: 10, maxHeight: 'none' }}>
          {FIELD_TYPES.filter((type) => type !== 'unknown').map((type) => {
            const values = state?.profileValues[type] ?? [];
            return (
              <div key={type} className="field-item">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{type}</strong>
                  <span className="badge">{values.length}</span>
                </div>
                {values.length ? values.map((entry) => (
                  <div key={entry.id} className="muted" style={{ marginTop: 6 }}>
                    <span className="mono">{entry.value}</span> — {entry.label || 'manual'} {entry.pinned ? '(pinned)' : ''} · used {entry.useCount}x
                  </div>
                )) : <div className="muted" style={{ marginTop: 6 }}>No saved values yet.</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <strong>Learned mappings</strong>
        <div className="field-list" style={{ marginTop: 10, maxHeight: 'none' }}>
          {state?.mappings.length ? state.mappings.map((mapping) => (
            <div key={mapping.id} className="field-item">
              <div><strong>{mapping.domain}</strong> → {mapping.fieldType}</div>
              <div className="muted mono" style={{ marginTop: 6 }}>{JSON.stringify(mapping.matcher)}</div>
            </div>
          )) : <div className="muted">No mappings learned yet. They will appear after successful fills.</div>}
        </div>
      </div>
    </div>
  );
}
