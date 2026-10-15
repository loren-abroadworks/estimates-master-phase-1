# Per-Shift Month View — Design

**Date:** 2026-07-13
**Status:** Approved (design)
**Builds on:** the shift model (Phases 1–5) and the shared `layoutLaneBars` / `boardShifts`
board machinery. The Week and Day boards already render one bar per shift; the **Month**
board is the last that still renders one bar per job.

## Problem

`services/monthBoard.ts` `buildMonthWeekLane` emits **one `BoardCard` per job** (spanning
the job's envelope, colored by crew), so a multi-shift job shows a single bar across its
whole span in the Month view — you can't see the individual shifts (e.g. "Prep" Mon vs
"Finish" Tue). Every other board splits per shift; the Month view should too.

## Decisions (from brainstorming)

1. **One bar per shift**, spanning that shift's own dates. Legacy jobs (no `allocations`)
   keep a single job bar — unchanged.
2. **Label = shift name** (`card.shiftName ?? card.jobName`). Month cells are narrow; the
   job name stays available via the bar's `title`/click.
3. **Drag = that shift only** (consistent with Week/Day): dragging a shift's bar moves
   only that shift and opens the cards drawer. Legacy bars carry no `shiftId` → job move.
4. **Color:** the shift's color when set, else the current crew color (`colorForJob`),
   preserving today's Month coloring for legacy jobs.

## Design

### 1. Data — `buildMonthWeekLane` emits per-shift cards

`buildMonthWeekLane(jobs, weekDayKeys, config, color)` iterates each schedulable job's
`allocations`; for each dated shift it pushes a `BoardCard` carrying `shiftId`,
`shiftName`, the shift's `startKey`/`endKey` (its own span) and window, colored
`alloc.color ?? color(job)`, onto every `weekDayKey` the shift occupies
(`occupiesWorkingDay(alloc.startDate, alloc.endDate, key, config)`, anchored at local
noon). A job with no `allocations` pushes one job card as today (`color(job)`). This
mirrors the existing `boardShifts` helper but uses the passed `color(job)` as the
fallback so Month coloring stays crew-based. `layoutLaneBars` already keys and stacks
bars by `(jobId, shiftId)`, so no layout change is needed.

### 2. Render — `MonthBoard`

Each bar's `key` and drag id become `${card.jobId}::${card.shiftId ?? ''}` (a job's two
shifts no longer collide). The bar text and `title` use `card.shiftName ?? card.jobName`.
Click still calls `onSelectJob(card.jobId)` (opens the cards drawer). Bar color is
`card.color` (already resolved in the lane).

### 3. Drag — per shift

`MonthBoardProps.onDropJob` widens to `(jobId: string, dayKey: string, shiftId?: string)`.
The dragged bar carries its `shiftId` alongside the job id in the DnD payload (a second
`dataTransfer` entry, plus a `dragged` ref holding `{ jobId, shiftId }`). On drop it calls
`onDropJob(card.jobId, dayKey, card.shiftId)`. The view already passes `handleDropJob` here,
whose shift branch (present since the drag-to-cards work) seeds the draft and opens the
cards drawer; a legacy bar passes `shiftId === undefined` → the job-level branch. No view
changes beyond confirming `onDropJob`'s 3-arg shape is forwarded.

## Edge cases

- **Legacy job (no allocations):** one job-spanning bar, job-name label, job-level drag —
  identical to today.
- **Multiple shifts on one day:** stacked in tracks by the existing `layoutLaneBars`.
- **Undated shift:** skipped (as undated jobs are), matching `boardShifts`.
- **Cross-week shift span:** the month grid already splits a job bar per week row; the same
  per-week splitting applies per shift (each week row builds its own lane).

## Testing strategy

TDD — failing test first; full suite stays green.

- **`monthBoard.test.ts`:** `buildMonthWeekLane` emits one card per shift for a two-shift
  job (correct `shiftId`/`shiftName` and per-shift day placement) and a single card for a
  legacy (allocation-less) job.
- **`MonthBoard.test.tsx`:** renders per-shift bars labelled by shift name; a bar drag
  calls `onDropJob` with the shift id (extend the existing month DnD test).
- **Runtime verify (verify skill):** Month view shows a two-shift job as separate "Prep"
  and "Finish" bars on their own days; dragging "Prep" to another day opens the cards
  drawer with Prep moved. Seed/revert `data/mockData.ts` as needed.

## Out of scope

- Per-shift crew/label density options beyond the shift name.
- Any change to the Week/Day boards or the drawer (reused as-is).
