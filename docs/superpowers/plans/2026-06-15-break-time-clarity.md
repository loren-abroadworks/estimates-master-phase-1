# Break Time Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare time input in both break editors with an explicit "At a set time / Anytime" choice so the flexible (no-time) state is unambiguous.

**Architecture:** Add one small reusable presentational component, `BreakTimeField`, that renders a two-option segmented control plus a conditional `TimeInput`. Swap it into the company-default editor (`SchedulingConfigView`) and the per-day editor (`BreakEditorModal`). No data-model, resolution, or hours-math changes. `CrewBreak.startTime` stays `string | undefined`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest + @testing-library/react, custom dotted-key i18n (`i18n/catalog.ts`).

---

## File Structure

- `i18n/catalog.ts` (modify) — add three new shared keys + override the now-redundant hint, in both `enManual` and `esManual`.
- `components/views/JobScheduling/BreakTimeField.tsx` (create) — the reusable field.
- `components/views/JobScheduling/BreakTimeField.test.tsx` (create) — unit tests.
- `components/views/JobScheduling/BreakEditorModal.tsx` (modify) — use `BreakTimeField` at the per-day editor.
- `components/settings/SchedulingConfigView.tsx` (modify) — use `BreakTimeField` at the company-default editor; simplify the hint.

---

## Task 1: Add i18n keys

**Files:**
- Modify: `i18n/catalog.ts` (`enManual` starts line 10; `esManual` starts line 115)

The catalog-integrity test enforces that `en` and `es` have identical key sets, so every new key must be added to BOTH blocks. `enManual`/`esManual` override the generated catalog, so adding `flexibleBreakHint` here replaces the old generated text without regenerating.

- [ ] **Step 1: Add the English keys**

In `i18n/catalog.ts`, inside the `enManual` object (after the opening `const enManual: TranslationCatalog = {` on line 10), add:

```ts
  // --- Break time field (shared by SchedulingConfigView + BreakEditorModal) ---
  'views.JobScheduling.BreakTimeField.timeLabel': 'Time',
  'views.JobScheduling.BreakTimeField.atSetTime': 'At a set time',
  'views.JobScheduling.BreakTimeField.anytime': 'Anytime',
  // Override the old "leave it empty" hint now that the choice is explicit:
  'settings.SchedulingConfigView.flexibleBreakHint': 'Set a time, or choose Anytime for a flexible break.',
```

- [ ] **Step 2: Add the Spanish keys**

Inside the `esManual` object (after `const esManual: TranslationCatalog = {` on line 115), add:

```ts
  // --- Break time field (shared by SchedulingConfigView + BreakEditorModal) ---
  'views.JobScheduling.BreakTimeField.timeLabel': 'Hora',
  'views.JobScheduling.BreakTimeField.atSetTime': 'A una hora fija',
  'views.JobScheduling.BreakTimeField.anytime': 'En cualquier momento',
  // Override the old "leave it empty" hint now that the choice is explicit:
  'settings.SchedulingConfigView.flexibleBreakHint': 'Fija una hora o elige En cualquier momento para un descanso flexible.',
```

- [ ] **Step 3: Run the i18n tests to verify parity holds**

Run: `npx vitest run i18n`
Expected: PASS (no en/es key-mismatch failures).

- [ ] **Step 4: Commit**

```bash
git add i18n/catalog.ts
git commit -m "i18n(scheduling): add break time field keys, simplify flexible hint"
```

---

## Task 2: Create the `BreakTimeField` component (TDD)

**Files:**
- Create: `components/views/JobScheduling/BreakTimeField.tsx`
- Test: `components/views/JobScheduling/BreakTimeField.test.tsx`

`useTranslation` resolves to real English strings in tests (see existing `SingleJobEditor.test.tsx`), so tests can query by visible label text. The rendered `TimeInput` produces an `<input type="time">`, which the tests use as the "is the picker showing" signal.

- [ ] **Step 1: Write the failing test**

Create `components/views/JobScheduling/BreakTimeField.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BreakTimeField } from './BreakTimeField';

const timeInput = (c: HTMLElement) => c.querySelector('input[type="time"]');

describe('BreakTimeField', () => {
  it('shows Anytime selected and hides the time picker when value is undefined', () => {
    const { container } = render(<BreakTimeField value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Anytime' })).toBeInTheDocument();
    expect(timeInput(container)).toBeNull();
  });

  it('shows the time picker with the value when a time is set', () => {
    const { container } = render(<BreakTimeField value="12:30" onChange={vi.fn()} />);
    const input = timeInput(container) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('12:30');
  });

  it('emits 12:00 when switching from Anytime to a set time', () => {
    const onChange = vi.fn();
    render(<BreakTimeField value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'At a set time' }));
    expect(onChange).toHaveBeenCalledWith('12:00');
  });

  it('emits undefined when switching to Anytime', () => {
    const onChange = vi.fn();
    render(<BreakTimeField value="12:30" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anytime' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('normalizes a cleared time input to undefined', () => {
    const onChange = vi.fn();
    const { container } = render(<BreakTimeField value="12:30" onChange={onChange} />);
    fireEvent.change(timeInput(container) as HTMLInputElement, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/BreakTimeField.test.tsx`
Expected: FAIL — cannot resolve `./BreakTimeField` (module does not exist yet).

- [ ] **Step 3: Write the component**

Create `components/views/JobScheduling/BreakTimeField.tsx`:

