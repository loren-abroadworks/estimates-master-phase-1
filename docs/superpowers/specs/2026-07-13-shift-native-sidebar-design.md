# Shift-Native Reschedule Sidebar (Piece A) — Design

**Date:** 2026-07-13
**Status:** Approved (design)
**Piece:** A of 2. Piece B (shift-granular cascade resolver) shipped 2026-07-13
(`services/shiftCascade.ts`, spec `2026-07-11-shift-granular-cascade-design.md`).
Piece A unlocks B's deferred **sidebar DAILY HOURS** trigger.

## Problem

The reschedule drawer (`components/views/JobScheduling/reschedule/SingleJobEditor.tsx`)
edits schedule at **job granularity**. Its DAILY HOURS section renders per-day time rows
from a `dayHours` map keyed by date and calls `onChangeDailyHour(jobId, dateKey, field,
value)` — there is no shift dimension. `ReschedulePreviewPanel` feeds it
`dayHours={dailyHoursEdits?.[editChange.jobId] ?? {}}`, and the view's `dailyHoursEdits`
state is `Record<jobId, Record<dateKey, DayHours>>` — also job-keyed. So a job with two
shifts (e.g. Prep + Finish) shows one merged set of day rows, and editing them cannot
target a single shift. This is why Piece B's third cascade trigger ("sidebar DAILY HOURS
edit → stage a `shiftId` change → run the resolver") was deferred: the sidebar has no way
to name a shift.

Piece B verification also exposed the failure mode directly: the job-keyed
`dailyHoursEdits` bake on apply clobbered every shift of a job with one window (worked
around in Piece B by committing shift changes as-is). Piece A removes the root cause for
shift jobs.

## Decisions (from brainstorming)

1. **Minimal scope.** Keep the drawer's layout. Only the shift-selection UI, the DAILY
   HOURS rows, and the START/END DATE fields become shift-scoped. No per-shift crew
   editing, no add/remove/rename shifts, no month-view split (all deferred).
2. **Shift picker = tabs.** For a job with 2+ shifts, a compact segmented tab row at the
   top of DAILY HOURS lists the shifts, defaults to the triggering/dragged shift, and
   edits one shift at a time. One shift per fewer than 2 shifts → no tabs.
3. **Date fields are shift-aware.** In shift mode the START/END DATE fields edit the
   **selected shift's** span (they already display the shift's dates), running the cascade
   when ON — consistent with the DAILY HOURS rows.
4. **Behavior mirrors the board drag triggers.** Cascade ON → run `resolveShiftCascade`;
   cascade OFF → stage only the edited shift (preview shows just it).
5. **Legacy jobs unchanged.** A job with no `allocations` renders today's job-level DAILY
   HOURS block and job-level date handlers verbatim — zero behavior change.
6. **Edits stage immediately** (Approach A), like a board drag, rather than accumulating
   silently until Apply. This is already how the cascade preview behaves for drags.

## Approach

**Chosen — Approach A: route drawer edits through the existing shift-change path.**
In shift mode, each edit (a day-hour change, a date-field change) rebuilds the active
shift's **complete** per-day window map and stages a `shiftId` `ProposedChange` — the
same shape the week/day-board drags already produce (Piece B). That reuses the whole
Piece B pipeline: `restageShiftMove` → `resolveShiftCascade` (cascade ON) and
`applyChangeToJob`'s window branch + multi-shift apply-fold on commit. No new commit
path, and the job-keyed `dailyHoursEdits` accumulate/bake machinery is **not** used for
shift jobs at all (it remains for legacy jobs).

Rejected:
- *Approach B (nested `dailyHoursEdits: {[jobId]: {[shiftId]: DayHours}}`):* keeps the
  accumulate-then-bake model but per-shift. More surface — a second key threaded through
  the seed effect, `bakeDailyEdits`, `applyDailyHours`, and the commit fold — and it
  re-introduces the baking layer Piece B had to special-case around.
- *Approach C (full per-shift-sections editor with crew + add/remove):* the larger scope
  declined in decision 1.

## Design

### 1. `ShiftHoursEditor` (new presentational component)

`components/views/JobScheduling/reschedule/ShiftHoursEditor.tsx` — extracted from the
current DAILY HOURS block. Owns no state and no cascade logic; pure inputs → callbacks,
so it is unit-testable in isolation.

```ts
interface ShiftHoursEditorProps {
  shifts: JobCrewAllocation[];              // the job's allocations (>=1)
  activeShiftId: string;                    // which shift's rows are shown
  onSelectShift: (shiftId: string) => void; // tab click
  dayHours: Record<string, { startTime: string; endTime: string }>; // active shift's per-day windows
  onChangeDayHour: (dateKey: string, field: 'startTime' | 'endTime', value: string) => void;
  onShiftFirstDayStart: (dateKey: string, startTime: string) => void; // first-day start special input
  nonWorkingWeekdays: number[];
}
```

Renders:
- a **segmented tab row** of shift names, shown only when `shifts.length >= 2`, active
  tab highlighted (accessible names = shift names; the active tab has `aria-pressed`);
- per-day time rows for the **active shift's own working days** (`workingDayKeys` over the
  shift's `startDate`/`endDate`), each a start + end `TimeInput`;
- the existing first-day start-input special-casing (`FirstDayStartInput`), applied to the
  active shift's first day.

