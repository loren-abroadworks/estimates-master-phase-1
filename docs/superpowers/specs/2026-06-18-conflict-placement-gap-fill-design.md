# Smarter Conflict Placement — gap-fill first, push-to-make-room cascade fallback

**Date:** 2026-06-18
**Status:** Design — approved, pending implementation plan
**Area:** Job Scheduling — `services/resolveSameDayConflicts.ts` and its UI consumers
**Supersedes:** the placement logic in `2026-06-18-same-day-conflict-resolution-design.md` (the "slide right after the anchor, else spill the whole job to the next free day" rule). Detection, staging, panel/card wiring, and the `mergeResolutionsIntoChanges` round-trip fix are unchanged.

## Problem

Two bugs reported from manual testing of "Move conflicting job":

1. **Spills to a far-future date.** Moving Miller Exterior to 1–5 PM on Jun 17 made Downtown Commercial (a multi-day job, 1–5 PM that day) conflict. The resolver proposed moving Downtown to **July 16, 2026** instead of the free **8 AM–12 PM** slot that opened the same day.
2. **Moves the entire multi-day project.** Because Downtown is multi-day, the resolver skipped same-day placement entirely and relocated **all** of its days, not just the conflicting Jun 17 day.

Root cause (`resolveSameDayConflicts.ts:42–60`): same-day placement was gated on `singleDay`, only tried the slot **after** the anchor's end (never an earlier free gap), and the fallback `placeAfterConflictFree` searches forward for a day whose **whole span** is conflict-free and moves the **entire** job.

## Decisions (from brainstorming)

1. **Same-day slot choice:** prefer the earliest free interval starting at/before the job's original time, placed at that interval's **start** (Downtown → 8 AM–12 PM); else the earliest fitting interval after.
2. **Multi-day conflicting job:** resolve **only the conflicting day's** window; never split the project across dates. If it can't fit the same day → unresolved warning.
3. **Single-day conflicting job:** try same-day; if no fit → relocate the whole job to the **nearest** working day (both directions) with a fitting slot.
4. **Cascade:** keep it, as a **push-to-make-room fallback** — gap-fill first; only when no same-day gap fits, push the blocking shared-crew job(s) later (recursively resolving each) to open a slot.

## Unified resolution model

For each shared-crew job that overlaps the **primary edit** on a shared day, resolve in this order:

1. **Gap-fill (same day).** Place the job in a free clock-time interval on the conflict day, preferring the earliest interval whose start ≤ the job's original start (placed at that interval's start); else the earliest fitting interval after. A gap placement is conflict-free, so it triggers no chaining.
2. **Push-to-make-room (cascade fallback).** If no gap fits, place the job right after the anchor's end (same day, only if it fits before workday end). This may overlap another shared-crew job, which becomes the next anchor and is resolved by these same rules — the domino.
3. **Last resort.** If it still can't fit the same day:
   - **single-day** → relocate the whole job to the nearest working day (both directions, tie → earlier) with a fitting slot (`move-to-day`);
   - **multi-day** → leave an `unresolved` warning; never split the project across dates.

Gap-fill is preferred everywhere; the cascade fires only when a day is genuinely packed. Same-day placement (gap-fill or push) touches only `dailyHours[clashDay]`, recomputing `newStart`/`newEnd` only when the clash day is the job's first/last spanned day — so a multi-day middle-day edit leaves the project span intact.

## Changes in `services/resolveSameDayConflicts.ts`

### Resolution kinds

```ts
kind: 'slide-same-day' | 'move-to-day' | 'unresolved' | 'locked-blocked'
```

`spill-next-day` is removed. "Movable" (stageable) means `kind === 'slide-same-day' || kind === 'move-to-day'`. `unresolved` and `locked-blocked` are informational notes with no staged change.

### New pure helpers

- `findSameDaySlot(job, dayKey, world, config): { startTime: string; endTime: string } | null`
  Builds occupancy with the existing `occupiedIntervals(world, sharedCrewScope(job), dayKey, config, job.id)`, computes `freeIntervals`, filters to intervals at least the job's duration, and applies decision 1 (earliest interval with start ≤ original start, placed at its start; else earliest after).

