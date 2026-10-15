# Weekly Crew Hours Allocation Grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a week-only "Hours" grid to the Job Scheduling Crew view where a scheduler sees and edits per-member, per-day, per-job hours, with each member's weekly capacity and each job's required/assigned/missing hours.

**Architecture:** A pure view-model service (`services/crewHoursGrid.ts`) computes the grid (member×day cells, per-member capacity, per-job required/assigned/missing) and provides job-mutation helpers. A presentational component (`CrewHoursGrid.tsx`) renders it and raises callbacks. A small modal (`AssignHoursModal.tsx`) collects a weekly total. `JobSchedulingView.tsx` adds a Board/Hours sub-toggle and wires handlers that commit immediately via the existing `onUpdateJob`. No schema change — hours live in the existing `JobCrewAllocation.hoursAssignments`.

**Tech Stack:** React 19 + TypeScript, Vitest, @testing-library/react, Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-04-crew-weekly-hours-grid-design.md`

**Conventions:**
- Run all tests: `npm test`. Run one file: `npx vitest run <path>`.
- Type-check: `npm run lint` (`tsc --noEmit`).
- Local date keys are `YYYY-MM-DD`; build `Date`s from keys as `new Date(`${key}T12:00:00`)` to dodge timezone edges (matches existing tests).
- End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

- **Create** `services/crewHoursGrid.ts` — view-model builders + job-mutation helpers (pure).
- **Create** `services/crewHoursGrid.test.ts` — unit tests for the above.
- **Create** `components/views/JobScheduling/CrewHoursGrid.tsx` — presentational grid + jobs panel.
- **Create** `components/views/JobScheduling/CrewHoursGrid.test.tsx` — component tests.
- **Create** `components/views/JobScheduling/AssignHoursModal.tsx` — week-total entry modal.
- **Modify** `components/views/JobSchedulingView.tsx` — Board/Hours sub-toggle, scale gating, render + handlers.

Type names used across tasks (defined in Task 1, reused everywhere after):
`MemberDayCell`, `MemberRow`, `JobSummary`, `CrewHoursGridModel`.

---

## Task 1: Required-hours proration (`requiredHoursForWeek`)

**Files:**
- Create: `services/crewHoursGrid.ts`
- Test: `services/crewHoursGrid.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// services/crewHoursGrid.test.ts
import { describe, it, expect } from 'vitest';
import { requiredHoursForWeek } from './crewHoursGrid';
import type { Job, WorkOrder } from '../types';

const WEEKEND = [0, 6];

const job = (over: Partial<Job> = {}): Job =>
  ({ id: 'j1', jobNumber: 'J-1', name: 'Job', stage: 'Scheduled', clientId: 'c1', estimateId: 'e1',
     address: '1 St', dateCreated: '2026-01-01', ...over } as Job);

const wo = (over: Partial<WorkOrder> = {}): WorkOrder =>
  ({ id: 'wo1', estimateId: 'e1', version: 1, status: 'Scheduled', jobName: 'Job',
     totalProductionHours: 80, tasks: [], paintSchedule: [], crewLeaderId: null, crewMemberIds: [],
     ...over } as WorkOrder);

// Week of Mon 2026-06-08 .. Fri 2026-06-12
const weekKeys = ['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12'];

