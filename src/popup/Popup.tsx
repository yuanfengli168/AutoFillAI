import { useEffect, useMemo, useState } from 'react';
import { autoFillCoreApi } from '../core/api';
import type { AppState, EnrichedDetectedField, FillInstruction, FieldType } from '../core/types';
import { FIELD_TYPES } from '../core/types';

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function getState(): Promise<AppState> {
  return chrome.runtime.sendMessage({ type: 'GET_STATE' });
}

async function ensureContentScript(tabId: number) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'SCAN_PAGE' });
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Receiving end does not exist')) {
      throw error;
    }
  }

  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ['content.js']
  });

  await chrome.tabs.sendMessage(tabId, { type: 'SCAN_PAGE' });
}

async function sendMessageToPage<T>(tabId: number, message: { type: 'SCAN_PAGE' } | { type: 'FILL_FIELDS'; payload: { instructions: FillInstruction[]; overwrite?: boolean } }): Promise<T> {
  await ensureContentScript(tabId);
  return chrome.tabs.sendMessage(tabId, message);
}

export function Popup() {
  const [state, setState] = useState<AppState | null>(null);
  const [fields, setFields] = useState<EnrichedDetectedField[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('email');
  const [newValue, setNewValue] = useState('');

  const highConfidenceCount = useMemo(
    () => fields.filter((field) => field.resolved.value && field.resolved.confidence >= (state?.settings.autoFillThreshold ?? 0.82)).length,
    [fields, state]
  );

  async function refreshState() {
    const next = await getState();
    setState(next);
    return next;
  }

  async function scan() {
    setLoading(true);
    setMessage('');
    try {
      const [tabId, latestState] = await Promise.all([getActiveTabId(), refreshState()]);
      if (!tabId) throw new Error('No active tab found');
      const response = await sendMessageToPage<{ fields?: any[] }>(tabId, { type: 'SCAN_PAGE' });
      const enriched = autoFillCoreApi.enrichScan(response.fields ?? [], latestState);
      setFields(enriched);
      await chrome.runtime.sendMessage({
        type: 'LOG_EVENT',
        payload: { type: 'scan', domain: enriched[0]?.signature.domain, details: { fieldCount: enriched.length } }
      });
      setMessage(`Scanned ${enriched.length} fields.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  }

  async function fillHighConfidence() {
    if (!state) return;
    setLoading(true);
    setMessage('');
    try {
      const tabId = await getActiveTabId();
      if (!tabId) throw new Error('No active tab found');
      const instructions = autoFillCoreApi.createFillInstructions(fields, state.settings.autoFillThreshold);
      const result = await sendMessageToPage<{ results: Array<{ status: string }> }>(tabId, { type: 'FILL_FIELDS', payload: { instructions } });

      for (const field of fields) {
        const instruction = instructions.find((item) => item.elementId === field.elementId);
        if (!instruction) continue;
        await chrome.runtime.sendMessage({ type: 'MARK_VALUE_USED', payload: { fieldType: field.resolved.fieldType, valueId: field.resolved.valueId } });
        await chrome.runtime.sendMessage({
          type: 'SAVE_MAPPING',
          payload: {
            domain: field.signature.domain,
            fieldType: field.resolved.fieldType,
            matcher: {
              name: field.signature.name,
              id: field.signature.id,
              label: field.signature.label,
              placeholder: field.signature.placeholder,
              path: field.signature.path
            },
            preferredValueId: field.resolved.valueId,
            confidence: field.resolved.confidence
          }
        });
      }

      setMessage(`Filled ${result.results.filter((item: any) => item.status === 'filled').length} fields.`);
      await refreshState();
      await scan();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Fill failed');
    } finally {
      setLoading(false);
    }
  }

  async function saveProfileValue() {
    if (!newValue.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_PROFILE_VALUE',
        payload: { fieldType: newFieldType, value: newValue.trim(), pinned: false }
      });
      setNewValue('');
      await refreshState();
      setMessage(`Saved ${newFieldType} value.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshState();
  }, []);

  return (
    <div className="app">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <strong>AutoFillAI MVP</strong>
            <div className="muted">Current-page scan + local-first autofill</div>
          </div>
          <button className="secondary" onClick={() => chrome.runtime.openOptionsPage()}>Options</button>
        </div>
        <hr />
        <div className="row">
          <button onClick={() => void scan()} disabled={loading}>Scan page</button>
          <button className="secondary" onClick={() => void fillHighConfidence()} disabled={loading || !fields.length}>Fill high-confidence ({highConfidenceCount})</button>
        </div>
        {message ? <div className="muted" style={{ marginTop: 8 }}>{message}</div> : null}
      </div>

      <div className="card">
        <strong>Quick save value</strong>
        <div className="muted">Handy for bootstrapping the profile store without opening options.</div>
        <div className="row" style={{ marginTop: 8 }}>
          <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as FieldType)}>
            {FIELD_TYPES.filter((type) => type !== 'unknown').map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input type="text" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Value to save" />
          <button onClick={() => void saveProfileValue()} disabled={loading || !newValue.trim()}>Save</button>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>Detected fields</strong>
          <span className="badge">{fields.length}</span>
        </div>
        <div className="field-list" style={{ marginTop: 10 }}>
          {fields.map((field) => {
            const top = field.candidateFieldTypes[0];
            return (
              <div key={field.elementId} className="field-item">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{field.signature.label || field.signature.placeholder || field.signature.name || 'Unlabelled field'}</strong>
                  <span className="badge">{top?.fieldType ?? 'unknown'} · {Math.round((field.resolved.confidence ?? 0) * 100)}%</span>
                </div>
                <div className="muted mono" style={{ marginTop: 4 }}>
                  name={field.signature.name || '-'} id={field.signature.id || '-'} type={field.signature.inputType || field.signature.tagName}
                </div>
                <div className="muted" style={{ marginTop: 6 }}>Suggested value: {field.resolved.value ?? '—'} ({field.resolved.source})</div>
                <div className="muted" style={{ marginTop: 4 }}>Reasons: {[...(top?.reason ?? []), ...field.resolved.reasons].join(', ')}</div>
              </div>
            );
          })}
          {!fields.length ? <div className="muted">Run a scan on the active tab to inspect detected fields.</div> : null}
        </div>
      </div>
    </div>
  );
}
