# A shift is a range plus the days it skips

## Problem

A shift can only be scheduled as a contiguous range with one window for every day in it.
The editor (`CrewSelectionModal.tsx:534-543`) offers START DATE, END DATE, and a single
default Start/End Time, so a scheduler cannot say:

- **"Aug 19-21, but nothing on the 20th"** — a rain day, a crew that's out, materials that
  haven't landed. Today the only way to express it is to split the shift in two and re-crew
  the second one.
- **"Wed 8-5, but Fri only 7-12"** — per-day windows already exist in the model
  (`JobCrewAllocation.dailyHours`, read by `allocDayWindow` at `scheduleEngine.ts:193`) and
  `services/shifts.ts:61` already has `setAllocDayWindow` to write them. **No editor exposes
  them, and `handleSave` (`CrewSelectionModal.tsx:341`) doesn't even persist the field.**
  The capability is built and unreachable.

## Decision

A shift stays a range and gains a list of days inside that range it does **not** work.
Per-day times keep using `dailyHours`. Both are edited in one day list under Shift dates.

```ts
skipDays?: string[];   // local 'YYYY-MM-DD' keys inside [startDate, endDate] the shift skips
```

Rejected: making the shift an explicit `days: Record<dateKey, window>` set. It is the cleaner
idea, but ~140 non-test reads of `alloc.startDate`/`endDate`/`startTime`/`endTime`/`dailyHours`
span 18 files, so the old fields
would survive as derived mirrors — two representations plus a sync invariant, for no behaviour
the skip list can't express. Rejected: one shift per contiguous block (no model change) — a
two-week job with weekends off becomes three shifts to keep in crew-sync by hand.

A shift with no `skipDays` behaves exactly as it does today, so there is no migration.

**Multiple blocks fall out of this.** Aug 19-20 + Aug 25-26 as one shift is the range Aug
19-26 skipping 21-24. Weekends fall out too: a bulk action that adds the weekend keys.

## Changes

### 1. `types.ts` — one field on `JobCrewAllocation` (after `dailyHours`, ~line 469)

```ts
  /** Days inside [startDate, endDate] the shift does NOT work, as local 'YYYY-MM-DD'.
   *  Absent/empty = every day in the range is worked (the pre-skip behaviour). */
  skipDays?: string[];
```

### 2. `services/scheduleEngine.ts` — `allocCoversDay`, the single choke point

Added beside `allocDayWindow` (line 193), since every caller of one wants the other:

```ts
export const allocCoversDay = (alloc: JobCrewAllocation, dateKey: string): boolean =>
  !!alloc.startDate && !!alloc.endDate &&
  dateKey >= alloc.startDate && dateKey <= alloc.endDate &&
  !alloc.skipDays?.includes(dateKey);
```

It replaces every hand-written range check on an allocation:

| Site | Note |
|---|---|
| `crewHoursGrid.ts:95` (`memberJobDayHours`) | guard must move **before** the `hoursAssignments` lookup |
| `crewHoursGrid.ts:117` (`memberShiftDayHours`) | same |
| `crewWeeklyHours.ts:70` (`committedHoursOnDay`) | same |
| `CrewSelectionModal.tsx:288` (conflict scan) | same |

**The ordering is the whole point of this section.** All four sites consult the granular
`hoursAssignments` map *first* and only fall back to the range when a member has no granular
entry — the map is treated as authoritative. Left as-is, a skipped day keeps billing its
per-member hours, and the scheduler sees a day marked off whose numbers never moved. Each
site becomes: not covered → contributes 0, before any map lookup.

### 3. Guard, don't purge

Skipping a day leaves its `dailyHours` and `hoursAssignments` entries untouched. Re-checking
the day restores its custom window and per-member hours instead of silently destroying them,
which matters because the common case is a rain day that later comes back. `allocCoversDay`
is what makes those entries inert, so it is the only thing standing between stored hours and
counted hours — hence one predicate, used everywhere, rather than four inline checks.

### 4. `services/productionBoard.ts` + `services/monthBoard.ts` — bars with holes

`BoardCard` (line 4) gains `skipDays?: string[]`, populated by both card builders
(`boardShifts:124`, `monthBoard.ts:58-70`) from the allocation. Occupancy consults it:

```ts
const cardOccupies = (card, dayKey, config) =>
  !card.skipDays?.includes(dayKey) &&
  occupiesWorkingDay(`${card.startKey}T12:00:00`, `${card.endKey}T12:00:00`, dayKey, config);
```

and the same guard at `monthBoard.ts:83`. `dayBoard.ts` reads windows from lanes that are
already occupancy-filtered, so it needs no change.

Occupancy alone is not enough, though. `layoutLaneBars` (`productionBoard.ts:229`) groups a
shift's occupied columns and spans `min(idxs) … max(idxs)`, so a hole is **bridged** into one
continuous bar — the day would be empty in `cardsByDay` while the bar still painted over it.
It now emits one bar per RUN of consecutive columns. Without holes that is exactly one bar
per job, as before.

This also changes an existing case: `visibleWeekDays` filters weekends but NOT holidays,
while `occupiesWorkingDay` returns false on a holiday — so a mid-week holiday inside a job's
span already left a hole that was already being bridged. Those bars now split too, which is
the more truthful rendering (the job does not work the holiday) but is a behaviour change
beyond skipped days.

