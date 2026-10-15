# Job Scheduling Shifts — Phase 3 (Hours Grid Shift-Aware) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the crew Hours grid show one chip per **(job, shift)** instead of per job — a member in two shifts on the same job that day gets two chips, each with its shift's window/hours — and route each chip's hours edit to the correct shift.

**Architecture:** `buildCrewHoursGrid` emits a `MemberDayCell` per shift the member works that day (for jobs that have allocations), falling back to one cell per job for legacy jobs with no allocations. Cells carry `shiftId`/`shiftName`; the `EditableHoursChip` edit/remove callbacks thread `shiftId` into the Phase 1 shift-targeted writers. Day/week roll-ups are unchanged because per-shift hours sum to the same job total.

**Tech Stack:** TypeScript, Vitest + @testing-library/react.

## Global Constraints

- A shift's window on a day = `allocDayWindow(alloc, day)` (Phase 1). A shift's member-day hours = granular `hoursAssignments[member][day]` if present, else the shift window length.
- Per-shift cells must sum to the existing per-job total: `dayTotals`, `weekTotal`, capacity math stay numerically identical.
- Legacy jobs (`crewMemberIds`, no `allocations`) keep exactly today's single-chip-per-job behavior (`shiftId` undefined → writes default to the primary shift).
- `npx tsc --noEmit` and `npx vitest run` stay green.

## Interfaces produced

```ts
// services/crewHoursGrid.ts
memberShiftDayHours(alloc: JobCrewAllocation, memberId: string, dateKey: string): number
// MemberDayCell gains: shiftId?: string; shiftName?: string
// CrewHoursGrid props onEditDay/onRemoveDay gain a trailing optional shiftId?: string
```

---

### Task 1: `MemberDayCell` shift fields + `memberShiftDayHours`

**Files:**
- Modify: `services/crewHoursGrid.ts` (`MemberDayCell` interface ~line 8; add `memberShiftDayHours` near `memberJobDayHours` ~line 84)
- Test: `services/crewHoursGrid.test.ts`

**Interfaces:**
- Consumes: `allocDayWindow` (already imported), the private `allocWindowHours` (already present).
- Produces: `memberShiftDayHours`; `MemberDayCell.shiftId?`, `MemberDayCell.shiftName?`.

- [ ] **Step 1: Write the failing test**

Append to `services/crewHoursGrid.test.ts` (import `memberShiftDayHours` in the existing `from './crewHoursGrid'` line):

```ts
describe('memberShiftDayHours', () => {
  const alloc = { id: 'prep', name: 'Prep', startDate: '2026-06-08', endDate: '2026-06-09',
    startTime: '08:00', endTime: '12:00', memberIds: ['m1'] } as any;

  it('returns granular hours when set', () => {
    const a = { ...alloc, hoursAssignments: { m1: { '2026-06-08': 3 } } };
    expect(memberShiftDayHours(a, 'm1', '2026-06-08')).toBe(3);
  });

  it('falls back to the shift window length when no granular map', () => {
    expect(memberShiftDayHours(alloc, 'm1', '2026-06-08')).toBe(4); // 08:00–12:00
  });

  it('returns 0 when the member is not in the shift or the day is outside the span', () => {
    expect(memberShiftDayHours(alloc, 'm2', '2026-06-08')).toBe(0);
    expect(memberShiftDayHours(alloc, 'm1', '2026-06-20')).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/crewHoursGrid.test.ts -t "memberShiftDayHours"`
Expected: FAIL — "memberShiftDayHours is not a function".

- [ ] **Step 3: Implement**

In `services/crewHoursGrid.ts`, add `shiftId?: string; shiftName?: string;` to `MemberDayCell`:

```ts
export interface MemberDayCell {
  jobId: string; jobNumber: string; jobName: string; hours: number; color: string;
  /** The shift (allocation) this chip belongs to. Undefined for legacy no-allocation jobs. */
  shiftId?: string;
  shiftName?: string;
  startTime?: string; endTime?: string;
  grossHours?: number;
  unpaidBreakHours?: number;
  breakLabel?: string;
}
```

Add `memberShiftDayHours` right after `memberJobDayHours` (~line 111):

