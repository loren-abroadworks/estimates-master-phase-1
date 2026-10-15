# Shift-Granular Cascade (Crew-Timeline Conflict Resolver) — Design

**Date:** 2026-07-11
**Status:** Approved (design)
**Piece:** B of 2. Piece A (shift-native reschedule sidebar) is a **prerequisite** for the
sidebar trigger and is specced separately. The resolver engine in this doc can be
built and unit-tested independently of A; only the sidebar *trigger* depends on A.

## Problem

Cascade today is **job-granular**: moving a shift can trigger a cascade, but the
things that move downstream move as whole *jobs*, and the conflict it avoids is
reasoned at job granularity. Users think about scheduling per **crew member's time**:
if one person is booked on two shifts whose clock windows overlap on the same day —
whether those shifts are on the same job or different jobs — that's a real conflict,
and the blocking shift (not the whole job) should move out of the way, with anything
that move newly clashes with moving too.

### Worked example (the intent)

```
John's day (before):   Shift A ███ 7–10am        Shift B ██████ 11am–4pm
Move Shift A → 2–4pm:                     Shift A ███ 2–4pm
                                    Shift B ██████ 11am–4pm   ← John now double-booked 2–4pm  ✗
Resolve: re-place Shift B into conflict-free time; then anything the moved
         Shift B newly clashes with; and so on (the chain).
```

Only John is shared between the two shifts, but the *whole* Shift B (all its crew)
moves as a unit — a shift moves atomically. Shift A stays where the user dropped it.

## Root cause of the gap

The building blocks already exist — they just operate at job granularity:

- **Conflict-free placement + shared-crew bumping** lives in
  `reflowAvoidingConflicts` (`services/scheduleEngine.ts`): it pins a job's day
  windows, keeps its total hours, places leftover hours into **conflict-free clock
  time**, is **shared-crew aware** (via a `scopeOf` callback), and **bumps blocking
  shared-crew jobs forward**. The Smart/Simple behavior is the `keepExistingDaysAsIs`
  option.
- **Clock-interval math**: `jobClockWindowOnDay`, `occupiedIntervals`,
  `freeIntervals`, `placeAfterConflictFree`.
- **Per-day shift windows**: `allocDayWindow(alloc, dateKey)`.
- **Envelope recompute**: `recomputeJobEnvelope(job)`.
- **Shift crew scope**: `shiftCrewScope(job, shiftId)` (added in Phase 5).
- **Double-book detection** (job grain): `rescheduleIssues.ts` already checks
  "shared member AND overlapping hours that day".
- **Per-shift apply**: `ProposedChange.shiftId` + `applyChangeToJob`'s shift branch
  (Phase 5) move a single allocation and recompute the envelope.

So the model, the clock math, the shared-crew reflow, and the per-shift apply all
exist. What's missing is a resolver that reasons at **shift granularity across a
crew member's whole timeline** and drives those primitives.

## Decisions (from brainstorming)

1. **Conflict definition:** a crew member whose shift windows overlap in clock time
   on the same calendar day — pooled across **every shift on every job** they're in
   (their personal timeline). Not "same day" — *overlapping hours*.
2. **Cross-job:** shifts on different jobs sharing a member are checked exactly like
   two shifts on one job. The unit of truth is the member's timeline, job-agnostic.
