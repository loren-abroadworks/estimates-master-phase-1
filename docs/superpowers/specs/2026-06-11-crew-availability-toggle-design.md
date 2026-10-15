# Crew Availability Visibility Toggle — Design

**Date:** 2026-06-11
**Status:** Approved

## Problem

In the Job Scheduling page's **Crew** view, each crew member's row is layered with
*availability* indicators — "Off" badges and reasons, work-hour windows
(`08:00–17:00`), and break chips. These are useful but can clutter the board when
the user just wants to see who is assigned to what. There is no way to hide them.

## Goal

Add a single toggle in the Crew view toolbar that hides/shows the availability
overlays across **all** crew sub-views (Week Board, Week Hours grid, Day timeline).
The job schedule (assigned bars/cells/blocks) always stays visible.

## Non-goals

- Hiding crew members themselves (rows stay).
- Hiding the job schedule.
- Per-view independent toggle state.
- Persistence across reloads (matches existing toggles, which are local state).

## UI

An eye-icon toggle button rendered in the toolbar **only when `view === 'member'`**,
placed alongside the existing Board/Hours mode toggle (around
`JobSchedulingView.tsx:1029-1044`).

- Icon: `Eye` when availability is shown, `EyeOff` when hidden (from `lucide-react`).
- Label: "Availability".
- Styling mirrors the existing toggle buttons: the shared
  `bg-gray-100 … rounded-xl` container with the active/inactive button classes
  already used for the Board/Hours toggle. Active (shown) state uses the
  `bg-white … text-primary-700` treatment; hidden state uses the inactive
  `text-gray-500` treatment.

## State

One new local state var in `JobSchedulingView.tsx` (near line 203, beside
`boardMode`):

```ts
// Crew view: whether per-member availability overlays (off days, work hours,
// breaks) are shown on the board. Job schedule is always shown.
const [showAvailability, setShowAvailability] = useState(true);
```

Default `true` keeps current behavior unchanged.

## Gating points

The flag gates exactly the availability overlays in the three crew sub-views.
Each is currently gated on `view === 'member'`; we extend that to
`view === 'member' && showAvailability` (or thread the flag into the component).

1. **Week Board — `ProductionBoard.tsx` via `renderCellExtra`**
   `JobSchedulingView.tsx:1225` — the `renderCellExtra` prop (the "Off"/reason
   badge built from `formatAvail`). Change the guard from `view === 'member'` to
   `view === 'member' && showAvailability` so the prop is `undefined` when hidden.
   No change inside `ProductionBoard` (it already no-ops when `renderCellExtra` is
   absent).

2. **Day timeline — `DayBoard.tsx` via `laneBreaks`**
   `JobSchedulingView.tsx:1094-1096` (Day+Hours) and `:1159-1161` (Day+Board) —
   the `laneBreaks` prop supplies break chips. Extend the guard to
   `view === 'member' && showAvailability`; passing `undefined` hides the chips
   (DayBoard already defaults to `[]` at `DayBoard.tsx:283`).

3. **Week Hours grid — `CrewHoursGrid.tsx`**
   This component renders availability from its `model`, so it needs a new optional
   prop: `showAvailability?: boolean` (default `true`). Pass it from
   `JobSchedulingView.tsx:1062`. Inside `CrewHoursGrid.tsx` (the day-cell block at
   `:172-200`), when `showAvailability` is false:
   - Do **not** apply the `off` background class or render the "Off" label
     (`:175-177`) — render the normal cell body instead.
   - Do **not** render break chips or the "+ break" affordance (`:181-195`).
   - Job chips (`renderChip`, `:180`) still render.

## Data flow

No data, service, or model changes. Purely presentational gating of existing
overlays based on one boolean threaded from `JobSchedulingView` into the three
sub-view render paths.

## Error handling

None needed — the flag only suppresses optional UI. Default-on preserves existing
behavior; the `CrewHoursGrid` prop defaults to `true` so other callers (if any)
are unaffected.

## Testing

Manual verification in the running app:
1. Crew view → Week Board: toggle off → "Off"/time badges disappear; job bars stay.
   Toggle on → badges return.
2. Crew view → Week Hours: toggle off → no "Off" labels/gray off-cells, no break
   chips or "+ break"; job chips and capacity bars stay. Toggle on → all return.
3. Crew view → Day (Board and Hours): toggle off → break chips gone; job blocks
   stay. Toggle on → chips return.
4. Toggle is absent in the Job view (`view === 'job'`).
5. Toggle resets to "shown" on reload (local state, by design).