```ts
/** Hours a member is booked to ONE shift on a day: granular map if present, else
 *  the shift's window length across its span. 0 when the member isn't in the shift
 *  or the day falls outside it. */
export const memberShiftDayHours = (alloc: JobCrewAllocation, memberId: string, dateKey: string): number => {
  if (!alloc.memberIds?.includes(memberId)) return 0;
  const map = alloc.hoursAssignments?.[memberId];
  if (map) return map[dateKey] !== undefined ? map[dateKey] : 0;
  if (alloc.startDate && alloc.endDate && dateKey >= alloc.startDate && dateKey <= alloc.endDate) return allocWindowHours(alloc, dateKey);
  return 0;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/crewHoursGrid.test.ts -t "memberShiftDayHours"`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "feat(scheduling): memberShiftDayHours + shift fields on MemberDayCell"
```

---

### Task 2: `buildCrewHoursGrid` emits one cell per (job, shift)

**Files:**
- Modify: `services/crewHoursGrid.ts` (cell-building loop in `buildCrewHoursGrid` ~lines 338-356)
- Test: `services/crewHoursGrid.test.ts`

**Interfaces:**
- Consumes: `memberShiftDayHours`, `allocDayWindow`, `jobColor`, `jobDayWindow`.

- [ ] **Step 1: Write the failing test**

Append to `services/crewHoursGrid.test.ts` (reuse the file's existing `member`, `job`, `weekKeys`, `WEEKEND` helpers; check their exact names at the top of the file and match them):

```ts
describe('buildCrewHoursGrid — per-shift chips', () => {
  it('emits one cell per shift a member works that day', () => {
    const j = job({ startDate: '2026-06-08T08:00:00', endDate: '2026-06-08T17:00:00',
      allocations: [
        { id: 'prep', name: 'Prep', startDate: '2026-06-08', endDate: '2026-06-08', startTime: '08:00', endTime: '12:00', memberIds: ['m1'], hoursAssignments: { m1: { '2026-06-08': 4 } } },
        { id: 'finish', name: 'Finish', startDate: '2026-06-08', endDate: '2026-06-08', startTime: '13:00', endTime: '17:00', memberIds: ['m1'], hoursAssignments: { m1: { '2026-06-08': 4 } } },
      ] });
    const m = member({ id: 'm1', name: 'Mike' });
    const oneDay = [new Date('2026-06-08T12:00:00')]; // matches this file's existing single-day fixture
    const model = buildCrewHoursGrid([m], [j], [], oneDay, WEEKEND, 8);
    const cells = model.rows[0].cellsByDay['2026-06-08'];
    expect(cells.map(c => c.shiftId)).toEqual(['prep', 'finish']); // sorted by window start
    expect(cells.map(c => c.hours)).toEqual([4, 4]);
    expect(cells.map(c => c.shiftName)).toEqual(['Prep', 'Finish']);
  });
});
```

`member`, `job`, `WEEKEND` are the helpers already defined at the top of `services/crewHoursGrid.test.ts`; reuse them.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/crewHoursGrid.test.ts -t "per-shift chips"`
Expected: FAIL — currently one cell per job (a single summed chip), so `shiftId` is undefined and the array shape differs.

- [ ] **Step 3: Implement**

Replace the cell-building block in `buildCrewHoursGrid` (the `for (const j of weekJobs) { ... }` body, ~lines 339-353) with a per-shift emitter:

```ts
      const cells: MemberDayCell[] = [];
      for (const j of weekJobs) {
        const pushCell = (
          gross: number,
          w: { startTime: string; endTime: string } | null,
          shiftId?: string,
          shiftName?: string,
        ) => {
          if (gross <= 0) return;
          const carve = w ? Math.min(gross, unpaidFixedBreakHoursInWindow(dayBreaks, w.startTime, w.endTime)) : 0;
          const carvingBreak = (carve > 0 && w)
            ? dayBreaks.find(b => !b.paid && b.startTime && b.startTime >= w.startTime && b.startTime < w.endTime)
            : undefined;
          cells.push({
            jobId: j.id, jobNumber: j.jobNumber, jobName: j.name, shiftId, shiftName,
            hours: round2(gross - carve), grossHours: gross,
            color: jobColor(j.id), startTime: w?.startTime, endTime: w?.endTime,
            ...(carve > 0 ? { unpaidBreakHours: carve, breakLabel: carvingBreak?.label } : {}),
          });
        };
        if (j.allocations?.length) {
          for (const alloc of j.allocations) {
            pushCell(memberShiftDayHours(alloc, m.id, key), allocDayWindow(alloc, key), alloc.id, alloc.name);
          }
        } else {
          pushCell(memberJobDayHours(j, m.id, key, standardDay), jobDayWindow(j, key), undefined, undefined);
        }
      }
```

