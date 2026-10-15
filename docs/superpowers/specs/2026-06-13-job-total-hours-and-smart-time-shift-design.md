# Job Total Hours & Smart Time-Shift Rescheduling — Design

**Date:** 2026-06-13
**Status:** Approved (pending spec review)

## Problem

Two related issues in the Job Scheduling page:

1. **Total hours is displayed wrong.** A job's total hours should come from its
   estimate (`workOrder.totalProductionHours`), which is fixed. Today, in several
   places the *assigned* hours (derived from crew allocations in the scheduling
   grid) are presented as if they were the job's total — so unassigning crew makes
   the "total" shrink. The estimate total is actually stable in the data model
   (`totalProductionHours` is only ever computed from estimate task hours in
   `workOrderMapper` and is never mutated by scheduling); the bug is purely a
   display/labeling problem.

2. **Rescheduling is not time-aware.** When a job's start time is pushed later
   (e.g. 8am → 12pm), the schedule should move accordingly: the hours that no
   longer fit in the workday spill to the next working day, the job's end date
   extends, and any *shared-crew* jobs it now collides with cascade forward —
   shown in a confirmation preview before anything commits. Additionally, the
   existing date-based cascade currently moves **every** following job regardless
   of crew; it should be scoped to shared-crew conflicts too.

## Goals

- Total hours = estimate, fixed, shown as the headline number everywhere; assigned
  is only a progress indicator and is never relabeled as the total.
- Pushing a job's start time re-flows the job forward (spill to next working day,
  end date extends), triggered from both the reschedule panel and the Day-board
  block drag.
- Cascade only moves jobs that share a crew member/group with the moved job and
  whose days now overlap — for **both** the new time-shift flow and the existing
  date-reschedule flow.
- All shifts route through the existing reschedule preview (`ProposedChange` →
  Apply) with a cascade toggle that defaults ON when shared-crew conflicts exist.

## Non-Goals

- No change to how estimates / `totalProductionHours` are computed — only how
  they are displayed.
- No auto-compression of gaps between unrelated jobs.
- No re-balancing of per-member assigned hours during a time-shift (assignments
  move with their days; we do not redistribute who works what).
- No new persistence model — reuse `Job.startDate/endDate` + `Job.dailyHours` and
  the existing `ProposedChange` → Apply pipeline.

---

## Part 1 — Hours-model fix (the "total hours" bug)

**Principle:** Total = full estimate (`workOrder.totalProductionHours`), fixed.
Assigned = progress fill only.

### Display rules per location

| Location | Today | Fix |
|---|---|---|
| Crew-grid job summary | shows estimate, required (prorated this week), assigned, missing | **Total = full estimate** as the headline. Progress fill = `assigned / prorated-estimate-for-visible-window`. Keep "required this week" only as a small secondary label, never as the total. |
| Reschedule side-panel tiles (`SingleJobEditor`) | Est. / Assigned / Logged | Est. is clearly the total; Assigned rendered as a progress bar against Est., not a peer number competing with it. |
| Assign Hours modal progress | "hours still needed" uses `estHours` as denominator | Verify the denominator is always the full estimate and the wording reads as progress toward the fixed total. |
| Job card / staffing bar | bar fills as hours assigned | Bar = `assigned / estimate`; the job's hours label shows the **estimate total**, not assigned. |

### Progress denominator (proration window)

The weekly/day crew grid is built by `buildCrewHoursGrid` for either a week
(`weekDays`) or a single day (`[currentDate]`). The progress bar fills against the
**estimate's share for the visible window**:

- Week view: `assigned this week / this week's prorated share of the estimate`.
- Day view: `assigned this day / this day's prorated share of the estimate`.

`requiredHoursForWeek` already prorates by `inWeek / total` working days, so it
covers both views. The **Total = full estimate** is always shown regardless of
view.

**Net effect:** unassigning crew lowers the fill and raises "remaining," but the
job's Total never changes — it is always the estimate.

---

## Part 2 — Smart time-shift engine (Option A: push whole job forward)

### Behavior

When a job's start time is pushed (panel field or Day-board block drag), the job
is treated as a continuous ribbon of working-hours and re-laid-out forward:

- **Duration preserved** = the job's current total *scheduled window hours* (sum
  of its per-day windows), independent of crew assignment.
- **Re-flow (Option A):** Day 1 runs `new start → workday end`. Remaining hours
  fill each following **working day** (skipping weekends/holidays) from the normal
  workday start until all hours are placed. End date extends as needed. Only day 1
  carries the late start; subsequent days revert to the normal workday start.
- **Pulling start earlier** is the inverse: the ribbon slides earlier and the job
  may finish sooner. Start is not moved before the workday start. Cascade only
  fires if it creates a shared-crew overlap.

