# Break-aware Job Hours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carve breaks out of scheduled job hours — unpaid breaks inside a job's time window reduce that job's worked hours (chip, job-card counter, day/week totals); paid breaks stay counted; capacity becomes the full working day.

**Architecture:** All carve math lives in the services layer (`crewBreaks.ts`, `crewHoursGrid.ts`) as pure functions, so the weekly grid, day view, capacity column, and jobs panel all derive from one source of truth. The React layer only renders the derived numbers and shows a hover breakdown.

**Tech Stack:** TypeScript, React, Vitest + @testing-library/react. Test command: `npx vitest run <path>`.

## Global Constraints

- Break increments are 15 minutes; keep 2-decimal precision for break math (`round2`), 1-decimal for displayed hour totals (`round1`). Copied from `services/crewBreaks.ts`.
- `CrewBreak`: `{ id; label?; durationMinutes; paid; startTime? }`. `startTime` present = fixed; absent = floating. Do not change this type.
- i18n: every `t()` key must exist in BOTH `enManual` and `esManual` in `i18n/catalog.ts` (a catalog-integrity test in `i18n/translate.test.ts` enforces en/es parity).
- Time strings are zero-padded `'HH:mm'`, so lexicographic string comparison is valid for ordering.
- A job-day's display window is `jobDayWindow(job, dateKey)` → `{ startTime, endTime } | null`.

---

### Task 1: Break-overlap helpers

**Files:**
- Modify: `services/crewBreaks.ts`
- Test: `services/crewBreaks.test.ts`

**Interfaces:**
- Consumes: `CrewBreak` from `../types`; existing `round2`, `sumMinutes` in this file.
- Produces:
  - `unpaidFixedBreakHoursInWindow(breaks: CrewBreak[], startTime: string, endTime: string): number` — hours of UNPAID breaks that have a `startTime` and whose `[start, start+duration]` interval intersects `[startTime, endTime]`; returns the summed intersection length in hours (round2).
  - `unpaidFloatingBreakHours(breaks: CrewBreak[]): number` — hours of UNPAID breaks with no `startTime` (round2).

- [ ] **Step 1: Write the failing tests**

Add to the end of `services/crewBreaks.test.ts` (it already imports from `./crewBreaks` and defines a `lunch` helper — reuse that pattern; if `lunch` is not in scope in this file, define the inline objects shown):

```ts
import { unpaidFixedBreakHoursInWindow, unpaidFloatingBreakHours } from './crewBreaks';

describe('unpaidFixedBreakHoursInWindow', () => {
  const lunch = (o: Partial<import('../types').CrewBreak> = {}) =>
    ({ id: 'b1', durationMinutes: 30, paid: false, startTime: '12:00', ...o }) as import('../types').CrewBreak;

  it('counts a fixed unpaid break fully inside the window', () => {
    expect(unpaidFixedBreakHoursInWindow([lunch()], '08:00', '13:00')).toBe(0.5);
  });

  it('returns 0 when the break sits in a gap outside the window', () => {
    // window 08:00–12:00, lunch starts at 12:00 → no overlap.
    expect(unpaidFixedBreakHoursInWindow([lunch()], '08:00', '12:00')).toBe(0);
  });

  it('counts only the overlapping minutes on a partial overlap', () => {
    // window ends 12:15, lunch 12:00–12:30 → 15 min inside.
    expect(unpaidFixedBreakHoursInWindow([lunch()], '08:00', '12:15')).toBe(0.25);
  });

  it('ignores paid breaks', () => {
    expect(unpaidFixedBreakHoursInWindow([lunch({ paid: true })], '08:00', '13:00')).toBe(0);
  });

  it('ignores floating (no startTime) breaks', () => {
    expect(unpaidFixedBreakHoursInWindow([lunch({ startTime: undefined })], '08:00', '13:00')).toBe(0);
  });

  it('sums multiple unpaid fixed breaks in the window', () => {
    const coffee = lunch({ id: 'b2', durationMinutes: 15, startTime: '10:00' });
    expect(unpaidFixedBreakHoursInWindow([lunch(), coffee], '08:00', '13:00')).toBe(0.75);
  });
});

describe('unpaidFloatingBreakHours', () => {
  const brk = (o: Partial<import('../types').CrewBreak> = {}) =>
    ({ id: 'b1', durationMinutes: 30, paid: false, ...o }) as import('../types').CrewBreak;

  it('counts unpaid floating breaks', () => {
    expect(unpaidFloatingBreakHours([brk()])).toBe(0.5);
  });

  it('ignores fixed (timed) breaks', () => {
    expect(unpaidFloatingBreakHours([brk({ startTime: '12:00' })])).toBe(0);
  });

  it('ignores paid floating breaks', () => {
    expect(unpaidFloatingBreakHours([brk({ paid: true })])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/crewBreaks.test.ts`
