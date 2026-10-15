# Rich Reschedule Preview Panel — Design

**Date:** 2026-06-03
**Status:** Approved

## Problem

The current reschedule preview is a thin bottom bar that lists potential issues,
smart suggestions, and the staged date changes. The desired experience is a
richer, multi-column control center that surfaces the schedule impact at a
glance, lets the user adjust the delay in-place, visualizes before/after on a
mini timeline, and exposes actionable smart suggestions (auto-fix, weather,
customer updates).

## Goals

- Rebuild the panel as a bottom-docked multi-column sheet matching the approved
  mockup, wrapping gracefully on narrow screens.
- Wire every element to real data; no static placeholders.
- Add an interactive **Delay by** control that re-runs the reschedule engine and
  updates the preview (issues, suggestions, impact) live.
- Keep the existing apply / cancel / auto-fix / review-manually behavior intact.

## Non-Goals

- No new full-screen routes/modals. Weather and customer detail expand inline.
- No real notification backend; "Preview Messages" shows generated message text
  only (no send).
- The Delay-by control appears only for cascade-style reschedules ("move job +
  following"); single drag-drops keep the simpler preview without it.

## Layout

Bottom-docked sheet (`fixed bottom-0 left-0 right-0 lg:left-[104px]`, taller —
up to ~55vh, scrollable). Header row with calendar icon, "Reschedule Preview"
title, the staged label badge, the changing-count, and an X close button.
Below: a horizontal flex of four columns that wrap:

1. **Delay by** dropdown (when interactive) + **Schedule Impact** stat list.
2. **Potential Issues** list (severity icons + locked-job row + View Details).
3. **Preview Timeline** before/after mini-gantt.
4. **Smart Suggestions** card (bordered, rightmost).

Footer: `Cancel · Review Manually · Auto-Fix Issues · Apply Changes`.

## Architecture

### New service: `services/rescheduleImpact.ts` (pure, unit-tested)

```ts
interface WeatherHit { dateKey: string; kind: WeatherKind; jobCount: number; }
interface CustomerUpdate {
  clientId: string; clientName: string; jobName: string;
  oldStart: string | null; newStart: string;
}
interface RescheduleImpact {
  jobsAffected: number;      // non-skipped changes
  crewsAffected: number;     // distinct crew groups among changed jobs
  totalDelayDays: number;    // max calendar-day delta among changed jobs
  newEndDate: string | null; // max newEnd among changed jobs
  lockedCount: number;       // changes with skipped === 'locked'
  weatherHits: WeatherHit[]; // changed jobs landing on rain/storm days
  customerUpdates: CustomerUpdate[];
}

computeImpact(changes, jobs, crews, clients, mockWeather): RescheduleImpact
buildCustomerMessages(updates: CustomerUpdate[]): { clientName: string; message: string }[]
```

All derived from existing data structures (`ProposedChange`, `Job.category`,
`Job.clientId`, `Job.crewGroupId/crewGroupIds`, `CrewGroup`, `Client`,
`SchedulingSettings.mockWeather`). Pure functions; no `Date.now()`.

### `StagedReschedule` extension (`services/reschedulePreview.ts`)

Add two optional fields:

```ts
delayDays?: number;                                  // current delay (seed for control)
recompute?: (delayDays: number) => ProposedChange[]; // re-run engine at a new delay
```

`SET_CHANGES` already exists for live updates; reuse it.

### View wiring (`components/views/JobSchedulingView.tsx`)

- Compute `impact = computeImpact(staged.changes, jobs, crews, clients, mockWeather)`
  via `useMemo`, recomputed whenever staged changes change.
- On cascade-capable staging paths (Move-job drawer cascade, Rain-day), set
  `delayDays` and `recompute = (d) => shiftJobsFromPoint(jobs, anchor, d, 'days', config)`,
  where `anchor` is the earliest `oldStart` among non-skipped changes.
- Pass `impact`, `clients`, `crews`, `weekDays`, and delay handlers to the panel.

### Panel + subcomponents

- `ReschedulePreviewPanel.tsx` — rewritten container/layout, holds local UI state
  (selected delay, which inline section is expanded, reviewing toggle).
- `PreviewTimeline.tsx` — before/after mini-gantt. Maps each non-skipped change to
  a positioned bar across the min→max date range of all old/new starts; two rows
  (Before from oldStart, After from newStart), colored by crew/job color.
- `SmartSuggestionsCard.tsx` — three sub-cards:
  - **Auto-Fix Recommended** (when `suggestions.length > 0`) → `Fix For Me` calls
    `onAutoFix`.
  - **Weather Alert** (when `impact.weatherHits.length > 0`) → text summarizes
    affected days + count; `View Weather` inline-expands the forecast.
  - **Customer Updates** (when `impact.customerUpdates.length > 0`) → "N customers
    will be notified"; `Preview Messages` inline-expands `buildCustomerMessages`.

### Delay-by behavior

The dropdown offers 1 / 2 / 3 / 5 / 7 days, seeded from `staged.delayDays`. On
change it calls `recompute(days)` and dispatches `preview.setChanges(...)`. Issues,
suggestions, and impact recompute through their existing `useMemo`s. When
`recompute` is absent, the Delay-by control is hidden and Total Delay still shows
(read-only) from `impact`.

## Testing

- `services/rescheduleImpact.test.ts` — `computeImpact` (counts, crews, delay,
  end date, locked, weather hits, customer updates) and `buildCustomerMessages`,
  using fixed ISO dates (timezone-robust, matching existing test conventions).
- A render test for `ReschedulePreviewPanel` covering: stats render from impact,
  Delay-by calls the handler, View Weather / Preview Messages expand inline, and
  the control is hidden without `recompute`.

## Risks / Notes

- `crewGroupId` vs `crewGroupIds` vs `allocations` are inconsistent across jobs;
  `computeImpact` will coalesce them defensively.
- The mini-gantt is intentionally simple (day-granular columns), not a full
  scheduling gantt.
