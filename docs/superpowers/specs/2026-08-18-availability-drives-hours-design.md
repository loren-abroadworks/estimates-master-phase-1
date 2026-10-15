# Availability drives a member's hours

Date: 2026-08-18

## The problem

A member's schedule in settings (`AddEmployeeModal`, and the per-day availability
editor on the scheduling screen) is the statement of when that person works. Job
Scheduling largely ignores it.

Today:

- **A half day books a full shift.** A member scheduled 8am–12pm on a shift running
  8am–5pm still shows 9h on the chip, because implicit hours come from the shift's
  window and nothing consults the person.
- **Capacity ignores the window.** `computeWeeklyHours` credits `standardDay` for
  every day that isn't marked off, so the `25 / 54h` readout counts a half day as
  a whole one. `computeDayLoad` does the same for the crew picker's day caption.
- **An off day hides the work.** `CrewHoursGrid` replaces an off day's cell contents
  with the word "Off", so hours already booked there become invisible — the
  scheduler can neither see nor fix them.

The crew picker (`CrewSelectionModal`) already does the right thing on the *flagging*
half: an amber input plus tooltip lines reading `Off` and `Outside 8am–5pm`, via
`windowOutsideAvailability`. That treatment should reach the scheduling grid, and the
hours themselves should follow the schedule.

## What we're building

1. **One availability primitive** every per-person figure reads, so a half day means
   the same number on every screen.
2. **A trim on save.** Changing a member's schedule rewrites the job bookings that no
   longer fit — with a toast, an Undo, and an activity-log entry.
3. **Override, flagged.** After the trim, hours a scheduler types are kept exactly as
   typed. The grid marks them amber and says why: off that day, or outside their hours.

Non-goals: blocking an assignment, changing job dates, or touching the Day-view
timeline's own blocks.

## 1. The availability primitive

`services/crewAvailability.ts` gains:

```ts
export const availableHoursOn = (
  member: CrewMember,
  dayKey: string,
  standardDay: number,
  defaultBreaks: CrewBreak[] = [],
): number
```

- **No schedule entry for that day → `standardDay`.** This matters: without it,
  deriving hours from the fallback window (08:00–17:00 = 9h) would silently move every
  untouched member's capacity from 40h to 45h. Only a schedule the user actually set
  changes their hours.
- **Entry with `isOff` → 0.**
- **Entry with a window → `workingDayCapacity(windowLength, resolveBreaks(entry, defaultBreaks))`**
  — the window less its unpaid breaks. That is the same yardstick `standardDay` itself
  is built from (`capacityHours` in `JobSchedulingView` is the company window minus
  unpaid breaks), so 8am–5pm with an unpaid hour lunch stays 8h, exactly as today, and
  8am–12pm becomes 4h.
- Entry present but missing times → `standardDay`.

Consumers repointed at it:

| Function | Today | After |
|---|---|---|
| `crewWeeklyHours.computeWeeklyHours` | `capacity += standardDay` unless off | `capacity += availableHoursOn(...)` |
| `shiftCapacity.computeDayLoad` | `isOffOn ? 0 : standardDay` | `availableHoursOn(...)` |
| `crewHoursGrid.buildCrewHoursGrid` day totals | `row.offByDay[key] ? 0 : standardDay` | `availableHoursOn(...)` |

Both changed functions take an options bag already; `defaultBreaks` is threaded in
through it, defaulting to `[]` so existing callers keep compiling and existing
behavior holds for members with no schedule entries.

`shiftCapacity.memberDayCapacity` is deliberately left alone: it measures the *shift
window*, which is a statement about the job, not the person.

## 2. The trim on save

New pure service `services/availabilityTrim.ts`:

```ts
export interface BookingTrim {
  jobId: string; jobNumber: string; shiftId?: string;
  memberId: string; dateKey: string;
  from: number;  // hours before
  to: number;    // hours after (0 = booking removed)
}

export const availabilityTrims = (
  jobs: Job[], next: CrewMember, prev: CrewMember | undefined,
  defaultBreaks: CrewBreak[],
): BookingTrim[];

export const applyAvailabilityTrims = (
  jobs: Job[], trims: BookingTrim[], weekendDays: number[], standardDay: number,
): Job[];
```

**Only days whose schedule entry actually changed are considered.** A name or photo
edit produces no trims; a day the user never touched is never rewritten. The
comparison is a shallow compare of `prev.schedule?.[k]` against `next.schedule?.[k]`
over the union of both key sets.

For each changed day, for each booking the member holds that day (one per allocation,
via `memberShiftDayHours`), with `win` = that allocation's window for the day:

| New state of the day | Result |
|---|---|
| Off | `to: 0` — the booking is removed |
| Window overlaps the shift partially | `to: min(from, overlapHours)` |
| Window doesn't overlap the shift at all | **no trim** — hours kept, flagged in the grid |
| The day's entry was **deleted** | **no trim** — a cleared entry makes no statement about the member |
| `to === from` | no trim emitted |
| The job is locked | **no trim** |

