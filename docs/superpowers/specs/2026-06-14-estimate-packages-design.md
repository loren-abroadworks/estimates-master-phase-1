# Estimate Packages (Client-Selectable Options) — Design

**Date:** 2026-06-14
**Status:** Approved design, ready for planning

## Summary

Let an estimator build **multiple packages** within a single estimate that the client can
compare and choose from (e.g. "Standard / Premium / Deluxe"). Packages are mainly used to
offer upgraded materials (premium paint/materials) or extra scope, but each package is a
**fully independent** scope — different areas, labor, materials, line items, and totals are
all allowed. To avoid rebuilding everything per package, the estimator can create a new
package by **duplicating** an existing one as a pre-filled starting point.

The client sees the packages **side-by-side**, picks **one**, and signs. The chosen package
becomes the approved scope that converts into the work order and invoice.

## Scope decisions (confirmed)

- **Independence:** fully independent packages (option 3), with a "duplicate existing
  package" creation path so the estimator can start from filled-in content.
- **Client flow:** compare side-by-side → select one → sign. The selected package converts
  to work order/invoice; unselected packages remain on the estimate record, de-emphasized.
- **Labels:** estimator-defined custom names per package, plus an optional **"Recommended"**
  flag (at most one per estimate) that highlights one package in the client comparison.
- **Always ≥ 1 package:** a normal single-option estimate is simply one package. Existing
  estimates migrate to a single package.

## Approach

**Approach A — Packages array with an "active package" projection.** Extract per-package
scope into a `Package` type; `Estimate` holds `packages: Package[]` plus `activePackageId`
(estimator editing) and `selectedPackageId` (client choice). A single accessor module is
the one way scope is read. (Rejected: **B** keep base fields as "package 1" + additive array
— dual representation invites bugs; **C** override-deltas on a base — contradicts the
fully-independent requirement.)

## Data model

`types.ts`:

```ts
interface EstimateFinancials {
  selectedAccessTierId: string;
  selectedHeightTierId: string;
  taxId: string;
  baseGrandTotal: number;
  baseTaxAmount: number;
  baseDiscountAmount: number;
  discountId?: string;
  burdenRate?: number;
  opexRate?: number;
  baseSubtotal?: number;
  includeMiscExpense?: boolean;
}

interface Package {
  id: string;
  name: string;                 // estimator-defined, e.g. "Standard", "Premium"
  isRecommended: boolean;       // at most one true per estimate
  scopeId: string;
  pricingMethod: 'hourly' | 'labor';
  estimateAreas: EstimateArea[];
  lineItems: Record<string, MiscLineItem>;
  formLayout: string[];
  paintColors: PaintColorEntry[];
  sundries: any[];
  financials: EstimateFinancials;
  customerNotes: string;        // client-visible notes; may differ per package
  finalize: { deposit: string; terms: string };
}

interface Estimate {
  id: string;
  projectName: string;
  status: 'Draft' | 'Sent' | 'Approved' | 'Paid' | 'Archived' | 'Lost';
  customer: { /* unchanged */ };
  jobAddress: { /* unchanged */ };
  projectInfo: { /* unchanged */ };
  salesman: any;
  internalNotes: string;            // was notes.internal — shared across packages
  packages: Package[];              // always length >= 1
  activePackageId: string;          // which package the estimator is editing
  selectedPackageId: string | null; // client's chosen package; null until accepted
}
```

`EstimateFinancials` is the existing inline `financials` object lifted into a named type.
Per-package fields moved off `Estimate`: `scopeId`, `pricingMethod`, `estimateAreas`,
`lineItems`, `formLayout`, `paintColors`, `sundries`, `financials`, `finalize`, and the
customer half of `notes`.

## Accessor & mutation module (`services/packages.ts`)

The single source of truth for reading/mutating packages. Accessors never throw.

- `getActivePackage(estimate): Package` — `activePackageId` → else `packages[0]`.
- `getSelectedPackage(estimate): Package` — `selectedPackageId` → else active → `packages[0]`.
- `getPackageById(estimate, id): Package | undefined`.
- `addPackage(estimate, name, fromPackageId?): Estimate` — appends a blank package, or a
  deep copy of `fromPackageId` with **fresh IDs** for the package and all nested
  areas/rows/line-items/colors. New package becomes active.
