# Client Package Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the client switch packages inline in the estimate preview so the whole estimate (scope, line items, paint schedule, totals) re-renders for the chosen package, with the viewed package being the selection and the Accept modal confirming it.

**Architecture:** `EstimateFormView` builds one full preview-data object per package (active = live folded state, others = saved) and passes a `previewPackages` array down. `ClientEstimatePreview` tracks a `viewedPackageId`, derives its render data from it, shows a compact `ClientPackagePicker` under the title, and the Accept modal gains a package chooser. A pure `buildPackagePreviewData(pkg, ctx)` mapper keeps the data shaping DRY and testable.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react, Tailwind, project i18n (`useTranslation`).

---

## File Structure

- Create: `components/views/ClientPackagePicker.tsx` — presentational client switcher (pills).
- Create: `components/views/ClientPackagePicker.test.tsx`
- Create: `services/estimatePreview.ts` — pure `buildPackagePreviewData(pkg, ctx)` mapper.
- Create: `services/estimatePreview.test.ts`
- Modify: `components/modals/AcceptEstimateModal.tsx` — optional package chooser.
- Create: `components/modals/AcceptEstimateModal.test.tsx`
- Modify: `components/views/ClientEstimatePreview.tsx` — `previewPackages`, `viewedPackageId`, picker placement, remove top band, accept wiring.
- Modify: `components/views/EstimateFormView.tsx` — build `previewPackages`, `prepareEstimateData(overrideId?)`, pass new props, drop `comparisonPackages`.
- Modify: `i18n/catalog.ts` — new keys (en + es).
- Delete: `components/views/PackageComparison.tsx`, `components/views/PackageComparison.test.tsx` — replaced by the picker.

---

## Task 1: ClientPackagePicker component

**Files:**
- Create: `components/views/ClientPackagePicker.tsx`
- Test: `components/views/ClientPackagePicker.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientPackagePicker } from './ClientPackagePicker';

const packages = [
  { id: 'a', name: 'Standard', isRecommended: false, total: 697 },
  { id: 'b', name: 'Premium', isRecommended: true, total: 881 },
];

describe('ClientPackagePicker', () => {
  it('renders a pill per package with name and formatted total', () => {
    render(<ClientPackagePicker packages={packages} selectedId="a" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Standard/ })).toHaveTextContent('$697');
    expect(screen.getByRole('button', { name: /Premium/ })).toHaveTextContent('$881');
  });

  it('marks the selected pill via aria-pressed', () => {
    render(<ClientPackagePicker packages={packages} selectedId="b" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Premium/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Standard/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('flags the recommended package', () => {
    render(<ClientPackagePicker packages={packages} selectedId="a" onSelect={vi.fn()} />);
    expect(screen.getByTestId('pick-recommended-b')).toBeInTheDocument();
  });

  it('fires onSelect with the package id', () => {
    const onSelect = vi.fn();
    render(<ClientPackagePicker packages={packages} selectedId="a" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Premium/ }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/ClientPackagePicker.test.tsx`
Expected: FAIL — cannot resolve `./ClientPackagePicker`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import React from 'react';
import { Star } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

export interface PickerPackage {
  id: string;
  name: string;
  isRecommended: boolean;
  total: number;
}

