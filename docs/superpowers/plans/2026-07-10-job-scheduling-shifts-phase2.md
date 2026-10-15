# Job Scheduling Shifts — Phase 2 (Shift Editor UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user create, edit, and delete multiple shifts on a job from the Job Scheduling Details panel — members chosen in the (simplified) `CrewSelectionModal`, and each shift's name, date range, and per-day windows edited inline on its card — with the job's span recomputed from its shifts.

**Architecture:** A new pure `services/shifts.ts` owns the allocation-array mutations (upsert / remove / rename / set span / set per-day window), each recomputing the job envelope via `recomputeJobEnvelope` (Phase 1) and keeping the legacy `crewMemberIds` in sync. A new presentational `ShiftList` component renders one card per shift with inline editors; member editing delegates to the existing simplified `CrewSelectionModal`. `JobSchedulingView` mounts `ShiftList` from the Details panel's "Manage crew" action and routes saves through the new service.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react. Services in `services/*.ts`; components in `components/views/JobScheduling/`.

## Global Constraints

- Allocation dates are date-only `YYYY-MM-DD`; job `startDate`/`endDate` are ISO with a `T` clock.
- Times are `HH:mm` (24h). A shift's window on a day = `allocDayWindow(alloc, day)` (Phase 1).
- Every allocation-array mutation returns a NEW `Job` (immutable), calls `recomputeJobEnvelope`, and sets `crewMemberIds` to the union of all shift members.
- Shift ids: reuse the incoming id on edit; new shifts get `shift-${counter}` supplied by the caller (never `Date.now()` in services — pass ids in).
- `npx tsc --noEmit` and `npx vitest run` must stay green.
- Reuse existing `DatePicker` (`components/ui/DatePicker`) and `TimeInput` / `Button` (`components/UI`); follow existing styling.

## Interfaces produced (used across tasks)

```ts
// services/shifts.ts
upsertAllocation(job: Job, allocation: JobCrewAllocation): Job
removeAllocation(job: Job, shiftId: string): Job
setAllocSpan(job: Job, shiftId: string, startDate: string, endDate: string): Job
setAllocDayWindow(job: Job, shiftId: string, dateKey: string, window: { startTime: string; endTime: string }): Job
newShift(id: string, job: Job): JobCrewAllocation   // seeded defaults from the job span
```

---

### Task 1: `services/shifts.ts` — upsert & remove allocations

**Files:**
- Create: `services/shifts.ts`
- Test: `services/shifts.test.ts`

**Interfaces:**
- Consumes: `recomputeJobEnvelope` from `./scheduleEngine`; `Job`, `JobCrewAllocation` from `../types`.
- Produces: `upsertAllocation`, `removeAllocation`, `newShift` (signatures above).

- [ ] **Step 1: Write the failing test**

Create `services/shifts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { upsertAllocation, removeAllocation, newShift } from './shifts';
import type { Job, JobCrewAllocation } from '../types';

const job = (over: Partial<Job> = {}): Job => ({
  id: 'j1', jobNumber: 'J-1', name: 'Ext', clientId: 'c1', estimateId: 'e1',
  address: 'x', stage: 'Scheduled', startDate: '2026-06-08T08:00:00', endDate: '2026-06-08T17:00:00',
  dateCreated: '2026-01-01', ...over,
} as Job);

const shift = (over: Partial<JobCrewAllocation> = {}): JobCrewAllocation => ({
  id: 'prep', name: 'Prep', memberIds: ['m1'], startDate: '2026-06-08', endDate: '2026-06-09',
  startTime: '08:00', endTime: '12:00', ...over,
});

describe('upsertAllocation', () => {
  it('adds a new shift and recomputes envelope + crewMemberIds', () => {
    const out = upsertAllocation(job({ allocations: [] }), shift());
    expect(out.allocations!.map(a => a.id)).toEqual(['prep']);
    expect(out.crewMemberIds).toEqual(['m1']);
    expect(out.startDate).toBe('2026-06-08T08:00:00');
    expect(out.endDate).toBe('2026-06-09T12:00:00'); // envelope covers the shift
  });

  it('replaces an existing shift by id, leaving others intact', () => {
    const base = job({ allocations: [shift(), shift({ id: 'finish', name: 'Finish', memberIds: ['m2'] })] });
    const out = upsertAllocation(base, shift({ memberIds: ['m1', 'm3'], endDate: '2026-06-08' }));
    expect(out.allocations!.find(a => a.id === 'prep')!.memberIds).toEqual(['m1', 'm3']);
    expect(out.allocations!.find(a => a.id === 'finish')!.memberIds).toEqual(['m2']);
    expect(new Set(out.crewMemberIds)).toEqual(new Set(['m1', 'm3', 'm2']));
  });
});

describe('removeAllocation', () => {
  it('drops the shift and re-syncs crew + envelope', () => {
    const base = job({ allocations: [shift(), shift({ id: 'finish', memberIds: ['m2'], startDate: '2026-06-10', endDate: '2026-06-11', startTime: '13:00', endTime: '17:00' })] });
    const out = removeAllocation(base, 'finish');
    expect(out.allocations!.map(a => a.id)).toEqual(['prep']);
    expect(out.crewMemberIds).toEqual(['m1']);
    expect(out.endDate).toBe('2026-06-09T12:00:00');
  });
});

describe('newShift', () => {
  it('seeds a shift from the job span with default times', () => {
    const s = newShift('shift-2', job());
    expect(s).toMatchObject({ id: 'shift-2', memberIds: [], startDate: '2026-06-08', endDate: '2026-06-08', startTime: '08:00', endTime: '17:00' });
    expect(s.name.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/shifts.test.ts`
