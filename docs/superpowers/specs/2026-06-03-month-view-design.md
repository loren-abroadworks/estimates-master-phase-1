# Month View for Job Scheduling — Design

**Date:** 2026-06-03
**Status:** Approved (pending spec review)
**Area:** Job Scheduling page — `components/views/JobSchedulingView.tsx` and a new `MonthBoard` sibling to `ProductionBoard`.

## Problem

The Job Scheduling page only shows one week at a time (a lane board with Crew / Crew Member / Job groupings). Planners need a wider horizon — a month at a glance — to see job distribution, gaps, and overlaps across weeks.

## Goals

- A **Month** time-scale alongside the existing week board, as an independent toggle.
- A calendar grid (week rows × working-day columns) showing jobs as **spanning bars**.
- Consistent weekend handling (hide non-working weekdays, like the week board).
- Reuse existing primitives (`layoutLaneBars`, `visibleWeekDays`, the move→`preview.stage` reschedule pipeline, the Job Details panel).
- Click a bar → Job Details panel. Drag a bar → stage a reschedule.

## Non-Goals

- No change to the week board, the reschedule drawer, or the scheduling engine.
- No new persistence; month view is a pure rendering of existing `jobs`.
- No recurring-event or resource-allocation concepts beyond what jobs already carry.

## Key Decisions (from brainstorming)

1. **Separate Week|Month time-scale toggle**, independent of the Crew/Member/Job lane toggle.
2. In Month mode the lane toggle acts as a **filter**: Crew → all jobs colored by crew; Job → all jobs; Crew Member → a member dropdown filters to one member (all if none chosen).
3. Multi-day jobs render as **spanning bars** with per-week-row segments and track packing.
4. Clicking a bar opens the **Job Details panel**.
5. **Drag-to-reschedule is in v1**, reusing the week board's drop→stage pipeline.
6. Weekend/non-working columns are **hidden** (reuse `visibleWeekDays`).
7. Busy weeks **auto-grow** in height (no "+N more" cap in v1).

## Architecture

### Time scale and navigation

- New state in `JobSchedulingView`: `scale: 'week' | 'month'` (default `'week'`), and `selectedMemberId: string | null` for the month member filter.
- A **Week | Month** segmented control near the date navigation.
- Navigation is scale-aware: in week mode prev/next move ±7 days (existing `handlePrevWeek`/`handleNextWeek`); in month mode ±1 calendar month (`handlePrevMonth`/`handleNextMonth`, which adjust `currentDate` by month).
- The date header label is scale-aware: week mode keeps "Week of <date>"; month mode shows the month and year (e.g. "June 2026").

### Month grid data (new `services/monthBoard.ts`)

```ts
export interface MonthDay { date: Date; key: string; inMonth: boolean; }
export interface MonthWeek { days: MonthDay[]; }

/** Week rows covering the month containing `refDate`. Grid starts on the Sunday
 *  on/before the 1st and ends on the Saturday on/after the last day, so the first
 *  and last rows include faded adjacent-month days. Each week's days are filtered
 *  to working weekdays via the same rule as the board (non-working weekdays dropped). */
export const buildMonthWeeks = (refDate: Date, config: WorkingTimeConfig): MonthWeek[];
```

`buildMonthWeeks` reuses `visibleWeekDays` per week so weekend columns disappear and `MonthWeek.days` holds only working days. `inMonth` marks whether each day belongs to the displayed month (for fading adjacent-month cells).

### Per-week bars (reuse `layoutLaneBars`)

For each week row, build a single synthetic `BoardLane` whose `cardsByDay` holds every filtered job that occupies each working day in that week (using the existing `occupiesWorkingDay`), then call the existing `layoutLaneBars(lane, weekDayKeys)` to get `PlacedBar[]` + `trackCount`. A job crossing a week boundary naturally produces one segment per week row (each week lays out independently). The week row's height scales with `trackCount`.

```ts
/** One lane of all jobs that touch the given week's working days. */
export const buildMonthWeekLane = (
  jobs: Job[],
  weekDayKeys: string[],
  config: WorkingTimeConfig,
  color: (job: Job) => string,   // crew color, fallback jobColor(job.id)
): BoardLane;
```

`color` lets the caller color bars by crew (resolved from `crews`) while keeping the helper pure. Bar `startCol`/`span` come straight from `layoutLaneBars`, which positions by index within `weekDayKeys` — so hidden weekend columns keep spans contiguous (same property the week board relies on).

