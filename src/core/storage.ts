import { DEFAULT_STATE } from './defaults';
import type { AppState, AuditEvent, FieldType, MappingRule, PinnedScan, ValueVersion } from './types';
import { nowIso, normalizeText, uid } from './utils';

const STORAGE_KEY = 'autofillai_state';

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

function isBuiltInFieldType(fieldType: string) {
  return Object.prototype.hasOwnProperty.call(DEFAULT_STATE.profileValues, fieldType);
}

function mergeState(saved: AppState): AppState {
  return {
    ...DEFAULT_STATE,
    ...saved,
    profileValues: { ...DEFAULT_STATE.profileValues, ...(saved.profileValues ?? {}) },
    customFieldTypes: saved.customFieldTypes ?? [],
    pinnedScans: saved.pinnedScans ?? {},
    settings: { ...DEFAULT_STATE.settings, ...saved.settings },
    mappings: saved.mappings ?? [],
    auditLog: saved.auditLog ?? []
  };
}

export async function getState(): Promise<AppState> {
  if (!hasChromeStorage()) return structuredClone(DEFAULT_STATE);
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  const saved = raw[STORAGE_KEY] as AppState | undefined;
  if (!saved) {
    await saveState(DEFAULT_STATE);
    return structuredClone(DEFAULT_STATE);
  }
  return mergeState(saved);
}

export async function saveState(state: AppState): Promise<void> {
  if (!hasChromeStorage()) return;
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export async function updateState(updater: (state: AppState) => AppState | Promise<AppState>) {
  const current = await getState();
  const next = await updater(current);
  await saveState(next);
  return next;
}

export async function ensureFieldType(fieldType: FieldType) {
  const normalized = normalizeText(fieldType).replace(/\s+/g, '_');
  if (!normalized || normalized === 'unknown') return getState();

  return updateState((state) => {
    const nextProfileValues = state.profileValues[normalized] ? state.profileValues : { ...state.profileValues, [normalized]: [] };
    const nextCustomFieldTypes = isBuiltInFieldType(normalized) || state.customFieldTypes.includes(normalized)
      ? state.customFieldTypes
      : [...state.customFieldTypes, normalized].sort();

    return {
      ...state,
      profileValues: nextProfileValues,
      customFieldTypes: nextCustomFieldTypes
    };
  });
}

export async function saveProfileValue(fieldType: FieldType, input: Partial<ValueVersion> & { value: string }) {
  const normalizedFieldType = normalizeText(fieldType).replace(/\s+/g, '_');
  const baseState = await ensureFieldType(normalizedFieldType);

  return updateState((currentState) => {
    const state = mergeState({ ...currentState, profileValues: { ...baseState.profileValues, ...currentState.profileValues } });
    const now = nowIso();
    const existing = state.profileValues[normalizedFieldType] ?? [];
    const version: ValueVersion = {
      id: input.id ?? uid(normalizedFieldType),
      value: input.value,
      label: input.label ?? 'manual',
      pinned: input.pinned ?? existing.length === 0,
      active: input.active ?? true,
      useCount: input.useCount ?? 0,
      createdAt: input.createdAt ?? now,
      updatedAt: now,
      lastUsedAt: input.lastUsedAt,
      source: input.source ?? 'manual'
    };

    const nextValues = input.id
      ? existing.map((item) => (item.id === input.id ? { ...item, ...version, updatedAt: now } : item))
      : [...existing, version];

    return {
      ...state,
      profileValues: { ...state.profileValues, [normalizedFieldType]: nextValues }
    };
  });
}

export async function updateSettings(settingsPatch: Partial<AppState['settings']>) {
  return updateState((state) => ({
    ...state,
    settings: { ...state.settings, ...settingsPatch }
  }));
}

export async function savePinnedScan(scan: PinnedScan) {
  return updateState((state) => ({
    ...state,
    pinnedScans: {
      ...state.pinnedScans,
      [String(scan.tabId)]: scan
    }
  }));
}

export async function clearPinnedScan(tabId: number) {
  return updateState((state) => {
    const pinnedScans = { ...state.pinnedScans };
    delete pinnedScans[String(tabId)];
    return { ...state, pinnedScans };
  });
}

export async function saveMapping(mapping: Omit<MappingRule, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<MappingRule, 'id' | 'createdAt' | 'updatedAt'>>) {
  return updateState((state) => {
    const now = nowIso();
    const matchedExisting = mapping.id
      ? state.mappings.find((item) => item.id === mapping.id)
      : state.mappings.find(
          (item) =>
            item.domain === mapping.domain &&
            item.fieldType === mapping.fieldType &&
            item.matcher.name === mapping.matcher.name &&
            item.matcher.id === mapping.matcher.id &&
            item.matcher.label === mapping.matcher.label &&
            item.matcher.placeholder === mapping.matcher.placeholder &&
            item.matcher.path === mapping.matcher.path
        );

    const next: MappingRule = {
      ...matchedExisting,
      ...mapping,
      id: matchedExisting?.id ?? mapping.id ?? uid('mapping'),
      createdAt: matchedExisting?.createdAt ?? mapping.createdAt ?? now,
      updatedAt: now
    } as MappingRule;

    const mappings = matchedExisting
      ? state.mappings.map((item) => (item.id === matchedExisting.id ? next : item))
      : [...state.mappings, next];

    return { ...state, mappings };
  });
}

export async function markValueUsed(fieldType: FieldType, valueId?: string) {
  if (!valueId) return getState();
  return updateState((state) => {
    const values = state.profileValues[fieldType] ?? [];
    return {
      ...state,
      profileValues: {
        ...state.profileValues,
        [fieldType]: values.map((item) =>
          item.id === valueId
            ? { ...item, useCount: item.useCount + 1, lastUsedAt: nowIso(), updatedAt: nowIso() }
            : item
        )
      }
    };
  });
}

export async function appendAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'> & Partial<Pick<AuditEvent, 'id' | 'timestamp'>>) {
  return updateState((state) => ({
    ...state,
    auditLog: [
      {
        ...event,
        id: event.id ?? uid('audit'),
        timestamp: event.timestamp ?? nowIso()
      } as AuditEvent,
      ...state.auditLog
    ].slice(0, 200)
  }));
}
