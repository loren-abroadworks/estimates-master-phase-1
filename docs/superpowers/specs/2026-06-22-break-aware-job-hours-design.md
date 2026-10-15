# Break-aware job hours — carve breaks out of scheduled work

**Date:** 2026-06-22
**Status:** Approved for planning

## Problem

In the Job Scheduling grid, a crew member's job hours are computed from the
scheduled window (e.g. 8am–1pm = 5h) or a manually-typed number, and **breaks
are ignored** when totalling worked/assigned hours. Breaks live alongside the
job as a separate overlay.

This is wrong when a break falls *inside* a scheduled job window. If someone is
booked 8am–1pm (5h) and takes an unpaid 12:00–12:30 lunch, they only actually
work **4.5h** — but the chip, the per-job "assigned" counter, and the day/week
totals all still say 5h.

The fix: a break that sits inside a job's scheduled window carves time out of
that work. **Unpaid** breaks reduce worked/assigned hours; **paid** breaks stay
counted (paid, on-the-clock time). The numbers the user sees must reflect this,
without ever silently rewriting what the user typed.

## Worked example (the canonical case)

Job scheduled 8:00am–1:00pm (5h gross window), unpaid lunch 12:00–12:30:

- **Unpaid lunch** → worked hours = `5 − 0.5 = 4.5h`.
- **Paid lunch** → worked hours = `5h` (unchanged).

The chip shows `4.5h` (unpaid) / `5h` (paid); the job-card "assigned" counter
and the member's day/week totals follow the same number.

## Definitions

A `CrewBreak` is either **fixed** (`startTime` set — "At a set time") or
**floating** (`startTime` absent — "Anytime"), and is **paid** or **unpaid**.
See `2026-06-15-break-time-clarity-design.md` for the fixed/floating editor.

- **Gross hours** — the scheduled window length for a job-day, or the number the
  user typed into the chip. This is what the user controls and edits.
- **Worked hours** — gross minus the unpaid break time that applies. This is the
  derived number shown on the chip and summed into the counters.
- **Job window** — a job-day's displayed time span `[startTime, endTime]`
  (`jobDayWindow`), used to decide whether a fixed break falls inside it.

## Rules

1. **Fixed unpaid break inside a job window** → carve its overlapping minutes
   out of *that job's* worked hours for that day. Affects the chip and that
   job's "assigned" counter.
2. **Fixed unpaid break in a gap** (no job window contains it — e.g. a noon
   lunch between an 8–12 job and a 1–5 job) → carves nothing; both jobs stay
   whole. (This is the Image 2 case: both chips remain 4h.)
3. **Floating unpaid break** (no set time) → cannot be tied to a job, so it comes
   off the member's **overall day total** (and therefore the week total), **not**
   any specific chip and **not** any job-card counter.
4. **Paid breaks** (fixed or floating) → never carved; they remain counted as
   worked/paid time.
5. **Partial overlap** → carve only the minutes of the break that actually fall
   inside the window (intersection), not the whole break.
