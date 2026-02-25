# Deferred Items — Phase 05 Advanced Features

Items discovered during execution that are out of scope for current plan task changes.

## Pre-existing Build Issues

### 1. Unused variable in portal page
- **File:** `frontend/src/app/(app)/portal/[dept]/page.tsx:167`
- **Issue:** `'hourlyRate' is assigned a value but never used` (`@typescript-eslint/no-unused-vars`)
- **Root cause:** Introduced in commit `b3fbbe9` (feat: remove ROI adjustment fields) — variable was kept after the ROI adjustment field removal
- **Impact:** Build fails ESLint step — blocks `npm run build` completion
- **Fix:** Remove or use the `hourlyRate` variable in portal page

### 2. Missing aria attributes on OwnerModal combobox
- **File:** `frontend/src/app/(app)/board/_components/OwnerModal.tsx:77`
- **Issue:** Warning — combobox role missing `aria-controls` and `aria-expanded` attributes
- **Impact:** Accessibility warning (non-blocking for functionality, but fails ESLint warning-as-error)
- **Fix:** Add `aria-controls` and `aria-expanded` to the combobox element

Both issues pre-date plan 05-03 execution (confirmed via git stash test).
