# AutoFillAI Design Doc

## 1. Purpose

Design a Chrome extension MVP that can detect fields on the current page, resolve the best saved value for each field, and fill forms reliably. The design should support fast delivery in 24-48 hours while leaving room for future API-driven expansion.

## 2. Design Principles

1. Prefer deterministic heuristics first.
2. Keep the core reusable outside the extension UI.
3. Be conservative when confidence is low.
4. Store structured memory, not just raw autofill blobs.
5. Optimize for shipping speed and debuggability.

## 3. Architecture Overview

The system is split into four parts:

1. **Content script**
   - runs on the active page
   - discovers fields
   - extracts field metadata
   - fills fields

2. **Background/service worker**
   - coordinates storage and business logic
   - exposes message handlers
   - centralizes mutations and audit events

3. **UI layer**
   - popup for scan/review/fill
   - options page for profile and mappings management

4. **Core library**
   - pure TypeScript modules shared by popup/background/content script where possible
   - contains field classification, value resolution, scoring, and data model helpers

## 4. Proposed Tech Stack

- Manifest V3
- TypeScript
- Vite or Plasmo-style extension build tooling
- React for popup/options UI
- chrome.storage.local for MVP persistence
- zod or TypeScript types for schema validation if time permits

## 5. Module Breakdown

```text
src/
  background/
    service-worker.ts
  content/
    content-script.ts
    dom-scan.ts
    dom-fill.ts
  popup/
    Popup.tsx
  options/
    Options.tsx
  core/
    types.ts
    field-signature.ts
    field-classifier.ts
    resolver.ts
    score.ts
    storage.ts
    mappings.ts
    api.ts
  shared/
    messages.ts
```

## 6. Core Concepts

### 6.1 Field signature

A field signature captures the evidence used to identify a field.

```ts
interface FieldSignature {
  tagName: string
  inputType?: string
  name?: string
  id?: string
  label?: string
  placeholder?: string
  autocomplete?: string
  ariaLabel?: string
  nearbyText?: string[]
  domain: string
  path?: string
}
```

### 6.2 Detected field

```ts
interface DetectedField {
  elementId: string
  signature: FieldSignature
  candidateFieldTypes: Array<{
    fieldType: FieldType
    score: number
    reason: string[]
  }>
  currentValue?: string
  visible: boolean
  disabled: boolean
}
```

### 6.3 Value version

```ts
interface ValueVersion {
  id: string
  value: string
  label?: string
  pinned?: boolean
  active: boolean
  useCount: number
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
  source?: 'manual' | 'learned' | 'imported'
}
```

### 6.4 Mapping rule

```ts
interface MappingRule {
  id: string
  domain: string
  fieldType: FieldType
  matcher: Partial<FieldSignature>
  preferredValueId?: string
  confidence: number
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
}
```

## 7. Data Model

### 7.1 Field types

```ts
type FieldType =
  | 'first_name'
  | 'last_name'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'location_city'
  | 'location_full'
  | 'linkedin_url'
  | 'portfolio_url'
  | 'current_title'
  | 'current_company'
  | 'work_authorization'
  | 'visa_sponsorship_required'
  | 'notice_period'
  | 'years_experience_total'
  | 'unknown'
```

### 7.2 Storage shape

```ts
interface AppState {
  profileValues: Record<FieldType, ValueVersion[]>
  mappings: MappingRule[]
  settings: {
    autoFillThreshold: number
    suggestThreshold: number
    rememberCorrections: boolean
  }
  auditLog: AuditEvent[]
}
```

## 8. Detection and Classification

### 8.1 DOM scan strategy

Select likely form elements:
- `input`
- `textarea`
- `select`
- editable combobox patterns if practical

For each element, collect:
- attributes
- associated label text
- placeholder
- aria-label
- nearby text from parent/container
- current value
- visibility/disabled state

### 8.2 Classification heuristics

Use weighted rules.

Examples:
- if `type=email` => strong boost for `email`
- if label contains `first name` => strong boost for `first_name`
- if placeholder contains `LinkedIn` => strong boost for `linkedin_url`
- if autocomplete is `given-name` => strong boost for `first_name`
- if label contains `company` => boost for `current_company`

Classification output should include:
- candidate types
- scores
- reasons

This makes debugging much easier.

## 9. Value Resolution

Given a classified field, choose the best value using this order:

1. exact site-specific mapping with preferred value
2. exact site-specific mapping without preferred value
3. pinned global default for that field type
4. most recently used active value
5. most frequently used active value
6. no match

Return both the chosen value and a confidence score.

