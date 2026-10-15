# Crew Transfer Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the crew-add dropdown/roster in `CrewSelectionModal` with a full-modal, two-panel transfer picker (Available left, Added right) triggered by clicking the search bar, in both modal modes.

**Architecture:** A new presentational `CrewTransferPicker` component renders the search + two panels + Done footer and delegates every state change to callbacks. `CrewSelectionModal` gains a `showPicker` boolean; clicking the search bar opens the picker as a full-body takeover, wiring its callbacks to the existing `addMember` / `removeMember` / `setLeaderId` handlers. No data-model or `onSave` changes.

**Tech Stack:** React 19, TypeScript, Vite, Vitest + Testing Library, Tailwind, lucide-react icons, project i18n (`useTranslation`).

## Global Constraints

- **i18n:** All user-facing copy goes through `t('...')`. Every new `en` key MUST also exist in `es` — `i18n/translate.test.ts` fails otherwise. Add keys to `enManual` **and** `esManual` in `i18n/catalog.ts`.
- **Key naming:** `<area>.<component>.<descriptor>`, e.g. `modals.CrewSelectionModal.available`.
- **Import alias:** Use `@/i18n/LanguageContext` for the translation hook (matches the modal).
- **Tests run with:** `npm test` (vitest run). No LanguageProvider is needed in tests — `translate` falls back to English.
- **Capacity math:** Reuse `computeWeeklyHours(member, weekDays, existingJobs, { standardDay, excludeJobId, weekendDays })` from `services/crewWeeklyHours.ts` — do not reimplement.

---

### Task 1: Add i18n keys for the picker

**Files:**
- Modify: `i18n/catalog.ts` (`enManual` block starting line ~10; `esManual` block starting line ~161)
- Test: `i18n/translate.test.ts` (existing integrity test — no new test code)

**Interfaces:**
- Produces: translation keys `modals.CrewSelectionModal.available`, `.added`, `.add`, `.remove`, `.done`, `.noCrewAdded`, `.makeLeader` (consumed by Task 2 and Task 3).

- [ ] **Step 1: Add the English keys**

In `i18n/catalog.ts`, inside `const enManual` (add near the top of the object, after the opening brace):

```ts
  // --- Crew transfer picker (CrewSelectionModal) ---
  'modals.CrewSelectionModal.available': 'Available',
  'modals.CrewSelectionModal.added': 'Added',
  'modals.CrewSelectionModal.add': 'Add',
  'modals.CrewSelectionModal.remove': 'Remove',
  'modals.CrewSelectionModal.done': 'Done',
  'modals.CrewSelectionModal.noCrewAdded': 'No crew added yet.',
  'modals.CrewSelectionModal.makeLeader': 'Make leader',
```

- [ ] **Step 2: Add the matching Spanish keys**

In `i18n/catalog.ts`, inside `const esManual` (mirror the same block):

```ts
  // --- Crew transfer picker (CrewSelectionModal) ---
  'modals.CrewSelectionModal.available': 'Disponibles',
  'modals.CrewSelectionModal.added': 'Agregados',
  'modals.CrewSelectionModal.add': 'Agregar',
  'modals.CrewSelectionModal.remove': 'Quitar',
  'modals.CrewSelectionModal.done': 'Listo',
  'modals.CrewSelectionModal.noCrewAdded': 'Aún no se ha agregado equipo.',
  'modals.CrewSelectionModal.makeLeader': 'Hacer líder',
```

- [ ] **Step 3: Run the catalog integrity + translate tests**

Run: `npm test -- i18n/translate.test.ts`
Expected: PASS (the "en keys all exist in es" test stays green with the new keys present in both).

- [ ] **Step 4: Commit**

```bash
git add i18n/catalog.ts
git commit -m "i18n(scheduling): keys for crew transfer picker"
```

---

### Task 2: Create the `CrewTransferPicker` component

**Files:**
- Create: `components/modals/CrewTransferPicker.tsx`
- Test: `components/modals/CrewTransferPicker.test.tsx`

