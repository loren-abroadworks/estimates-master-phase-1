# Estimate Packages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an estimator build multiple fully-independent packages within one estimate that the client compares and chooses from; the selected package converts to the work order and invoice.

**Architecture:** Extract per-package scope into a `Package` type. `Estimate` holds `packages: Package[]`, `activePackageId` (estimator editing), `selectedPackageId` (client choice). A single accessor/mutation module (`services/packages.ts`) is the one way packages are read and changed. The Estimate Form holds the active package's scope in its existing local state and syncs it in/out when switching packages; converters and client preview read the selected package; a one-time `migrateEstimate` wraps legacy estimates into one package.

**Tech Stack:** React 19, TypeScript, Vite, Vitest + @testing-library/react. Path alias `@` → project root. Colocated `*.test.ts(x)`.

**Spec:** `docs/superpowers/specs/2026-06-14-estimate-packages-design.md`

**Sequencing:** Implement this AFTER the in-progress i18n translation sweep has landed and is committed, to avoid two large edits colliding in the Estimate Form and client preview.

## File structure

- `types.ts` — add `EstimateFinancials`, `Package`; move per-package fields off `Estimate`; add `packages`/`activePackageId`/`selectedPackageId`/`internalNotes`. (Task 1)
- `services/packages.ts` (new) — accessors, mutations, `migrateEstimate`. (Tasks 2–3)
- `services/packages.test.ts` (new) — unit tests. (Tasks 2–3)
- `services/workOrderMapper.ts`, `services/invoiceService.ts` — read the selected package. (Task 4)
- `App.tsx` — migrate `MOCK_ESTIMATES` on load; set `selectedPackageId` on accept. (Task 5)
- `components/views/EstimateForm/PackageSwitcher.tsx` (new) — switcher UI. (Task 6)
- `components/views/EstimateFormView.tsx` — packages state + switcher wiring + switch/save sync. (Task 7)
- `components/views/PackageComparison.tsx` (new) + `components/views/ClientEstimatePreview.tsx` — client comparison + selection. (Task 8)
- Remaining `estimate.<scopeField>` reader sites (dashboards/lists). (Task 9)

---

### Task 1: Types — `EstimateFinancials`, `Package`, slimmed `Estimate`

**Files:**
- Modify: `types.ts`
- Test: `services/packages.test.ts` (created here, expanded later)

- [ ] **Step 1: Write the failing test**

Create `services/packages.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Estimate, Package, EstimateFinancials } from '../types';

// Compile-time shape check: building a valid Package + Estimate must type-check.
const fin: EstimateFinancials = {
  selectedAccessTierId: '', selectedHeightTierId: '', taxId: 'tax-0',
  baseGrandTotal: 0, baseTaxAmount: 0, baseDiscountAmount: 0,
};

const pkg: Package = {
  id: 'pkg-1', name: 'Standard', isRecommended: false, scopeId: 'scope-int',
  pricingMethod: 'hourly', estimateAreas: [], lineItems: {}, formLayout: [],
  paintColors: [], sundries: [], financials: fin, customerNotes: '',
  finalize: { deposit: '', terms: '' },
};

describe('package types', () => {
  it('an Estimate carries packages, activePackageId, selectedPackageId, internalNotes', () => {
    const est = {
      id: 'e1', projectName: 'P', status: 'Draft',
      customer: {} as any, jobAddress: {} as any, projectInfo: {} as any, salesman: null,
      internalNotes: '', packages: [pkg], activePackageId: 'pkg-1', selectedPackageId: null,
    } as Estimate;
    expect(est.packages).toHaveLength(1);
    expect(est.activePackageId).toBe('pkg-1');
    expect(est.selectedPackageId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- services/packages.test.ts`
Expected: FAIL — `Package`/`EstimateFinancials` not exported; `Estimate` lacks `packages`.

- [ ] **Step 3: Add `EstimateFinancials` and `Package`, update `Estimate`**

In `types.ts`, add (near the other estimate interfaces):

```ts
export interface EstimateFinancials {
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

export interface Package {
  id: string;
  name: string;
  isRecommended: boolean;
  scopeId: string;
  pricingMethod: 'hourly' | 'labor';
  estimateAreas: EstimateArea[];
  lineItems: Record<string, MiscLineItem>;
  formLayout: string[];
  paintColors: PaintColorEntry[];
  sundries: any[];
  financials: EstimateFinancials;
  customerNotes: string;
  finalize: { deposit: string; terms: string };
}
```

Replace the existing `Estimate` interface body's per-package fields. The new `Estimate` is:

```ts
export interface Estimate {
  id: string;
  projectName: string;
  status: 'Draft' | 'Sent' | 'Approved' | 'Paid' | 'Archived' | 'Lost';
  customer: {
    id: string; firstName: string; lastName: string; email: string; phone: string;
    billingAddress: string; city: string; state: string; zip: string;
  };
  jobAddress: { address: string; city: string; state: string; zip: string; accessCode: string };
  projectInfo: { name: string; number: string; date: string; validUntil: string };
  salesman: any;
  internalNotes: string;
  packages: Package[];
  activePackageId: string;
  selectedPackageId: string | null;
}
```