6. **Capacity** (the right-hand `/ Yh` number) = the member's full working day.
   Breaks **no longer shrink capacity** (this removes today's behavior). Unpaid
   breaks reduce only the *assigned* side, so they surface naturally as free
   capacity rather than as a false "over capacity" flag.

### Why capacity stops subtracting breaks

Today capacity already subtracts *all* break time, so a normal full 8h day with a
30-min unpaid lunch reads `8 assigned / 7.5 capacity` → false "over capacity."
With capacity left at the full day and assigned carved to 7.5, it reads
`7.5 / 8h` → 0.5h free, never over. A paid lunch reads `8 / 8h` → full, not over.
Both stay internally consistent.

## Architecture

All carve math lives in the **services layer** as small pure functions, so every
consumer (weekly grid chips, capacity column, day-view roll-up, job-card counter)
derives from one source of truth. Rejected alternatives: computing in the React
components (duplicates the rule across the weekly grid, day view, and jobs panel)
and storing carved numbers in the data (breaks are overridable per day, so the
value must stay derived).

### New helpers (`services/crewBreaks.ts`)

```ts
/** Minutes (as hours) of UNPAID FIXED breaks overlapping [startTime, endTime].
 *  Only breaks with a startTime are considered; overlap is the intersection of
 *  [break.start, break.start + duration] with the window. */
export const unpaidFixedBreakHoursInWindow = (
  breaks: CrewBreak[],
  startTime: string,   // 'HH:mm'
  endTime: string,     // 'HH:mm'
): number => { /* sum of intersection durations, /60, round2 */ };

/** Hours of UNPAID FLOATING breaks (no startTime) for a member-day. */
export const unpaidFloatingBreakHours = (breaks: CrewBreak[]): number =>
  round2(sumMinutes(breaks.filter(b => !b.paid && !b.startTime)) / 60);
```

`breakHours` (all breaks) and `paidBreakHours` stay for any remaining callers but
are **no longer used to shrink capacity**.

### Chip-level carve (`services/crewHoursGrid.ts`)

The chip already carries its window (`startTime`/`endTime` from `jobDayWindow`)
and its gross `hours`. `MemberDayCell` gains the breakdown so the UI can render
the net number and the hover explanation:

```ts
export interface MemberDayCell {
  // …existing fields…
  hours: number;            // NET worked hours (gross − unpaid fixed break in window)
  grossHours: number;       // what the user scheduled/typed (for the editor + tooltip)
  unpaidBreakHours?: number; // amount carved out of this chip (0 / omitted when none)
  breakLabel?: string;       // e.g. 'Lunch' — for the tooltip line
}
```

In `buildCrewHoursGrid`, for each chip with a known window, subtract
`unpaidFixedBreakHoursInWindow(dayBreaks, chip.start, chip.end)` from its gross to
get `hours`. When a job-day has multiple line-item chips, a fixed break is
attributed to the chip whose own window contains the break's start time; if none
contains it, no carve (it is in a gap).

### Day / week / capacity (`buildCrewHoursGrid`)

- `weekTotal` (member assigned) = `Σ chip.hours − Σ_day unpaidFloatingBreakHours(dayBreaks)`.
- `capacity` = `baseCapacity` with **no** break subtraction.
- `remaining` / `overCapacity` derive from the new `weekTotal` and `capacity`.
- `dayTotals[key].assigned` = `Σ chip.hours that day − unpaidFloatingBreakHours(dayBreaks)`;
  `capacity` stays the full standard day per non-off member (unchanged).
- `paidHours` redefined to avoid double-counting: worked job hours (which already
  include paid breaks inside windows) **plus** paid break time not already inside
  a counted window. Internal field; not displayed.

### Job-card counter (`buildJobSummaries` / `assignedHoursForJobInWeek`, Image 1)

The `JobSummary.assigned` "46 / 85h" counter must also drop fixed unpaid breaks.
This requires the assigned members' resolved breaks, so thread the member list
and `defaultBreaks` into the summary computation:

- Add a break-aware variant of `assignedHoursForJobInWeek` that, per member-day
  on the job, subtracts `unpaidFixedBreakHoursInWindow` for the job's window that
  day (using each member's resolved breaks).
- Floating breaks do **not** affect job-card counters (rule 3).
- `buildJobSummaries` gains `members: CrewMember[]` and `defaultBreaks` params;
  `buildCrewHoursGrid` passes the members it already has.

## UI changes

- **`EditableHoursChip` / `BreakChip` cell** (`CrewHoursGrid.tsx`): the chip shows
  the net `hours`. When `unpaidBreakHours > 0`, the hover tooltip reads
  `{grossHours}h − {unpaidBreakHours}h {breakLabel} (unpaid)`. The editor opens on
  `grossHours` — the user's input is never rewritten. Existing standalone
  `BreakChip`s in the cell stay (they remain the visible "block of time" for the
  break).
- **`renderCapacity`** (`CrewHoursGrid.tsx`) + **`JobSchedulingView.tsx`**
  capacity readouts: no logic change needed beyond the model now supplying a
  full-day `capacity` and carved `weekTotal`.
- **Day view** (`DayCrewHeader`) inherits carved `dayTotals` automatically.
- **Job card** (`JobsPanel`): inherits the carved `JobSummary.assigned`.

## Edge cases

- **Partial overlap** → intersection minutes only (rule 5).
- **Manual hours + break** → the carve applies to typed numbers too ("always
  carve"); typed `5` with a 0.5h unpaid lunch in-window shows `4.5`, tooltip
  `5h − 0.5h lunch (unpaid)`, editor still opens on `5`.
- **Multiple unpaid fixed breaks in one window** → sum their in-window overlaps.
- **Multiple line-item chips for one job** → fixed break carves from the chip
  whose window contains it; floating stays day-level.
- **Break wholly outside every window** → no effect on worked hours.

## Testing

New unit tests:

- `unpaidFixedBreakHoursInWindow`: fully-inside, in-gap (zero), partial overlap,
  paid (zero), multiple breaks summed, floating ignored.
- `unpaidFloatingBreakHours`: floating unpaid counted; fixed and paid ignored.

`buildCrewHoursGrid` tests:

- Chip `hours` = gross − unpaid fixed break in window; `grossHours` preserved.
- Paid in-window break leaves chip unchanged.
- Floating unpaid break reduces day/week total but not any chip.
- `capacity` = full day (breaks do not shrink it); no false over-capacity on a
  full day with an unpaid lunch.

`buildJobSummaries` test:

- `assigned` drops fixed unpaid breaks inside the job window; ignores floating.

Update existing tests to the new model:

- `services/crewHoursGrid.test.ts` capacity cases (`37.5`, `38`) → full-day
  values now that breaks don't shrink capacity.
- `paidHours` test → new no-double-count definition.

## Affected files

- `services/crewBreaks.ts` (new helpers)
- `services/crewBreaks.test.ts` (tests)
- `services/crewHoursGrid.ts` (`MemberDayCell` fields, chip carve, day/week/
  capacity math, `buildJobSummaries` break-aware assigned)
- `services/crewHoursGrid.test.ts` (new + updated tests)
- `components/views/JobScheduling/CrewHoursGrid.tsx` (chip net + tooltip)
- `components/views/JobScheduling/EditableHoursChip.tsx` (tooltip/breakdown, edit
  on gross)
- `components/views/JobSchedulingView.tsx` (passes members/defaultBreaks if the
  summary signature changes; verify capacity readouts)
- i18n keys for the chip breakdown tooltip