Expected: FAIL — `unpaidFixedBreakHoursInWindow is not a function` / import errors.

- [ ] **Step 3: Implement the helpers**

Add to `services/crewBreaks.ts` (after the existing `paidBreakHours` definition, before `setMemberDayBreaks`):

```ts
const hhmmToMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Hours of UNPAID FIXED breaks (those with a startTime) overlapping the window
 *  [startTime, endTime]. Each break contributes the intersection of its
 *  [start, start + duration] interval with the window. Paid and floating breaks
 *  are ignored. */
export const unpaidFixedBreakHoursInWindow = (
  breaks: CrewBreak[],
  startTime: string,
  endTime: string,
): number => {
  const ws = hhmmToMin(startTime);
  const we = hhmmToMin(endTime);
  let mins = 0;
  for (const b of breaks) {
    if (b.paid || !b.startTime) continue;
    const bs = hhmmToMin(b.startTime);
    const be = bs + (b.durationMinutes || 0);
    mins += Math.max(0, Math.min(be, we) - Math.max(bs, ws));
  }
  return round2(mins / 60);
};

/** Hours of UNPAID FLOATING breaks (no startTime) on a member-day. */
export const unpaidFloatingBreakHours = (breaks: CrewBreak[]): number =>
  round2(sumMinutes(breaks.filter(b => !b.paid && !b.startTime)) / 60);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run services/crewBreaks.test.ts`
Expected: PASS (all existing + new tests).

- [ ] **Step 5: Commit**

```bash
git add services/crewBreaks.ts services/crewBreaks.test.ts
git commit -m "feat(scheduling): break-overlap helpers for window-aware carve"
```

---

### Task 2: Break-aware crew-hours model (`buildCrewHoursGrid`)

**Files:**
- Modify: `services/crewHoursGrid.ts` (`MemberDayCell` interface ~line 8; `buildCrewHoursGrid` ~lines 379–452; imports ~line 5)
- Test: `services/crewHoursGrid.test.ts` (add new `describe`; update two existing break tests ~lines 419–444)

**Interfaces:**
- Consumes: `unpaidFixedBreakHoursInWindow`, `unpaidFloatingBreakHours` from `./crewBreaks` (Task 1); existing `resolveBreaks`, `jobDayWindow`, `memberJobDayLineItemHours`, `computeWeeklyHours`.
- Produces: `MemberDayCell` gains optional `grossHours?: number`, `unpaidBreakHours?: number`, `breakLabel?: string`. `MemberRow.weekTotal` is now net of breaks; `MemberRow.capacity` is the full working day; `MemberRow.paidHours === weekTotal`.

- [ ] **Step 1: Update the `MemberDayCell` interface**

In `services/crewHoursGrid.ts`, replace the `MemberDayCell` interface (line 8):

```ts
export interface MemberDayCell {
  jobId: string; jobNumber: string; jobName: string; hours: number; color: string;
  startTime?: string; endTime?: string; lineItemName?: string; taskId?: string;
  /** Scheduled/typed hours before unpaid breaks were carved out (for the editor + tooltip). Defaults to `hours` when no break applies. */
  grossHours?: number;
  /** Unpaid break time carved out of this chip (hours). Omitted when none. */
  unpaidBreakHours?: number;
  /** Label of the break that was carved (for the hover breakdown). */
  breakLabel?: string;
}
```

