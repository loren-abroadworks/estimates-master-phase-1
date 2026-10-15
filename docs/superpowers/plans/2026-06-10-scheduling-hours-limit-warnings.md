# Scheduling Hours-Limit Warnings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show two advisory, non-blocking warnings in the Edit Schedule drawer when a job goes over its estimated hours (budget) or a crew member goes over their daily capacity, recomputed live as the user edits dates/hours/crew.

**Architecture:** A new pure service `services/hoursWarnings.ts` computes the warnings from the staged (unsaved) edits and returns `ScheduleIssue[]` with two new kinds (`'budget'`, `'day-capacity'`). `JobSchedulingView` computes them in a memo and passes them through `ReschedulePreviewPanel` to `SingleJobEditor`, which renders them in their own amber block, separate from the auto-fixable conflict issues.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest, Tailwind CSS, lucide-react icons.

---

## File Structure

- **Modify** `services/rescheduleIssues.ts` — add `'budget' | 'day-capacity'` to the `IssueKind` union (the shared `ScheduleIssue` type lives here).
- **Modify** `services/crewHoursGrid.ts` — export the existing `memberJobDayHours` helper so the new service can reuse the canonical per-member/per-day hours calculation for other jobs.
- **Create** `services/hoursWarnings.ts` — `detectHoursWarnings(...)`, pure function returning `ScheduleIssue[]`.
- **Create** `services/hoursWarnings.test.ts` — unit tests.
- **Modify** `components/views/JobSchedulingView.tsx` — compute a `hoursWarnings` memo for the edited job and pass it to the panel.
- **Modify** `components/views/JobScheduling/ReschedulePreviewPanel.tsx` — accept and forward a `hoursWarnings` prop.
- **Modify** `components/views/JobScheduling/reschedule/SingleJobEditor.tsx` — render the warnings in a distinct amber block.

---

## Task 1: Add the two new issue kinds

**Files:**
- Modify: `services/rescheduleIssues.ts:30`

- [ ] **Step 1: Extend the `IssueKind` union**

In `services/rescheduleIssues.ts`, change line 30 from:

```ts
export type IssueKind = 'double-book' | 'weekend' | 'capacity' | 'past-due';
```

to:

```ts
export type IssueKind =
  | 'double-book' | 'weekend' | 'capacity' | 'past-due'
  | 'budget' | 'day-capacity';
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors (existing `detectIssues` code is unaffected).

- [ ] **Step 3: Commit**

```bash
git add services/rescheduleIssues.ts
git commit -m "feat: add budget and day-capacity issue kinds"
```

---

## Task 2: Export `memberJobDayHours` for reuse

**Files:**
- Modify: `services/crewHoursGrid.ts:52`

- [ ] **Step 1: Export the helper**

In `services/crewHoursGrid.ts`, change line 52 from:

```ts
const memberJobDayHours = (
```

to:

```ts
export const memberJobDayHours = (
```

Leave the rest of the function body unchanged. Its signature is:

```ts
export const memberJobDayHours = (
  job: Job,
  memberId: string,
  dateKey: string,
  standardDay: number,
): number => { /* ... unchanged ... */ };
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add services/crewHoursGrid.ts
git commit -m "refactor: export memberJobDayHours for reuse"
```

---

## Task 3: Create `detectHoursWarnings` (TDD)

**Files:**
- Create: `services/hoursWarnings.ts`
- Test: `services/hoursWarnings.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `services/hoursWarnings.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { detectHoursWarnings } from './hoursWarnings';
import type { Job } from '../types';

// A staged day always uses an 8-hour window unless overridden.
const day8 = { startTime: '08:00', endTime: '16:00' }; // 8h

// Minimal Job factory for "other jobs" on the board.
const job = (over: Partial<Job>): Job => ({
  id: 'other', jobNumber: 'J-9', name: 'Other', stage: 'Scheduled',
  startDate: '2026-06-16T08:00:00', endDate: '2026-06-16T17:00:00',
  crewMemberIds: ['m1'], dateCreated: '', clientId: '', estimateId: '', address: '',
  ...over,
} as Job);

const base = {
  jobId: 'j1',
  jobName: 'Job 1',
  stagedDays: ['2026-06-16'],
  dailyHours: { '2026-06-16': day8 },
  crew: [{ id: 'm1', name: 'Alex' }],
  estHours: 40,
  otherJobs: [] as Job[],
  capacityHours: 8,
  standardDay: 9,
};

const kinds = (args: Parameters<typeof detectHoursWarnings>[0]) =>
  detectHoursWarnings(args).map(i => i.kind).sort();

describe('detectHoursWarnings — budget', () => {
  it('no warning when scheduled hours are under the estimate', () => {
    // 1 member x 8h x 1 day = 8h < 40h
    expect(kinds(base)).not.toContain('budget');
  });

  it('no warning when scheduled hours exactly equal the estimate', () => {
    // 1 member x 8h x 5 days = 40h === 40h
    const days = ['2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-22'];
    const dailyHours = Object.fromEntries(days.map(d => [d, day8]));
    expect(kinds({ ...base, stagedDays: days, dailyHours })).not.toContain('budget');
  });

  it('warns when scheduled hours exceed the estimate', () => {
    const days = ['2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-22', '2026-06-23'];
    const dailyHours = Object.fromEntries(days.map(d => [d, day8])); // 48h > 40h
    const issues = detectHoursWarnings({ ...base, stagedDays: days, dailyHours });
    const budget = issues.find(i => i.kind === 'budget');
    expect(budget).toBeDefined();
    expect(budget!.severity).toBe('low');
    expect(budget!.message).toContain('48.0h');
    expect(budget!.message).toContain('40.0h');
  });

  it('counts per-person hours (2 members double the total)', () => {
    // 2 members x 8h x 3 days = 48h > 40h
    const days = ['2026-06-16', '2026-06-17', '2026-06-18'];
    const dailyHours = Object.fromEntries(days.map(d => [d, day8]));
    expect(kinds({
      ...base, stagedDays: days, dailyHours,
      crew: [{ id: 'm1', name: 'Alex' }, { id: 'm2', name: 'Bo' }],
    })).toContain('budget');
  });

  it('no budget warning when there is no work order (estHours = 0)', () => {
    const days = ['2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-22', '2026-06-23'];
    const dailyHours = Object.fromEntries(days.map(d => [d, day8]));
    expect(kinds({ ...base, estHours: 0, stagedDays: days, dailyHours })).not.toContain('budget');
  });
});

describe('detectHoursWarnings — day capacity', () => {
  it('no warning when a single day is within capacity', () => {
    expect(kinds(base)).not.toContain('day-capacity');
  });

  it('warns when this job alone exceeds the daily cap', () => {
    const long = { startTime: '07:00', endTime: '19:00' }; // 12h > 8h cap
    const issues = detectHoursWarnings({ ...base, dailyHours: { '2026-06-16': long } });
    const cap = issues.find(i => i.kind === 'day-capacity');
    expect(cap).toBeDefined();
    expect(cap!.severity).toBe('medium');
    expect(cap!.message).toContain('Alex');
    expect(cap!.message).toContain('12.0h');
    expect(cap!.message).toContain('8.0h');
  });

  it('warns when another job that day pushes the member over the cap', () => {
    // This job: 8h. Other job m1 works the same day: +9h standard => 17h > 8h.
    const other = job({ id: 'other', crewMemberIds: ['m1'] });
    expect(kinds({ ...base, otherJobs: [other] })).toContain('day-capacity');
  });

  it('ignores other jobs that do not include the member', () => {
    const other = job({ id: 'other', crewMemberIds: ['someone-else'] });
    expect(kinds({ ...base, otherJobs: [other] })).not.toContain('day-capacity');
  });

  it('reports only the overloaded member, once per day', () => {
    const long = { startTime: '07:00', endTime: '19:00' }; // 12h
    const issues = detectHoursWarnings({
      ...base,
      dailyHours: { '2026-06-16': long },
      crew: [{ id: 'm1', name: 'Alex' }, { id: 'm2', name: 'Bo' }],
    });
    const caps = issues.filter(i => i.kind === 'day-capacity');
    // Both members work 12h this single day, so both are reported — once each.
    expect(caps).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/hoursWarnings.test.ts`
Expected: FAIL — `Failed to resolve import "./hoursWarnings"` (module does not exist yet).

- [ ] **Step 3: Implement `detectHoursWarnings`**

Create `services/hoursWarnings.ts`:

```ts
import type { Job } from '../types';
import type { ScheduleIssue } from './rescheduleIssues';
import { formatDisplayDate } from './scheduleEngine';
import { memberJobDayHours } from './crewHoursGrid';

interface DayHours { startTime: string; endTime: string }

/** Hours in a single day window, e.g. 08:00–16:00 = 8. Never negative. */
const dayLength = (h: DayHours | undefined): number => {
  if (!h) return 0;
  const [sh, sm] = (h.startTime || '08:00').split(':').map(Number);
  const [eh, em] = (h.endTime || '17:00').split(':').map(Number);
  return Math.max(0, (eh + em / 60) - (sh + sm / 60));
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface HoursWarningArgs {
  jobId: string;
  jobName: string;
  /** Working-day keys (YYYY-MM-DD) the edited job spans, staged. */
  stagedDays: string[];
  /** Staged per-day hours for the edited job, keyed by day. */
  dailyHours: Record<string, DayHours>;
  /** Staged crew assigned to the edited job. */
  crew: { id: string; name: string }[];
  /** Estimated production hours for the job's work order (0 if none). */
  estHours: number;
  /** All other jobs on the board (everything except the edited job). */
  otherJobs: Job[];
  /** Per-crew daily capacity in hours. */
  capacityHours: number;
  /** Standard workday length, used as the fallback for other jobs' hours. */
  standardDay: number;
}

/**
 * Advisory warnings shown live while editing one job's schedule. Pure: all
 * inputs are the STAGED (unsaved) edits plus the rest of the board, so the
 * result tracks what the user is currently scheduling. Two kinds:
 *  - 'budget': per-person labor hours scheduled exceed the work-order estimate.
 *  - 'day-capacity': a crew member's hours across ALL jobs on a day exceed the cap.
 * Only emitted when strictly over the limit. Never blocks; not auto-fixable.
 */
export const detectHoursWarnings = (args: HoursWarningArgs): ScheduleIssue[] => {
  const { jobId, jobName, stagedDays, dailyHours, crew, estHours, otherJobs, capacityHours, standardDay } = args;
  const issues: ScheduleIssue[] = [];

  // Budget: sum daily hours across staged days, multiplied by crew size.
  const perPersonHours = stagedDays.reduce((sum, day) => sum + dayLength(dailyHours[day]), 0);
  const projected = round1(perPersonHours * crew.length);
  if (estHours > 0 && projected > estHours) {
    issues.push({
      jobId, jobName, kind: 'budget', severity: 'low',
      message: `Over estimate by ${round1(projected - estHours).toFixed(1)}h — scheduling ${projected.toFixed(1)}h against a ${estHours.toFixed(1)}h estimate.`,
    });
  }

  // Day capacity: for each member, on each staged day, this job's staged hours
  // plus the member's hours from every other job occupying that day.
  for (const day of stagedDays) {
    const thisJobHours = dayLength(dailyHours[day]);
    for (const member of crew) {
      const otherHours = otherJobs.reduce(
        (sum, j) => j.id === jobId ? sum : sum + memberJobDayHours(j, member.id, day, standardDay),
        0,
      );
      const total = round1(thisJobHours + otherHours);
      if (total > capacityHours) {
        issues.push({
          jobId, jobName, kind: 'day-capacity', severity: 'medium',
          message: `${formatDisplayDate(day)}: ${member.name} over capacity — ${total.toFixed(1)}h scheduled (cap ${capacityHours.toFixed(1)}h).`,
        });
      }
    }
  }

  return issues;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run services/hoursWarnings.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add services/hoursWarnings.ts services/hoursWarnings.test.ts
git commit -m "feat: add detectHoursWarnings service for budget and capacity warnings"
```

---

## Task 4: Render warnings in `SingleJobEditor`

**Files:**
- Modify: `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`

- [ ] **Step 1: Import an icon and accept the prop**

In `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`, line 2, add `AlertTriangle` to the lucide import:

```ts
import { Briefcase, CalendarClock, Users, UserCog, Info, AlertTriangle } from 'lucide-react';
```

In `SingleJobEditorProps` (after the `issues` field, around line 16), add:

```ts
  /** Advisory hours warnings (budget / day-capacity) for this job. Not auto-fixable. */
  hoursWarnings?: ScheduleIssue[];
```

In the destructured params (line 61), add `hoursWarnings = [],`:

```ts
export const SingleJobEditor = ({
  change: c, clientName, issues, hoursWarnings = [], suggestions, onAutoFix, stats, crew, onReassignCrew, dayHours, onChangeDailyHour, onChangeJobDate, nonWorkingWeekdays = [], autoFixPreviewActive, cascade, onToggleCascade, followingJobs = [], cascadeUntil = '', onChangeCascadeUntil, protectedJobs = [], leapfrogJobNames = [],
}: SingleJobEditorProps) => {
```

- [ ] **Step 2: Filter the warnings for this job**

After the `jobIssues` line (line 65), add:

```ts
  const jobHoursWarnings = hoursWarnings.filter(w => w.jobId === c.jobId);
```

- [ ] **Step 3: Render the warnings block before the Impact tile**

In the JSX, find the `{/* Compact impact */}` block (around line 211). Immediately BEFORE it, insert:

```tsx
      {/* Hours advisories — over estimate / over daily capacity. Advisory only. */}
      {jobHoursWarnings.length > 0 && (
        <div className="space-y-1.5">
          {jobHoursWarnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. (`ScheduleIssue` is already imported at line 5.)

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/reschedule/SingleJobEditor.tsx
git commit -m "feat: render hours advisories in single-job editor"
```

---

## Task 5: Forward the prop through `ReschedulePreviewPanel`

**Files:**
- Modify: `components/views/JobScheduling/ReschedulePreviewPanel.tsx`

- [ ] **Step 1: Add the prop to the interface**

In `ReschedulePreviewPanelProps` (after the `issues` field, around line 16), add:

```ts
  /** Advisory hours warnings for the edited job, passed to SingleJobEditor. */
  hoursWarnings?: ScheduleIssue[];
```

- [ ] **Step 2: Destructure it**

In the component params (line 50-53), add `hoursWarnings,` alongside `issues`:

```ts
export const ReschedulePreviewPanel = ({
  staged, issues, hoursWarnings, suggestions, impact, onApply, onCancel, onAutoFix, onPreviewAutoFix, onCancelAutoFix, onChangeDelay,
  dailyHoursEdits, onChangeDailyHour, onChangeJobDate, crewByJob, onReassignCrew, statsByJob, clientNameByJob, nonWorkingWeekdays,
  cascade, onToggleCascade, followingJobs, cascadeUntil, onChangeCascadeUntil, protectedJobs, leapfrogJobNames,
}: ReschedulePreviewPanelProps) => {
```

- [ ] **Step 3: Pass it to `SingleJobEditor`**

In the `<SingleJobEditor ... />` JSX (around line 159), add the prop just after `issues={issues}`:

```tsx
              issues={issues}
              hoursWarnings={hoursWarnings}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. (`ScheduleIssue` is already imported at line 5.)

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/ReschedulePreviewPanel.tsx
git commit -m "feat: forward hoursWarnings through reschedule panel"
```

---

## Task 6: Compute and pass `hoursWarnings` in `JobSchedulingView`

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

- [ ] **Step 1: Import the service**

Near the other service imports (around line 14-22), add:

```ts
import { detectHoursWarnings } from '../../services/hoursWarnings';
```

- [ ] **Step 2: Add the `hoursWarnings` memo**

Insert this memo AFTER the `statsByJob` memo (which ends around line 562) so it can reuse `crewByJob`, `statsByJob`, `dailyHoursEdits`, `capacityHours`, and `workConfig`:

```ts
  // Advisory hours warnings for the job being edited (budget + daily capacity).
  // Computed from the STAGED edits so they track live changes. Edit mode only.
  const hoursWarnings = useMemo<ScheduleIssue[]>(() => {
    const s = preview.staged;
    if (!s || s.mode !== 'edit') return [];
    const primary = s.primaryJobId
      ? (s.changes.find(c => c.jobId === s.primaryJobId && !c.skipped) ?? s.changes.find(c => !c.skipped))
      : s.changes.find(c => !c.skipped);
    if (!primary) return [];
    const crewMembers = crewByJob[primary.jobId] ?? [];
    const standardDay = workConfig.workDayEndHour - workConfig.workDayStartHour;
    return detectHoursWarnings({
      jobId: primary.jobId,
      jobName: primary.jobName,
      stagedDays: workingDayKeys(primary.newStart, primary.newEnd, workConfig.weekendDays),
      dailyHours: dailyHoursEdits[primary.jobId] ?? {},
      crew: crewMembers.map(m => ({ id: m.id, name: m.name })),
      estHours: statsByJob[primary.jobId]?.estHours ?? 0,
      otherJobs: jobs.filter(j => j.id !== primary.jobId),
      capacityHours,
      standardDay,
    });
  }, [preview.staged, crewByJob, statsByJob, dailyHoursEdits, jobs, capacityHours, workConfig]);
```

> Note: `workingDayKeys` is already imported in this file (used at line 384); `ScheduleIssue` is imported at line 14; `useMemo` is already in use. If `workingDayKeys` is NOT in the import list, add it to the `../../services/scheduleEngine` import.

- [ ] **Step 3: Pass it to the panel**

In the `<ReschedulePreviewPanel ... />` JSX (around line 984), add the `hoursWarnings` prop next to the existing `issues={issues}` prop:

```tsx
          issues={issues}
          hoursWarnings={hoursWarnings}
```

> If `issues={issues}` is written on a single line with other props, locate the `issues={issues}` token and add `hoursWarnings={hoursWarnings}` immediately after it.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all suites green, including the new `hoursWarnings.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: wire hours warnings into job scheduling edit drawer"
```

---

## Task 7: Manual verification

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify the budget warning**

1. Open the Job Scheduling page.
2. Edit a job that has a linked work order (so it shows an "Est." value in the Impact tile).
3. Extend its end date / increase daily hours / add crew until per-person scheduled hours exceed the estimate.
4. Confirm an amber warning with a triangle icon appears above the Impact tile reading e.g. "Over estimate by X.Xh …", and that Apply is still enabled.

- [ ] **Step 3: Verify the capacity warning**

1. Edit a job and set a day's hours wider than the daily capacity (e.g. 07:00–19:00 with an 8h cap), OR assign a crew member already booked on another job that day.
2. Confirm an amber warning naming the member and day appears, and Apply is still enabled.

- [ ] **Step 4: Verify no false positives**

1. Edit a job comfortably under both limits and confirm no hours warnings appear.
2. Edit a job with no work order and confirm no budget warning appears.

---

## Self-Review Notes

- **Spec coverage:** budget warning (Task 3 + tests), per-person basis (Task 3 + test), no-work-order skip (Task 3 + test), day-capacity cross-job sum (Task 3 + test), advisory/non-blocking & separate block (Tasks 4-6, Apply never disabled by warnings), live recompute from staged edits (Task 6 memo deps), unit tests (Task 3), distinct amber rendering near Impact tile (Task 4). All covered.
- **Type consistency:** `detectHoursWarnings(args: HoursWarningArgs)` is referenced consistently; `ScheduleIssue` reused unchanged; `memberJobDayHours(job, memberId, dateKey, standardDay)` matches the exported signature from Task 2.
- **Out of scope (per spec):** board cards, crew-hours grid, top-level banner, bulk preview, blocking/confirm, "approaching" tier — none added.
```