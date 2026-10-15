# Rescheduling a job does not rewrite its past

## Problem

Two defects, discovered together. The first is silent data loss on **every** move; the second
is the policy question that data loss exposes.

### 1. `hoursAssignments` is never re-keyed, so booked hours vanish

Every mover shifts a shift's dates and re-keys `dailyHours` (and `skipDays`) by the calendar
delta, but leaves `hoursAssignments` keyed to the **old** dates:

- `applyChangeToJob` (`services/scheduleEngine.ts:377`) — all three branches
- `moveAllocation` (`services/shifts.ts:102`)

`App.tsx:204` is the single commit funnel for every reschedule, so this reaches bulk moves,
rain-day, cascade followers, Auto-Fix and drawer moves alike.

`memberShiftDayHours` (`services/crewHoursGrid.ts:126`) then reads:

```ts
if (!allocCoversDay(alloc, dateKey)) return 0;                  // old dates -> 0
const map = alloc.hoursAssignments?.[memberId];
if (map) return map[dateKey] !== undefined ? map[dateKey] : 0;  // new dates -> 0 (stale keys)
return allocWindowHours(alloc, dateKey);                        // never reached
```

The `if (map)` gate is the sting. The map is non-empty — just wrongly keyed — so the
shift-window fallback is skipped and the new days read **0**. Reproduced: a 3-day job with
one member at 8h/day, moved one week out, reads 0h on the old days *and* 0h on the new ones.
`memberIds` survives, so the board shows the job at its new dates with the right crew and
everyone at zero. It looks plausible, which is why it goes unnoticed.

This bites only jobs whose hours were set individually (grid chip or Assign Hours). A job with
no `hoursAssignments` map has no stale keys, so the window fallback works and the move is
clean — which is why it reads as intermittent.

### 2. Nothing protects the past

There is no past-clamping logic anywhere. A job moved backward from August to `2026-06-01`
lands exactly on `2026-06-01` — no refusal, no clamp, no warning. `todayKey()` exists in three
UI files (`SingleJobMoveDrawer.tsx:31`, `CascadeRescheduleModal.tsx:40`,
`SchedulingConfigView.tsx:32`) purely as a date picker's default value: no `min`, no
validation. The only lock is the manual `is_locked` flag.

That matters because **the app has no record of hours worked.** `actualHours` exists only per
`WorkOrderTask` (`types.ts:487`) — not per member, not per day. There are no timesheets. So
`hoursAssignments` on an elapsed day *is* the only record that a member worked 8h last Tuesday.
It is simultaneously the plan and the history, and defect 1 destroys it.

The downstream cost is re-booking: the hours disappear, the member's capacity frees up, the job
reports its full estimate as missing, and already-completed work gets scheduled and paid a
second time. Nothing in the app is inflated — the record is destroyed rather than doubled,
which is harder to notice than a double count would be.

## Decision

Elapsed days are history. They keep their hours and windows; only today-forward days move.

- **Boundary: strictly before today.** Today stays movable — rain arrives at 9am and the admin
  pushes today's work out, which is the most common reason anyone reschedules at all.
- **The gap becomes two shifts.** Pinning the past leaves the job with worked days, then
  nothing, then the moved remainder. Rather than teach a shift to have a hole, the elapsed days
  become their own allocation. No shift ever gains a gap, so `allocCoversDay` and every
  per-shift path work untouched.

Rejected: **refusing the move / clamping to today.** It blocks legitimate corrections (a job
entered on the wrong week) and contradicts the standing principle in this codebase —
availability flags, never blocks.

Rejected: **moving everything.** Honest to the current model, but it silently rewrites last
Tuesday's 8h into next Tuesday's, which is the destruction we are fixing.

Rejected: **pinning on an explicit per-day completion flag.** The most correct answer, but
there is no such field in the model, so it needs new data plus UI to set it plus a backfill.
Out of scope; "worked" here means "elapsed and was scheduled", which is all the model can know.

Rejected: **extending `skipDays` to the job level** to represent the gap in one shift. It would
make `allocCoversDay` no longer the single answer to "is this day worked" — the engine's
cleanest invariant (`scheduleEngine.ts:200`).

## Changes

