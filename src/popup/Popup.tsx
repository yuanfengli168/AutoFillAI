import { useEffect, useMemo, useState } from 'react';
import { autoFillCoreApi } from '../core/api';
import type { AppState, DetectedField, EnrichedDetectedField, FieldType } from '../core/types';
import { FIELD_TYPES } from '../core/types';

interface ActiveTabInfo {
  id: number;
  url: string;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

async function getActiveTab(): Promise<ActiveTabInfo | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return null;
  return { id: tab.id, url: tab.url };
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

async function sendMessageToPage<T>(
  tabId: number,
  message: { type: 'SCAN_PAGE' } | { type: 'FILL_FIELDS'; payload: { instructions: Array<{ elementId: string; value: string; fieldType: FieldType }>; overwrite?: boolean } }
): Promise<T> {
  await ensureContentScript(tabId);
  return chrome.tabs.sendMessage(tabId, message);
}

function getAvailableFieldTypes(state: AppState | null) {
  return [...FIELD_TYPES.filter((type) => type !== 'unknown'), ...(state?.customFieldTypes ?? [])];
}

function buildEffectiveFields(rawFields: DetectedField[], state: AppState | null, fieldTypeOverrides: Record<string, FieldType>) {
  if (!state) return [] as EnrichedDetectedField[];

  return rawFields.map((field) => {
    const override = fieldTypeOverrides[field.elementId];
    const resolved = override
      ? autoFillCoreApi.resolveValueForFieldType(override, state, 1)
      : autoFillCoreApi.resolveValue(field, state);

    return {
      ...field,
      resolved
    } satisfies EnrichedDetectedField;
  });
}

function buildDefaultSelections(fields: EnrichedDetectedField[], threshold: number) {
  return Object.fromEntries(
    fields.map((field) => [field.elementId, !!field.resolved.value && field.resolved.confidence >= threshold])
  );
}

export function Popup() {
  const [state, setState] = useState<AppState | null>(null);
  const [tabInfo, setTabInfo] = useState<ActiveTabInfo | null>(null);
  const [rawFields, setRawFields] = useState<DetectedField[]>([]);
  const [fieldSelections, setFieldSelections] = useState<Record<string, boolean>>({});
  const [fieldTypeOverrides, setFieldTypeOverrides] = useState<Record<string, FieldType>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('email');
  const [newValue, setNewValue] = useState('');
  const [newCustomKey, setNewCustomKey] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const availableFieldTypes = useMemo(() => getAvailableFieldTypes(state), [state]);
  const fields = useMemo(() => buildEffectiveFields(rawFields, state, fieldTypeOverrides), [rawFields, state, fieldTypeOverrides]);
  const threshold = state?.settings.autoFillThreshold ?? 0.6;
  const highConfidenceCount = useMemo(
    () => fields.filter((field) => field.resolved.value && field.resolved.confidence >= threshold).length,
    [fields, threshold]
  );
  const selectedCount = useMemo(
    () => fields.filter((field) => fieldSelections[field.elementId] && field.resolved.value && !field.currentValue && field.visible && !field.disabled).length,
    [fields, fieldSelections]
  );

  async function refreshState() {
    const next = await getState();
    setState(next);
    const nextAvailableFieldTypes = getAvailableFieldTypes(next);
    if (!nextAvailableFieldTypes.includes(newFieldType) && next.customFieldTypes[0]) {
      setNewFieldType(next.customFieldTypes[0]);
    }
    return next;
  }

  async function scan() {
    setLoading(true);
    setMessage('');
    try {
      const [activeTab, latestState] = await Promise.all([getActiveTab(), refreshState()]);
      if (!activeTab) throw new Error('No active tab found');
      setTabInfo(activeTab);
      const response = await sendMessageToPage<{ fields?: DetectedField[] }>(activeTab.id, { type: 'SCAN_PAGE' });
      const nextRawFields = response.fields ?? [];
      const nextFields = buildEffectiveFields(nextRawFields, latestState, {});
      setRawFields(nextRawFields);
      setFieldTypeOverrides({});
      setFieldSelections(buildDefaultSelections(nextFields, latestState.settings.autoFillThreshold));
      await chrome.runtime.sendMessage({
        type: 'LOG_EVENT',
        payload: { type: 'scan', domain: nextFields[0]?.signature.domain, details: { fieldCount: nextFields.length } }
      });
      if (isPinned) {
        await chrome.runtime.sendMessage({
          type: 'SAVE_PINNED_SCAN',
          payload: { tabId: activeTab.id, url: activeTab.url, fields: nextRawFields, fieldSelections: buildDefaultSelections(nextFields, latestState.settings.autoFillThreshold), fieldTypeOverrides: {}, savedAt: new Date().toISOString() }
        });
      }
      setMessage(`Scanned ${nextRawFields.length} fields.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  }

  async function fillSelected() {
    if (!state || !tabInfo) return;
    setLoading(true);
    setMessage('');
    try {
      const instructions = fields
        .filter((field) => fieldSelections[field.elementId])
        .filter((field) => !field.disabled && field.visible && !field.currentValue)
        .filter((field) => !!field.resolved.value)
        .map((field) => ({
          elementId: field.elementId,
          value: field.resolved.value!,
          fieldType: field.resolved.fieldType
        }));

      const result = await sendMessageToPage<{ results: Array<{ status: string }> }>(tabInfo.id, {
        type: 'FILL_FIELDS',
        payload: { instructions }
      });

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

      setMessage(`Filled ${result.results.filter((item) => item.status === 'filled').length} fields.`);
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

  async function addCustomKey() {
    const normalized = normalizeKey(newCustomKey);
    if (!normalized) return;
    setLoading(true);
    setMessage('');
    try {
      await chrome.runtime.sendMessage({ type: 'ENSURE_FIELD_TYPE', payload: { fieldType: normalized } });
      setNewFieldType(normalized);
      setNewCustomKey('');
      await refreshState();
      setMessage(`Added custom profile key ${normalized}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Add key failed');
    } finally {
      setLoading(false);
    }
  }

  async function togglePin() {
    if (!tabInfo) return;
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);

    if (!nextPinned) {
      await chrome.runtime.sendMessage({ type: 'CLEAR_PINNED_SCAN', payload: { tabId: tabInfo.id } });
      setMessage('Unpinned scan results for this tab.');
      return;
    }

    await chrome.runtime.sendMessage({
      type: 'SAVE_PINNED_SCAN',
      payload: {
        tabId: tabInfo.id,
        url: tabInfo.url,
        fields: rawFields,
        fieldSelections,
        fieldTypeOverrides,
        savedAt: new Date().toISOString()
      }
    });
    setMessage(rawFields.length ? 'Pinned scan results for this tab.' : 'Pin is ready; scan once to cache the current tab.');
  }

  useEffect(() => {
    void (async () => {
      const [activeTab, latestState] = await Promise.all([getActiveTab(), refreshState()]);
      if (!activeTab) return;
      setTabInfo(activeTab);

      const pinned = latestState.pinnedScans[String(activeTab.id)];
      if (pinned?.url === activeTab.url) {
        setRawFields(pinned.fields);
        setFieldSelections(pinned.fieldSelections ?? buildDefaultSelections(buildEffectiveFields(pinned.fields, latestState, pinned.fieldTypeOverrides ?? {}), latestState.settings.autoFillThreshold));
        setFieldTypeOverrides(pinned.fieldTypeOverrides ?? {});
        setIsPinned(true);
        setMessage(`Loaded pinned scan (${pinned.fields.length} fields).`);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isPinned || !tabInfo) return;
    void chrome.runtime.sendMessage({
      type: 'SAVE_PINNED_SCAN',
      payload: {
        tabId: tabInfo.id,
        url: tabInfo.url,
        fields: rawFields,
        fieldSelections,
        fieldTypeOverrides,
        savedAt: new Date().toISOString()
      }
    });
  }, [isPinned, tabInfo, rawFields, fieldSelections, fieldTypeOverrides]);

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
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">High-confidence threshold: {threshold.toFixed(2)} · auto-selected: {highConfidenceCount}</span>
          <button className={isPinned ? '' : 'secondary'} onClick={() => void togglePin()} disabled={loading || !tabInfo}>{isPinned ? 'Unpin results' : 'Pin results'}</button>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button onClick={() => void scan()} disabled={loading}>Scan page</button>
          <button className="secondary" onClick={() => void fillSelected()} disabled={loading || !fields.length || !selectedCount}>Fill selected ({selectedCount})</button>
        </div>
        {message ? <div className="muted" style={{ marginTop: 8 }}>{message}</div> : null}
      </div>

      <div className="card">
        <strong>Quick save value</strong>
        <div className="muted">Save a value or add a new custom profile key without leaving the popup.</div>
        <div className="row" style={{ marginTop: 8 }}>
          <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as FieldType)}>
            {availableFieldTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input type="text" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Value to save" />
          <button onClick={() => void saveProfileValue()} disabled={loading || !newValue.trim()}>Save</button>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input type="text" value={newCustomKey} onChange={(e) => setNewCustomKey(e.target.value)} placeholder="Add custom profile key" />
          <button className="secondary" onClick={() => void addCustomKey()} disabled={loading || !newCustomKey.trim()}>Add key</button>
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
            const selected = !!fieldSelections[field.elementId];
            const selectedFieldType = fieldTypeOverrides[field.elementId] ?? field.resolved.fieldType;
            const detectedFieldType = top?.fieldType ?? field.resolved.fieldType ?? 'unknown';
            return (
              <div key={field.elementId} className="field-item">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{field.signature.label || field.signature.placeholder || field.signature.name || 'Unlabelled field'}</strong>
                  <span className="badge">{selectedFieldType || top?.fieldType || 'unknown'} · {Math.round((field.resolved.confidence ?? 0) * 100)}%</span>
                </div>
                <div className="muted mono" style={{ marginTop: 4 }}>
                  name={field.signature.name || '-'} id={field.signature.id || '-'} type={field.signature.inputType || field.signature.tagName}
                </div>
                {field.options?.length ? <div className="muted" style={{ marginTop: 4 }}>Options: {field.options.join(' | ')}</div> : null}
                <div className="muted" style={{ marginTop: 6 }}>Suggested value: {field.resolved.value ?? '—'} ({field.resolved.source})</div>
                <div className="muted" style={{ marginTop: 4 }}>Reasons: {[...(top?.reason ?? []), ...field.resolved.reasons].join(', ')}</div>
                <div className="row" style={{ marginTop: 8 }}>
                  <select
                    value={fieldTypeOverrides[field.elementId] ? selectedFieldType : '__auto__'}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setFieldTypeOverrides((current) => {
                        if (nextValue === '__auto__') {
                          const { [field.elementId]: _removed, ...rest } = current;
                          return rest;
                        }
                        return { ...current, [field.elementId]: nextValue };
                      });
                    }}
                  >
                    <option value="__auto__">auto ({detectedFieldType})</option>
                    {[...availableFieldTypes, 'unknown'].map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <button
                    className={selected ? '' : 'secondary'}
                    onClick={() => setFieldSelections((current) => ({ ...current, [field.elementId]: !current[field.elementId] }))}
                  >
                    {selected ? 'Use' : 'Not use'}
                  </button>
                </div>
              </div>
            );
          })}
          {!fields.length ? <div className="muted">Run a scan on the active tab to inspect detected fields. Pin results if you want to come back without rescanning.</div> : null}
        </div>
      </div>
    </div>
  );
}