### Crew-color resolution

A small helper resolves a job's display color: the job's crew's `color` (via the existing `laneIdForJob` → `crews.find(...).color`) when it maps to a crew, else `jobColor(job.id)`. Used as the `color` callback above.

### Filtering

`JobSchedulingView` computes the month's job set from `displayJobs`:
- Crew / Job → all `displayJobs`.
- Crew Member → if `selectedMemberId` set, jobs whose `crewMemberIds`/allocations include that member; else all. A member `<select>` (populated from `allStaff`) renders only in month + member mode.

### Component: `components/views/JobScheduling/MonthBoard.tsx`

Props: `weeks: MonthWeek[]`, `jobs: Job[]`, `crews: CrewGroup[]`, `config`, `colorForJob`, `onSelectJob(jobId)`, `onDropJob(jobId, dayKey)`, `canReschedule`. Renders:
- A weekday header row (working-day names).
- One grid row per `MonthWeek`: day cells (date number, faded when `!inMonth`) with an absolutely-positioned bar overlay built from `buildMonthWeekLane` + `layoutLaneBars`, mirroring `ProductionBoard`'s bar overlay (columns via `gridTemplateColumns: repeat(n, 1fr)`, bar `left`/`width` from `startCol`/`span`).
- Bars are buttons → `onSelectJob`. Bars are `draggable`; day cells are drop targets → `onDropJob(jobId, dayKey)`.

### Drag-to-reschedule

`onDropJob(jobId, dayKey)` reuses the **existing** week-board drop handler in `JobSchedulingView` (the one that builds a slot via `moveJobToSlot` and calls `preview.stage({..., mode: 'edit'})`). Dropping a bar on a day stages a single-job reschedule and opens the reschedule drawer, identical to dragging on the week board. No new staging logic.

### Rendering switch

`JobSchedulingView` renders `<MonthBoard .../>` when `scale === 'month'`, else the existing `<ProductionBoard .../>`. The reschedule drawer, Job Details panel, and all modals are shared and unchanged.

## Data flow

```
JobSchedulingView
  ├─ scale: 'week' | 'month'
  ├─ selectedMemberId: string | null            (month + member filter)
  ├─ monthWeeks = buildMonthWeeks(currentDate, workConfig)     (month mode)
  ├─ monthJobs  = filter(displayJobs by lane toggle / selectedMemberId)
  └─ scale==='month'
       ? <MonthBoard weeks jobs={monthJobs} crews colorForJob onSelectJob={setSelectedJob} onDropJob={handleJobDrop} />
       : <ProductionBoard ... />   (unchanged)

MonthBoard per week → buildMonthWeekLane(jobs, week.dayKeys, config, colorForJob) → layoutLaneBars → bars
click bar  → onSelectJob(jobId) → Job Details panel
drop bar   → onDropJob(jobId, dayKey) → existing moveJobToSlot + preview.stage('edit')
```

## Testing

- **`buildMonthWeeks`** — for a known month: correct number of week rows; first row starts on/before the 1st and includes faded prior-month days; last row includes trailing days; each week holds only working days (weekends dropped); `inMonth` flags correct. Test a month where the 1st is mid-week and one where weekends are enabled vs disabled.
- **`buildMonthWeekLane`** — a multi-day job within one week spans the right columns; a job crossing a week boundary appears in both weeks with the correct per-week span; non-occupied days hold no card. (Bar packing itself is already covered by `layoutLaneBars` tests.)
- **Crew-color helper** — returns the crew color for a crewed job, `jobColor` fallback otherwise.
- **`MonthBoard` component** — renders the weekday header and day-number cells; renders a spanning bar for a multi-day job; clicking a bar calls `onSelectJob` with the job id. Drag/drop wiring verified manually (jsdom DnD is unreliable); the new-date math is exercised through the existing move handler's tests.

## Risks / Notes

- Week rows auto-grow with track count; a pathologically busy week could get tall. Acceptable for v1; "+N more" capping is a later refinement.
- Adjacent-month faded days still render real jobs that fall on them — intended, so spanning bars at month edges aren't truncated mid-bar.
- Month + Crew Member filter introduces a member `<select>`; it's the only new control. If undesired, fall back to coloring all jobs by member with no picker (noted as the alternative during brainstorming).
- Reuses `visibleWeekDays`, `layoutLaneBars`, `occupiesWorkingDay`, `moveJobToSlot`, and the `preview.stage` pipeline — no engine changes.
