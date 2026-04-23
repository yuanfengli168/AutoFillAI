# AutoFillAI

AutoFillAI is a Chrome extension MVP for smart, reusable form autofill on job application pages and other websites.

## Goal

Help Jacky fill common application and profile fields quickly, accurately, and with less manual typing.

## Initial scope

- Detect common fields on the current page
- Match fields to saved profile values
- Autofill high-confidence fields
- Let the user review uncertain fields
- Remember field mappings over time
- Keep versioned values (most recent, most used, pinned default)
- Expose a clean internal API for future automation services

## Docs

- [Product Spec](./docs/product-spec.md)
- [Design Doc](./docs/design-doc.md)

## Proposed MVP stack

- Chrome Extension Manifest V3
- TypeScript
- React for popup/options UI
- Local storage first (`chrome.storage.local`)
- Shared autofill engine core

## Status

Functional MVP scaffolded on branch `mvp1`.

Implemented:
- current-page scan for standard form controls
- field metadata extraction + heuristic classification
- popup UI to inspect scan results, override field type, and choose among multiple saved values per field
- local profile value storage + options page
- explicit pinned default management for saved values in popup/options
- high-confidence autofill for empty fields
- learned site mappings and value-usage audit updates

## Local development

```bash
npm install
npm run build
```

Then load `dist/` as an unpacked Chrome extension.

## MVP notes

- [MVP implementation notes](./docs/mvp-notes.md)