### Example resolver result

```ts
interface ResolvedFieldValue {
  fieldType: FieldType
  valueId?: string
  value?: string
  confidence: number
  source:
    | 'site_mapping'
    | 'pinned_default'
    | 'most_recent'
    | 'most_frequent'
    | 'none'
  reasons: string[]
}
```

## 10. Fill Engine

### 10.1 Fill strategy

For text-like inputs:
- focus element
- set native value safely
- dispatch `input`
- dispatch `change`
- optionally blur

For selects:
- set selected option
- dispatch change

For React-controlled inputs, use native property setters if needed instead of plain assignment only.

### 10.2 Safety rules

Do not autofill if:
- field is disabled
- field is hidden
- field already has a non-empty value unless overwrite is explicitly allowed
- confidence is below threshold for automatic mode

## 11. User Interface

### 11.1 Popup

Sections:
- current page summary
- detected fields list
- confidence badges
- fill actions
- per-field override/edit actions

Primary buttons:
- Scan page
- Fill high-confidence
- Fill selected
- Refresh

### 11.2 Options page

Tabs or sections:
- profile values
- version history
- mappings by domain
- settings
- debug/export

## 12. Messaging / API Design

Use extension message passing first.

### Content script exposed actions

- `SCAN_PAGE`
- `FILL_FIELDS`

### Background actions

- `GET_PROFILE_VALUES`
- `SAVE_PROFILE_VALUE`
- `SAVE_MAPPING`
- `GET_MAPPINGS`
- `LOG_FILL_EVENT`

### Core API interface

```ts
interface AutoFillCoreApi {
  scanPage(): Promise<DetectedField[]>
  classifyField(signature: FieldSignature): ClassifiedField
  resolveValue(field: ClassifiedField, state: AppState): ResolvedFieldValue
  fillFields(request: FillRequest): Promise<FillResult>
  saveMapping(rule: MappingRule): Promise<void>
  saveValueVersion(fieldType: FieldType, version: ValueVersion): Promise<void>
}
```

The same logic should stay reusable for a future desktop app or browser automation tool.

## 13. Storage Strategy

### MVP

Use `chrome.storage.local`.

Why:
- simple
- works offline
- enough for single-user local usage
- fast to implement

### Future

Could later move to:
- IndexedDB for larger data
- encrypted local storage for sensitive values
- local service/backend for multi-app reuse
- cloud sync

## 14. Security Considerations

### Passwords

Recommendation: exclude from V1 unless absolutely required.

Reasons:
- security-sensitive
- browsers already have password managers
- storing credentials safely takes extra work

### Other personal data

- store locally only in MVP
- do not transmit data externally
- support manual delete/edit
- keep export/import behind explicit user action

## 15. Observability and Debugging

Include:
- classifier reasons per field
- fill result status per field
- audit records for value usage
- optional debug toggle in settings

### Example audit event

```ts
interface AuditEvent {
  id: string
  type: 'scan' | 'fill' | 'save_mapping' | 'save_value'
  timestamp: string
  domain?: string
  details?: Record<string, unknown>
}
```

## 16. 24-48 Hour Delivery Plan

### Day 1 / first 12-18 hours

1. Initialize extension repo
2. Set up manifest + build
3. Implement DOM scan
4. Implement field classification heuristics
5. Implement local storage model
6. Build simple popup with scan results

### Day 2 / next 12-24 hours

7. Implement resolver logic
8. Implement fill engine
9. Add options page for value management
10. Add mapping memory persistence
11. Test on a few real pages
12. Fix edge cases and package

## 17. Suggested MVP Milestones

### Milestone A
- detect fields
- classify common fields
- show scan results in popup

### Milestone B
- save profile values
- resolve best value
- autofill page

### Milestone C
- remember mappings
- improve review UX
- package for daily use

## 18. Risks and Tradeoffs

### Tradeoff: speed vs sophistication

Use heuristics now, AI later.

### Tradeoff: local-only vs extensible backend

Keep local-first, but design typed APIs so logic can move later.

### Tradeoff: broad site support vs reliable core fields

Support a smaller set of field types really well first.

## 19. Recommended Repo Structure

```text
AutoFillAI/
  README.md
  docs/
    product-spec.md
    design-doc.md
  src/
    background/
    content/
    core/
    options/
    popup/
    shared/
  public/
    manifest.json
  package.json
  tsconfig.json
```

## 20. Next Build Step

After doc approval, immediately scaffold the extension and implement:
- scan
- classify
- fill
- save values

That should be enough to make a first usable version quickly.
