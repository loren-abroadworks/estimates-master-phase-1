# Job Scheduling Shifts — Phase 1 (Data & Service Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the service/data layer treat each `JobCrewAllocation` as a shift with per-day windows — resolving windows per shift, targeting hours-writes at a specific shift, and recomputing a job's span from its shifts — so later UI phases can create, display, and edit multiple shifts.

**Architecture:** Additive type change plus pure functions in `services/`. A new `allocDayWindow` resolves a shift's window on a day; hours-write helpers gain an optional `shiftId` (defaulting to the primary/first shift, so existing single-shift behavior is unchanged); `recomputeJobEnvelope` derives `Job.startDate/endDate` from the shift bounds. No React changes in this phase.

**Tech Stack:** TypeScript, Vitest. Services live in `services/*.ts` with sibling `*.test.ts`.

## Global Constraints

- Dates in allocations are date-only `YYYY-MM-DD`; job `startDate`/`endDate` are ISO with a `T` clock.
- Time-of-day strings are `HH:mm` (24h). Hours are rounded to 1 decimal for totals, 2 for chips.
- `allocations[0]` is the **primary shift**; `shiftId` params default to it.
- Never break the passing suite: `npx vitest run` must stay green (plus the new tests).
- Follow existing file style; do not reformat untouched code.

---

### Task 1: Add per-day windows to the shift type

**Files:**
- Modify: `types.ts:458-469` (the `JobCrewAllocation` interface)

**Interfaces:**
- Produces: `JobCrewAllocation.dailyHours?: Record<string, { startTime: string; endTime: string }>`

- [ ] **Step 1: Add the field**

In `types.ts`, add `dailyHours` to `JobCrewAllocation` (right before `hoursAssignments`):

```ts
export interface JobCrewAllocation {
  id: string;
  name: string; // e.g. "Prep Crew", "Finish Team"
  memberIds: string[];
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  startTime: string; // HH:mm — shift default window
  endTime: string;   // HH:mm
  color?: string;
  /** Per-day window overrides within the shift, keyed by local 'YYYY-MM-DD'.
   *  A day absent here uses the shift's default startTime/endTime. */
  dailyHours?: Record<string, { startTime: string; endTime: string }>;
  // Granular daily hours: Map<MemberId, Map<DateStr, Hours>>
  hoursAssignments?: Record<string, Record<string, number>>;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors (the field is optional and additive).

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat(scheduling): add per-day windows to JobCrewAllocation"
```

---

### Task 2: `allocDayWindow` — resolve a shift's window on a day

**Files:**
- Modify: `services/scheduleEngine.ts` (add near the other window helpers, after `scheduledWindowHours`, ~line 187)
- Test: `services/scheduleEngine.test.ts`

**Interfaces:**
- Consumes: `JobCrewAllocation` from `../types`
- Produces: `allocDayWindow(alloc: JobCrewAllocation, dateKey: string): { startTime: string; endTime: string }`

- [ ] **Step 1: Write the failing test**

Add to `services/scheduleEngine.test.ts`:

```ts
describe('allocDayWindow', () => {
  const base = { id: 'a', name: 'Prep', memberIds: ['m1'],
    startDate: '2026-06-08', endDate: '2026-06-10', startTime: '08:00', endTime: '12:00' };

  it('returns the shift default window when the day has no override', () => {
    expect(allocDayWindow(base, '2026-06-08')).toEqual({ startTime: '08:00', endTime: '12:00' });
  });

  it('returns the per-day override when present', () => {
    const alloc = { ...base, dailyHours: { '2026-06-09': { startTime: '13:00', endTime: '17:00' } } };
    expect(allocDayWindow(alloc, '2026-06-09')).toEqual({ startTime: '13:00', endTime: '17:00' });
  });
});
```

Add `allocDayWindow` to the import at the top of the test file (the existing `from './scheduleEngine'` line).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t "allocDayWindow"`
Expected: FAIL with "allocDayWindow is not a function".

- [ ] **Step 3: Write minimal implementation**

Add to `services/scheduleEngine.ts` (after `scheduledWindowHours`, before `ReflowResult`). Add the `JobCrewAllocation` import to the existing type import from `../types`:

```ts
/** A shift's working window on one local 'YYYY-MM-DD': its per-day override when
 *  present, else the shift's default start/end time. */
