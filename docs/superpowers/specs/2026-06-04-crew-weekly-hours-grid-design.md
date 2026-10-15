# Weekly Crew Hours Allocation Grid — Design

**Date:** 2026-06-04
**Area:** Job Scheduling page (`components/views/JobSchedulingView.tsx`)
**Status:** Approved, ready for implementation plan

## Problem

In the Job Scheduling page's **Crew view**, schedulers need to plan member time at the
hour level for a given week: see how many hours each member is allocated per day per
job, input those allocations quickly, and balance members across jobs based on each
member's available hours for the week. They also need to see each job's total hour
requirement for the week and whether it still has missing (unstaffed) hours, so they
can go assign someone to fill the gap.

The data model already supports per-member, per-day hours via
`JobCrewAllocation.hoursAssignments: Record<MemberId, Record<DateKey, Hours>>`, and
`services/crewWeeklyHours.ts` already computes per-member weekly capacity / assigned /
remaining. This feature is primarily a **new UI layer** plus a view-model service over
existing data — no schema change.

## Scope

- Applies to **Crew view only**, **week scale only**.
- Adds a sub-toggle inside Crew view: **Board** (existing crew-lane card board) ↔
  **Hours** (this new grid). When **Hours** is active, the Week/Month scale toggle is
  disabled/hidden (Month remains available for Board, Member, and Job views).
- Member view and Job view are unchanged.

## Layout (Members × Days)

```
Hours · Week of Jun 8                                    [Board | Hours]

                 Mon 8    Tue 9    Wed 10   Thu 11   Fri 12  │  WEEK   CAP
──────────────────────────────────────────────────────────────┼──────────────
Mike Smith       J101 8h  J101 8h  J205 8h  J205 8h    +     │  32h   32/40 ✓
Carla Diaz       J205 8h  J205 8h  J310 8h  J310 8h  J310 8h │  40h   40/40 ✓
Tom Lee          J101 8h  J101 8h  J101 8h    +       OFF    │  24h   24/32
──────────────────────────────────────────────────────────────┴──────────────

JOBS THIS WEEK (required → assigned → missing)
  J101  Smith St.    40h req   ·  40h assigned  ·  ✓ staffed
  J205  Oak Ave.     60h req   ·  32h assigned  ·  ⚠ 28h missing
  J310  Pine Rd.     40h req   ·  24h assigned  ·  ⚠ 16h missing
  J404  Elm Ct.      20h req   ·   0h assigned  ·  ⚠ 20h missing  (unstaffed, still shows)
```

- **Rows:** flat list of all active crew members (no crew grouping). Days the member is
  off (from `member.schedule[dateKey].isOff`) render as a greyed **OFF** cell.
- **Day cells:** the job chip(s) that member works that day, each showing the job and
  its hours. Empty workable cells show a **+** affordance to add a job.
- **WEEK column:** the member's total assigned hours across all jobs that week.
- **CAP column:** assigned / capacity for the week; green check when within capacity,
  red when over capacity.
- **Jobs-this-week panel** (below the grid): every job scheduled within this week —
  **including jobs with zero assigned members** — with required / assigned / missing
  hours. This is the mechanism that keeps unstaffed and under-staffed jobs visible so
  the scheduler can assign someone.

## The numbers

- **Job required (this week)** = work-order estimate (`WorkOrder.totalProductionHours`)
  × (job's working-days that fall in this week ÷ job's total working-days across its
  whole scheduled span). A job spanning two weeks shows roughly half its estimate each
  week. Working days use the existing `WorkingTimeConfig` (weekend days, holidays).
- **Job assigned (this week)** = sum of all member hours booked to that job on this
  week's day keys (from `hoursAssignments`).
- **Job missing** = `max(0, required − assigned)`, shown with a ⚠ when positive.
- **Member capacity (this week)** = `capacityHours` (existing
  `settings.scheduling.crewDailyCapacityHours`, default = workday length, fallback 8) ×
  number of working days the member is not off.
- **Member remaining** = `capacity − totalAssigned`; over-capacity flags red but is not
  blocked.

## Input flows (both first-class)

1. **Assign for the week:** click **+** on a member row (or a row-level action) → pick a
   job scheduled this week → type a single weekly hour total → the total auto-spreads
   evenly across the member's available working days that also fall within the job's
   scheduled span. Result lands as editable day chips.
2. **Per-day edit:** click any day chip → edit that day's hours inline, or remove the
   chip. Any change re-totals the WEEK/CAP columns and the jobs panel live.

Constraints:
- A member can only be booked to a job on days the job actually runs **and** days the
  member is not off.
- Over-booking a single day or the week is flagged (red) but allowed.

## Data & persistence

- Hours write to the existing `JobCrewAllocation.hoursAssignments[memberId][dateKey]`.
  No schema change.
- Assigning a member to a job also adds the member to the allocation's `memberIds` and
  the job's flattened `crewMemberIds`. Removing the last day for a member removes them
  from the allocation.
- Edits **commit immediately** via the existing `onUpdateJob` callback (consistent with
  how `CrewSelectionModal` writes through when no reschedule drawer is open). There is
  **no** staging / Apply step for this grid.

## Code shape

Follows the existing `buildLanes` (service) + `ProductionBoard` (presentational
component) pattern.

- **New service `services/crewHoursGrid.ts`** — pure view-model builders:
  - the member × day matrix (which jobs + hours per member per day),
  - per-job weekly `required` / `assigned` / `missing`,
  - per-member `capacity` / `assigned` / `remaining`,
  - the auto-spread helper (weekly total → per-day hours over eligible days).
  Reuses `computeWeeklyHours`, `computeJobStats`, and `workingDayKeys`. Unit-tested in
  `services/crewHoursGrid.test.ts`.
- **New component `components/views/JobScheduling/CrewHoursGrid.tsx`** — renders the grid
  and the jobs-this-week panel; raises callbacks (`onAssignWeek`, `onEditDay`,
  `onRemove`). Presentational, no business logic. Component-tested.
- **New component (small) for week-total entry** — an assign popover/modal with a job
  picker + hours field.
- **`components/views/JobSchedulingView.tsx`** — adds the Board/Hours sub-toggle state,
  gates the scale toggle, renders `CrewHoursGrid` when Hours is active, and wires the
  assign/edit/remove handlers (reusing job lookup and `onUpdateJob`).

## Edge cases

- Job with no linked work order, or zero estimate → required shows "—" and never flags
  missing.
- Member off the entire week → capacity 0; the row still renders.
- Job spanning the week boundary → only its in-week days are editable; required is
  prorated as defined above.
- Over-booking a day or the week → red flag, not blocked.

## Testing

- **TDD** on `services/crewHoursGrid.ts`:
  - required-hours proration across a week boundary,
  - missing-hours math (including unstaffed jobs → full requirement missing),
  - capacity with one or more days off,
  - auto-spread distribution (even split over eligible days, remainder handling),
  - exclusion of non-working days and the job-span constraint.
- **Component test** for `CrewHoursGrid`: renders member rows and the jobs panel,
  fires `onAssignWeek` / `onEditDay` / `onRemove` callbacks.

## Out of scope

- Month scale for the Hours grid.
- Crew-group sectioning of member rows (flat list only).
- A staging/Apply/undo layer for grid edits (commits are immediate).
- Changing how required hours are sourced (always derived from the work-order estimate).
