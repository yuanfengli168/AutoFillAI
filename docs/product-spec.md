# AutoFillAI Product Spec

## 1. Overview

AutoFillAI is a Chrome extension that helps users fill forms on the current page faster and more accurately than standard browser autofill. The first target use case is job application pages, especially flows similar to LinkedIn Easy Apply and external application pages.

The MVP should be useful tomorrow, not perfect later. Prioritize speed, reliability, and clear user control.

## 2. Problem

Job applications repeatedly ask for the same information:

- name
- email
- phone
- LinkedIn URL
- location
- current title/company
- work authorization
- years of experience
- other common profile fields

Normal browser autofill is too shallow:

- weak field understanding
- poor handling of custom forms
- no profile-level versioning
- no reusable mapping memory
- no structured API for future automation

The user wants a smart autofill assistant that can remember values, choose the best version of a field, and fill pages quickly.

## 3. Primary User

Jacky Li, actively applying for jobs and wanting to reduce repetitive form filling while keeping control over what is submitted.

## 4. Product Goals

### Primary goals

1. Autofill common fields on the current page with high accuracy.
2. Save time during job applications.
3. Remember field mappings across websites.
4. Store multiple versions of a value and choose intelligently.
5. Provide a clean core/API that can later plug into larger job application automation.

### Non-goals for MVP

1. Full end-to-end application submission across all websites.
2. Resume upload automation.
3. AI-generated essay/cover-letter responses.
4. Cloud sync or multi-device sync.
5. Password-vault replacement.

## 5. User Stories

### Core use cases

1. As a user, I want AutoFillAI to detect common fields on the current page and suggest values.
2. As a user, I want one-click autofill for high-confidence fields.
3. As a user, I want to review uncertain fields before filling them.
4. As a user, I want the extension to remember which field maps to which saved value on a site.
5. As a user, I want multiple saved versions of values like email or phone.
6. As a user, I want the system to know which value is most recent, most used, or pinned as default.
7. As a user, I want the extension to learn from my manual corrections.
8. As a future integrator, I want a stable internal API so this logic can be reused in a bigger application.

## 6. MVP Scope

### In scope

- Chrome extension for current-page form detection and autofill
- Local profile/value storage
- Versioned values for selected field types
- Field classification heuristics
- Site/page field-memory mappings
- Popup UI to review/fill
- Options page to manage saved values
- Internal extension API / shared core module
- Audit metadata such as last-used time and use count

### Out of scope

- Browser-wide form interception on every page without user action
- Password management beyond a minimal optional path
- External backend
- Server database
- Advanced AI reasoning for every field
- Full browser automation flows

## 7. Supported Field Types in MVP

### Tier 1: must-have

- first_name
- last_name
- full_name
- email
- phone
- location_city
- location_full
- linkedin_url
- portfolio_url
- current_title
- current_company

### Tier 2: nice-to-have if time permits

- work_authorization
- visa_sponsorship_required
- notice_period
- years_experience_total
- github_url
- website_url

### Deferred

- passwords
- salary expectations
- long-form answers
- resume upload selection
- demographic/EEO responses unless explicitly configured

## 8. User Experience

### Main flow

1. User opens a form page.
2. User clicks the AutoFillAI extension icon.
3. Extension scans the page and lists detected fields.
4. Extension shows:
   - matched value
   - confidence score
   - data source
   - whether field has prior memory on this site
5. User chooses one of:
   - Fill all high-confidence fields
   - Review field-by-field
   - Save a new mapping/value
6. Extension fills values and triggers required DOM events.
7. If user changes a filled value manually, extension can offer to remember it.

### UX principles

- Fast first action
- Never hide what was filled
- Be conservative on low-confidence fields
- Learn from user corrections
- Keep settings understandable

## 9. Functional Requirements

### FR1: Field detection

The system shall detect form controls on the current page, including:

- input
- textarea
- select
- common custom combobox patterns if feasible

### FR2: Field classification

The system shall classify fields using:

- label text
- placeholder text
- input name/id
- autocomplete attribute
- nearby helper text
- page/domain context

### FR3: Profile data store

The system shall store user values in structured field buckets.

### FR4: Versioned values

The system shall support multiple values per field type with metadata:

- label
- active flag
- pinned flag
- last used timestamp
- use count
- source

### FR5: Site memory

The system shall remember field mappings per domain/page signature.

### FR6: Autofill

The system shall insert chosen values into page fields and dispatch the events needed for modern web apps to register the change.

### FR7: Manual correction learning

The system should offer to save new values or update mappings when the user corrects a filled field.

### FR8: Review UI

The popup shall allow the user to:

- see detected fields
- preview matches
- fill selected/all fields
- skip fields

### FR9: Settings UI

The options page shall allow the user to:

- manage stored values
- manage versions
- set pinned defaults
- inspect domain mappings

### FR10: Internal API

The extension shall expose a stable internal core interface for:

- scanPage()
- classifyField()
- resolveValue()
- fillFields()
- saveMapping()
- saveValueVersion()

## 10. Data Requirements

### Example value record

```json
{
  "fieldType": "email",
  "values": [
    {
      "id": "email_1",
      "value": "jacky@example.com",
      "label": "primary",
      "pinned": true,
      "active": true,
      "lastUsedAt": "2026-04-22T10:00:00.000Z",
      "useCount": 34,
      "createdAt": "2026-04-01T00:00:00.000Z",
      "updatedAt": "2026-04-22T10:00:00.000Z"
    }
  ]
}
```

### Example mapping record

```json
{
  "domain": "linkedin.com",
  "fieldSignature": {
    "label": "Email address",
    "name": "email",
    "type": "email"
  },
  "fieldType": "email",
  "preferredValueId": "email_1",
  "confidence": 0.98,
  "lastUsedAt": "2026-04-22T10:10:00.000Z"
}
```

## 11. Success Metrics

### MVP success looks like

- User can fill common form fields on a target page in one action.
- At least 70-80% of standard personal info fields are correctly matched on common job forms in initial testing.
- User correction rate decreases after repeated use on the same sites.
- Setup is light enough that the user can actually use it tomorrow.

## 12. Risks

- Custom form components may be hard to fill reliably.
- Field meaning can be ambiguous.
- Over-aggressive autofill can create bad submissions.
- Password handling is security-sensitive.
- LinkedIn and some sites may have dynamic or anti-automation patterns.

## 13. Open Questions

1. Should passwords be explicitly excluded from V1?
2. Should the initial value store be single-profile or multi-profile?
3. Should site-specific overrides always outrank pinned global defaults?
4. Should we support import/export of profile data in MVP?
5. What exact fields matter most to Jacky on day one?

## 14. Recommended MVP Cut

To ship in 24-48 hours, prioritize:

- single-user profile
- tier-1 field types
- popup scan + autofill
- options page for value management
- local storage only
- site memory for mappings
- clear logs/debug output

Everything else is optional.
