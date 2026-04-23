import { classifyField } from './field-classifier';
import { resolveValue, resolveValueForFieldType } from './resolver';
import type { AppState, DetectedField, EnrichedDetectedField, FillInstruction, FillResult, MappingRule, ValueVersion, FieldType, FieldSignature } from './types';

export interface AutoFillCoreApi {
  classifyField(signature: FieldSignature): ReturnType<typeof classifyField>;
  resolveValue(field: DetectedField, state: AppState): ReturnType<typeof resolveValue>;
  resolveValueForFieldType(fieldType: FieldType, state: AppState, baseConfidence: number): ReturnType<typeof resolveValueForFieldType>;
  enrichScan(fields: DetectedField[], state: AppState): EnrichedDetectedField[];
  createFillInstructions(fields: EnrichedDetectedField[], threshold: number): FillInstruction[];
}

export const autoFillCoreApi = {
  classifyField,
  resolveValue,
  resolveValueForFieldType(fieldType: FieldType, state: AppState, baseConfidence: number) {
    return resolveValueForFieldType(fieldType, state, baseConfidence, 'manual_override', [`user selected profile key ${fieldType}`]);
  },
  enrichScan(fields: DetectedField[], state: AppState): EnrichedDetectedField[] {
    return fields.map((field) => ({ ...field, resolved: resolveValue(field, state) }));
  },
  createFillInstructions(fields: EnrichedDetectedField[], threshold: number): FillInstruction[] {
    return fields
      .filter((field) => !field.disabled && field.visible && !field.currentValue)
      .filter((field) => !!field.resolved.value && field.resolved.confidence >= threshold)
      .map((field) => ({
        elementId: field.elementId,
        value: field.resolved.value!,
        fieldType: field.resolved.fieldType
      }));
  }
} satisfies AutoFillCoreApi;

export type { AppState, DetectedField, EnrichedDetectedField, FillInstruction, FillResult, MappingRule, ValueVersion, FieldType };
