# Day view — split job blocks around breaks

**Date:** 2026-06-22
**Status:** Approved for planning

## Problem

In the Day view (the vertical timeline, `DayBoard.tsx`), fixed-break bands are
rendered (a dashed gray block at the break's time) but sit at `z-[4]`, behind job
blocks (`z-index: 5+`). When a job spans a break — e.g. an 8am–5pm job over a
12:00 lunch — the solid job block paints over the break, so the break is invisible.
A break only shows for a lane with no job there (the empty columns in the
reference image). The hours are already correct (a 9h day with a 1h unpaid break
shows `8h`); this is purely that the break is not *visible* through the job.

## Goal

When a job block spans a fixed break, split the job into two (or more) stacked
segments with a real gap where each break sits, so the timeline physically shows
work stopping for the break. The break band shows in the gap.

This is the Day-view counterpart to the weekly-grid break-aware work
(`2026-06-22-break-aware-job-hours-design.md`). It is **display only** — no
change to hours, capacity, or any counter.

## Non-goals

- No change to hours/capacity/assigned math (already break-aware).
- No change to floating (anytime) breaks — they stay as chips at the top of the
  lane column.
- No change to drag-to-reschedule semantics — dragging any segment still moves
  the whole job's day window.

## Definitions

- **Fixed break** — a `CrewBreak` with a `startTime` (e.g. lunch 12:00, 30 min).
  Only fixed breaks have a position on the timeline and can split a job.
- **Job window** — the block's `[startTime, endTime]` for the day (already
  resolved per-day via `jobDayWindow` / `withDayWindows`).
- **Segment** — a visible vertical piece of a job block after the overlapping
  fixed-break intervals are removed.

## Rules

1. **Only fixed breaks split a job.** A fixed break splits the job when its
   interval `[start, start + duration]` intersects the job window. Floating
   breaks never split (no position); they remain as top-of-column chips.
2. **Both paid and unpaid fixed breaks create a gap.** A break is shown
   regardless of paid status; the band tooltip already states paid/unpaid and the
   hours readout already reflects it.
3. **Multiple breaks** → multiple gaps/segments (the job window minus every
   overlapping break interval, in order).
4. **Edge breaks:** a break overlapping only the start (or end) of the window
   trims that end — no empty segment is produced. A break covering the whole
   window leaves no job segment (band only).
5. **Partial overlap:** only the intersection with the job window is removed; a
   break extending past the window edge trims to the edge.
6. **Labeling:** the first (top) segment shows the job name, time range, and the
   hours readout exactly as the single block does today. Continuation segments
   (below a break) show only the job name, reading as "same job, after the break."
7. **Break band visibility:** because a split removes the job pixels over the
   break, the existing break band (rendered separately) shows through the gap. Its
   `z-index` is raised just enough to also read over any remaining job pixels in a
   cascade (overlapping-jobs) layout.

## Architecture

A pure, tested helper in `services/dayBoard.ts` computes the segments; `DayBoard`
renders one positioned div per segment. The existing break-band render pass is
kept (lifted above job blocks). Rejected alternatives: computing the split inline
in the component (untestable percentage math) and inside `buildDayBlocks` (it
receives no break data — would couple geometry to break resolution).

### New helper (`services/dayBoard.ts`)

```ts
export interface BlockSegment { topPct: number; heightPct: number }

/** Split a job's [startH, endH] (fractional hours) into the visible segments that
 *  remain after removing each fixed break interval that overlaps the window.
 *  `breaks` are fixed breaks as { startTime: 'HH:mm', durationMinutes }. Returns
 *  segments as top/height percentages of the [axisStart, axisEnd] axis, clamped to
 *  the axis, ordered top→bottom. A job with no overlapping break returns a single
 *  segment equal to the whole (clamped) block. Segments thinner than a tiny epsilon
 *  are dropped. */
export const splitBlockAroundBreaks = (
  startH: number,
  endH: number,
  breaks: { startTime: string; durationMinutes: number }[],
  axisStart: number,
  axisEnd: number,
): BlockSegment[];
```

Implementation outline: clamp `[startH, endH]` to the axis; build the list of
overlapping break intervals (each clamped to the job window) sorted by start;
walk from the job start, emitting a segment for each gap between consecutive
break intervals; convert each `[segStart, segEnd]` to
`topPct = (segStart - axisStart)/span*100`, `heightPct = (segEnd - segStart)/span*100`;
drop segments with `heightPct < EPS` (e.g. 0.3).

### Component changes (`DayBoard.tsx`)

- For each `block` in `row.blocks`, compute the lane's fixed breaks
  (`laneBreaks?.(row.laneId).filter(b => b.startTime)`) and call
  `splitBlockAroundBreaks(hhmmToHours(block.startTime), hhmmToHours(block.endTime),
  fixed, axisStart, axisEnd)`.
- Render one wrapper div per segment (instead of one per block). Each segment uses
  the segment's `topPct`/`heightPct` and the block's existing
  `leftPct`/`widthPct`/`zIndex` (horizontal cascade is unchanged). All segments
  carry `data-job-id`, the click→`onViewJob` handler, and the pointer-down drag
  handler seeded with the **full** `block.startTime`/`block.endTime` (drag moves
  the whole window).
- The first segment (index 0) renders the full inner content (job name, time
  range, hours field/readout). Continuation segments render only the job name.
- Keep the fixed-break band render pass; raise its `z-index` above job segments
  (e.g. `z-[8]`) so it reads over any cascade overlap, keeping `pointer-events-none`.

## Edge cases

- **No fixed breaks / none overlap** → one segment = today's single block (visual
  parity).
- **Break exactly at the window edge** → trims; no zero-height segment.
- **Two jobs overlapping in one lane (cascade)** → each job splits independently;
  segments inherit their block's `leftPct`/`widthPct`/`zIndex`.
- **Very short top segment** (break near the start) → rendered proportionally;
  inner text is already `overflow-hidden`/truncated.

## Testing

`services/dayBoard.test.ts` — `splitBlockAroundBreaks`:

- No breaks → single full-window segment.
- One 30-min break mid-window (8–17, lunch 12:00) → two segments: 8–12 and
  12.5–17 (verify topPct/heightPct).
- Break at the start edge → one trimmed segment (starts after the break).
- Break at the end edge → one trimmed segment (ends before the break).
- Two breaks → three segments.
- Break covering the whole window → zero segments.
- Paid break still splits (helper is paid-agnostic — caller passes fixed breaks).

`components/views/JobScheduling/DayBoard.test.tsx`:

- A lane with a job 08:00–17:00 and a fixed 12:00 lunch renders two job segments
  for that job (e.g. two elements with `data-job-id`), with the break band present.
- A lane with a job and no overlapping break renders a single segment (parity).

## Affected files

- `services/dayBoard.ts` (new `splitBlockAroundBreaks` + `BlockSegment`)
- `services/dayBoard.test.ts` (new tests)
- `components/views/JobScheduling/DayBoard.tsx` (render segments; raise band z-index)
- `components/views/JobScheduling/DayBoard.test.tsx` (segment rendering tests)
