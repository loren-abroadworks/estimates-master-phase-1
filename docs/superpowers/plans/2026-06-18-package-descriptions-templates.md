# Package Descriptions + Description Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each estimate package a single customer-facing description, plus a reusable template library so descriptions can be picked from a list and saved for next time.

**Architecture:** Add a `description: string` field to the `Package` type and a new `PackageDescriptionTemplate` type. Templates live in App-level React state seeded from a constant, exactly like the existing `lineItemTemplates`/`termsTemplates`. The Add/Rename package dialog (`PackageModal`) gains the description box, a "use template" picker, and a "save as template" control. The description renders on the client proposal, and templates get full CRUD in Settings.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + React Testing Library, Tailwind, custom i18n catalog (`i18n/catalog.ts`).

## Global Constraints

- Package description field is named `description` (string), customer-facing. It is **separate** from the existing `customerNotes` field.
- Template type is `PackageDescriptionTemplate { id: string; name: string; description: string }`.
- Follow the existing template pattern (`lineItemTemplates` / `termsTemplates`): App-level `useState` seeded from a constant in `constants.ts`, threaded as props.
- The estimate-level preview field already called `description` must NOT be reused for the package description — the package description is surfaced on the preview as a distinct key `packageDescription`.
- Every new user-facing string must be added to BOTH the `en` and `es` blocks of `i18n/catalog.ts`.
- Tests run with `npm test` (alias for `vitest run`). Run a single file with `npx vitest run <path>`.
- No backend work; everything is in-memory state seeded from constants.

---

## Task 1: Data model, seed constant, and package service logic

**Files:**
- Modify: `types.ts` (add `Package.description`, add `PackageDescriptionTemplate`)
- Modify: `constants.ts` (add `INITIAL_PACKAGE_DESCRIPTION_TEMPLATES`)
- Modify: `services/packages.ts` (`blankPackage`, `migrateEstimate`, `addPackage`)
- Test: `services/packages.test.ts`

**Interfaces:**
- Produces:
  - `Package.description: string`
  - `interface PackageDescriptionTemplate { id: string; name: string; description: string }`
  - `INITIAL_PACKAGE_DESCRIPTION_TEMPLATES: PackageDescriptionTemplate[]`
  - `addPackage(estimate: Estimate, name: string, fromPackageId?: string, description?: string): Estimate`

- [ ] **Step 1: Write the failing tests**

Append to `services/packages.test.ts`:

```typescript
import { addPackage, migrateEstimate } from './packages';

describe('package descriptions', () => {
  const baseEstimate = (): Estimate => ({
    id: 'e1', projectName: 'P', status: 'Draft',
    customer: {} as any, jobAddress: {} as any, projectInfo: {} as any, salesman: null,
    internalNotes: '', packages: [pkg], activePackageId: 'pkg-1', selectedPackageId: null,
    packagesEnabled: false,
  } as Estimate);

  it('addPackage creates a blank package with an empty description', () => {
    const next = addPackage(baseEstimate(), 'Better');
    const created = next.packages[next.packages.length - 1];
    expect(created.description).toBe('');
  });

  it('addPackage accepts an explicit description', () => {
    const next = addPackage(baseEstimate(), 'Better', undefined, 'Premium repaint');
    const created = next.packages[next.packages.length - 1];
    expect(created.description).toBe('Premium repaint');
  });

  it('addPackage from a source carries the source description forward', () => {
    const est = baseEstimate();
    est.packages[0].description = 'Carried over';
    const next = addPackage(est, 'Copy', 'pkg-1');
    const created = next.packages[next.packages.length - 1];
    expect(created.description).toBe('Carried over');
  });

  it('migrateEstimate backfills description on legacy estimates', () => {
    const legacy = { id: 'e2', projectName: 'Legacy', status: 'Draft', estimateAreas: [], lineItems: {} };
    const migrated = migrateEstimate(legacy);
    expect(migrated.packages[0].description).toBe('');
  });

  it('migrateEstimate backfills description on already-migrated packages', () => {
    const already = { ...baseEstimate(), packages: [{ ...pkg, description: undefined }] };
    const migrated = migrateEstimate(already as any);
    expect(migrated.packages[0].description).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/packages.test.ts`
Expected: FAIL — `description` is not yet a field (type error / `undefined`).

- [ ] **Step 3: Add the types**

In `types.ts`, add to the `Package` interface (after `customerNotes: string;`, around line 672):

```typescript
  description: string;
```

In `types.ts`, add the template type after the `TermsTemplate` interface (around line 68):

```typescript
export interface PackageDescriptionTemplate {
  id: string;
  name: string;
  description: string;
}
```

- [ ] **Step 4: Add the seed constant**

In `constants.ts`, add after `INITIAL_TERMS_TEMPLATES` (around line 89). Also add `PackageDescriptionTemplate` to the type import at the top of the file (the import from `./types` on line 2):