- [ ] **Step 2: Update imports and add `round2`**

In `services/crewHoursGrid.ts`, change the `crewBreaks` import (line 5) from:

```ts
import { resolveBreaks, breakHours, paidBreakHours } from './crewBreaks';
```

to:

```ts
import { resolveBreaks, unpaidFixedBreakHoursInWindow, unpaidFloatingBreakHours } from './crewBreaks';
```

Add a `round2` helper next to the existing `round1` (line 48):

```ts
const round2 = (n: number) => Math.round(n * 100) / 100;
```

- [ ] **Step 3: Write the failing tests**

Append to `services/crewHoursGrid.test.ts` (reuses `member`, `job`, `WEEKEND`, `weekDates`, `lunch30` already in the file). Add a single-day fixture and a new describe:

```ts
const oneDay = [new Date('2026-06-08T12:00:00')];
// A one-day job 8:00–13:00 for m1 (gross 5h via dailyHours).
const fiveHourJob = job({
  startDate: '2026-06-08T08:00:00', endDate: '2026-06-08T13:00:00',
  crewMemberIds: ['m1'],
  dailyHours: { '2026-06-08': { startTime: '08:00', endTime: '13:00' } },
});

describe('buildCrewHoursGrid — break-aware job hours', () => {
  it('carves an unpaid fixed break inside the window off the chip', () => {
    const model = buildCrewHoursGrid([member()], [fiveHourJob], [], oneDay, WEEKEND, 8, [lunch30]);
    const cell = model.rows[0].cellsByDay['2026-06-08'][0];
    expect(cell.grossHours).toBe(5);
    expect(cell.hours).toBe(4.5);
    expect(cell.unpaidBreakHours).toBe(0.5);
    expect(model.rows[0].weekTotal).toBe(4.5);
  });

  it('leaves the chip whole for a PAID break in the window', () => {
    const paidLunch = { ...lunch30, paid: true };
    const model = buildCrewHoursGrid([member()], [fiveHourJob], [], oneDay, WEEKEND, 8, [paidLunch]);
    const cell = model.rows[0].cellsByDay['2026-06-08'][0];
    expect(cell.hours).toBe(5);
    expect(cell.unpaidBreakHours).toBeUndefined();
    expect(model.rows[0].weekTotal).toBe(5);
    expect(model.rows[0].paidHours).toBe(5);
  });

  it('does not carve a fixed break that falls in a gap between jobs', () => {
    // Job is 08:00–12:00; lunch starts 12:00 → outside the window.
    const morning = job({
      startDate: '2026-06-08T08:00:00', endDate: '2026-06-08T12:00:00',
      crewMemberIds: ['m1'], dailyHours: { '2026-06-08': { startTime: '08:00', endTime: '12:00' } },
    });
    const model = buildCrewHoursGrid([member()], [morning], [], oneDay, WEEKEND, 8, [lunch30]);
    const cell = model.rows[0].cellsByDay['2026-06-08'][0];
    expect(cell.hours).toBe(4);
    expect(cell.unpaidBreakHours).toBeUndefined();
  });

  it('subtracts an unpaid floating break from the day total, not the chip', () => {
    const floating = { id: 'f1', durationMinutes: 30, paid: false }; // no startTime
    const fullDay = job({
      startDate: '2026-06-08T08:00:00', endDate: '2026-06-08T16:00:00',
      crewMemberIds: ['m1'], dailyHours: { '2026-06-08': { startTime: '08:00', endTime: '16:00' } },
    });
    const model = buildCrewHoursGrid([member()], [fullDay], [], oneDay, WEEKEND, 8, [floating]);
    const cell = model.rows[0].cellsByDay['2026-06-08'][0];
    expect(cell.hours).toBe(8);              // chip unchanged
    expect(model.rows[0].weekTotal).toBe(7.5); // day total reduced
    expect(model.dayTotals['2026-06-08'].assigned).toBe(7.5);
  });
});
```

Then UPDATE the three existing break tests (currently ~lines 419–444) to the new capacity/paidHours model:

