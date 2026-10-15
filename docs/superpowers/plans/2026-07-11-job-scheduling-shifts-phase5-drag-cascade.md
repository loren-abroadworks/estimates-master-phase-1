# Job Scheduling Shifts — Phase 5: Drag a Shift + Cascade + Drag-Assign Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make board drag interactions shift-native — dragging a shift bar on the week board moves only that shift (job envelope recomputes), dragging a shift block on the day board edits only that shift's per-day window, dropping a job onto a member targets a specific shift (picker when a job has several), and cascade (when ON) slides whole downstream jobs that share the moved shift's members.

**Architecture:** Reuse the existing job-level machinery rather than rewriting it. A single new data helper (`moveAllocation`) moves one allocation and recomputes the envelope. `ProposedChange` gains an optional `shiftId`; `applyChangeToJob` branches on it so the whole preview → commit → apply → cascade pipeline carries a shift move end-to-end with no new commit path. Cascade stays job-granular (per the approved design) but its crew scope narrows to the moved shift's members. The drag-assign picker is a small new component; the assign write paths already take a trailing `shiftId` (added in Phase 3).

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react. Typecheck `npx tsc --noEmit`; run a test file with `npx vitest run <path>`.

## Global Constraints

- **Legacy jobs unchanged.** A job with no `allocations` (crew via `crewMemberIds`) renders one job-spanning bar/block and drags exactly as it does today. Every shift-aware branch must fall back to the whole-job path when `shiftId` is absent.
- **Date keys are bare `YYYY-MM-DD`.** `new Date('YYYY-MM-DD')` parses as UTC midnight and drops a day in negative-offset zones. Any Date math on a date key MUST anchor at local noon (`` `${key}T12:00:00` ``) or use the existing `toLocalDateKey`.
- **A `JobCrewAllocation` IS a shift.** Fields: `{ id, name, memberIds[], startDate/endDate (YYYY-MM-DD), startTime/endTime (HH:mm), color?, dailyHours?: Record<dateKey,{startTime,endTime}>, hoursAssignments? }`.
- **Envelope is derived, never hand-set for shift edits.** All shift mutations in `services/shifts.ts` route through `patchAlloc`/`syncCrew`, which call `recomputeJobEnvelope`. Do not set `job.startDate/endDate` directly on a shift path.
- **TDD.** Failing test first, minimal implementation, green, commit — one commit per task.
- **Commit footer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Out of scope (deferred):** true shift-granular cascade (reflow only downstream *shifts* sharing members); per-shift month-view splitting. These stay job-granular / unchanged.

---

## File Structure

