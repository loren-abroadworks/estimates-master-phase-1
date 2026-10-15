# Per-Day Start/End Time Editor — Design

**Date:** 2026-06-03
**Status:** Approved

## Problem

A job has a single `startDate`/`endDate`. When rescheduling a multi-day job, the user
wants to set the start and end time for **each day** the job spans, from the Reschedule
Preview panel, and have those times persist on the job.

## Goals

- In the Reschedule Preview, list each day a changing job spans with editable start/end
  time inputs (single-day jobs show one row).
- Persist per-day hours on the job; the job's overall start = first day's start time, end
  = last day's end time.
- Apply alongside the existing date move when the user clicks Apply Changes.

## Non-Goals

- No board/timeline layout change (the job still occupies the same days).
- No per-member or per-allocation hours here (that lives on `JobCrewAllocation`).
- Per-day editing is offered for the jobs the preview lists as changing (usually one).

## Data Model

Add to `Job` (types.ts):

```ts
/** Optional per-day working hours, keyed by local 'YYYY-MM-DD'. */
dailyHours?: Record<string, { startTime: string; endTime: string }>;
```

## Engine Helpers (`services/scheduleEngine.ts`, pure + unit-tested)

```ts
// Inclusive list of local date keys a job covers.
spannedDayKeys(startIso: string, endIso: string | null): string[]

// Adjust a change's overall start/end from the first/last day's edited hours.
// hours: Record<dateKey, { startTime: 'HH:mm'; endTime: 'HH:mm' }>
applyDailyHours(change: ProposedChange, hours: Record<string, { startTime: string; endTime: string }>): ProposedChange
```

`applyDailyHours` computes `newStart` = `${firstDayKey}T${firstStart}:00` and `newEnd` =
`${lastDayKey}T${lastEnd}:00` (local), leaving the change unchanged if `hours` is empty or
the day isn't present. First/last day are the min/max of `spannedDayKeys(change.newStart,
change.newEnd)`.

## State & Flow (`JobSchedulingView`)

- `dailyHoursEdits: Record<jobId, Record<dateKey, {startTime, endTime}>>` in view state.
- Seed it whenever `preview.staged` changes: for each non-skipped change, for each day in
  `spannedDayKeys(change.newStart, change.newEnd)`, use `job.dailyHours[dateKey]` if present,
  else `{ startTime, endTime }` derived from the change's `newStart`/`newEnd` time-of-day,
  else workday defaults (`workConfig.workDayStartHour`/`EndHour`). Cleared when staged clears.
- Pass `dailyHoursEdits` + `onChangeDailyHour(jobId, dateKey, field, value)` to the panel.
- On Apply: for each changed job, `onUpdateJob({ ...job, dailyHours: edits[jobId] })`, and
  replace the change with `applyDailyHours(change, edits[jobId])`; then run the existing
  commit with the adjusted changes and clear the preview.

## Panel UI (`ReschedulePreviewPanel`)

A new "Daily Hours" section (below Schedule Impact). For each changing job: a small header
with the job name, then one row per spanned day — the weekday/date label and two
`<input type="time">` controls (start, end) wired to `dailyHoursEdits` via `onChangeDailyHour`.
Hidden when there are no changing jobs. New optional props:
`dailyHoursEdits?`, `onChangeDailyHour?`.

## Testing

- `services/scheduleEngine.test.ts`: `spannedDayKeys` (1-day → 1 key; 3-day → 3 keys; tz-safe),
  `applyDailyHours` (sets newStart/newEnd from first/last day; no-op on empty hours).
- `components/views/JobScheduling/ReschedulePreviewPanel.test.tsx`: a 3-day change renders 3
  day rows of time inputs; editing a time fires `onChangeDailyHour` with the right args.

## Risks / Notes

- Reschedule changes the job's days, so edits are keyed by the **new** day range; previous
  `dailyHours` for old dates are replaced on apply (we write the edited map wholesale).
- `<input type="time">` returns 'HH:mm'; helpers assume that format.