Expected: FAIL — "Failed to resolve import './shifts'".

- [ ] **Step 3: Implement**

Create `services/shifts.ts`:

```ts
import type { Job, JobCrewAllocation } from '../types';
import { recomputeJobEnvelope } from './scheduleEngine';

const syncCrew = (job: Job, allocations: JobCrewAllocation[]): Job =>
  recomputeJobEnvelope({
    ...job,
    allocations,
    crewMemberIds: Array.from(new Set(allocations.flatMap(a => a.memberIds ?? []))),
  });

/** Add `allocation` (new id) or replace the existing shift with the same id. */
export const upsertAllocation = (job: Job, allocation: JobCrewAllocation): Job => {
  const existing = job.allocations ?? [];
  const has = existing.some(a => a.id === allocation.id);
  const allocations = has
    ? existing.map(a => (a.id === allocation.id ? allocation : a))
    : [...existing, allocation];
  return syncCrew(job, allocations);
};

/** Remove the shift with `shiftId`. */
export const removeAllocation = (job: Job, shiftId: string): Job =>
  syncCrew(job, (job.allocations ?? []).filter(a => a.id !== shiftId));

/** A blank shift seeded from the job's current span, ready to edit. */
export const newShift = (id: string, job: Job): JobCrewAllocation => {
  const start = (job.startDate ?? '').split('T')[0];
  const end = (job.endDate ?? job.startDate ?? '').split('T')[0];
  return { id, name: 'New Shift', memberIds: [], startDate: start, endDate: end, startTime: '08:00', endTime: '17:00' };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/shifts.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add services/shifts.ts services/shifts.test.ts
git commit -m "feat(scheduling): shifts service — upsert/remove allocations + newShift"
```

---

### Task 2: `setAllocSpan` & `setAllocDayWindow`

**Files:**
- Modify: `services/shifts.ts`
- Test: `services/shifts.test.ts`

**Interfaces:**
- Produces: `setAllocSpan(job, shiftId, startDate, endDate): Job`, `setAllocDayWindow(job, shiftId, dateKey, window): Job` (both no-op-return the job when `shiftId` is unknown).

- [ ] **Step 1: Write the failing test**

Append to `services/shifts.test.ts`:

```ts
import { setAllocSpan, setAllocDayWindow } from './shifts';

describe('setAllocSpan', () => {
  it('updates a shift date range and recomputes the envelope', () => {
    const base = job({ allocations: [shift()] });
    const out = setAllocSpan(base, 'prep', '2026-06-08', '2026-06-12');
    const a = out.allocations!.find(x => x.id === 'prep')!;
    expect([a.startDate, a.endDate]).toEqual(['2026-06-08', '2026-06-12']);
    expect(out.endDate).toBe('2026-06-12T12:00:00');
  });

  it('returns the job unchanged for an unknown shift id', () => {
    const base = job({ allocations: [shift()] });
    expect(setAllocSpan(base, 'nope', '2026-06-08', '2026-06-12')).toEqual(base);
  });
});

describe('setAllocDayWindow', () => {
  it('sets a per-day window override on the shift', () => {
    const base = job({ allocations: [shift()] });
    const out = setAllocDayWindow(base, 'prep', '2026-06-09', { startTime: '13:00', endTime: '17:00' });
    expect(out.allocations!.find(a => a.id === 'prep')!.dailyHours).toEqual({ '2026-06-09': { startTime: '13:00', endTime: '17:00' } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/shifts.test.ts -t "setAlloc"`