3. **Gated by the existing "Cascade following jobs" toggle:**
   - **ON** → auto-resolve the chain (bump conflicting shifts).
   - **OFF** → apply only the moved shift, relocate nothing else, but show a
     **non-blocking warning** listing any resulting crew clashes; the user may
     proceed regardless (mirrors today's warning behavior).
4. **Anchor:** the shift the user moved is **pinned** — the resolver never relocates
   it; everything else reflows around it. (Without this, the resolver could "solve"
   a clash by undoing the user's move.)
5. **Placement consistency:** a displaced shift is re-placed with the **same reflow
   policy the page already uses** (Smart/Simple + "Keep existing days as-is"). No new
   placement behavior is invented. Consequence: a bumped shift can land **earlier in a
   day** when Smart packing finds room there; it spills to later working days only when
   forced. "Forward" is the fallback, not a hard rule.
6. **Triggers (all through the shared preview + cascade flow):**
   - Week board — drag a shift to new **dates**.
   - Day board — drag a shift block to a new **time** (*behavior change*: a drag now
     stages the move so the resolver can run, instead of writing instantly; the
     instant path is kept when cascade is OFF).
   - Sidebar **DAILY HOURS** — edit a shift's per-day times (**depends on Piece A**).

## Approach

**Chosen — Approach 2: a new shift-level resolver that reuses an extracted placement
core, leaving the job-cascade path untouched.**

Rejected:
- *Approach 1 (generalize the job engine to shifts in place):* highest blast radius —
  `reflowAvoidingConflicts` drives the current, heavily-tested job cascade; rewriting
  its unit-of-work in place risks regressing behavior users already rely on.
- *Approach 3 (full resource-timeline constraint solver):* overkill and would diverge
  from the exact Smart/Simple reflow behavior we deliberately want to stay consistent
  with.

## Design

### 1. Shared placement core (the one extraction)

Extract the innermost logic of `reflowAvoidingConflicts` — *"given a unit's pinned
per-day windows, its required hours, the occupied clock intervals per day for the
relevant crew, and the policy (`keepExistingDaysAsIs`, `untilDate`, working-time
config), place the hours into conflict-free clock time"* — into a shared, exported
helper:

```
placeHoursConflictFree(
  pinnedDayHours: Record<dateKey, {startTime, endTime}>,
  requiredHours: number,
  occupiedByDay: (dateKey) => ClockInterval[],   // the crew's busy intervals that day
  config: WorkingTimeConfig,
  opts: { keepExistingDaysAsIs?: boolean; untilDate?: string; fromKey: string },
): { dayHours: Record<dateKey, {startTime, endTime}>; unplaced: number }
```

`reflowAvoidingConflicts` is refactored to call it (behavior-preserving). The new
resolver calls the *same* helper — so Smart/Simple/keep-existing behavior is identical
**by construction**, not re-implemented. **Guardrail:** the existing
`reflowAvoidingConflicts` tests must stay green through the refactor; that is the proof
the extraction changed nothing.

### 2. Crew-timeline model & conflict detection

New module `services/shiftCascade.ts`:

- `ShiftOccurrence = { jobId, shiftId, dateKey, startMin, endMin }` — one shift on one
  day, clock window resolved via `allocDayWindow`.
- `buildMemberTimelines(jobs): Map<memberId, ShiftOccurrence[]>` — enumerate every
  dated shift on every schedulable job, expand across each shift's working days, group
  by member. **This is the "personal timeline."**
- `occurrencesClash(a, b): boolean` — same `dateKey`, clock intervals overlap
  (two windows overlap when each starts before the other ends).
- `clashesWith(target, timelines, excludeShift): ShiftRef[]` — the shifts (excluding a
  set of pinned/resolved shift ids) that overlap `target` on any shared member's
  timeline.

### 3. Resolver (`resolveShiftCascade`)

```
resolveShiftCascade(
  jobs: Job[],
  moved: { jobId, shiftId, newStartKey, newDayHours },   // the anchor, already placed
  config: WorkingTimeConfig,
  opts: { keepExistingDaysAsIs?: boolean; untilDate?: string },
): { changes: ProposedChange[]; residual: ResidualClash[] }
```

Algorithm:

1. Treat `moved`'s new position as **pinned**; seed a `pinned` set with its shift id
   and a `workQueue` with the moved shift.
2. Rebuild member timelines reflecting all pinned placements.
3. For the shift at the front of the queue, find `clashesWith(...)` against members it
   shares, excluding pinned shifts.
4. For each clashing shift, in **earliest-start-first** order, re-place it via
   `placeHoursConflictFree` — its occupied intervals are the union of the pinned
   shifts' intervals for that shift's crew. Honor Smart/Simple + `untilDate`.
   - If placed: record a per-shift `ProposedChange` (carrying `shiftId`), add its id to
     `pinned`, and enqueue it (its new spot may clash with others → the chain).
   - If it cannot be placed on/before `untilDate` / project end: leave it in place and
     record a `ResidualClash` (surfaced as a warning, like today's protected/leapfrog).
5. Continue until the queue drains. A **visited-set** (shift id → last placed start)
   guarantees termination: a shift is only re-placed if the new placement differs and
   makes forward progress within the pass.

Ordering (earliest-start-first) and the pinned/visited discipline keep the result
deterministic.

### 4. Change model — multi-shift-per-job

`resolveShiftCascade` can move **several shifts on one job** (e.g. Prep bumps, which
then bumps Finish). Today `App.applyScheduleChanges` matches **one change per job by
`jobId`** (`changes.find(...)`).

**Change:** allow **multiple `ProposedChange`s with the same `jobId` and distinct
`shiftId`**, and make `applyScheduleChanges` **fold all changes for a job** — apply
each shift edit in turn (each via `applyChangeToJob`'s shift branch, which recomputes
the envelope). Non-shift (legacy job) changes keep exactly one-per-job semantics.

This reuses Phase 5's `shiftId` machinery directly and keeps the per-shift placeholders
the boards already render. (Chosen over bundling all shift edits into one job-level
change: less new surface, no new apply variant.)

### 5. Preview, triggers & the OFF path

- **ON path:** a shift move stages its primary `ProposedChange` (with `shiftId`); the
  restage/scope path detects the `shiftId` and calls `resolveShiftCascade`, whose
  follower changes are set on the preview via the existing `SET_CHANGES` reducer.
  The board renders each moved shift as a placeholder (per-shift, from Phase 4/5).
  Apply commits the folded changes.
- **OFF path:** apply only the moved shift; run a **shift-grain version of the existing
  double-book check** to produce a non-blocking warning listing affected members/days.
  The user proceeds or not.
- **Triggers:**
  - *Week-board shift drag* — already stages a `shiftId` change (Phase 5
    `handleDropJob`); wire the ON path to run the resolver.
  - *Day-board block drag* — when cascade ON, stage the time change through the preview
    instead of writing instantly; when OFF, keep the instant write + warning.
  - *Sidebar DAILY HOURS edit* — **depends on Piece A** making those fields edit a
    specific shift; once they do, a time edit stages a `shiftId` change and runs the
    same path.
- The cascade **scope** for a shift move is already narrowed to the moved shift's
  members via `shiftCrewScope` (Phase 5); the resolver consumes the same scope source.

### 6. Data flow

```
move a shift (drag/date/time)
  → primary ProposedChange { jobId, shiftId, newStart/newEnd }
  → cascade ON?
       yes → resolveShiftCascade(jobs, moved, config, {keepExistingDaysAsIs, untilDate})
              → follower per-shift ProposedChanges (+ residual clashes as warnings)
              → preview.SET_CHANGES → per-shift placeholders on the board
              → Apply → applyScheduleChanges folds all per-job → allocations moved,
                        envelope recomputed once per job
       no  → apply moved shift only → shift-grain double-book warning (non-blocking)
```

## Edge cases

- **Multi-day shifts:** overlap is checked per day across the shift's span; a shift's
  occupied intervals are contributed on each of its days.
- **Same-job overlap:** two shifts of one job sharing a member are handled identically
  — the timeline is per member, job-agnostic.
- **Legacy / single-shift jobs:** treated as one (synthesized) shift; the resolver's
  behavior collapses to essentially today's single-unit reflow.
- **Non-working days:** skipped via `WorkingTimeConfig` (weekends/holidays/rain), reused
  from the existing engine.
- **Unresolvable within `untilDate` / project end:** shift left in place, reported as a
  `ResidualClash` warning (never silently double-booked).
- **Anchor invariance:** the moved shift is never relocated by the resolver.
- **Termination:** visited-set + forward-progress bound; no infinite chains.

## Testing strategy

TDD — every behavior gets a failing test first; the full suite stays green.

- **Placement core (`scheduleEngine.test.ts`):** the existing `reflowAvoidingConflicts`
  tests must stay green after the extraction (behavior-preserving proof). Direct tests
  for `placeHoursConflictFree` (Smart vs Simple, keep-existing-days, untilDate spill).
- **Detection (`shiftCascade.test.ts`):** `buildMemberTimelines` pools across jobs;
  `occurrencesClash` clock-overlap truth table; `clashesWith` excludes pinned shifts.
- **Resolver (`shiftCascade.test.ts`):** the John scenario (A into B → B re-placed);
  cross-job shared member; the chain (B bumps C); anchor stays put; Smart pulls a
  displaced shift earlier same-day when room exists vs Simple spills to a new day;
  `untilDate` bound leaves late shifts put; unresolvable → `ResidualClash`.
- **Apply folding (`scheduleEngine.test.ts` / App-level):** two `shiftId` changes on
  one job both apply and the envelope covers both; legacy one-per-job unchanged.
- **OFF-path warning:** shift-grain double-book warning fires on an overlap and is
  non-blocking.
- **Components:** Day-board drag stages a preview when cascade ON, instant + warning
  when OFF; preview renders each moved shift as its own placeholder.

## Dependencies & sequencing

- **Piece A (shift-native sidebar)** must land first for the *sidebar DAILY HOURS*
  trigger. The resolver engine, change-model fold, detection, and the Week/Day-board
  triggers do **not** depend on A and can be built and shipped independently; the
  sidebar trigger is wired once A exists.

## Out of scope (this piece)

- The shift-native sidebar redesign itself (Piece A).
- Per-shift month-view splitting.
- Backward/earlier-than-necessary "optimization" beyond what the existing Smart/Simple
  reflow already does.
- Any change to how Work Orders create shifts.
