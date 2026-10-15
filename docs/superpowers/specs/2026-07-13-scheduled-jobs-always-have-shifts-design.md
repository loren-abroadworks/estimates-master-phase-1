# Every Scheduled Job Has A Shift — Design

**Date:** 2026-07-13
**Status:** Approved (design)
**Builds on:** the shift model (Phases 1–5, Pieces A/B, manage-in-drawer, per-shift boards).

## Problem

The boards, crew grid, and drawer are all shift-native, but a job can still be
**scheduled without any shifts** — the "legacy job" (dates + `crewMemberIds`, no
`allocations`). Every surface carries a fallback branch for it, and all 20+ demo jobs in
`data/mockData.ts` are legacy (zero have `allocations`), so the app *demos* as job-based
even though live flows (crew assignment, the drawer's `ensureJobAllocations`) already
create shifts. The user's expectation is right: **a scheduled job should always have at
least one shift.**

Two **pre-existing latent bugs** block a safe migration (they'd be exposed everywhere the
moment all jobs have allocations):

1. **Job-level moves desync shifts.** `applyChangeToJob`'s job branch (used by bulk
   reschedule, rain-day shifts, cascade followers, Auto-Fix) sets `startDate/endDate/
   dailyHours` but never touches `allocations` — the envelope moves while the shifts the
   boards render stay put.
2. **Undo desyncs shifts.** `handleApplySchedule`'s inverse snapshots only
   `startDate/endDate/dailyHours`; undoing a shift or job move restores the envelope but
   leaves `allocations` at the moved position.

## Decisions (from brainstorming)

1. **Invariant:** a job with a `startDate` always has ≥1 allocation. Unscheduled jobs have
   none (a shift needs dates); they gain their first shift when scheduled.
2. **Migrate demo data + write paths** (not full fallback deletion): legacy fallback
   branches in boards/chips/drawer stay in code as silent safety nets.
3. Fix the two latent bugs first — they are prerequisites, and real bugs today for any
   shift job.

## Design

### 1. Engine — `applyChangeToJob` job branch becomes allocation-aware

When a **job-level** change (no `shiftId`) applies to a job that has `allocations`:
- Compute the calendar-day delta between the change's `newStart` day and the job's
  current start day (local-noon anchored).
- Move **every** allocation by that delta: re-key `startDate`/`endDate` and each
  `dailyHours` key (same re-key math as the existing shift branch).
- Apply `change.dailyHours` to the job as today (re-flowed windows from cascade), then
  `recomputeJobEnvelope`.
- A job **without** allocations takes the existing branch byte-identically.

This makes bulk reschedule / rain-day / cascade followers / Auto-Fix correct for
allocation-based jobs.

### 2. App — undo snapshots allocations

`handleApplySchedule`'s inverse entry gains `allocations: Job['allocations']` (the
pre-commit snapshot, may be `undefined` for legacy jobs); `undoReschedule` restores it
alongside `startDate/endDate/dailyHours`. Undo of any shift or job move then restores the
true pre-move state, envelope and shifts together.

### 3. Mock-data migration

At the bottom of `data/mockData.ts`, map the seeded jobs through `ensureJobAllocations`
(import from `services/shifts` — no import cycle; it no-ops on unscheduled jobs and jobs
that already have allocations). Every scheduled demo job then carries one **"Crew"** shift
matching its exact dates and per-day windows — occupancy identical, so the deliberately
conflict-free demo calendar is preserved.

One hand-built showcase: **Exterior Repaint** (`job-2`, 3 days, crew cm-6/cm-3/cm-4, day 1
full-day + days 2–3 AM) becomes two explicit shifts with the same total occupancy:
- **Prep** — day 1, 08:00–17:00, all three members.
- **Paint** — days 2–3, 08:00–12:00, all three members.

### 4. Drop path — the last producer of shiftless scheduled jobs

After migration, every scheduled job's board bars carry a `shiftId`, so board drags already
route to the cards drawer. The remaining legacy producer is **dropping an unscheduled card
onto a board day** (`handleDropJob`'s no-`shiftId` branch, currently `moveJobToSlot` → a
job-level staged change). Replace it: build the dated job (drop day at the workday start,
preserving the job's duration fallback), run `ensureJobAllocations`, and stage it as
`draftJob` (label `Schedule <name>` / `Move <name>`) — the cards drawer opens with one
"Crew" shift at the drop day; Apply commits via `onUpdateJob`, Cancel discards. Same UX as
every other drawer entry; the job is born with a shift.

## Edge cases

- **Unscheduled jobs:** allocation-less by design; `ensureJobAllocations` no-ops without a
  `startDate`. They gain their shift at scheduling time (drop path or drawer).
- **Rain-day / bulk / cascade / Auto-Fix:** job-level moves of already-scheduled jobs —
  covered by §1.
- **Legacy fallbacks:** remain in boards/chips/drawer as safety nets; expected dead in
  practice after migration.
- **Undo of a change that first materialized allocations:** the inverse snapshot is
  `undefined`, restoring the job to allocation-less — consistent with its pre-move state.

## Testing strategy

TDD — failing test first; full suite stays green.

- **Engine (`scheduleEngine.test.ts`):** a job-level change on an allocation job moves all
  allocations by the delta (spans + per-day window keys re-keyed, envelope recomputed);
  a legacy job's job-level change behaves exactly as before; the existing shift-branch
  tests stay green.
- **Data (`data/mockData` invariant test):** every `MOCK_JOBS` entry with a `startDate`
  has ≥1 allocation; Exterior Repaint has its two named shifts.
- **Runtime verify (verify skill):** crew grid chips show "Crew · time" (and Prep/Paint)
  out of the box with no seeding; Exterior Repaint renders Prep/Paint bars on the boards;
  dropping an unscheduled card opens the cards drawer with a Crew shift at the drop day;
  bulk-reschedule (rain-day) then undo → bars move and move back (exercises §1 + §2).

## Out of scope

- Deleting the legacy fallback branches (future cleanup once the invariant has soaked).
- Any change to job creation (estimate → unscheduled job stays allocation-less).
- The reschedule-undo stack for drawer shift edits (unchanged known limitation).
