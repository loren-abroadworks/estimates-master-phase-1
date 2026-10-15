# Job Total Hours & Smart Time-Shift Rescheduling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a job's "total hours" always equal its estimate (never the shrinking assigned figure), and make rescheduling time-aware — pushing a job's start time re-flows the job forward (spilling into the next working day) and cascades only shared-crew conflicts, behind the existing reschedule preview.

**Architecture:** Two independent phases. **Phase 1** is display-only: surface the full estimate as the headline total and demote "assigned" to a progress fill, in `JobsPanel` and `SingleJobEditor` (the Assign Hours modal is already estimate-based). **Phase 2/3** extend the pure `scheduleEngine` with a re-flow helper and a shared-crew-scoped cascade, then wire both the Day-board block drag and a reschedule-panel start-time field into the existing `ProposedChange` → preview → Apply pipeline.

**Tech Stack:** React + TypeScript, Vite, Vitest + @testing-library/react. Pure scheduling logic lives in `services/scheduleEngine.ts` (no React, no `Date.now()` inside — `referenceDate` is injected for determinism).

**Key facts established during design:**
- `workOrder.totalProductionHours` is the estimate total. It is only ever written in `services/workOrderMapper.ts` from estimate task hours and is **never** mutated by scheduling.
- `crewHoursGrid.JobSummary` already carries `estimate` (full estimate) and `required` (estimate prorated to the visible week/day). `assigned` is the thing that shrinks.
- `assignHoursWarnings.jobHoursProgress` already uses the full estimate as its denominator — so the Assign Hours modal is already correct; Phase 1 only adds a guarding test there.
- `scheduleEngine.shiftJobsFromPoint(jobs, fromDateTime, amount, unit, config, scope?, untilDate?)` already supports an `'hours'` unit and a `CascadeScope`. `cascadeFromEdit(jobs, primaryChange, config, untilDate?)` currently passes **no** scope, so it moves every following job.
- `rescheduleIssues.jobsShareCrew` / `groupsOf` already encode "shared member or shared crew group"; the conflict strip uses them. We reuse them for cascade scoping.

**Run tests with:** `npx vitest run <path>` (single file) or `npx vitest run` (all).

---

## File Structure

**Phase 1 (display):**
- Modify: `components/views/JobScheduling/JobsPanel.tsx` — headline = full estimate; weekly assigned/required demoted to a sub-label.
- Create: `components/views/JobScheduling/JobsPanel.test.tsx` — render assertions.
- Modify: `components/views/JobScheduling/reschedule/SingleJobEditor.tsx` — Est. as the total with an assigned-vs-est progress bar.
- Modify: `services/assignHoursWarnings.test.ts` — add a guarding test that the denominator is the estimate.

**Phase 2 (engine):**
- Modify: `services/scheduleEngine.ts` — add `scheduledWindowHours`, `reflowFromStart`, `timeShiftChange`, `cascadeFromTimeShift`; add optional `scope` param to `cascadeFromEdit`.
- Modify: `services/scheduleEngine.test.ts` — tests for all of the above.
- Modify: `services/rescheduleIssues.ts` — add `sharedCrewScope`.
- Modify: `services/rescheduleIssues.test.ts` — test `sharedCrewScope`.

**Phase 3 (wiring):**
- Modify: `components/views/JobSchedulingView.tsx` — `handleShiftStartTime`, route Day-board drag, pass scope to all cascade calls, cascade default ON when conflicts exist.
- Modify: `components/views/JobScheduling/reschedule/SingleJobEditor.tsx` — add a "Start time" control that calls `onShiftStartTime`.

---

# PHASE 1 — Hours-model display fix (independently shippable)

### Task 1: JobsPanel — headline is the full estimate, not assigned

**Files:**
- Modify: `components/views/JobScheduling/JobsPanel.tsx:108-121`
- Create: `components/views/JobScheduling/JobsPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/views/JobScheduling/JobsPanel.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JobsPanel } from './JobsPanel';
import type { JobSummary } from '../../../services/crewHoursGrid';

const summary = (over: Partial<JobSummary> = {}): JobSummary => ({
  jobId: 'j1', jobNumber: 'J-1', jobName: 'Exterior Repaint', address: '1 Main St',
  color: '#10b981', estimate: 40, required: 20, assigned: 10, missing: 10,
  days: [], lineItems: [], ...over,
});

describe('JobsPanel headline hours', () => {
  it('shows the full estimate as the job total', () => {
    render(<JobsPanel title="Jobs This Week" jobs={[summary()]} emptyLabel="none" allStaffedLabel="all" />);
    expect(screen.getByText('40h total')).toBeInTheDocument();
  });

  it('shows assigned vs required this week as a secondary label', () => {
    render(<JobsPanel title="Jobs This Week" jobs={[summary()]} emptyLabel="none" allStaffedLabel="all" />);
    expect(screen.getByText('10 / 20h this week')).toBeInTheDocument();
  });

  it('keeps the total fixed even when assigned drops to zero', () => {
    render(<JobsPanel title="Jobs This Week" jobs={[summary({ assigned: 0, missing: 20 })]} emptyLabel="none" allStaffedLabel="all" />);
    expect(screen.getByText('40h total')).toBeInTheDocument();
    expect(screen.getByText('0 / 20h this week')).toBeInTheDocument();
  });

  it('shows an em dash total when the job has no estimate', () => {
    render(<JobsPanel title="Jobs This Week" jobs={[summary({ estimate: 0, required: 0, assigned: 5, missing: 0 })]} emptyLabel="none" allStaffedLabel="all" />);
    expect(screen.getByText('— total')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/JobsPanel.test.tsx`