- `services/shifts.ts` — **Modify.** Add `moveAllocation(job, shiftId, newStartKey)`: re-keys one allocation's span and `dailyHours` by a calendar-day delta, then recomputes the envelope (via existing `patchAlloc`).
- `services/scheduleEngine.ts` — **Modify.** Add optional `shiftId` to `ProposedChange`; branch `applyChangeToJob` so a change carrying `shiftId` moves only that allocation.
- `components/views/JobScheduling/ProductionBoard.tsx` — **Modify.** Carry the dragged card's `shiftId` into the drop callback; narrow the multi-lane drag highlight to the dragged shift.
- `components/views/JobScheduling/DayBoard.tsx` — **Modify.** Carry the dragged block's `shiftId` into `onChangeDayWindow`.
- `components/views/JobSchedulingView.tsx` — **Modify.** `handleDropJob` and `handleChangeDayWindow` become shift-aware; cascade scope narrows to the moved shift's members; drop-on-member routes through the new shift picker; `handleAssignDaysSubmit` targets the chosen shift.
- `components/views/JobScheduling/ShiftPickerModal.tsx` — **Create.** Small modal listing a job's shifts (plus "New shift") shown when a job with 2+ shifts is dropped onto a member.
- Test files (all **Modify** except the new component's, which is **Create**): `services/shifts.test.ts`, `services/scheduleEngine.test.ts`, `components/views/JobScheduling/ProductionBoard.test.tsx`, `components/views/JobScheduling/DayBoard.test.tsx`, `components/views/JobScheduling/ShiftPickerModal.test.tsx`.

---

### Task 1: `moveAllocation` data helper

Moves one shift's whole span by the calendar-day delta implied by a new start day, re-keying its per-day windows, then recomputes the job envelope. This is the pure core of a week-board shift drag.

**Files:**
- Modify: `services/shifts.ts`
- Test: `services/shifts.test.ts`

**Interfaces:**
- Consumes: `patchAlloc(job, shiftId, patch)` (private, already recomputes envelope via `syncCrew`), `JobCrewAllocation` from `../types`.
- Produces: `moveAllocation(job: Job, shiftId: string, newStartKey: string): Job` — returns a new Job with the shift shifted so its `startDate === newStartKey`, `endDate` shifted by the same number of days, `dailyHours` re-keyed by the same delta, and the job envelope recomputed. Unknown `shiftId` or a shift with no `startDate` returns the job unchanged.

- [ ] **Step 1: Write the failing test**

Add to `services/shifts.test.ts`:

```ts
import { moveAllocation } from './shifts';

describe('moveAllocation', () => {
  const base = (): Job => ({
    id: 'j1', name: 'J', jobNumber: '1', clientId: 'c', stage: 'Scheduled',
    startDate: '2026-07-06T08:00:00', endDate: '2026-07-08T17:00:00',
    allocations: [{
      id: 's1', name: 'Prep', memberIds: ['m1'],
      startDate: '2026-07-06', endDate: '2026-07-08', startTime: '08:00', endTime: '17:00',
      dailyHours: { '2026-07-06': { startTime: '08:00', endTime: '12:00' } },
    }],
  } as unknown as Job);

  it('shifts the allocation span and re-keys dailyHours by the day delta', () => {
    const out = moveAllocation(base(), 's1', '2026-07-09'); // +3 days
    const a = out.allocations!.find(x => x.id === 's1')!;
    expect(a.startDate).toBe('2026-07-09');
    expect(a.endDate).toBe('2026-07-11');
    expect(a.dailyHours).toEqual({ '2026-07-09': { startTime: '08:00', endTime: '12:00' } });
  });

  it('recomputes the job envelope to cover the moved shift', () => {
    const out = moveAllocation(base(), 's1', '2026-07-09');
    expect(out.startDate).toBe('2026-07-09T08:00:00');
    expect(out.endDate).toBe('2026-07-11T17:00:00');
  });

  it('returns the job unchanged for an unknown shift id', () => {
    const job = base();
    expect(moveAllocation(job, 'nope', '2026-07-09')).toBe(job);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/shifts.test.ts -t moveAllocation`
Expected: FAIL — `moveAllocation is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `services/shifts.ts` (after `setAllocDayWindow`):

```ts
// Calendar-day delta between two YYYY-MM-DD keys, anchored at local noon so the
// Date parse doesn't drop a day in negative-offset zones.
const dayDelta = (fromKey: string, toKey: string): number =>
  Math.round((new Date(`${toKey}T12:00:00`).getTime() - new Date(`${fromKey}T12:00:00`).getTime()) / 86_400_000);

const addDaysToKey = (key: string, days: number): string => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Move a shift so its start day becomes `newStartKey`, shifting its end day and
 *  re-keying its per-day windows by the same delta, then recompute the envelope.
 *  Unknown shift / undated shift → unchanged. */
export const moveAllocation = (job: Job, shiftId: string, newStartKey: string): Job =>
  patchAlloc(job, shiftId, a => {
    if (!a.startDate) return a;
    const delta = dayDelta(a.startDate, newStartKey);
    if (delta === 0) return a;
    const dailyHours = a.dailyHours
      ? Object.fromEntries(Object.entries(a.dailyHours).map(([k, w]) => [addDaysToKey(k, delta), w]))
      : a.dailyHours;
    return {
      ...a,
      startDate: newStartKey,
      endDate: a.endDate ? addDaysToKey(a.endDate, delta) : newStartKey,
      ...(dailyHours ? { dailyHours } : {}),
    };
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/shifts.test.ts -t moveAllocation`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add services/shifts.ts services/shifts.test.ts
git commit -m "feat(scheduling): moveAllocation shifts one shift's span and re-keys windows

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `ProposedChange.shiftId` + shift-aware `applyChangeToJob`

Lets a single change describe a shift move so the entire preview → commit → apply pipeline (`App.applyScheduleChanges` → `applyChangeToJob`) carries it with no new commit path.

**Files:**
- Modify: `services/scheduleEngine.ts`
- Test: `services/scheduleEngine.test.ts`

**Interfaces:**
- Consumes: `moveAllocation` from `./shifts` (Task 1), `toLocalDateKey`.
- Produces: `ProposedChange` gains `shiftId?: string`. `applyChangeToJob(job, change)` — when `change.shiftId` is set, moves only that allocation (via `moveAllocation`, keyed by the local day of `change.newStart`) and returns the envelope-recomputed job; when absent, behaves exactly as today.

**Note on import direction:** `shifts.ts` already imports from `scheduleEngine.ts` (`recomputeJobEnvelope`). Importing `moveAllocation` back into `scheduleEngine.ts` would create a cycle. Avoid it: `applyChangeToJob` must implement the shift-move inline using allocation re-keying, OR move `moveAllocation` into `scheduleEngine.ts`. **Chosen:** implement the shift branch inline in `applyChangeToJob` by delegating through a tiny local re-key (duplicating none of `shifts.ts` — the branch just sets the allocation dates and calls `recomputeJobEnvelope`, which already lives here). Keep `moveAllocation` in `shifts.ts` for the non-preview callers.

- [ ] **Step 1: Write the failing test**

Add to `services/scheduleEngine.test.ts`:

```ts
describe('applyChangeToJob (shift move)', () => {
  const job = {
    id: 'j1', name: 'J', jobNumber: '1',
    startDate: '2026-07-06T08:00:00', endDate: '2026-07-08T17:00:00',
    allocations: [
      { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-07-06', endDate: '2026-07-06', startTime: '08:00', endTime: '12:00' },
      { id: 's2', name: 'Finish', memberIds: ['m2'], startDate: '2026-07-08', endDate: '2026-07-08', startTime: '13:00', endTime: '17:00' },
    ],
  } as unknown as Job;

  it('moves only the named shift and leaves the others put', () => {
    const change: ProposedChange = {
      jobId: 'j1', jobName: 'J', jobNumber: '1', shiftId: 's1',
      oldStart: '2026-07-06T08:00:00', oldEnd: '2026-07-06T12:00:00',
      newStart: '2026-07-09T08:00:00', newEnd: '2026-07-09T12:00:00',
    };
    const out = applyChangeToJob(job, change);
    expect(out.allocations!.find(a => a.id === 's1')!.startDate).toBe('2026-07-09');
    expect(out.allocations!.find(a => a.id === 's2')!.startDate).toBe('2026-07-08');
    // envelope now spans the un-moved s2 (Jul 8) as its start, s1 (Jul 9) as its end
    expect(out.startDate).toBe('2026-07-08T13:00:00');
    expect(out.endDate).toBe('2026-07-09T12:00:00');
  });

  it('without shiftId still moves the whole job (unchanged behavior)', () => {
    const change: ProposedChange = {
      jobId: 'j1', jobName: 'J', jobNumber: '1',
      oldStart: '2026-07-06T08:00:00', oldEnd: '2026-07-08T17:00:00',
      newStart: '2026-07-10T08:00:00', newEnd: '2026-07-12T17:00:00',
    };
    const out = applyChangeToJob(job, change);
    expect(out.startDate).toBe('2026-07-10T08:00:00');
    expect(out.endDate).toBe('2026-07-12T17:00:00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t "shift move"`
Expected: FAIL — `shiftId` not on `ProposedChange` type / whole job moved instead of one shift.

- [ ] **Step 3: Write minimal implementation**

In `services/scheduleEngine.ts`, extend the interface (after `dailyHours?` in `ProposedChange`):

```ts
  /** Present when this change moves a single shift (allocation id), not the whole job. */
  shiftId?: string;
```

Replace `applyChangeToJob`:

```ts
export const applyChangeToJob = (job: Job, change: ProposedChange): Job => {
  if (change.skipped) return job;
  if (change.shiftId) {
    // Move only the named allocation to the new start day, re-keying its per-day
    // windows by the same delta, then recompute the envelope from all shifts.
    const newStartKey = toLocalDateKey(new Date(change.newStart));
    const allocations = (job.allocations ?? []).map(a => {
      if (a.id !== change.shiftId || !a.startDate) return a;
      const delta = Math.round(
        (new Date(`${newStartKey}T12:00:00`).getTime() - new Date(`${a.startDate}T12:00:00`).getTime()) / 86_400_000,
      );
      const rekey = (k: string): string => {
        const d = new Date(`${k}T12:00:00`);
        d.setDate(d.getDate() + delta);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      return {
        ...a,
        startDate: newStartKey,
        endDate: a.endDate ? rekey(a.endDate) : newStartKey,
        ...(a.dailyHours ? { dailyHours: Object.fromEntries(Object.entries(a.dailyHours).map(([k, w]) => [rekey(k), w])) } : {}),
      };
    });
    return recomputeJobEnvelope({ ...job, allocations });
  }
  return {
    ...job,
    startDate: change.newStart,
    endDate: change.newEnd,
    ...(change.dailyHours ? { dailyHours: { ...job.dailyHours, ...change.dailyHours } } : {}),
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts -t "shift move"`
Expected: PASS (2 tests). Then `npx vitest run services/scheduleEngine.test.ts` — whole file still green.

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat(scheduling): ProposedChange.shiftId moves one shift through apply path

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Week board carries `shiftId` through the drag drop

The pointer-drag already grabs the specific card (`d.card`, which has `shiftId`). Widen the drop callback and narrow the connected-lane highlight to just that shift.

**Files:**
- Modify: `components/views/JobScheduling/ProductionBoard.tsx`
- Test: `components/views/JobScheduling/ProductionBoard.test.tsx`

**Interfaces:**
- Consumes: `BoardCard.shiftId` (already present), the existing pointer-drag in `ProductionBoard`.
- Produces: `ProductionBoardProps.onDropJob` widens to `(jobId: string, dayKey: string, shiftId?: string) => void`. On drop, passes `d.card.shiftId`. The multi-lane drag highlight filters lanes to those holding the dragged card's `(jobId, shiftId)` pair, not just `jobId`.

- [ ] **Step 1: Write the failing test**

Add to `components/views/JobScheduling/ProductionBoard.test.tsx`. Reuse the file's existing render helpers/imports; the assertion is that the drop callback receives the shift id. If the file already has a pointer-drag test, mirror its event sequence (pointerdown on the bar → pointermove past threshold → pointerup over a target cell).

```ts
it('passes the dragged shift id to onDropJob', () => {
  const onDropJob = vi.fn();
  // A job with two shifts so the dragged bar carries a specific shiftId.
  const lanes: BoardLane[] = [{
    crewId: 'job-1', crewName: 'Job 1',
    cardsByDay: {
      [keyFor(0)]: [{ jobId: 'job-1', jobName: 'Job 1', jobNumber: '1', color: '#06b6d4',
        startKey: keyFor(0), endKey: keyFor(0), isLocked: false, startTime: '08:00', endTime: '12:00',
        shiftId: 's1', shiftName: 'Prep' }],
    },
  }];
  render(<ProductionBoard lanes={lanes} weekDays={weekDays} config={config}
    canReschedule onDropJob={onDropJob} onViewJob={() => {}} />);
  const bar = screen.getByText('Prep', { exact: false }).closest('[draggable]') as HTMLElement;
  dragBarToCell(bar, /* target cell */ keyFor(2)); // helper mirroring existing pointer-drag test
  expect(onDropJob).toHaveBeenCalledWith('job-1', keyFor(2), 's1');
});
```

> If the existing test file has no pointer-drag helper, add one that dispatches `pointerdown` on the bar, a `pointermove` beyond `DRAG_THRESHOLD`, and `pointerup` at the target cell's client coords (use the test file's existing `getBoundingClientRect` stub pattern). Keep it local to this test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/ProductionBoard.test.tsx -t "shift id to onDropJob"`
Expected: FAIL — `onDropJob` called with `('job-1', key)` (2 args), missing the shift id.

- [ ] **Step 3: Write minimal implementation**

In `ProductionBoard.tsx`:

1. Widen the prop type:
```ts
  onDropJob: (jobId: string, dayKey: string, shiftId?: string) => void;
```

2. In the `onUp` handler, pass the shift id:
```ts
        if (cell) onDropRef.current(d.card.jobId, cell.day, d.card.shiftId);
```

3. Narrow the connected-lane highlight (in `onMove`) to the dragged card's shift so only lanes holding *that shift* light up:
```ts
        const jobId = d.card.jobId;
        const shiftId = d.card.shiftId;
        const laneIds = lanesRef.current
          .filter(l => Object.values(l.cardsByDay).some(cs =>
            cs.some(c => c.jobId === jobId && (shiftId === undefined || c.shiftId === shiftId))))
          .map(l => l.crewId);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/ProductionBoard.test.tsx`
Expected: PASS (new test + all existing board tests, including legacy single-bar drag where `shiftId` is `undefined`).

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/ProductionBoard.tsx components/views/JobScheduling/ProductionBoard.test.tsx
git commit -m "feat(scheduling): week board drag carries the dragged shift id

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `handleDropJob` stages a shift-move preview

Wire the view so a shift-bar drop builds a shift `ProposedChange` (carrying `shiftId`, with `newStart`/`newEnd` describing the shift's new span) and stages it in the preview — reusing the same drawer/Apply UX as a job move.

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`
- Test: covered end-to-end by the runtime verify step + the existing view test suite staying green (no isolated unit test — `handleDropJob` is view-internal wiring; the behavior is exercised by Task 2's apply test and the verify pass).

**Interfaces:**
- Consumes: `moveAllocation` (Task 1) is NOT needed here — the preview only needs the *proposed span*; the actual move happens in `applyChangeToJob` (Task 2) on commit. Build the proposed span from the dragged shift's current span shifted by the drop-day delta.
- Produces: `handleDropJob(jobId: string, dayKey: string, shiftId?: string)` — when `shiftId` is present, stages a change with `shiftId` set, `oldStart/oldEnd` = the shift's current span (ISO), `newStart/newEnd` = the shift shifted to `dayKey`. When absent, unchanged (existing `moveJobToSlot` job path).

- [ ] **Step 1: Read the current `handleDropJob`**

Confirm the current shape (view lines ~381–399): job path uses `moveJobToSlot` + `preview.stage`. Keep that branch verbatim for the no-`shiftId` case.

- [ ] **Step 2: Write the shift branch**

Replace `handleDropJob`:

```ts
  const handleDropJob = (jobId: string, dayKey: string, shiftId?: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || job.is_locked) return;

    if (shiftId) {
      const alloc = job.allocations?.find(a => a.id === shiftId);
      if (!alloc?.startDate) return;
      // Shift the allocation's span to the drop day; preview shows the shift's new
      // location, apply (applyChangeToJob) performs the real move + envelope recompute.
      const delta = Math.round(
        (new Date(`${dayKey}T12:00:00`).getTime() - new Date(`${alloc.startDate}T12:00:00`).getTime()) / 86_400_000,
      );
      const addKey = (k: string) => {
        const d = new Date(`${k}T12:00:00`); d.setDate(d.getDate() + delta);
        return toLocalDateKey(d);
      };
      const newEndKey = alloc.endDate ? addKey(alloc.endDate) : dayKey;
      const win = (k: string) => alloc.dailyHours?.[k] ?? { startTime: alloc.startTime, endTime: alloc.endTime };
      const change: ProposedChange = {
        jobId, jobName: job.name, jobNumber: job.jobNumber, shiftId,
        oldStart: `${alloc.startDate}T${win(alloc.startDate).startTime}:00`,
        oldEnd: `${alloc.endDate || alloc.startDate}T${win(alloc.endDate || alloc.startDate).endTime}:00`,
        newStart: `${dayKey}T${win(alloc.startDate).startTime}:00`,
        newEnd: `${newEndKey}T${win(alloc.endDate || alloc.startDate).endTime}:00`,
      };
      setCascade(false);
      preview.stage({
        changes: [change], label: `Move ${alloc.name}`, mode: 'edit', primaryJobId: jobId,
        commit: (eff) => onApplySchedule(eff, `Move ${alloc.name}`),
      });
      setPendingMoveId(jobId);
      return;
    }

    const startISO = `${dayKey}T${String(workConfig.workDayStartHour).padStart(2, '0')}:00:00`;
    const durMs = job.startDate && job.endDate
      ? new Date(job.endDate).getTime() - new Date(job.startDate).getTime()
      : (workConfig.workDayEndHour - workConfig.workDayStartHour) * 3_600_000;
    const endISO = new Date(new Date(startISO).getTime() + durMs).toISOString();
    const change = moveJobToSlot(jobs, jobId, new Date(startISO).toISOString(), endISO);
    setCascade(false);
    preview.stage({
      changes: [change], label: `Move ${job.name}`, mode: 'edit', primaryJobId: jobId,
      commit: (eff) => onApplySchedule(eff, `Move ${job.name}`),
    });
    setPendingMoveId(jobId);
  };
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (`handleDropJob` is already passed to `ProductionBoard.onDropJob`, whose type now accepts the 3rd arg from Task 3.)

- [ ] **Step 4: Run the view + board suites**

Run: `npx vitest run components/views/JobScheduling/ProductionBoard.test.tsx services/scheduleEngine.test.ts`
Expected: PASS. (Full runtime behavior verified in the final verify step.)

- [ ] **Step 5: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat(scheduling): dropping a shift bar stages a single-shift move preview

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Cascade scope narrows to the moved shift's members

When cascade is toggled ON for a staged shift move, downstream jobs should slide only if they share the **moved shift's** members — not the whole job's crew. Job-granular cascade otherwise stays exactly as designed.

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`
- Test: `services/scheduleEngine.test.ts` (or `services/rescheduleIssues.test.ts` — wherever `sharedCrewScope` is tested) for the scope-from-shift helper; the view wiring is verified at runtime.

**Interfaces:**
- Consumes: the staged primary `ProposedChange` (now possibly carrying `shiftId`), `sharedCrewScope` / `scopeForJob` (view-local, ~line 444), the moved job's `allocations`.
- Produces: `scopeForJob(jobId)` gains awareness of a staged `shiftId`: when the staged primary change for `jobId` has a `shiftId`, the crew scope is that allocation's `memberIds`; otherwise the job's full crew (unchanged).

- [ ] **Step 1: Read the current scope helper**

Inspect `scopeForJob` and `scopeForPrimary` around view line 444–468. Confirm cascade followers are computed via `cascadeFromEdit(jobs, primaryChange, workConfig, cascadeUntil, scopeForJob(primaryChange.jobId))`.

- [ ] **Step 2: Write a failing test for the scope source**

The pure, testable seam is "given a job and a shift id, the cascade scope is the shift's members." Add to `services/scheduleEngine.test.ts` (or the shared-scope test file) a test for a small helper `shiftCrewScope(job, shiftId)`:

```ts
import { shiftCrewScope } from './scheduleEngine';

describe('shiftCrewScope', () => {
  const job = { id: 'j1', allocations: [
    { id: 's1', memberIds: ['m1', 'm2'] },
    { id: 's2', memberIds: ['m3'] },
  ]} as unknown as Job;

  it('returns only the named shift members', () => {
    expect(shiftCrewScope(job, 's1').sort()).toEqual(['m1', 'm2']);
  });
  it('falls back to all crew when shiftId is undefined', () => {
    expect(shiftCrewScope(job, undefined).sort()).toEqual(['m1', 'm2', 'm3']);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t shiftCrewScope`
Expected: FAIL — `shiftCrewScope is not a function`.

- [ ] **Step 4: Implement the helper + wire it**

In `services/scheduleEngine.ts`:

```ts
/** Cascade crew scope for a (possibly shift-scoped) move: the named shift's members
 *  when `shiftId` is given, else the union of all the job's shift members. */
export const shiftCrewScope = (job: Job, shiftId: string | undefined): string[] => {
  const allocs = job.allocations ?? [];
  if (shiftId) return [...(allocs.find(a => a.id === shiftId)?.memberIds ?? [])];
  return Array.from(new Set(allocs.flatMap(a => a.memberIds ?? [])));
};
```

In `JobSchedulingView.tsx`, make `scopeForJob` consult the staged change's `shiftId`:

```ts
  const scopeForJob = (jobId: string): string[] => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return [];
    const staged = preview.staged?.changes.find(c => c.jobId === jobId && !c.skipped);
    if (staged?.shiftId) return sharedCrewScope(jobs, shiftCrewScope(job, staged.shiftId));
    return sharedCrewScope(jobs, /* existing full-crew argument */);
  };
```

> Match the exact current signature of `scopeForJob`/`sharedCrewScope` when editing — preserve the non-shift branch verbatim; only add the `staged?.shiftId` short-circuit. Import `shiftCrewScope` in the view's `scheduleEngine` import list.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run services/scheduleEngine.test.ts` and `npx tsc --noEmit`
Expected: PASS + clean.

- [ ] **Step 6: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts components/views/JobSchedulingView.tsx
git commit -m "feat(scheduling): cascade scope narrows to the moved shift's members

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Day-board block drag edits the shift's per-day window

Dragging a shift block on the day board currently writes `job.dailyHours` (wrong target — boards read the shift's window). Carry the block's `shiftId` into `onChangeDayWindow` and route it to `setAllocDayWindow` for shift blocks.

**Files:**
- Modify: `components/views/JobScheduling/DayBoard.tsx`, `components/views/JobSchedulingView.tsx`
- Test: `components/views/JobScheduling/DayBoard.test.tsx`

**Interfaces:**
- Consumes: `DayBlock.card.shiftId` (present since Phase 4), `shiftDayWindow`, `setAllocDayWindow` (from `services/shifts.ts`).
- Produces: `DayBoardProps.onChangeDayWindow` widens to `(jobId: string, dayKey: string, window: {startTime; endTime}, shiftId?: string) => void`. The block drag passes `block.card.shiftId`. In the view, `handleChangeDayWindow` writes the shift's window (`setAllocDayWindow`) when `shiftId` is present, else the job's (unchanged).

- [ ] **Step 1: Write the failing test**

Add to `components/views/JobScheduling/DayBoard.test.tsx` (mirror the existing block-drag test's event sequence; assert the shift id reaches the callback):

```ts
it('block drag passes the shift id to onChangeDayWindow', () => {
  const onChangeDayWindow = vi.fn();
  // lane with a shift block (shiftId 's1')
  render(<DayBoard lanes={shiftLane} dayKey={dayKey} config={config}
    canReschedule onChangeDayWindow={onChangeDayWindow} /* ...other required props */ />);
  const block = screen.getByText('Prep', { exact: false }).closest('[data-shift-id]') as HTMLElement;
  dragBlockBy(block, /* deltaY */ 40); // helper mirroring the existing day-board drag test
  expect(onChangeDayWindow).toHaveBeenCalledWith('job-1', dayKey, expect.any(Object), 's1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/DayBoard.test.tsx -t "shift id to onChangeDayWindow"`
Expected: FAIL — callback gets 3 args, no shift id.

- [ ] **Step 3: Implement**

In `DayBoard.tsx`:

1. Widen the prop:
```ts
  onChangeDayWindow?: (jobId: string, dayKey: string, window: { startTime: string; endTime: string }, shiftId?: string) => void;
```

2. Store `shiftId` in the drag ref and pass it on `onUp`. The `dragRef` type gains `shiftId?: string`; `onPointerDown` seeds it from `block.card.shiftId`; the `onUp` handler calls:
```ts
      onChangeDayWindow?.(d.jobId, dayKey, next, d.shiftId);
```
(Locate the `onPointerDown` that sets `dragRef.current = { jobId: ..., startY, colHeight, window, moved: false }` and add `shiftId: block.card.shiftId`.)

In `JobSchedulingView.tsx`, make `handleChangeDayWindow` shift-aware:

```ts
  const handleChangeDayWindow = (jobId: string, dayKey: string, window: { startTime: string; endTime: string }, shiftId?: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    if (shiftId) { onUpdateJob(setAllocDayWindow(job, shiftId, dayKey, window)); return; }
    const prevStart = job.dailyHours?.[dayKey]?.startTime
      ?? `${String(workConfig.workDayStartHour).padStart(2, '0')}:00`;
    if (window.startTime !== prevStart) {
      handleShiftStartTime(jobId, dayKey, window.startTime);
    } else {
      onUpdateJob(setJobDayWindow(job, dayKey, window));
    }
  };
```

Ensure `setAllocDayWindow` is imported in the view (from `../../services/shifts`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/DayBoard.test.tsx` and `npx tsc --noEmit`
Expected: PASS (new + existing, incl. legacy job block with `shiftId` undefined) + clean.

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/DayBoard.tsx components/views/JobSchedulingView.tsx components/views/JobScheduling/DayBoard.test.tsx
git commit -m "feat(scheduling): day board block drag edits the shift's per-day window

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Drag-assign shift picker

Dropping a job onto a member (crew week board or day-board lane) must target a shift. One shift → assign into it directly. Multiple shifts → a small picker (each shift + "New shift"). The assign write path (`setMemberDayHours` / `assignMemberWeek`) already takes a trailing `shiftId`.

**Files:**
- Create: `components/views/JobScheduling/ShiftPickerModal.tsx`
- Create: `components/views/JobScheduling/ShiftPickerModal.test.tsx`
- Modify: `components/views/JobSchedulingView.tsx`

**Interfaces:**
- Consumes: `Job`, `JobCrewAllocation`. The view's existing assign state (`assignJobId`, `assignMemberId`) and `handleAssignDaysSubmit`.
- Produces:
  - `ShiftPickerModal` — props `{ open: boolean; job: Job; onPick: (shiftId: string | 'new') => void; onClose: () => void }`. Renders one button per `job.allocations` (name + span) and a "New shift" button. Picking calls `onPick(shiftId)`; "New shift" calls `onPick('new')`.
  - View: a new `assignShiftId` state; drop-on-member resolves the target shift: 0/1 shift → set `assignShiftId` to the primary (or a new shift) and open the Assign Hours modal directly; 2+ shifts → open `ShiftPickerModal`, and on pick set `assignShiftId` then open Assign Hours. `handleAssignDaysSubmit` passes `assignShiftId` into `setMemberDayHours`.

- [ ] **Step 1: Write the failing component test**

Create `components/views/JobScheduling/ShiftPickerModal.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ShiftPickerModal } from './ShiftPickerModal';
import type { Job } from '../../../types';

const job = { id: 'j1', name: 'J', allocations: [
  { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-07-06', endDate: '2026-07-06', startTime: '08:00', endTime: '12:00' },
  { id: 's2', name: 'Finish', memberIds: ['m2'], startDate: '2026-07-08', endDate: '2026-07-08', startTime: '13:00', endTime: '17:00' },
]} as unknown as Job;

describe('ShiftPickerModal', () => {
  it('lists each shift and a New shift option, and reports the pick', () => {
    const onPick = vi.fn();
    render(<ShiftPickerModal open job={job} onPick={onPick} onClose={() => {}} />);
    expect(screen.getByText('Prep')).toBeInTheDocument();
    expect(screen.getByText('Finish')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Finish'));
    expect(onPick).toHaveBeenCalledWith('s2');
  });

  it('reports a New shift pick', () => {
    const onPick = vi.fn();
    render(<ShiftPickerModal open job={job} onPick={onPick} onClose={() => {}} />);
    fireEvent.click(screen.getByText(/new shift/i));
    expect(onPick).toHaveBeenCalledWith('new');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/ShiftPickerModal.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ShiftPickerModal`**

Create `components/views/JobScheduling/ShiftPickerModal.tsx`. Follow the styling of an existing small modal in the same folder (e.g. the assign/crew modal) for the overlay/card shell; keep it minimal:

```tsx
import React from 'react';
import type { Job } from '../../../types';
import { formatDisplayDate } from '../../../services/scheduleEngine';

interface Props {
  open: boolean;
  job: Job;
  onPick: (shiftId: string | 'new') => void;
  onClose: () => void;
}

/** Choose which shift a dropped job assigns into, when the job has 2+ shifts. */
export const ShiftPickerModal: React.FC<Props> = ({ open, job, onPick, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-80 rounded-lg bg-white p-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Assign to which shift?</h3>
        <div className="space-y-2">
          {(job.allocations ?? []).map(a => (
            <button key={a.id} onClick={() => onPick(a.id)}
              className="flex w-full items-center justify-between rounded border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">
              <span className="font-medium text-slate-800">{a.name}</span>
              <span className="text-xs text-slate-500">
                {a.startDate ? formatDisplayDate(a.startDate) : ''}
              </span>
            </button>
          ))}
          <button onClick={() => onPick('new')}
            className="w-full rounded border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            + New shift
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run the component test**

Run: `npx vitest run components/views/JobScheduling/ShiftPickerModal.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into the view**

In `JobSchedulingView.tsx`:

1. Import `ShiftPickerModal`; add state:
```ts
  const [pickerJobId, setPickerJobId] = useState<string | null>(null);
  const [assignShiftId, setAssignShiftId] = useState<string | undefined>(undefined);
```

2. Replace the drop-on-member callbacks (currently `onDropJobOnMember={(memberId, jobId) => { setAssignJobId(jobId); setAssignMemberId(memberId); }}` and the day-board `onDropJobOnLane`) with a shared resolver:
```ts
  const beginAssign = (memberId: string, jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    const shifts = job?.allocations ?? [];
    setAssignMemberId(memberId);
    setAssignJobId(jobId);
    if (shifts.length >= 2) { setPickerJobId(jobId); return; }   // choose a shift first
    setAssignShiftId(shifts[0]?.id);                              // 0 or 1 shift → primary/new
  };
```
Point both `onDropJobOnMember` and `onDropJobOnLane` at `beginAssign`.

3. Render the picker; on pick, resolve `assignShiftId` (creating a new shift via `upsertAllocation(job, newShift(...))` through `onUpdateJob` when `'new'`), close the picker, and leave the Assign Hours modal open:
```tsx
  {pickerJobId && (
    <ShiftPickerModal open job={jobs.find(j => j.id === pickerJobId)!}
      onClose={() => { setPickerJobId(null); setAssignJobId(null); setAssignMemberId(null); }}
      onPick={(shiftId) => {
        if (shiftId === 'new') {
          const job = jobs.find(j => j.id === pickerJobId)!;
          const id = `alloc-${Date.now()}`;
          onUpdateJob(upsertAllocation(job, newShift(id, job)));
          setAssignShiftId(id);
        } else {
          setAssignShiftId(shiftId);
        }
        setPickerJobId(null);
      }} />
  )}
```

4. In `handleAssignDaysSubmit`, pass the chosen shift into the write:
```ts
        next = setMemberDayHours(next, member.id, k, h, assignShiftId);
```
and clear `assignShiftId` alongside the existing resets. Import `upsertAllocation`, `newShift` from `../../services/shifts`.

- [ ] **Step 6: Typecheck + suites**

Run: `npx tsc --noEmit` and `npx vitest run components/views/JobScheduling/ShiftPickerModal.test.tsx`
Expected: clean + PASS. (Full drag-assign flow verified at runtime.)

- [ ] **Step 7: Commit**

```bash
git add components/views/JobScheduling/ShiftPickerModal.tsx components/views/JobScheduling/ShiftPickerModal.test.tsx components/views/JobSchedulingView.tsx
git commit -m "feat(scheduling): drag-assign shift picker targets a shift on drop

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Full-suite verification + runtime verify

**Files:** none (verification only).

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all pass (baseline was 541; this phase adds ~11 tests → ~552). No regressions.

- [ ] **Step 3: Runtime verify (verify skill)**

Seed a two-shift job in `data/mockData.ts` (Prep + Finish, overlapping members — as used in Phase 4 verification), start the Vite dev server, drive Chromium via Playwright, and confirm:
1. **Week board, Job view:** drag the Prep bar to a later day → only Prep moves; Finish stays; the job's overall bar/envelope covers both.
2. **Cascade ON:** a downstream job sharing Prep's member slides; a downstream job sharing only Finish's member does NOT.
3. **Day board:** drag a Prep block's time → only Prep's window changes for that day (Finish untouched).
4. **Drag-assign:** drag a two-shift job onto a member → picker appears; choose Finish → Assign Hours writes into Finish's `hoursAssignments`.
Then revert the `data/mockData.ts` seed (`git checkout -- data/mockData.ts`).

- [ ] **Step 4: Finish the branch**

Announce and use **superpowers:finishing-a-development-branch** — verify tests, present the 4 options, execute the user's choice.

---

## Self-Review

**Spec coverage (design §5, §6):**
- §6 "drag a shift bar moves only that shift; envelope recomputes" → Tasks 1, 2, 3, 4. ✅
- §6 "cascade ON: job-granular, shift as trigger, scope = moved shift's members" → Task 5. ✅
- §6 "same-job shift overlaps caught by existing same-day conflict resolution" → no new code; existing `resolveSameDayConflicts` runs on apply (noted, no task needed). ✅
- §5 "drag-a-job-onto-a-member needs a shift target; multiple ⇒ picker or New shift" → Task 7. ✅
- §5 "Assign Hours modal / assignMemberWeek take the shiftId" → Task 7 (write path already parameterized in Phase 3; view now supplies it). ✅
- Day-board shift-block window edit (drag) → Task 6 (correctness gap surfaced during planning). ✅

**Deferred (unchanged), per design "Out of scope":** shift-granular cascade; month-view per-shift split. Not touched.

**Placeholder scan:** none — every code step shows the code; each test step shows the assertion.

**Type consistency:** `onDropJob(jobId, dayKey, shiftId?)` (Task 3) matches `handleDropJob(jobId, dayKey, shiftId?)` (Task 4). `onChangeDayWindow(jobId, dayKey, window, shiftId?)` (Task 6) matches `handleChangeDayWindow` (Task 6). `ProposedChange.shiftId` (Task 2) consumed by `scopeForJob`/`shiftCrewScope` (Task 5) and `applyChangeToJob` (Task 2). `ShiftPickerModal.onPick(shiftId | 'new')` (Task 7) matches the view's pick handler. `moveAllocation` (Task 1) is available for non-preview callers; the preview path re-keys inline in `applyChangeToJob` to avoid a `shifts.ts` ↔ `scheduleEngine.ts` import cycle (documented in Task 2).