```tsx
import React from 'react';
import { TimeInput } from '../../UI';
import { Typography } from '../../../theme/designSystem';
import { useTranslation } from '@/i18n/LanguageContext';

interface BreakTimeFieldProps {
  /** 'HH:mm' = fixed time; undefined/'' = flexible (anytime). */
  value: string | undefined;
  onChange: (val: string | undefined) => void;
  step?: number;
}

const DEFAULT_TIME = '12:00';

export const BreakTimeField = ({ value, onChange, step = 300 }: BreakTimeFieldProps) => {
  const { t } = useTranslation();
  const hasTime = !!value;

  const segBtn = (active: boolean) =>
    `flex-1 py-2 px-3 rounded-lg text-sm font-bold border transition-colors ${
      active
        ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
        : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
    }`;

  return (
    <div className="flex flex-col gap-2 w-full">
      <span className={Typography.label}>{t('views.JobScheduling.BreakTimeField.timeLabel')}</span>
      <div className="flex gap-2">
        <button
          type="button"
          className={segBtn(hasTime)}
          onClick={() => onChange(value || DEFAULT_TIME)}
        >
          {t('views.JobScheduling.BreakTimeField.atSetTime')}
        </button>
        <button
          type="button"
          className={segBtn(!hasTime)}
          onClick={() => onChange(undefined)}
        >
          {t('views.JobScheduling.BreakTimeField.anytime')}
        </button>
      </div>
      {hasTime && (
        <TimeInput value={value} step={step} onChange={(v) => onChange(v || undefined)} />
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/BreakTimeField.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/BreakTimeField.tsx components/views/JobScheduling/BreakTimeField.test.tsx
git commit -m "feat(scheduling): add BreakTimeField with explicit set-time/anytime choice"
```

---

## Task 3: Use `BreakTimeField` in the per-day editor

**Files:**
- Modify: `components/views/JobScheduling/BreakEditorModal.tsx` (import line 3; usage line 56)

- [ ] **Step 1: Add the import**

In `components/views/JobScheduling/BreakEditorModal.tsx`, line 3 currently is:

```tsx
import { Button, TextInput, Toggle, NumberInput, TimeInput } from '../../UI';
```

Remove the now-unused `TimeInput` from that import and add the new component below it:

```tsx
import { Button, TextInput, Toggle, NumberInput } from '../../UI';
import { BreakTimeField } from './BreakTimeField';
```

- [ ] **Step 2: Swap the field**

Replace the `<div className="w-36">…</div>` block at lines 55–57:

```tsx
              <div className="w-36">
                <TimeInput label={t('views.JobScheduling.BreakEditorModal.labelTime')} step={300} value={b.startTime} onChange={(v) => patch(b.id, { startTime: v || undefined })} />
              </div>
```

with:

```tsx
              <div className="w-48">
                <BreakTimeField value={b.startTime} onChange={(v) => patch(b.id, { startTime: v })} />
              </div>
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run lint`
Expected: PASS (no TypeScript errors; the `t('…labelTime')` key is no longer referenced here, which is fine — leaving the unused catalog entry is harmless).

- [ ] **Step 4: Commit**

```bash
git add components/views/JobScheduling/BreakEditorModal.tsx
git commit -m "feat(scheduling): use BreakTimeField in per-day break editor"
```

---

## Task 4: Use `BreakTimeField` in the company-default editor + simplify hint

**Files:**
- Modify: `components/settings/SchedulingConfigView.tsx` (usage line 132; hint line 144; import of `TimeInput`)

Note: `SchedulingConfigView` also uses `TimeInput` for workday start/end (lines 107–108), so do NOT remove the `TimeInput` import here.

- [ ] **Step 1: Add the import**

Add to the imports at the top of `components/settings/SchedulingConfigView.tsx` (next to the other JobScheduling-area component imports; if none exist, add a standalone import):

```tsx
import { BreakTimeField } from '../views/JobScheduling/BreakTimeField';
```

- [ ] **Step 2: Swap the field**

Replace the `<div className="w-36">…</div>` block at lines 131–133:

```tsx
                <div className="w-36">
                  <TimeInput label={t('settings.SchedulingConfigView.breakTime')} step={300} value={b.startTime} onChange={(v) => updateBreak(b.id, { startTime: v || undefined })} />
                </div>
```

with:

```tsx
                <div className="w-48">
                  <BreakTimeField value={b.startTime} onChange={(v) => updateBreak(b.id, { startTime: v })} />
                </div>
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run lint`
Expected: PASS. (The `flexibleBreakHint` text was already updated in Task 1; the JSX at line 144 still references the same key, so no JSX change is needed there. The `breakTime` key is no longer referenced here — harmless.)

- [ ] **Step 4: Commit**

```bash
git add components/settings/SchedulingConfigView.tsx
git commit -m "feat(scheduling): use BreakTimeField in company default break editor"
```

---

## Task 5: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS (all suites, including i18n integrity and the new `BreakTimeField` tests).

- [ ] **Step 2: Typecheck**

Run: `npm run lint`
Expected: PASS (no TypeScript errors).

- [ ] **Step 3: Manual smoke check (optional)**

Run: `npm run dev`, open Settings → Scheduling. Confirm each company break shows an "At a set time / Anytime" toggle; choosing Anytime hides the picker; choosing "At a set time" shows it defaulting to 12:00. Repeat in Job Scheduling → Assign Hours → Edit breaks.

---

## Self-Review Notes

- **Spec coverage:** new component (Task 2) ✓; both editors wired (Tasks 3, 4) ✓; i18n + simplified hint (Task 1) ✓; tests (Task 2) ✓; no data-model change ✓; default `12:00` ✓.
- **Type consistency:** `BreakTimeField` prop `onChange: (val: string | undefined) => void` matches both call sites, which pass the value straight into `patch`/`updateBreak` as `startTime`. Empty-string→`undefined` normalization is centralized in the component.
