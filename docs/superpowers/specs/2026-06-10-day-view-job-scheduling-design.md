# Day View — Job Scheduling

**Date:** 2026-06-10
**Status:** Approved — ready for implementation plan

## Summary

Add a **Day** scale to the Job Scheduling board, alongside the existing Week and
Month scales. The Day view is an **hourly timeline**: rows are crew members (Crew
view) or jobs (Job view), and the single visible day is laid out along a vertical
hour axis so you can see who is working when within the day. Jobs render as blocks
positioned by their clock times for that day.

## Goals

- See, for one date, each crew member's / job's work positioned by time of day.
- Work under both the Job and Crew view toggles.
- Support clicking a block to open job details, dragging a block to adjust that
  day's start/end times (saved immediately), and right-click rain-day marking.

## Non-goals

- Reworking the Week or Month boards. `ProductionBoard` is left untouched.
- Sub-day granularity below 15-minute snapping.
- Editing in the Crew **Hours** sub-mode from the Day view (Hours stays week-only).

## Architecture & components

### `services/dayBoard.ts` (new — pure model)

Reuses the existing lane builders to get rows, then positions each row's cards as
hour-blocks for the selected day.

- Rows: `buildMemberLanes` (Crew view) / `buildJobLanes` (Job view) — unchanged.
- For each `BoardCard` in a lane, resolve the day's window via `jobDayWindow(job,
  dayKey)` (honors `dailyHours` per-day overrides, falls back to the job's overall
  clock times). Convert start/end to a vertical position against the visible hour
  range:

  ```
  interface DayBlock {
    card: BoardCard;
    topPct: number;     // 0–100, position of block top within the hour axis
    heightPct: number;  // 0–100, block height
    startTime: string;  // HH:mm shown on the block (pre-clamp)
    endTime: string;
    clamped: boolean;    // true if the job's real times fell outside the axis
  }
  ```

- Clamping: a block whose times fall outside `[workDayStartHour, workDayEndHour]`
  is clamped to the edge and flagged `clamped` for a subtle visual cue. Minimum
  height enforced so a zero/inverted span still renders a tappable block.
- `setJobDayWindow(job, dayKey, { startTime, endTime })`: pure helper that returns
  a new `Job` with `dailyHours[dayKey]` set. Used by the drag-commit path; kept in
  this module so it is unit-testable.

### `components/views/JobScheduling/DayBoard.tsx` (new — view)

- Left label column reusing the same row-label renderers as `ProductionBoard`
  (member avatar + role for Crew view; job name for Job view).
- One day column with horizontal hour gridlines labeled in the 12-hour clock
  (`fmtClock`).
- Job blocks absolutely positioned by `topPct` / `heightPct`, colored with
  `jobColor`, styled consistently with `JobCard`.
- Owns its own pointer-based vertical drag (independent of `ProductionBoard`'s
  day-snap drag model). Rain-day hatch + right-click menu mirror the week board.

## Time axis

- Range = `workConfig.workDayStartHour` → `workDayEndHour` (default 8am–5pm).
- Hour gridlines labeled via `fmtClock`.
- Multi-day jobs show only their slice for the selected day (`jobDayWindow`).
- Times outside the range clamp to the visible edge (`clamped` flag).

## Wiring into `JobSchedulingView`

- `scale` type widens to `'week' | 'month' | 'day'`. A **Day** button joins the
  Week/Month toggle in the date navigator.
- Date navigator, when `scale === 'day'`:
  - Label shows the full date (e.g. "Tuesday, June 10, 2026").
  - Prev/next step by one day (`handlePrevDay` / `handleNextDay`).
- `currentDate` is the selected day; rows are built from `displayJobs` for that
  single day key.
- Day uses the existing Job/Crew toggle.
- Crew **Hours** sub-mode stays week-only: switching to Day snaps `boardMode` back
  to `board` (extend the existing `useEffect` guard that already does this for
  Month), and the Day button is disabled while the hours grid is active (mirrors
  the Month button's `hoursGridActive` disable).
- Render branch: when `scale === 'day'` render `<DayBoard ... />` instead of
  `ProductionBoard` / `MonthBoard` / `CrewHoursGrid`.

## Interactions

- **Click block** → opens `JobDetailsPanel` via the existing
  `onViewJob`/`setSelectedJob` wiring.
- **Drag block vertically** → new clock start/end for that day, preserving block
  duration, snapped to 15-minute increments. On drop, commit immediately with
  `onUpdateJob` using `setJobDayWindow(job, dayKey, …)` (writes
  `job.dailyHours[dayKey]`). No reschedule drawer.
- **Right-click the day** → reuse the rain-day context-menu flow
  (`onMarkRainDay` → `handleMarkRainDay`), same as the week board.
- Respects `canReschedule`: drag and rain-marking are disabled in read-only mode.
- Locked jobs (`is_locked`) are not draggable.

## Edge cases

- Non-working / weekend selected day still renders (any day is inspectable);
  rain-day hatch shown if marked.
- Empty day: rows render with no blocks. Crew view shows all active members; Job
  view shows only jobs occupying that day.
- Drag that would invert end-before-start clamps to a minimum block height.

## Testing

### `services/dayBoard.test.ts`
- Block positioning math (`topPct` / `heightPct`) for in-range times.
- Clamping above and below the range, with `clamped` flag set.
- Per-day `dailyHours` override resolution vs. fallback to job clock times.
- `setJobDayWindow` purity (returns new job, writes correct `dailyHours[dayKey]`,
  leaves other days untouched).

### `components/views/JobScheduling/DayBoard.test.tsx`
- Renders rows and positioned blocks for a given day.
- Click block opens details (calls the select/view handler).
- Drag commit calls `onUpdateJob` with the expected `dailyHours` for the day.
- Locked job is not draggable.
- Read-only mode (`canReschedule === false`) disables drag and rain-marking.
