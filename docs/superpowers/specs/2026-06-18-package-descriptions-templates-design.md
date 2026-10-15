# Package Descriptions + Description Templates

**Date:** 2026-06-18
**Status:** Approved for planning

## Problem

Each estimate package (the tabs in the "Packages" card — e.g. *Standard*, *Better*,
*Best*) has a name, a recommended flag, line items, and financials, but no way to
describe *what the package includes*. Estimators want to attach a short customer-facing
description to each package, and they want to reuse common descriptions instead of
retyping them on every estimate.

## Goal

1. Add a single, customer-facing **description** to each package.
2. Add a **template** system so saved descriptions can be reused across estimates,
   following the existing `LineItemTemplate` / `TermsTemplate` pattern.

## Non-goals

- No internal/team-only description field (one field only, customer-facing).
- No full-package templates (line items, financials). Only the description text is
  templated.
- No backend persistence work beyond what already exists; templates live in App-level
  state seeded from constants, like the other template types.

## Current state (reference)

- `Package` interface: `types.ts:660-674`. Has `name`, `customerNotes`, etc.; no
  `description`.
- Package editor: `components/views/EstimateForm/PackageModal.tsx` — Add/Rename dialog,
  currently a name field plus an optional "Start from" source selector.
- Package tabs UI: `components/views/EstimateForm/PackageSwitcher.tsx`.
- Package mutations: `services/packages.ts` (`blankPackage`, `clonePackage`,
  `addPackage`, `migrateEstimate`).
- Modal wiring: `components/views/EstimateFormView.tsx` (`submitPackageModal`,
  `openAddPackage`, `openRenamePackage`).
- Existing template pattern to mirror: `LineItemTemplate` (`types.ts:55-62`),
  `INITIAL_LINE_ITEM_TEMPLATES` (`constants.ts:80`), App state
  (`App.tsx:101` `lineItemTemplates`/`setLineItemTemplates`), Settings CRUD
  (`components/settings/SettingsPage.tsx`).
- Proposal output: `services/estimatePreview.ts` → `buildPackagePreviewData` feeds the
  client-facing preview.

## Design

### 1. Data model (`types.ts`)

Add one field to `Package`:

```ts
export interface Package {
  // ...existing fields...
  description: string;   // customer-facing blurb, printed on the proposal
}
```

New template type:

```ts
export interface PackageDescriptionTemplate {
  id: string;
  name: string;          // e.g. "Premium Interior"
  description: string;
}
```

### 2. Seed + state

