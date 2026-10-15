# Per-Phase Crew Hours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the "Jobs This Week" panel of the crew hours grid, show each job's per-phase (work-order task) hours and let the user drag one phase onto a crew member to assign hours that count exclusively toward that phase.

**Architecture:** A phase = one `WorkOrderTask`. Phase-tagged hours reuse the existing `JobCrewAllocation` array, adding an optional `taskId` so an allocation's hours belong to one task. Existing roll-ups already sum across all allocations, so phase hours fold into the job totals automatically. Pure helpers in `services/crewHoursGrid.ts` derive phase rows and write phase hours; the React layer stays presentational.

**Tech Stack:** React + TypeScript, Tailwind, Vitest + @testing-library/react. Test command: `npx vitest run <file>`. Typecheck: `npx tsc --noEmit`.

---

## File Structure

- `types.ts` — add `taskId?` to `JobCrewAllocation` (Task 1).
- `services/crewHoursGrid.ts` — phase math: `PhaseRow`, `assignedHoursForPhaseInWeek`, `buildPhaseRows`, `setMemberPhaseDayHours`, `memberJobDayPhaseHours`; extend `JobSummary` (+`phases`) and `MemberDayCell` (+`phaseName`,`taskId`) and `buildCrewHoursGrid` (Tasks 2–5).
- `services/crewHoursGrid.test.ts` — tests for the above (Tasks 2–5).
- `components/views/JobScheduling/jobDnd.ts` — add `JOB_PHASE_DND_TYPE` (Task 6).
- `components/views/JobScheduling/CrewHoursGrid.tsx` — phase disclosure list, draggable phase rows, phase-aware chip + inline edit (Task 7).
- `components/views/JobScheduling/CrewHoursGrid.test.tsx` — tests for the above (Task 7).
- `components/views/JobScheduling/AssignHoursModal.tsx` — optional `phaseName` for the title/label (Task 8).
- `components/views/JobScheduling/AssignHoursModal.test.tsx` — test for the above (Task 8).
- `components/views/JobSchedulingView.tsx` — phase state + wiring (Task 9).

---

### Task 1: Add `taskId` to `JobCrewAllocation`

**Files:**
- Modify: `types.ts:443-454`

- [ ] **Step 1: Add the optional field**

In `types.ts`, in the `JobCrewAllocation` interface, add `taskId` right under `name`:

```typescript
export interface JobCrewAllocation {
  id: string;
  name: string; // e.g. "Prep Crew", "Finish Team"
  /** When set, this allocation's hours belong to one work-order task (a "phase"). */
  taskId?: string;
  memberIds: string[];
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  color?: string;
  // Granular daily hours: Map<MemberId, Map<DateStr, Hours>>
  hoursAssignments?: Record<string, Record<string, number>>;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (purely additive optional field).

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat: add optional taskId to JobCrewAllocation for phase-tagged hours"
```

---

### Task 2: `PhaseRow`, `assignedHoursForPhaseInWeek`, `buildPhaseRows`

**Files:**
- Modify: `services/crewHoursGrid.ts`
- Test: `services/crewHoursGrid.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `services/crewHoursGrid.test.ts`. First extend the imports at the top (the existing import block from `'./crewHoursGrid'`):

```typescript
import {
  requiredHoursForWeek, assignedHoursForJobInWeek, jobsScheduledInWeek,
  spreadWeeklyHours, eligibleDayKeys, setMemberDayHours, assignMemberWeek,
  buildCrewHoursGrid, buildPhaseRows, assignedHoursForPhaseInWeek, setMemberPhaseDayHours,
} from './crewHoursGrid';
```

Then add this describe block at the end of the file:

```typescript
describe('buildPhaseRows', () => {
  const orders = [wo({ id: 'wo1', tasks: [
    { id: 't-wash', areaName: 'Ext', description: 'Pressure Wash', quantity: 1, uom: 'ea', coats: 1, estimatedHours: 8, prepWash: true, prepScrape: false, prepCaulk: false, prepPrime: false, paintColorCode: '', paintProduct: '', paintSheen: '' },
    { id: 't-paint', areaName: 'Ext', description: 'Siding Repaint', quantity: 1, uom: 'ea', coats: 2, estimatedHours: 12, prepWash: false, prepScrape: false, prepCaulk: false, prepPrime: false, paintColorCode: '', paintProduct: '', paintSheen: '' },
    { id: 't-zero', areaName: 'Ext', description: 'No Hours', quantity: 1, uom: 'ea', coats: 1, estimatedHours: 0, prepWash: false, prepScrape: false, prepCaulk: false, prepPrime: false, paintColorCode: '', paintProduct: '', paintSheen: '' },
  ] as any })];

  it('lists each task with its estimate and the hours assigned to that phase', () => {
    const j = job({ workOrderId: 'wo1', startDate: '2026-06-08T08:00:00', endDate: '2026-06-12T17:00:00',
      allocations: [{ id: 'a', name: 'Pressure Wash', taskId: 't-wash', startDate: '2026-06-08', endDate: '2026-06-12',
        startTime: '08:00', endTime: '17:00', memberIds: ['m1'], hoursAssignments: { m1: { '2026-06-08': 5 } } }] });
    const rows = buildPhaseRows(j, orders, weekKeys, WEEKEND);
    expect(rows).toEqual([
      { taskId: 't-wash', name: 'Pressure Wash', estimated: 8, assigned: 5 },
      { taskId: 't-paint', name: 'Siding Repaint', estimated: 12, assigned: 0 },
    ]);
  });

  it('prorates a phase estimate by the job working-day share in this week', () => {
    // Job runs 10 working days; 5 fall in this week => half the estimate.
    const j = job({ workOrderId: 'wo1', startDate: '2026-06-08T08:00:00', endDate: '2026-06-19T17:00:00' });
    const rows = buildPhaseRows(j, orders, weekKeys, WEEKEND);
    expect(rows.find(r => r.taskId === 't-wash')!.estimated).toBe(4);
  });

  it('returns no rows when the job has no linked work order', () => {
    const j = job({ startDate: '2026-06-08T08:00:00', endDate: '2026-06-08T17:00:00' });
    expect(buildPhaseRows(j, orders, weekKeys, WEEKEND)).toEqual([]);
  });
});