- `duplicatePackage(estimate, id): Estimate` — convenience wrapper over `addPackage` with a
  source.
- `deletePackage(estimate, id): Estimate` — blocked when only one package remains; if the
  deleted package was active, active falls back to the first remaining.
- `setRecommended(estimate, id): Estimate` — sets `isRecommended` on `id`, clears it on all
  others.
- `updateActivePackage(estimate, updater): Estimate` — apply a scope change to the active
  package immutably (used by the form).

## Authoring UX (Estimate Form)

A **package switcher** (segmented tabs) at the top of the Estimate Form: one tab per
package showing its name and per-package total, plus an **"+ Add"** action. The existing
form below edits the **active package** via `getActivePackage` / `updateActivePackage`, so
the current estimate-building UI is reused unchanged.

- **Switch:** click a tab → sets `activePackageId`.
- **Add:** prompt for a name + choose **Start blank** or **Duplicate from [package]**.
- **Rename / Delete:** per package (delete disabled at one remaining).
- **Mark recommended:** toggle; setting one clears the others.

A single-package estimate shows one inert tab and behaves like today.

## Client flow (Client Preview + Accept)

- **> 1 package:** client sees a **comparison view** — a card per package with name, a
  **"Recommended"** badge where flagged, price, and an included-summary (areas / premium
  materials / extras), each with a **Select** action. Selecting focuses that package's full
  detail document; the client may change selection before signing.
- **Accept/sign** (`AcceptEstimateModal`): sets `selectedPackageId`, sets `status` to
  `Approved`, stamps the signature bound to the chosen package. After acceptance the
  comparison collapses to the selected package (marked "Selected"); others stay on record,
  de-emphasized.
- **1 package:** the comparison step is skipped — identical to today's single-option flow.

## Conversion to work order / invoice

`createWorkOrderFromEstimate` and `createInvoiceFromEstimate` resolve scope via
`getSelectedPackage(estimate)` (fallback active → first) and read all scope fields from that
package instead of from `estimate.*`. The client's chosen package is exactly what becomes
the job and the bill.

## Read-routing sweep

Every current `estimate.<scopeField>` read routes through the package accessor. Three
buckets:
1. **Estimate Form** — edits the **active** package.
2. **Client preview + converters** — read the **selected** package.
3. **Dashboards / lists** showing a headline total — read the selected-or-active-or-first
   package's `financials.baseGrandTotal`.

This is a wide but mechanical sweep; it can be done with subagent orchestration.

## Migration

`migrateEstimate(estimate)` runs when estimates are loaded (mock/persisted):
- If `packages` is absent (legacy shape): create `packages[0]` (name "Standard",
  `isRecommended: false`) from the existing scope fields; set `activePackageId` to it;
  `selectedPackageId: null`; move `notes.internal` → `internalNotes`, `notes.customer` →
  `packages[0].customerNotes`.
- Idempotent: an already-migrated estimate is returned unchanged.
- All `MOCK_ESTIMATES` pass through it.

## Testing

Colocated `*.test.ts(x)` under Vitest:

- **`services/packages.ts`** — accessor resolution + fallbacks; `addPackage` blank;
  `duplicatePackage` deep-copy with fresh IDs and no shared references; `deletePackage`
  blocked at one remaining and active reassignment; `setRecommended` clears others.
- **`migrateEstimate`** — legacy wrap into `packages[0]`; notes split; idempotency.
- **Converters** — read selected package; fall back to active/first with no selection.
- **Authoring UI** — switcher renders a tab + total per package; add/duplicate/rename/
  delete/recommended fire the right helpers; single-package estimate shows one inert tab.
- **Client flow** — multi-package shows comparison with Recommended badge; select + accept
  sets `selectedPackageId` + `status: 'Approved'`; single-package skips comparison.

**Error handling:** accessors never throw; missing/empty packages fall back gracefully;
last package cannot be deleted; at most one `isRecommended` per estimate.

## Out of scope (this iteration)

- Per-package override/delta authoring (packages are independent full scopes).
- More than one recommended package.
- Client editing of package contents.
- Analytics on which packages clients pick.