interface ClientPackagePickerProps {
  packages: PickerPackage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const ClientPackagePicker: React.FC<ClientPackagePickerProps> = ({ packages, selectedId, onSelect }) => {
  const { t } = useTranslation();
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  return (
    <div className="flex flex-wrap justify-center gap-3 print:hidden">
      {packages.map((p) => {
        const isSelected = p.id === selectedId;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(p.id)}
            className={`relative flex items-center gap-3 rounded-2xl border px-5 py-3 text-left transition-all ${
              isSelected
                ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-500 shadow-sm'
                : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-primary-50/40'
            }`}
          >
            {p.isRecommended && (
              <span
                data-testid={`pick-recommended-${p.id}`}
                className="absolute -top-2 -right-2 bg-primary-600 text-white rounded-full p-1"
                title={t('packageComparison.recommended')}
              >
                <Star className="w-3 h-3 fill-white" />
              </span>
            )}
            <span className="flex flex-col">
              <span className={`text-sm font-bold ${isSelected ? 'text-primary-900' : 'text-gray-900'}`}>{p.name}</span>
              <span className={`text-lg font-black ${isSelected ? 'text-primary-700' : 'text-gray-700'}`}>{fmt(p.total)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/views/ClientPackagePicker.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/views/ClientPackagePicker.tsx components/views/ClientPackagePicker.test.tsx
git commit -m "feat(estimates): client-facing package picker pills"
```

---

## Task 2: buildPackagePreviewData mapper

**Files:**
- Create: `services/estimatePreview.ts`
- Test: `services/estimatePreview.test.ts`

This mirrors the shape that `EstimateFormView.buildPreviewData()` produces today (see `components/views/EstimateFormView.tsx:989-1015`), but sourced from a `Package` plus estimate-level constants.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildPackagePreviewData, PreviewContext } from './estimatePreview';
import type { Package } from '../types';

const pkg = {
  id: 'pkg-1', name: 'Standard', isRecommended: false, scopeId: 'scope-int',
  pricingMethod: 'hourly',
  estimateAreas: [{ id: 'area-1', name: 'Living Room' } as any],
  lineItems: { 'li-1': { id: 'li-1' } as any },
  formLayout: ['area-1', 'li-1'],
  paintColors: [{ id: 'c1', colorCode: '1' } as any],
  sundries: [{ id: 's1' } as any],
  financials: { selectedAccessTierId: 'acc', selectedHeightTierId: 'h', taxId: 't', baseGrandTotal: 500, baseTaxAmount: 0, baseDiscountAmount: 0 } as any,
  customerNotes: 'thanks',
  finalize: { deposit: '25%', terms: 'T' },
} as Package;

const ctx: PreviewContext = {
  id: 'est-1', projectName: 'P', estimateNumber: 'EST-1',
  dates: { estimateDate: '2026-01-01', validUntilDate: '2026-02-01' },
  status: 'Draft', description: 'desc',
  customer: { firstName: 'Sarah' } as any, jobAddress: { address: '123' } as any,
  salesman: null, templateScopeIds: ['scope-int'], internalNotes: 'internal',
  settings: {} as any, materials: [] as any, rates: [] as any,
};

describe('buildPackagePreviewData', () => {
  it('maps package scope + estimate constants into the preview shape', () => {
    const d = buildPackagePreviewData(pkg, ctx);
    expect(d.areas).toBe(pkg.estimateAreas);
    expect(d.estimateAreas).toBe(pkg.estimateAreas);
    expect(d.lineItems).toBe(pkg.lineItems);
    expect(d.layout).toBe(pkg.formLayout);
    expect(d.formLayout).toBe(pkg.formLayout);
    expect(d.paintColors).toBe(pkg.paintColors);
    expect(d.sundries).toBe(pkg.sundries);
    expect(d.financials).toBe(pkg.financials);
    expect(d.pricingMethod).toBe('hourly');
    expect(d.finalize).toBe(pkg.finalize);
    expect(d.notes).toEqual({ customer: 'thanks', internal: 'internal' });
    expect(d.tierSelections).toEqual({ heightId: 'h', accessId: 'acc' });
    expect(d.projectInfo).toEqual({ name: 'P', number: 'EST-1', date: '2026-01-01', validUntil: '2026-02-01' });
    expect(d.customer).toBe(ctx.customer);
    expect(d.settings).toBe(ctx.settings);
  });

  it('falls back to context scope ids when the package has no scopeId', () => {
    const d = buildPackagePreviewData({ ...pkg, scopeId: '' } as Package, ctx);
    expect(d.scopeIds).toEqual(['scope-int']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/estimatePreview.test.ts`
Expected: FAIL — cannot resolve `./estimatePreview`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Package } from '../types';

export interface PreviewContext {
  id: string;
  projectName: string;
  estimateNumber: string;
  dates: { estimateDate: string; validUntilDate: string };
  status: string;
  description: string;
  customer: any;
  jobAddress: any;
  salesman: any;
  templateScopeIds: string[];
  internalNotes: string;
  settings: any;
  materials: any;
  rates: any;
}

/** Flatten a package's scope + estimate-level constants into the shape ClientEstimatePreview renders. */
export function buildPackagePreviewData(pkg: Package, ctx: PreviewContext) {
  return {
    id: ctx.id,
    projectName: ctx.projectName,
    projectInfo: { name: ctx.projectName, number: ctx.estimateNumber, date: ctx.dates.estimateDate, validUntil: ctx.dates.validUntilDate },
    status: ctx.status,
    scopeId: pkg.scopeId || ctx.templateScopeIds[0] || 'scope-int',
    scopeIds: pkg.scopeId ? [pkg.scopeId] : ctx.templateScopeIds,
    description: ctx.description,
    customer: ctx.customer,
    jobAddress: ctx.jobAddress,
    salesman: ctx.salesman,
    estimateAreas: pkg.estimateAreas,
    areas: pkg.estimateAreas,
    lineItems: pkg.lineItems,
    formLayout: pkg.formLayout,
    layout: pkg.formLayout,
    paintColors: pkg.paintColors,
    sundries: pkg.sundries,
    notes: { customer: pkg.customerNotes || '', internal: ctx.internalNotes || '' },
    financials: pkg.financials,
    pricingMethod: pkg.pricingMethod,
    finalize: pkg.finalize,
    settings: ctx.settings,
    materials: ctx.materials,
    rates: ctx.rates,
    tierSelections: { heightId: pkg.financials?.selectedHeightTierId, accessId: pkg.financials?.selectedAccessTierId },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/estimatePreview.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add services/estimatePreview.ts services/estimatePreview.test.ts
git commit -m "feat(estimates): pure package-to-preview-data mapper"
```

---

## Task 3: i18n keys for the picker label + accept chooser

**Files:**
- Modify: `i18n/catalog.ts` (English block near line 54; Spanish block near line 155)

- [ ] **Step 1: Add the English keys**

Find the line `  'packageComparison.chooseSub': 'Compare the options below and select the one that fits you best.',` and add immediately after it:

```ts
  'packagePicker.label': 'Your package options',
  'modals.AcceptEstimateModal.choosePackage': 'Choose your package',
```

- [ ] **Step 2: Add the Spanish keys**

Find the Spanish `  'packageComparison.selectName': 'Seleccionar {name}',` line's block (the `packageComparison.*` Spanish entries) and add after the Spanish `packageComparison` entries:

```ts
  'packagePicker.label': 'Tus opciones de paquete',
  'modals.AcceptEstimateModal.choosePackage': 'Elige tu paquete',
```

- [ ] **Step 3: Verify the catalog still type-checks / imports**

Run: `npx vitest run i18n/translate.test.ts`
Expected: PASS (existing tests still pass).

- [ ] **Step 4: Commit**

```bash
git add i18n/catalog.ts
git commit -m "i18n(estimates): keys for package picker and accept chooser"
```

---

## Task 4: AcceptEstimateModal package chooser

**Files:**
- Modify: `components/modals/AcceptEstimateModal.tsx`
- Test: `components/modals/AcceptEstimateModal.test.tsx`

The modal becomes self-contained: it takes an optional `packages` list and a `defaultPackageId`, tracks the chosen package internally, shows the chosen package's total, and passes the chosen id to `onAccept`.

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AcceptEstimateModal } from './AcceptEstimateModal';

const base = {
  isOpen: true, onClose: vi.fn(), terms: 'Pay half up front', onEdit: vi.fn(),
};

describe('AcceptEstimateModal', () => {
  it('shows the single total and accepts with no package id when no packages given', () => {
    const onAccept = vi.fn();
    render(<AcceptEstimateModal {...base} total={500} onAccept={onAccept} />);
    expect(screen.getByText('$500.00')).toBeInTheDocument();
    expect(screen.queryByText(/choose your package/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^accept estimate$/i }));
    expect(onAccept).toHaveBeenCalledWith(undefined);
  });

  it('renders a chooser, follows the chosen package total, and accepts with its id', () => {
    const onAccept = vi.fn();
    render(
      <AcceptEstimateModal
        {...base}
        total={697}
        onAccept={onAccept}
        packages={[{ id: 'a', name: 'Standard', total: 697 }, { id: 'b', name: 'Premium', total: 881 }]}
        defaultPackageId="a"
      />,
    );
    expect(screen.getByText(/choose your package/i)).toBeInTheDocument();
    // defaults to 'a'
    expect(screen.getByText('$697.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Premium/ }));
    expect(screen.getByText('$881.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^accept estimate$/i }));
    expect(onAccept).toHaveBeenCalledWith('b');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/modals/AcceptEstimateModal.test.tsx`
Expected: FAIL — `onAccept` called with no arg / chooser not present.

- [ ] **Step 3: Update the component**

Replace the signature line (`components/modals/AcceptEstimateModal.tsx:7`) and add chooser state + UI. Full new top of file through the price banner:

```tsx
import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, MessageSquare, Check } from 'lucide-react';
import { Button } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

interface AcceptPackage { id: string; name: string; total: number; }

export const AcceptEstimateModal = ({
  isOpen, onClose, total, terms, onAccept, onEdit, packages, defaultPackageId,
}: {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  terms: string;
  onAccept: (packageId?: string) => void;
  onEdit: () => void;
  packages?: AcceptPackage[];
  defaultPackageId?: string | null;
}) => {
  const { t } = useTranslation();
  const hasChooser = !!packages && packages.length > 1;
  const [chosenId, setChosenId] = useState<string | null>(defaultPackageId ?? null);

  useEffect(() => {
    if (isOpen) setChosenId(defaultPackageId ?? null);
  }, [isOpen, defaultPackageId]);

  if (!isOpen) return null;

  const chosenTotal = hasChooser ? (packages!.find(p => p.id === chosenId)?.total ?? total) : total;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col animate-in zoom-in-95 duration-200 relative">

        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">{t('modals.AcceptEstimateModal.acceptEstimate')}</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>

        <div className="p-8 space-y-8">
            {hasChooser && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('modals.AcceptEstimateModal.choosePackage')}</div>
                <div className="grid gap-3">
                  {packages!.map((p) => {
                    const isChosen = p.id === chosenId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={isChosen}
                        aria-label={p.name}
                        onClick={() => setChosenId(p.id)}
                        className={`flex items-center justify-between rounded-xl border-2 px-5 py-4 transition-all ${
                          isChosen ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className={`flex items-center justify-center w-5 h-5 rounded-full border-2 ${isChosen ? 'border-primary-600' : 'border-gray-300'}`}>
                            {isChosen && <span className="w-2.5 h-2.5 rounded-full bg-primary-600" />}
                          </span>
                          <span className="font-bold text-gray-900 dark:text-white">{p.name}</span>
                        </span>
                        <span className="font-black text-gray-900 dark:text-white">${p.total.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price Banner */}
            <div className="bg-primary-50/50 dark:bg-primary-900/20 rounded-2xl p-6 border border-primary-100 dark:border-primary-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('modals.AcceptEstimateModal.totalAgreedPrice')}</div>
                    <div className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">${chosenTotal.toFixed(2)}</div>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide">
                    {t('modals.AcceptEstimateModal.pendingAcceptance')}
                </div>
            </div>
```

Then change the footer Accept button's handler (the final `<Button onClick={onAccept} ...>`) to:

```tsx
             <Button onClick={() => onAccept(hasChooser ? (chosenId ?? undefined) : undefined)} size="lg" className="w-full sm:w-auto shadow-xl shadow-primary-500/30 rounded-full">
                <Check className="w-5 h-5" /> {t('modals.AcceptEstimateModal.acceptEstimate')}
             </Button>
```

Leave the rest of the modal (terms, form fields, footer secondary buttons) unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/modals/AcceptEstimateModal.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/modals/AcceptEstimateModal.tsx components/modals/AcceptEstimateModal.test.tsx
git commit -m "feat(estimates): package chooser in accept modal"
```

---

## Task 5: Wire ClientEstimatePreview to the picker and per-package data

**Files:**
- Modify: `components/views/ClientEstimatePreview.tsx`
- Test: `components/views/ClientEstimatePreview.test.tsx` (create)

### 5a — Props, derived view data, optionals reset

- [ ] **Step 1: Add imports**

At the top of `ClientEstimatePreview.tsx`, replace the PackageComparison import (line 16, `import { PackageComparison, ComparisonPackage } from './PackageComparison';`) with:

```tsx
import { ClientPackagePicker } from './ClientPackagePicker';
```

- [ ] **Step 2: Update the prop list and destructure (replace lines 41-63 area)**

Replace the destructured props block and the `data` destructure:

```tsx
export const ClientEstimatePreview = ({
    data,
    onBack,
    onUpdateVisibility,
    onReorder,
    onGlobalVisibility,
    onAcceptEstimate,
    previewPackages,
    selectedPackageId,
    onSelectPackage,
}: {
    data: any,
    onBack: () => void,
    onUpdateVisibility: (type: 'area' | 'row' | 'misc' | 'sundry', id: string, key: keyof ClientViewVisibility, value: boolean) => void,
    onReorder: (id: string, direction: 'up' | 'down') => void,
    onGlobalVisibility: (key: 'prices' | 'quantities' | 'coats', val: boolean) => void,
    onAcceptEstimate?: (packageId?: string) => void,
    previewPackages?: { id: string; name: string; isRecommended: boolean; total: number; data: any }[],
    selectedPackageId?: string | null,
    onSelectPackage?: (id: string) => void,
}) => {
  const { t } = useTranslation();
  const hasPicker = !!previewPackages && previewPackages.length > 1;
  const initialViewedId = (selectedPackageId && previewPackages?.some(p => p.id === selectedPackageId))
    ? selectedPackageId
    : (previewPackages?.find(p => p.isRecommended)?.id ?? previewPackages?.[0]?.id ?? null);
  const [viewedPackageId, setViewedPackageId] = useState<string | null>(initialViewedId);
  const viewData = previewPackages?.find(p => p.id === viewedPackageId)?.data ?? data;
  const { customer, jobAddress, projectInfo, salesman, layout, areas, lineItems, notes, finalize, financials, paintColors, materials, sundries, settings, rates, tierSelections, pricingMethod, formTitle } = viewData;
```

Note: `formTitle` is not produced by `buildPackagePreviewData`; it will be `undefined` for package views, which the existing render already handles via fallback (`formTitle || t(...)`).

- [ ] **Step 3: Reset optional selections when the viewed package changes**

Immediately after the existing `const [selectedOptionalIds, setSelectedOptionalIds] = useState<Set<string>>(new Set());` line, add:

```tsx
  useEffect(() => {
    setSelectedOptionalIds(new Set());
  }, [viewedPackageId]);

  const handleSelectPackage = (id: string) => {
    setViewedPackageId(id);
    onSelectPackage?.(id);
  };
```

Ensure `useEffect` is imported (update the React import at line 2 to `import React, { useState, useMemo, useEffect } from 'react';`).

### 5b — Replace the top band with the inline picker

- [ ] **Step 4: Remove the top comparison band**

Delete the entire block at `ClientEstimatePreview.tsx:357-371` (the `{comparisonPackages && comparisonPackages.length > 1 && ( ... )}` JSX that renders the heading + `<PackageComparison>`).

- [ ] **Step 5: Add the picker under the estimate title block**

In the `#estimate` sheet, find the title block that ends with:

```tsx
                <p className="text-gray-400 font-medium text-sm md:text-lg">{t('views.ClientEstimatePreview.detailedProposal')}</p>
            </div>
```

Immediately after that closing `</div>` (still inside `<div className="p-8 md:p-12 pb-8 md:pb-8 relative">`), insert:

```tsx
            {hasPicker && (
              <div className="mb-8 md:mb-10">
                <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{t('packagePicker.label')}</div>
                <ClientPackagePicker
                  packages={previewPackages!.map(p => ({ id: p.id, name: p.name, isRecommended: p.isRecommended, total: p.total }))}
                  selectedId={viewedPackageId}
                  onSelect={handleSelectPackage}
                />
              </div>
            )}
```

### 5c — Wire the Accept modal chooser + accept callback

- [ ] **Step 6: Update the AcceptEstimateModal usage (around line 375-385)**

Replace the existing `<AcceptEstimateModal ... />` element with:

```tsx
      <AcceptEstimateModal
          isOpen={isAcceptModalOpen}
          onClose={() => setIsAcceptModalOpen(false)}
          total={displayTotal}
          terms={finalize.deposit}
          packages={hasPicker ? previewPackages!.map(p => ({ id: p.id, name: p.name, total: p.total })) : undefined}
          defaultPackageId={viewedPackageId}
          onAccept={(packageId) => {
              if (packageId) handleSelectPackage(packageId);
              if (onAcceptEstimate) onAcceptEstimate(packageId ?? viewedPackageId ?? undefined);
              setIsAcceptModalOpen(false);
          }}
          onEdit={() => { setIsAcceptModalOpen(false); onBack(); }}
      />
```

- [ ] **Step 7: Write the integration test**

Create `components/views/ClientEstimatePreview.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientEstimatePreview } from './ClientEstimatePreview';

const baseSettings = {
  financialModel: {}, estimateDefaults: {}, projectDiscounts: [], taxRegions: [], taxRates: [],
  heightTiers: [], accessTiers: [], extraColumns: [],
};

const mkData = (areaName: string, total: number) => ({
  customer: { firstName: 'Sarah', lastName: 'J' }, jobAddress: {}, projectInfo: { name: 'P', number: 'E1' },
  salesman: null, layout: ['a1'], areas: [{ id: 'a1', name: areaName, length: 0, width: 0, height: 0, rows: [], visibility: {} }],
  lineItems: {}, notes: { customer: '' }, finalize: { deposit: '', terms: '' },
  financials: { baseGrandTotal: total, baseSubtotal: total }, paintColors: [], materials: [], sundries: [],
  settings: baseSettings, rates: [], tierSelections: {}, pricingMethod: 'hourly',
});

const previewPackages = [
  { id: 'a', name: 'Standard', isRecommended: false, total: 697, data: mkData('Living Room', 697) },
  { id: 'b', name: 'Premium', isRecommended: false, total: 881, data: mkData('Master Bath', 881) },
];

const baseProps = {
  data: previewPackages[0].data,
  onBack: vi.fn(), onUpdateVisibility: vi.fn(), onReorder: vi.fn(), onGlobalVisibility: vi.fn(),
};

describe('ClientEstimatePreview package switching', () => {
  it('renders the picker and switches the rendered scope + fires onSelectPackage', () => {
    const onSelectPackage = vi.fn();
    render(<ClientEstimatePreview {...baseProps} previewPackages={previewPackages} selectedPackageId="a" onSelectPackage={onSelectPackage} />);
    // default view = package a
    expect(screen.getByDisplayValue('Living Room')).toBeInTheDocument();
    // switch to package b
    fireEvent.click(screen.getByRole('button', { name: /Premium/ }));
    expect(onSelectPackage).toHaveBeenCalledWith('b');
    expect(screen.getByDisplayValue('Master Bath')).toBeInTheDocument();
  });

  it('does not render the picker for a single package', () => {
    render(<ClientEstimatePreview {...baseProps} previewPackages={[previewPackages[0]]} selectedPackageId="a" onSelectPackage={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Premium/ })).not.toBeInTheDocument();
  });
});
```

Note: the area name renders inside a text `<input value={area.name}>` (see `ScopeOfWork`/preview area rendering), so `getByDisplayValue` is the reliable matcher. If the preview renders the area name as static text instead of an input in client mode, switch the assertion to `screen.getByText('Living Room')`. Run the test and use whichever matcher reflects the actual DOM.

- [ ] **Step 8: Run the test**

Run: `npx vitest run components/views/ClientEstimatePreview.test.tsx`
Expected: PASS (2 tests). If the area-name matcher fails, adjust per the note in Step 7 and re-run.

- [ ] **Step 9: Commit**

```bash
git add components/views/ClientEstimatePreview.tsx components/views/ClientEstimatePreview.test.tsx
git commit -m "feat(estimates): inline package switcher in client preview"
```

---

## Task 6: Wire EstimateFormView to build per-package preview data

**Files:**
- Modify: `components/views/EstimateFormView.tsx`

- [ ] **Step 1: Import the mapper**

Near the other `services/*` imports at the top of `EstimateFormView.tsx`, add:

```tsx
import { buildPackagePreviewData, PreviewContext } from '../../services/estimatePreview';
```

(Match the existing relative-path style used by other service imports in this file; if the file uses `@/services/...`, use that instead.)

- [ ] **Step 2: Make prepareEstimateData accept an override id**

Change the signature at `EstimateFormView.tsx:951` from `const prepareEstimateData = () => {` to:

```tsx
  const prepareEstimateData = (overrideSelectedId?: string) => {
```

And in its returned object, change the `selectedPackageId,` line to:

```tsx
          selectedPackageId: overrideSelectedId ?? selectedPackageId,
```

- [ ] **Step 3: Replace buildPreviewData + comparisonPackages with previewPackages**

Replace the `buildPreviewData` function (lines 989-1015) and the `comparisonPackages` const (lines 1018-1024) with the following single block:

```tsx
  // Per-package preview data: active package uses live folded state, others use saved scope.
  const previewCtx: PreviewContext = {
    id: template?.id || `est-${estimateNumber}`,
    projectName, estimateNumber, dates, status: template?.status || 'Draft', description,
    customer, jobAddress, salesman, templateScopeIds, internalNotes: notes.internal,
    settings, materials, rates,
  };
  const foldedForPreview: Package[] = packages.length
    ? packages.map(p => (p.id === activePackageId ? readFormIntoPackage(p) : p))
    : [readFormIntoPackage({
        id: activePackageId || `pkg-${estimateNumber}`, name: t('packageSwitcher.defaultName'), isRecommended: false,
        scopeId: templateScopeIds[0] || 'scope-int', pricingMethod, estimateAreas, lineItems, formLayout,
        paintColors, sundries, financials, customerNotes: notes.customer, finalize,
      } as Package)];
  const previewPackages = foldedForPreview.map(p => ({
    id: p.id, name: p.name, isRecommended: p.isRecommended, total: p.financials?.baseGrandTotal || 0,
    data: buildPackagePreviewData(p, previewCtx),
  }));
  const activePreviewData = previewPackages.find(p => p.id === activePackageId)?.data ?? previewPackages[0].data;
  const buildPreviewData = () => activePreviewData;
```

(`buildPreviewData` is kept as a thin wrapper so the existing call site at the client-view return still works.)

- [ ] **Step 4: Update the ClientEstimatePreview render props**

In the `currentViewMode === 'client'` return block (around line 1055-1059), replace:

```tsx
              data={buildPreviewData()}
              comparisonPackages={packagesEnabled ? comparisonPackages : undefined}
              selectedPackageId={selectedPackageId}
              onSelectPackage={setSelectedPackageId}
```

with:

```tsx
              data={buildPreviewData()}
              previewPackages={packagesEnabled ? previewPackages : undefined}
              selectedPackageId={selectedPackageId}
              onSelectPackage={setSelectedPackageId}
```

- [ ] **Step 5: Update the accept callback to pass the chosen package**

In the same return block, replace the `onAcceptEstimate` handler (around line 1085-1087):

```tsx
              onAcceptEstimate={() => {
                  if (onAcceptEstimate) onAcceptEstimate(prepareEstimateData());
              }}
```

with:

```tsx
              onAcceptEstimate={(packageId) => {
                  if (packageId) setSelectedPackageId(packageId);
                  if (onAcceptEstimate) onAcceptEstimate(prepareEstimateData(packageId));
              }}
```

- [ ] **Step 6: Type-check the file**

Run: `npx tsc --noEmit`
Expected: No new errors in `EstimateFormView.tsx` / `ClientEstimatePreview.tsx`. (If the project has pre-existing unrelated TS errors, confirm none are newly introduced by these files.)

- [ ] **Step 7: Commit**

```bash
git add components/views/EstimateFormView.tsx
git commit -m "feat(estimates): feed per-package preview data into client preview"
```

---

## Task 7: Remove the now-unused PackageComparison

**Files:**
- Delete: `components/views/PackageComparison.tsx`
- Delete: `components/views/PackageComparison.test.tsx`

- [ ] **Step 1: Confirm there are no remaining importers**

Run: `grep -rn "PackageComparison" --include="*.tsx" --include="*.ts" . | grep -v node_modules`
Expected: no matches outside the two files being deleted. If any other file imports it, stop and reassess.

- [ ] **Step 2: Delete the files**

```bash
git rm components/views/PackageComparison.tsx components/views/PackageComparison.test.tsx
```

- [ ] **Step 3: Run the full suite**

Run: `npx vitest run`
Expected: PASS across the suite (no references to the deleted component).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(estimates): remove unused PackageComparison cards"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no newly introduced errors.

- [ ] **Step 3: Manual smoke (optional but recommended)**

Use the `/run` skill or `npm run dev`, open an estimate with 2+ packages, switch to the client preview:
- The "Choose your package" top band is gone.
- Package pills appear under the title; clicking one re-renders the whole scope/line items/totals.
- Accept opens the modal with a package chooser defaulting to the viewed package; choosing one updates the total; accepting records that package.

---

## Self-Review Notes

- **Spec coverage:** Remove top band (Task 5 Step 4) ✓; inline switcher under title (Task 1 + Task 5 Step 5) ✓; per-package data flow (Task 2 + Task 6) ✓; viewed = selected (Task 5 `handleSelectPackage`) ✓; accept chooser (Task 4 + Task 5 Step 6 + Task 6 Step 5) ✓; single/legacy fallback (`viewData ?? data`, `hasPicker` guards) ✓.
- **Type consistency:** `previewPackages` entry shape `{id,name,isRecommended,total,data}` is identical in `estimatePreview` producer (Task 6), `ClientEstimatePreview` prop (Task 5), and picker mapping. `onAccept(packageId?)` / `onAcceptEstimate(packageId?)` signatures match across Tasks 4, 5, 6. `buildPackagePreviewData(pkg, ctx)` / `PreviewContext` consistent across Tasks 2 and 6.
- **Non-goal preserved:** per-package totals use saved `financials.baseGrandTotal` (Task 6 Step 3), matching prior comparison-card behavior.