describe('requiredHoursForWeek', () => {
  it('prorates a two-week job by working-day share (80h over 10 days, 5 in week = 40h)', () => {
    const j = job({ workOrderId: 'wo1', startDate: '2026-06-08T08:00:00', endDate: '2026-06-19T17:00:00' });
    const r = requiredHoursForWeek(j, [wo({ id: 'wo1' })], weekKeys, WEEKEND);
    expect(r.estimate).toBe(80);
    expect(r.required).toBe(40);
  });

  it('returns the full estimate when the job runs only in this week', () => {
    const j = job({ workOrderId: 'wo1', startDate: '2026-06-08T08:00:00', endDate: '2026-06-12T17:00:00' });
    const r = requiredHoursForWeek(j, [wo({ id: 'wo1' })], weekKeys, WEEKEND);
    expect(r.required).toBe(80);
  });

  it('reports zero estimate when there is no linked work order', () => {
    const j = job({ startDate: '2026-06-08T08:00:00', endDate: '2026-06-12T17:00:00' });
    const r = requiredHoursForWeek(j, [], weekKeys, WEEKEND);
    expect(r.estimate).toBe(0);
    expect(r.required).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: FAIL — `requiredHoursForWeek` is not exported / module not found.

- [ ] **Step 3: Write the minimal implementation**

```ts
// services/crewHoursGrid.ts
import type { CrewMember, Job, WorkOrder } from '../types';
import { workingDayKeys, toLocalDateKey } from './scheduleEngine';
import { computeWeeklyHours } from './crewWeeklyHours';

export interface MemberDayCell { jobId: string; jobNumber: string; jobName: string; hours: number; }
export interface MemberRow {
  memberId: string;
  name: string;
  role?: string;
  cellsByDay: Record<string, MemberDayCell[]>;
  offByDay: Record<string, boolean>;
  weekTotal: number;
  capacity: number;
  remaining: number;
  overCapacity: boolean;
}
export interface JobSummary {
  jobId: string; jobNumber: string; jobName: string; address: string;
  estimate: number; required: number; assigned: number; missing: number;
}
export interface CrewHoursGridModel {
  dayKeys: string[];
  rows: MemberRow[];
  jobs: JobSummary[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Estimate and this-week's prorated required hours for a job. */
export const requiredHoursForWeek = (
  job: Job,
  workOrders: WorkOrder[],
  weekKeys: string[],
  weekendDays: number[],
): { estimate: number; required: number } => {
  const estimate = workOrders.find(w => w.id === job.workOrderId)?.totalProductionHours ?? 0;
  if (!estimate || !job.startDate) return { estimate, required: 0 };
  const allKeys = workingDayKeys(job.startDate, job.endDate ?? job.startDate, weekendDays);
  const total = allKeys.length;
  if (!total) return { estimate, required: 0 };
  const inWeek = allKeys.filter(k => weekKeys.includes(k)).length;
  return { estimate, required: round1((estimate * inWeek) / total) };
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "feat: requiredHoursForWeek proration for crew hours grid

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Assigned hours + jobs-in-week (`assignedHoursForJobInWeek`, `jobsScheduledInWeek`)

**Files:**
- Modify: `services/crewHoursGrid.ts`
- Test: `services/crewHoursGrid.test.ts`

- [ ] **Step 1: Write the failing test (append to the file)**

```ts
// append to services/crewHoursGrid.test.ts
import { assignedHoursForJobInWeek, jobsScheduledInWeek } from './crewHoursGrid';

describe('assignedHoursForJobInWeek', () => {
  it('sums granular hoursAssignments across members on this week\'s days', () => {
    const j = job({ allocations: [{ id: 'a', name: 'x', startDate: '2026-06-08', endDate: '2026-06-09',
      startTime: '08:00', endTime: '17:00', memberIds: ['m1', 'm2'],
      hoursAssignments: { m1: { '2026-06-08': 8, '2026-06-09': 6 }, m2: { '2026-06-08': 4 } } }] });
    expect(assignedHoursForJobInWeek(j, weekKeys, 8)).toBe(18);
  });

  it('falls back to the standard day for allocation days without granular hours', () => {
    const j = job({ allocations: [{ id: 'a', name: 'x', startDate: '2026-06-08', endDate: '2026-06-09',
      startTime: '08:00', endTime: '17:00', memberIds: ['m1'] }] });
    expect(assignedHoursForJobInWeek(j, weekKeys, 8)).toBe(16);
  });

  it('ignores days outside the current week', () => {
    const j = job({ allocations: [{ id: 'a', name: 'x', startDate: '2026-06-05', endDate: '2026-06-08',
      startTime: '08:00', endTime: '17:00', memberIds: ['m1'],
      hoursAssignments: { m1: { '2026-06-05': 8, '2026-06-08': 8 } } }] });
    expect(assignedHoursForJobInWeek(j, weekKeys, 8)).toBe(8);
  });
});

describe('jobsScheduledInWeek', () => {
  it('includes jobs whose working-day span overlaps the week and excludes others', () => {
    const inWeek = job({ id: 'in', startDate: '2026-06-10T08:00:00', endDate: '2026-06-10T17:00:00' });
    const before = job({ id: 'before', startDate: '2026-06-01T08:00:00', endDate: '2026-06-01T17:00:00' });
    const cancelled = job({ id: 'x', stage: 'Cancelled', startDate: '2026-06-10T08:00:00', endDate: '2026-06-10T17:00:00' });
    const result = jobsScheduledInWeek([inWeek, before, cancelled], weekKeys, WEEKEND);
    expect(result.map(j => j.id)).toEqual(['in']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: FAIL — `assignedHoursForJobInWeek` / `jobsScheduledInWeek` not exported.

- [ ] **Step 3: Write the minimal implementation (append to `crewHoursGrid.ts`)**

```ts
// append to services/crewHoursGrid.ts

/** Hours a member is booked to one job on one day: granular if set, else the
 *  standard day when the day falls in the allocation span. Mirrors crewWeeklyHours. */
const memberJobDayHours = (
  job: Job,
  memberId: string,
  dateKey: string,
  standardDay: number,
): number => {
  if (job.allocations?.length) {
    let total = 0;
    for (const alloc of job.allocations) {
      if (!alloc.memberIds?.includes(memberId)) continue;
      const g = alloc.hoursAssignments?.[memberId]?.[dateKey];
      if (g !== undefined) total += g;
      else if (alloc.startDate && alloc.endDate && dateKey >= alloc.startDate && dateKey <= alloc.endDate) total += standardDay;
    }
    return total;
  }
  if (job.startDate && job.crewMemberIds?.includes(memberId)) {
    const start = job.startDate.split('T')[0];
    const end = (job.endDate ?? job.startDate).split('T')[0];
    if (dateKey >= start && dateKey <= end) return standardDay;
  }
  return 0;
};

/** Total hours booked to a job across all its members on this week's days. */
export const assignedHoursForJobInWeek = (job: Job, weekKeys: string[], standardDay: number): number => {
  const memberIds = new Set<string>(job.crewMemberIds ?? []);
  job.allocations?.forEach(a => a.memberIds?.forEach(m => memberIds.add(m)));
  let total = 0;
  for (const m of memberIds) for (const k of weekKeys) total += memberJobDayHours(job, m, k, standardDay);
  return round1(total);
};

/** Jobs (non-cancelled) whose working-day span overlaps the given week. */
export const jobsScheduledInWeek = (jobs: Job[], weekKeys: string[], weekendDays: number[]): Job[] =>
  jobs.filter(j => {
    if (j.stage === 'Cancelled' || !j.startDate) return false;
    const keys = workingDayKeys(j.startDate, j.endDate ?? j.startDate, weekendDays);
    return keys.some(k => weekKeys.includes(k));
  });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS (all Task 1 + Task 2 tests).

- [ ] **Step 5: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "feat: assigned-hours and jobs-in-week helpers for crew hours grid

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Auto-spread + eligible days (`spreadWeeklyHours`, `eligibleDayKeys`)

**Files:**
- Modify: `services/crewHoursGrid.ts`
- Test: `services/crewHoursGrid.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```ts
// append to services/crewHoursGrid.test.ts
import { spreadWeeklyHours, eligibleDayKeys } from './crewHoursGrid';
import type { CrewMember } from '../types';

const member = (over: Partial<CrewMember> = {}): CrewMember =>
  ({ id: 'm1', name: 'Mike', role: 'Painter', ...over } as CrewMember);

describe('spreadWeeklyHours', () => {
  it('splits evenly when divisible (32 over 4 days = 8 each)', () => {
    expect(spreadWeeklyHours(32, ['a', 'b', 'c', 'd'])).toEqual({ a: 8, b: 8, c: 8, d: 8 });
  });

  it('puts the remainder on the earliest days (30 over 4 = 8,8,7,7)', () => {
    expect(spreadWeeklyHours(30, ['a', 'b', 'c', 'd'])).toEqual({ a: 8, b: 8, c: 7, d: 7 });
  });

  it('returns an empty map for zero total or no days', () => {
    expect(spreadWeeklyHours(0, ['a'])).toEqual({});
    expect(spreadWeeklyHours(10, [])).toEqual({});
  });
});

describe('eligibleDayKeys', () => {
  it('keeps only working days within the job span where the member is not off', () => {
    const j = job({ startDate: '2026-06-08T08:00:00', endDate: '2026-06-10T17:00:00' });
    const m = member({ schedule: { '2026-06-09': { isOff: true } } as any });
    expect(eligibleDayKeys(j, m, weekKeys, WEEKEND)).toEqual(['2026-06-08', '2026-06-10']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: FAIL — `spreadWeeklyHours` / `eligibleDayKeys` not exported.

- [ ] **Step 3: Write the minimal implementation (append)**

```ts
// append to services/crewHoursGrid.ts

/** Distribute a weekly total as whole hours across days; remainder to earliest days. */
export const spreadWeeklyHours = (total: number, dayKeys: string[]): Record<string, number> => {
  const out: Record<string, number> = {};
  const n = dayKeys.length;
  if (n === 0 || total <= 0) return out;
  const base = Math.floor(total / n);
  let rem = total - base * n;
  for (const k of dayKeys) {
    out[k] = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
  }
  return out;
};

/** Days a member can be booked to a job this week: in the job's working span and not off. */
export const eligibleDayKeys = (job: Job, member: CrewMember, weekKeys: string[], weekendDays: number[]): string[] => {
  if (!job.startDate) return [];
  const jobKeys = new Set(workingDayKeys(job.startDate, job.endDate ?? job.startDate, weekendDays));
  return weekKeys.filter(k => jobKeys.has(k) && !member.schedule?.[k]?.isOff);
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "feat: auto-spread and eligible-day helpers for crew hours grid

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Job-mutation helpers (`setMemberDayHours`, `assignMemberWeek`)

**Files:**
- Modify: `services/crewHoursGrid.ts`
- Test: `services/crewHoursGrid.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```ts
// append to services/crewHoursGrid.test.ts
import { setMemberDayHours, assignMemberWeek } from './crewHoursGrid';

describe('setMemberDayHours', () => {
  it('creates an allocation and records the member + day hours when none exists', () => {
    const j = job({ startDate: '2026-06-08T08:00:00', endDate: '2026-06-09T17:00:00' });
    const next = setMemberDayHours(j, 'm1', '2026-06-08', 6);
    const a = next.allocations![0];
    expect(a.hoursAssignments!.m1['2026-06-08']).toBe(6);
    expect(a.memberIds).toContain('m1');
    expect(next.crewMemberIds).toContain('m1');
  });

  it('removes the member when their last day is set to zero', () => {
    const j = job({ allocations: [{ id: 'a', name: 'x', startDate: '2026-06-08', endDate: '2026-06-08',
      startTime: '08:00', endTime: '17:00', memberIds: ['m1'], hoursAssignments: { m1: { '2026-06-08': 8 } } }] });
    const next = setMemberDayHours(j, 'm1', '2026-06-08', 0);
    expect(next.allocations![0].memberIds).not.toContain('m1');
    expect(next.allocations![0].hoursAssignments!.m1).toBeUndefined();
    expect(next.crewMemberIds).not.toContain('m1');
  });
});

describe('assignMemberWeek', () => {
  it('replaces the member\'s days for the job with the new spread', () => {
    const j = job({ allocations: [{ id: 'a', name: 'x', startDate: '2026-06-08', endDate: '2026-06-12',
      startTime: '08:00', endTime: '17:00', memberIds: ['m1'], hoursAssignments: { m1: { '2026-06-08': 8, '2026-06-12': 8 } } }] });
    const next = assignMemberWeek(j, 'm1', { '2026-06-09': 8, '2026-06-10': 8 });
    expect(next.allocations![0].hoursAssignments!.m1).toEqual({ '2026-06-09': 8, '2026-06-10': 8 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: FAIL — `setMemberDayHours` / `assignMemberWeek` not exported.

- [ ] **Step 3: Write the minimal implementation (append)**

```ts
// append to services/crewHoursGrid.ts
import type { JobCrewAllocation } from '../types';

const ensureAllocations = (job: Job): JobCrewAllocation[] => {
  if (job.allocations?.length) return job.allocations.map(a => ({ ...a }));
  return [{
    id: `alloc-${job.id}`, name: 'Crew',
    startDate: (job.startDate ?? '').split('T')[0],
    endDate: (job.endDate ?? job.startDate ?? '').split('T')[0],
    startTime: '08:00', endTime: '17:00', memberIds: [],
  }];
};

const withFlattenedCrew = (job: Job, allocs: JobCrewAllocation[]): Job => ({
  ...job,
  allocations: allocs,
  crewMemberIds: Array.from(new Set(allocs.flatMap(a => a.memberIds ?? []))),
});

/** Set (or clear, when hours<=0) a member's hours for one day on one job's primary allocation. */
export const setMemberDayHours = (job: Job, memberId: string, dateKey: string, hours: number): Job => {
  const allocs = ensureAllocations(job);
  const alloc = allocs[0];
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

/** Replace a member's days for a job (clears their existing days, then applies hoursByDay). */
export const assignMemberWeek = (job: Job, memberId: string, hoursByDay: Record<string, number>): Job => {
  const allocs = ensureAllocations(job);
  const alloc = allocs[0];
  const ha: Record<string, Record<string, number>> = { ...(alloc.hoursAssignments ?? {}) };
  delete ha[memberId];
  alloc.hoursAssignments = ha;
  alloc.memberIds = (alloc.memberIds ?? []).filter(id => id !== memberId);
  let next = withFlattenedCrew(job, allocs);
  for (const [k, h] of Object.entries(hoursByDay)) next = setMemberDayHours(next, memberId, k, h);
  return next;
};
```

> Note: move the `import type { JobCrewAllocation }` line up to the existing import block at the top of the file rather than mid-file if your linter flags it; functionally either works.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "feat: job-mutation helpers for crew hours grid edits

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Assemble the grid model (`buildCrewHoursGrid`)

**Files:**
- Modify: `services/crewHoursGrid.ts`
- Test: `services/crewHoursGrid.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```ts
// append to services/crewHoursGrid.test.ts
import { buildCrewHoursGrid } from './crewHoursGrid';

const weekDates = weekKeys.map(k => new Date(`${k}T12:00:00`));

describe('buildCrewHoursGrid', () => {
  it('builds member rows with cells, capacity, and a jobs panel including unstaffed jobs', () => {
    const staffed = job({ id: 'staffed', jobNumber: 'J-1', name: 'Staffed', workOrderId: 'wo1',
      startDate: '2026-06-08T08:00:00', endDate: '2026-06-08T17:00:00',
      allocations: [{ id: 'a', name: 'x', startDate: '2026-06-08', endDate: '2026-06-08',
        startTime: '08:00', endTime: '17:00', memberIds: ['m1'], hoursAssignments: { m1: { '2026-06-08': 8 } } }] });
    const unstaffed = job({ id: 'unstaffed', jobNumber: 'J-2', name: 'Unstaffed', workOrderId: 'wo2',
      startDate: '2026-06-09T08:00:00', endDate: '2026-06-09T17:00:00' });
    const orders = [wo({ id: 'wo1', totalProductionHours: 8 }), wo({ id: 'wo2', totalProductionHours: 20 })];

    const model = buildCrewHoursGrid([member()], [staffed, unstaffed], orders, weekDates, WEEKEND, 8);

    expect(model.dayKeys).toEqual(weekKeys);
    const row = model.rows[0];
    expect(row.cellsByDay['2026-06-08']).toEqual([{ jobId: 'staffed', jobNumber: 'J-1', jobName: 'Staffed', hours: 8 }]);
    expect(row.weekTotal).toBe(8);
    expect(row.capacity).toBe(40);
    expect(row.remaining).toBe(32);

    const unstaffedSummary = model.jobs.find(j => j.jobId === 'unstaffed')!;
    expect(unstaffedSummary.required).toBe(20);
    expect(unstaffedSummary.assigned).toBe(0);
    expect(unstaffedSummary.missing).toBe(20);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: FAIL — `buildCrewHoursGrid` not exported.

- [ ] **Step 3: Write the minimal implementation (append)**

```ts
// append to services/crewHoursGrid.ts

/** Build the full crew-hours view model for one week. */
export const buildCrewHoursGrid = (
  members: CrewMember[],
  jobs: Job[],
  workOrders: WorkOrder[],
  weekDays: Date[],
  weekendDays: number[],
  standardDay: number,
): CrewHoursGridModel => {
  const dayKeys = weekDays.map(toLocalDateKey);
  const weekJobs = jobsScheduledInWeek(jobs, dayKeys, weekendDays);

  const rows: MemberRow[] = members.map(m => {
    const wh = computeWeeklyHours(m, weekDays, jobs, { standardDay });
    const cellsByDay: Record<string, MemberDayCell[]> = {};
    const offByDay: Record<string, boolean> = {};
    for (const key of dayKeys) {
      offByDay[key] = !!m.schedule?.[key]?.isOff;
      const cells: MemberDayCell[] = [];
      for (const j of weekJobs) {
        const hours = memberJobDayHours(j, m.id, key, standardDay);
        if (hours > 0) cells.push({ jobId: j.id, jobNumber: j.jobNumber, jobName: j.name, hours });
      }
      cellsByDay[key] = cells;
    }
    return {
      memberId: m.id, name: m.name, role: m.role,
      cellsByDay, offByDay,
      weekTotal: wh.assigned, capacity: wh.capacity, remaining: wh.remaining,
      overCapacity: wh.assigned > wh.capacity,
    };
  });

  const jobSummaries: JobSummary[] = weekJobs.map(j => {
    const { estimate, required } = requiredHoursForWeek(j, workOrders, dayKeys, weekendDays);
    const assigned = assignedHoursForJobInWeek(j, dayKeys, standardDay);
    return {
      jobId: j.id, jobNumber: j.jobNumber, jobName: j.name, address: j.address,
      estimate, required, assigned,
      missing: estimate > 0 ? Math.max(0, round1(required - assigned)) : 0,
    };
  });

  return { dayKeys, rows, jobs: jobSummaries };
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS (full file).

- [ ] **Step 5: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "feat: buildCrewHoursGrid view-model assembly

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `CrewHoursGrid` presentational component

**Files:**
- Create: `components/views/JobScheduling/CrewHoursGrid.tsx`
- Test: `components/views/JobScheduling/CrewHoursGrid.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/views/JobScheduling/CrewHoursGrid.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrewHoursGrid } from './CrewHoursGrid';
import type { CrewHoursGridModel } from '../../../services/crewHoursGrid';

const model: CrewHoursGridModel = {
  dayKeys: ['2026-06-08', '2026-06-09'],
  rows: [{
    memberId: 'm1', name: 'Mike', role: 'Painter',
    cellsByDay: { '2026-06-08': [{ jobId: 'staffed', jobNumber: 'J-1', jobName: 'Staffed', hours: 8 }], '2026-06-09': [] },
    offByDay: { '2026-06-08': false, '2026-06-09': false },
    weekTotal: 8, capacity: 40, remaining: 32, overCapacity: false,
  }],
  jobs: [
    { jobId: 'staffed', jobNumber: 'J-1', jobName: 'Staffed', address: '1 St', estimate: 8, required: 8, assigned: 8, missing: 0 },
    { jobId: 'unstaffed', jobNumber: 'J-2', jobName: 'Unstaffed', address: '2 St', estimate: 20, required: 20, assigned: 0, missing: 20 },
  ],
};

describe('CrewHoursGrid', () => {
  it('renders a member row, a day cell job, and the jobs panel with a missing-hours flag', () => {
    render(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} />);
    expect(screen.getByText('Mike')).toBeInTheDocument();
    expect(screen.getByText('J-1')).toBeInTheDocument();
    expect(screen.getByText(/Unstaffed/)).toBeInTheDocument();
    expect(screen.getByText(/20h missing/i)).toBeInTheDocument();
  });

  it('fires onAssignWeek with the member id when the row assign button is clicked', () => {
    const onAssignWeek = vi.fn();
    render(<CrewHoursGrid model={model} canEdit onAssignWeek={onAssignWeek} onEditDay={vi.fn()} onRemoveDay={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /assign hours to mike/i }));
    expect(onAssignWeek).toHaveBeenCalledWith('m1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx`
Expected: FAIL — module `./CrewHoursGrid` not found.

- [ ] **Step 3: Write the minimal implementation**

```tsx
// components/views/JobScheduling/CrewHoursGrid.tsx
import React from 'react';
import { User, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { CrewHoursGridModel } from '../../../services/crewHoursGrid';

interface CrewHoursGridProps {
  model: CrewHoursGridModel;
  canEdit: boolean;
  onAssignWeek: (memberId: string) => void;
  onEditDay: (memberId: string, dateKey: string, jobId: string, hours: number) => void;
  onRemoveDay: (memberId: string, dateKey: string, jobId: string) => void;
}

const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });

export const CrewHoursGrid = ({ model, canEdit, onAssignWeek, onEditDay, onRemoveDay }: CrewHoursGridProps) => (
  <div className="space-y-6">
    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left px-4 py-3 font-bold text-gray-500 dark:text-gray-400">Member</th>
            {model.dayKeys.map(k => (
              <th key={k} className="px-3 py-3 font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">{dayLabel(k)}</th>
            ))}
            <th className="px-3 py-3 font-bold text-gray-500 dark:text-gray-400">Week</th>
            <th className="px-3 py-3 font-bold text-gray-500 dark:text-gray-400">Cap</th>
          </tr>
        </thead>
        <tbody>
          {model.rows.map(row => (
            <tr key={row.memberId} className="border-b border-gray-100 dark:border-gray-700/50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold truncate">{row.name}</div>
                    {row.role && <div className="text-[11px] text-gray-400 truncate">{row.role}</div>}
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => onAssignWeek(row.memberId)}
                      aria-label={`Assign hours to ${row.name}`}
                      className="ml-2 p-1 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
              {model.dayKeys.map(k => (
                <td key={k} className="px-3 py-2 align-top">
                  {row.offByDay[k] ? (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-red-500">Off</span>
                  ) : (
                    <div className="space-y-1">
                      {row.cellsByDay[k]?.map(cell => (
                        <div key={cell.jobId} className="flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-300 text-xs font-bold">
                            {cell.jobNumber}
                          </span>
                          {canEdit ? (
                            <input
                              type="number"
                              min={0}
                              value={cell.hours}
                              onChange={e => {
                                const v = Number(e.target.value);
                                if (v <= 0) onRemoveDay(row.memberId, k, cell.jobId);
                                else onEditDay(row.memberId, k, cell.jobId, v);
                              }}
                              aria-label={`${cell.jobNumber} hours for ${row.name} on ${k}`}
                              className="w-12 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs"
                            />
                          ) : (
                            <span className="text-xs">{cell.hours}h</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              ))}
              <td className="px-3 py-2 font-bold">{row.weekTotal}h</td>
              <td className={`px-3 py-2 font-bold ${row.overCapacity ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                {row.weekTotal}/{row.capacity}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Jobs This Week</h3>
      <ul className="space-y-2">
        {model.jobs.map(j => (
          <li key={j.jobId} className="flex items-center justify-between gap-4 text-sm">
            <div className="min-w-0">
              <span className="font-bold">{j.jobNumber}</span>{' '}
              <span className="text-gray-600 dark:text-gray-300">{j.jobName}</span>
            </div>
            <div className="flex items-center gap-3 whitespace-nowrap">
              <span className="text-gray-500">{j.estimate > 0 ? `${j.required}h req` : '— req'}</span>
              <span className="text-gray-500">{j.assigned}h assigned</span>
              {j.missing > 0 ? (
                <span className="flex items-center gap-1 text-amber-600 font-bold">
                  <AlertTriangle className="w-4 h-4" /> {j.missing}h missing
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600 font-bold">
                  <CheckCircle2 className="w-4 h-4" /> staffed
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  </div>
);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/CrewHoursGrid.tsx components/views/JobScheduling/CrewHoursGrid.test.tsx
git commit -m "feat: CrewHoursGrid presentational component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `AssignHoursModal` (week-total entry)

**Files:**
- Create: `components/views/JobScheduling/AssignHoursModal.tsx`
- Test: `components/views/JobScheduling/AssignHoursModal.test.tsx`

Reuse the existing `Modal`, `Select`, `TextInput`, `Button` from `components/UI` (same imports as `JobSchedulingView.tsx`).

- [ ] **Step 1: Write the failing test**

```tsx
// components/views/JobScheduling/AssignHoursModal.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssignHoursModal } from './AssignHoursModal';

const jobs = [
  { id: 'j1', jobNumber: 'J-1', name: 'Smith St' },
  { id: 'j2', jobNumber: 'J-2', name: 'Oak Ave' },
];

describe('AssignHoursModal', () => {
  it('submits the selected job and entered weekly hours', () => {
    const onSubmit = vi.fn();
    render(<AssignHoursModal isOpen memberName="Mike" jobs={jobs} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/job/i), { target: { value: 'j2' } });
    fireEvent.change(screen.getByLabelText(/weekly hours/i), { target: { value: '24' } });
    fireEvent.click(screen.getByRole('button', { name: /assign/i }));
    expect(onSubmit).toHaveBeenCalledWith('j2', 24);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/AssignHoursModal.test.tsx`
Expected: FAIL — module `./AssignHoursModal` not found.

- [ ] **Step 3: Write the minimal implementation**

```tsx
// components/views/JobScheduling/AssignHoursModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../../UI';

export interface AssignHoursModalJob { id: string; jobNumber: string; name: string; }

interface AssignHoursModalProps {
  isOpen: boolean;
  memberName: string;
  jobs: AssignHoursModalJob[];
  onClose: () => void;
  onSubmit: (jobId: string, weeklyHours: number) => void;
}

export const AssignHoursModal = ({ isOpen, memberName, jobs, onClose, onSubmit }: AssignHoursModalProps) => {
  const [jobId, setJobId] = useState('');
  const [hours, setHours] = useState('');

  useEffect(() => {
    if (isOpen) { setJobId(jobs[0]?.id ?? ''); setHours(''); }
  }, [isOpen, jobs]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const h = Number(hours);
    if (!jobId || !Number.isFinite(h) || h <= 0) return;
    onSubmit(jobId, h);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assign Hours — ${memberName}`}>
      <div className="space-y-4">
        <div>
          <label htmlFor="assign-job" className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Job</label>
          <select
            id="assign-job"
            value={jobId}
            onChange={e => setJobId(e.target.value)}
            className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
          >
            {jobs.map(j => <option key={j.id} value={j.id}>{j.jobNumber} — {j.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="assign-hours" className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Weekly Hours</label>
          <input
            id="assign-hours"
            type="number"
            min={0}
            value={hours}
            onChange={e => setHours(e.target.value)}
            placeholder="e.g. 32"
            className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
          />
          <p className="text-xs text-gray-400 mt-2">Spreads evenly across the member's available working days for this job.</p>
        </div>
        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit} className="flex-1">Assign</Button>
        </div>
      </div>
    </Modal>
  );
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/AssignHoursModal.test.tsx`
Expected: PASS.

> If the test fails because `Modal` requires a portal/root in jsdom, check how `JobDetailsPanel.test.tsx` renders `Modal`-based UI and mirror its setup. The existing `Modal` is already exercised by other component tests, so this should work as-is.

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/AssignHoursModal.tsx components/views/JobScheduling/AssignHoursModal.test.tsx
git commit -m "feat: AssignHoursModal for weekly hour entry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Wire into `JobSchedulingView`

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

- [ ] **Step 1: Add imports**

Near the other `JobScheduling/*` imports (around line 18-28), add:

```tsx
import { CrewHoursGrid } from './JobScheduling/CrewHoursGrid';
import { AssignHoursModal } from './JobScheduling/AssignHoursModal';
import {
  buildCrewHoursGrid, eligibleDayKeys, spreadWeeklyHours,
  assignMemberWeek, setMemberDayHours,
} from '../../services/crewHoursGrid';
```

- [ ] **Step 2: Add state for the sub-toggle and the assign modal**

After the existing `const [scale, setScale] = useState<'week' | 'month'>('week');` (around line 187), add:

```tsx
  // Crew view sub-mode: the legacy card board vs. the weekly hours grid.
  const [crewBoardMode, setCrewBoardMode] = useState<'board' | 'hours'>('board');
  // Member whose weekly hours are being assigned via the modal (null = closed).
  const [assignMemberId, setAssignMemberId] = useState<string | null>(null);
```

- [ ] **Step 3: Force week scale when the Hours grid is active**

After the `handleNextMonth` definition (around line 301), add an effect:

```tsx
  // The hours grid is week-only; snap back to week if the user switches into it on month.
  useEffect(() => {
    if (view === 'crew' && crewBoardMode === 'hours' && scale === 'month') setScale('week');
  }, [view, crewBoardMode, scale]);
```

- [ ] **Step 4: Compute the grid model and active members**

After the `boardLanes` useMemo (around line 430), add:

```tsx
  const activeStaff = useMemo(() => allStaff.filter(s => s.status !== 'Inactive'), [allStaff]);

  const hoursGridActive = view === 'crew' && crewBoardMode === 'hours';

  const hoursModel = useMemo(() => (
    hoursGridActive
      ? buildCrewHoursGrid(activeStaff, displayJobs, workOrders, weekDays, workConfig.weekendDays, capacityHours)
      : null
  ), [hoursGridActive, activeStaff, displayJobs, workOrders, weekDays, workConfig.weekendDays, capacityHours]);
```

> `capacityHours` is already defined (around line 347). `workOrders` is already a prop.

- [ ] **Step 5: Add the assign/edit/remove handlers**

After `handleReassignCrew` (around line 514), add:

```tsx
  // Apply a single day's hour edit straight through (commit-immediately, no staging).
  const handleHoursEditDay = (memberId: string, dateKey: string, jobId: string, hours: number) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    onUpdateJob(setMemberDayHours(job, memberId, dateKey, hours));
  };

  const handleHoursRemoveDay = (memberId: string, dateKey: string, jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    onUpdateJob(setMemberDayHours(job, memberId, dateKey, 0));
  };

  // Week-total assignment from the modal: spread evenly over the member's eligible days.
  const handleAssignWeekSubmit = (jobId: string, weeklyHours: number) => {
    const job = jobs.find(j => j.id === jobId);
    const member = allStaff.find(s => s.id === assignMemberId);
    if (job && member) {
      const eligible = eligibleDayKeys(job, member, weekDays.map(toLocalDateKey), workConfig.weekendDays);
      onUpdateJob(assignMemberWeek(job, member.id, spreadWeeklyHours(weeklyHours, eligible)));
    }
    setAssignMemberId(null);
  };
```

> `toLocalDateKey` is already imported (line 13).

- [ ] **Step 6: Render the Board/Hours sub-toggle**

Immediately after the closing `</div>` of the Date Navigator block (around line 711, right before the `{scale === 'month' && view === 'member' && (` block), add:

```tsx
        {view === 'crew' && (
          <div className="mb-6 flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 w-full md:w-auto md:inline-flex">
            <button
              onClick={() => setCrewBoardMode('board')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${crewBoardMode === 'board' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Board
            </button>
            <button
              onClick={() => setCrewBoardMode('hours')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${crewBoardMode === 'hours' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Hours
            </button>
          </div>
        )}
```

- [ ] **Step 7: Render the grid instead of the boards when active**

Replace the board-rendering block (the `{scale === 'month' ? (<MonthBoard .../>) : (<ProductionBoard .../>)}` expression, around lines 728-795) so the hours grid takes precedence. Wrap it:

```tsx
        {hoursGridActive && hoursModel ? (
          <CrewHoursGrid
            model={hoursModel}
            canEdit={canReschedule}
            onAssignWeek={(memberId) => setAssignMemberId(memberId)}
            onEditDay={handleHoursEditDay}
            onRemoveDay={handleHoursRemoveDay}
          />
        ) : scale === 'month' ? (
          <MonthBoard
            /* ...existing MonthBoard props unchanged... */
          />
        ) : (
          <ProductionBoard
            /* ...existing ProductionBoard props unchanged... */
          />
        )}
```

> Keep the existing `MonthBoard` and `ProductionBoard` JSX exactly as-is; only add the leading `hoursGridActive && hoursModel ?` branch.

- [ ] **Step 8: Render the AssignHoursModal**

Just before the closing `</div>` of the component (after `ConfirmationModal`, around line 881), add:

```tsx
        <AssignHoursModal
          isOpen={!!assignMemberId}
          memberName={allStaff.find(s => s.id === assignMemberId)?.name ?? ''}
          jobs={(hoursModel?.jobs ?? []).map(j => ({ id: j.jobId, jobNumber: j.jobNumber, name: j.jobName }))}
          onClose={() => setAssignMemberId(null)}
          onSubmit={handleAssignWeekSubmit}
        />
```

- [ ] **Step 9: Hide the Month scale toggle when the hours grid is active**

In the scale toggle block (around lines 695-698), disable Month while the grid is active so the week-only rule is visible. Replace the Month button with:

```tsx
                <button
                  onClick={() => setScale('month')}
                  disabled={hoursGridActive}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${scale === 'month' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'} ${hoursGridActive ? 'opacity-40 cursor-not-allowed' : ''}`}
                >Month</button>
```

> `hoursGridActive` is defined in Step 4; ensure that `useMemo` block is placed above the JSX `return` (it is — Step 4 adds it among the other derived values).

- [ ] **Step 10: Type-check and run the full suite**

Run: `npm run lint`
Expected: no type errors.

Run: `npm test`
Expected: all tests pass, including the new `crewHoursGrid`, `CrewHoursGrid`, and `AssignHoursModal` suites.

- [ ] **Step 11: Manual verification**

Run: `npm run dev`, open the app → Job Scheduling → Crew view.
Verify:
- A **Board | Hours** toggle appears; Board shows the old card board.
- Switching to **Hours** shows the member grid; the Month scale button is disabled.
- The **+** on a member row opens the modal; assigning a job + weekly hours fills that member's day cells, and the WEEK/CAP columns update.
- Editing a day cell's number changes the total; clearing it (0) removes the chip.
- The **Jobs This Week** panel lists every scheduled job (including unstaffed ones) with required / assigned / ⚠ missing.

- [ ] **Step 12: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: wire weekly crew hours grid into Job Scheduling crew view

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Crew-view, week-only, Board/Hours sub-toggle → Task 8 (Steps 2,3,6,9).
- Members × Days layout, flat member list, OFF cells → Task 5 (model) + Task 6 (render); active members in Task 8 Step 4.
- Required = work-order estimate prorated by working-day share → Task 1.
- Assigned + missing, unstaffed jobs visible in jobs panel → Tasks 2, 5, 6.
- Member capacity / remaining / over-capacity → Task 5 (via `computeWeeklyHours`) + Task 6 (red flag).
- Both input modes (week-total auto-spread + per-day edit) → Task 3 (spread), Task 7 (modal), Task 8 (handlers); per-day edit in Task 6 inputs + Task 8 Step 5.
- Day/span/off constraint on assignment → Task 3 (`eligibleDayKeys`), used in Task 8 Step 5.
- Persistence via `hoursAssignments`, commit-immediately through `onUpdateJob`, no staging → Task 4 + Task 8 Step 5.
- Edge cases (no work order → "—", over-book flagged not blocked, week-boundary proration) → Tasks 1, 5, 6.

**Placeholder scan:** No TBD/TODO; every code step shows complete code. The `/* ...unchanged... */` markers in Task 8 Step 7 intentionally preserve existing JSX already present in the file.

**Type consistency:** `MemberDayCell`, `MemberRow`, `JobSummary`, `CrewHoursGridModel` defined in Task 1 and reused unchanged in Tasks 5–8. Function names consistent: `setMemberDayHours`, `assignMemberWeek`, `spreadWeeklyHours`, `eligibleDayKeys`, `buildCrewHoursGrid`, `requiredHoursForWeek`, `assignedHoursForJobInWeek`, `jobsScheduledInWeek`.
