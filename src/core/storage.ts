import { DEFAULT_STATE } from './defaults';
import type { AppState, AuditEvent, FieldType, MappingRule, ValueVersion } from './types';
import { nowIso, uid } from './utils';

const STORAGE_KEY = 'autofillai_state';

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

export async function getState(): Promise<AppState> {
  if (!hasChromeStorage()) return structuredClone(DEFAULT_STATE);
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  const saved = raw[STORAGE_KEY] as AppState | undefined;
  if (!saved) {
    await saveState(DEFAULT_STATE);
    return structuredClone(DEFAULT_STATE);
  }
  return {
    ...DEFAULT_STATE,
    ...saved,
    profileValues: { ...DEFAULT_STATE.profileValues, ...saved.profileValues },
    settings: { ...DEFAULT_STATE.settings, ...saved.settings },
    mappings: saved.mappings ?? [],
    auditLog: saved.auditLog ?? []
  };
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

export async function saveProfileValue(fieldType: FieldType, input: Partial<ValueVersion> & { value: string }) {
  return updateState((state) => {
    const now = nowIso();
    const existing = state.profileValues[fieldType] ?? [];
    const version: ValueVersion = {
      id: input.id ?? uid(fieldType),
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
      profileValues: { ...state.profileValues, [fieldType]: nextValues }
    };
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