```typescript
export const INITIAL_PACKAGE_DESCRIPTION_TEMPLATES: PackageDescriptionTemplate[] = [
  { id: 'pdt-1', name: 'Standard Interior', description: 'Complete interior repaint using quality paint. Two coats on walls and ceilings, all trim and doors included, with full surface prep and patching of minor cracks.' },
  { id: 'pdt-2', name: 'Premium Interior', description: 'Premium interior repaint with low-VOC paint. Two coats throughout, trim, doors, and closets included, plus drywall repair and caulking of all gaps.' },
  { id: 'pdt-3', name: 'Exterior Repaint', description: 'Full exterior repaint including pressure wash, scrape and sand of failing areas, priming of bare wood, and two finish coats on all sided surfaces and trim.' },
];
```

- [ ] **Step 5: Update the package service**

In `services/packages.ts`:

Update `blankPackage` (line 30) to set `description: ''`:

```typescript
function blankPackage(name: string): Package {
  return {
    id: newId('pkg'), name, isRecommended: false, scopeId: '', pricingMethod: 'hourly',
    estimateAreas: [], lineItems: {}, formLayout: [], paintColors: [], sundries: [],
    financials: blankFinancials(), customerNotes: '', description: '', finalize: { deposit: '', terms: '' },
  };
}
```

`clonePackage` uses `JSON.parse(JSON.stringify(src))`, so it already carries `description` forward — no change needed.

Update `addPackage` (line 64) to accept and apply an explicit description:

```typescript
export function addPackage(estimate: Estimate, name: string, fromPackageId?: string, description?: string): Estimate {
  const source = fromPackageId ? getPackageById(estimate, fromPackageId) : undefined;
  const pkg = source ? clonePackage(source, name) : blankPackage(name);
  if (description !== undefined) pkg.description = description;
  return { ...estimate, packages: [...estimate.packages, pkg], activePackageId: pkg.id };
}
```

Update `migrateEstimate` (line 89). In the already-migrated branch (line 90-93), backfill `description` on each package:

```typescript
  if (raw && Array.isArray(raw.packages) && raw.activePackageId) {
    return {
      ...raw,
      packages: raw.packages.map((p: any) => ({ ...p, description: p.description ?? '' })),
      packagesEnabled: raw.packagesEnabled ?? (raw.packages.length > 1),
    } as Estimate;
  }
```

In the legacy-wrap branch, add `description` to the constructed `pkg` (after `customerNotes:` line 106):

```typescript
    customerNotes: raw.notes?.customer ?? '',
    description: raw.description ?? '',
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run services/packages.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add types.ts constants.ts services/packages.ts services/packages.test.ts
git commit -m "feat(estimate): add package description field, template type, and seed"
```

---

## Task 2: PackageModal description box, template picker, and save-as-template

**Files:**
- Modify: `components/UI.tsx` (forward `ariaLabel` on `TextInput` and `TextArea`)
- Modify: `components/views/EstimateForm/PackageModal.tsx`
- Modify: `components/views/EstimateFormView.tsx` (`submitPackageModal`, `<PackageModal>` props, new save handler, props interface, destructure)
- Modify: `App.tsx` (template state + pass to `EstimateFormView`)
- Modify: `i18n/catalog.ts` (modal strings, en + es)
- Test: `components/views/EstimateForm/PackageModal.test.tsx`

**Note on test queries:** `TextInput`/`TextArea` currently render `label` as an unassociated `<span>` (no `htmlFor`), and `Select` already forwards `ariaLabel`. Because the modal now has multiple textboxes, the tests query by accessible name via `ariaLabel`. Step 3 below adds `ariaLabel` forwarding to `TextInput` and `TextArea` so `getByLabelText('Package name' | 'Description' | 'Template name')` resolves.

**Interfaces:**
- Consumes: `PackageDescriptionTemplate`, `INITIAL_PACKAGE_DESCRIPTION_TEMPLATES`, `addPackage(..., description?)` from Task 1.
- Produces:
  - `PackageModal` `onSubmit(name: string, description: string, sourceId?: string)`
  - `PackageModal` new props: `descriptionTemplates: PackageDescriptionTemplate[]`, `onSaveTemplate: (name: string, description: string) => void`, `initialDescription?: string`, and `packages` items extended to `{ id: string; name: string; description?: string }`.

- [ ] **Step 1: Update existing PackageModal tests and add new ones**

The `onSubmit` signature gains a `description` argument, so existing assertions must change. Replace the body of `components/views/EstimateForm/PackageModal.test.tsx` with:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PackageModal } from './PackageModal';

const pkgs = [{ id: 'a', name: 'Standard', description: 'Std desc' }, { id: 'b', name: 'Premium' }];
const templates = [{ id: 'pdt-1', name: 'Premium Interior', description: 'Premium blurb' }];

const baseProps = {
  isOpen: true as const,
  packages: pkgs,
  activeId: 'a',
  descriptionTemplates: templates,
  onClose: vi.fn(),
  onSaveTemplate: vi.fn(),
};

