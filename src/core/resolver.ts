import { findMapping } from './mappings';
import type { AppState, DetectedField, ResolvedFieldValue, ValueVersion } from './types';

const sortByMostRecent = (values: ValueVersion[]) =>
  [...values].sort((a, b) => (b.lastUsedAt ?? b.updatedAt).localeCompare(a.lastUsedAt ?? a.updatedAt));

const sortByMostFrequent = (values: ValueVersion[]) => [...values].sort((a, b) => b.useCount - a.useCount);

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

  const pinned = values.find((item) => item.pinned);
  if (pinned) {
    return {
      fieldType: candidate.fieldType,
      valueId: pinned.id,
      value: pinned.value,
      confidence: Math.min(0.98, candidate.score),
      source: 'pinned_default',
      reasons: ['using pinned default value']
    };
  }

  const recent = sortByMostRecent(values)[0];
  if (recent) {
    return {
      fieldType: candidate.fieldType,
      valueId: recent.id,
      value: recent.value,
      confidence: Math.min(0.93, candidate.score - 0.02),
      source: 'most_recent',
      reasons: ['using most recently used value']
    };
  }

  const frequent = sortByMostFrequent(values)[0];
  if (frequent) {
    return {
      fieldType: candidate.fieldType,
      valueId: frequent.id,
      value: frequent.value,
      confidence: Math.min(0.9, candidate.score - 0.05),
      source: 'most_frequent',
      reasons: ['using most frequently used value']
    };
  }

  return {
    fieldType: candidate.fieldType,
    confidence: Math.max(0.2, candidate.score - 0.2),
    source: 'none',
    reasons: ['no saved value available for this field type']
  };
}