```ts
describe('buildCrewHoursGrid — breaks', () => {
  it('capacity is the full working day; breaks do not shrink it', () => {
    const model = buildCrewHoursGrid([member()], [], [], weekDates, WEEKEND, 8, [lunch30]);
    expect(model.rows[0].capacity).toBe(40);
  });

  it('exposes resolved breaks per working day in breaksByDay', () => {
    const model = buildCrewHoursGrid([member()], [], [], weekDates, WEEKEND, 8, [lunch30]);
    expect(model.rows[0].breaksByDay['2026-06-08']).toEqual([lunch30]);
  });

  it('honours a per-day override (empty array = no break that day)', () => {
    const m = member({ schedule: { '2026-06-08': { date: '2026-06-08', startTime: '08:00', endTime: '17:00', isOff: false, breaksOverride: [] } } });
    const model = buildCrewHoursGrid([m], [], [], weekDates, WEEKEND, 8, [lunch30]);
    expect(model.rows[0].capacity).toBe(40);
    expect(model.rows[0].breaksByDay['2026-06-08']).toEqual([]);
  });

  it('paidHours equals worked hours (paid in-window breaks counted, unpaid not)', () => {
    const model = buildCrewHoursGrid([member()], [], [], weekDates, WEEKEND, 8, [lunch30]);
    expect(model.rows[0].paidHours).toBe(model.rows[0].weekTotal);
    expect(model.rows[0].paidHours).toBe(0); // no jobs → no worked hours
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: FAIL — new break-aware assertions fail (chip not carved; `grossHours` undefined) and updated capacity tests fail (still 37.5/38).

- [ ] **Step 5: Rewrite the member-row builder**

In `services/crewHoursGrid.ts`, replace the body of the `members.map(m => { ... })` block in `buildCrewHoursGrid` (currently ~lines 392–434) with:

```ts
  const rows: MemberRow[] = members.map(m => {
    const baseCapacity = computeWeeklyHours(m, weekDays, [], { standardDay, weekendDays }).capacity;
    const cellsByDay: Record<string, MemberDayCell[]> = {};
    const offByDay: Record<string, boolean> = {};
    const availByDay: Record<string, DayAvailability> = {};
    const breaksByDay: Record<string, CrewBreak[]> = {};
    let weekTotal = 0;
    for (const key of dayKeys) {
      offByDay[key] = !!m.schedule?.[key]?.isOff;
      availByDay[key] = resolveDayAvailability(m, key, defaultWindow);
      const dayBreaks = offByDay[key] ? [] : resolveBreaks(m.schedule?.[key], defaultBreaks);
      breaksByDay[key] = dayBreaks;
      const cells: MemberDayCell[] = [];
      for (const j of weekJobs) {
        const w = jobDayWindow(j, key);
        let remainingCarve = w ? unpaidFixedBreakHoursInWindow(dayBreaks, w.startTime, w.endTime) : 0;
        // Label only — the first unpaid fixed break that starts inside the window.
        const carvingBreak = (remainingCarve > 0 && w)
          ? dayBreaks.find(b => !b.paid && b.startTime && b.startTime >= w.startTime && b.startTime < w.endTime)
          : undefined;
        for (const part of memberJobDayLineItemHours(j, m.id, key, standardDay)) {
          const take = Math.min(remainingCarve, part.hours);
          remainingCarve = round2(remainingCarve - take);
          const net = round2(part.hours - take);
          cells.push({
            jobId: j.id, jobNumber: j.jobNumber, jobName: j.name, hours: net, grossHours: part.hours,
            color: jobColor(j.id), startTime: w?.startTime, endTime: w?.endTime,
            lineItemName: part.lineItemName, taskId: part.taskId,
            ...(take > 0 ? { unpaidBreakHours: take, breakLabel: carvingBreak?.label } : {}),
          });
        }
      }
      const startMin = (t?: string) => { if (!t) return Number.POSITIVE_INFINITY; const [h, mm] = t.split(':').map(Number); return h * 60 + (mm || 0); };
      cells.sort((a, b) => startMin(a.startTime) - startMin(b.startTime));
      cellsByDay[key] = cells;
      const dayWorked = cells.reduce((s, c) => s + c.hours, 0);
      weekTotal += Math.max(0, round2(dayWorked - unpaidFloatingBreakHours(dayBreaks)));
    }
    weekTotal = round1(weekTotal);
    const capacity = Math.max(0, round1(baseCapacity));
    return {
      memberId: m.id, name: m.name, role: m.role, photo: m.photo, color: m.color,
      cellsByDay, offByDay, breaksByDay, availByDay,
      weekTotal, capacity, remaining: Math.max(0, round1(capacity - weekTotal)),
      overCapacity: weekTotal > capacity,
      paidHours: weekTotal,
    };
  });
