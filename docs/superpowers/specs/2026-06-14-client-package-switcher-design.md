# Client Package Switcher in the Estimate Preview

**Date:** 2026-06-14
**Status:** Approved (pending spec review)

## Problem

In the client-facing estimate preview, multiple packages render as a "Choose your
package" band of cards pinned above everything else. It looks bad, and "Select"
only highlights a card and sets which package gets accepted — it does **not**
change the estimate the client is reading. The client cannot actually compare the
scope/line items that differ between packages, which is the whole point.

## Goal

Let the client switch packages inline and see the **entire** estimate document
(scope of work, line items, paint schedule, totals) re-render for the chosen
package. The package the client is viewing is their current selection. The Accept
flow confirms (and can change) that selection.

## Non-goals

- Live per-package total recomputation. Each package's totals come from its
  last-saved `financials` (the package being edited has live totals; others show
  the totals from the last time they were opened in the editor). This matches how
  the existing comparison cards already source non-active totals. Lifting the
  full labor/paint calc pipeline to run per package is out of scope.
- Any change to the editor-side `PackageSwitcher` (toolbar add/duplicate/rename).

## Current state

- `EstimateFormView` renders `ClientEstimatePreview` with a single flattened
  `data` = the active package's live scalar state (`buildPreviewData()`), plus a
  separate `comparisonPackages` summary array `{id, name, isRecommended, total,
  summary[]}` and `selectedPackageId` / `onSelectPackage`.
- `ClientEstimatePreview` destructures everything it renders from `data`. The top
  band (`ClientEstimatePreview.tsx:357-371`) renders `<PackageComparison>` cards.
  Switching selection there does not affect the rendered `data`.
- The estimate sheet starts at the `#estimate` container; the title block is
  "Estimate / Detailed Proposal & Scope of Work" followed by company/customer
  info, then Scope of Work.
- `AcceptEstimateModal` takes `total`, `terms`, `onAccept`, `onEdit`. Accept calls
  `onAcceptEstimate()` → `prepareEstimateData()`, which already carries
  `selectedPackageId`.

## Design

### 1. Per-package preview data (`EstimateFormView`)

Add a helper `packageToPreviewData(pkg: Package)` that produces the same shape as
`buildPreviewData()` but sourced from a package's fields merged with the
estimate-level constants (customer, jobAddress, salesman, projectInfo, settings,
materials, rates, projectName):

```
{ ...estimate-level constants,
  estimateAreas: pkg.estimateAreas, areas: pkg.estimateAreas,
  lineItems: pkg.lineItems, formLayout: pkg.formLayout, layout: pkg.formLayout,
  paintColors: pkg.paintColors, sundries: pkg.sundries,
  financials: pkg.financials, pricingMethod: pkg.pricingMethod,
  finalize: pkg.finalize, notes: { customer: pkg.customerNotes, internal: '' },
  scopeId: pkg.scopeId, tierSelections: { heightId, accessId } }
```

Build `previewPackages` from the **folded** packages (so the active package
reflects live edits) — reuse the same fold used by `prepareEstimateData`:

```
previewPackages = foldedPackages.map(p => ({
  id: p.id, name: p.name, isRecommended: p.isRecommended,
  total: p.financials?.baseGrandTotal || 0,
  data: packageToPreviewData(p),
}))
```

Pass `previewPackages` (only when `packagesEnabled && packages.length > 1`),
`selectedPackageId`, and `onSelectPackage={setSelectedPackageId}` to the preview.
Keep passing `data={buildPreviewData()}` as the single-package / legacy fallback.
`buildPreviewData()` can be expressed via `packageToPreviewData(activeFolded)` to
avoid duplication. Remove the `comparisonPackages` band wiring.

### 2. ClientEstimatePreview

- New optional prop `previewPackages?: { id, name, isRecommended, total, data }[]`.
- Internal state `viewedPackageId`, initialized to `selectedPackageId ?? recommended ?? previewPackages[0].id`.
- The render source becomes:
  `const view = previewPackages?.find(p => p.id === viewedPackageId)?.data ?? data;`
  Destructure all rendered fields from `view` instead of `data`.
- Replace the top band with an inline **`ClientPackagePicker`** placed directly
  under the title block inside the `#estimate` sheet. Shown only when
  `previewPackages && previewPackages.length > 1`.
- Selecting a pill: `setViewedPackageId(id)` **and** `onSelectPackage?.(id)` — the
  viewed package is the selection.
- Reset `selectedOptionalIds` when the viewed package changes (optional-item ids
  differ per package).

### 3. ClientPackagePicker (new component)

`components/views/ClientPackagePicker.tsx` — a compact, read-only, client-facing
switcher (distinct from the editor `PackageSwitcher`).

Props: `{ packages: {id, name, total, isRecommended}[], selectedId, onSelect }`.

Renders a horizontal, wrapping row of pill buttons: package name + formatted
total, recommended one flagged with a small star, the selected one filled/ring.
`aria-pressed` on each for accessibility.

### 4. AcceptEstimateModal

Add optional props `packages?: {id, name, total}[]`, `selectedPackageId?`,
`onSelectPackage?: (id) => void`. When `packages` has more than one entry, render
a package chooser (radio list of name + total) above the price banner; selecting
updates the displayed `total` and calls `onSelectPackage`. Defaults to the
currently-viewed/selected package. When 0–1 packages, the modal is unchanged.

In `ClientEstimatePreview`, pass the picker data through and ensure the chosen
package is set (`onSelectPackage`) before `onAcceptEstimate()` runs, so
`prepareEstimateData()` records the right `selectedPackageId`.

## Components & boundaries

- `ClientPackagePicker` — pure presentational switcher; in: packages+selectedId,
  out: onSelect. Testable in isolation.
- `packageToPreviewData` — pure mapping `Package + constants → preview data`.
- `ClientEstimatePreview` — owns `viewedPackageId`, derives render data, wires the
  picker and accept chooser.
- `AcceptEstimateModal` — gains an optional, self-contained package chooser.

## Testing

- `ClientPackagePicker`: renders a pill per package with name + total; highlights
  selected; recommended badge; `onSelect` fires with the right id.
- `packageToPreviewData`: maps package fields into the preview shape (areas,
  lineItems, layout, paintColors, financials, tierSelections, notes.customer).
- `ClientEstimatePreview`: with `previewPackages`, switching the picker changes the
  rendered scope (e.g. a package-B-only area appears) and fires `onSelectPackage`;
  optional selections reset on switch; with one/zero packages, no picker renders
  and behavior is unchanged.
- `AcceptEstimateModal`: with multiple packages, choosing one updates the shown
  total and calls `onSelectPackage`; with one package, chooser is absent.

## Risks / notes

- Non-active package totals are last-saved values (documented non-goal). The
  contractor naturally populates them by opening each package in the editor.
- `previewPackages[i].data` for the active package must come from the folded
  (live) state so the client sees current edits.