(Removed from `Estimate`: `scopeId`, `estimateAreas`, `lineItems`, `formLayout`, `paintColors`, `sundries`, `notes`, `financials`, `pricingMethod`, `finalize`. They now live on `Package`, except `notes.internal` which becomes `internalNotes`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- services/packages.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (lint will still fail elsewhere until later tasks — do not run full lint yet)

```bash
git add types.ts services/packages.test.ts
git commit -m "feat(estimates): add Package and EstimateFinancials types"
```

---

### Task 2: `services/packages.ts` — accessors

**Files:**
- Create: `services/packages.ts`
- Test: `services/packages.test.ts` (extend)

- [ ] **Step 1: Write the failing test** (append to `services/packages.test.ts`)

```ts
import { getActivePackage, getSelectedPackage, getPackageById } from './packages';

const mkPkg = (over: Partial<Package> = {}): Package => ({
  id: 'pkg-1', name: 'Standard', isRecommended: false, scopeId: 'scope-int',
  pricingMethod: 'hourly', estimateAreas: [], lineItems: {}, formLayout: [],
  paintColors: [], sundries: [], financials: { ...fin }, customerNotes: '',
  finalize: { deposit: '', terms: '' }, ...over,
});

const mkEst = (over: Partial<Estimate> = {}): Estimate => ({
  id: 'e1', projectName: 'P', status: 'Draft',
  customer: {} as any, jobAddress: {} as any, projectInfo: {} as any, salesman: null,
  internalNotes: '', packages: [mkPkg()], activePackageId: 'pkg-1', selectedPackageId: null,
  ...over,
});

describe('package accessors', () => {
  it('getActivePackage returns the active package, else first', () => {
    const est = mkEst({ packages: [mkPkg({ id: 'a' }), mkPkg({ id: 'b' })], activePackageId: 'b' });
    expect(getActivePackage(est).id).toBe('b');
    expect(getActivePackage({ ...est, activePackageId: 'missing' }).id).toBe('a');
  });

  it('getSelectedPackage returns selected, else active, else first', () => {
    const est = mkEst({ packages: [mkPkg({ id: 'a' }), mkPkg({ id: 'b' })], activePackageId: 'b', selectedPackageId: 'a' });
    expect(getSelectedPackage(est).id).toBe('a');
    expect(getSelectedPackage({ ...est, selectedPackageId: null }).id).toBe('b');
  });

  it('getPackageById finds or returns undefined', () => {
    const est = mkEst();
    expect(getPackageById(est, 'pkg-1')?.id).toBe('pkg-1');
    expect(getPackageById(est, 'nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- services/packages.test.ts`
Expected: FAIL — `Cannot find module './packages'`.

- [ ] **Step 3: Create `services/packages.ts` with accessors**

```ts
import type { Estimate, Package } from '../types';

/** The package the estimator is currently editing. Falls back to the first package. */
export function getActivePackage(estimate: Estimate): Package {
  return getPackageById(estimate, estimate.activePackageId) ?? estimate.packages[0];
}

/** The client's chosen package. Falls back to active, then first. */
export function getSelectedPackage(estimate: Estimate): Package {
  return (
    (estimate.selectedPackageId ? getPackageById(estimate, estimate.selectedPackageId) : undefined) ??
    getActivePackage(estimate)
  );
}

export function getPackageById(estimate: Estimate, id: string): Package | undefined {
  return estimate.packages.find((p) => p.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- services/packages.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/packages.ts services/packages.test.ts
git commit -m "feat(estimates): add package accessor helpers"
```

---

### Task 3: `services/packages.ts` — mutations + `migrateEstimate`

**Files:**
- Modify: `services/packages.ts`
- Test: `services/packages.test.ts` (extend)

- [ ] **Step 1: Write the failing test** (append)

```ts
import { addPackage, duplicatePackage, deletePackage, setRecommended, migrateEstimate } from './packages';

describe('package mutations', () => {
  it('addPackage appends a blank package and makes it active', () => {
    const est = mkEst();
    const next = addPackage(est, 'Premium');
    expect(next.packages).toHaveLength(2);
    const added = next.packages[1];
    expect(added.name).toBe('Premium');
    expect(added.estimateAreas).toEqual([]);
    expect(next.activePackageId).toBe(added.id);
    expect(est.packages).toHaveLength(1); // immutable: original untouched
  });

  it('duplicatePackage deep-copies with fresh ids and no shared references', () => {
    const est = mkEst({ packages: [mkPkg({ id: 'a', estimateAreas: [{ id: 'area-1' } as any] })], activePackageId: 'a' });
    const next = duplicatePackage(est, 'a');
    const copy = next.packages[1];
    expect(copy.id).not.toBe('a');
    expect(copy.estimateAreas[0].id).not.toBe('area-1');
    expect(copy.estimateAreas).not.toBe(est.packages[0].estimateAreas); // new array
  });

  it('deletePackage is blocked when only one remains', () => {
    const est = mkEst();
    expect(deletePackage(est, 'pkg-1').packages).toHaveLength(1);
  });

  it('deletePackage reassigns active when the active is deleted', () => {
    const est = mkEst({ packages: [mkPkg({ id: 'a' }), mkPkg({ id: 'b' })], activePackageId: 'b' });
    const next = deletePackage(est, 'b');
    expect(next.packages.map((p) => p.id)).toEqual(['a']);
    expect(next.activePackageId).toBe('a');
  });

  it('setRecommended sets one and clears the others', () => {
    const est = mkEst({ packages: [mkPkg({ id: 'a', isRecommended: true }), mkPkg({ id: 'b' })] });
    const next = setRecommended(est, 'b');
    expect(next.packages.find((p) => p.id === 'a')!.isRecommended).toBe(false);
    expect(next.packages.find((p) => p.id === 'b')!.isRecommended).toBe(true);
  });
});

describe('migrateEstimate', () => {
  it('wraps a legacy estimate (no packages) into packages[0]', () => {
    const legacy: any = {
      id: 'old', projectName: 'Old', status: 'Draft',
      customer: {}, jobAddress: {}, projectInfo: {}, salesman: null,
      scopeId: 'scope-int', pricingMethod: 'labor',
      estimateAreas: [{ id: 'area-1' }], lineItems: { x: { id: 'x' } }, formLayout: ['a'],
      paintColors: [{ id: 'c' }], sundries: [],
      financials: { ...fin, baseGrandTotal: 500 },
      notes: { customer: 'hi client', internal: 'note to self' },
      finalize: { deposit: '25%', terms: 'T' },
    };
    const est = migrateEstimate(legacy);
    expect(est.packages).toHaveLength(1);
    expect(est.packages[0].estimateAreas).toEqual([{ id: 'area-1' }]);
    expect(est.packages[0].financials.baseGrandTotal).toBe(500);
    expect(est.packages[0].customerNotes).toBe('hi client');
    expect(est.internalNotes).toBe('note to self');
    expect(est.activePackageId).toBe(est.packages[0].id);
    expect(est.selectedPackageId).toBeNull();
    expect((est as any).estimateAreas).toBeUndefined();
  });

  it('is idempotent for already-migrated estimates', () => {
    const est = mkEst();
    expect(migrateEstimate(est)).toEqual(est);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- services/packages.test.ts`
Expected: FAIL — mutation/migration functions not exported.

- [ ] **Step 3: Add mutations + migration to `services/packages.ts`**

```ts
let pkgCounter = 0;
function newId(prefix: string): string {
  pkgCounter += 1;
  return `${prefix}-${Date.now()}-${pkgCounter}`;
}

function blankFinancials(): import('../types').EstimateFinancials {
  return { selectedAccessTierId: '', selectedHeightTierId: '', taxId: '', baseGrandTotal: 0, baseTaxAmount: 0, baseDiscountAmount: 0 };
}

function blankPackage(name: string): Package {
  return {
    id: newId('pkg'), name, isRecommended: false, scopeId: '', pricingMethod: 'hourly',
    estimateAreas: [], lineItems: {}, formLayout: [], paintColors: [], sundries: [],
    financials: blankFinancials(), customerNotes: '', finalize: { deposit: '', terms: '' },
  };
}

/** Deep clone with fresh ids on the package and every nested entity that has an id. */
function clonePackage(src: Package, name: string): Package {
  const clone: Package = JSON.parse(JSON.stringify(src));
  clone.id = newId('pkg');
  clone.name = name;
  clone.isRecommended = false;
  clone.estimateAreas = clone.estimateAreas.map((area) => ({
    ...area,
    id: newId('area'),
    rows: (area.rows || []).map((row) => ({ ...row, id: newId('row') })),
  }));
  const relinkedLineItems: Record<string, import('../types').MiscLineItem> = {};
  Object.values(clone.lineItems).forEach((item) => {
    const id = newId('li');
    relinkedLineItems[id] = { ...item, id };
  });
  clone.lineItems = relinkedLineItems;
  clone.paintColors = clone.paintColors.map((c) => ({ ...c, id: newId('color') }));
  return clone;
}

export function addPackage(estimate: Estimate, name: string, fromPackageId?: string): Estimate {
  const source = fromPackageId ? getPackageById(estimate, fromPackageId) : undefined;
  const pkg = source ? clonePackage(source, name) : blankPackage(name);
  return { ...estimate, packages: [...estimate.packages, pkg], activePackageId: pkg.id };
}

export function duplicatePackage(estimate: Estimate, id: string): Estimate {
  const source = getPackageById(estimate, id);
  if (!source) return estimate;
  return addPackage(estimate, `${source.name} (Copy)`, id);
}

export function deletePackage(estimate: Estimate, id: string): Estimate {
  if (estimate.packages.length <= 1) return estimate;
  const packages = estimate.packages.filter((p) => p.id !== id);
  const activePackageId = estimate.activePackageId === id ? packages[0].id : estimate.activePackageId;
  const selectedPackageId = estimate.selectedPackageId === id ? null : estimate.selectedPackageId;
  return { ...estimate, packages, activePackageId, selectedPackageId };
}

export function setRecommended(estimate: Estimate, id: string): Estimate {
  return { ...estimate, packages: estimate.packages.map((p) => ({ ...p, isRecommended: p.id === id })) };
}

/** Wrap a legacy estimate (scope fields on the estimate) into a single package. Idempotent. */
export function migrateEstimate(raw: any): Estimate {
  if (raw && Array.isArray(raw.packages) && raw.activePackageId) return raw as Estimate;
  const pkg: Package = {
    id: newId('pkg'),
    name: 'Standard',
    isRecommended: false,
    scopeId: raw.scopeId ?? '',
    pricingMethod: raw.pricingMethod ?? 'hourly',
    estimateAreas: raw.estimateAreas ?? [],
    lineItems: raw.lineItems ?? {},
    formLayout: raw.formLayout ?? [],
    paintColors: raw.paintColors ?? [],
    sundries: raw.sundries ?? [],
    financials: raw.financials ?? blankFinancials(),
    customerNotes: raw.notes?.customer ?? '',
    finalize: raw.finalize ?? { deposit: '', terms: '' },
  };
  return {
    id: raw.id, projectName: raw.projectName, status: raw.status,
    customer: raw.customer, jobAddress: raw.jobAddress, projectInfo: raw.projectInfo, salesman: raw.salesman,
    internalNotes: raw.notes?.internal ?? '',
    packages: [pkg], activePackageId: pkg.id, selectedPackageId: null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- services/packages.test.ts`
Expected: PASS (all package tests).

- [ ] **Step 5: Commit**

```bash
git add services/packages.ts services/packages.test.ts
git commit -m "feat(estimates): add package mutations and migrateEstimate"
```

---

### Task 4: Converters read the selected package

**Files:**
- Modify: `services/invoiceService.ts` (reads at lines ~16–184)
- Modify: `services/workOrderMapper.ts`
- Test: `services/invoicePackages.test.ts` (Create)

- [ ] **Step 1: Write the failing test**

Create `services/invoicePackages.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInvoiceFromEstimate } from './invoiceService';
import { DEFAULT_SETTINGS } from '../constants';
import type { Estimate, Package } from '../types';

const fin = { selectedAccessTierId: '', selectedHeightTierId: '', taxId: 'tax-0', baseGrandTotal: 0, baseTaxAmount: 0, baseDiscountAmount: 0 };
const mkPkg = (over: Partial<Package>): Package => ({
  id: 'p', name: 'P', isRecommended: false, scopeId: 'scope-int', pricingMethod: 'hourly',
  estimateAreas: [], lineItems: {}, formLayout: [], paintColors: [], sundries: [],
  financials: { ...fin }, customerNotes: '', finalize: { deposit: '', terms: '' }, ...over,
});
const est: Estimate = {
  id: 'e1', projectName: 'P', status: 'Approved',
  customer: { id: 'c', firstName: 'A', lastName: 'B', email: '', phone: '', billingAddress: '', city: '', state: '', zip: '' },
  jobAddress: { address: '', city: '', state: '', zip: '', accessCode: '' },
  projectInfo: { name: 'P', number: 'EST-1', date: '', validUntil: '' },
  salesman: null, internalNotes: '',
  packages: [
    mkPkg({ id: 'standard', financials: { ...fin, baseGrandTotal: 100, baseSubtotal: 100 } }),
    mkPkg({ id: 'premium', financials: { ...fin, baseGrandTotal: 900, baseSubtotal: 900 } }),
  ],
  activePackageId: 'standard', selectedPackageId: 'premium',
};

describe('createInvoiceFromEstimate with packages', () => {
  it('uses the selected package totals, not the active one', () => {
    const invoice = createInvoiceFromEstimate(est, DEFAULT_SETTINGS);
    expect(invoice.subtotal).toBe(900);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- services/invoicePackages.test.ts`
Expected: FAIL — converter still reads `estimate.financials` (now undefined → 0).

- [ ] **Step 3: Route the converters through `getSelectedPackage`**

In `services/invoiceService.ts`, add the import at the top:

```ts
import { getSelectedPackage } from './packages';
```

At the start of `createInvoiceFromEstimate` (before the first read at line ~16), add:

```ts
  const pkg = getSelectedPackage(estimate);
```

Then replace every `estimate.estimateAreas` → `pkg.estimateAreas`, `estimate.lineItems` → `pkg.lineItems`, `estimate.paintColors` → `pkg.paintColors`, `estimate.sundries` → `pkg.sundries`, `estimate.financials` → `pkg.financials`, `estimate.pricingMethod` → `pkg.pricingMethod`, `estimate.finalize` → `pkg.finalize` inside this function. (Customer/projectInfo/jobAddress reads stay on `estimate`.)

Apply the identical change in `services/workOrderMapper.ts`: import `getSelectedPackage`, resolve `const pkg = getSelectedPackage(estimate);` at the top of `createWorkOrderFromEstimate`, and repoint all scope reads from `estimate.*` to `pkg.*`. (Run `grep -nE "estimate\.(estimateAreas|lineItems|financials|paintColors|sundries|pricingMethod|finalize|scopeId)" services/workOrderMapper.ts` to find each site.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- services/invoicePackages.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/invoiceService.ts services/workOrderMapper.ts services/invoicePackages.test.ts
git commit -m "feat(estimates): converters read the selected package scope"
```

---

### Task 5: Migrate mock estimates on load + set selection on accept

**Files:**
- Modify: `App.tsx` (estimates state init ~line 83; accept handlers ~lines 376, 409)
- Test: manual (`npm run lint` after later tasks)

- [ ] **Step 1: Migrate `MOCK_ESTIMATES` at state init**

In `App.tsx`, add the import with the other service imports:

```ts
import { migrateEstimate } from './services/packages';
```

Change the estimates state initializer (line ~83):

```ts
  const [estimates, setEstimates] = useState<Estimate[]>(MOCK_ESTIMATES.map(migrateEstimate));
```

- [ ] **Step 2: Record the selected package on accept**

The accept handlers currently set only `status: 'Approved'`. They must also persist the chosen package id, which the accept flow provides. Update the estimate-form accept handler (line ~409) to accept an optional `selectedPackageId` on the payload:

```ts
                                onAcceptEstimate={(e) => {
                                    setEstimates(prev => prev.map(est => est.id === e.id
                                      ? { ...e, status: 'Approved', selectedPackageId: e.selectedPackageId ?? est.selectedPackageId ?? est.activePackageId }
                                      : est));
                                }}
```

And the list-level approve handler (line ~376) — keep status only, but ensure a selection exists so converters resolve deterministically:

```ts
                                        setEstimates(prev => prev.map(e => e.id === id
                                          ? { ...e, status: 'Approved', selectedPackageId: e.selectedPackageId ?? e.activePackageId }
                                          : e));
```

- [ ] **Step 3: Verify the app boots and tests pass**

Run: `npm test`
Expected: existing tests pass (migration is transparent to single-package mock data).

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(estimates): migrate estimates on load and persist selected package on accept"
```

---

### Task 6: `PackageSwitcher` component

**Files:**
- Create: `components/views/EstimateForm/PackageSwitcher.tsx`
- Test: `components/views/EstimateForm/PackageSwitcher.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/views/EstimateForm/PackageSwitcher.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PackageSwitcher } from './PackageSwitcher';

const packages = [
  { id: 'a', name: 'Standard', isRecommended: false, total: 1000 },
  { id: 'b', name: 'Premium', isRecommended: true, total: 1800 },
];

const baseProps = {
  packages, activeId: 'a',
  onSwitch: vi.fn(), onAdd: vi.fn(), onDuplicate: vi.fn(),
  onRename: vi.fn(), onDelete: vi.fn(), onToggleRecommended: vi.fn(),
};

describe('PackageSwitcher', () => {
  it('renders a tab per package with name and total', () => {
    render(<PackageSwitcher {...baseProps} />);
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText(/1,800|1800/)).toBeInTheDocument();
  });

  it('marks the recommended package', () => {
    render(<PackageSwitcher {...baseProps} />);
    expect(screen.getByTestId('recommended-b')).toBeInTheDocument();
  });

  it('fires onSwitch when a non-active tab is clicked', () => {
    const onSwitch = vi.fn();
    render(<PackageSwitcher {...baseProps} onSwitch={onSwitch} />);
    fireEvent.click(screen.getByRole('button', { name: /Premium/ }));
    expect(onSwitch).toHaveBeenCalledWith('b');
  });

  it('fires onAdd when the add control is clicked', () => {
    const onAdd = vi.fn();
    render(<PackageSwitcher {...baseProps} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: /add package/i }));
    expect(onAdd).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/views/EstimateForm/PackageSwitcher.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

```tsx
import React from 'react';
import { Plus, Star } from 'lucide-react';

export interface PackageTab {
  id: string;
  name: string;
  isRecommended: boolean;
  total: number;
}

interface PackageSwitcherProps {
  packages: PackageTab[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleRecommended: (id: string) => void;
}

export const PackageSwitcher: React.FC<PackageSwitcherProps> = ({
  packages, activeId, onSwitch, onAdd, onDuplicate, onRename, onDelete, onToggleRecommended,
}) => {
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  return (
    <div className="flex items-center gap-2 flex-wrap p-2 border-b border-gray-100 dark:border-gray-700">
      {packages.map((p) => {
        const isActive = p.id === activeId;
        return (
          <button
            key={p.id}
            onClick={() => onSwitch(p.id)}
            className={`group relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              isActive
                ? 'bg-primary-600 text-white shadow'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            {p.isRecommended && (
              <Star data-testid={`recommended-${p.id}`} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            )}
            <span>{p.name}</span>
            <span className={`text-xs font-semibold ${isActive ? 'text-white/80' : 'text-gray-400'}`}>{fmt(p.total)}</span>
          </button>
        );
      })}
      <button
        onClick={onAdd}
        aria-label="Add package"
        className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
      >
        <Plus className="w-4 h-4" /> Add
      </button>
      {/* Per-package actions for the active package */}
      <div className="ml-auto flex items-center gap-2 text-xs">
        <button onClick={() => onToggleRecommended(activeId)} className="px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold text-gray-600 dark:text-gray-300">Recommend</button>
        <button onClick={() => onRename(activeId)} className="px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold text-gray-600 dark:text-gray-300">Rename</button>
        <button onClick={() => onDuplicate(activeId)} className="px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold text-gray-600 dark:text-gray-300">Duplicate</button>
        {packages.length > 1 && (
          <button onClick={() => onDelete(activeId)} className="px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold text-red-500">Delete</button>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/views/EstimateForm/PackageSwitcher.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/views/EstimateForm/PackageSwitcher.tsx components/views/EstimateForm/PackageSwitcher.test.tsx
git commit -m "feat(estimates): add PackageSwitcher component"
```

---

### Task 7: Integrate packages into the Estimate Form

**Files:**
- Modify: `components/views/EstimateFormView.tsx`

The form already holds the active package's scope in local state (`estimateAreas`, `lineItems`, `formLayout`, `paintColors`, `sundries`, `notes`, `financials`, `pricingMethod`, `finalize`, plus `templateScopeIds`). This task adds a `packages` array + `activePackageId` alongside that state and syncs the active package in/out.

- [ ] **Step 1: Add packages state and sync helpers**

Add imports:

```ts
import { PackageSwitcher } from './EstimateForm/PackageSwitcher';
import { addPackage, deletePackage, setRecommended, migrateEstimate } from '../../services/packages';
import type { Package } from '../../types';
```

Add state near the other `useState` declarations (after line ~128):

```ts
  const [packages, setPackages] = useState<Package[]>([]);
  const [activePackageId, setActivePackageId] = useState<string>('');
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
```

Add two helpers inside the component:

```ts
  // Read the current scalar form state as a package scope (preserving id/name/flags/scopeId).
  const readFormIntoPackage = (base: Package): Package => ({
    ...base,
    pricingMethod,
    estimateAreas,
    lineItems,
    formLayout,
    paintColors,
    sundries,
    financials,
    customerNotes: notes.customer,
    finalize,
  });

  // Push a package's scope into the scalar form state.
  const loadPackageIntoForm = (pkg: Package) => {
    setEstimateAreas(pkg.estimateAreas);
    setLineItems(pkg.lineItems);
    setFormLayout(pkg.formLayout);
    setPaintColors(pkg.paintColors);
    setSundries(pkg.sundries);
    setFinancials(prev => ({ ...prev, ...pkg.financials }));
    setPricingMethod(pkg.pricingMethod);
    setFinalize(pkg.finalize);
    setNotes(prev => ({ ...prev, customer: pkg.customerNotes }));
  };
```

- [ ] **Step 2: Hydrate packages when an estimate loads**

In the hydration `useEffect` that currently reads `template.estimateAreas` etc. (lines ~182–229), replace the per-field hydration with a package-based one. After computing `template` (the incoming estimate/template), add:

```ts
        const migrated = migrateEstimate(template);
        setPackages(migrated.packages);
        setActivePackageId(migrated.activePackageId);
        setSelectedPackageId(migrated.selectedPackageId);
        loadPackageIntoForm(migrated.packages.find(p => p.id === migrated.activePackageId)!);
        if (migrated.internalNotes) setNotes(prev => ({ ...prev, internal: migrated.internalNotes }));
```

Keep the existing customer/jobAddress/projectName/dates/salesman hydration as-is (those are estimate-level). Remove the now-redundant `setEstimateAreas(template.estimateAreas)`, `setLineItems`, `setPaintColors`, `setNotes(template.notes...)`, `setFinancials(...loadedFinancials)`, `setPricingMethod`, `setFinalize` lines that pulled directly from `template` — `loadPackageIntoForm` now owns them. (Leave the burden-rate calculation effect intact.)

- [ ] **Step 3: Wire the switcher and its handlers**

Add handlers inside the component:

```ts
  const foldActive = (): Package[] =>
    packages.map(p => (p.id === activePackageId ? readFormIntoPackage(p) : p));

  const switchPackage = (id: string) => {
    if (id === activePackageId) return;
    const folded = foldActive();
    setPackages(folded);
    setActivePackageId(id);
    loadPackageIntoForm(folded.find(p => p.id === id)!);
  };

  const handleAddPackage = () => {
    const name = window.prompt('Package name?', `Package ${packages.length + 1}`);
    if (!name) return;
    const dup = packages.length > 0 && window.confirm(`Duplicate "${packages.find(p => p.id === activePackageId)?.name}" as a starting point? (Cancel = start blank)`);
    const folded = { id: 'tmp', projectName, status: 'Draft', customer, jobAddress, projectInfo: {} as any, salesman, internalNotes: notes.internal, packages: foldActive(), activePackageId, selectedPackageId } as any;
    const next = addPackage(folded, name, dup ? activePackageId : undefined);
    setPackages(next.packages);
    setActivePackageId(next.activePackageId);
    loadPackageIntoForm(next.packages.find(p => p.id === next.activePackageId)!);
  };

  const handleDuplicatePackage = () => { handleAddPackage(); };

  const handleRenamePackage = (id: string) => {
    const name = window.prompt('Rename package', packages.find(p => p.id === id)?.name);
    if (!name) return;
    setPackages(prev => prev.map(p => (p.id === id ? { ...p, name } : p)));
  };

  const handleDeletePackage = (id: string) => {
    const folded = { packages: foldActive(), activePackageId, selectedPackageId } as any;
    const next = deletePackage({ ...folded } as any, id);
    setPackages(next.packages);
    setActivePackageId(next.activePackageId);
    if (next.activePackageId !== activePackageId) {
      loadPackageIntoForm(next.packages.find(p => p.id === next.activePackageId)!);
    }
  };

  const handleToggleRecommended = (id: string) => {
    const next = setRecommended({ packages: foldActive() } as any, id);
    setPackages(next.packages);
  };
```

Render the switcher above the form body (only when `mode === 'estimate'`), passing per-package totals from each package's `financials.baseGrandTotal` (the active package's live total comes from current `financials`):

```tsx
      {mode === 'estimate' && packages.length > 0 && (
        <PackageSwitcher
          packages={packages.map(p => ({
            id: p.id,
            name: p.name,
            isRecommended: p.isRecommended,
            total: p.id === activePackageId ? (financials.baseGrandTotal || 0) : (p.financials.baseGrandTotal || 0),
          }))}
          activeId={activePackageId}
          onSwitch={switchPackage}
          onAdd={handleAddPackage}
          onDuplicate={handleDuplicatePackage}
          onRename={handleRenamePackage}
          onDelete={handleDeletePackage}
          onToggleRecommended={handleToggleRecommended}
        />
      )}
```

- [ ] **Step 4: Emit packages from `prepareEstimateData`**

Replace the scope fields in the assembled object (lines ~814–822) so the estimate carries packages. Change `prepareEstimateData`'s return to fold the active package and emit the new shape:

```ts
      const foldedPackages = foldActive();
      return {
          id: template?.id || `est-${Date.now()}`,
          projectName,
          projectInfo: {
              name: projectName, number: estimateNumber,
              date: dates.estimateDate, validUntil: dates.validUntilDate,
          },
          status: template?.status || 'Draft',
          customer,
          jobAddress,
          salesman,
          internalNotes: notes.internal,
          packages: foldedPackages,
          activePackageId,
          selectedPackageId,
          // extras still consumed by downstream preview/save code:
          settings, materials, rates,
      };
```

(Remove the old top-level `estimateAreas`, `lineItems`, `formLayout`, `paintColors`, `sundries`, `notes`, `financials`, `pricingMethod`, `finalize`, `scopeId`, `scopeIds`, `description`, `layout`, `areas`, `tierSelections` from the returned estimate object. If any are still needed for the template-save path, keep them ONLY inside the `mode === 'template'` branch of `handleSave`.)

- [ ] **Step 5: Type-check and run the form/area tests**

Run: `npm run lint`
Expected: no errors (or only in files handled by later tasks — fix any in `EstimateFormView.tsx`).
Run: `npm test -- components/views/EstimateForm`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/views/EstimateFormView.tsx
git commit -m "feat(estimates): package switcher + active-package sync in the estimate form"
```

---

### Task 8: Client comparison + selection

**Files:**
- Create: `components/views/PackageComparison.tsx`
- Modify: `components/views/ClientEstimatePreview.tsx`
- Test: `components/views/PackageComparison.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/views/PackageComparison.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PackageComparison } from './PackageComparison';

const packages = [
  { id: 'a', name: 'Standard', isRecommended: false, total: 1000, summary: ['Interior walls', 'Standard paint'] },
  { id: 'b', name: 'Premium', isRecommended: true, total: 1800, summary: ['Interior walls', 'Premium paint', 'Trim included'] },
];

describe('PackageComparison', () => {
  it('renders a card per package with price and recommended badge', () => {
    render(<PackageComparison packages={packages} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByTestId('badge-b')).toHaveTextContent(/recommended/i);
  });

  it('fires onSelect with the package id', () => {
    const onSelect = vi.fn();
    render(<PackageComparison packages={packages} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /select Premium/i }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('marks the selected package', () => {
    render(<PackageComparison packages={packages} selectedId="a" onSelect={vi.fn()} />);
    expect(screen.getByTestId('selected-a')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/views/PackageComparison.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the comparison component**

```tsx
import React from 'react';
import { Star, Check } from 'lucide-react';

export interface ComparisonPackage {
  id: string;
  name: string;
  isRecommended: boolean;
  total: number;
  summary: string[];
}

interface PackageComparisonProps {
  packages: ComparisonPackage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const PackageComparison: React.FC<PackageComparisonProps> = ({ packages, selectedId, onSelect }) => {
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
      {packages.map((p) => {
        const isSelected = p.id === selectedId;
        return (
          <div
            key={p.id}
            className={`relative rounded-2xl border p-6 flex flex-col gap-4 bg-white dark:bg-gray-800 ${
              p.isRecommended ? 'border-primary-500 shadow-xl' : 'border-gray-200 dark:border-gray-700 shadow'
            } ${isSelected ? 'ring-2 ring-primary-500' : ''}`}
          >
            {p.isRecommended && (
              <span data-testid={`badge-${p.id}`} className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1">
                <Star className="w-3 h-3 fill-white" /> Recommended
              </span>
            )}
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{p.name}</h3>
            <div className="text-3xl font-black text-gray-900 dark:text-white">{fmt(p.total)}</div>
            <ul className="space-y-2 flex-1">
              {p.summary.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /> {line}
                </li>
              ))}
            </ul>
            {isSelected && <span data-testid={`selected-${p.id}`} className="text-xs font-bold text-primary-600">Selected</span>}
            <button
              onClick={() => onSelect(p.id)}
              aria-label={`Select ${p.name}`}
              className={`w-full justify-center py-2.5 rounded-xl font-bold transition-all ${
                isSelected ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-primary-50'
              }`}
            >
              {isSelected ? 'Selected' : 'Select'}
            </button>
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/views/PackageComparison.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the comparison into `ClientEstimatePreview`**

In `components/views/ClientEstimatePreview.tsx`:
- Import: `import { PackageComparison } from './PackageComparison';` and `import { getSelectedPackage, getPackageById } from '../../services/packages';`.
- Add local state `const [chosenId, setChosenId] = useState<string | null>(estimate.selectedPackageId);`.
- When `estimate.packages.length > 1` and not yet accepted, render `<PackageComparison packages={estimate.packages.map(p => ({ id: p.id, name: p.name, isRecommended: p.isRecommended, total: p.financials.baseGrandTotal || 0, summary: buildSummary(p) }))} selectedId={chosenId} onSelect={setChosenId} />` above the document body, where `buildSummary(p)` returns `p.estimateAreas.map(a => a.name)` plus any premium-material/extra hints (use area names for now).
- Render the detailed document for `getPackageById(estimate, chosenId) ?? getSelectedPackage(estimate)` instead of reading `estimate.*` scope directly.
- Pass `chosenId` into the accept action so the parent receives `{ ...estimate, selectedPackageId: chosenId }` (the accept handler from Task 5 reads `selectedPackageId`).
- When `estimate.packages.length === 1`, skip the comparison and render the single package's document exactly as today.

- [ ] **Step 6: Type-check and test**

Run: `npm run lint`
Expected: no errors.
Run: `npm test -- components/views/PackageComparison.test.tsx components/views/ClientEstimatePreview*`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/views/PackageComparison.tsx components/views/PackageComparison.test.tsx components/views/ClientEstimatePreview.tsx
git commit -m "feat(estimates): client package comparison and selection"
```

---

### Task 9: Read-routing sweep for remaining sites

**Files:**
- Modify: any remaining files that read `estimate.<scopeField>` directly (dashboards/lists/detail views)

- [ ] **Step 1: Find the remaining reader sites**

Run:
```bash
grep -rnE "estimate\.(estimateAreas|lineItems|financials|paintColors|sundries|pricingMethod|formLayout|finalize|scopeId)|\.notes\.(customer|internal)" components services App.tsx --include="*.tsx" --include="*.ts" | grep -v ".test."
```
Expected: the sites already handled (converters, form, preview) plus a small number of dashboard/list/detail reads.

- [ ] **Step 2: Repoint each remaining read**

For each remaining site that shows a headline number or scope summary for an estimate, import `getSelectedPackage` from `services/packages` and read from `getSelectedPackage(estimate).financials.baseGrandTotal` (for totals) or the relevant `getSelectedPackage(estimate).<field>`. For `estimate.notes.internal` reads, use `estimate.internalNotes`.

Example (estimate list total):
```ts
// before
const total = estimate.financials.baseGrandTotal;
// after
import { getSelectedPackage } from '../../services/packages';
const total = getSelectedPackage(estimate).financials.baseGrandTotal;
```

- [ ] **Step 3: Type-check + full test suite**

Run: `npm run lint`
Expected: no errors anywhere (all scope reads now route through a package).
Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(estimates): route remaining estimate scope reads through the selected package"
```

---

### Task 10: Full verification

- [ ] **Step 1: Full type-check**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all tests pass, including new `services/packages.test.ts`, `services/invoicePackages.test.ts`, `PackageSwitcher.test.tsx`, `PackageComparison.test.tsx`.

- [ ] **Step 3: Manual smoke (optional)**

Run: `npm run dev`, open an estimate, add a "Premium" package by duplicating, mark it recommended, switch between tabs (scope persists per package), open the client preview to see the comparison, select Premium, accept, and confirm the work order/invoice reflect Premium's totals.

No commit (verification only).

---

## Self-Review

- **Spec coverage:** data model — `EstimateFinancials`/`Package`/slim `Estimate` (Task 1) ✓; accessor & mutation module incl. duplicate/delete/recommended (Tasks 2–3) ✓; `migrateEstimate` + mock migration on load (Tasks 3, 5) ✓; converters read selected package (Task 4) ✓; authoring switcher + active-package sync incl. duplicate-on-create (Tasks 6–7) ✓; client comparison + Recommended badge + select/sign sets `selectedPackageId`+`Approved` (Tasks 5, 8) ✓; read-routing sweep three buckets (Tasks 4, 7, 8, 9) ✓; testing across all units (every task) ✓. Out-of-scope items excluded.
- **Placeholder scan:** no TBD/TODO; every code step shows complete code; the sweep task (9) uses a concrete grep + before/after example rather than a vague instruction.
- **Type consistency:** `Package`/`EstimateFinancials` fields, `getActivePackage`/`getSelectedPackage`/`getPackageById`, `addPackage(estimate, name, fromPackageId?)`, `duplicatePackage`, `deletePackage`, `setRecommended`, `migrateEstimate`, and the `PackageSwitcher`/`PackageComparison` prop shapes are used identically across tasks.