Expected: FAIL — "setAllocSpan is not a function".

- [ ] **Step 3: Implement**

Append to `services/shifts.ts`:

```ts
const patchAlloc = (job: Job, shiftId: string, patch: (a: JobCrewAllocation) => JobCrewAllocation): Job => {
  const existing = job.allocations ?? [];
  if (!existing.some(a => a.id === shiftId)) return job;
  return syncCrew(job, existing.map(a => (a.id === shiftId ? patch(a) : a)));
};

/** Set a shift's overall date range (YYYY-MM-DD). */
export const setAllocSpan = (job: Job, shiftId: string, startDate: string, endDate: string): Job =>
  patchAlloc(job, shiftId, a => ({ ...a, startDate, endDate }));

/** Set (override) a shift's window on one day. */
export const setAllocDayWindow = (
  job: Job, shiftId: string, dateKey: string, window: { startTime: string; endTime: string },
): Job => patchAlloc(job, shiftId, a => ({ ...a, dailyHours: { ...a.dailyHours, [dateKey]: window } }));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/shifts.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add services/shifts.ts services/shifts.test.ts
git commit -m "feat(scheduling): shifts service — setAllocSpan/setAllocDayWindow"
```

---

### Task 3: `ShiftList` component

**Files:**
- Create: `components/views/JobScheduling/ShiftList.tsx`
- Test: `components/views/JobScheduling/ShiftList.test.tsx`

**Interfaces:**
- Consumes: `Job`, `CrewMember`, `JobCrewAllocation`; `allocDayWindow` from `services/scheduleEngine`; `workingDayKeys`, `toLocalDateKey`.
- Produces (props):

```ts
interface ShiftListProps {
  job: Job;
  allStaff: CrewMember[];
  weekendDays: number[];
  onEditMembers: (shiftId: string) => void;   // opens the simplified CrewSelectionModal
  onAddShift: () => void;                       // creates + opens member editor for a new shift
  onRenameShift: (shiftId: string, name: string) => void;
  onChangeSpan: (shiftId: string, startDate: string, endDate: string) => void;
  onChangeDayWindow: (shiftId: string, dateKey: string, window: { startTime: string; endTime: string }) => void;
  onDeleteShift: (shiftId: string) => void;
}
```

Card layout per shift (adapt the Work Order card at `WorkOrderView.tsx:588-633`): an editable name (`TextInput`), a start/end `DatePicker` pair, member avatars with an "Edit members" button (`onEditMembers`), a per-working-day list of `TimeInput` window rows (seeded from `allocDayWindow`), and a delete button. Footer: an "Add shift" `Button` calling `onAddShift`. Working days come from `workingDayKeys(alloc.startDate, alloc.endDate, weekendDays)`.

- [ ] **Step 1: Write the failing test**

Create `components/views/JobScheduling/ShiftList.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShiftList } from './ShiftList';
import type { Job, CrewMember } from '../../../types';

const staff: CrewMember[] = [{ id: 'm1', name: 'Mike Smith' } as CrewMember];
const job: Job = {
  id: 'j1', jobNumber: 'J-1', name: 'Ext', clientId: 'c', estimateId: 'e', address: 'x',
  stage: 'Scheduled', startDate: '2026-06-08T08:00:00', endDate: '2026-06-09T17:00:00', dateCreated: '2026-01-01',
  allocations: [{ id: 'prep', name: 'Prep', memberIds: ['m1'], startDate: '2026-06-08', endDate: '2026-06-09', startTime: '08:00', endTime: '12:00' }],
} as Job;

const noop = () => {};
const props = {
  job, allStaff: staff, weekendDays: [0, 6],
  onEditMembers: noop, onAddShift: noop, onRenameShift: noop,
  onChangeSpan: noop, onChangeDayWindow: noop, onDeleteShift: noop,
};

describe('ShiftList', () => {
  it('renders a card per shift with its name and members', () => {
    render(<ShiftList {...props} />);
    expect(screen.getByDisplayValue('Prep')).toBeTruthy();
    expect(screen.getByText(/Mike/)).toBeTruthy();
  });

  it('calls onAddShift when the add button is clicked', () => {
    const onAddShift = vi.fn();
    render(<ShiftList {...props} onAddShift={onAddShift} />);
    fireEvent.click(screen.getByRole('button', { name: /add shift/i }));
    expect(onAddShift).toHaveBeenCalledOnce();
  });

  it('calls onDeleteShift with the shift id', () => {
    const onDeleteShift = vi.fn();
    render(<ShiftList {...props} onDeleteShift={onDeleteShift} />);
    fireEvent.click(screen.getByRole('button', { name: /delete shift/i }));
    expect(onDeleteShift).toHaveBeenCalledWith('prep');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/ShiftList.test.tsx`
