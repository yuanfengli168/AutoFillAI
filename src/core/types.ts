export const FIELD_TYPES = [
  'first_name',
  'last_name',
  'full_name',
  'email',
  'phone',
  'location_city',
  'location_full',
  'country',
  'linkedin_url',
  'portfolio_url',
  'current_title',
  'current_company',
  'work_authorization',
  'visa_sponsorship_required',
  'notice_period',
  'years_experience_total',
  'github_url',
  'website_url',
  'unknown'
] as const;

export type BuiltInFieldType = (typeof FIELD_TYPES)[number];
export type FieldType = string;

export interface FieldSignature {
  tagName: string;
  inputType?: string;
  name?: string;
  id?: string;
  label?: string;
  placeholder?: string;
  autocomplete?: string;
  ariaLabel?: string;
  nearbyText?: string[];
  domain: string;
  path?: string;
}

export interface CandidateFieldType {
  fieldType: FieldType;
  score: number;
  reason: string[];
}

export interface DetectedField {
  elementId: string;
  signature: FieldSignature;
  candidateFieldTypes: CandidateFieldType[];
  currentValue?: string;
  visible: boolean;
  disabled: boolean;
  options?: string[];
}

export interface ValueVersion {
  id: string;
  value: string;
  label?: string;
  pinned?: boolean;
  active: boolean;
  useCount: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  source?: 'manual' | 'learned' | 'imported';
}

export interface MappingRule {
  id: string;
  domain: string;
  fieldType: FieldType;
  matcher: Partial<FieldSignature>;
  preferredValueId?: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface ResolvedFieldValue {
  fieldType: FieldType;
  valueId?: string;
  value?: string;
  confidence: number;
  source: 'site_mapping' | 'pinned_default' | 'most_recent' | 'most_frequent' | 'manual_override' | 'none';
  reasons: string[];
}

export interface EnrichedDetectedField extends DetectedField {
  resolved: ResolvedFieldValue;
}

export interface AuditEvent {
  id: string;
  type: 'scan' | 'fill' | 'save_mapping' | 'save_value';
  timestamp: string;
  domain?: string;
  details?: Record<string, unknown>;
}

export interface PinnedScan {
  tabId: number;
  url: string;
  fields: DetectedField[];
  fieldSelections?: Record<string, boolean>;
  fieldTypeOverrides?: Record<string, FieldType>;
  fieldValueOverrides?: Record<string, string>;
  savedAt: string;
}

export interface AppState {
  profileValues: Record<string, ValueVersion[]>;
  customFieldTypes: string[];
  pinnedScans: Record<string, PinnedScan>;
  mappings: MappingRule[];
  settings: {
    autoFillThreshold: number;
    suggestThreshold: number;
    rememberCorrections: boolean;
  };
  auditLog: AuditEvent[];
}

export interface FillInstruction {
  elementId: string;
  value: string;
  fieldType: FieldType;
}

export interface FillResultItem {
  elementId: string;
  fieldType: FieldType;
  status: 'filled' | 'skipped' | 'missing' | 'error';
  reason?: string;
}

export interface FillResult {
  results: FillResultItem[];
}
