import { useEffect, useMemo, useState } from 'react';
import type { AppState, FieldType } from '../core/types';
import { FIELD_TYPES } from '../core/types';

async function getState(): Promise<AppState> {
  return chrome.runtime.sendMessage({ type: 'GET_STATE' });
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

export function Options() {
  const [state, setState] = useState<AppState | null>(null);
  const availableFieldTypes = useMemo(
    () => [...FIELD_TYPES.filter((type) => type !== 'unknown'), ...(state?.customFieldTypes ?? [])],
    [state]
  );
  const [fieldType, setFieldType] = useState<FieldType>('email');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('manual');
  const [customKey, setCustomKey] = useState('');
  const [threshold, setThreshold] = useState('0.60');
  const [message, setMessage] = useState('');

  async function refresh() {
    const next = await getState();
    setState(next);
    setThreshold(next.settings.autoFillThreshold.toFixed(2));
    const nextAvailableFieldTypes = [...FIELD_TYPES.filter((type) => type !== 'unknown'), ...(next.customFieldTypes ?? [])];
    if (!nextAvailableFieldTypes.includes(fieldType) && next.customFieldTypes[0]) {
      setFieldType(next.customFieldTypes[0]);
    }
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

  async function addCustomKey() {
    const normalized = normalizeKey(customKey);
    if (!normalized) return;
    await chrome.runtime.sendMessage({ type: 'ENSURE_FIELD_TYPE', payload: { fieldType: normalized } });
    setFieldType(normalized);
    setCustomKey('');
    setMessage(`Added custom profile key ${normalized}.`);
    await refresh();
  }

  async function saveThreshold() {
    const parsed = Number(threshold);
    if (Number.isNaN(parsed)) return;
    await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: { autoFillThreshold: parsed } });
    setMessage(`Saved auto-fill threshold ${parsed.toFixed(2)}.`);
    await refresh();
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="app" style={{ maxWidth: 980, margin: '0 auto' }}>
      <div className="card">
        <strong>AutoFillAI settings</strong>
        <div className="muted">Manage saved profile values, custom profile keys, thresholds, and learned mappings.</div>
      </div>

      <div className="card">
        <strong>Auto-fill behavior</strong>
        <div className="row" style={{ marginTop: 10 }}>
          <input type="text" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="0.60" />
          <button onClick={() => void saveThreshold()}>Save threshold</button>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>High-confidence auto-fill currently uses {state?.settings.autoFillThreshold ?? 0.6}.</div>
      </div>

      <div className="card">
        <strong>Custom profile keys</strong>
        <div className="muted">Add keys like <span className="mono">country</span>, <span className="mono">notice_period_weeks</span>, or any page-specific field you want to store.</div>
        <div className="row" style={{ marginTop: 10 }}>
          <input type="text" value={customKey} onChange={(e) => setCustomKey(e.target.value)} placeholder="Custom key name" />
          <button onClick={() => void addCustomKey()} disabled={!customKey.trim()}>Add key</button>
        </div>
        <div className="field-list" style={{ marginTop: 10, maxHeight: 'none' }}>
          {(state?.customFieldTypes.length ?? 0) > 0 ? state?.customFieldTypes.map((type) => (
            <div key={type} className="field-item">
              <strong>{type}</strong>
            </div>
          )) : <div className="muted">No custom profile keys yet.</div>}
        </div>
      </div>

      <div className="card">
        <strong>Add profile value</strong>
        <div className="row" style={{ marginTop: 10 }}>
          <select value={fieldType} onChange={(e) => setFieldType(e.target.value as FieldType)}>
            {availableFieldTypes.map((type) => (
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
          {availableFieldTypes.map((type) => {
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