Reuses `TimeInput` (from `components/UI`), and `SectionLabel` / `FirstDayStartInput`
patterns currently local to `SingleJobEditor` (extract or duplicate minimally).

### 2. `SingleJobEditor` — shift mode

`SingleJobEditor` renders `ShiftHoursEditor` **when the staged primary change carries a
`shiftId`** (an allocation-based job); otherwise it renders today's job-level DAILY HOURS
block verbatim. New props threaded through from the view via `ReschedulePreviewPanel`:
`shifts`, `activeShiftId`, `onSelectShift`, and shift-aware `onChangeDayHour` /
`onShiftFirstDayStart`. The START/END DATE fields, in shift mode, call the view's
shift-aware date handler (below) instead of the job-level `onChangeJobDate`.

### 3. View state & data flow (Approach A)

In `JobSchedulingView.tsx`:
- New state `activeShiftId: string | undefined`, seeded from the staged primary change's
  `shiftId` when a shift move is staged (and reset when the preview clears). Tab clicks
  set it. It is purely a view concern — switching tabs never loses staged edits, because
  each edit is already staged into `preview.changes`.
- A helper `stageShiftHoursEdit(jobId, shiftId, dateKey, window)`: reads the shift's
  current complete per-day windows (from the shift's staged change if present, else from
  the allocation via `allocDayWindow` over `workingDayKeys`), overrides `dateKey` with the
  new `window`, and builds a `shiftId` `ProposedChange` (newStart/newEnd from the map's
  first/last keys, `dailyHours` = the complete map). Then:
  - cascade **ON** → `restageShiftMove(change, cascadeUntil)` (Piece B resolver);
  - cascade **OFF** → `preview.setChanges` with just that shift's change merged into any
    other staged shift changes for the job.
- A helper `stageShiftDateEdit(jobId, shiftId, field, value)` for the START/END DATE
  fields: shifts the selected shift's span to the new date, rebuilds its window map by the
  same day delta, and stages the same kind of `shiftId` change (ON → resolver, OFF →
  shift-only). Mirrors the week-board drag's span logic.
- The active shift's `dayHours` shown in the editor come from that shift's staged change
  (`preview.staged.changes.find(c => c.shiftId === activeShiftId)?.dailyHours`) if present,
  else materialized from the allocation.

Legacy path unchanged: when the staged change has no `shiftId`, `handleChangeDailyHour` /
`handleChangeJobDate` / `dailyHoursEdits` behave exactly as today.

### 4. Cascade, preview & apply

- Editing shift A's hours with cascade ON runs `resolveShiftCascade`, which may re-place
  shift B; the drawer keeps A active, B's tab reflects its resolved slot when selected,
  and residual clashes appear in the existing issues list (Piece B wiring).
- Multiple edited shifts on one job produce multiple `shiftId` changes; the existing
  multi-shift apply-fold (`App.applyScheduleChanges`) commits them all, and
  `applyChangeToJob`'s window branch writes each shift's per-day windows.
- No new commit path; Piece A only adds a third **producer** of the `shiftId` change
  already flowing through preview → apply.

## Edge cases

- **Immediate staging = no lost edits.** Tab switching only changes `activeShiftId`; every
  touched shift keeps its own staged change.
- **Single-shift job:** shift-scoped rows, no tabs.
- **Active shift days:** rows come from the shift's own span, so a shift the cascade
  re-placed shows its new days when its tab is selected.
- **Date-field edit creating an overlap:** stages the shift's new span; cascade ON
  re-places the blocker — same path as a board drag.
- **First-day start** input is per shift, keyed to the active shift's start day.
- **Cascade OFF then a clash:** the edited shift is staged alone; the shift-grain warning
  behavior matches Piece B's OFF path (non-blocking).

## Testing strategy

TDD — failing test first; the full suite stays green.

- **`ShiftHoursEditor` (Testing Library, isolated):** tabs render only at ≥2 shifts;
  default active = triggering shift; clicking a tab fires `onSelectShift`; rows reflect the
  active shift's working days; a time edit fires `onChangeDayHour(dateKey, field, value)`;
  single-shift job renders rows with no tabs.
- **`SingleJobEditor` (extend existing tests):** shift-mode renders `ShiftHoursEditor` when
  the change has a `shiftId`; legacy (no `shiftId`) renders the job-level block unchanged;
  the START/END DATE fields call the shift-aware handler in shift mode.
- **View wiring (unit where seam-testable, else runtime):** a day-hour edit stages a
  `shiftId` `ProposedChange` with the shift's complete windows; cascade ON produces
  followers; a date-field edit stages the shift span.
- **Runtime verify (verify skill):** seed a 2-shift job, open the drawer via a shift drag,
  switch tabs, edit Finish to overlap Prep with cascade ON → Prep re-places; edit with
  cascade OFF → only that shift moves; confirm apply commits **per-shift** windows (the
  regression class Piece B exposed). Revert the seed after.

## Dependencies & sequencing

- **Piece B** (shipped) provides `ProposedChange.shiftId`, `applyChangeToJob`'s window
  branch, the multi-shift apply-fold, `resolveShiftCascade`, and `restageShiftMove`. Piece
  A is a thin producer on top; no engine changes expected.

## Out of scope (this piece)

- Per-shift crew editing; add / remove / rename shifts in the drawer.
- Per-shift month-view splitting.
- Any change to how Work Orders create shifts.
- The nested `dailyHoursEdits` refactor (Approach B) — not needed under Approach A.
