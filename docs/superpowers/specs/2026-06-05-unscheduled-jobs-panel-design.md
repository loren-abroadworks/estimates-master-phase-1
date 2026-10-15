# Unscheduled Jobs panel (Job view)

**Date:** 2026-06-05
**Status:** Approved, ready for implementation plan

## Problem

In the Job Scheduling view's **Job** tab, jobs that have never been placed on the
calendar (no `startDate`) are invisible — `buildJobLanes` only renders jobs that
have a start. A scheduler has no way to see what still needs scheduling from this
screen. The Crew view solves the parallel problem with its "Jobs This Week"
section (`CrewHoursGrid.tsx`): a grid of draggable job cards you drop onto a crew
member to assign hours.

We want the same affordance for the Job tab: a section listing unscheduled jobs
that you drag onto a day on the board to schedule them.

## Goal

Below the board, in the **Job** view at **both Week and Month** scales, show an
**Unscheduled Jobs** section of draggable cards for every active job with no
`startDate`. Dragging a card onto a day opens the existing reschedule preview
drawer (where date / per-day hours / crew are confirmed); pressing **Apply**
schedules the job, after which it leaves the section. Clicking a card opens the
job details panel.

Not in scope: changing how already-scheduled jobs are dragged; month/week board
layout changes beyond adding drop handling; bulk-scheduling multiple jobs at once.

## Key constraint discovered

The two boards drag differently:

- **MonthBoard** uses HTML5 drag-and-drop. Cells have `onDragOver`/`onDrop`; the
  dragged job id is held in an internal `dragged` ref set by its own cards'
  `onDragStart`.
- **ProductionBoard** (week) uses a **custom pointer-based drag** (pointerdown /
  pointermove / pointerup + `cellAtPoint`). Its day cells carry
  `data-cell-id` / `data-cell-day` but have **no `onDrop` handler at all**.

The Crew "Jobs This Week" cards — the pattern being mirrored — use HTML5
`dataTransfer` (`JOB_DND_TYPE = 'application/x-job-id'`). So neither board today
accepts an *external* HTML5-dragged card.

**Decision:** standardize this new flow on HTML5 `dataTransfer` and add matching
drop handlers to both boards. The existing flow already supports the rest:
`handleDropJob` computes a default workday-length span when the job has no
existing dates, and `moveJobToSlot` sets `oldStart`/`oldEnd` to `null` for an
unscheduled job — so `preview.stage({ mode: 'edit', primaryJobId })` works
unchanged.

## Design

### 1. Shared DND constant — `components/views/JobScheduling/jobDnd.ts`

Extract the currently-private `JOB_DND_TYPE = 'application/x-job-id'` from
`CrewHoursGrid.tsx` into a tiny shared module. Imported by `CrewHoursGrid`, the
new panel, `ProductionBoard`, and `MonthBoard`.

### 2. New component — `UnscheduledJobsPanel.tsx`

`components/views/JobScheduling/UnscheduledJobsPanel.tsx`.

**Pure selector (named export, unit-tested):**

```
selectUnscheduledJobs(jobs: Job[]): Job[]
  → jobs with no startDate AND stage !== 'Cancelled'
```

**Props:**

- `jobs: Job[]` — already filtered via `selectUnscheduledJobs` by the parent
  (or the parent passes all jobs and the panel filters; parent filters, to keep
  the component dumb).
- `clientNameById: (job: Job) => string | undefined` — or a `clients` lookup; the
  parent resolves client name.
- `hoursHintById?: Record<string, number>` — estimated hours per job
  (`computeJobStats(job, workOrders).estHours`), shown when > 0.
- `colorForJob: (job: Job) => string` — for the card's color spine.
- `canReschedule: boolean` — when false, cards are not draggable (view-only).
- `onSelectJob: (id: string) => void` — click opens job details.

**Card visuals** mirror Crew's "Jobs This Week" card: rounded border, left color
spine, grip icon, hover/focus ring, `cursor-grab`. Content adapted because the
job is not scheduled:

- Job name (bold, truncated)
- Job number (muted)
- Client name (muted)
- Estimated hours hint (e.g. "~24h est") when available — no day badges, no
  staffing progress bar.

**Drag:** HTML5 `draggable={canReschedule}`; `onDragStart` sets
`e.dataTransfer.setData(JOB_DND_TYPE, job.id)` and `effectAllowed = 'copy'`.

**Click / keyboard:** `onClick` / Enter / Space → `onSelectJob(job.id)`,
`role="button"`, `tabIndex={0}` — same as the Crew cards.

**Empty state:** check icon + "All jobs are scheduled."

**Header:** "UNSCHEDULED JOBS" label matching the "JOBS THIS WEEK" header style.

### 3. ProductionBoard — accept external drops

On the background day cell `<div>` (the one with `data-cell-id`), add (only when
`canReschedule`):

