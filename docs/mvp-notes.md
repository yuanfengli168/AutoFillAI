# AutoFillAI MVP Notes

## What shipped on `mvp1`

A working Chrome extension MVP built with:
- Manifest V3
- TypeScript
- React popup + options page
- Local storage via `chrome.storage.local`
- Shared heuristic classifier / resolver core

## Current capabilities

- Scan the current page for `input`, `textarea`, and `select` elements
- Extract field metadata: label, name, id, placeholder, autocomplete, nearby text, visibility, disabled state
- Heuristically classify common profile/application fields
- Resolve saved profile values using this order:
  1. site mapping with preferred value
  2. site mapping without preferred value
  3. pinned default
  4. most recent
  5. most frequent
- Popup UI to inspect detected fields and suggested values
- One-click fill for high-confidence empty fields
- Local profile value store in options page
- Learned mappings saved after successful fills
- Value usage metadata updates (`useCount`, `lastUsedAt`)

## Scope choices / assumptions

- Password fields are excluded from V1.
- MVP is single-profile and local-only.
- Autofill only targets empty visible enabled fields unless future overwrite support is expanded.
- Heuristics are deterministic and intentionally conservative; ambiguous fields stay lower confidence.
- Mapping learning happens after successful fill, using a lightweight matcher (`domain` + `name/id/label/placeholder/path`).

## Known caveats

- Custom JS widgets / headless comboboxes are not fully supported yet.
- Native `select` elements are scanned, but option-level UX and custom radio/yes-no widgets are not surfaced well yet.
- Select filling currently uses raw option values; labels are not fuzzy-matched yet.
- Popup only exposes "fill high-confidence" right now, not per-field manual fill controls.
- Popup scan state is not pinned yet; switching tabs or closing/reopening the popup requires a fresh scan.
- Confidence thresholds are intentionally conservative, so a field can be correctly classified but still sit below the autofill threshold.
- Correction learning is not yet implemented.
- Default seeded values are minimal (name + LinkedIn URL) and should be expanded in Options for real use.

## Debugging log - 2026-04-23

Live debugging on real target pages was driven by user feedback, screenshots, and repeated manual retests in Chrome.

Observed sequence:
1. Popup opened, but `Scan page` failed with `Could not establish connection. Receiving end does not exist.`
2. Added popup-side recovery to inject the content script when the receiver is missing.
3. User then hit `Cannot use import statement outside a module` during fallback injection.
4. Added a temporary bootstrap loader, which then exposed `Failed to fetch dynamically imported module` because extension module assets were not accessible from the page context.
5. Final root cause: the content script build output was ESM/chunked, but the manifest-loaded content script path needed a single classic script bundle.
6. Reworked the build so `dist/content.js` is emitted as one self-contained classic bundle via `esbuild`, while Vite continues to build popup/options/background.
7. User reloaded the unpacked extension and confirmed page scanning now works for text fields.

Outcome:
- content script loading is stable again
- popup scan works after reload on the tested page
- remaining product gaps are now about field coverage/UX rather than extension boot failure

## Local test flow

1. `npm install`
2. `npm run build`
3. In Chrome, open `chrome://extensions`
4. Enable Developer Mode
5. Load unpacked extension from `dist/`
6. Open a target form page
7. Use the extension popup to scan and autofill
