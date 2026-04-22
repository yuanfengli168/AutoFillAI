import type { DetectedField, MappingRule } from './types';
import { normalizeText } from './utils';

const getTopType = (field: DetectedField) => field.candidateFieldTypes[0]?.fieldType ?? 'unknown';

export function findMapping(field: DetectedField, mappings: MappingRule[]): MappingRule | undefined {
  const topType = getTopType(field);

  return mappings
    .filter((mapping) => mapping.domain === field.signature.domain && mapping.fieldType === topType)
    .find((mapping) => {
      const matcher = mapping.matcher;
      const checks = [
        !matcher.name || normalizeText(matcher.name) === normalizeText(field.signature.name),
        !matcher.id || normalizeText(matcher.id) === normalizeText(field.signature.id),
        !matcher.label || normalizeText(matcher.label) === normalizeText(field.signature.label),
        !matcher.placeholder || normalizeText(matcher.placeholder) === normalizeText(field.signature.placeholder),
        !matcher.path || normalizeText(matcher.path) === normalizeText(field.signature.path)
      ];
      return checks.every(Boolean);
    });
}