The asymmetry between the first and third rows is deliberate. Being off is a statement
about the whole person-day, so zeroing the day is what the user asked for. A
non-overlapping window is a statement about where the *shift* sits — deleting an
entire booking over it would be too destructive for a settings save, and the amber flag
already makes it impossible to miss.

`overlapHours` is the intersection of the two windows, less the unpaid breaks inside
it, so it stays on the same footing as every other capacity figure.

`applyAvailabilityTrims` groups trims by job and folds each job's trims through
`setMemberDayHoursPreservingSpan`, producing one new `Job` per affected job. Chaining
matters: separate writes to the same job would clobber each other.

## 3. Wiring

Both schedule-editing paths — `AddEmployeeModal` in settings and
`EditAvailabilityModal` / the break editor inside `JobSchedulingView` — funnel through
App's `onEditEmployee`. That single funnel is where the trim goes; App also owns
`jobs`, `showToast`, and `logActivity`.

`App.tsx` grows `handleEditEmployee(emp)`:

1. Resolve `prev` from `employees`, compute `availabilityTrims(jobs, emp, prev, …)`.
2. `setEmployees` as today.
3. When there are trims: snapshot the affected jobs, `setJobs(applyAvailabilityTrims(…))`,
   `logActivity` with the affected job ids, and `showToast` with an Undo that restores
   the snapshot. The availability change itself stays; Undo restores only the hours,
   which then read as an override and show amber. That is the same state a scheduler
   would reach by typing the hours back in, so Undo needs no special case.

Toast copy: `Trimmed {count} bookings to {name}'s hours` (singular variant for one).

## 4. Flags in the grid

`MemberDayCell` gains three optional fields, all derived in `buildCrewHoursGrid`:

- `onOffDay?: boolean` — the member is off that day.
- `outsideAvailability?: { before: number; after: number }` — from the existing
  `windowOutsideAvailability(avail, chipWindow)`, when any part of the chip's window
  falls outside their hours.
- `overAvailableHours?: number` — hours beyond `availableHoursOn` for that day, i.e.
  the volume override (9h typed on a 4h day).

`MemberRow` gains `availableHoursByDay: Record<string, number>`, which the day-total
capacity also reads, so the column footer and the chips can never disagree.

Rendering in `CrewHoursGrid`:

- **An off day stops hiding its chips.** The cell shows a small `Off` badge (the
  reason as its tooltip) *and* the chips below it. An off day with no chips looks
  exactly as it does today.
- A flagged chip gets an amber ring on its hours field and tooltip lines naming the
  reason, reusing the crew picker's wording: `Off` / the reason, and
  `Outside 8am–12pm`. `EditableHoursChip` takes one optional `flags` prop; when absent
  it renders precisely as now, so the Day-view timeline is unaffected.
- An off cell still refuses a drag-transfer drop, as it does today: the flag is for
  hours that are already there, not an invitation to add more.

New i18n keys (en + es), following the picker's existing strings:
`views.JobScheduling.CrewHoursGrid.offBadge`,
`views.JobScheduling.EditableHoursChip.outsideWorkWindow`,
`views.JobScheduling.EditableHoursChip.offThatDay`,
`views.JobScheduling.EditableHoursChip.overAvailable`,
`App.trimmedBookings` / `App.trimmedBooking`.

## Testing

Per service, tests first:

- **`crewAvailability`** — `availableHoursOn`: no entry → `standardDay`; off → 0;
  8–12 → 4; 8–5 with an unpaid hour lunch → 8; entry missing times → `standardDay`.
- **`crewWeeklyHours`** — weekly capacity across an off day, a half day, and a day with
  no entry in one week.
- **`shiftCapacity`** — `computeDayLoad` capacity on a half day.
- **`availabilityTrim`** — off → removed; half day → trimmed to the overlap; no overlap
  → untouched; unchanged days → no trims; a profile-only edit → no trims; two trims on
  one job → one `Job` result carrying both.
- **`crewHoursGrid`** — the three cell flags; day-total capacity from availability.
- **`CrewHoursGrid.test.tsx`** — an off day renders its chips *and* the Off badge; a
  chip outside the member's hours renders its warning.

Existing suites (751 tests) must stay green. Where a capacity figure legitimately
changes, the test is updated with a comment saying why — and the "no schedule entry →
`standardDay`" rule is what keeps that list short.

## Risks

- **The settings editor writes a 08:00–17:00 entry for every weekday it shows.** Once a
  member is saved through it, their days have explicit entries, so their capacity comes
  from the window-minus-breaks path rather than `standardDay`. With the company default
  window and default breaks these agree; if a company configures `crewDailyCapacityHours`
  by hand to something that isn't its window minus breaks, that member's capacity will
  shift to the derived figure. Acceptable: the derived figure is the more truthful one,
  and it is what the schedule the user typed actually says.
- **The trim is a real data write.** It is scoped to changed days and to the saved
  member's own bookings, carries an Undo, and lands in the activity log.