(The `cells.sort` by `startTime` line just after stays — it now orders a member's shifts by window start.)

- [ ] **Step 4: Run the full grid suite**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS — the new per-shift case plus every existing case (single-allocation jobs now emit one cell with `shiftId` set to that allocation's id; totals unchanged).

- [ ] **Step 5: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "feat(scheduling): hours grid emits one chip per (job, shift)"
```

---

### Task 3: Thread `shiftId` through the chip + grid component

**Files:**
- Modify: `components/views/JobScheduling/CrewHoursGrid.tsx` (props ~19-22, `renderChip` ~140-150)
- Modify: `components/views/JobScheduling/EditableHoursChip.tsx` (show shift name)
- Test: `components/views/JobScheduling/CrewHoursGrid.test.tsx` (and `EditableHoursChip.test.tsx` if it asserts the label)

**Interfaces:**
- `onEditDay(memberId, dateKey, jobId, hours, shiftId?)`, `onRemoveDay(memberId, dateKey, jobId, shiftId?)`.

- [ ] **Step 1: Write the failing test**

In `components/views/JobScheduling/CrewHoursGrid.test.tsx`, add a case asserting the chip edit passes the cell's `shiftId`. Match the file's existing `model` fixture shape; give a cell a `shiftId` and simulate an hours commit:

```tsx
it('passes shiftId to onEditDay when a chip is edited', () => {
  const onEditDay = vi.fn();
  const model = /* build a model with rows[0].cellsByDay[dayKey] = [{ jobId:'j1', jobNumber:'J1', jobName:'Ext', hours:4, color:'#333', shiftId:'finish', shiftName:'Finish', startTime:'13:00', endTime:'17:00' }] */;
  render(<CrewHoursGrid model={model} canEdit onAssignWeek={()=>{}} onEditDay={onEditDay} onRemoveDay={()=>{}} onDropJobOnMember={()=>{}} />);
  const input = screen.getByLabelText(/edit/i); // the chip's hours input (match the editLabel pattern)
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: '5' } });
  expect(onEditDay).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'j1', 5, 'finish');
});
```

Build `model` by copying the minimal `CrewHoursGridModel` shape the other tests in this file already construct (dayKeys, one row with cellsByDay/offByDay/availByDay/breaksByDay/weekTotal/capacity/etc.). If the existing tests import a model factory, reuse it and just set the cell fields.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx -t "shiftId"`
Expected: FAIL — `onEditDay` is called with 4 args today (no `shiftId`).

- [ ] **Step 3: Implement**

In `CrewHoursGrid.tsx`, widen the prop types:

```tsx
  onEditDay: (memberId: string, dateKey: string, jobId: string, hours: number, shiftId?: string) => void;
  onRemoveDay: (memberId: string, dateKey: string, jobId: string, shiftId?: string) => void;
```

Update `renderChip` to key by shift and pass `shiftId`:

```tsx
  const renderChip = (row: MemberRow, k: string, cell: MemberDayCell) => (
    <EditableHoursChip
      key={`${cell.jobId}:${cell.shiftId ?? ''}`}
      cell={cell}
      canEdit={canEdit}
      editLabel={t('views.JobScheduling.CrewHoursGrid.editLabel', { jobNumber: cell.jobNumber, name: row.name, date: k })}
      onSelectJob={onSelectJob}
      onCommit={(hours) => onEditDay(row.memberId, k, cell.jobId, hours, cell.shiftId)}
      onRemove={() => onRemoveDay(row.memberId, k, cell.jobId, cell.shiftId)}
    />
  );
```

In `EditableHoursChip.tsx`, surface the shift name so two same-job chips are distinguishable — extend the title and the time line:

```tsx
      title={`${cell.jobNumber} · ${cell.jobName}${cell.shiftName ? ` · ${cell.shiftName}` : ''}`}
```

and in the time-line block:

```tsx
        {cell.startTime && cell.endTime && (
          <div className="truncate text-[10px] font-medium text-white/70 leading-tight">
            {cell.shiftName ? `${cell.shiftName} · ` : ''}{fmtClock(cell.startTime)}–{fmtClock(cell.endTime)}
          </div>
        )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx components/views/JobScheduling/EditableHoursChip.test.tsx`