describe('assignedHoursForPhaseInWeek', () => {
  it('sums only the matching taskId allocation across this week\'s days', () => {
    const j = job({ allocations: [
      { id: 'a', name: 'Wash', taskId: 't-wash', startDate: '2026-06-08', endDate: '2026-06-12',
        startTime: '08:00', endTime: '17:00', memberIds: ['m1', 'm2'], hoursAssignments: { m1: { '2026-06-08': 3 }, m2: { '2026-06-09': 4 } } },
      { id: 'b', name: 'Paint', taskId: 't-paint', startDate: '2026-06-08', endDate: '2026-06-12',
        startTime: '08:00', endTime: '17:00', memberIds: ['m1'], hoursAssignments: { m1: { '2026-06-08': 9 } } },
    ] });
    expect(assignedHoursForPhaseInWeek(j, 't-wash', weekKeys)).toBe(7);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: FAIL — `buildPhaseRows`/`assignedHoursForPhaseInWeek` are not exported.

- [ ] **Step 3: Implement the helpers**

In `services/crewHoursGrid.ts`, add `PhaseRow` to the exported interfaces near `JobSummary` (before `DayTotal`):

```typescript
/** One work-order task surfaced as a schedulable phase for a job this week. */
export interface PhaseRow { taskId: string; name: string; estimated: number; assigned: number; }
```

Then add these two functions after `assignedHoursForJobInWeek`:

```typescript
/** Hours assigned to one phase (task) across all members on this week's days. */
export const assignedHoursForPhaseInWeek = (job: Job, taskId: string, weekKeys: string[]): number => {
  let total = 0;
  for (const alloc of job.allocations ?? []) {
    if (alloc.taskId !== taskId) continue;
    for (const map of Object.values(alloc.hoursAssignments ?? {})) {
      for (const k of weekKeys) total += map[k] ?? 0;
    }
  }
  return round1(total);
};

/** Per-phase rows for a job: each work-order task with its week-prorated estimate
 *  and the hours already assigned to that phase. Tasks with no estimate are hidden. */
export const buildPhaseRows = (
  job: Job,
  workOrders: WorkOrder[],
  weekKeys: string[],
  weekendDays: number[],
): PhaseRow[] => {
  const wo = workOrders.find(w => w.id === job.workOrderId);
  if (!wo?.tasks?.length || !job.startDate) return [];
  const allKeys = workingDayKeys(job.startDate, job.endDate ?? job.startDate, weekendDays);
  const total = allKeys.length;
  const inWeek = allKeys.filter(k => weekKeys.includes(k)).length;
  const ratio = total ? inWeek / total : 0;
  return wo.tasks
    .map(t => ({
      taskId: t.id,
      name: t.description,
      estimated: round1((t.estimatedHours ?? 0) * ratio),
      assigned: assignedHoursForPhaseInWeek(job, t.id, weekKeys),
    }))
    .filter(p => p.estimated > 0);
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS (all, including the existing tests).

- [ ] **Step 5: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "feat: phase-row + phase-assigned helpers for crew hours"
```

---

### Task 3: `setMemberPhaseDayHours`

**Files:**
- Modify: `services/crewHoursGrid.ts`
- Test: `services/crewHoursGrid.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `services/crewHoursGrid.test.ts` (the import was already extended in Task 2):

```typescript
describe('setMemberPhaseDayHours', () => {
  it('creates a taskId allocation and records the phase day hours when none exists', () => {
    const j = job({ startDate: '2026-06-08T08:00:00', endDate: '2026-06-12T17:00:00' });
    const next = setMemberPhaseDayHours(j, 't-wash', 'Pressure Wash', 'm1', '2026-06-08', 5);
    const alloc = next.allocations!.find(a => a.taskId === 't-wash')!;
    expect(alloc.name).toBe('Pressure Wash');
    expect(alloc.hoursAssignments!.m1['2026-06-08']).toBe(5);
    expect(alloc.memberIds).toContain('m1');
    expect(next.crewMemberIds).toContain('m1');
  });

  it('rolls the phase hours into the job week total', () => {
    const j = job({ startDate: '2026-06-08T08:00:00', endDate: '2026-06-12T17:00:00' });
    const next = setMemberPhaseDayHours(j, 't-wash', 'Pressure Wash', 'm1', '2026-06-08', 5);
    expect(assignedHoursForJobInWeek(next, weekKeys, 8)).toBe(5);
  });

  it('keeps other phases untouched and scopes removal to the phase', () => {
    let j: any = job({ startDate: '2026-06-08T08:00:00', endDate: '2026-06-12T17:00:00' });
    j = setMemberPhaseDayHours(j, 't-wash', 'Pressure Wash', 'm1', '2026-06-08', 5);
    j = setMemberPhaseDayHours(j, 't-paint', 'Siding Repaint', 'm1', '2026-06-08', 6);
    // Clear the wash day; paint stays.
    j = setMemberPhaseDayHours(j, 't-wash', 'Pressure Wash', 'm1', '2026-06-08', 0);
    expect(assignedHoursForPhaseInWeek(j, 't-wash', weekKeys)).toBe(0);
    expect(assignedHoursForPhaseInWeek(j, 't-paint', weekKeys)).toBe(6);
  });

  it('does not mutate the input job', () => {
    const j = job({ startDate: '2026-06-08T08:00:00', endDate: '2026-06-12T17:00:00' });
    setMemberPhaseDayHours(j, 't-wash', 'Pressure Wash', 'm1', '2026-06-08', 5);
    expect(j.allocations).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: FAIL — `setMemberPhaseDayHours` is not exported.

- [ ] **Step 3: Implement the function**

In `services/crewHoursGrid.ts`, add after `setMemberDayHours` (it reuses the existing module-private `ensureAllocations` and `withFlattenedCrew`):

```typescript
/** Set (or clear, when hours<=0) a member's hours for one day on a specific phase
 *  (work-order task). Finds or creates the allocation carrying that taskId; legacy
 *  crew on the job is preserved via a base allocation. */
export const setMemberPhaseDayHours = (
  job: Job,
  taskId: string,
  phaseName: string,
  memberId: string,
  dateKey: string,
  hours: number,
): Job => {
  const allocs = ensureAllocations(job);
  let alloc = allocs.find(a => a.taskId === taskId);
  if (!alloc) {
    alloc = {
      id: `alloc-${job.id}-${taskId}`, name: phaseName, taskId,
      startDate: (job.startDate ?? '').split('T')[0],
      endDate: (job.endDate ?? job.startDate ?? '').split('T')[0],
      startTime: '08:00', endTime: '17:00', memberIds: [], hoursAssignments: {},
    };
    allocs.push(alloc);
  }
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "feat: setMemberPhaseDayHours writes phase-scoped crew hours"
```

---

### Task 4: Attach `phases` to each `JobSummary`

**Files:**
- Modify: `services/crewHoursGrid.ts` (`JobSummary` interface + `buildCrewHoursGrid`)
- Test: `services/crewHoursGrid.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `services/crewHoursGrid.test.ts` inside the existing `describe('buildCrewHoursGrid', ...)` block:

```typescript
  it('attaches per-phase rows to each job summary', () => {
    const staffed = job({ id: 'staffed', jobNumber: 'J-1', name: 'Staffed', workOrderId: 'wo1',
      startDate: '2026-06-08T08:00:00', endDate: '2026-06-12T17:00:00',
      allocations: [{ id: 'a', name: 'Pressure Wash', taskId: 't-wash', startDate: '2026-06-08', endDate: '2026-06-12',
        startTime: '08:00', endTime: '17:00', memberIds: ['m1'], hoursAssignments: { m1: { '2026-06-08': 5 } } }] });
    const orders = [wo({ id: 'wo1', totalProductionHours: 8, tasks: [
      { id: 't-wash', areaName: 'Ext', description: 'Pressure Wash', quantity: 1, uom: 'ea', coats: 1, estimatedHours: 8, prepWash: true, prepScrape: false, prepCaulk: false, prepPrime: false, paintColorCode: '', paintProduct: '', paintSheen: '' },
    ] as any })];
    const model = buildCrewHoursGrid([member()], [staffed], orders, weekDates, WEEKEND, 8);
    expect(model.jobs.find(j => j.jobId === 'staffed')!.phases).toEqual([
      { taskId: 't-wash', name: 'Pressure Wash', estimated: 8, assigned: 5 },
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: FAIL — `phases` is undefined on the job summary.

- [ ] **Step 3: Add `phases` to the interface and populate it**

In `services/crewHoursGrid.ts`, add `phases` to `JobSummary`:

```typescript
export interface JobSummary {
  jobId: string; jobNumber: string; jobName: string; address: string; color: string;
  estimate: number; required: number; assigned: number; missing: number;
  /** The job's working days that fall within this week, in order. */
  days: string[];
  /** Per-phase (work-order task) rows for this job this week. */
  phases: PhaseRow[];
}
```

In `buildCrewHoursGrid`, in the `jobSummaries` map, add `phases` to the returned object:

```typescript
    return {
      jobId: j.id, jobNumber: j.jobNumber, jobName: j.name, address: j.address, color: jobColor(j.id),
      estimate, required, assigned,
      missing: estimate > 0 ? Math.max(0, round1(required - assigned)) : 0,
      days: dayKeys.filter(k => jobKeys.has(k)),
      phases: buildPhaseRows(j, workOrders, dayKeys, weekendDays),
    };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS.

- [ ] **Step 5: Fix the component test fixture for the new required field**

`components/views/JobScheduling/CrewHoursGrid.test.tsx` builds a `CrewHoursGridModel` literal whose `jobs` entries now need `phases`. Add `phases: []` to BOTH job objects in the `jobs` array of the `model` constant (the `staffed` and `unstaffed` entries):

```typescript
  jobs: [
    { jobId: 'staffed', jobNumber: 'J-1', jobName: 'Staffed', address: '1 St', color: '#06b6d4', estimate: 8, required: 8, assigned: 8, missing: 0, days: ['2026-06-08'], phases: [] },
    { jobId: 'unstaffed', jobNumber: 'J-2', jobName: 'Unstaffed', address: '2 St', color: '#f97316', estimate: 20, required: 20, assigned: 0, missing: 20, days: ['2026-06-08', '2026-06-09'], phases: [] },
  ],
```

- [ ] **Step 6: Run the component test + typecheck**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts components/views/JobScheduling/CrewHoursGrid.test.tsx
git commit -m "feat: expose per-phase rows on the crew hours job summary"
```

---

### Task 5: Per-phase day-cell breakdown (`memberJobDayPhaseHours` + chip metadata)

**Files:**
- Modify: `services/crewHoursGrid.ts` (`MemberDayCell` + `memberJobDayPhaseHours` + `buildCrewHoursGrid` cell loop)
- Test: `services/crewHoursGrid.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `services/crewHoursGrid.test.ts` inside the existing `describe('buildCrewHoursGrid', ...)` block:

```typescript
  it('emits one cell per phase with its phase name and taskId', () => {
    const j = job({ id: 'multi', jobNumber: 'J-9', name: 'Multi', workOrderId: 'wo9',
      startDate: '2026-06-08T08:00:00', endDate: '2026-06-12T17:00:00',
      allocations: [
        { id: 'a', name: 'Pressure Wash', taskId: 't-wash', startDate: '2026-06-08', endDate: '2026-06-12',
          startTime: '08:00', endTime: '17:00', memberIds: ['m1'], hoursAssignments: { m1: { '2026-06-08': 3 } } },
        { id: 'b', name: 'Siding Repaint', taskId: 't-paint', startDate: '2026-06-08', endDate: '2026-06-12',
          startTime: '08:00', endTime: '17:00', memberIds: ['m1'], hoursAssignments: { m1: { '2026-06-08': 4 } } },
      ] });
    const model = buildCrewHoursGrid([member()], [j], [wo({ id: 'wo9' })], weekDates, WEEKEND, 8);
    const cells = model.rows[0].cellsByDay['2026-06-08'];
    expect(cells).toHaveLength(2);
    expect(cells.map(c => ({ name: c.phaseName, taskId: c.taskId, hours: c.hours }))).toEqual([
      { name: 'Pressure Wash', taskId: 't-wash', hours: 3 },
      { name: 'Siding Repaint', taskId: 't-paint', hours: 4 },
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: FAIL — cells have no `phaseName`/`taskId` and the job collapses to a single cell.

- [ ] **Step 3: Extend `MemberDayCell`, add the breakdown helper, use it in the cell loop**

In `services/crewHoursGrid.ts`, extend `MemberDayCell`:

```typescript
export interface MemberDayCell { jobId: string; jobNumber: string; jobName: string; hours: number; color: string; startTime?: string; endTime?: string; phaseName?: string; taskId?: string; }
```

Add this helper after `memberJobDayHours` (it mirrors that function's logic but returns a per-allocation breakdown, so the summed hours stay identical):

```typescript
/** A member's hours on one job/day broken out per phase. Allocations with a taskId
 *  surface their phase name + id; legacy hours (untagged alloc or crewMemberIds)
 *  surface as a single phase-less entry. Sum equals memberJobDayHours. */
export const memberJobDayPhaseHours = (
  job: Job,
  memberId: string,
  dateKey: string,
  standardDay: number,
): { phaseName?: string; taskId?: string; hours: number }[] => {
  if (job.allocations?.length) {
    const out: { phaseName?: string; taskId?: string; hours: number }[] = [];
    for (const alloc of job.allocations) {
      if (!alloc.memberIds?.includes(memberId)) continue;
      const memberMap = alloc.hoursAssignments?.[memberId];
      let hours = 0;
      if (memberMap) {
        if (memberMap[dateKey] !== undefined) hours = memberMap[dateKey];
      } else if (alloc.startDate && alloc.endDate && dateKey >= alloc.startDate && dateKey <= alloc.endDate) {
        hours = standardDay;
      }
      if (hours > 0) out.push({ phaseName: alloc.taskId ? alloc.name : undefined, taskId: alloc.taskId, hours });
    }
    return out;
  }
  if (job.startDate && job.crewMemberIds?.includes(memberId)) {
    const start = job.startDate.split('T')[0];
    const end = (job.endDate ?? job.startDate).split('T')[0];
    if (dateKey >= start && dateKey <= end) return [{ hours: standardDay }];
  }
  return [];
};
```

In `buildCrewHoursGrid`, replace the inner cell-building loop. Find:

```typescript
      const cells: MemberDayCell[] = [];
      for (const j of weekJobs) {
        const hours = memberJobDayHours(j, m.id, key, standardDay);
        if (hours > 0) {
          const w = jobDayWindow(j, key);
          cells.push({ jobId: j.id, jobNumber: j.jobNumber, jobName: j.name, hours, color: jobColor(j.id), startTime: w?.startTime, endTime: w?.endTime });
          weekTotal += hours;
        }
      }
      cellsByDay[key] = cells;
```

Replace with:

```typescript
      const cells: MemberDayCell[] = [];
      for (const j of weekJobs) {
        const w = jobDayWindow(j, key);
        for (const part of memberJobDayPhaseHours(j, m.id, key, standardDay)) {
          cells.push({ jobId: j.id, jobNumber: j.jobNumber, jobName: j.name, hours: part.hours, color: jobColor(j.id), startTime: w?.startTime, endTime: w?.endTime, phaseName: part.phaseName, taskId: part.taskId });
          weekTotal += part.hours;
        }
      }
      cellsByDay[key] = cells;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS — including the existing "builds member rows with cells…" test (the staffed job there uses an untagged allocation, so it still yields one cell with `phaseName`/`taskId` undefined; `toEqual` ignores undefined properties).

- [ ] **Step 5: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "feat: per-phase day-cell breakdown for the crew hours grid"
```

---

### Task 6: Add the phase drag MIME type

**Files:**
- Modify: `components/views/JobScheduling/jobDnd.ts`

- [ ] **Step 1: Add the constant**

Append to `components/views/JobScheduling/jobDnd.ts`:

```typescript
// MIME type carrying the dragged phase's work-order task id alongside JOB_DND_TYPE,
// so dropping a phase row assigns hours scoped to that task.
export const JOB_PHASE_DND_TYPE = 'application/x-job-phase-task-id';
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobScheduling/jobDnd.ts
git commit -m "feat: add JOB_PHASE_DND_TYPE drag channel"
```

---

### Task 7: CrewHoursGrid — phase list, draggable phase rows, phase-aware chips & edits

**Files:**
- Modify: `components/views/JobScheduling/CrewHoursGrid.tsx`
- Test: `components/views/JobScheduling/CrewHoursGrid.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `components/views/JobScheduling/CrewHoursGrid.test.tsx`. First, give the `staffed` job summary a phase so it can be expanded — change its `phases: []` (set in Task 4) to:

```typescript
    { jobId: 'staffed', jobNumber: 'J-1', jobName: 'Staffed', address: '1 St', color: '#06b6d4', estimate: 8, required: 8, assigned: 8, missing: 0, days: ['2026-06-08'], phases: [{ taskId: 't-wash', name: 'Pressure Wash', estimated: 8, assigned: 5 }] },
```

Then add these tests inside `describe('CrewHoursGrid', ...)`:

```typescript
  it('expands a job card to show its phase rows with assigned / estimated hours', () => {
    render(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    // Collapsed: phase not visible yet.
    expect(screen.queryByText('Pressure Wash')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /show phases for staffed/i }));
    expect(screen.getByText('Pressure Wash')).toBeInTheDocument();
    expect(screen.getByText('5 / 8h')).toBeInTheDocument();
  });

  it('passes the phase taskId when a phase row is dropped on a member', () => {
    const onDropJobOnMember = vi.fn();
    render(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={onDropJobOnMember} />);
    fireEvent.click(screen.getByRole('button', { name: /show phases for staffed/i }));

    // Drag the phase row and drop it on Mike's row.
    const data: Record<string, string> = {};
    const dt = { setData: (t: string, v: string) => { data[t] = v; }, getData: (t: string) => data[t] ?? '', effectAllowed: '' } as unknown as DataTransfer;
    fireEvent.dragStart(screen.getByText('Pressure Wash').closest('[draggable="true"]')!, { dataTransfer: dt });
    const mikeRow = screen.getByText('Mike').closest('tr')!;
    fireEvent.drop(mikeRow, { dataTransfer: dt });

    expect(onDropJobOnMember).toHaveBeenCalledWith('m1', 'staffed', 't-wash', 'Pressure Wash');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx`
Expected: FAIL — no "show phases" button exists.

- [ ] **Step 3: Update the `onDropJobOnMember` prop signature**

In `components/views/JobScheduling/CrewHoursGrid.tsx`, change the prop type:

```typescript
  /** Fired when a job (or one of its phases) is dropped onto a member row. */
  onDropJobOnMember: (memberId: string, jobId: string, taskId?: string, phaseName?: string) => void;
```

Also extend the edit/remove signatures to carry the phase, so inline chip edits hit the right allocation:

```typescript
  onEditDay: (memberId: string, dateKey: string, jobId: string, hours: number, taskId?: string, phaseName?: string) => void;
  onRemoveDay: (memberId: string, dateKey: string, jobId: string, taskId?: string, phaseName?: string) => void;
```

- [ ] **Step 4: Import the phase drag type and add phase-drag state**

At the top of the file, extend the `jobDnd` import:

```typescript
import { JOB_DND_TYPE, JOB_PHASE_DND_TYPE } from './jobDnd';
```

Add `GripVertical`-style chevron via the existing lucide import. Change line 2 import to include `ChevronDown`:

```typescript
import { AlertTriangle, CheckCircle2, GripVertical, ChevronDown } from 'lucide-react';
```

Inside the component, add expanded-cards state next to the other `useState` hooks:

```typescript
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const toggleJob = (jobId: string) => setExpandedJobs(prev => {
    const next = new Set(prev);
    next.has(jobId) ? next.delete(jobId) : next.add(jobId);
    return next;
  });
```

- [ ] **Step 5: Make the member-drop handler read the phase payload**

Replace the existing `handleMemberDrop`:

```typescript
  const handleMemberDrop = (memberId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData(JOB_DND_TYPE) || draggingJobId;
    const taskId = e.dataTransfer.getData(JOB_PHASE_DND_TYPE) || undefined;
    const phaseName = taskId ? dragPhaseName.current : undefined;
    setDragOverMemberId(null);
    setDraggingJobId(null);
    if (jobId) onDropJobOnMember(memberId, jobId, taskId, phaseName);
  };
```

Add a ref to carry the dragged phase name (dataTransfer payloads aren't readable during `dragover`, and we want the name without re-deriving it). Put it with the other hooks:

```typescript
  const dragPhaseName = React.useRef<string | undefined>(undefined);
```

Add `import React, { useState } from 'react';` already imports React; ensure `React` is in scope (it is). 

- [ ] **Step 6: Make the inline chip edits phase-aware**

In `renderChip`, the input's `onChange` and `onBlur` currently call `onEditDay`/`onRemoveDay` with 4 args. Pass the cell's phase so the right allocation is written:

```typescript
            onChange={e => {
              const raw = e.target.value;
              setDraft({ key: editKey, value: raw });
              const v = Number(raw);
              if (raw !== '' && v > 0) onEditDay(row.memberId, k, cell.jobId, v, cell.taskId, cell.phaseName);
            }}
            onBlur={() => {
              const raw = isEditing ? draft!.value : String(cell.hours);
              const v = Number(raw);
              if (raw === '' || !(v > 0)) onRemoveDay(row.memberId, k, cell.jobId, cell.taskId, cell.phaseName);
              setDraft(null);
            }}
```

And show the phase name on the chip — inside `renderChip`, under the job name block, add the phase label when present. Replace the chip's inner name `<div>` block:

```typescript
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-bold leading-tight" style={{ color: cell.color }}>
          {cell.jobName || cell.jobNumber}
        </div>
        {cell.phaseName && (
          <div className="truncate text-[10px] font-semibold text-gray-500 dark:text-gray-400 leading-tight">{cell.phaseName}</div>
        )}
        {cell.startTime && cell.endTime && (
          <div className="truncate text-[10px] font-medium text-gray-400 leading-tight">
            {fmtClock(cell.startTime)}–{fmtClock(cell.endTime)}
          </div>
        )}
      </div>
```

- [ ] **Step 7: Render the phase disclosure + rows on each job card**

In the jobs panel `<li>`, after the existing hours/missing footer block (the `<div className="mt-2.5 flex items-center justify-between gap-2">…</div>`), add the phase disclosure. Insert this just before the closing `</li>`:

```typescript
              {j.phases.length > 0 && (
                <div className="mt-3 border-t border-gray-100 dark:border-gray-700/60 pt-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleJob(j.jobId); }}
                    aria-label={`Show phases for ${j.jobName}`}
                    className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedJobs.has(j.jobId) ? '' : '-rotate-90'}`} />
                    Phases
                  </button>
                  {expandedJobs.has(j.jobId) && (
                    <ul className="mt-2 space-y-1">
                      {j.phases.map(p => {
                        const done = p.assigned >= p.estimated;
                        return (
                          <li
                            key={p.taskId}
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              e.dataTransfer.setData(JOB_DND_TYPE, j.jobId);
                              e.dataTransfer.setData(JOB_PHASE_DND_TYPE, p.taskId);
                              e.dataTransfer.effectAllowed = 'copy';
                              dragPhaseName.current = p.name;
                              setDraggingJobId(j.jobId);
                            }}
                            onDragEnd={() => { setDraggingJobId(null); setDragOverMemberId(null); dragPhaseName.current = undefined; }}
                            title={`Drag ${p.name} onto a crew member to assign its hours`}
                            className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 cursor-grab active:cursor-grabbing hover:border-gray-300 dark:hover:border-gray-600"
                          >
                            <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-700 dark:text-gray-200">{p.name}</span>
                            <span className={`text-xs font-bold tabular-nums ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{p.assigned} / {p.estimated}h</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
```

- [ ] **Step 8: Run the component tests to verify they pass**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx`
Expected: PASS — including the existing `onEditDay`/`onRemoveDay` tests. NOTE: those existing tests assert `toHaveBeenCalledWith('m1', '2026-06-08', 'staffed', 6)` and `('m1', '2026-06-08', 'staffed')`. The chip for the existing `staffed` cell has `taskId`/`phaseName` undefined, so the calls become `('m1','2026-06-08','staffed',6, undefined, undefined)` and `('m1','2026-06-08','staffed', undefined, undefined)`. Update those two assertions to include the trailing `undefined, undefined`:

```typescript
    expect(onEditDay).toHaveBeenCalledWith('m1', '2026-06-08', 'staffed', 6, undefined, undefined);
```

```typescript
    expect(onRemoveDay).toHaveBeenCalledWith('m1', '2026-06-08', 'staffed', undefined, undefined);
```

Re-run until PASS.

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `JobSchedulingView.tsx` only (its `onEditDay`/`onRemoveDay`/`onDropJobOnMember` callbacks don't yet accept the new args). Those are fixed in Task 9. If any error appears in `CrewHoursGrid.tsx` itself, fix it before committing.

- [ ] **Step 10: Commit**

```bash
git add components/views/JobScheduling/CrewHoursGrid.tsx components/views/JobScheduling/CrewHoursGrid.test.tsx
git commit -m "feat: phase disclosure list + phase-aware chips in crew hours grid"
```

---

### Task 8: AssignHoursModal — phase-scoped title & label

**Files:**
- Modify: `components/views/JobScheduling/AssignHoursModal.tsx`
- Test: `components/views/JobScheduling/AssignHoursModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `components/views/JobScheduling/AssignHoursModal.test.tsx` inside `describe('AssignHoursModal', ...)`:

```typescript
  it('shows the phase name in the title and the hours label when scoped to a phase', () => {
    render(<AssignHoursModal isOpen memberName="Mike" jobs={jobs} lockedJobId="j2" phaseName="Pressure Wash" getDays={getDays} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText(/pressure wash — mike/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/AssignHoursModal.test.tsx`
Expected: FAIL — `phaseName` is not a prop; title still reads "Assign Hours — Mike".

- [ ] **Step 3: Add the `phaseName` prop and use it in the title**

In `components/views/JobScheduling/AssignHoursModal.tsx`, add to `AssignHoursModalProps`:

```typescript
  /** When set, the modal is scoped to one phase: shown in the title and labels. */
  phaseName?: string;
```

Add `phaseName` to the destructured props:

```typescript
export const AssignHoursModal = ({ isOpen, memberName, jobs, lockedJobId, phaseName, getDays, getWarnings, getProgress, onClose, onSubmit }: AssignHoursModalProps) => {
```

Change the `Modal` title:

```typescript
    <Modal isOpen={isOpen} onClose={onClose} title={phaseName ? `${phaseName} — ${memberName}` : `Assign Hours — ${memberName}`}>
```

Change the progress block's label from `Job Hours` to reflect the phase:

```typescript
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{phaseName ? `${phaseName} Hours` : 'Job Hours'}</span>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/AssignHoursModal.test.tsx`
Expected: PASS (all tests, including the existing ones).

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/AssignHoursModal.tsx components/views/JobScheduling/AssignHoursModal.test.tsx
git commit -m "feat: phase-scoped title and label in Assign Hours modal"
```

---

### Task 9: Wire phase state through JobSchedulingView

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

This file has no test; correctness is enforced by `npx tsc --noEmit` and the unit tests of the helpers it calls. Follow the steps exactly.

- [ ] **Step 1: Import the phase writer**

In the existing import from `../../services/crewHoursGrid` (around line 36, which already imports `setMemberDayHours, memberJobDayHours, assignedHoursForJobInWeek`), add `setMemberPhaseDayHours, assignedHoursForPhaseInWeek`:

```typescript
  buildCrewHoursGrid, eligibleDayKeys, setMemberDayHours, memberJobDayHours, assignedHoursForJobInWeek,
  setMemberPhaseDayHours, assignedHoursForPhaseInWeek,
```

(Keep any other names already in that import list.)

- [ ] **Step 2: Add phase state next to the assign state**

After the existing `const [assignJobId, setAssignJobId] = useState<string | null>(null);` (line ~202), add:

```typescript
  const [assignTaskId, setAssignTaskId] = useState<string | null>(null);
  const [assignPhaseName, setAssignPhaseName] = useState<string | null>(null);
```

- [ ] **Step 3: Phase-aware inline edit handlers**

Replace `handleHoursEditDay` and `handleHoursRemoveDay` (lines ~659-669):

```typescript
  const handleHoursEditDay = (memberId: string, dateKey: string, jobId: string, hours: number, taskId?: string, phaseName?: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    onUpdateJob(taskId
      ? setMemberPhaseDayHours(job, taskId, phaseName ?? '', memberId, dateKey, hours)
      : setMemberDayHours(job, memberId, dateKey, hours));
  };

  const handleHoursRemoveDay = (memberId: string, dateKey: string, jobId: string, taskId?: string, phaseName?: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    onUpdateJob(taskId
      ? setMemberPhaseDayHours(job, taskId, phaseName ?? '', memberId, dateKey, 0)
      : setMemberDayHours(job, memberId, dateKey, 0));
  };
```

- [ ] **Step 4: Phase-scoped day prefill in `getAssignDays`**

Replace the `existing` line inside `getAssignDays` (line ~686). Find:

```typescript
    const existing = (k: string) => row?.cellsByDay[k]?.find(c => c.jobId === jobId)?.hours ?? 0;
```

Replace with:

```typescript
    const existing = (k: string) => assignTaskId
      ? (job.allocations?.find(a => a.taskId === assignTaskId)?.hoursAssignments?.[member.id]?.[k] ?? 0)
      : (row?.cellsByDay[k]?.find(c => c.jobId === jobId && !c.taskId)?.hours ?? 0);
```

Add `assignTaskId` to the `getAssignDays` dependency array (the `useCallback` deps ending `…hoursModel])`):

```typescript
  }, [jobs, allStaff, assignMemberId, assignTaskId, weekDays, workConfig.weekendDays, hoursModel]);
```

- [ ] **Step 5: Phase-scoped progress in `assignContext`**

In `assignContext`, the readout should reflect the phase when one is scoped. Replace the two lines that compute `jobTotalNow` and `estHours` (lines ~714-715). Find:

```typescript
    const jobTotalNow = assignedHoursForJobInWeek(job, jobDayKeys, standardDay);
    const estHours = workOrders.find(w => w.id === job.workOrderId)?.totalProductionHours ?? 0;
```

Replace with:

```typescript
    const task = assignTaskId ? workOrders.find(w => w.id === job.workOrderId)?.tasks.find(t => t.id === assignTaskId) : undefined;
    const jobTotalNow = assignTaskId
      ? assignedHoursForPhaseInWeek(job, assignTaskId, jobDayKeys)
      : assignedHoursForJobInWeek(job, jobDayKeys, standardDay);
    const estHours = assignTaskId
      ? (task?.estimatedHours ?? 0)
      : (workOrders.find(w => w.id === job.workOrderId)?.totalProductionHours ?? 0);
```

Add `assignTaskId` to the `assignContext` dependency array (the deps ending `…workOrders])`):

```typescript
  }, [jobs, allStaff, assignMemberId, assignTaskId, workConfig, hoursModel, workOrders]);
```

- [ ] **Step 6: Phase-scoped submit in `handleAssignDaysSubmit`**

Replace `handleAssignDaysSubmit` (lines ~741-751):

```typescript
  const handleAssignDaysSubmit = (jobId: string, hoursByDay: Record<string, number>) => {
    const job = jobs.find(j => j.id === jobId);
    const member = allStaff.find(s => s.id === assignMemberId);
    if (job && member) {
      let next = job;
      for (const [k, h] of Object.entries(hoursByDay)) {
        next = assignTaskId
          ? setMemberPhaseDayHours(next, assignTaskId, assignPhaseName ?? '', member.id, k, h)
          : setMemberDayHours(next, member.id, k, h);
      }
      onUpdateJob(next);
    }
    setAssignMemberId(null);
    setAssignJobId(null);
    setAssignTaskId(null);
    setAssignPhaseName(null);
  };
```

- [ ] **Step 7: Set phase state on drop, clear on open/close**

Update the `CrewHoursGrid` handlers (lines ~984-988). Replace the `onAssignWeek` and `onDropJobOnMember` props:

```typescript
            onAssignWeek={(memberId) => { setAssignJobId(null); setAssignTaskId(null); setAssignPhaseName(null); setAssignMemberId(memberId); }}
            onEditDay={handleHoursEditDay}
            onRemoveDay={handleHoursRemoveDay}
            onDropJobOnMember={(memberId, jobId, taskId, phaseName) => { setAssignJobId(jobId); setAssignTaskId(taskId ?? null); setAssignPhaseName(phaseName ?? null); setAssignMemberId(memberId); }}
```

- [ ] **Step 8: Pass `phaseName` to the modal and clear phase on close**

Update the `AssignHoursModal` usage (lines ~1188-1197). Add the `phaseName` prop and clear phase state in `onClose`:

```typescript
        <AssignHoursModal
            isOpen={!!assignMemberId}
            memberName={allStaff.find(s => s.id === assignMemberId)?.name ?? ''}
            jobs={(hoursModel?.jobs ?? []).map(j => ({ id: j.jobId, jobNumber: j.jobNumber, name: j.jobName }))}
            lockedJobId={assignJobId ?? undefined}
            phaseName={assignPhaseName ?? undefined}
            getDays={getAssignDays}
            getWarnings={getAssignWarnings}
            getProgress={getAssignProgress}
            onClose={() => { setAssignMemberId(null); setAssignJobId(null); setAssignTaskId(null); setAssignPhaseName(null); }}
            onSubmit={handleAssignDaysSubmit}
        />
```

(The `jobs={...}` expression is unchanged from the current file; only `phaseName` and the `onClose` body are added.)

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: wire phase-scoped assignment through Job Scheduling view"
```

---

## Self-Review Notes

- **Spec coverage:** §Data model → Tasks 1, 3, 5; §"Jobs This Week" card UI (`buildPhaseRows`, disclosure, assigned/estimated, draggable) → Tasks 2, 4, 7; §Drag → Assign flow (`JOB_PHASE_DND_TYPE`, phase scope, `setMemberPhaseDayHours`) → Tasks 6, 8, 9; §Grid cell impact (phaseName chip + `MemberDayCell.phaseName`) → Tasks 5, 7; §Testing → tests in Tasks 2–5, 7, 8.
- **Type consistency:** `PhaseRow` shape `{ taskId, name, estimated, assigned }` is used identically in `buildPhaseRows`, `JobSummary.phases`, and the component. `onDropJobOnMember(memberId, jobId, taskId?, phaseName?)`, `onEditDay(..., taskId?, phaseName?)`, `onRemoveDay(..., taskId?, phaseName?)` match between `CrewHoursGrid.tsx` and the `JobSchedulingView` handlers. `setMemberPhaseDayHours(job, taskId, phaseName, memberId, dateKey, hours)` signature matches all call sites.
- **Edge cases handled:** job with no work order/tasks → no phases, no toggle (Task 2 guard + Task 7 `j.phases.length > 0`); zero-estimate task hidden (Task 2 filter); legacy untagged hours preserved via `ensureAllocations` base allocation (Task 3) and rendered as phase-less chips (Task 5); inline edits route to the correct allocation via the cell's `taskId` (Tasks 5, 7, 9).