- `onDragOver`: `e.preventDefault(); e.dataTransfer.dropEffect = 'copy'` and set a
  `dropHoverCell` state to the cell id for a light highlight.
- `onDrop`: read `e.dataTransfer.getData(JOB_DND_TYPE)`; if present call
  `onDropJob(jobId, dayKey)`; clear `dropHoverCell`.
- `onDragLeave`: clear `dropHoverCell` for that cell.

Highlight reuses the existing hovered-cell styling (primary tint + ring). The
pointer-based internal drag system is left completely untouched — board cards
still move via pointer events.

### 4. MonthBoard — accept external drops

Update the cell `onDrop` to read the job id from `dataTransfer` first, falling
back to the internal ref:

```
const id = e.dataTransfer.getData(JOB_DND_TYPE) || dragged.current;
if (id) onDropJob(id, d.key);
dragged.current = null;
```

Its own card `onDragStart` also calls
`e.dataTransfer.setData(JOB_DND_TYPE, bar.card.jobId)` (in addition to setting the
ref) so internal and external drags use the same channel.

### 5. Wiring in `JobSchedulingView`

- Derive `unscheduledJobs = useMemo(() => selectUnscheduledJobs(jobs), [jobs])`.
- Derive the client-name and hours-hint lookups for those jobs.
- Render `<UnscheduledJobsPanel>` immediately after the board block, guarded by
  `view === 'job'` (both Week and Month; not shown in Crew/member view).
- `onSelectJob` → `setSelectedJob`. The drop itself needs **no new handler** — it
  reuses the existing `onDropJob={handleDropJob}` already passed to both boards,
  which stages the reschedule preview.

## Data flow

```
UnscheduledJobsPanel card (HTML5 drag, sets dataTransfer[JOB_DND_TYPE])
  └─ drop on board day cell (ProductionBoard or MonthBoard)
       └─ onDropJob(jobId, dayKey)  ==  handleDropJob
            └─ moveJobToSlot (oldStart=null) → preview.stage({mode:'edit'})
                 └─ ReschedulePreviewPanel: confirm date / hours / crew → Apply
                      └─ onApplySchedule → job gets startDate
                           └─ selectUnscheduledJobs no longer returns it → card disappears
```

## Edge cases

- **Null `oldStart` in the preview panel.** An unscheduled job has
  `oldStart = null`. Verify `ReschedulePreviewPanel` renders this gracefully
  (e.g. "Not scheduled → <date>") rather than blank/NaN. Adjust the panel's
  old-date rendering if needed (the CascadeReschedule modal already labels this
  case "Not scheduled").
- **Cancelled jobs** are excluded by `selectUnscheduledJobs`.
- **View-only users** (`canReschedule === false`): cards render but are not
  draggable; clicking still opens details.
- **Reschedule drawer open** (`panelOpen` reserves the right gutter): the panel
  sits below the board within the reserved-width content, no layout conflict.
- Unscheduled jobs are not week/month specific, so the section content does not
  change as the scheduler navigates dates — correct, since these jobs have no
  date.

## Testing

- **`selectUnscheduledJobs`** (pure): returns no-`startDate` jobs, excludes
  Cancelled, excludes jobs with a `startDate`.
- **`UnscheduledJobsPanel`** (component): renders a card per job with
  name/number/client/hours; `onDragStart` sets `dataTransfer` with the job id;
  click fires `onSelectJob`; empty state when no jobs; not draggable when
  `canReschedule` is false.
- **ProductionBoard** (component): a synthetic drop carrying `JOB_DND_TYPE` on a
  day cell calls `onDropJob(jobId, dayKey)`; dragover highlights the cell.
- **MonthBoard** (component): drop via `dataTransfer` calls `onDropJob`; existing
  internal-drag drop still works.
- Reuse existing `JobSchedulingView` integration coverage where practical; no new
  full-view test required beyond confirming the panel renders only in Job view.

## Files touched

- **New:** `components/views/JobScheduling/jobDnd.ts`
- **New:** `components/views/JobScheduling/UnscheduledJobsPanel.tsx`
- **New:** `components/views/JobScheduling/UnscheduledJobsPanel.test.tsx`
- **Edit:** `components/views/JobScheduling/CrewHoursGrid.tsx` (import shared
  `JOB_DND_TYPE`)
- **Edit:** `components/views/JobScheduling/ProductionBoard.tsx` (cell drop
  handlers + dropHover highlight)
- **Edit:** `components/views/JobScheduling/MonthBoard.tsx` (dataTransfer in
  drop/dragstart)
- **Edit:** `components/views/JobSchedulingView.tsx` (derive + render panel)
- **Edit (if needed):** `components/views/JobScheduling/ReschedulePreviewPanel.tsx`
  (render null `oldStart` as "Not scheduled")