Expected: PASS. If `EditableHoursChip.test.tsx` asserted an exact time-line string, update that expectation to include the shift-name prefix only when `shiftName` is set (existing fixtures without `shiftName` are unaffected).

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/CrewHoursGrid.tsx components/views/JobScheduling/EditableHoursChip.tsx components/views/JobScheduling/CrewHoursGrid.test.tsx
git commit -m "feat(scheduling): hours chips carry shiftId and shift name"
```

---

### Task 4: Route the view's hours edits to the shift

**Files:**
- Modify: `components/views/JobSchedulingView.tsx` (`handleHoursEditDay` ~789, `handleHoursRemoveDay` ~795, `handleEditBlockHours`/`handleRemoveBlockHours` ~871-876)

**Interfaces:**
- Consumes: `setMemberDayHoursPreservingSpan(..., shiftId?)`, `setMemberDayHours(..., shiftId?)` (Phase 1).

- [ ] **Step 1: Update the handlers to accept + forward `shiftId`**

`handleHoursEditDay` / `handleHoursRemoveDay`:

```tsx
  const handleHoursEditDay = (memberId: string, dateKey: string, jobId: string, hours: number, shiftId?: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    onUpdateJob(setMemberDayHoursPreservingSpan(job, memberId, dateKey, hours, workConfig.weekendDays, capacityHours, shiftId));
  };
  const handleHoursRemoveDay = (memberId: string, dateKey: string, jobId: string, shiftId?: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    onUpdateJob(setMemberDayHoursPreservingSpan(job, memberId, dateKey, 0, workConfig.weekendDays, capacityHours, shiftId));
  };
```

The day-view block wrappers just forward whatever they already pass (no `shiftId` → primary shift), so they keep compiling unchanged:

```tsx
  const handleEditBlockHours = (memberId: string, jobId: string, hours: number) => {
    handleHoursEditDay(memberId, selectedDayKey, jobId, hours);
  };
  const handleRemoveBlockHours = (memberId: string, jobId: string) => {
    handleHoursRemoveDay(memberId, selectedDayKey, jobId);
  };
```

(No change needed to the `CrewHoursGrid` usage sites — they pass `onEditDay={handleHoursEditDay}` / `onRemoveDay={handleHoursRemoveDay}` by reference, now 5-arg-compatible.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Full suite**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 4: Runtime verify (the surface)**

Start the app (`npm run dev`), sign in, open **Crew → Hours**. Pick a job with two shifts (create one via Phase 2's Manage crew if needed: split a job into a morning + afternoon shift for one member). Confirm that member's day cell shows **two chips** with the shift names/windows, editing one chip's hours changes only that shift, and the day/week totals stay consistent. Capture a screenshot.

- [ ] **Step 5: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat(scheduling): route hours-grid edits to the chip's shift"
```

---

### Task 5: Full-suite + typecheck gate

- [ ] **Step 1:** `npx tsc --noEmit` → exit 0.
- [ ] **Step 2:** `npx vitest run` → all pass.
- [ ] **Step 3:** Commit any fixup (else nothing).

---

## Roadmap — remaining phases

- **Phase 4 — Boards shift-aware.** Day + week boards render one bar per `(job, shift)`; `BoardCard` gains shift identity, `layoutLaneBars` keys by `(jobId, shiftId)`, day-board blocks use `allocDayWindow`. Drag-assign onto a member offers a shift picker when the job has multiple shifts.
- **Phase 5 — Drag a shift + cascade.** Dragging a shift bar moves only that shift (then `recomputeJobEnvelope`); Cascade ON slides downstream jobs sharing the moved shift's members.

## Self-Review

- **Spec coverage (Phase 3 scope):** per-(job,shift) chips ✅ (Task 2); shift window/hours ✅ (Task 1 + `allocDayWindow`); edit targets shift ✅ (Tasks 3–4); totals unchanged ✅ (per-shift sums equal per-job); legacy jobs unchanged ✅ (fallback branch). Boards + drag are Phases 4–5.
- **Placeholder scan:** the only non-literal spots are the two test fixtures (Task 2 week-`Date[]`, Task 3 `model`), each with an explicit instruction to copy the existing fixture pattern in that test file rather than invent — because those factories already exist there and must be matched exactly. All product code is complete.
- **Type consistency:** `memberShiftDayHours`, `shiftId`/`shiftName`, and the 5-arg `onEditDay`/`onRemoveDay` / `setMemberDayHoursPreservingSpan(..., shiftId)` signatures line up across Tasks 1–4 and Phase 1.
