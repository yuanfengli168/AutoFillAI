import { findMapping } from './mappings';
import type { AppState, DetectedField, FieldType, ResolvedFieldValue, ValueVersion } from './types';

const sortByMostRecent = (values: ValueVersion[]) =>
  [...values].sort((a, b) => (b.lastUsedAt ?? b.updatedAt).localeCompare(a.lastUsedAt ?? a.updatedAt));

const sortByMostFrequent = (values: ValueVersion[]) => [...values].sort((a, b) => b.useCount - a.useCount);

export function resolveValueForFieldType(
  fieldType: FieldType,
  state: AppState,
  baseConfidence: number,
  source: ResolvedFieldValue['source'],
  reasons: string[]
): ResolvedFieldValue {
  const values = (state.profileValues[fieldType] ?? []).filter((item) => item.active);

  const pinned = values.find((item) => item.pinned);
  if (pinned) {
    return {
      fieldType,
      valueId: pinned.id,
      value: pinned.value,
      confidence: Math.min(1, Math.max(baseConfidence, 0.95)),
      source,
      reasons
    };
  }

  const recent = sortByMostRecent(values)[0];
  if (recent) {
    return {
      fieldType,
      valueId: recent.id,
      value: recent.value,
      confidence: Math.min(0.93, Math.max(baseConfidence, 0.72)),
      source,
      reasons
    };
  }

  const frequent = sortByMostFrequent(values)[0];
  if (frequent) {
    return {
      fieldType,
      valueId: frequent.id,
      value: frequent.value,
      confidence: Math.min(0.9, Math.max(baseConfidence, 0.68)),
      source,
      reasons
    };
  }

  return {
    fieldType,
    confidence: Math.max(0.2, baseConfidence - 0.2),
    source: 'none',
    reasons: ['no saved value available for this field type']
  };
}

export function resolveValue(field: DetectedField, state: AppState): ResolvedFieldValue {
  const candidate = field.candidateFieldTypes[0];
  if (!candidate || candidate.fieldType === 'unknown') {
    return { fieldType: 'unknown', confidence: 0.1, source: 'none', reasons: ['field type unknown'] };
  }

  const values = (state.profileValues[candidate.fieldType] ?? []).filter((item) => item.active);
  const mapping = findMapping(field, state.mappings);

  if (mapping?.preferredValueId) {
    const preferred = values.find((item) => item.id === mapping.preferredValueId);
    if (preferred) {
      return {
        fieldType: candidate.fieldType,
        valueId: preferred.id,
        value: preferred.value,
        confidence: Math.min(1, candidate.score + 0.15),
        source: 'site_mapping',
        reasons: ['matched site mapping with preferred value']
      };
    }
  }

  if (mapping && values[0]) {
    return {
      fieldType: candidate.fieldType,
      valueId: values[0].id,
      value: values[0].value,
      confidence: Math.min(1, candidate.score + 0.08),
      source: 'site_mapping',
      reasons: ['matched site mapping']
    };
  }

  const resolved = resolveValueForFieldType(
    candidate.fieldType,
    state,
    candidate.score,
    values.find((item) => item.pinned) ? 'pinned_default' : sortByMostRecent(values)[0] ? 'most_recent' : 'most_frequent',
    values.find((item) => item.pinned)
      ? ['using pinned default value']
      : sortByMostRecent(values)[0]
        ? ['using most recently used value']
        : ['using most frequently used value']
  );

  if (resolved.source !== 'none') return resolved;

  return {
    fieldType: candidate.fieldType,
    confidence: Math.max(0.2, candidate.score - 0.2),
    source: 'none',
    reasons: ['no saved value available for this field type']
  };
}