- Add `INITIAL_PACKAGE_DESCRIPTION_TEMPLATES: PackageDescriptionTemplate[]` to
  `constants.ts` with a few starter snippets (e.g. "Premium Interior", "Standard
  Interior", "Exterior Repaint").
- Add App-level state in `App.tsx`, mirroring `lineItemTemplates`:
  ```ts
  const [packageDescriptionTemplates, setPackageDescriptionTemplates] =
    useState<PackageDescriptionTemplate[]>(INITIAL_PACKAGE_DESCRIPTION_TEMPLATES);
  ```
- Thread these props down to `EstimateFormView` (for the modal picker / save) and to
  the Settings page (for CRUD), following how `lineItemTemplates` is already passed.

### 3. Backfill defaults (`services/packages.ts`)

- `blankPackage`: set `description: ''`.
- `clonePackage`: `JSON.parse(JSON.stringify(src))` already carries `description`
  forward; no extra work, but confirm with a test.
- `migrateEstimate`: backfill `description: raw.description ?? ''` on both the
  already-migrated branch (spread is fine but ensure the field exists) and the
  legacy-wrap branch.

### 4. Editor — Add/Rename dialog (`PackageModal.tsx`)

Extend the modal (used in both `add` and `rename` modes):

- Add a **Description** `TextArea` below the name field.
- **Use template ▾**: a `Select` (or small dropdown) listing
  `packageDescriptionTemplates` by name; choosing one sets the description textarea to
  that template's `description`.
- **Save as template**: a button that takes the current description text, prompts for a
  template name (reuse the existing in-modal input/validation style — no
  `window.prompt`), and appends a new `PackageDescriptionTemplate` via
  `setPackageDescriptionTemplates`.
- In `add` mode with a "Start from" source selected, pre-fill the description textarea
  from the source package's `description`.

Props/signature changes:

- `PackageModalProps`: add `initialDescription?: string`, the template list, and a
  callback to save a new template (or pass `setPackageDescriptionTemplates`).
- `onSubmit` changes from `(name, sourceId?)` to `(name, description, sourceId?)`.

### 5. Modal wiring (`EstimateFormView.tsx`)

- `submitPackageModal(name, description, sourceId?)`:
  - **rename mode**: update the active package with `{ ...p, name, description }`.
  - **add mode**: create via `addPkg`, then set `description` on the new package
    (either pass it through `addPackage` or set it immediately after). When cloning
    from a source, the description pre-fills in the modal and the submitted value wins.
- Pass `initialDescription` to the modal: `''` for add, the active package's
  `description` for rename.
- Pass `packageDescriptionTemplates` and the save handler into the modal.

`addPackage` in `services/packages.ts` gains an optional `description` parameter so a
new package can be created with its description in one step:
`addPackage(estimate, name, fromPackageId?, description?)`.

### 6. Template library in Settings

Add a CRUD section beside Line Item Templates / Terms Templates in the Settings page
(`components/settings/SettingsPage.tsx` and its layout), letting the user add, edit, and
delete `PackageDescriptionTemplate` entries (fields: name, description). Reuse the
existing template-manager UI patterns in that page.

### 7. Proposal output

- `services/estimatePreview.ts` `buildPackagePreviewData`: add
  `description: pkg.description || ''` to the returned object.
- The client-facing preview component renders the package `description` near the package
  heading. (Locate the preview render in the component consuming
  `buildPackagePreviewData` and place the description prominently above the
  scope/line-item breakdown.)

## Data flow

```
Settings CRUD ─┐
               ├─► packageDescriptionTemplates (App state, seeded from constants)
"Save as       │
 template" ────┘            │
                            ▼
PackageModal: pick template ──► fills Description textarea
        │
        ▼ onSubmit(name, description, sourceId?)
submitPackageModal ──► Package.description (per-package state)
        │
        ▼ buildPackagePreviewData
Client proposal renders package description
```

## Edge cases

- Empty description: allowed. Renders nothing on the proposal; no template required.
- "Save as template" with empty description or blank name: block with inline validation
  (no template created).
- Duplicate template names: allowed (matches current line-item template behavior); no
  uniqueness enforcement.
- Templates are not linked to packages after insertion — picking a template copies its
  text; later edits to the template do not change packages that used it.
- Migration idempotency: re-running `migrateEstimate` on an estimate that already has
  `description` leaves it unchanged.

## Testing

- `services/packages.ts`:
  - `blankPackage` sets `description: ''`.
  - `clonePackage` carries `description` forward.
  - `migrateEstimate` backfills `description` to `''` for legacy estimates and is
    idempotent.
  - `addPackage` with a `description` argument sets it on the new package.
- `PackageModal` component test:
  - Selecting a template fills the Description textarea.
  - "Save as template" with a name adds an entry to the template list.
  - Submitting passes `(name, description, sourceId?)` to `onSubmit`.
  - Add-from-source pre-fills the description from the source package.
- `estimatePreview` test: `buildPackagePreviewData` includes `description`.

## Files touched

- `types.ts` — `Package.description`, `PackageDescriptionTemplate`.
- `constants.ts` — `INITIAL_PACKAGE_DESCRIPTION_TEMPLATES`.
- `App.tsx` — template state + prop threading.
- `services/packages.ts` — `blankPackage`, `clonePackage`, `migrateEstimate`,
  `addPackage`.
- `components/views/EstimateForm/PackageModal.tsx` — description field + template
  picker + save.
- `components/views/EstimateFormView.tsx` — `submitPackageModal` + modal props.
- `components/settings/SettingsPage.tsx` (+ settings layout) — template CRUD.
- `services/estimatePreview.ts` + client preview component — render description.
- i18n catalog — new strings (description label/placeholder, "Use template", "Save as
  template", Settings section labels).
- Tests alongside the above.