```

- [ ] **Step 6: Update the `dayTotals` roll-up to subtract floating breaks**

In `services/crewHoursGrid.ts`, replace the `dayTotals` loop (currently ~lines 440–449) with:

```ts
  const dayTotals: Record<string, DayTotal> = {};
  for (const key of dayKeys) {
    let assigned = 0;
    let capacity = 0;
    for (const row of rows) {
      capacity += row.offByDay[key] ? 0 : standardDay;
      const worked = (row.cellsByDay[key] ?? []).reduce((s, c) => s + c.hours, 0);
      assigned += Math.max(0, worked - unpaidFloatingBreakHours(row.breaksByDay[key] ?? []));
    }
    dayTotals[key] = { assigned: round1(assigned), capacity: round1(capacity) };
  }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS — new break-aware tests and updated capacity/paidHours tests.

- [ ] **Step 8: Run the full service suite to catch regressions**

Run: `npx vitest run services/`
Expected: PASS. (If `crewWeeklyHours.test.ts` or others referenced the old capacity-with-breaks behavior, they did not — capacity-with-breaks lived only in `crewHoursGrid`. Fix any genuine fallout before committing.)

- [ ] **Step 9: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "feat(scheduling): carve breaks from crew-hours model (chips, totals, capacity)"
```

---

### Task 3: Break-aware job-card "assigned" counter (`buildJobSummaries`)

**Files:**
- Modify: `services/crewHoursGrid.ts` (`buildJobSummaries` ~lines 200–218; add `assignedHoursForJobInWeekNet`; `buildCrewHoursGrid` internal call ~line 436)
- Modify: `components/views/JobSchedulingView.tsx` (sidebar `buildJobSummaries` call ~line 612)
- Test: `services/crewHoursGrid.test.ts`

**Interfaces:**
- Consumes: `unpaidFixedBreakHoursInWindow`, `resolveBreaks` from `./crewBreaks`; `memberJobDayHours`, `jobDayWindow`; `CrewMember`, `CrewBreak` types.
- Produces:
  - `assignedHoursForJobInWeekNet(job: Job, weekKeys: string[], standardDay: number, members: CrewMember[], defaultBreaks: CrewBreak[]): number` — gross job hours minus unpaid fixed breaks inside the job window per member-day. Floating breaks are NOT subtracted (they are not attributable to a job).
  - `buildJobSummaries(..., members?: CrewMember[], defaultBreaks?: CrewBreak[])` — new trailing optional params; `assigned` is computed net.

- [ ] **Step 1: Write the failing tests**

Append to `services/crewHoursGrid.test.ts` (reuses `oneDay`, `fiveHourJob`, `member`, `lunch30`, `WEEKEND` from earlier in the file):

```ts
describe('buildJobSummaries — break-aware assigned', () => {
  const dayKeys = ['2026-06-08'];

  it('subtracts unpaid fixed breaks inside the job window from assigned', () => {
    const list = buildJobSummaries([fiveHourJob], [], dayKeys, WEEKEND, 8, [member()], [lunch30]);
    expect(list[0].assigned).toBe(4.5);
  });

  it('counts paid breaks (assigned stays whole)', () => {
    const paidLunch = { ...lunch30, paid: true };
    const list = buildJobSummaries([fiveHourJob], [], dayKeys, WEEKEND, 8, [member()], [paidLunch]);
    expect(list[0].assigned).toBe(5);
  });

  it('ignores floating breaks for the per-job counter', () => {
    const floating = { id: 'f1', durationMinutes: 30, paid: false };
    const list = buildJobSummaries([fiveHourJob], [], dayKeys, WEEKEND, 8, [member()], [floating]);
    expect(list[0].assigned).toBe(5);
  });

  it('is backward-compatible when no members are passed (gross hours)', () => {
    const list = buildJobSummaries([fiveHourJob], [], dayKeys, WEEKEND, 8);
    expect(list[0].assigned).toBe(5);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/crewHoursGrid.test.ts -t "break-aware assigned"`
Expected: FAIL — `assigned` is 5 in the unpaid case (breaks not yet subtracted) and `buildJobSummaries` ignores the extra args.

- [ ] **Step 3: Add the net assigned helper**

In `services/crewHoursGrid.ts`, add after `assignedHoursForJobInWeek` (~line 114):

```ts
/** Like assignedHoursForJobInWeek, but net of unpaid FIXED breaks that fall inside
 *  the job's window on each member's working day. Floating breaks are not subtracted
 *  (they are not attributable to a specific job). Falls back to gross when a member
 *  is unknown/off or the job has no window that day. */
export const assignedHoursForJobInWeekNet = (
  job: Job,
  weekKeys: string[],
  standardDay: number,
  members: CrewMember[],
  defaultBreaks: CrewBreak[],
): number => {
  const byId = new Map(members.map(m => [m.id, m]));
  const memberIds = new Set<string>(job.crewMemberIds ?? []);
  job.allocations?.forEach(a => a.memberIds?.forEach(m => memberIds.add(m)));
  let total = 0;
  for (const id of memberIds) {
    const member = byId.get(id);
    for (const k of weekKeys) {
      const hrs = memberJobDayHours(job, id, k, standardDay);
      if (hrs <= 0) continue;
      const off = !!member?.schedule?.[k]?.isOff;
      const w = jobDayWindow(job, k);
      const carve = (!off && member && w)
        ? Math.min(hrs, unpaidFixedBreakHoursInWindow(resolveBreaks(member.schedule?.[k], defaultBreaks), w.startTime, w.endTime))
        : 0;
      total += hrs - carve;
    }
  }
  return round1(total);
};
```

- [ ] **Step 4: Make `buildJobSummaries` break-aware**

In `services/crewHoursGrid.ts`, change the `buildJobSummaries` signature and the `assigned` line (~lines 200–218):

```ts
export const buildJobSummaries = (
  jobs: Job[],
  workOrders: WorkOrder[],
  dayKeys: string[],
  weekendDays: number[],
  standardDay: number = 8,
  members: CrewMember[] = [],
  defaultBreaks: CrewBreak[] = [],
): JobSummary[] =>
  jobsScheduledInWeek(jobs, dayKeys, weekendDays).map(j => {
    const { estimate, required } = requiredHoursForWeek(j, workOrders, dayKeys, weekendDays);
    const assigned = assignedHoursForJobInWeekNet(j, dayKeys, standardDay, members, defaultBreaks);
    const jobKeys = new Set(workingDayKeys(j.startDate!, j.endDate ?? j.startDate!, weekendDays));
    return {
      jobId: j.id, jobNumber: j.jobNumber, jobName: j.name, address: j.address, color: jobColor(j.id),
      estimate, required, assigned,
      missing: estimate > 0 ? Math.max(0, round1(required - assigned)) : 0,
      days: dayKeys.filter(k => jobKeys.has(k)),
      lineItems: buildLineItemRows(j, workOrders, dayKeys, weekendDays),
    };
  });
```

Update the internal call in `buildCrewHoursGrid` (~line 436) to pass the members and default breaks it already has:

```ts
  const jobSummaries = buildJobSummaries(jobs, workOrders, dayKeys, weekendDays, standardDay, members, defaultBreaks);
```

- [ ] **Step 5: Pass members + breaks at the sidebar call site**

In `components/views/JobSchedulingView.tsx`, update the `buildJobSummaries` call (~line 612):

```ts
    const list = buildJobSummaries(displayJobs, workOrders, sidebarDayKeys, workConfig.weekendDays, capacityHours, activeStaff, settings.scheduling?.defaultBreaks ?? []);
```

Add `activeStaff` and `settings.scheduling?.defaultBreaks` to that `useMemo`'s dependency array (the line ~616 `[displayJobs, workOrders, sidebarDayKeys, workConfig.weekendDays, capacityHours, sidebarPeriod]` → add `activeStaff, settings.scheduling?.defaultBreaks`).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS — including the existing `buildJobSummaries` parity test ("matches the job summaries buildCrewHoursGrid produces for the same week"), which now compares two break-aware paths.

- [ ] **Step 7: Typecheck the view change**

Run: `npx tsc --noEmit`
Expected: No new errors in `JobSchedulingView.tsx`.

- [ ] **Step 8: Commit**

```bash
git add services/crewHoursGrid.ts components/views/JobSchedulingView.tsx
git commit -m "feat(scheduling): job-card assigned counter nets out unpaid breaks"
```

---

### Task 4: Chip UI — net number, edit-on-gross, hover breakdown

**Files:**
- Modify: `components/views/JobScheduling/EditableHoursChip.tsx`
- Modify: `i18n/catalog.ts` (`enManual` and `esManual`)
- Test: `components/views/JobScheduling/EditableHoursChip.test.tsx` (new)

**Interfaces:**
- Consumes: `MemberDayCell` with `grossHours?`, `unpaidBreakHours?`, `breakLabel?` (Task 2); existing translation key `views.JobScheduling.BreakChip.break`.
- Produces: chip displays net `cell.hours`; editing operates on `cell.grossHours ?? cell.hours`; tooltip shows the carve breakdown when `unpaidBreakHours` is set. New i18n key `views.JobScheduling.EditableHoursChip.breakBreakdown`.

- [ ] **Step 1: Add the i18n key (both languages)**

In `i18n/catalog.ts`, add to the `enManual` object (anywhere inside it, e.g. near other scheduling keys):

```ts
  'views.JobScheduling.EditableHoursChip.breakBreakdown': '{gross}h − {carved}h {label} (unpaid)',
```

And the matching entry in the `esManual` object:

```ts
  'views.JobScheduling.EditableHoursChip.breakBreakdown': '{gross} h − {carved} h {label} (no pagado)',
```

- [ ] **Step 2: Write the failing component test**

Create `components/views/JobScheduling/EditableHoursChip.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableHoursChip } from './EditableHoursChip';
import type { MemberDayCell } from '../../../services/crewHoursGrid';

const cell = (over: Partial<MemberDayCell> = {}): MemberDayCell => ({
  jobId: 'j1', jobNumber: 'J-1', jobName: 'Miller Exterior', hours: 4.5, grossHours: 5,
  unpaidBreakHours: 0.5, breakLabel: 'Lunch', color: '#f59e0b', startTime: '08:00', endTime: '13:00',
  ...over,
});

describe('EditableHoursChip', () => {
  it('shows the net hours and a break breakdown tooltip (read-only)', () => {
    render(<EditableHoursChip cell={cell()} canEdit={false} editLabel="edit" onCommit={() => {}} onRemove={() => {}} />);
    expect(screen.getByText('4.5')).toBeTruthy();
    expect(screen.getByTitle(/5h − 0.5h Lunch \(unpaid\)/)).toBeTruthy();
  });

  it('displays net in the input until focused, then edits on gross', () => {
    render(<EditableHoursChip cell={cell()} canEdit editLabel="edit hours" onCommit={() => {}} onRemove={() => {}} />);
    const input = screen.getByLabelText('edit hours') as HTMLInputElement;
    expect(input.value).toBe('4.5');
    fireEvent.focus(input);
    expect(input.value).toBe('5'); // edits the scheduled (gross) value, not the net
  });

  it('commits the typed gross value', () => {
    const onCommit = vi.fn();
    render(<EditableHoursChip cell={cell({ unpaidBreakHours: undefined, breakLabel: undefined, hours: 5 })} canEdit editLabel="edit hours" onCommit={onCommit} onRemove={() => {}} />);
    const input = screen.getByLabelText('edit hours') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '6' } });
    expect(onCommit).toHaveBeenCalledWith(6);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/EditableHoursChip.test.tsx`
Expected: FAIL — focus does not switch the value to gross; breakdown title missing.

- [ ] **Step 4: Update the chip component**

In `components/views/JobScheduling/EditableHoursChip.tsx`, inside the component body (after `const isEditing = draft !== null;`, ~line 25) add:

```ts
  const gross = cell.grossHours ?? cell.hours;
  const breakTitle = cell.unpaidBreakHours
    ? t('views.JobScheduling.EditableHoursChip.breakBreakdown', {
        gross,
        carved: cell.unpaidBreakHours,
        label: cell.breakLabel || t('views.JobScheduling.BreakChip.break'),
      })
    : undefined;
```

Replace the editable `<input>` block (~lines 52–73) so it displays net when idle, edits gross on focus, and carries the breakdown tooltip:

```tsx
      {canEdit ? (
        <input
          type="number"
          min={0}
          title={breakTitle}
          value={isEditing ? draft! : cell.hours}
          onFocus={() => setDraft(String(gross))}
          onChange={e => {
            const raw = e.target.value;
            setDraft(raw);
            const v = Number(raw);
            if (raw !== '' && v > 0) onCommit(v);
          }}
          onBlur={() => {
            const raw = isEditing ? draft! : String(gross);
            const v = Number(raw);
            if (raw === '' || !(v > 0)) onRemove();
            setDraft(null);
          }}
          aria-label={editLabel}
          className="w-8 bg-white/25 text-right text-xs font-bold text-white rounded px-0.5 outline-none focus:bg-white/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      ) : (
        <span className="text-xs font-bold text-white" title={breakTitle}>{cell.hours}</span>
      )}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/EditableHoursChip.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the i18n integrity test and the scheduling component tests**

Run: `npx vitest run i18n/translate.test.ts components/views/JobScheduling/`
Expected: PASS — en/es parity holds with the new key; `CrewHoursGrid.test.tsx` still passes (its fixtures omit `grossHours`, which now falls back to `cell.hours`).

- [ ] **Step 7: Commit**

```bash
git add components/views/JobScheduling/EditableHoursChip.tsx components/views/JobScheduling/EditableHoursChip.test.tsx i18n/catalog.ts
git commit -m "feat(scheduling): chip shows net hours with break breakdown, edits on gross"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the entire test suite**

Run: `npx vitest run`
Expected: PASS. Investigate and fix any failure that traces to the new break-aware behavior before proceeding.

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "test(scheduling): fixups after break-aware job hours" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** fixed-in-window carve (Task 2 chip, Task 3 job card), fixed-in-gap no-op (Task 2 test), floating → day total only (Task 2 + Task 3 ignores it), paid stays counted (Tasks 2/3), partial overlap (Task 1), capacity = full day (Task 2), chip net + hover breakdown + edit-on-gross (Task 4), `paidHours` redefined to `weekTotal` (Task 2). All covered.
- **`paidHours` decision:** defined as `weekTotal` (net worked hours; paid in-window breaks are already included because they are never carved). Standalone paid breaks on days with no scheduled work do not count — consistent with "a paid break counts toward the job it sits in." Field is internal (not rendered).
- **Multiple line-item chips of one job:** a fixed break's carve is consumed first-chip-first within that job-day (`remainingCarve`), so it is never double-counted across line items.
- **Backward compatibility:** `grossHours`/`unpaidBreakHours`/`breakLabel` are optional; the chip falls back to `cell.hours` when absent, so existing `MemberDayCell` fixtures need no changes. `buildJobSummaries` keeps working with no members passed (gross), and the standalone `assignedHoursForJobInWeek` (used elsewhere in `JobSchedulingView.tsx:932`) is untouched.
