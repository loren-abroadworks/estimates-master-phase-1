# Job Scheduling — "Over the limit" hours warnings

**Date:** 2026-06-10
**Status:** Approved design, pending implementation plan

## Problem

When a user schedules a job in the Job Scheduling page, nothing tells them when
they have committed more hours than the work allows. Two ways to go "over the
limit" matter:

1. **Project over budget** — the labor hours scheduled for a job exceed its
   estimated production hours (the estimate the job was sold against).
2. **Crew over daily capacity** — a crew member is scheduled for more hours on a
   given day (across all their jobs) than their daily capacity.

The user wants to be warned about both, **live, while actively scheduling** —
not as an always-on passive indicator elsewhere.

## Behavior

- **Advisory only.** Warnings never block Apply. The user can knowingly schedule
  over the limit.
- **Only when over.** No "approaching the limit" caution tier. A warning appears
  only once the relevant total strictly exceeds the limit.
- **Surface:** the **Edit Schedule** drawer — `SingleJobEditor`, the panel shown
  while editing a single job's dates / daily hours / crew. Warnings recompute as
  the user changes those staged values, so the feedback is live.
- Scoped to the single job being edited (edit mode). Bulk reschedule previews are
  out of scope for this iteration (YAGNI).

## The two warnings

### 1. Project over budget (`kind: 'budget'`)

- **Limit:** `WorkOrder.totalProductionHours` for the job's linked work order —
  the same value surfaced as "Est." in the Impact tile (`computeJobStats().estHours`).
- **Scheduled hours basis:** **per-person labor hours**, computed from the
  *staged* edits (not the saved allocations), so it tracks live edits:

  ```
  projected = Σ over staged working days ( daily-hours(day) ) × stagedCrewMemberCount
  ```

  This matches how the existing "Assigned" hours number is computed
  (`jobStats.assignedHoursOf`: days × dailyHours × member count), so the warning
  is consistent with the figure shown right next to it.
- **Trigger:** `estHours > 0 && projected > estHours`.
- **No work order / `estHours === 0`:** no budget is known, so no warning.
- **Severity:** `low` (advisory).
- **Message shape:** e.g.
  `Over estimate by 6.0h — scheduling 46.0h against a 40.0h estimate.`

### 2. Crew over daily capacity (`kind: 'day-capacity'`)

- **Limit:** `crewDailyCapacityHours` from scheduling settings, falling back to
  the workday length (`workDayEndHour - workDayStartHour`) — same `capacityHours`
  value already derived in `JobSchedulingView`.
- **Scheduled hours basis (per member, per staged working day):**

  ```
  memberDayHours = stagedHoursForThisJob(member, day)
                 + Σ hours from the member's OTHER scheduled jobs occupying that day
  ```

  - This job's contribution uses the **staged** daily hours for that day (live).
  - Other jobs' contributions come from their **saved** `dailyHours` (else their
    allocation start/end times, else the workday default), summed for every other
    job that occupies that day and includes the member.
- **Trigger:** `memberDayHours > capacityHours` for any (member, staged working
  day) pair.
- **Severity:** `medium`.
- **Message shape:** e.g.
  `Tue Jun 16: Alex over capacity — 11.0h scheduled (cap 8.0h).`
- One warning per (member, day) that is over; deduped so the same member/day is
  reported once.

## Architecture

### New service: `services/hoursWarnings.ts`

A pure, fully unit-testable function:

```ts
detectHoursWarnings(args: {
  jobId: string;
  jobName: string;
  stagedDays: string[];                 // working-day keys for the edited job (YYYY-MM-DD)
  dailyHours: Record<string, DayHours>; // staged per-day {startTime,endTime} for this job
  crewMemberIds: string[];              // staged crew for this job
  estHours: number;                     // computeJobStats(...).estHours
  otherJobs: Job[];                     // all jobs except the one being edited
  capacityHours: number;
  config: WorkingTimeConfig;            // for occupiesWorkingDay / day math
}): ScheduleIssue[]
```