Expected: FAIL — cannot resolve `./ShiftList`.

- [ ] **Step 3: Implement**

Create `components/views/JobScheduling/ShiftList.tsx`:

```tsx
import React from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { Button, TextInput, TimeInput } from '../../UI';
import { DatePicker } from '../../ui/DatePicker';
import { Job, CrewMember } from '../../../types';
import { allocDayWindow } from '../../../services/scheduleEngine';
import { workingDayKeys } from '../../../services/scheduleEngine';

interface ShiftListProps {
  job: Job;
  allStaff: CrewMember[];
  weekendDays: number[];
  onEditMembers: (shiftId: string) => void;
  onAddShift: () => void;
  onRenameShift: (shiftId: string, name: string) => void;
  onChangeSpan: (shiftId: string, startDate: string, endDate: string) => void;
  onChangeDayWindow: (shiftId: string, dateKey: string, window: { startTime: string; endTime: string }) => void;
  onDeleteShift: (shiftId: string) => void;
}

export const ShiftList = ({
  job, allStaff, weekendDays, onEditMembers, onAddShift, onRenameShift,
  onChangeSpan, onChangeDayWindow, onDeleteShift,
}: ShiftListProps) => {
  const nameOf = (id: string) => allStaff.find(m => m.id === id)?.name ?? id;
  const allocs = job.allocations ?? [];

  return (
    <div className="space-y-3">
      {allocs.map(alloc => {
        const days = workingDayKeys(alloc.startDate, alloc.endDate, weekendDays);
        return (
          <div key={alloc.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <TextInput value={alloc.name} onChange={(v: string) => onRenameShift(alloc.id, v)} className="flex-1" />
              <button aria-label="Delete shift" onClick={() => onDeleteShift(alloc.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <DatePicker value={alloc.startDate} onChange={(v: string) => onChangeSpan(alloc.id, v, alloc.endDate < v ? v : alloc.endDate)} />
              <DatePicker value={alloc.endDate} align="right" onChange={(v: string) => onChangeSpan(alloc.id, v < alloc.startDate ? v : alloc.startDate, v)} />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5 min-w-0">
                {alloc.memberIds.length
                  ? alloc.memberIds.map(id => (
                      <span key={id} className="text-xs font-semibold bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5">{nameOf(id).split(' ')[0]}</span>
                    ))
                  : <span className="text-xs text-gray-400 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Unassigned</span>}
              </div>
              <button onClick={() => onEditMembers(alloc.id)} className="text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap">Edit members</button>
            </div>

            <div className="space-y-1.5">
              {days.map(dateKey => {
                const w = allocDayWindow(alloc, dateKey);
                const label = new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                return (
                  <div key={dateKey} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
                    <TimeInput value={w.startTime} onChange={(v: string) => onChangeDayWindow(alloc.id, dateKey, { startTime: v, endTime: w.endTime })} />
                    <span className="text-gray-400">–</span>
                    <TimeInput value={w.endTime} onChange={(v: string) => onChangeDayWindow(alloc.id, dateKey, { startTime: w.startTime, endTime: v })} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <Button variant="secondary" onClick={onAddShift} className="w-full justify-center">
        <Plus className="w-4 h-4" /> Add shift
      </Button>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/ShiftList.test.tsx`