Expected: FAIL — "40h total" not found (panel currently renders `10 / 20h`).

- [ ] **Step 3: Edit the headline block**

In `components/views/JobScheduling/JobsPanel.tsx`, replace the block currently at lines 108-121 (the `<div className="mt-2.5 flex items-center justify-between gap-2">` containing the `assigned / required` span and the missing/staffed badge) with:

```tsx
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <div className="flex flex-col min-w-0">
                  <span className="text-base font-extrabold tabular-nums text-gray-900 dark:text-white">
                    {j.estimate > 0 ? `${j.estimate}h total` : '— total'}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-gray-400">
                    {j.estimate > 0 ? `${j.assigned} / ${j.required}h this week` : `${j.assigned}h this week`}
                  </span>
                </div>
                {j.missing > 0 ? (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-xs font-extrabold text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {j.missing}h missing
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> staffed
                  </span>
                )}
              </div>
```

(The progress bar above it — lines 105-107, `width: ${pct}%` driven by `assigned / required` — is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/JobsPanel.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/JobsPanel.tsx components/views/JobScheduling/JobsPanel.test.tsx
git commit -m "fix: show full estimate as job total in scheduling jobs panel"
```

---

### Task 2: SingleJobEditor — Est. is the total, Assigned is a progress bar

**Files:**
- Modify: `components/views/JobScheduling/reschedule/SingleJobEditor.tsx:234-238`

This is a visual hierarchy change (no logic). `stats.estHours` is already the full estimate and `stats.assignedHours` the assigned figure; we render assigned as a fill against est rather than as a peer number.

- [ ] **Step 1: Replace the three-up stat grid**

In `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`, replace the grid at lines 234-238:

```tsx
            <div className="grid grid-cols-3 gap-2 text-center">
              <HoursStat label="Est." value={stats.estHours} />
              <HoursStat label="Assigned" value={stats.assignedHours} accent="text-primary-600 dark:text-primary-400" />
              <HoursStat label="Logged" value={stats.renderedHours} accent="text-green-600 dark:text-green-400" />
            </div>
```

with a total + progress-bar layout:

```tsx
            <div className="space-y-2">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="font-heading font-black leading-none text-2xl text-gray-900 dark:text-white">{stats.estHours.toFixed(1)}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Total Est. Hours</div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-primary-600 dark:text-primary-400 tabular-nums">{stats.assignedHours.toFixed(1)}</span>
                  <span className="text-xs font-bold text-gray-400"> assigned</span>
                  {stats.renderedHours > 0 && (
                    <div className="text-[11px] font-bold text-green-600 dark:text-green-400 tabular-nums">{stats.renderedHours.toFixed(1)} logged</div>
                  )}
                </div>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-500"
                  style={{ width: `${stats.estHours > 0 ? Math.min(100, Math.round((stats.assignedHours / stats.estHours) * 100)) : 0}%` }}
                />
              </div>
            </div>
```

The `HoursStat` helper (lines 49-54) is now unused — delete it to avoid a lint warning.

- [ ] **Step 2: Verify the suite still compiles and passes**

Run: `npx vitest run components/views/JobScheduling/`
Expected: PASS (existing `SingleJobEditor` tests unaffected; no references to `HoursStat` remain).

- [ ] **Step 3: Commit**

```bash
git add components/views/JobScheduling/reschedule/SingleJobEditor.tsx
git commit -m "fix: render reschedule panel hours as total + assigned progress bar"
```

---

### Task 3: Guard the Assign Hours modal denominator

**Files:**
- Modify: `services/assignHoursWarnings.test.ts`

`jobHoursProgress` already divides against the estimate. Add a test that locks this in so a future change can't regress it.

- [ ] **Step 1: Add the guarding test**

In the existing `describe('jobHoursProgress', ...)` block in `services/assignHoursWarnings.test.ts`, add:

```ts
  it('measures remaining against the fixed estimate, not the assigned total', () => {
    // Unassigning (lower jobTotalOther) must not change the estimate denominator.
    expect(jobHoursProgress(0, 0, 40).estimate).toBe(40);
    expect(jobHoursProgress(35, 0, 40).estimate).toBe(40);
  });
```

- [ ] **Step 2: Run test**

Run: `npx vitest run services/assignHoursWarnings.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add services/assignHoursWarnings.test.ts
git commit -m "test: lock Assign Hours progress denominator to the estimate"
```

---

# PHASE 2 — Smart time-shift engine

### Task 4: `scheduledWindowHours` — the duration a time-shift preserves

**Files:**
- Modify: `services/scheduleEngine.ts`
- Modify: `services/scheduleEngine.test.ts`

The duration we preserve is the sum of the job's per-day window hours (NOT elapsed time, which would include overnight gaps).

- [ ] **Step 1: Write the failing test**

Add to `services/scheduleEngine.test.ts` (and add `scheduledWindowHours` to the import on line 2):

```ts
describe('scheduledWindowHours', () => {
  const cfgWk = configFromSettings(undefined, true); // workday 8–17 = 9h, weekends [0,6]

  it('uses the standard workday length per spanned working day when no dailyHours', () => {
    // Jun 2 (Tue) – Jun 3 (Wed) = 2 working days × 9h.
    const job = { id: 'j', jobNumber: 'J', name: 'J', stage: 'Scheduled',
      startDate: '2026-06-02T08:00:00', endDate: '2026-06-03T17:00:00' } as Job;
    expect(scheduledWindowHours(job, cfgWk)).toBe(18);
  });

  it('sums per-day windows when dailyHours is present', () => {
    const job = { id: 'j', jobNumber: 'J', name: 'J', stage: 'Scheduled',
      startDate: '2026-06-02T08:00:00', endDate: '2026-06-03T17:00:00',
      dailyHours: {
        '2026-06-02': { startTime: '08:00', endTime: '16:00' }, // 8h
        '2026-06-03': { startTime: '08:00', endTime: '11:00' }, // 3h
      } } as Job;
    expect(scheduledWindowHours(job, cfgWk)).toBe(11);
  });

  it('returns 0 for an unscheduled job', () => {
    expect(scheduledWindowHours({ id: 'j', jobNumber: 'J', name: 'J', stage: 'Confirmed' } as Job, cfgWk)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t scheduledWindowHours`
Expected: FAIL — `scheduledWindowHours is not a function`.

- [ ] **Step 3: Implement in `services/scheduleEngine.ts`**

Add near the other date helpers (after `workingDayKeys`):

```ts
const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 'HH:mm' (e.g. '12:30') from a fractional hour, minute-rounded and carry-safe. */
const hoursToHHMM = (h: number): string => {
  const total = Math.round(h * 60);
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
};

/** 'HH:mm' -> fractional hours (e.g. '12:30' -> 12.5). */
const hhmmToHours = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h + (m || 0) / 60;
};

/**
 * Total scheduled WINDOW hours of a job: for each working day it spans (weekends
 * removed), the per-day dailyHours window length when present, else the standard
 * workday length. Independent of crew assignment; this is the duration a
 * time-shift preserves. Returns 0 for an unscheduled job.
 */
export const scheduledWindowHours = (job: Job, config: WorkingTimeConfig): number => {
  if (!job.startDate) return 0;
  const keys = workingDayKeys(job.startDate, job.endDate ?? job.startDate, config.weekendDays);
  const standard = Math.max(0, config.workDayEndHour - config.workDayStartHour);
  let total = 0;
  for (const k of keys) {
    const w = job.dailyHours?.[k];
    total += w ? Math.max(0, hhmmToHours(w.endTime) - hhmmToHours(w.startTime)) : standard;
  }
  return Math.round(total * 10) / 10;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts -t scheduledWindowHours`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat: add scheduledWindowHours to scheduling engine"
```

---

### Task 5: `reflowFromStart` — lay the duration forward (Option A)

**Files:**
- Modify: `services/scheduleEngine.ts`
- Modify: `services/scheduleEngine.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `services/scheduleEngine.test.ts` (add `reflowFromStart` to the import):

```ts
describe('reflowFromStart', () => {
  // Workday 8–16 = 8h/day, weekends [0,6]. Jun 2 = Tue.
  const cfg8 = { skipNonWorkingDays: true, weekendDays: [0, 6], holidays: [], workDayStartHour: 8, workDayEndHour: 16 };

  it('keeps a job within one day when it fits', () => {
    const r = reflowFromStart('2026-06-02T08:00:00', 6, cfg8);
    expect(r.newStart).toBe('2026-06-02T08:00:00');
    expect(r.newEnd).toBe('2026-06-02T14:00:00');
    expect(r.dailyHours).toEqual({ '2026-06-02': { startTime: '08:00', endTime: '14:00' } });
  });

  it('spills overflow into the next working day, second day at workday start', () => {
    // 16h from Tue 12pm: Tue 12–16 (4h), Wed 8–16 (8h), Thu 8–12 (4h).
    const r = reflowFromStart('2026-06-02T12:00:00', 16, cfg8);
    expect(r.dailyHours).toEqual({
      '2026-06-02': { startTime: '12:00', endTime: '16:00' },
      '2026-06-03': { startTime: '08:00', endTime: '16:00' },
      '2026-06-04': { startTime: '08:00', endTime: '12:00' },
    });
    expect(r.newStart).toBe('2026-06-02T12:00:00');
    expect(r.newEnd).toBe('2026-06-04T12:00:00');
  });

  it('skips weekends when spilling', () => {
    // Jun 5 = Fri. 12h from Fri 12pm: Fri 12–16 (4h), Mon 8–16 (8h).
    const r = reflowFromStart('2026-06-05T12:00:00', 12, cfg8);
    expect(Object.keys(r.dailyHours)).toEqual(['2026-06-05', '2026-06-08']);
    expect(r.newEnd).toBe('2026-06-08T16:00:00');
  });

  it('clamps a start before the workday to the workday start', () => {
    const r = reflowFromStart('2026-06-02T06:00:00', 4, cfg8);
    expect(r.newStart).toBe('2026-06-02T08:00:00');
    expect(r.newEnd).toBe('2026-06-02T12:00:00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t reflowFromStart`
Expected: FAIL — `reflowFromStart is not a function`.

- [ ] **Step 3: Implement in `services/scheduleEngine.ts`**

Add after `scheduledWindowHours`:

```ts
export interface ReflowResult {
  newStart: string;
  newEnd: string;
  dailyHours: Record<string, { startTime: string; endTime: string }>;
}

/**
 * Re-flow a job as a continuous ribbon of `durationHours` working-hours starting
 * at `newStartISO` (Option A). Day 1 runs from the new start (clamped into the
 * workday) to the workday end; each following WORKING day (skipping
 * weekends/holidays) fills from the workday start until all hours are placed.
 * Only day 1 carries the late start. Always emits at least one day.
 */
export const reflowFromStart = (
  newStartISO: string,
  durationHours: number,
  config: WorkingTimeConfig,
): ReflowResult => {
  const dayStart = config.workDayStartHour;
  const dayEnd = config.workDayEndHour;
  const start = new Date(newStartISO);

  let firstStartHour = start.getHours() + start.getMinutes() / 60;
  if (firstStartHour < dayStart) firstStartHour = dayStart;
  if (firstStartHour > dayEnd) firstStartHour = dayEnd;

  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  if (isNonWorkingDay(cursor, config)) {
    cursor = advanceWorkingDays(cursor, 1, config);
    firstStartHour = dayStart;
  }

  const dailyHours: Record<string, { startTime: string; endTime: string }> = {};
  let remaining = Math.max(0, Math.round(durationHours * 10) / 10);
  let overallStart: string | null = null;
  let overallEnd = '';
  let first = true;

  do {
    const sHour = first ? firstStartHour : dayStart;
    const avail = Math.max(0, dayEnd - sHour);
    // Day 1 starting at the workday end leaves no room; advance without emitting.
    if (avail === 0 && remaining > 0) {
      cursor = advanceWorkingDays(cursor, 1, config);
      first = false;
      continue;
    }
    const used = remaining > 0 ? Math.min(avail, remaining) : 0;
    const eHour = sHour + used;
    const key = toLocalDateKey(cursor);
    dailyHours[key] = { startTime: hoursToHHMM(sHour), endTime: hoursToHHMM(eHour) };
    if (overallStart === null) overallStart = `${key}T${hoursToHHMM(sHour)}:00`;
    overallEnd = `${key}T${hoursToHHMM(eHour)}:00`;
    remaining = Math.round((remaining - used) * 10) / 10;
    first = false;
    if (remaining > 0) cursor = advanceWorkingDays(cursor, 1, config);
  } while (remaining > 0);

  return { newStart: overallStart!, newEnd: overallEnd, dailyHours };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts -t reflowFromStart`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat: add reflowFromStart for time-shift spill layout"
```

---

### Task 6: `timeShiftChange` — build a ProposedChange from a new start time

**Files:**
- Modify: `services/scheduleEngine.ts`
- Modify: `services/scheduleEngine.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `services/scheduleEngine.test.ts` (add `timeShiftChange` to the import):

```ts
describe('timeShiftChange', () => {
  const cfg8 = { skipNonWorkingDays: true, weekendDays: [0, 6], holidays: [], workDayStartHour: 8, workDayEndHour: 16 };
  const job = { id: 'j1', jobNumber: 'J-1', name: 'Repaint', stage: 'Scheduled',
    startDate: '2026-06-02T08:00:00', endDate: '2026-06-02T16:00:00' } as Job;

  it('preserves duration and spills the end into the next day', () => {
    // 8h job pushed to 12pm: Tue 12–16 (4h) + Wed 8–12 (4h).
    const c = timeShiftChange(job, '2026-06-02T12:00:00', cfg8);
    expect(c.jobId).toBe('j1');
    expect(c.oldStart).toBe('2026-06-02T08:00:00');
    expect(c.newStart).toBe('2026-06-02T12:00:00');
    expect(c.newEnd).toBe('2026-06-03T12:00:00');
    expect(c.skipped).toBeUndefined();
  });

  it('carries the re-flowed per-day windows', () => {
    const c = timeShiftChange(job, '2026-06-02T12:00:00', cfg8);
    expect(c.dailyHours).toEqual({
      '2026-06-02': { startTime: '12:00', endTime: '16:00' },
      '2026-06-03': { startTime: '08:00', endTime: '12:00' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t timeShiftChange`
Expected: FAIL — `timeShiftChange is not a function`.

- [ ] **Step 3: Implement in `services/scheduleEngine.ts`**

First, extend `ProposedChange` (lines 37-47) to optionally carry the re-flowed windows so the view can seed its daily-hour edits. Add one field:

```ts
export interface ProposedChange {
  jobId: string;
  jobName: string;
  jobNumber: string;
  oldStart: string | null;
  oldEnd: string | null;
  newStart: string;
  newEnd: string;
  /** Present when the job was NOT changed; the row is informational only. */
  skipped?: SkipReason;
  /** Re-flowed per-day windows from a time-shift; seeds the editor's daily hours. */
  dailyHours?: Record<string, { startTime: string; endTime: string }>;
}
```

Then add after `reflowFromStart`:

```ts
/**
 * Build a ProposedChange that pushes a job's start to `newStartISO` and re-flows
 * its preserved window-hours forward (Option A spill). Returns the job's existing
 * dates as `old*` and the re-flowed span + per-day windows as the new state.
 */
export const timeShiftChange = (
  job: Job,
  newStartISO: string,
  config: WorkingTimeConfig,
): ProposedChange => {
  const duration = scheduledWindowHours(job, config) || Math.max(1, config.workDayEndHour - config.workDayStartHour);
  const r = reflowFromStart(newStartISO, duration, config);
  return {
    jobId: job.id,
    jobName: job.name,
    jobNumber: job.jobNumber,
    oldStart: job.startDate ?? null,
    oldEnd: job.endDate ?? null,
    newStart: r.newStart,
    newEnd: r.newEnd,
    dailyHours: r.dailyHours,
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts -t timeShiftChange`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat: add timeShiftChange building a re-flowed ProposedChange"
```

---

### Task 7: `sharedCrewScope` — expand a job's crew into a CascadeScope

**Files:**
- Modify: `services/rescheduleIssues.ts`
- Modify: `services/rescheduleIssues.test.ts`

Scope a cascade to exactly the jobs that `jobsShareCrew` would flag: expand the moved job's crew to every member of every crew group it shares. `isInScope` (in `scheduleEngine`) already matches any job sharing one of these members, so no change to `isInScope` is needed.

- [ ] **Step 1: Write the failing test**

Add to `services/rescheduleIssues.test.ts` (add `sharedCrewScope` to the import from `./rescheduleIssues`; if the file doesn't import `CrewGroup` types it already constructs them inline — match the existing style):

```ts
describe('sharedCrewScope', () => {
  const crews = [
    { id: 'g1', name: 'A', memberIds: ['m1', 'm2'] },
    { id: 'g2', name: 'B', memberIds: ['m3', 'm4'] },
  ] as any;

  it('includes the job members plus all members of shared groups', () => {
    const job = { id: 'j', crewMemberIds: ['m1'] } as any;
    const scope = sharedCrewScope(job, crews);
    expect(new Set(scope.crewMemberIds)).toEqual(new Set(['m1', 'm2']));
  });

  it('returns the job members alone when no crew groups match', () => {
    const job = { id: 'j', crewMemberIds: ['m9'] } as any;
    expect(sharedCrewScope(job, crews).crewMemberIds).toEqual(['m9']);
  });

  it('returns an empty member list for a crewless job', () => {
    const job = { id: 'j' } as any;
    expect(sharedCrewScope(job, crews).crewMemberIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/rescheduleIssues.test.ts -t sharedCrewScope`
Expected: FAIL — `sharedCrewScope is not a function`.

- [ ] **Step 3: Implement in `services/rescheduleIssues.ts`**

Add `CascadeScope` to the import from `./scheduleEngine` (the file already imports several names from it), then add after `jobsShareCrew`:

```ts
/**
 * A CascadeScope limiting a cascade to jobs that share crew with `job`: the job's
 * own members plus every member of every crew group it belongs to. Combined with
 * scheduleEngine's member-overlap `isInScope`, this matches `jobsShareCrew`.
 */
export const sharedCrewScope = (job: Job, crews: CrewGroup[]): CascadeScope => {
  const members = new Set<string>(job.crewMemberIds ?? []);
  for (const gid of groupsOf(job, crews)) {
    crews.find(c => c.id === gid)?.memberIds?.forEach(m => members.add(m));
  }
  return { crewMemberIds: [...members] };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/rescheduleIssues.test.ts -t sharedCrewScope`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add services/rescheduleIssues.ts services/rescheduleIssues.test.ts
git commit -m "feat: add sharedCrewScope for crew-scoped cascades"
```

---

### Task 8: Scope the existing date cascade (`cascadeFromEdit`)

**Files:**
- Modify: `services/scheduleEngine.ts:324-359`
- Modify: `services/scheduleEngine.test.ts`

Add an optional `scope` param. When given, only shared-crew jobs move; an empty member list means no followers move.

- [ ] **Step 1: Write the failing test**

Add to `services/scheduleEngine.test.ts` (add `cascadeFromEdit` to the import):

```ts
describe('cascadeFromEdit scope', () => {
  const cfg = configFromSettings(undefined, true);
  const mk = (over: Partial<Job>): Job => ({
    id: 'x', jobNumber: 'X', name: 'X', stage: 'Scheduled',
    startDate: '2026-06-02T08:00:00', endDate: '2026-06-02T17:00:00', ...over,
  } as Job);

  it('only moves followers within the crew scope', () => {
    const primary = mk({ id: 'p', crewMemberIds: ['m1'] });
    const jobs = [
      primary,
      mk({ id: 'shared', crewMemberIds: ['m1'], startDate: '2026-06-04T08:00:00', endDate: '2026-06-04T17:00:00' }),
      mk({ id: 'other', crewMemberIds: ['m9'], startDate: '2026-06-04T08:00:00', endDate: '2026-06-04T17:00:00' }),
    ];
    const primaryChange = { ...primary, oldStart: primary.startDate!, oldEnd: primary.endDate!, newStart: '2026-06-03T08:00:00', newEnd: '2026-06-03T17:00:00' } as any;
    const changes = cascadeFromEdit(jobs, primaryChange, cfg, undefined, { crewMemberIds: ['m1'] });
    const moved = changes.filter(c => !c.skipped).map(c => c.jobId);
    expect(moved).toContain('shared');
    expect(moved).not.toContain('other');
  });

  it('moves no followers when the scope has no members', () => {
    const primary = mk({ id: 'p', crewMemberIds: [] });
    const jobs = [primary, mk({ id: 'f', startDate: '2026-06-04T08:00:00', endDate: '2026-06-04T17:00:00' })];
    const primaryChange = { ...primary, oldStart: primary.startDate!, oldEnd: primary.endDate!, newStart: '2026-06-03T08:00:00', newEnd: '2026-06-03T17:00:00' } as any;
    const changes = cascadeFromEdit(jobs, primaryChange, cfg, undefined, { crewMemberIds: [] });
    expect(changes.map(c => c.jobId)).toEqual(['p']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t "cascadeFromEdit scope"`
Expected: FAIL — `other` is moved (no scope honored) and the empty-scope case returns followers.

- [ ] **Step 3: Edit `cascadeFromEdit` in `services/scheduleEngine.ts`**

Change the signature and the two early bits. Current signature (line 324) and body start:

```ts
export const cascadeFromEdit = (
  jobs: Job[],
  primaryChange: ProposedChange,
  config: WorkingTimeConfig,
  untilDate?: string,
): ProposedChange[] => {
  if (!primaryChange.oldStart) return [primaryChange];
  const deltaDays = Math.round(
    (localDayStartMs(primaryChange.newStart) - localDayStartMs(primaryChange.oldStart)) / MS_PER_DAY,
  );
  if (deltaDays === 0) return [primaryChange];
  const calendarConfig = { ...config, skipNonWorkingDays: false };
  const shifted = shiftJobsFromPoint(jobs, primaryChange.oldStart, deltaDays, 'days', calendarConfig);
```

Replace with:

```ts
export const cascadeFromEdit = (
  jobs: Job[],
  primaryChange: ProposedChange,
  config: WorkingTimeConfig,
  untilDate?: string,
  scope?: CascadeScope,
): ProposedChange[] => {
  if (!primaryChange.oldStart) return [primaryChange];
  // An explicit but empty crew scope means nothing shares crew → no followers.
  if (scope?.crewMemberIds && scope.crewMemberIds.length === 0) return [primaryChange];
  const deltaDays = Math.round(
    (localDayStartMs(primaryChange.newStart) - localDayStartMs(primaryChange.oldStart)) / MS_PER_DAY,
  );
  if (deltaDays === 0) return [primaryChange];
  const calendarConfig = { ...config, skipNonWorkingDays: false };
  const shifted = shiftJobsFromPoint(jobs, primaryChange.oldStart, deltaDays, 'days', calendarConfig, scope);
```

(The rest of the function — follower filtering, untilDate handling — is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts -t "cascadeFromEdit scope"`
Expected: PASS (2 tests). Also run the full engine suite to confirm no regression: `npx vitest run services/scheduleEngine.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat: scope cascadeFromEdit followers to shared crew"
```

---

### Task 9: `cascadeFromTimeShift` — cascade driven by end-date extension

**Files:**
- Modify: `services/scheduleEngine.ts`
- Modify: `services/scheduleEngine.test.ts`

A time-shift can keep the start day but push the **end** out (spill). `cascadeFromEdit` keys on the start delta and would not cascade that case. This helper keys on the end-date extension and shifts shared-crew jobs starting on/after the original end.

- [ ] **Step 1: Write the failing test**

Add to `services/scheduleEngine.test.ts` (add `cascadeFromTimeShift` to the import):

```ts
describe('cascadeFromTimeShift', () => {
  const cfg8 = { skipNonWorkingDays: true, weekendDays: [0, 6], holidays: [], workDayStartHour: 8, workDayEndHour: 16 };
  const mk = (over: Partial<Job>): Job => ({
    id: 'x', jobNumber: 'X', name: 'X', stage: 'Scheduled',
    startDate: '2026-06-02T08:00:00', endDate: '2026-06-02T16:00:00', ...over,
  } as Job);

  it('pushes shared-crew followers by the end-date extension', () => {
    // primary spilled from ending Jun 2 to ending Jun 3 (+1 day).
    const primaryChange = {
      jobId: 'p', jobName: 'P', jobNumber: 'P',
      oldStart: '2026-06-02T08:00:00', oldEnd: '2026-06-02T16:00:00',
      newStart: '2026-06-02T12:00:00', newEnd: '2026-06-03T12:00:00',
    } as any;
    const jobs = [
      mk({ id: 'p', crewMemberIds: ['m1'] }),
      mk({ id: 'follow', crewMemberIds: ['m1'], startDate: '2026-06-03T08:00:00', endDate: '2026-06-03T16:00:00' }),
      mk({ id: 'other', crewMemberIds: ['m9'], startDate: '2026-06-03T08:00:00', endDate: '2026-06-03T16:00:00' }),
    ];
    const changes = cascadeFromTimeShift(jobs, primaryChange, cfg8, { crewMemberIds: ['m1'] });
    const follow = changes.find(c => c.jobId === 'follow');
    expect(follow?.skipped).toBeUndefined();
    expect(toLocalDateKey(new Date(follow!.newStart))).toBe('2026-06-04'); // +1 day
    // Different-crew job is not moved.
    expect(changes.find(c => c.jobId === 'other')?.skipped ?? 'absent').not.toBe(undefined);
  });

  it('returns only the primary when the end did not move', () => {
    const primaryChange = {
      jobId: 'p', jobName: 'P', jobNumber: 'P',
      oldStart: '2026-06-02T08:00:00', oldEnd: '2026-06-02T16:00:00',
      newStart: '2026-06-02T10:00:00', newEnd: '2026-06-02T16:00:00',
    } as any;
    const jobs = [mk({ id: 'p', crewMemberIds: ['m1'] })];
    expect(cascadeFromTimeShift(jobs, primaryChange, cfg8, { crewMemberIds: ['m1'] })).toEqual([primaryChange]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t cascadeFromTimeShift`
Expected: FAIL — `cascadeFromTimeShift is not a function`.

- [ ] **Step 3: Implement in `services/scheduleEngine.ts`**

Add after `cascadeFromEdit`:

```ts
/**
 * Cascade for a time-shift whose spill pushed the job's END date out. Shifts
 * shared-crew jobs starting on/after the primary's ORIGINAL end forward by the
 * end-date extension (in calendar days), preserving gaps. Returns
 * [primaryChange, ...followers]. No movement when the end didn't advance or the
 * crew scope is empty.
 */
export const cascadeFromTimeShift = (
  jobs: Job[],
  primaryChange: ProposedChange,
  config: WorkingTimeConfig,
  scope?: CascadeScope,
  untilDate?: string,
): ProposedChange[] => {
  if (!primaryChange.oldEnd) return [primaryChange];
  if (scope?.crewMemberIds && scope.crewMemberIds.length === 0) return [primaryChange];
  const endDelta = Math.round(
    (localDayStartMs(primaryChange.newEnd) - localDayStartMs(primaryChange.oldEnd)) / MS_PER_DAY,
  );
  if (endDelta <= 0) return [primaryChange];
  const calendarConfig = { ...config, skipNonWorkingDays: false };
  const shifted = shiftJobsFromPoint(jobs, primaryChange.oldEnd, endDelta, 'days', calendarConfig, scope, untilDate);
  const followers = shifted.filter(c => c.jobId !== primaryChange.jobId && !c.skipped);
  return [primaryChange, ...followers];
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts -t cascadeFromTimeShift`
Expected: PASS (2 tests). Then run the full suite: `npx vitest run services/`.

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat: add cascadeFromTimeShift keyed on end-date extension"
```

---

# PHASE 3 — Wiring into the view & panel

### Task 10: View — scope existing cascades and add `handleShiftStartTime`

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

- [ ] **Step 1: Import the new engine + scope helpers**

Update the `scheduleEngine` import (line 13) to add `timeShiftChange, cascadeFromTimeShift`:

```ts
import { ProposedChange, configFromSettings, moveJobToSlot, shiftJobsFromPoint, toLocalDateKey, spannedDayKeys, workingDayKeys, applyDailyHours, cascadeFromEdit, cascadeFromTimeShift, cascadeLeapfrogIds, timeShiftChange } from '../../services/scheduleEngine';
```

Add `sharedCrewScope` to the existing import from `../../services/rescheduleIssues` (the file already imports `detectIssues` from there — add `sharedCrewScope` to that statement).

- [ ] **Step 2: Add a scope helper bound to the current jobs/crews**

Add near the other handlers (e.g. just above `handleChangeJobDate` at line 424):

```ts
  // Crew scope for cascades: the primary job's crew expanded across shared crew
  // groups. An empty list (crewless job) yields no followers.
  const scopeForJob = useCallback((jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    return job ? sharedCrewScope(job, crews) : { crewMemberIds: [] };
  }, [jobs, crews]);
```

- [ ] **Step 3: Pass scope to the three existing cascade calls**

In `handleChangeJobDate` (line 441), `handleToggleCascade` (line 452), and `handleChangeCascadeUntil` (line 462), add the scope argument to each `cascadeFromEdit(...)` call. For example, line 441 becomes:

```ts
    preview.setChanges(cascade ? cascadeFromEdit(jobs, primaryChange, workConfig, cascadeUntil, scopeForJob(primaryChange.jobId)) : [primaryChange]);
```

Line 452 becomes:

```ts
    preview.setChanges(on ? cascadeFromEdit(jobs, primary, workConfig, cascadeUntil, scopeForJob(primary.jobId)) : [primary]);
```

Line 462 becomes:

```ts
    preview.setChanges(cascadeFromEdit(jobs, primary, workConfig, date, scopeForJob(primary.jobId)));
```

- [ ] **Step 4: Add `handleShiftStartTime` (the smart time-shift entry point)**

Add after `handleChangeDayWindow` (line 700). It builds the re-flowed primary change, cascades shared-crew conflicts, stages the preview with cascade ON when there are followers, and seeds the daily-hour edits from the re-flow:

```ts
  // Smart time-shift: push a job's start to `startTime` on `dayKey`, re-flow it
  // forward (spill into the next working day), and cascade shared-crew conflicts.
  // Routes through the same preview/Apply pipeline as date edits.
  const handleShiftStartTime = (jobId: string, dayKey: string, startTime: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || job.is_locked) return;
    const primaryChange = timeShiftChange(job, `${dayKey}T${startTime}:00`, workConfig);
    const scope = sharedCrewScope(job, crews);
    const cascaded = cascadeFromTimeShift(jobs, primaryChange, workConfig, scope);
    const hasFollowers = cascaded.some(c => c.jobId !== jobId && !c.skipped);
    setCascade(hasFollowers); // default ON when shared-crew conflicts exist
    setCascadeUntil('');
    preview.stage({
      changes: hasFollowers ? cascaded : [primaryChange],
      label: `Reschedule ${job.name}`,
      mode: 'edit',
      primaryJobId: jobId,
      commit: (eff) => onApplySchedule(eff, `Reschedule ${job.name}`),
    });
    setPendingMoveId(jobId);
  };
```

- [ ] **Step 5: Seed daily-hour edits from a time-shift's re-flowed windows**

The effect at lines 406-422 seeds `dailyHoursEdits` from `job.dailyHours` or defaults. Make it prefer the change's own `dailyHours` (the re-flow output) when present. In that effect, change the per-key mapping (line 416-419) to:

```ts
      next[c.jobId] = Object.fromEntries(keys.map(k => [
        k,
        c.dailyHours?.[k] ?? job?.dailyHours?.[k] ?? { startTime: defStart, endTime: defEnd },
      ]));
```

- [ ] **Step 6: Compile-check the view**

Run: `npx vitest run components/views/JobScheduling/` and `npx tsc --noEmit`
Expected: PASS / no type errors. (Behavior of `handleShiftStartTime` is covered by the engine tests in Phase 2; the wiring is verified manually in Task 12's checkpoint.)

- [ ] **Step 7: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: scope cascades to shared crew and add smart time-shift handler"
```

---

### Task 11: Route the Day-board block drag through the time-shift

**Files:**
- Modify: `components/views/JobSchedulingView.tsx:696-700`

The Day-board block drag already calls `onChangeDayWindow(jobId, dayKey, { startTime, endTime })` with the new window after a vertical drag. A drag always moves the start, so route it through the smart time-shift instead of the immediate single-day commit.

- [ ] **Step 1: Rewrite `handleChangeDayWindow`**

Replace the current body (lines 696-700):

```ts
  const handleChangeDayWindow = (jobId: string, dayKey: string, window: { startTime: string; endTime: string }) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    onUpdateJob(setJobDayWindow(job, dayKey, window));
  };
```

with one that treats a changed **start** as a smart time-shift (staged in the preview) and a start-unchanged window tweak as the existing immediate per-day edit:

```ts
  const handleChangeDayWindow = (jobId: string, dayKey: string, window: { startTime: string; endTime: string }) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const prevStart = job.dailyHours?.[dayKey]?.startTime
      ?? `${String(workConfig.workDayStartHour).padStart(2, '0')}:00`;
    if (window.startTime !== prevStart) {
      handleShiftStartTime(jobId, dayKey, window.startTime);
    } else {
      onUpdateJob(setJobDayWindow(job, dayKey, window));
    }
  };
```

(`handleShiftStartTime` is defined in Task 10; if the linter complains about declaration order, move `handleChangeDayWindow` below `handleShiftStartTime`.)

- [ ] **Step 2: Compile-check**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: Day-board block drag triggers smart time-shift preview"
```

---

### Task 12: Reschedule panel "Start time" control (second trigger) + manual verification

**Files:**
- Modify: `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`
- Modify: `components/views/JobSchedulingView.tsx` (pass the new prop)

- [ ] **Step 1: Add the `onShiftStartTime` prop to SingleJobEditor**

In `SingleJobEditorProps` (the interface starting near line 13), add:

```ts
  /** Push the job's start to a new time-of-day on its first day (smart time-shift). */
  onShiftStartTime?: (jobId: string, dayKey: string, startTime: string) => void;
```

Destructure `onShiftStartTime` in the component's prop list.

- [ ] **Step 2: Render a Start-time field in the schedule row**

`SingleJobEditor` already imports `TimeInput` from `'../../../UI'`. There is a `hhmm`-style helper needed; reuse the existing `fmtRange` area (lines 239-243). Replace the Job Schedule row (lines 239-243) with one that adds a `TimeInput` bound to the start time:

```tsx
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 shrink-0 text-gray-400" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Job Schedule</span>
              <span className="ml-auto text-sm font-bold text-gray-900 dark:text-white">{fmtRange(c.newStart, c.newEnd)}</span>
            </div>
            {onShiftStartTime && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Start time</span>
                <span className="ml-auto">
                  <TimeInput
                    value={c.newStart.slice(11, 16)}
                    onChange={(v) => onShiftStartTime(c.jobId, c.newStart.slice(0, 10), v)}
                  />
                </span>
              </div>
            )}
```

(Verify `TimeInput`'s prop names against `components/UI.tsx` — it is used elsewhere in this file via the daily-hours rows; match that call's `value`/`onChange` contract exactly.)

- [ ] **Step 3: Pass the handler from the view**

Where `JobSchedulingView` renders `SingleJobEditor` (inside the reschedule panel — search for `SingleJobEditor` or the `ReschedulePreviewPanel` props that forward to it), pass `onShiftStartTime={handleShiftStartTime}`. If the editor is rendered via `ReschedulePreviewPanel`, thread the prop through that component's props the same way `onChangeDailyHour` is threaded.

- [ ] **Step 4: Compile-check + full test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Manual verification (both triggers + cascade)**

Start the app (`npm run dev`) and, on the Job Scheduling page:
1. Open a multi-day job's reschedule panel, change **Start time** to a later hour. Confirm the preview shows the spill (end date extended) and the Impact tiles update.
2. On the **Day** board, drag a job block to a later time. Confirm the same preview appears.
3. With a job whose crew is shared by a later job, confirm the cascade toggle is **ON** by default and the follower moves; toggle off and confirm it stays put.
4. Confirm a different-crew job on the same day is **not** dragged along.
5. Confirm the job's **Total** hours (estimate) is unchanged throughout, and only Assigned/progress moves.

- [ ] **Step 6: Commit**

```bash
git add components/views/JobScheduling/reschedule/SingleJobEditor.tsx components/views/JobSchedulingView.tsx
git commit -m "feat: add reschedule-panel start-time control for smart time-shift"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** Part 1 → Tasks 1-3. Part 2 (re-flow engine) → Tasks 4-6. Part 3 (unified shared-crew cascade) → Tasks 7-9 (engine) + Task 10 (existing date cascade now scoped). Confirmation/cascade-default-ON → Task 10 + Task 12. Both triggers → Task 11 (drag) + Task 12 (panel).
- **Type consistency:** `timeShiftChange` returns a `ProposedChange` extended with optional `dailyHours` (Task 6); the view seeds edits from it (Task 10 Step 5). `sharedCrewScope` returns `CascadeScope` consumed by `cascadeFromEdit`/`cascadeFromTimeShift`.
- **Edge cases:** zero-estimate job → `timeShiftChange` falls back to one workday length; empty crew scope → no followers; weekend/holiday spill handled by `advanceWorkingDays`/`isNonWorkingDay` inside `reflowFromStart`.
- **Verify before claiming done:** `npx vitest run` (all green) and `npx tsc --noEmit` (no errors), plus the Task 12 manual checks.