Returns `ScheduleIssue[]` reusing the existing interface. Helper for daily-hours
duration mirrors `jobStats` (parse `HH:mm`, clamp at 0).

### Type change: `services/rescheduleIssues.ts`

Extend the shared union:

```ts
export type IssueKind =
  | 'double-book' | 'weekend' | 'capacity' | 'past-due'
  | 'budget' | 'day-capacity';
```

`ScheduleIssue` is unchanged. `detectIssues` itself is **not** modified — the new
warnings are computed separately because they depend on staged-but-unsaved hour
and crew edits, are per-edited-job, and are not auto-fixable. Keeping them out of
`detectIssues` (which reasons about saved-world date conflicts across all changed
jobs and feeds Auto-Fix) preserves both functions' clarity.

### Wiring: `components/views/JobSchedulingView.tsx`

- New memo `hoursWarnings` computed when in edit mode from: the staged primary
  change, `dailyHoursEdits[jobId]`, the staged crew (`stagedCrewByJob` → member
  ids, else the job's assigned members), `computeJobStats(job, workOrders).estHours`,
  the other jobs, `capacityHours`, and `workConfig`.
- Passed into `ReschedulePreviewPanel` as a new optional prop `hoursWarnings`.

### `components/views/JobScheduling/ReschedulePreviewPanel.tsx`

- Accept `hoursWarnings?: ScheduleIssue[]` and forward to `SingleJobEditor`.

### `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`

- Accept `hoursWarnings?: ScheduleIssue[]` (filtered to this job by the parent, or
  filtered here by `jobId`).
- Render them in their **own amber block**, visually distinct from the existing
  conflict-issues list (an hours/alert icon, e.g. lucide `AlertTriangle` or
  `Clock`), placed near the Impact tile. Reuses the established amber styling:
  `border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20
  text-amber-700 dark:text-amber-300`.
- **Not** counted in `ConflictStrip`'s issue count or the "N to resolve" badge —
  these are advisory and not auto-fixable.

## Data flow

```
staged change + dailyHoursEdits + staged crew + workOrders + capacityHours
        │  (JobSchedulingView: useMemo hoursWarnings)
        ▼
detectHoursWarnings()  ──►  ScheduleIssue[]  ('budget' | 'day-capacity')
        │
        ▼
ReschedulePreviewPanel (hoursWarnings prop)
        ▼
SingleJobEditor  ──►  amber advisory block (separate from conflict issues)
```

## Error / edge handling

- No linked work order or `estHours === 0` → skip the budget warning.
- No crew assigned → budget projection is 0 (no warning); no per-member capacity
  rows to check.
- Empty staged days (job not yet placed) → no warnings.
- Member appears in multiple other jobs on the same day → their hours sum across
  all of them before the capacity comparison.
- Numbers displayed to one decimal (`toFixed(1)`), matching `HoursStat`.

## Testing

Unit tests for `detectHoursWarnings` (colocated `services/hoursWarnings.test.ts`,
matching the existing `services/*.test.ts` convention):

- Budget: under estimate → no warning; exactly at estimate → no warning; over →
  warning with correct projected total and overage.
- Budget: per-person multiplication (2 members doubles the projected hours).
- Budget: no work order / `estHours === 0` → no warning.
- Budget: single-day vs. multi-day spans.
- Capacity: single job under cap → no warning; over cap → warning.
- Capacity: this job under cap alone but pushed over by the member's other job
  that day → warning (cross-job sum).
- Capacity: multiple members, only the overloaded one is reported; one warning
  per member/day.

## Out of scope

- Warnings on the board job cards, crew-hours grid, or a top-level banner.
- Bulk reschedule preview warnings.
- Blocking / confirm-to-save behavior.
- "Approaching the limit" caution tier.
```