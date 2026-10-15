# Job Details Side Panel — Design Spec

**Date:** 2026-06-02
**Status:** Approved

## Goal

Clicking a job card on the Production Board (Job Scheduling) opens a right-side
slide-over panel showing the job's key info and actions, instead of navigating
directly to the full job detail page. The full page becomes a link inside the
panel.

## Surface & Behavior

- A new component `components/views/JobScheduling/JobDetailsPanel.tsx`: a
  right-side slide-over drawer overlaying the board.
- Animates in from the right with a dimmed backdrop.
- Closes on: backdrop click, the X button, or the Esc key.
- Driven by a `selectedJob: Job | null` state in `JobSchedulingView`. Clicking a
  board card sets it; closing clears it.
- Content is read-only display; all verbs live in the action area.

## Panel Content

```
┌─────────────────────────────────────────┐
│  Kitchen Repaint            [ X ]         │
│  #JOB-1042   ● Scheduled                  │
├─────────────────────────────────────────┤
│  CUSTOMER                                 │
│  Jane Doe · (555) 123-4567                │
│  📍 482 Oak St, Springfield               │
│                                           │
│  SCHEDULE                                 │
│  Mon Jun 8  →  Wed Jun 10                 │
│  Interior · 🔒 Locked (if locked)         │
│                                           │
│  CREW                                     │
│  3 assigned · Mike, Sara, Tom             │
├─────────────────────────────────────────┤
│  [ Reschedule job ]   (primary)           │
│  [ View crew assignments ]                │
│  [ Cancel job ]       (red/destructive)   │
│                                           │
│  View full details  →                     │
└─────────────────────────────────────────┘
```

Field sources:
- **Title / number / stage badge:** `job.name`, `job.jobNumber`, `job.stage`.
- **Customer:** resolved from a new `clients: Client[]` prop via `job.clientId`
  (`client.name`, `client.phone`). Address from `job.address`.
- **Schedule:** `job.startDate` → `job.endDate` (formatted; "Not scheduled" when
  absent).
- **Category / lock:** `job.category`, `job.is_locked`.
- **Crew summary:** count and member names derived from `job.allocations` /
  `job.crewMemberIds` resolved against `allStaff`.

## Actions

- **Reschedule job** → closes the panel and opens the existing
  `SingleJobMoveDrawer` for that job (`setMoveJob(job)`). It stages into the
  preview-first panel and commits on Apply. No new reschedule logic.
- **View crew assignments** → opens the existing `CrewSelectionModal` for the job
  (`setJobToAssign(job)` + open), already wired in this view.
- **Cancel job** → opens a `ConfirmationModal` ("Cancel this job? It will be
  removed from the board."). On confirm:
  `onUpdateJob({ ...job, stage: 'Cancelled', startDate: undefined, endDate: undefined })`,
  then close the panel.
- **View full details →** → calls the existing `onViewJob(id)` →
  `navigate('job_detail', id)`.

## Click-behavior change

Today the board's card click calls `onViewJob(id)` (full-page navigation). After
this change, the card click opens the panel; the full-page navigation moves to
the panel's "View full details →" link.

## Data-model & ripple changes

- Add `'Cancelled'` to the `JobStage` union in `types.ts`.
- `services/productionBoard.ts` `buildLanes` currently skips `Completed` and
  `Marketing` jobs; add `Cancelled` to that skip set so cancelled jobs leave the
  board (belt-and-suspenders with the cleared dates).
- Thread a new `clients: Client[]` prop into `JobSchedulingView` from `App`.
- Stage badge gets a `Cancelled` color (grey/red).

## Out of scope

Other views that read `stage` (calendar, job detail page, reports) will get
`'Cancelled'` added to the type so they compile and treat it as a normal stage,
but their rendering of cancelled jobs is **not** redesigned here.

## Testing

- Unit: cancelling a job produces the correct patch — `stage: 'Cancelled'` and
  both dates cleared.
- Unit: `buildLanes` excludes `Cancelled` jobs.
- Light render test: clicking a card opens the panel; the panel's action buttons
  invoke their respective callbacks.