### 5. `components/views/JobScheduling/JobDetailsPanel.tsx` — Actual Schedule

`jobActualSchedule` already omits days no shift covers; its `a.startDate <= key && key <=
a.endDate` filter becomes `allocCoversDay(a, key)`. Skipped days then disappear from Daily
Hours, and the row count matches the editor's day count.

### 6. `services/shifts.ts` — normalize on write, re-key on move

A new `normalizeAlloc(alloc)` runs inside `patchAlloc`/`upsertAllocation`:

- **Trim the envelope inward** to the first and last *included* day. A skipped boundary day
  makes `recomputeJobEnvelope` (`scheduleEngine.ts:202`) read boundary times off a day nobody
  works, and makes the board bar start on a hole.
- **Drop skip keys outside** `[startDate, endDate]`, so shrinking the range later can't
  resurrect a skip.

`moveAllocation` (line 79) already re-keys `dailyHours` by the day delta; `skipDays` must be
re-keyed by the same delta in the same place, or a dragged shift skips the wrong calendar day.

`setAllocSpan` (line 57) keeps its signature; normalization handles the fallout.

### 7. `components/modals/CrewSelectionModal.tsx` — the day list

Under Shift dates, one row per **worked** day: `Wed, Aug 19`, start/end time inputs, that
day's hours, and a trash control. **Skip weekends** (from the `weekendDays` prop the modal
already takes) is the only bulk action.

A day is either part of the shift or it isn't — there is no "off but still listed" state, so
a removed day gets no row. Removing a boundary day pulls the date range in (there is no skip
to record); removing an interior day records a skip, since the range still spans it. Both go
through `normalizeAlloc`, so the date pickers can never disagree with the list. Removing the
last remaining day is disabled: it would leave a shift working nothing, recoverable only by
widening the dates.

Shift-level Start/End Time inputs are gone — the day list is the only place times are set.
On save every worked day gets an explicit `dailyHours` window, and the shift's own
`startTime`/`endTime` follow its first and last worked day.

```
┌─ Shift dates ───────────────────────────── 2 days ─┐
│ START DATE            END DATE                     │
│ [ 8/19/2026     📅 ]  [ 8/21/2026     📅 ]         │
│                                                    │
│ DAYS                              Skip weekends    │
│ ┌────────────────────────────────────────────────┐ │
│ │ Wed, Aug 19   [08:00 AM] – [05:00 PM]  9.0h  🗑 │ │
│ │ Fri, Aug 21   [07:00 AM] – [12:00 PM]  5.0h  🗑 │ │
│ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

- Two new pieces of draft state: `skipDays: string[]` and `dayHours: Record<key, window>`,
  seeded from `allocationToEdit.skipDays` / `.dailyHours` in the open effect (line 155-170)
  and reset with it.
- A day row's time inputs show the shift default until edited; editing writes a `dayHours`
  entry. Left-column Start/End Time are relabelled as the **default** for days without an
  override (they already carry `defaultStart`/`defaultEnd` i18n keys).
- The `3 days` badge (`dayCountLabel`, line 386) counts **included** days; the stats header's
  "Scheduled for" (line 509) follows.
- `handleSave` (line 341) persists `skipDays` and `dailyHours` — the latter is a bug fix in
  its own right, since today the field is silently dropped on every save.
- The crew×day grid greys skipped columns and zeroes their cells, so the hours consequence is
  visible where the numbers are.
- Every day skipped → Apply disabled with an inline message, rather than saving a zero-day
  shift. `dateRange` keeps its 60-day cap (line 213), so the list is bounded.
- The day list is its own component (`ShiftDayList`) rather than more inline JSX: the modal is
  758 lines already, and a pure day list is testable on its own.

## Testing

Pure functions carry the weight:

- `allocCoversDay` — inside range, boundary days, skipped day, undated shift, no `skipDays`.
- The capacity guard beating the `hoursAssignments` short-circuit — a member with granular
  hours on a skipped day contributes 0 to `memberShiftDayHours`, `memberJobDayHours` and
  `committedHoursOnDay`. This is the regression most likely to be shipped silently.
- `normalizeAlloc` — skipped boundary day trims the envelope; out-of-range skip keys dropped.
- `moveAllocation` — `skipDays` re-keyed by the same delta as `dailyHours`.
- `boardShifts`/`monthBoard` — a skipped day yields no card on that day and cards on both
  sides of the hole.
- `jobActualSchedule` — skipped days absent from Daily Hours.

Component tests for `ShiftDayList`: toggling a day, editing one day's times, Skip weekends,
all-off disabling Apply. One `CrewSelectionModal` test that a save round-trips `skipDays` and
`dailyHours`.

## Out of scope

**Conflict detection still reasons over the job envelope.** `rescheduleIssues.ts:110` and
`resolveSameDayConflicts.ts:183` test `occupiesWorkingDay(other.startDate, other.endDate, …)`
— the job's span, not its shifts' days — so a skipped day can still read as occupied in an
overlap warning. That coarseness already exists for any multi-shift job with a gap between
shifts; making conflicts shift-aware is a larger, separate change and is deliberately not
bundled here.

Per-crew-member skipping ("Mike works Wed and Fri, Sara only Wed") is already expressible
through `hoursAssignments` and needs nothing new.
