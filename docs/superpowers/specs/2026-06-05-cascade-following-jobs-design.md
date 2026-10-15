# Cascade Following Jobs — Edit Schedule sidebar

**Date:** 2026-06-05
**Status:** Approved design

## Problem

When a user reschedules a single job from the "Edit Schedule" sidebar (mode `'edit'`),
only that job moves. Everything scheduled after it stays put, so a push to one job
opens or closes gaps in the rest of the week and the user must move each later job by
hand. Users want an opt-in way to push the whole tail of the schedule along with the
job they are moving.

## Goal

Add a **"Cascade following jobs"** toggle (with an explanatory info icon) to the
single-job editor. When on, moving the job's start date shifts every later job by the
same number of days, previewed before Apply.

## Decisions (locked)

- **Scope:** all later jobs (no crew/category filter).
- **Shift amount:** the number of calendar days the **primary job's start date** moves.
  Editing only the end date (duration) does not cascade.
- **Default:** off every time the editor opens; not persisted.

## Behavior

1. The primary job's start/end are edited exactly as today via `onChangeJobDate`.
2. With cascade **on**, after the start date changes:
   - `deltaDays` = calendar days between the primary job's **original** start and the new start.
   - Every job whose effective start is **after** the primary job's original start shifts
     by `deltaDays`, computed with the existing `shiftJobsFromPoint` engine so that
     weekend/holiday skipping, locked jobs, and unscheduled jobs are handled exactly as
     in Bulk Reschedule.
   - The followers are merged with the user's (freely edited) primary change into the
     staged change set.
3. With cascade **off**, behavior is unchanged: only the primary job moves.
4. Editing only the end date never cascades, regardless of toggle state.
5. **Apply** commits the full staged set (primary + followers) through the existing
   apply path. The footer/summary already adapts to the number of changed jobs.
6. Conflict detection and Auto-Fix already run over the full staged set, so cascading
   surfaces (not hides) any new overlaps it creates.

## UI

In `SingleJobEditor`, directly under the "When" date pickers:

- A toggle labeled **"Cascade following jobs"** with a small **ⓘ** info icon.
- The info icon shows a tooltip (reuse the existing `Tooltip` from `components/UI.tsx`):
  > "Moving this job's start date will also shift every later job by the same number of
  > days, keeping the gaps between jobs. Turn off to move only this job."
- When the toggle is on **and** the start has moved, a summary line appears:
  **"N later jobs will shift by +X days"** followed by a compact list of their names.
  When the toggle is on but the start hasn't moved, no summary (nothing to cascade).

The board behind the panel reflects all staged moves as placeholders (not just the
primary job), consistent with the existing preview philosophy.

## Architecture / data flow

- **Engine (`services/scheduleEngine.ts`):** reuse `shiftJobsFromPoint`. No new engine
  function strictly required, but add a thin helper if it clarifies the
  "shift only jobs strictly after the primary, then overlay the primary's free edit"
  merge. Keep it pure and unit-tested.
- **State (`JobSchedulingView.tsx`):** a `cascade` boolean, reset to `false` whenever a
  new edit preview is staged. `handleChangeJobDate` branches on `cascade`:
  off → current single-job recompute; on (start field) → compute followers via the
  engine and `preview.setChanges([...primaryEdit, ...followers])`.
- **Primary identity:** the panel currently renders the editor for `changed[0]`. With
  cascade, the staged set contains multiple changes, so the panel must render the editor
  for the **primary** job, not the first by sort order. Thread a `primaryJobId` through
  the staged reschedule (or equivalent) so header, stats, crew, and the editor all key
  off the primary job.
- **Components:** `SingleJobEditor` gains `cascade`, `onToggleCascade`, and a
  `followingJobs` summary (count + delta + names) for the summary line.
  `ReschedulePreviewPanel` passes these through.

## Out of scope (YAGNI)

- Per-crew or per-category cascade scoping.
- Duration-based (end-date) ripple.
- Persisting the toggle across edits or sessions.

## Testing

- Engine: unit tests for the follower computation — positive/negative delta, weekend
  skipping, locked/unscheduled jobs left alone, jobs before the point untouched,
  primary's free edit preserved.
- Component: `SingleJobEditor` renders the toggle + info; toggling on with a moved start
  shows the summary; off shows none.
- View-level: applying with cascade on commits primary + followers; the panel renders
  the primary job (not a follower) as the edited job.