**Interfaces:**
- Consumes: i18n keys from Task 1; `computeWeeklyHours` from `services/crewWeeklyHours.ts`; `CrewMember`, `Job` from `types.ts`; `Button` from `components/UI`.
- Produces: `export const CrewTransferPicker` with props:
  ```ts
  interface CrewTransferPickerProps {
    allStaff: CrewMember[];
    selectedIds: string[];
    leaderId: string | null;
    weekDays: Date[];
    existingJobs: Job[];
    excludeJobId?: string;
    weekendDays: number[];
    standardDay: number;
    onAdd: (id: string) => void;
    onRemove: (id: string) => void;
    onSetLeader: (id: string) => void;
    onDone: () => void;
  }
  ```
  Accessible names it renders (relied on by Task 3 tests): a `region` named "Available", a `region` named "Added", buttons named `Add {name}`, `Remove {name}`, `Make leader {name}`, and `Done`.

- [ ] **Step 1: Write the failing test**

Create `components/modals/CrewTransferPicker.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CrewTransferPicker } from './CrewTransferPicker';
import type { CrewMember } from '../../types';

const staff: CrewMember[] = [
  { id: 'm1', name: 'Mike Smith', role: 'Owner' },
  { id: 'm2', name: 'Jessica Miller', role: 'Estimator' },
  { id: 'm3', name: 'David Chen', role: 'Painter' },
];

const baseProps = {
  allStaff: staff,
  leaderId: null as string | null,
  weekDays: [] as Date[],
  existingJobs: [],
  weekendDays: [0, 6],
  standardDay: 8,
  onAdd: vi.fn(),
  onRemove: vi.fn(),
  onSetLeader: vi.fn(),
  onDone: vi.fn(),
};

describe('CrewTransferPicker', () => {
  it('lists un-added staff on the left and added staff on the right', () => {
    render(<CrewTransferPicker {...baseProps} selectedIds={['m1']} />);
    const available = screen.getByRole('region', { name: 'Available' });
    const added = screen.getByRole('region', { name: 'Added' });
    expect(within(available).getByText('Jessica Miller')).toBeInTheDocument();
    expect(within(available).getByText('David Chen')).toBeInTheDocument();
    expect(within(available).queryByText('Mike Smith')).toBeNull();
    expect(within(added).getByText('Mike Smith')).toBeInTheDocument();
  });

  it('calls onAdd with the member id when Add is clicked', () => {
    const onAdd = vi.fn();
    render(<CrewTransferPicker {...baseProps} selectedIds={[]} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Jessica Miller' }));
    expect(onAdd).toHaveBeenCalledWith('m2');
  });

  it('calls onRemove with the member id when Remove is clicked', () => {
    const onRemove = vi.fn();
    render(<CrewTransferPicker {...baseProps} selectedIds={['m1']} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Mike Smith' }));
    expect(onRemove).toHaveBeenCalledWith('m1');
  });

  it('calls onSetLeader when the crown is clicked', () => {
    const onSetLeader = vi.fn();
    render(<CrewTransferPicker {...baseProps} selectedIds={['m1']} onSetLeader={onSetLeader} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make leader Mike Smith' }));
    expect(onSetLeader).toHaveBeenCalledWith('m1');
  });

  it('filters the available panel by the search box', () => {
    render(<CrewTransferPicker {...baseProps} selectedIds={[]} />);
    fireEvent.change(screen.getByPlaceholderText('Search to add crew member...'), { target: { value: 'jess' } });
    const available = screen.getByRole('region', { name: 'Available' });
    expect(within(available).getByText('Jessica Miller')).toBeInTheDocument();
    expect(within(available).queryByText('Mike Smith')).toBeNull();
  });

  it('shows an empty state when no crew is added', () => {
    render(<CrewTransferPicker {...baseProps} selectedIds={[]} />);
    expect(screen.getByText('No crew added yet.')).toBeInTheDocument();
  });

  it('calls onDone when Done is clicked', () => {
    const onDone = vi.fn();
    render(<CrewTransferPicker {...baseProps} selectedIds={[]} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/modals/CrewTransferPicker.test.tsx`
Expected: FAIL — "Failed to resolve import './CrewTransferPicker'" (component not created yet).

- [ ] **Step 3: Write the component**

Create `components/modals/CrewTransferPicker.tsx`:

```tsx
import React, { useState, useMemo } from 'react';
import { Search, Plus, X, Crown } from 'lucide-react';
import { CrewMember, Job } from '../../types';
import { computeWeeklyHours } from '../../services/crewWeeklyHours';
import { Button } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

interface CrewTransferPickerProps {
  allStaff: CrewMember[];
  selectedIds: string[];
  leaderId: string | null;
  weekDays: Date[];
  existingJobs: Job[];
  excludeJobId?: string;
  weekendDays: number[];
  standardDay: number;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onSetLeader: (id: string) => void;
  onDone: () => void;
}

export const CrewTransferPicker = ({
  allStaff,
  selectedIds,
  leaderId,
  weekDays,
  existingJobs,
  excludeJobId,
  weekendDays,
  standardDay,
  onAdd,
  onRemove,
  onSetLeader,
  onDone,
}: CrewTransferPickerProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const available = useMemo(
    () =>
      allStaff.filter(
        (s) =>
          !selectedIds.includes(s.id) &&
          s.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [allStaff, selectedIds, search],
  );

  const added = useMemo(
    () =>
      selectedIds
        .map((id) => allStaff.find((s) => s.id === id))
        .filter(Boolean) as CrewMember[],
    [allStaff, selectedIds],
  );

  const CapacityBadge = ({ emp }: { emp: CrewMember }) => {
    const wh = computeWeeklyHours(emp, weekDays, existingJobs, {
      standardDay,
      excludeJobId,
      weekendDays,
    });
    const full = wh.remaining <= 0;
    return (
      <div className="shrink-0 text-right">
        <div className="text-sm font-black text-gray-900 dark:text-white tabular-nums">
          {wh.assigned}
          <span className="text-gray-400 font-bold">/{wh.capacity}h</span>
        </div>
        <div className={`text-[11px] font-bold ${full ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
          {full
            ? t('modals.CrewSelectionModal.fullyBooked')
            : t('modals.CrewSelectionModal.hoursLeft', { remaining: wh.remaining })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search (filters the Available panel) */}
      <div className="relative mb-4 flex-shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('modals.CrewSelectionModal.searchPlaceholder')}
          className="w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Two panels */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* Available */}
        <section
          aria-label={t('modals.CrewSelectionModal.available')}
          className="flex flex-col border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 overflow-hidden"
        >
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {t('modals.CrewSelectionModal.available')}
            </span>
            <span className="text-xs font-bold text-gray-400">{available.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-gray-700">
            {available.map((emp) => (
              <div
                key={emp.id}
                className="p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <img src={emp.photo} className="w-9 h-9 rounded-full bg-gray-100 object-cover" alt="" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-200 truncate">{emp.name}</span>
                  <span className="text-[11px] text-gray-400 font-medium">{emp.role}</span>
                </div>
                <CapacityBadge emp={emp} />
                <button
                  aria-label={`${t('modals.CrewSelectionModal.add')} ${emp.name}`}
                  onClick={() => onAdd(emp.id)}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('modals.CrewSelectionModal.add')}
                </button>
              </div>
            ))}
            {available.length === 0 && (
              <div className="py-12 text-center text-xs text-gray-400">
                {t('modals.CrewSelectionModal.noMatchingStaff')}
              </div>
            )}
          </div>
        </section>

        {/* Added */}
        <section
          aria-label={t('modals.CrewSelectionModal.added')}
          className="flex flex-col border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 overflow-hidden"
        >
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {t('modals.CrewSelectionModal.added')}
            </span>
            <span className="text-xs font-bold text-gray-400">{added.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-gray-700">
            {added.map((emp) => {
              const isLeader = emp.id === leaderId;
              return (
                <div
                  key={emp.id}
                  className="p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <img src={emp.photo} className="w-9 h-9 rounded-full bg-gray-100 object-cover" alt="" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{emp.name}</span>
                    <span className="text-[11px] text-gray-400 font-medium">{emp.role}</span>
                  </div>
                  <CapacityBadge emp={emp} />
                  <button
                    aria-label={`${t('modals.CrewSelectionModal.makeLeader')} ${emp.name}`}
                    aria-pressed={isLeader}
                    onClick={() => onSetLeader(emp.id)}
                    className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                      isLeader
                        ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
                        : 'text-gray-300 dark:text-gray-600 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                    }`}
                  >
                    <Crown className="w-4 h-4 fill-current" />
                  </button>
                  <button
                    aria-label={`${t('modals.CrewSelectionModal.remove')} ${emp.name}`}
                    onClick={() => onRemove(emp.id)}
                    className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            {added.length === 0 && (
              <div className="py-12 text-center text-xs text-gray-400">
                {t('modals.CrewSelectionModal.noCrewAdded')}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="pt-4 mt-auto border-t border-gray-100 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
            {t('modals.CrewSelectionModal.crewSize')}
          </span>
          <span className="text-xl font-black text-gray-900 dark:text-white">{added.length}</span>
        </div>
        <Button onClick={onDone} className="shadow-lg shadow-primary-500/20">
          {t('modals.CrewSelectionModal.done')}
        </Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/modals/CrewTransferPicker.test.tsx`
Expected: PASS (all 7 tests green).

- [ ] **Step 5: Commit**

```bash
git add components/modals/CrewTransferPicker.tsx components/modals/CrewTransferPicker.test.tsx
git commit -m "feat(scheduling): CrewTransferPicker two-panel crew picker"
```

---

### Task 3: Wire the picker into `CrewSelectionModal` (both modes)

**Files:**
- Modify: `components/modals/CrewSelectionModal.tsx`
- Test: `components/modals/CrewSelectionModal.test.tsx`

**Interfaces:**
- Consumes: `CrewTransferPicker` from Task 2 (`./CrewTransferPicker`) and its props contract.
- Produces: no exported API change — `CrewSelectionModal`'s props and `onSave` payload are unchanged.

- [ ] **Step 1: Write the failing tests**

In `components/modals/CrewSelectionModal.test.tsx`, add `within` to the import on line 3:

```tsx
import { render, screen, fireEvent, within } from '@testing-library/react';
```

Then append this describe block at the end of the file:

```tsx
describe('CrewSelectionModal — transfer picker', () => {
  const openPicker = () =>
    fireEvent.click(screen.getByPlaceholderText('Search to add crew member...'));

  it('opens the two-panel picker when the search bar is clicked', () => {
    render(<CrewSelectionModal {...base} currentCrew={[]} />);
    openPicker();
    expect(screen.getByRole('region', { name: 'Available' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Added' })).toBeInTheDocument();
  });

  it('moves a member into the Added panel via Add', () => {
    render(<CrewSelectionModal {...base} currentCrew={[]} />);
    openPicker();
    const added = screen.getByRole('region', { name: 'Added' });
    expect(within(added).queryByText('Mike Smith')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Mike Smith' }));
    expect(within(added).getByText('Mike Smith')).toBeInTheDocument();
  });

  it('returns to the main scheduling view when Done is clicked', () => {
    render(
      <CrewSelectionModal
        {...base}
        currentCrew={[]}
        jobStartDate="2026-06-08T08:00:00"
        jobEndDate="2026-06-08T17:00:00"
      />,
    );
    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('region', { name: 'Available' })).toBeNull();
    expect(screen.getByText('Hours Per Day')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- components/modals/CrewSelectionModal.test.tsx`
Expected: FAIL — clicking the search bar does not render an "Available" region yet (`getByRole('region', { name: 'Available' })` throws).

- [ ] **Step 3: Import the picker and add `showPicker` state**

In `components/modals/CrewSelectionModal.tsx`, add the import after the existing UI import (line ~4):

```tsx
import { CrewTransferPicker } from './CrewTransferPicker';
```

Replace the dropdown state (line ~71) — change:

```tsx
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
```

to:

```tsx
  const [showPicker, setShowPicker] = useState(false);
```

- [ ] **Step 4: Remove the click-outside effect and reset flags**

Delete the click-outside `useEffect` (lines ~103–111, the block that references `dropdownRef` and `setIsDropdownOpen`).

In the `isOpen` effect (line ~150–151), replace:

```tsx
      setSearchTerm('');
      setIsDropdownOpen(false);
```

with:

```tsx
      setSearchTerm('');
      setShowPicker(false);
```

- [ ] **Step 5: Turn the search bar into the picker trigger and swap the body**

Replace the entire "ADD MEMBER BAR" block (lines ~502–532, the `<div className="relative mb-4 ..." ref={dropdownRef}>` … `</div>` including the dropdown) with:

```tsx
        {/* --- MIDDLE: ADD MEMBER BAR (opens the transfer picker) --- */}
        <div className="relative mb-4 flex-shrink-0">
            <div onClick={() => setShowPicker(true)}>
                <SearchInput
                    value={searchTerm}
                    onChange={() => setShowPicker(true)}
                    placeholder={t('modals.CrewSelectionModal.searchPlaceholder')}
                    className="w-full"
                />
            </div>
        </div>
```

Then remove the simplified inline roster block entirely — the `{simplified && ( <> ... </> )}` block at lines ~534–573 (the `Select Crew` label, the roster `<div className="max-h-[26vh] ...">`, and the trailing `Hours Per Day` label). The `Hours Per Day` label is re-added in the next step so the scheduling grid still has its heading.

- [ ] **Step 6: Re-add the Hours Per Day heading and wrap the body in the picker toggle**

Immediately BEFORE the `{/* --- UNSCHEDULED ... */}` block (now around line ~575), add back the hours heading that used to live in the simplified block:

```tsx
        {/* --- HOURS PER DAY heading (shown once crew is chosen and dated) --- */}
        {selectedMembers.length > 0 && !isUnscheduled && (
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block flex-shrink-0">{t('modals.CrewSelectionModal.hoursPerDay')}</label>
        )}
```

Now wrap the whole body so the picker takes over when open. Change the opening of the body container (line ~423) from:

```tsx
      <div className="flex flex-col h-[80vh]">
```

to:

```tsx
      <div className="flex flex-col h-[80vh]">
        {showPicker ? (
          <CrewTransferPicker
            allStaff={allStaff.length > 0 ? allStaff : currentCrew}
            selectedIds={selectedIds}
            leaderId={leaderId}
            weekDays={weekDays}
            existingJobs={existingJobs}
            excludeJobId={excludeJobId}
            weekendDays={weekendDays}
            standardDay={STANDARD_WORK_DAY_HOURS}
            onAdd={addMember}
            onRemove={removeMember}
            onSetLeader={setLeaderId}
            onDone={() => { setShowPicker(false); setSearchTerm(''); }}
          />
        ) : (
        <>
```

And close the fragment + ternary just before the closing `</div>` of the body container (line ~719, right after the footer block's closing `</div>`):

```tsx
        </>
        )}
      </div>
```

(The `</div>` shown is the existing body container close; add the `</>` and `)}` immediately before it.)

- [ ] **Step 7: Clean up now-unused imports**

`computeWeeklyHours` moved into the picker, and the dropdown's `CheckSquare` / `Square` icons are gone from this file. Remove `computeWeeklyHours` from the `crewWeeklyHours` import (line ~7) and drop `CheckSquare, Square` from the lucide-react import (line ~3). Leave all other icons that are still referenced (e.g. `Search`, `Crown`, `Zap`, `Trash2`, `AlertTriangle`, `Clock`).

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: PASS — the three new picker tests, the existing `CrewSelectionModal` tests (unscheduled note, save members, scheduled grid), and the i18n integrity test all green.

- [ ] **Step 9: Typecheck**

Run: `npm run lint`
Expected: no TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add components/modals/CrewSelectionModal.tsx components/modals/CrewSelectionModal.test.tsx
git commit -m "feat(scheduling): open crew transfer picker from search bar"
```

---

## Manual verification

After Task 3, run the dev server (`npm run dev`) and open a job's crew assignment:
1. Click the search bar → the modal body swaps to the two-panel picker with an autofocused search.
2. `+ Add` a member on the left → they appear on the right; the left removes them.
3. Click the crown on a right-hand member → they become the leader.
4. `× Remove` → they return to the left.
5. Type in the picker search → only the left panel filters.
6. Click **Done** → back to the scheduling grid/roster with the selection intact; confirm/save persists the crew as before.
7. Repeat from the reschedule sidebar (simplified mode) to confirm both modes use the picker.