describe('PackageModal', () => {
  it('add mode: submits name, description, and chosen source', () => {
    const onSubmit = vi.fn();
    render(<PackageModal {...baseProps} mode="add" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Package name'), { target: { value: 'Deluxe' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'My blurb' } });
    fireEvent.change(screen.getByLabelText('Start from'), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: /create package/i }));
    expect(onSubmit).toHaveBeenCalledWith('Deluxe', 'My blurb', 'b');
  });

  it('add mode: pre-fills description from the default source package', () => {
    render(<PackageModal {...baseProps} mode="add" onSubmit={vi.fn()} />);
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Std desc');
  });

  it('choosing a template fills the description box', () => {
    render(<PackageModal {...baseProps} mode="add" onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Use template'), { target: { value: 'pdt-1' } });
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Premium blurb');
  });

  it('save as template calls onSaveTemplate with the typed name and description', () => {
    const onSaveTemplate = vi.fn();
    render(<PackageModal {...baseProps} mode="rename" initialName="Standard" initialDescription="Reusable text" onSubmit={vi.fn()} onSaveTemplate={onSaveTemplate} />);
    fireEvent.click(screen.getByRole('button', { name: /save as template/i }));
    fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'My Template' } });
    fireEvent.click(screen.getByRole('button', { name: /^save template$/i }));
    expect(onSaveTemplate).toHaveBeenCalledWith('My Template', 'Reusable text');
  });

  it('rename mode: pre-fills name and description and submits both', () => {
    const onSubmit = vi.fn();
    render(<PackageModal {...baseProps} mode="rename" initialName="Standard" initialDescription="Existing" onSubmit={onSubmit} />);
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Existing');
    fireEvent.change(screen.getByLabelText('Package name'), { target: { value: 'Standard Plus' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).toHaveBeenCalledWith('Standard Plus', 'Existing', undefined);
  });

  it('does not submit an empty name and shows a required error', () => {
    const onSubmit = vi.fn();
    render(<PackageModal {...baseProps} mode="add" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Package name'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /create package/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/package name is required/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/views/EstimateForm/PackageModal.test.tsx`
Expected: FAIL — new props/fields and `Description` control do not exist yet.

- [ ] **Step 3: Forward `ariaLabel` on TextInput and TextArea**

In `components/UI.tsx`, update `TextInput` (lines 100-125) to accept and forward `ariaLabel`:

```tsx
export const TextInput = ({
  value,
  onChange,
  placeholder,
  className = "",
  label,
  ariaLabel,
  type = "text"
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  ariaLabel?: string;
  type?: string;
}) => (
  <div className="flex flex-col gap-2 w-full group">
    {label && <span className={Typography.label}>{label}</span>}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={`${Components.Input.base} ${Components.Input.sizes.md} text-base ${className}`}
    />
  </div>
);
```

Update `TextArea` (lines 127-152) the same way:

```tsx
export const TextArea = ({
  value,
  onChange,
  placeholder,
  className = "",
  label,
  ariaLabel,
  rows = 4
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  ariaLabel?: string;
  rows?: number;
}) => (
  <div className="flex flex-col gap-2 w-full group">
    {label && <span className={Typography.label}>{label}</span>}
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      aria-label={ariaLabel}
      className={`${Components.Input.base} ${Components.Input.sizes.md} text-base resize-none ${className}`}
    />
  </div>
);
```

- [ ] **Step 4: Rewrite PackageModal**

Replace `components/views/EstimateForm/PackageModal.tsx` with:

```tsx
import React, { useState, useEffect } from 'react';
import { Modal, TextInput, TextArea, Select, InputGroup, Button } from '../../UI';
import { useTranslation } from '@/i18n/LanguageContext';
import type { PackageDescriptionTemplate } from '../../../types';

interface PackageModalProps {
  isOpen: boolean;
  mode: 'add' | 'rename';
  packages: { id: string; name: string; description?: string }[];
  activeId: string;
  initialName?: string;
  initialDescription?: string;
  descriptionTemplates: PackageDescriptionTemplate[];
  onClose: () => void;
  onSubmit: (name: string, description: string, sourceId?: string) => void;
  onSaveTemplate: (name: string, description: string) => void;
}

export const PackageModal: React.FC<PackageModalProps> = ({
  isOpen, mode, packages, activeId, initialName, initialDescription,
  descriptionTemplates, onClose, onSubmit, onSaveTemplate,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName || '');
  const [description, setDescription] = useState('');
  const [sourceId, setSourceId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Reset fields whenever the modal opens. In add mode, default "Start from" to the
  // active package and seed the description from it; in rename mode, seed from initialDescription.
  useEffect(() => {
    if (isOpen) {
      setName(initialName || '');
      setError(null);
      setSavingTemplate(false);
      setTemplateName('');
      if (mode === 'add') {
        setSourceId(activeId || '');
        setDescription(packages.find(p => p.id === activeId)?.description || '');
      } else {
        setSourceId('');
        setDescription(initialDescription || '');
      }
    }
  }, [isOpen, initialName, initialDescription, mode, activeId, packages]);

  const title = mode === 'add' ? t('packageModal.addTitle') : t('packageModal.renameTitle');
  const submitLabel = mode === 'add' ? t('packageModal.create') : t('packageModal.save');

  const sourceOptions = [
    { label: t('packageModal.blank'), value: '' },
    ...packages.map(p => ({ label: p.name, value: p.id })),
  ];

  const templateOptions = [
    { label: t('packageModal.chooseTemplate'), value: '' },
    ...descriptionTemplates.map(tpl => ({ label: tpl.name, value: tpl.id })),
  ];

  const handleNameChange = (val: string) => {
    setName(val);
    if (error) setError(null);
  };

  const handleSourceChange = (val: string) => {
    setSourceId(val);
    if (mode === 'add') setDescription(packages.find(p => p.id === val)?.description || '');
  };

  const handlePickTemplate = (id: string) => {
    const tpl = descriptionTemplates.find(x => x.id === id);
    if (tpl) setDescription(tpl.description);
  };

  const handleSaveTemplate = () => {
    const tn = templateName.trim();
    if (!tn || !description.trim()) return;
    onSaveTemplate(tn, description);
    setSavingTemplate(false);
    setTemplateName('');
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('packageModal.nameRequired'));
      return;
    }
    onSubmit(trimmed, description, sourceId || undefined);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-6">
        <div>
          <TextInput
            label={t('packageModal.nameLabel')}
            ariaLabel="Package name"
            placeholder={t('packageModal.namePlaceholder')}
            value={name}
            onChange={handleNameChange}
          />
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
          )}
        </div>

        <div>
          <TextArea
            label={t('packageModal.descriptionLabel')}
            ariaLabel="Description"
            placeholder={t('packageModal.descriptionPlaceholder')}
            value={description}
            onChange={setDescription}
            rows={4}
          />
          <div className="flex items-end gap-2 mt-2">
            <div className="flex-1">
              <Select
                ariaLabel="Use template"
                value=""
                onChange={handlePickTemplate}
                options={templateOptions}
              />
            </div>
            <Button variant="secondary" onClick={() => setSavingTemplate(s => !s)}>
              {t('packageModal.saveAsTemplate')}
            </Button>
          </div>
          {savingTemplate && (
            <div className="flex items-end gap-2 mt-2">
              <div className="flex-1">
                <TextInput
                  label={t('packageModal.templateNameLabel')}
                  ariaLabel="Template name"
                  placeholder={t('packageModal.templateNamePlaceholder')}
                  value={templateName}
                  onChange={setTemplateName}
                />
              </div>
              <Button onClick={handleSaveTemplate}>{t('packageModal.saveTemplate')}</Button>
            </div>
          )}
        </div>

        {mode === 'add' && packages.length > 0 && (
          <InputGroup label={t('packageModal.startFrom')}>
            <Select
              ariaLabel="Start from"
              value={sourceId}
              onChange={handleSourceChange}
              options={sourceOptions}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('packageModal.startFromHelp')}</p>
          </InputGroup>
        )}

        <Button className="w-full justify-center" onClick={handleSubmit}>{submitLabel}</Button>
      </div>
    </Modal>
  );
};
```

Verified against `components/UI.tsx`: `Select` already forwards `ariaLabel`; `Button` accepts `variant` (`'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'`); `TextInput`/`TextArea` accept `ariaLabel` after Step 3. No further UI changes are needed here.

- [ ] **Step 5: Add template state in App.tsx**

In `App.tsx`:

Add to the import from `./constants` (line 9) `INITIAL_PACKAGE_DESCRIPTION_TEMPLATES`, and to the import from `./types` (line 5) `PackageDescriptionTemplate`.

Add state after `termsTemplates` (line 102):

```typescript
  const [packageDescriptionTemplates, setPackageDescriptionTemplates] = useState<PackageDescriptionTemplate[]>(INITIAL_PACKAGE_DESCRIPTION_TEMPLATES);
```

Pass to `<EstimateFormView>` (in the props block starting at line 387), alongside `termsTemplates`:

```tsx
                                packageDescriptionTemplates={packageDescriptionTemplates}
                                setPackageDescriptionTemplates={setPackageDescriptionTemplates}
```

- [ ] **Step 6: Wire EstimateFormView**

In `components/views/EstimateFormView.tsx`:

Add to the type import from `../../types` the `PackageDescriptionTemplate` type (find the existing import of `TermsTemplate`).

Add to `EstimateFormViewProps` (after `termsTemplates: TermsTemplate[];`, line 48):

```typescript
  packageDescriptionTemplates: PackageDescriptionTemplate[];
  setPackageDescriptionTemplates: React.Dispatch<React.SetStateAction<PackageDescriptionTemplate[]>>;
```

Add to the destructured params (after `termsTemplates,`, line 78):

```typescript
  packageDescriptionTemplates,
  setPackageDescriptionTemplates,
```

Replace `submitPackageModal` (lines 203-215) with the description-aware version:

```typescript
  const submitPackageModal = (name: string, description: string, sourceId?: string) => {
    if (packageModal.mode === 'rename') {
      setPackages(prev => prev.map(p => (p.id === activePackageId ? { ...p, name, description } : p)));
      return;
    }
    const estLike = { packages: foldActive(), activePackageId, selectedPackageId } as any;
    const next = sourceId ? addPkg(estLike, name, sourceId, description) : addPkg(estLike, name, undefined, description);
    setPackages(next.packages);
    setActivePackageId(next.activePackageId);
    const na = next.packages.find(p => p.id === next.activePackageId)!;
    setTemplateScopeIds([na.scopeId || 'scope-int']);
    loadPackageIntoForm(na);
  };

  const handleSaveDescriptionTemplate = (templateName: string, description: string) => {
    setPackageDescriptionTemplates(prev => [...prev, { id: `pdt-${Date.now()}`, name: templateName, description }]);
  };
```

Replace the `<PackageModal>` JSX (lines 1117-1125) with:

```tsx
        <PackageModal
          isOpen={packageModal.open}
          mode={packageModal.mode}
          packages={packages.map(p => ({ id: p.id, name: p.name, description: p.description }))}
          activeId={activePackageId}
          initialName={packageModal.mode === 'rename' ? (packages.find(p => p.id === activePackageId)?.name || '') : ''}
          initialDescription={packageModal.mode === 'rename' ? (packages.find(p => p.id === activePackageId)?.description || '') : ''}
          descriptionTemplates={packageDescriptionTemplates}
          onClose={() => setPackageModal(prev => ({ ...prev, open: false }))}
          onSubmit={submitPackageModal}
          onSaveTemplate={handleSaveDescriptionTemplate}
        />
```

- [ ] **Step 7: Add i18n strings**

In `i18n/catalog.ts`, add to the `en` block (near the existing `packageModal.*` keys around line 57):

```typescript
  'packageModal.descriptionLabel': 'Description',
  'packageModal.descriptionPlaceholder': 'Describe what this package includes…',
  'packageModal.chooseTemplate': 'Use a saved description…',
  'packageModal.saveAsTemplate': 'Save as template',
  'packageModal.templateNameLabel': 'Template name',
  'packageModal.templateNamePlaceholder': 'e.g. Premium Interior',
  'packageModal.saveTemplate': 'Save template',
```

Add the same keys to the `es` block (near the Spanish `packageModal.*` keys around line 184):

```typescript
  'packageModal.descriptionLabel': 'Descripción',
  'packageModal.descriptionPlaceholder': 'Describe lo que incluye este paquete…',
  'packageModal.chooseTemplate': 'Usar una descripción guardada…',
  'packageModal.saveAsTemplate': 'Guardar como plantilla',
  'packageModal.templateNameLabel': 'Nombre de la plantilla',
  'packageModal.templateNamePlaceholder': 'p. ej. Interior Premium',
  'packageModal.saveTemplate': 'Guardar plantilla',
```

- [ ] **Step 8: Run the modal tests and the full suite**

Run: `npx vitest run components/views/EstimateForm/PackageModal.test.tsx`
Expected: PASS

Run: `npm test`
Expected: PASS (no regressions; confirms the `onSubmit` signature change didn't break other callers).

- [ ] **Step 9: Commit**

```bash
git add components/UI.tsx components/views/EstimateForm/PackageModal.tsx components/views/EstimateForm/PackageModal.test.tsx components/views/EstimateFormView.tsx App.tsx i18n/catalog.ts
git commit -m "feat(estimate): package description box with template picker and save"
```

---

## Task 3: Render the description on the client proposal

**Files:**
- Modify: `services/estimatePreview.ts` (add `packageDescription`)
- Modify: `components/views/ClientEstimatePreview.tsx` (destructure + render)
- Modify: `i18n/catalog.ts` (label string, en + es)
- Test: `services/estimatePreview.test.ts`, `components/views/ClientEstimatePreview.test.tsx`

**Interfaces:**
- Consumes: `Package.description` from Task 1.
- Produces: preview data key `packageDescription: string`.

- [ ] **Step 1: Write the failing preview-data test**

Append to `services/estimatePreview.test.ts`:

```typescript
it('includes the package description as packageDescription', () => {
  const withDesc = { ...pkg, description: 'Premium repaint' } as Package;
  const data = buildPackagePreviewData(withDesc, ctx);
  expect(data.packageDescription).toBe('Premium repaint');
});

it('defaults packageDescription to empty string when missing', () => {
  const data = buildPackagePreviewData(pkg, ctx);
  expect(data.packageDescription).toBe('');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run services/estimatePreview.test.ts`
Expected: FAIL — `packageDescription` is `undefined`.

- [ ] **Step 3: Add packageDescription to the preview builder**

In `services/estimatePreview.ts`, in the object returned by `buildPackagePreviewData`, add after the `description: ctx.description,` line (line 29):

```typescript
    packageDescription: pkg.description || '',
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run services/estimatePreview.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing render test**

Append a test to `components/views/ClientEstimatePreview.test.tsx`. First inspect the top of that file for the existing `baseProps`/`previewPackages` shape and reuse it. Add:

```tsx
it('renders the package description when present', () => {
  const data = { ...baseProps.data, packageDescription: 'Two coats, premium paint' };
  render(<ClientEstimatePreview {...baseProps} data={data} />);
  expect(screen.getByText('Two coats, premium paint')).toBeInTheDocument();
});
```

If `baseProps` in that file does not already carry a `data` object with the fields the component destructures (line 70), build a minimal `data` object in the test that includes `packageDescription` plus the existing required keys used by `baseProps`. Match the existing test's construction style.

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run components/views/ClientEstimatePreview.test.tsx`
Expected: FAIL — description text not rendered.

- [ ] **Step 7: Render the description in the preview**

In `components/views/ClientEstimatePreview.tsx`:

Add `packageDescription` to the destructure on line 70:

```tsx
  const { customer, jobAddress, projectInfo, salesman, layout, areas, lineItems, notes, finalize, financials, paintColors, materials, sundries, settings, rates, tierSelections, pricingMethod, formTitle, packageDescription } = viewData;
```

Add a render block inside the header, immediately after the subtext paragraph (after line 616, before the closing `</div>` of the centered header block on line 617):

```tsx
                {packageDescription && (
                    <p className="text-gray-600 text-sm md:text-base max-w-2xl mx-auto mt-4 leading-relaxed">{packageDescription}</p>
                )}
```

(The label string `views.ClientEstimatePreview.*` is optional here since the description renders as a standalone paragraph; no new i18n key is required for this block. If a heading is wanted later it can be added, but YAGNI for now.)

- [ ] **Step 8: Run to verify it passes, then the full suite**

Run: `npx vitest run components/views/ClientEstimatePreview.test.tsx`
Expected: PASS

Run: `npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add services/estimatePreview.ts services/estimatePreview.test.ts components/views/ClientEstimatePreview.tsx components/views/ClientEstimatePreview.test.tsx
git commit -m "feat(estimate): show package description on the client proposal"
```

---

## Task 4: Manage description templates in Settings

**Files:**
- Create: `components/settings/PackageDescriptionManagerView.tsx`
- Modify: `components/settings/SettingsPage.tsx` (props, handlers, modal, pass-through)
- Modify: `components/settings/SettingsLayout.tsx` (view type, nav item, props, render switch)
- Modify: `App.tsx` (pass template state to `SettingsPage`)
- Modify: `i18n/catalog.ts` (manager + nav strings, en + es)
- Test: `components/settings/PackageDescriptionManagerView.test.tsx`

**Interfaces:**
- Consumes: `PackageDescriptionTemplate`, the `packageDescriptionTemplates`/`setPackageDescriptionTemplates` state from Task 2's App changes.
- Produces: a Settings nav view `'package-descriptions'` with add/edit/delete CRUD.

- [ ] **Step 1: Write the failing manager-view test**

Create `components/settings/PackageDescriptionManagerView.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PackageDescriptionManagerView } from './PackageDescriptionManagerView';

const templates = [
  { id: 'pdt-1', name: 'Premium Interior', description: 'Premium blurb' },
  { id: 'pdt-2', name: 'Exterior', description: 'Exterior blurb' },
];

describe('PackageDescriptionManagerView', () => {
  it('renders each template name', () => {
    render(<PackageDescriptionManagerView templates={templates} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Premium Interior')).toBeInTheDocument();
    expect(screen.getByText('Exterior')).toBeInTheDocument();
  });

  it('fires onAdd when the add button is clicked', () => {
    const onAdd = vi.fn();
    render(<PackageDescriptionManagerView templates={templates} onAdd={onAdd} onEdit={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /add description/i }));
    expect(onAdd).toHaveBeenCalled();
  });

  it('filters by search term', () => {
    render(<PackageDescriptionManagerView templates={templates} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Exterior' } });
    expect(screen.queryByText('Premium Interior')).not.toBeInTheDocument();
    expect(screen.getByText('Exterior')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/settings/PackageDescriptionManagerView.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the manager view**

Create `components/settings/PackageDescriptionManagerView.tsx` (modeled on `TermsManagerView.tsx`):

```tsx
import React, { useState, useMemo } from 'react';
import { Plus, FileText } from 'lucide-react';
import { Card, Button, KebabMenu, SearchInput } from '../UI';
import { PackageDescriptionTemplate } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface PackageDescriptionManagerViewProps {
  templates: PackageDescriptionTemplate[];
  onAdd: () => void;
  onEdit: (t: PackageDescriptionTemplate) => void;
  onDelete: (id: string) => void;
}

export const PackageDescriptionManagerView = ({ templates, onAdd, onEdit, onDelete }: PackageDescriptionManagerViewProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTemplates = useMemo(() => {
    return templates.filter(tpl =>
      tpl.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [templates, searchTerm]);

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.PackageDescriptionManagerView.heading')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.PackageDescriptionManagerView.subheading')}</p>
        </div>
        <Button onClick={onAdd} className="shadow-lg shadow-primary-500/20 flex items-center w-full md:w-auto justify-center">
          <Plus className="w-5 h-5 mr-2" /> {t('settings.PackageDescriptionManagerView.addDescription')}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('settings.PackageDescriptionManagerView.searchPlaceholder')} className="md:max-w-md w-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {filteredTemplates.map(template => (
          <Card key={template.id} className="p-6 md:p-8 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 border-0 shadow-lg relative group bg-white dark:bg-gray-800">
            <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
              <KebabMenu onEdit={() => onEdit(template)} onDelete={() => onDelete(template.id)} />
            </div>
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{template.name}</h3>
            </div>
            <div className="text-base text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-gray-700 pt-4 whitespace-pre-line line-clamp-6">
              {template.description}
            </div>
          </Card>
        ))}

        {filteredTemplates.length === 0 && (
          <div className="col-span-full text-center py-16 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400 dark:text-gray-500">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('settings.PackageDescriptionManagerView.emptyHeading')}</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">{t('settings.PackageDescriptionManagerView.emptyBody')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Add i18n strings**

In `i18n/catalog.ts`, add to the `en` block:

```typescript
  'settings.PackageDescriptionManagerView.heading': 'Package Descriptions',
  'settings.PackageDescriptionManagerView.subheading': 'Reusable descriptions you can drop into any package.',
  'settings.PackageDescriptionManagerView.addDescription': 'Add Description',
  'settings.PackageDescriptionManagerView.searchPlaceholder': 'Search descriptions…',
  'settings.PackageDescriptionManagerView.emptyHeading': 'No saved descriptions yet',
  'settings.PackageDescriptionManagerView.emptyBody': 'Add one here or save a description as a template from a package.',
  'settings.SettingsLayout.packageDescriptions': 'Package Descriptions',
  'settings.SettingsPage.editPackageDescription': 'Edit Package Description',
  'settings.SettingsPage.descriptionContent': 'Description',
  'settings.SettingsPage.savePackageDescription': 'Save Description',
```

Add to the `es` block:

```typescript
  'settings.PackageDescriptionManagerView.heading': 'Descripciones de Paquetes',
  'settings.PackageDescriptionManagerView.subheading': 'Descripciones reutilizables que puedes agregar a cualquier paquete.',
  'settings.PackageDescriptionManagerView.addDescription': 'Agregar Descripción',
  'settings.PackageDescriptionManagerView.searchPlaceholder': 'Buscar descripciones…',
  'settings.PackageDescriptionManagerView.emptyHeading': 'Aún no hay descripciones guardadas',
  'settings.PackageDescriptionManagerView.emptyBody': 'Agrega una aquí o guarda una descripción como plantilla desde un paquete.',
  'settings.SettingsLayout.packageDescriptions': 'Descripciones de Paquetes',
  'settings.SettingsPage.editPackageDescription': 'Editar Descripción de Paquete',
  'settings.SettingsPage.descriptionContent': 'Descripción',
  'settings.SettingsPage.savePackageDescription': 'Guardar Descripción',
```

The `templateName` label string (`settings.SettingsPage.templateName`) already exists and is reused by the modal in Step 6.

- [ ] **Step 5: Run the manager test to verify it passes**

Run: `npx vitest run components/settings/PackageDescriptionManagerView.test.tsx`
Expected: PASS

- [ ] **Step 6: Wire SettingsPage handlers, modal, and props**

In `components/settings/SettingsPage.tsx`:

Add `PackageDescriptionTemplate` to the type import from `../../types` (near `TermsTemplate`).

Add to the props interface (after `setTermsTemplates`, around line 24):

```typescript
  packageDescriptionTemplates: PackageDescriptionTemplate[];
  setPackageDescriptionTemplates: React.Dispatch<React.SetStateAction<PackageDescriptionTemplate[]>>;
```

Add to the destructure of `props` (line 54):

```typescript
  const { settings, setSettings, rates, setRates, lineItemTemplates, setLineItemTemplates, termsTemplates, setTermsTemplates, packageDescriptionTemplates, setPackageDescriptionTemplates, materials, setMaterials } = props;
```

Add modal state near the terms modal state (around line 78-80):

```typescript
  const [isPkgDescModalOpen, setIsPkgDescModalOpen] = useState(false);
  const [editingPkgDescId, setEditingPkgDescId] = useState<string | null>(null);
  const [pkgDescData, setPkgDescData] = useState<Partial<PackageDescriptionTemplate>>({});
```

Add handlers near `handleSaveTerms`/`handleDeleteTerms` (around line 256-277):

```typescript
  const handleAddPkgDesc = () => {
      setEditingPkgDescId(null);
      setPkgDescData({ name: '', description: '' });
      setIsPkgDescModalOpen(true);
  };
  const handleEditPkgDesc = (t: PackageDescriptionTemplate) => {
      setEditingPkgDescId(t.id);
      setPkgDescData(t);
      setIsPkgDescModalOpen(true);
  };
  const handleSavePkgDesc = () => {
      if (!pkgDescData.name) return;
      const newItem = { ...pkgDescData, id: editingPkgDescId || `pdt-${Date.now()}` } as PackageDescriptionTemplate;
      const list = editingPkgDescId
        ? packageDescriptionTemplates.map(t => t.id === editingPkgDescId ? newItem : t)
        : [...packageDescriptionTemplates, newItem];
      setPackageDescriptionTemplates(list);
      setIsPkgDescModalOpen(false);
  };
  const handleDeletePkgDesc = (id: string) => {
      setPackageDescriptionTemplates(packageDescriptionTemplates.filter(t => t.id !== id));
  };
```

Pass the new props down to `<SettingsLayout>` (near where `onAddTerms`/`onEditTerms`/`onDeleteTerms` are passed, around line 427-429):

```tsx
        packageDescriptionTemplates={packageDescriptionTemplates}
        onAddPkgDesc={handleAddPkgDesc}
        onEditPkgDesc={handleEditPkgDesc}
        onDeletePkgDesc={handleDeletePkgDesc}
```

Add the edit modal next to the terms modal (around line 683-688):

```tsx
      <Modal isOpen={isPkgDescModalOpen} onClose={() => setIsPkgDescModalOpen(false)} title={t('settings.SettingsPage.editPackageDescription')}>
          <div className="space-y-4">
              <TextInput label={t('settings.SettingsPage.templateName')} value={pkgDescData.name || ''} onChange={(v) => setPkgDescData({...pkgDescData, name: v})} />
              <TextArea label={t('settings.SettingsPage.descriptionContent')} value={pkgDescData.description || ''} onChange={(v) => setPkgDescData({...pkgDescData, description: v})} rows={8} />
              <Button className="w-full mt-4" onClick={handleSavePkgDesc}>{t('settings.SettingsPage.savePackageDescription')}</Button>
          </div>
      </Modal>
```

(Match the exact wrapping markup the terms modal uses in this file — confirm whether it wraps the fields in a `<div className="space-y-4">` or similar and mirror it.)

- [ ] **Step 7: Wire SettingsLayout nav + render**

In `components/settings/SettingsLayout.tsx`:

Add `PackageDescriptionTemplate` to the type import from `../../types` (line 8).

Import the manager view (after line 16):

```typescript
import { PackageDescriptionManagerView } from './PackageDescriptionManagerView';
```

Add `'package-descriptions'` to the `SettingsViewType` union (line 34), e.g. after `'terms'`:

```typescript
... | 'terms' | 'package-descriptions' | 'tax-regions' | ...
```

Add props to the props interface (near `onAddTerms`/`onEditTerms`/`onDeleteTerms`, lines 84-86):

```typescript
  packageDescriptionTemplates: PackageDescriptionTemplate[];
  onAddPkgDesc: () => void;
  onEditPkgDesc: (t: PackageDescriptionTemplate) => void;
  onDeletePkgDesc: (id: string) => void;
```

Add a nav item right after the `terms` item (line 167):

```typescript
    { id: 'package-descriptions', label: t('settings.SettingsLayout.packageDescriptions'), icon: FileText },
```

(`FileText` is already imported in this file — confirm; it is used by the `line-items` item.)

Add a render branch after the `terms` branch (after line 393):

```tsx
        {activeView === 'package-descriptions' && (
          <PackageDescriptionManagerView
            templates={props.packageDescriptionTemplates}
            onAdd={props.onAddPkgDesc}
            onEdit={props.onEditPkgDesc}
            onDelete={props.onDeletePkgDesc}
          />
        )}
```

- [ ] **Step 8: Pass template state from App.tsx to SettingsPage**

In `App.tsx`, in the `<SettingsPage>` props block (around line 535-538, next to `termsTemplates`/`setTermsTemplates`):

```tsx
                                packageDescriptionTemplates={packageDescriptionTemplates}
                                setPackageDescriptionTemplates={setPackageDescriptionTemplates}
```

(The `packageDescriptionTemplates` state was added to `App.tsx` in Task 2, Step 4.)

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS — manager view test passes and no regressions.

- [ ] **Step 10: Commit**

```bash
git add components/settings/PackageDescriptionManagerView.tsx components/settings/PackageDescriptionManagerView.test.tsx components/settings/SettingsPage.tsx components/settings/SettingsLayout.tsx App.tsx i18n/catalog.ts
git commit -m "feat(settings): CRUD for package description templates"
```

---

## Final verification

- [ ] Run the full test suite: `npm test` → all pass.
- [ ] Manual smoke test (`npm run dev`):
  - Open an estimate, enable packages, click **Add** → the dialog shows a Description box, a "Use a saved description…" picker, and "Save as template".
  - Pick a template → description fills. Type a description, "Save as template", give it a name → it appears in the picker.
  - **Rename** an existing package → its description pre-fills and edits persist.
  - Switch to the client preview → the package description shows under the heading.
  - Settings → **Package Descriptions** → add / edit / delete a template; confirm the picker in the package dialog reflects changes.
