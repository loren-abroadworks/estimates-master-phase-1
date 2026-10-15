# Crew Availability Hours on the Scheduling Board — Design

**Date:** 2026-06-13
**Status:** Approved
**Related:** [2026-06-11-crew-availability-toggle-design.md](./2026-06-11-crew-availability-toggle-design.md)

## Problem

The Availability toggle in the Job Scheduling **Crew** view is meant to surface each
member's per-day availability. Today the board only ever renders an `Off` badge:
`renderCellExtra` returns `null` for any working day (`if (!a.off) return null`), and
the seed crew have no `schedule` data, so in practice **nothing** appears — the toggle
looks like it does nothing.

The user wants the board to show each member's working-hours window per day (e.g.
`8a–5p`), sourced from the same data the **Edit Team Member → Schedule Availability**
modal edits (`member.schedule[dayKey]`: `startTime`, `endTime`, `isOff`, `reason`).

## Goal

When the Availability toggle is on, each crew member's row shows, per day:

- A compact **working-hours window** (e.g. `8a–5p`) on working days.
- The existing red **`Off`** badge (with reason when present) on off days.

Resolved from `member.schedule[dayKey]` when present, otherwise the company default
window from `workDayStartHour` / `workDayEndHour`. Job bars/chips/blocks always stay
visible. Hiding the toggle suppresses all of this (already wired).

## Non-goals

- Editing availability from the board (the modal remains the editor).
- Shading the timeline axis on the Day view (chose a row-label label instead).
- Showing a separate WORKING/OFF status pill — hours window only (off days show `Off`).
- Persisting toggle state across reloads (local state, by design).

## Approach

A single shared resolver feeds all three crew sub-views; each view renders the result
in the lightest way that fits its layout. Purely presentational — no schedule writes.

### 1. Shared resolver — new `services/crewAvailability.ts`

```ts
export interface DayAvailability {
  off: boolean;
  reason?: string;
  startTime: string; // 'HH:mm'
  endTime: string;   // 'HH:mm'
}

/** Per-day availability for a member: their schedule entry when present, else the
 *  company default window. `off` carries the optional reason. */
export const resolveDayAvailability = (
  member: CrewMember,
  dayKey: string,
  defaultWindow: { startTime: string; endTime: string },
): DayAvailability;

/** Compact board label: "8a–5p" on working days; reason or "Off" when off. */
export const formatAvailWindow = (a: DayAvailability): string;
```

`formatAvailWindow` renders a 12-hour compact window: whole hours drop minutes
(`8a`, `5p`), non-whole keep them (`8:30a`); en-dash separator. When `a.off`, returns
`a.reason || 'Off'`.

This replaces the inline `formatAvail` in `JobSchedulingView.tsx:594`, which hardcodes
`08:00`/`17:00` defaults. The default window is derived once in the view from
`workConfig.workDayStartHour` / `workDayEndHour` via a small `hourToHHmm(n)` helper
(e.g. `8 -> '08:00'`).

### 2. Week Board — `ProductionBoard` via `renderCellExtra` (`JobSchedulingView.tsx:1339`)

Drop the `if (!a.off) return null` early-out. Render:

- **Working day:** the compact hours window in a neutral chip (gray text/background),
  positioned where the `Off` badge sits today (absolute top-right of the cell).
- **Off day:** the existing red `Off`/reason badge, unchanged.

Still gated on `view === 'member' && showAvailability`. No change inside
`ProductionBoard`.

### 3. Week Hours grid — `CrewHoursGrid.tsx` + `services/crewHoursGrid.ts`

- Add `availByDay: Record<string, DayAvailability>` to `MemberRow`, computed in
  `buildCrewHoursGrid` using `resolveDayAvailability`. The builder gains a
  `defaultWindow: { startTime: string; endTime: string }` parameter, passed from the
  `hoursModel` memo in `JobSchedulingView` (derived from `workConfig`).
- In the day-cell body, when `showAvailability` is true and the day is **not** off,
  render a small neutral hours label (e.g. `8a–5p`) above the job chips. Off days keep
  their existing `Off` label (gated by `showAvailability`, per the prior toggle work).
- Gated by the existing `showAvailability` prop. No new prop needed.

### 4. Day timeline — `DayBoard` row label (`JobSchedulingView.tsx` renderRowLabel)

Under the member name in the left row label, render a compact `8a–5p` line, shown only
when `showAvailability`. Applies to both Day+Board (`:1275`) and Day+Hours (`:1208`)
`renderRowLabel` callbacks. The timeline axis already shows time, so a small label in
the row header is the lightest consistent treatment; no timeline/axis changes.

## Data flow

`JobSchedulingView` owns the default window (from `workConfig`) and `showAvailability`.
It threads them into the three sub-views; `crewAvailability.resolveDayAvailability` is
the single resolution point. No data, service mutation, or model write — only
presentational overlays.

## Error handling

None needed — overlays are optional UI. Missing `schedule` falls back to the company
default window; missing/zero default still yields a valid (possibly equal) window with
no crash.

## Testing

- **`services/crewAvailability.test.ts`** (new): `resolveDayAvailability` returns the
  per-day entry when present, falls back to the default window when absent, and carries
  `off`/`reason`. `formatAvailWindow` formats whole/half hours and off states.
- **`CrewHoursGrid.test.tsx`** (extend): the hours label shows on a working day when
  `showAvailability` is true and is absent when false; off days still show `Off`; job
  chips always render.
- **Manual:** Crew view → Week Board / Week Hours / Day — toggle on shows `8a–5p` on
  working days and `Off` on off days; toggle off hides all of it; job schedule stays.