Expected: PASS (3 cases). If `TextInput`/`TimeInput` are not exported from `components/UI`, import them from their actual modules (check `components/UI.tsx` exports first) and adjust; the test only asserts name display, add, and delete.

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/ShiftList.tsx components/views/JobScheduling/ShiftList.test.tsx
git commit -m "feat(scheduling): ShiftList component with inline shift editing"
```

---

### Task 4: Wire `ShiftList` into `JobSchedulingView` via the Details panel

**Files:**
- Modify: `components/views/JobSchedulingView.tsx` (crew handlers ~779-985, the `CrewSelectionModal` render ~1076-1091, and the Details-panel wiring ~1499)
- Modify: `components/views/JobScheduling/JobDetailsPanel.tsx` (host the shift editor from "Manage crew")

**Interfaces:**
- Consumes: `upsertAllocation`, `removeAllocation`, `setAllocSpan`, `setAllocDayWindow`, `newShift` from `services/shifts`; `ShiftList`.

This task connects the pieces. The Details panel's "Manage crew" opens a shift-management surface (a `Modal` or an expandable section) that renders `ShiftList` for the selected job; "Edit members" / "Add shift" open the existing simplified `CrewSelectionModal` scoped to a specific shift id.

- [ ] **Step 1: Add shift state + handlers in `JobSchedulingView`**

Add near the other crew state (`jobToAssign`, `isCrewModalOpen`, ~line 296):

```tsx
const [shiftsJobId, setShiftsJobId] = useState<string | null>(null);   // job whose shifts are being managed
const [editingShiftId, setEditingShiftId] = useState<string | null>(null); // shift being member-edited
const [shiftSeq, setShiftSeq] = useState(0);
```

Replace `handleReassignCrew` (currently opens the modal for `allocations[0]`) so "Manage crew" opens the shift list:

```tsx
const handleReassignCrew = (jobId: string) => setShiftsJobId(jobId);
```

Add the shift-management handlers (import the service functions at the top from `../../services/shifts`):

```tsx
const shiftsJob = jobs.find(j => j.id === shiftsJobId) || null;

