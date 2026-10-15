# Multi-Day Jobs as Spanning Bars — Design

**Date:** 2026-06-03
**Status:** Approved

## Problem

On the scheduling board a multi-day job is drawn as a separate copy of its card in
each day it occupies. It should instead render as one continuous bar spanning its day
columns (gantt-style), in all three views (Crew · Crew Member · Job).

## Goals

- One bar per job spanning first→last occupied day in the visible week.
- Overlapping bars in the same row stack onto sub-rows ("tracks"); the row grows taller
  so no bar is hidden.
- Bars at the week's edge are clamped to the visible week (off-week portion clipped).
- Drag-to-reschedule, rain-day marking, the member availability overlay, and view/move
  interactions all keep working.

## Non-Goals

- No richer card content beyond the existing name + lock, plus a small "Nd" duration
  badge. (Address is not carried in board data.)
- No cross-week bar continuation indicators beyond clipping.

## Architecture

### Pure layout function (`services/productionBoard.ts`, unit-tested)

```ts
export interface PlacedBar { card: BoardCard; startCol: number; span: number; track: number; }
export interface LaneLayout { bars: PlacedBar[]; trackCount: number; }

layoutLaneBars(lane: BoardLane, dayKeys: string[]): LaneLayout
```

- For each distinct `jobId` in `lane.cardsByDay`, collect the indices (into `dayKeys`) of
  the days it appears on. `startCol` = min index, `span` = max − min + 1 (so a job whose
  occupied days straddle a non-working gap still draws as one continuous bar, clamped to
  the visible week).
- Track packing: sort bars by `startCol` (then `card.jobName` for stability); for each
  bar, assign the first track whose last bar's end column (`startCol + span − 1`) is `<`
  this bar's `startCol`; otherwise open a new track. `trackCount` = number of tracks
  (minimum 1; 0 when the lane is empty).

### `ProductionBoard` lane rendering

Each lane row becomes a label cell + a **day area** grid item spanning all day columns
(`grid-column: 2 / -1`, `position: relative`), containing two layers:

- **Background layer** — N day cells via an inner grid (`gridTemplateColumns: repeat(N,
  1fr)`, aligned to the header). Each cell keeps `data-cell-id`/`data-cell-day` (drop
  target + hit-test), the rain hatch overlay, `renderCellExtra` (member availability),
  `onContextMenu` (rain menu), and `onCellActivate` (edit availability).
- **Bars layer** — `absolute inset-0`. For each `PlacedBar`: a positioned box at
  `left = (startCol / N)·100%`, `width = (span / N)·100%`, `top = track · ROW`, height
  `ROW − gap`, rendering the existing `JobCard` (filling the box) plus a small `Nd` badge.
  When a drag is active the bars layer is `pointer-events-none` so `document.elementFromPoint`
  still resolves the day cell underneath for the drop. Lane min-height = `max(1, trackCount)
  · ROW + padding`.

Drag/drop is otherwise unchanged: pointer-down on a bar starts the drag; drop calls
`onDropJob(jobId, dayKey)` for the day under the pointer (date-only move, as today).

### `JobCard`

Reused verbatim as the bar's content (fills its box). A `durationDays?: number` prop is
added; when set, the card shows a right-aligned `{n}d` badge. The board passes `span` as
`durationDays`.

## Testing

- `services/productionBoard.test.ts`: `layoutLaneBars` — single multi-day job → one bar
  with correct `startCol`/`span`; two non-overlapping jobs → same track; two overlapping
  jobs → `track` 0 and 1, `trackCount` 2; a job occupying only mid-week days → clamped
  `startCol`/`span`; empty lane → `trackCount` 0.
- `components/views/JobScheduling/ProductionBoard.test.tsx`: a lane with a 3-day job
  renders exactly one `JobCard` (not three).

## Risks / Notes

- A job whose occupied days are non-contiguous within the week (working-day gap) draws as
  one bar across the gap — intended (gantt convention).
- `pointer-events-none` on the bars layer must be tied to the existing drag-active state so
  clicking/dragging bars still works when idle.
