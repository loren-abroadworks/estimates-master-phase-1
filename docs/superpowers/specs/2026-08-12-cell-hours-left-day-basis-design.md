# Connect the grid cell's "hours left" to the crew picker's weekly figure

## Problem

The per-day caption under each hours cell in the crew/hours grid and the weekly figure in
the crew transfer picker are measured against different yardsticks, so they never agree.

- Cell (`CrewSelectionModal.tsx:659`): `capacity = defaultDailyHours` — the *shift window*.
  A 4h window filled with 4h reads "0h left" no matter how open the person's day is.
- Picker (`CrewTransferPicker.tsx:59` → `computeWeeklyHours`): `capacity = standardDay` per
  working day, minus everything committed elsewhere. The same member reads "32h left".

A scheduler looking at "0h left" in every cell while the picker says "32h left" cannot tell
which number to trust.

## Decision

The cell caption answers **"how much of this person's day is left"**, on the same basis the
weekly figure is built from: a standard working day, net of other jobs and this cell.

`computeDayConflict` already computes exactly this comparison (`elsewhere + cellHours` vs.
`standardDay`) to raise the orange triangle. The caption simply starts using it, so the two
signals in a cell stop contradicting each other.

## Changes

### 1. `services/shiftCapacity.ts` — widen `computeDayConflict` into `computeDayLoad`

One call per cell returns the whole day picture:

```ts
export const computeDayLoad = (
  member: CrewMember,
  dayKey: string,
  jobs: Job[],
  cellHours: number,
  opts: { standardDay?: number; excludeJobId?: string; excludeAllocationId?: string } = {},
): { capacity: number; elsewhere: number; used: number; left: number; over: number }
```

- `capacity` — `isOffOn(member, dayKey) ? 0 : standardDay`
- `elsewhere` — `committedHoursOnDay(member, jobs, dayKey, opts)`
- `used` — `elsewhere + cellHours`
- `left` — `max(0, capacity - used)`
- `over` — `max(0, used - capacity)`; identical to the old `overBy`, so flag behaviour is unchanged

`computeDayConflict` is replaced (single call site). `elsewhere` keeps its name and meaning
for the conflict tooltip.

### 2. `components/modals/CrewSelectionModal.tsx` — cell caption

The caption under the input reads, in order: day off → `over > 0` → `left`.

| case (4h shift window, 8h day) | before | after |
| --- | --- | --- |
| day off | "Day off" | "Day off" |
| 4h here, 0h elsewhere | "0h left" | "4h left" |
| 4h here, 4h elsewhere | "0h left" + flag | "0h left" + flag |
| 4h here, 6h elsewhere | "0h left" + flag | "2h over" + flag |

The shift-window overflow (`numAssigned > defaultDailyHours`) still drives the triangle and
its tooltip, so typing 6h into a 4h window remains called out — but as a flag, not as the
caption. `flagged = load.over > 0 || overWindow > 0` is unchanged.

### 3. What now reconciles

A row's daily `left` values sum to that row's weekly meter, which is the same
`computeWeeklyHours` call the picker uses (`shiftCapacity.ts:81`). Mike Smith with 8h
assigned: cells read "8h left" on untouched days, weekly meter reads `8/40h · 32h free`,
picker reads `8/40h · 32h left`.

### 4. `components/modals/CrewTransferPicker.tsx` — count the draft

Found while verifying the above: the picker and the grid's WEEKLY CAPACITY column disagreed
even though both showed a 40h capacity. The picker called `computeWeeklyHours` directly, which
sums only *saved* commitments, while the grid calls `computeWeeklyCapacity` — the same figure
plus the editor's draft hours. A member with 8h on another job and 13h typed into the open
shift read `21/40h` in the grid and `8/40h` in the picker.

The picker now calls `computeWeeklyCapacity` with the modal's `hoursAssignments` draft and
`excludeAllocationId`, so it renders the same number as the column beside it. `excludeAllocationId`
also stops the saved copy of the shift being edited from being counted alongside the draft —
the picker was missing that opt entirely, so re-opening it on an existing shift double counted.

### 5. One daily-capacity basis across views

The shift editor hardcoded `STANDARD_WORK_DAY_HOURS = 8`, while everything in Job Scheduling
runs on `capacityHours` — `settings.scheduling.crewDailyCapacityHours`, else the configured
work-day window (08:00–17:00 → 9h). So the crew hours grid showed `20/45h` where the editor
showed `21/40h` for the same person and week.

`CrewSelectionModal` now takes a `dailyCapacityHours` prop (default 8 for callers that don't
know the setting, e.g. `WorkOrderView`), and both Job Scheduling call sites pass
`capacityHours`. It feeds every per-person figure at once: the weekly meter, the crew picker
badge, and each cell's hours left.

One knock-on: on a 9h configured day, a full 9h cell no longer reads "1h over" — it reads
"0h left", because 9h *is* that member's day. The accepted consequence noted below only
applies where the configured day is shorter than the shift window.

### 6. Wording

Remaining capacity was called "free" in three places (`CrewHoursGrid`, `DayCrewHeader`, the
`JobSchedulingView` crew column) and "left" in two (cell captions, crew picker). All five now
read **"Xh left"** — same number, same name, in every view. Done as manual catalog overrides
in `i18n/catalog.ts` (which takes precedence over `catalog.generated.ts`) for `en` and `es`.

### 7. The real divergence: fabricated fallback hours

Capacities matched after §5, but the *assigned* sides still differed (20h vs 45h for the same
member and week). Measured against the app's own mock data, `committedHoursOnDay` was
inventing hours:

| day | crew hours grid | shift editor (before) |
| --- | --- | --- |
| one 4h morning shift | 4 | **9** (a whole standard day) |
| two 4h shifts | 8 | **18** (a standard day *per allocation*) |

Two bugs in one fallback (`crewWeeklyHours.ts:47`):

1. With no granular `hoursAssignments`, it added `standardDay` instead of the length of the
   window the member is actually scheduled in — and added it once per allocation, so a
   split day scaled past 24h.
2. With a granular map present but no entry for that day, it fell through to the same
   `standardDay` branch, so an itemized member was charged a full day for days they were
   explicitly not working.

`crewHoursGrid` already had this right. The window-length helpers moved down into
`crewWeeklyHours` (`allocWindowHours`, `jobWindowHours`) and `committedHoursOnDay` now uses
them, with the granular map authoritative. `crewHoursGrid` imports them instead of keeping
its own copies, so there is one definition rather than two that can drift again.

This is the fix that actually made the two views agree; §1–§6 were necessary but not
sufficient. It also corrects every other consumer of `committedHoursOnDay` — the all-crew day
chip and each cell's conflict flag were reading the same fabricated hours.

## Accepted consequences

- A 9h default shift window (08:00–17:00) filled to 9h reads "1h over" instead of "0h left".
  The triangle already fires there today (`9 - 8 = 1`), so this only removes the
  contradiction between flag and caption.
- Weekend and off-schedule days still get a full `standardDay` capacity in the cell, while
  weekly capacity excludes weekends. A Saturday shift therefore pushes the weekly meter over
  — correct, it is overtime — but that row's daily figures won't sum to the weekly one.

## Tests

- `services/shiftCapacity.test.ts` — `computeDayLoad`: off day (capacity 0), elsewhere only,
  exactly full, over by other jobs, `excludeJobId` honoured.
- `components/modals/CrewSelectionModal.test.tsx:176-186` — cell captions move to the day
  basis (a 9h cell in an 8h day reads "1h over"; 4h reads "4h left").