const handleAddShift = () => {
  if (!shiftsJob) return;
  const id = `shift-${shiftSeq}`;
  setShiftSeq(n => n + 1);
  onUpdateJob(upsertAllocation(shiftsJob, newShift(id, shiftsJob)));
  setEditingShiftId(id);            // immediately choose members for the new shift
};
const handleRenameShift = (shiftId: string, name: string) => {
  if (!shiftsJob) return;
  const a = shiftsJob.allocations?.find(x => x.id === shiftId);
  if (a) onUpdateJob(upsertAllocation(shiftsJob, { ...a, name }));
};
const handleChangeSpan = (shiftId: string, startDate: string, endDate: string) => {
  if (shiftsJob) onUpdateJob(setAllocSpan(shiftsJob, shiftId, startDate, endDate));
};
const handleChangeShiftDayWindow = (shiftId: string, dateKey: string, window: { startTime: string; endTime: string }) => {
  if (shiftsJob) onUpdateJob(setAllocDayWindow(shiftsJob, shiftId, dateKey, window));
};
const handleDeleteShift = (shiftId: string) => {
  if (shiftsJob) onUpdateJob(removeAllocation(shiftsJob, shiftId));
};
```

- [ ] **Step 2: Route member editing through the existing modal, scoped to a shift**

Change `handleSaveCrewModal` (~960) to upsert into the targeted shift instead of collapsing to `[0]`:

```tsx
const handleSaveCrewModal = (newCrew: CrewMember[], allocation?: Partial<JobCrewAllocation>) => {
  const job = shiftsJob;
  const shiftId = editingShiftId;
  if (job && shiftId) {
    const existing = job.allocations?.find(a => a.id === shiftId);
    const merged: JobCrewAllocation = {
      id: shiftId,
      name: allocation?.name || existing?.name || 'Crew',
      startDate: existing?.startDate || (job.startDate || '').split('T')[0],
      endDate: existing?.endDate || (job.endDate || job.startDate || '').split('T')[0],
      startTime: existing?.startTime || '08:00',
      endTime: existing?.endTime || '17:00',
      color: existing?.color,
      dailyHours: existing?.dailyHours,
      hoursAssignments: existing?.hoursAssignments,
      memberIds: newCrew.map(c => c.id),
    };
    onUpdateJob(upsertAllocation(job, merged));
  }
  setEditingShiftId(null);
};
```

Update the `CrewSelectionModal` render (~1076) to key off `editingShiftId`/`shiftsJob` and pass the edited shift as `allocationToEdit`:

```tsx
{shiftsJob && editingShiftId && (
  <CrewSelectionModal
    isOpen={!!editingShiftId}
    onClose={() => setEditingShiftId(null)}
    currentCrew={assignedMembers(shiftsJob).filter(m =>
      shiftsJob.allocations?.find(a => a.id === editingShiftId)?.memberIds.includes(m.id))}
    onSave={handleSaveCrewModal}
    allStaff={allStaff}
    jobStartDate={shiftsJob.startDate}
    jobEndDate={shiftsJob.endDate}
    existingJobs={jobs}
    allocationToEdit={shiftsJob.allocations?.find(a => a.id === editingShiftId)}
    simplified
    excludeJobId={shiftsJob.id}
    weekendDays={workConfig.weekendDays}
  />
)}
```

- [ ] **Step 3: Render the shift-management surface**

Add, near the other modals in `JobSchedulingView`'s JSX, a `Modal` hosting `ShiftList` (import `Modal` from `components/UI`):

```tsx
{shiftsJob && (
  <Modal isOpen={!!shiftsJobId} onClose={() => setShiftsJobId(null)} title={`Shifts — ${shiftsJob.name}`} maxWidth="max-w-2xl">
    <ShiftList
      job={shiftsJob}
      allStaff={allStaff}
      weekendDays={workConfig.weekendDays}
      onEditMembers={setEditingShiftId}
      onAddShift={handleAddShift}
      onRenameShift={handleRenameShift}
      onChangeSpan={handleChangeSpan}
      onChangeDayWindow={handleChangeShiftDayWindow}
      onDeleteShift={handleDeleteShift}
    />
  </Modal>
)}
```

(The Details panel already calls `onViewCrew={(id) => { handleReassignCrew(id); setSelectedJob(null); }}` at ~1499 — no change needed; `handleReassignCrew` now opens this modal.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. Add the `import { upsertAllocation, removeAllocation, setAllocSpan, setAllocDayWindow, newShift } from '../../services/shifts';` and `import { ShiftList } from './JobScheduling/ShiftList';` lines; remove any now-unused `jobToAssign` wiring only if the compiler flags it (leave it if still referenced elsewhere).

- [ ] **Step 5: Manual smoke via the run skill**

Use the `run` skill (or `npm run dev`) to open Job Scheduling → a job's Details panel → "Manage crew". Verify: Add shift creates a card and opens the member picker; editing members, name, dates, and per-day times persists; deleting removes the shift; the job's board span reflects the shift envelope.

- [ ] **Step 6: Commit**

```bash
git add components/views/JobSchedulingView.tsx components/views/JobScheduling/JobDetailsPanel.tsx
git commit -m "feat(scheduling): manage multiple shifts from the Details panel"
```

---

### Task 5: Full-suite + typecheck gate

**Files:** none (verification only)

- [ ] **Step 1: Typecheck** — Run: `npx tsc --noEmit` → exit 0.
- [ ] **Step 2: Full suite** — Run: `npx vitest run` → all pass.
- [ ] **Step 3:** Commit any fixup needed to keep green (else nothing to commit).

---

## Roadmap — remaining phases

- **Phase 3 — Shift-aware display + editing.** Hours grid: one chip per `(job, shift)` (add `shiftId`/`shiftName` to `MemberDayCell`, tint by shift); grid edits + drag-assign pass `shiftId` to the Phase 1 writers (shift picker on multi-shift drop). Day + week boards: one bar per `(job, shift)`, `layoutLaneBars` keyed by `(jobId, shiftId)`, day blocks via `allocDayWindow`.
- **Phase 4 — Drag a shift + cascade.** Dragging a shift bar moves only that shift (then `recomputeJobEnvelope`); Cascade ON slides downstream jobs sharing the moved shift's members (job-level engine).

## Self-Review

- **Spec coverage (Phase 2 scope):** shared shift management in Job Scheduling ✅ (Tasks 3–4); members via simplified modal ✅ (Task 4 Step 2); per-shift dates ✅ (`setAllocSpan`, Task 2 + card); per-day windows within a shift ✅ (`setAllocDayWindow`, Task 2 + card); job envelope recompute on change ✅ (`syncCrew` → `recomputeJobEnvelope`). Grid/board display + drag/cascade explicitly Phases 3–4.
- **Placeholder scan:** none — each code step shows complete code/tests and exact commands; the one runtime-verify step (Task 4 Step 5) is a manual smoke, not a code placeholder.
- **Type consistency:** `upsertAllocation`, `removeAllocation`, `setAllocSpan`, `setAllocDayWindow`, `newShift`, and the `ShiftList` prop names are used identically across Tasks 1–4.
- **Known integration note:** in Task 4, verify `TextInput`/`TimeInput`/`Modal` are exported from `components/UI`; if a name differs, import from the correct module (adjust, don't invent).