### 1. `types.ts` — one field on `JobCrewAllocation` (after `skipDays`, ~line 476)

```ts
  /** This shift is history: its days have elapsed and were worked. Never moved, never
   *  re-keyed, read-only in the editor. Set once when a reschedule splits a shift at
   *  today's boundary; never recomputed against the calendar afterwards. */
  pinned?: true;
```

A flag, not a baked-in name like `"Crew (worked)"`: services cannot call `t()`, and the label
has to localise. The UI derives the label from the flag.

An allocation with no `pinned` behaves exactly as it does today, so there is no migration.

### 2. `services/scheduleEngine.ts` — re-key `hoursAssignments` (P1)

All three branches of `applyChangeToJob` re-key `hoursAssignments` alongside `dailyHours`,
using the same `rekey` helper already defined in each branch:

```ts
...(a.hoursAssignments ? { hoursAssignments: Object.fromEntries(
  Object.entries(a.hoursAssignments).map(([memberId, days]) => [
    memberId, Object.fromEntries(Object.entries(days).map(([k, h]) => [rekey(k), h])),
  ]),
) } : {}),
```

The explicit-windows branch (`:381`) sets the span from `change.dailyHours` rather than a
delta, so for re-keying purposes it derives one from `keys[0]` against the allocation's previous
`startDate`. In P1 that previous start is always the real old start; section 4 revises this once
pinning exists.

### 3. `services/shifts.ts` — re-key in `moveAllocation` (P1), and the split (P2)

`moveAllocation` (`:102`) gets the same re-keying, beside its existing `dailyHours` and
`skipDays` re-keys.

New pure function, built on the primitive that already exists — `allocWorkedDayKeys`
(`scheduleEngine.ts:213`):

```ts
splitPinnedPast(
  alloc: JobCrewAllocation, todayKey: string, nonWorkingWeekdays: number[],
): { pinned?: JobCrewAllocation; moving?: JobCrewAllocation }
```

- **no elapsed worked days** -> `{ moving: alloc }`, no split
- **all elapsed** -> `{ pinned: { ...alloc, pinned: true } }`, nothing moves
- **partial** -> both. `pinned` is a clone with a new id, the same `memberIds`, its span
  clamped to `[first, last]` elapsed worked day, and `dailyHours` / `hoursAssignments` /
  `skipDays` filtered to those keys. `moving` is the original with those keys removed and
  `startDate` advanced to the first non-elapsed worked day.

Hours are partitioned, never duplicated: every key lands in exactly one of the two.

### 4. `services/scheduleEngine.ts` — today is injected, never read (P2)

`scheduleEngine.ts:8` promises the engine is pure with no `Date.now()`, and that holds.

```ts
applyChangeToJob(job: Job, change: ProposedChange, opts?: { todayKey?: string }): Job
```

`App.tsx:204` — the single commit funnel — supplies `toLocalDateKey(new Date())`. **Omitting
`todayKey` means no pinning and today's exact behaviour**, so every existing caller and test is
unaffected by P2 and P1 can ship on its own.

`applyChangeToJob` moves only unpinned shifts. `recomputeJobEnvelope` (`:226`) already spans
min-start to max-end across allocations, so it absorbs the split with no change.

**The delta is measured from the first surviving day, not the old start.** This is the one place
a naive implementation goes wrong. Today's code derives the delta from `job.startDate` (or
`alloc.startDate`); after a split that day is pinned history, so reusing it puts the remainder
in the wrong place. Job Aug 17-19, today Aug 19, admin moves it to Aug 24: the delta from
Aug 17 is 7 days, which lands Wednesday's work on Aug 26 — not the Aug 24 the admin asked for.

So: split first, then compute `delta = change.newStart - (first non-elapsed worked day)`, then
apply that one delta to every moving shift. The remainder starts exactly at `newStart`, and
multi-shift relative offsets are preserved. When nothing is pinned the first surviving day *is*
the old start, so this reduces to today's arithmetic exactly.

The explicit-windows branch (`:381`) carries a complete set of new per-day windows rather than a
delta. There, pin first and apply the windows only to the moving shift, dropping any window key
that falls on a pinned day.

### 5. `ProposedChange` — the preview cannot lie (P2)