**Worked example** (workday 8am–4pm = 8h/day, Mon–Fri; 2-day job, 16h, originally
Mon 8am–4pm + Tue 8am–4pm; move Monday's start to 12pm):

- Mon 12pm–4pm (4h)
- Tue 8am–4pm (8h)
- Wed 8am–12pm (4h) ← new spillover day
- End date moves Tue → Wed.

### Approach

Extend the existing engine rather than build new:

- `shiftJobsFromPoint` already has an `'hours'` unit and duration-preserving math.
- `applyDailyHours` already maps day-windows to start/end.
- Add a **re-flow helper** that lays the preserved duration across working days
  from the new start (skipping non-working days), producing new
  `startDate`/`endDate` and the per-day windows.
- Route both triggers — the panel start-time field and the Day-board block drag —
  through this helper into the existing `ProposedChange` → preview pipeline.

---

## Part 3 — Conflict detection & cascade (unified shared-crew rule)

### Single source of truth for "conflict"

A job conflicts with the moved job only when they **share a crew member or crew
group** (`jobsShareCrew` in `rescheduleIssues.ts`) **and** their working days
overlap. Different crew on the same day is not a conflict and the job is left in
place.

The existing conflict *strip* (`detectIssues` → `double-book`) already uses
`jobsShareCrew`. The gap is in cascade *movement*.

### Apply to both cascade flows

- **New time-shift cascade.**
- **Existing date-reschedule cascade**, which today calls
  `cascadeFromEdit(jobs, primaryChange, workConfig, cascadeUntil)` with **no
  scope** and therefore moves every following non-locked job. It will pass a
  `CascadeScope` built from the moved job's shared crew.
- `isInScope` in `scheduleEngine.ts` currently matches only individual members; it
  will be extended to use the same member-or-group test as `jobsShareCrew` so the
  cascade movement and the conflict strip agree.

**Behavior change:** jobs with non-overlapping crews will no longer be dragged
along by a cascade. This is intended.

### Cascade resolution

- Shared-crew conflicting jobs (and their own shared-crew followers) shift forward
  by the moved job's day-extension delta, preserving the gaps between them
  (reuses `cascadeFromEdit` + `shiftJobsFromPoint`).
- Locked jobs never move — surfaced as blocking conflicts in the preview.
- The existing "until" cutoff and leapfrog warning continue to apply.

### Confirmation (cascade default ON)

Time-shifts flow into the existing reschedule preview panel. When shared-crew
conflicts are detected, the cascade toggle starts **ON**, so the preview shows the
fully-resolved schedule by default. The user sees the impact tiles (jobs affected,
crews affected, total delay, new end date) and the conflict strip, can toggle
cascade off, and clicks **Apply** to commit. Nothing changes until Apply.

---

## Edge cases

- **Pulling start earlier:** inverse re-flow; cascade only if it creates a
  shared-crew overlap; start not moved before workday start.
- **Spill across weekends/holidays:** re-flow skips non-working days (a Friday
  push lands the remainder on Monday).
- **Spill blocked by a cutoff / locked job:** locked jobs never move and surface
  as blocking conflicts; the "until" cutoff protects later jobs (leapfrog warning
  applies).
- **Job with no work order / zero estimate:** Total shows `0`/`—`, progress bar
  empty (no divide-by-zero); time-shift still works off the scheduled window
  hours.
- **Cascade with no shared-crew conflicts:** preview shows only the moved job.
- **Multi-day job dragged on the Day board:** drag sets the new start for the
  visible day; re-flow recomputes the rest.

## Testing

- Unit tests for the re-flow helper: single-day, multi-day, weekend/holiday spill,
  earlier-pull, zero-estimate.
- Unit tests for the shared-crew scoped cascade, including the existing-flow
  behavior change (non-shared-crew jobs no longer move) and member-vs-group
  sharing.
- Unit tests for the prorated progress denominator in week vs day view, and Total
  = full estimate invariance.
- Component tests for both trigger paths (panel field + Day-board drag) feeding the
  preview, and cascade-default-ON when conflicts exist.

## Affected files (anticipated)

- `services/scheduleEngine.ts` — re-flow helper; `isInScope` member-or-group test;
  scoped cascade plumbing.
- `services/crewHoursGrid.ts` / `services/jobStats.ts` — total vs progress display
  semantics.
- `components/views/JobSchedulingView.tsx` — route both triggers, pass cascade
  scope, default-ON wiring.
- `components/views/JobScheduling/DayBoard.tsx` — block drag → time-shift.
- `components/views/JobScheduling/reschedule/SingleJobEditor.tsx` — tiles as
  total + progress.
- `components/views/JobScheduling/JobsPanel.tsx` / `UnscheduledJobsPanel.tsx` /
  job summary — total = estimate, bar = progress.