export const allocDayWindow = (
  alloc: JobCrewAllocation,
  dateKey: string,
): { startTime: string; endTime: string } =>
  alloc.dailyHours?.[dateKey] ?? { startTime: alloc.startTime, endTime: alloc.endTime };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts -t "allocDayWindow"`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat(scheduling): allocDayWindow resolves a shift's per-day window"
```

---

### Task 3: `memberJobDayHours` uses the shift window (not the job window) for the no-granular fallback

**Files:**
- Modify: `services/crewHoursGrid.ts:84-111` (`memberJobDayHours`)
- Test: `services/crewHoursGrid.test.ts:62-67` (update existing expectation) + one new case

**Interfaces:**
- Consumes: `allocDayWindow` from `./scheduleEngine`
- Produces: unchanged signature `memberJobDayHours(job, memberId, dateKey, standardDay): number`

This implements the spec's "read each shift's window" for hours math. Today the fallback (a member in a shift's span with no granular hours) borrows the **job's** `dailyHours` window; it should use the **shift's** window.

- [ ] **Step 1: Update the existing test to the new (per-shift) expectation**

In `services/crewHoursGrid.test.ts`, the case at ~line 62 currently reads the job window (expects `4`). Change it to assert the **shift** window and add a per-day-override case:

```ts
  it('uses the shift window for an allocation-span day without granular hours', () => {
    const j = job({ dailyHours: { '2026-06-08': { startTime: '13:00', endTime: '17:00' } },
      allocations: [{ id: 'a', name: 'x', startDate: '2026-06-08', endDate: '2026-06-08',
        startTime: '08:00', endTime: '17:00', memberIds: ['m1'] }] });
    // Shift window 08:00–17:00 = 9h; the job-level dailyHours no longer applies here.
    expect(memberJobDayHours(j, 'm1', '2026-06-08', 9)).toBe(9);
  });

  it('honors a shift per-day window override for the fallback', () => {
    const j = job({ allocations: [{ id: 'a', name: 'x', startDate: '2026-06-08', endDate: '2026-06-08',
      startTime: '08:00', endTime: '17:00', memberIds: ['m1'],
      dailyHours: { '2026-06-08': { startTime: '08:00', endTime: '12:00' } } }] });
    expect(memberJobDayHours(j, 'm1', '2026-06-08', 9)).toBe(4);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/crewHoursGrid.test.ts -t "memberJobDayHours"`
Expected: FAIL — first case now expects `9` but current code returns `4`.

- [ ] **Step 3: Implement**

In `services/crewHoursGrid.ts`, add `allocDayWindow` to the existing `from './scheduleEngine'` import. Add a small helper next to `dayWindowHours` (~line 80):

```ts
/** Length (hours) of a shift's window on one day, honoring per-day overrides. */
const allocWindowHours = (alloc: JobCrewAllocation, dateKey: string): number => {
  const w = allocDayWindow(alloc, dateKey);
  const toH = (t: string) => { const [h, m] = t.split(':').map(Number); return h + (m || 0) / 60; };
  return Math.max(0, Math.round((toH(w.endTime) - toH(w.startTime)) * 10) / 10);
};
```

Then in `memberJobDayHours`, change the allocation fallback branch (currently ~line 98-101) from:

```ts
      } else if (alloc.startDate && alloc.endDate && dateKey >= alloc.startDate && dateKey <= alloc.endDate) {
        total += dayWindowHours(job, dateKey, standardDay);
      }
```

to:

```ts
      } else if (alloc.startDate && alloc.endDate && dateKey >= alloc.startDate && dateKey <= alloc.endDate) {
        total += allocWindowHours(alloc, dateKey);
      }
```

(The legacy `crewMemberIds` branch below it — for jobs with no allocations — keeps using `dayWindowHours(job, …)`, unchanged.)

- [ ] **Step 4: Run the full grid + engine suites to verify green**

Run: `npx vitest run services/crewHoursGrid.test.ts services/scheduleEngine.test.ts`
Expected: PASS (all cases, including the two edited/added).