- `findNearestDay(job, world, config): { dayKey: string; slot: { startTime: string; endTime: string } } | null`
  Scans working days outward from the job's original day (d = 1, 2, …, bounded, e.g. 60; tie → earlier), returning the first day where `findSameDaySlot` succeeds.

### `slideOrSpill` → `resolveConflict`

Applies the resolution model above. Helper to build a same-day change touching only the clash day:

```ts
// spanned = spannedDayKeys(job.startDate, job.endDate)
// newStart = clashDay === spanned[0]            ? `${clashDay}T${slot.startTime}:00` : job.startDate
// newEnd   = clashDay === spanned[last]         ? `${clashDay}T${slot.endTime}:00`   : job.endDate
// dailyHours = { ...job.dailyHours, [clashDay]: slot }
```

`move-to-day` builds a change on the new day (`newStart`/`newEnd` on that day at the slot; `dailyHours = { [newDay]: slot }`). Gap-fill, `move-to-day`, and `unresolved` do **not** enqueue a new cascade anchor; **push placements do** (they intentionally overlap, so the overlapped job must be resolved next).

### Cascade loop

The existing anchors queue, `visited` set, and iteration bound stay. The only change: each candidate job tries `findSameDaySlot` (gap-fill) before the push placement, so only push placements seed a new anchor.

## UI & wiring

- **Labels** (built in the service, English strings, as today):
  - `slide-same-day`: `Move {name} to {start}–{end}`
  - `move-to-day`: `Move {name} to {Mon, Jun 23}, {start}–{end}`
  - `unresolved`: `{name} can't fit on {date} — reschedule manually`
  - `locked-blocked`: unchanged.
- **`SingleJobEditor` card** (`reschedule/SingleJobEditor.tsx`) and **`handleMoveConflicts`** (`JobSchedulingView.tsx`): change the "movable" predicate from `kind !== 'locked-blocked'` to `kind === 'slide-same-day' || kind === 'move-to-day'`, so both `unresolved` and `locked-blocked` render as notes without staging a move.
- `mergeResolutionsIntoChanges` filters to the two movable kinds (same merge-by-jobId logic; preserves in-flight per-day edits as already fixed).
- No new props and no new i18n keys.

## Edge cases

| Case | Behavior |
|---|---|
| Free morning gap (reported case) | Gap-fill → 8 AM–12 PM, only the clash day touched |
| Day packed, room by pushing | Push blocker later; cascade resolves it |
| Multi-day, no same-day fit even with push | `unresolved` warning; project untouched |
| Single-day, no same-day fit | `move-to-day` nearest working day (both directions) |
| Locked blocker | `locked-blocked` note; a locked job is never pushed |
| Push would exceed workday end | Treated as no-fit → nearest-day / unresolved |
| Cascade cycle | `visited` set + iteration bound (unchanged) |
| Clash day is the job's first/last day | `newStart`/`newEnd` recomputed for that boundary day |

The resolver stays total: never throws, returns `[]` when there are no conflicts.

## Testing

**Unit — `services/resolveSameDayConflicts.test.ts`:**
- `findSameDaySlot`: morning gap → start-of-gap; only a later gap → placed after; multiple fitting intervals → earliest-before chosen; no fit → `null`.
- Gap-fill multi-day: only `dailyHours[clashDay]` changes; `newStart`/`newEnd` preserved for a middle day; recomputed for a first/last day.
- Push fallback: packed day pushes the blocker and the cascade yields two resolutions.
- Single-day no same-day fit → `move-to-day` nearest (verify both-direction search and earlier tie-break).
- Multi-day no same-day fit → `unresolved`.
- `findNearestDay`: bounded search returns nearest fitting day.
- **Rewrite** the existing `spills to the next working day…` and `cascades…` tests to the new kinds/behavior.

**Component / integration:**
- `unresolved` renders a note with no Move button; `move-to-day` label renders correctly.
- Existing "locked hides the Move button" test still holds (predicate change keeps it true).
- `ReschedulePreviewPanel` edit-mode test unchanged.

Run the full suite (`npm test`) and `npm run lint` after; the resolver only reads engine primitives, so no regression is expected outside this module and its two consumers.

## Out of scope

- Splitting a multi-day project across non-contiguous dates (explicitly rejected).
- Changing the separate "Cascade following jobs" toggle (shifts the primary's own followers — a distinct existing feature).
- Bulk-mode conflict resolution.
