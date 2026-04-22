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

Planning/spec phase.