The same `splitPinnedPast` drives preview and commit, so they cannot diverge.

```ts
  /** Elapsed days this change will keep as worked, rather than move. Descriptive only —
   *  the commit recomputes the split from the same function. */
  pinnedDays?: string[];
```

The preview row reads *"keeps 2 worked days (16h)"*. A job whose every day has elapsed is
reported as `skipped: 'all-past'` — a new `SkipReason` (`:35`) reusing the existing
skipped-row rendering rather than a new empty state.

`pinnedDays` is populated by the preview builders in `JobSchedulingView`, which already hold
`todayKey`; the engine's proposal functions stay pure and unaware of it.

### 6. Job working days come from the shifts (P3)

The phantom-missing number. `requiredHoursForWeek` (`crewHoursGrid.ts:75`) pro-rates by day
count over the **envelope**: `required = estimate * inWeek / total` where
`total = workingDayKeys(job.startDate, job.endDate).length`. A 3-day 24h job pinned Mon/Tue
with Wed pushed to Aug 24 spans Aug 17→24 — six working days, not three — so the week of Aug 17
asks for `24 x 5/6 = 20h` against 16h assigned and falsely reports *"4h missing"*. That is
precisely the prompt that causes re-booking, so P2 without P3 defeats its own purpose.

New in `scheduleEngine.ts`, beside `allocWorkedDayKeys`:

```ts
/** The days a JOB actually works: the union of its shifts' worked days. Falls back to the
 *  envelope for legacy jobs with no dated allocations. */
jobWorkedDayKeys(job: Job, nonWorkingWeekdays: number[]): string[]
```

Repoint the job-level envelope callers: `crewHoursGrid.ts:83`, `:180`, `:199`, `:255`, `:275`
and `scheduleEngine.ts:181`. This strengthens `allocCoversDay` as the single authority on
whether a day is worked rather than adding a rival to it.

### 7. UI — the pinned shift reads as history

`ShiftList.tsx` (already the only consumer of `allocWorkedDayKeys`, `:38`) renders a `pinned`
shift with a localised "Worked" label and no move/edit affordances. New i18n keys under
`views.JobScheduling`.

## Order

| | Scope | Ships alone? |
|---|---|---|
| **P1** | Re-key `hoursAssignments` in `applyChangeToJob` + `moveAllocation` | Yes — pure bug fix, no policy, no model change |
| **P2** | `pinned`, `splitPinnedPast`, injected `todayKey`, `pinnedDays`, `all-past` | Yes, but leaves the phantom-missing number |
| **P3** | `jobWorkedDayKeys` + 6 call sites | Should follow P2 promptly |

P1 is the live data loss and should land first.

## Testing

Every changed unit is a pure function, so TDD throughout.

**P1** — the reproduced regression becomes the first test: a 3-day job with granular hours,
moved a week out, must read its hours on the **new** days and nothing on the old. One case per
`applyChangeToJob` branch (explicit windows, named shift, job-level) plus `moveAllocation`. A
job with no `hoursAssignments` must stay byte-identical in behaviour.

**P2** — `splitPinnedPast`: no elapsed days (no split); all elapsed (`skipped: 'all-past'`);
partial (two shifts, hours partitioned to the right keys, totals preserved). A `pinned` shift
must be provably immune to a second reschedule. `applyChangeToJob` with no `todayKey` must
behave exactly as before — assert against the existing expectations.

The delta rule gets its own case, because it is the likely bug: job Aug 17-19, today Aug 19,
moved to Aug 24 — the surviving day must land on **Aug 24**, not Aug 26.

**P3** — `requiredHoursForWeek` on a gapped job must use worked days, not the envelope
(`24 x 2/3` for the Aug 17 week, not `24 x 5/6`). A legacy job with no dated allocations must
be unchanged.

**Components** — the preview row's "keeps N worked days" copy; `ShiftList` rendering a pinned
shift read-only.

## Out of scope

- Per-day completion flags or timesheets.
- Any clamping or refusal of past dates.
- Per-member, per-day working windows — a member leaving early on one day still cannot be
  expressed (the window lives on the shift; `allocDayWindow` takes no `memberId`). Separate
  design.
