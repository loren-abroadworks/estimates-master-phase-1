# Draggable Shift Cards in the Jobs Sidebar — Design

**Date:** 2026-07-13
**Status:** Approved (design)
**Builds on:** the shift invariant (every scheduled job has ≥1 allocation) and the
drag-assign flow (`beginAssign` → `ShiftPickerModal` → Assign Hours).

## Problem

The "Jobs This Week" sidebar (`JobsPanel`) drags whole **job** cards onto crew members to
assign hours. Since assignment is now per **shift**, the job is the wrong drag unit: the
drop has to ask which shift afterwards (`ShiftPickerModal` when the job has 2+ shifts).
The user wants the shift choice moved *before* the drag — expand a job card to reveal its
shift cards and drag the specific shift; the multi-shift job card itself should no longer
be draggable.

## Decisions (from brainstorming)

1. **Single-shift jobs keep card-drag** — dragging the card carries its lone shift's id.
   No dropdown needed for the common case.
2. **Multi-shift jobs**: the card is **not draggable**; a chevron (collapsed by default)
   expands an inline list of draggable **shift rows**.
3. **Drop with a shift id skips the picker** — Assign Hours opens pre-targeted at that
   shift. `ShiftPickerModal` remains only as a fallback for shiftId-less drops
   (effectively dead; deletable later).
4. Clicking a job card still opens the details panel; compact mode gets the same behavior
   with slimmer rows.

## Design

### 1. Data — per-shift summaries on `JobSummary`

`buildJobSummaries` (`services/crewHoursGrid.ts`) adds to each `JobSummary`:

```ts
shifts: { shiftId: string; name: string; startTime: string; endTime: string; days: string[] }[];
```

One entry per allocation, `days` = the allocation's working days intersected with the
sidebar's period day-keys (a shift outside the visible period lists with no day chips but
stays draggable). Every scheduled job has ≥1 allocation (invariant), so `shifts` is never
empty for listed jobs.

### 2. Drag payload — `SHIFT_DND_TYPE`

`jobDnd.ts` adds `SHIFT_DND_TYPE`. A dragged shift row (or a single-shift job card) sets
**both** payloads: `JOB_DND_TYPE = jobId` (existing drop targets keep firing) and
`SHIFT_DND_TYPE = shiftId`.

### 3. Panel UX — `JobsPanel`

- `jobs[j].shifts.length >= 2` → the card is not draggable; a chevron button toggles an
  inline shift list. Each **shift row**: grip icon, shift name, clock window
  (e.g. `1:00 PM – 3:00 PM`), day chips (period=week) — `draggable`, dimmed while
  dragging, same `onDragJobChange` highlight contract as job drags today.
- `shifts.length === 1` → the card behaves exactly as today, but its dragstart also sets
  `SHIFT_DND_TYPE` with the lone shift's id.
- Collapsed by default; expansion state is panel-local. Compact mode uses one-line shift
  rows under the compact job row.

### 4. Drop handling — pass the shift id through

- `CrewHoursGrid`'s member drop and the day-board lane drop read `SHIFT_DND_TYPE` from
  `dataTransfer` and widen their callbacks: `onDropJobOnMember(memberId, jobId,
  shiftId?)` / `onDropJobOnLane(laneId, jobId, shiftId?)`.
- View `beginAssign(memberId, jobId, shiftId?)`: when `shiftId` is present, set
  `assignShiftId` and open Assign Hours directly (no picker). When absent, the existing
  fallback runs (0/1 shift auto-target; 2+ → `ShiftPickerModal`).

## Edge cases

- **Shift with no days in the period:** listed (name + window), draggable, no day chips.
- **Job card click vs chevron click:** chevron stops propagation so expanding doesn't
  open the details panel.
- **"Hide staffed" filter:** unchanged — it operates on the job's aggregate hours.
- **Unscheduled-jobs panel:** untouched (different component; those jobs have no shifts
  until scheduled).

## Testing strategy

TDD — failing test first; full suite stays green.

- **`crewHoursGrid.test.ts`:** `buildJobSummaries` emits per-shift summaries (names,
  windows, period-filtered days) and one entry for a single-allocation job.
- **`JobsPanel.test.tsx`:** multi-shift card is not draggable and shows a chevron;
  expanding reveals shift rows; a shift row's dragstart sets both `JOB_DND_TYPE` and
  `SHIFT_DND_TYPE`; a single-shift card's dragstart carries its shift id.
- **`CrewHoursGrid.test.tsx`:** a drop whose dataTransfer carries a shift id calls
  `onDropJobOnMember(memberId, jobId, shiftId)`.
- **Runtime verify (verify skill):** expand Downtown Commercial → drag "First Coat" onto
  a member → Assign Hours opens directly (no ShiftPickerModal); assign hours → the
  member's chip reads `First Coat · 1:00–3:00`. Single-shift card (e.g. Deck Staining)
  still drags and assigns without expanding.

## Out of scope

- Deleting `ShiftPickerModal` (kept as the shiftId-less fallback).
- The unscheduled-jobs panel and board day-drop behavior.
- Per-shift hour bars in the sidebar (job-level aggregate bar stays).