- [ ] **Step 5: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "feat(scheduling): member hours fall back to the shift window per shift"
```

---

### Task 4: Target hours-writes at a specific shift

**Files:**
- Modify: `services/crewHoursGrid.ts:244-306` (`setMemberDayHours`, `setMemberDayHoursPreservingSpan`, `assignMemberWeek`)
- Test: `services/crewHoursGrid.test.ts`

**Interfaces:**
- Produces (new optional trailing param, default = primary shift):
  - `setMemberDayHours(job, memberId, dateKey, hours, shiftId?: string): Job`
  - `setMemberDayHoursPreservingSpan(job, memberId, dateKey, hours, weekendDays, standardDay, shiftId?: string): Job`
  - `assignMemberWeek(job, memberId, hoursByDay, shiftId?: string): Job`
- Consumes: existing `ensureAllocations(job)` (private) — add a private `pickAlloc(allocs, shiftId)` that returns the matching shift or `allocs[0]`.

- [ ] **Step 1: Write the failing test**

Add to `services/crewHoursGrid.test.ts`:

```ts
describe('setMemberDayHours — shift targeting', () => {
  const twoShift = () => job({ startDate: '2026-06-08T08:00:00', endDate: '2026-06-08T17:00:00',
    allocations: [
      { id: 'prep', name: 'Prep', startDate: '2026-06-08', endDate: '2026-06-08', startTime: '08:00', endTime: '12:00', memberIds: ['m1'] },
      { id: 'finish', name: 'Finish', startDate: '2026-06-08', endDate: '2026-06-08', startTime: '13:00', endTime: '17:00', memberIds: ['m1'] },
    ] });

  it('writes to the named shift, leaving the other untouched', () => {
    const out = setMemberDayHours(twoShift(), 'm1', '2026-06-08', 4, 'finish');
    expect(out.allocations!.find(a => a.id === 'finish')!.hoursAssignments).toEqual({ m1: { '2026-06-08': 4 } });
    expect(out.allocations!.find(a => a.id === 'prep')!.hoursAssignments ?? {}).toEqual({});
  });

  it('defaults to the primary (first) shift when no shiftId is given', () => {
    const out = setMemberDayHours(twoShift(), 'm1', '2026-06-08', 3);
    expect(out.allocations!.find(a => a.id === 'prep')!.hoursAssignments).toEqual({ m1: { '2026-06-08': 3 } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/crewHoursGrid.test.ts -t "shift targeting"`
Expected: FAIL — currently every write lands on `allocs[0]` (`prep`), so the first case's `finish` assertion fails.

- [ ] **Step 3: Implement**

In `services/crewHoursGrid.ts`, add a private picker next to `ensureAllocations` (~line 235):

```ts
const pickAlloc = (allocs: JobCrewAllocation[], shiftId?: string): JobCrewAllocation =>
  (shiftId && allocs.find(a => a.id === shiftId)) || allocs[0];
```

Then thread `shiftId` through the three writers. `setMemberDayHours`:

```ts
export const setMemberDayHours = (job: Job, memberId: string, dateKey: string, hours: number, shiftId?: string): Job => {
  const allocs = ensureAllocations(job);
  const alloc = pickAlloc(allocs, shiftId);
  const ha: Record<string, Record<string, number>> = { ...(alloc.hoursAssignments ?? {}) };
  const days = { ...(ha[memberId] ?? {}) };
  if (hours > 0) days[dateKey] = hours; else delete days[dateKey];
  if (Object.keys(days).length) ha[memberId] = days; else delete ha[memberId];
  alloc.hoursAssignments = ha;
  const stillHas = !!ha[memberId];
  let memberIds = alloc.memberIds ?? [];
  if (stillHas && !memberIds.includes(memberId)) memberIds = [...memberIds, memberId];
  if (!stillHas) memberIds = memberIds.filter(id => id !== memberId);
  alloc.memberIds = memberIds;
  return withFlattenedCrew(job, allocs);
};
```

`setMemberDayHoursPreservingSpan` — add `shiftId?: string` as the final param; replace `ensureAllocations(job)[0]` with `pickAlloc(ensureAllocations(job), shiftId)`, and pass `shiftId` through both `setMemberDayHours(next, memberId, k, wh, shiftId)` and the final `setMemberDayHours(next, memberId, dateKey, hours, shiftId)`:

```ts
export const setMemberDayHoursPreservingSpan = (
  job: Job, memberId: string, dateKey: string, hours: number,
  weekendDays: number[], standardDay: number, shiftId?: string,
): Job => {
  const alloc = pickAlloc(ensureAllocations(job), shiftId);
  const granular = alloc.hoursAssignments?.[memberId];
  const isImplicit = alloc.memberIds?.includes(memberId) && !(granular && Object.keys(granular).length);
  let next = job;
  if (isImplicit) {
    const atNoon = (d: string) => (d.includes('T') ? d : `${d}T12:00:00`);
    const start = (alloc.startDate ?? job.startDate ?? '').split('T')[0];
    const end = (alloc.endDate ?? alloc.startDate ?? job.endDate ?? job.startDate ?? '').split('T')[0];
    if (start) {
      for (const k of workingDayKeys(atNoon(start), atNoon(end || start), weekendDays)) {
        if (k === dateKey) continue;
        const wh = dayWindowHours(job, k, standardDay);
        if (wh > 0) next = setMemberDayHours(next, memberId, k, wh, shiftId);
      }
    }
  }
  return setMemberDayHours(next, memberId, dateKey, hours, shiftId);
};
```

`assignMemberWeek`:

```ts
export const assignMemberWeek = (job: Job, memberId: string, hoursByDay: Record<string, number>, shiftId?: string): Job => {
  const allocs = ensureAllocations(job);
  const alloc = pickAlloc(allocs, shiftId);
  const ha: Record<string, Record<string, number>> = { ...(alloc.hoursAssignments ?? {}) };
  delete ha[memberId];
  alloc.hoursAssignments = ha;
  alloc.memberIds = (alloc.memberIds ?? []).filter(id => id !== memberId);
  let next = withFlattenedCrew(job, allocs);
  for (const [k, h] of Object.entries(hoursByDay)) next = setMemberDayHours(next, memberId, k, h, shiftId);
  return next;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS (new shift-targeting cases + all existing cases — the optional param keeps old callers behaving identically).

- [ ] **Step 5: Verify view callers still compile**

The callers in `components/views/JobSchedulingView.tsx` (lines ~792, ~798, ~950) omit `shiftId`, which is valid (optional). Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "feat(scheduling): target hours-writes at a specific shift (default primary)"
```

---

### Task 5: `recomputeJobEnvelope` — derive a job's span from its shifts

**Files:**
- Modify: `services/scheduleEngine.ts` (add after `allocDayWindow`)
- Test: `services/scheduleEngine.test.ts`

**Interfaces:**
- Consumes: `allocDayWindow`, `Job`, `JobCrewAllocation`
- Produces: `recomputeJobEnvelope(job: Job): Job` — returns a job whose `startDate`/`endDate` span the earliest shift start … latest shift end (with each boundary's shift window time-of-day). Returns the job unchanged when it has no dated shifts.

- [ ] **Step 1: Write the failing test**

Add to `services/scheduleEngine.test.ts`:

```ts
describe('recomputeJobEnvelope', () => {
  it('spans earliest shift start to latest shift end with shift window times', () => {
    const j = {
      id: 'j1', jobNumber: 'J-1', name: 'Ext', stage: 'Scheduled',
      startDate: '2026-06-08T00:00:00', endDate: '2026-06-08T00:00:00',
      allocations: [
        { id: 'a', name: 'Prep', memberIds: ['m1'], startDate: '2026-06-08', endDate: '2026-06-09', startTime: '08:00', endTime: '12:00' },
        { id: 'b', name: 'Finish', memberIds: ['m2'], startDate: '2026-06-10', endDate: '2026-06-11', startTime: '13:00', endTime: '17:00' },
      ],
    } as unknown as Job;
    const out = recomputeJobEnvelope(j);
    expect(out.startDate).toBe('2026-06-08T08:00:00');
    expect(out.endDate).toBe('2026-06-11T17:00:00');
  });

  it('returns the job unchanged when there are no allocations', () => {
    const j = { id: 'j2', jobNumber: 'J-2', name: 'x', stage: 'Scheduled',
      startDate: '2026-06-08T08:00:00', endDate: '2026-06-08T17:00:00' } as unknown as Job;
    expect(recomputeJobEnvelope(j)).toEqual(j);
  });
});
```

Add `recomputeJobEnvelope` to the test file's `from './scheduleEngine'` import.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t "recomputeJobEnvelope"`
Expected: FAIL with "recomputeJobEnvelope is not a function".

- [ ] **Step 3: Implement**

Add to `services/scheduleEngine.ts` after `allocDayWindow`:

```ts
/** Recompute a job's overall span from its shifts: earliest shift start … latest
 *  shift end, each boundary carrying that shift's window time-of-day on the
 *  boundary day. Jobs with no dated shifts are returned unchanged. */
export const recomputeJobEnvelope = (job: Job): Job => {
  const dated = (job.allocations ?? []).filter(a => a.startDate && a.endDate);
  if (!dated.length) return job;
  const startAlloc = dated.reduce((a, b) => (b.startDate < a.startDate ? b : a));
  const endAlloc = dated.reduce((a, b) => (b.endDate > a.endDate ? b : a));
  const startTime = allocDayWindow(startAlloc, startAlloc.startDate).startTime;
  const endTime = allocDayWindow(endAlloc, endAlloc.endDate).endTime;
  return { ...job, startDate: `${startAlloc.startDate}T${startTime}:00`, endDate: `${endAlloc.endDate}T${endTime}:00` };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts -t "recomputeJobEnvelope"`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat(scheduling): recomputeJobEnvelope derives job span from shifts"
```

---

### Task 6: Full-suite + typecheck gate

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all files pass; no regressions.

- [ ] **Step 3: Commit (only if a fixup was needed)**

If a regression surfaced and you fixed it, commit that fix with a clear message. Otherwise nothing to commit.

---

## Roadmap — subsequent phases (each becomes its own plan)

Phase 1 (this plan) lands the data/service foundation. The next phases build on it and each gets its own detailed plan via the writing-plans skill:

- **Phase 2 — Shared shift editor UI.** Extract `ShiftList` from `WorkOrderView` (the inline card list at `WorkOrderView.tsx:571-649`) into a shared component; add a per-day window row to `CrewSelectionModal`; wire it into Job Scheduling's Details panel, the reschedule drawer's crew section, and the sidebar. Change `handleSaveCrewModal` to add/replace/delete within `job.allocations[]` (mirroring `WorkOrderView.handleUpdateCrewAllocation`) and call `recomputeJobEnvelope` after edits. Deliverable: users create/edit/delete multiple shifts with per-day windows in Job Scheduling.
- **Phase 3 — Shift-aware display.** Hours grid emits one chip per `(job, shift)` (add `shiftId`/`shiftName` to `MemberDayCell`, tint by shift); day + week boards emit one bar per `(job, shift)` (`BoardCard` gains shift identity, `layoutLaneBars` keys by `(jobId, shiftId)`, day-board blocks use `allocDayWindow`). Grid edits and drag-assign target the right shift (pass `shiftId` into the Task 4 writers; shift picker on multi-shift drop). Deliverable: the "microscale" per-shift view and editing.
- **Phase 4 — Drag a shift + cascade.** Dragging a shift bar moves only that shift (then `recomputeJobEnvelope`); with the Cascade toggle on, downstream **jobs** sharing the moved shift's members cascade via the existing job-level engine. Deliverable: shift-level rescheduling with smart cascade.

## Self-Review

- **Spec coverage (Phase 1 scope):** type field ✅ (Task 1); per-shift window resolution ✅ (Tasks 2–3); shift-targeted writes ✅ (Task 4); job-envelope recompute ✅ (Task 5). Editor, display, drag/cascade are explicitly Phases 2–4.
- **Placeholder scan:** none — every code step shows complete code and exact commands.
- **Type consistency:** `allocDayWindow`, `pickAlloc`, `recomputeJobEnvelope`, and the `shiftId?` params are used with identical names/signatures across tasks and the roadmap.
