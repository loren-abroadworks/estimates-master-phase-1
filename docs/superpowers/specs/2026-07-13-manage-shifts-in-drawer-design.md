# Manage Shifts in the Reschedule Drawer — Design

**Date:** 2026-07-13
**Status:** Approved (design)
**Builds on:** Piece A (shift-native DAILY HOURS, `2026-07-13-shift-native-sidebar-design.md`)
and Piece B (shift-granular cascade, `2026-07-11-shift-granular-cascade-design.md`), both
merged.

## Problem

Shift management (add / delete / rename shifts, per-shift crew, span, per-day hours)
lives in a separate **"Shifts — <job>" modal** reached only via the Job Details panel's
**"Manage crew"** button. The reschedule drawer ("Edit Schedule") — the surface users
actually work in — can only edit one shift's hours (Piece A) and only after a shift drag.
Users want to manage a job's shifts **inline in the drawer**, and to retire the separate
modal and the "Manage crew" button.

Complication: the Shifts modal saves **live** (`onUpdateJob` on every edit), while the
drawer is a **staged preview** — edits are held until **Apply**, which runs the Piece B
cascade. Moving management into the drawer must adopt the drawer's staged model, including
for structural edits (add / remove shift) that today's `ProposedChange` model can't
represent.

## Decisions (from brainstorming)

1. **Staged, commit on Apply.** All shift edits — including add / remove / rename / crew —
   are previewed and only persisted on Apply. Cancel discards them. Cascade runs on Apply
   (and live in the preview) for schedule edits.
2. **Stacked shift cards.** The drawer shows every shift as its own card (name, dates,
   crew, per-day hours, delete) with an "Add shift" button — the current `ShiftList`
   embedded in the drawer, not a separate modal.
3. **Staged draft-job model (Approach 1).** The drawer edits a working copy of the job;
   the board previews it; Apply commits the draft plus any cascade followers.
4. **Retire the separate surfaces.** The Job Details panel's "Manage crew" button, the
   "Shifts — …" modal, and the `shiftsJobId` flow are removed. `CrewSelectionModal` stays
   (opened from a card, wired to the draft).

## Approach — staged draft job

**View state `editDraft: Job | null`** holds the working copy of the job being edited,
seeded via `ensureJobAllocations(job)` when the drawer opens in shift-management mode (so
a legacy single-crew job shows one shift card). Shift edits mutate `editDraft` through the
existing pure helpers in `services/shifts` (`upsertAllocation`, `removeAllocation`,
`setAllocSpan`, `setAllocDayWindow`, `newShift`) — never the committed job. `preview.staged`
still provides the drawer shell + Apply and carries **cascade follower changes for other
jobs** in `changes`; `primaryJobId = editDraft.id`. The board's `displayJobs` renders
`editDraft` in place of the committed job (live preview), plus follower overlays.

- **Apply:** one undo entry — `onUpdateJob(editDraft)` for the primary + `applyScheduleChanges(followers)` for cascade-moved other jobs, then customer-notify + activity log. Clear `editDraft` and the preview.
- **Cancel:** clear `editDraft` and the preview; no writes.

Rejected: embedding `ShiftList` live (contradicts the staged choice); leaving the modal and
only moving its trigger (not "manage it here").

## Design

### 1. Draft handlers (view)

New view state `editDraft` (+ reset on preview clear). Staged edit handlers, each updating
`editDraft` and re-staging:
- `draftRenameShift(shiftId, name)` → `upsertAllocation`.
- `draftAddShift()` → `upsertAllocation(newShift(...))`, then open the crew picker for it.
- `draftDeleteShift(shiftId)` → `removeAllocation` (no-op / disabled when one shift remains).
- `draftChangeSpan(shiftId, start, end)` → `setAllocSpan`; schedule edit → cascade recompute.
- `draftChangeDayWindow(shiftId, dateKey, window)` → `setAllocDayWindow`; schedule edit → cascade recompute.
- `draftSetCrew(shiftId, memberIds, leaderId?)` → update the allocation's `memberIds` (from `CrewSelectionModal` save).

A schedule edit (span / day window), when cascade is ON, recomputes followers:
build an anchor `ProposedChange` from the edited shift's **current draft windows**
(`shiftId` + complete `dailyHours`) and run `resolveShiftCascade(worldWithDraft, anchor,
config, { keepExistingDaysAsIs, untilDate })`, where `worldWithDraft = jobs.map(j => j.id
=== editDraft.id ? editDraft : j)`. Applying the anchor is idempotent (the draft already
reflects it). `preview.setChanges(followers)`; residuals → `residualClashes`. Cascade OFF →
`preview.setChanges([])` and run `detectShiftClashes(worldWithDraft)` for a non-blocking
warning.

### 2. Drawer UI (`SingleJobEditor`)

In shift-management mode (`editDraft` present, i.e. the staged edit is a job the view is
managing), replace the job-level WHEN / DAILY HOURS / CREW sections with the **`ShiftList`**
component rendered from `editDraft.allocations`, wired to the draft handlers:
`onRenameShift`, `onAddShift`, `onDeleteShift`, `onChangeSpan`, `onChangeDayWindow`,
`onEditMembers`. The cascade toggle, conflict strip, issues list, residual-clash warnings,
and IMPACT tiles stay. `ShiftList` gains a `canDelete` guard so the last shift's delete is
disabled. Because both drawer entry points (drag and the schedule action) now open this
management mode (§4), Piece A's `ShiftHoursEditor` tabs are **no longer rendered in the
drawer** — the stacked cards fully supersede them. The `ShiftHoursEditor` component is left
in the tree (unused) for now; removing it is a later cleanup, not part of this work.

### 3. Crew picker

"Edit members" on a card opens `CrewSelectionModal` for that shift. Its save calls
`draftSetCrew(shiftId, memberIds, leaderId)` — updating `editDraft`, not the job. The
existing per-shift member-picker state (`editingShiftId`) is reused, scoped to the draft.

### 4. Entry points & retirement

- **Job Details panel → schedule action** (`handleRescheduleJob`): seed `editDraft =
  ensureJobAllocations(job)` and stage an empty-follower preview (`changes: []`,
  `primaryJobId`), opening the drawer in management mode. (A job with no prior dates still
  opens for first-time scheduling.)
- **Shift drag** (Piece A path): seed `editDraft` from the job and mark the dragged shift
  as the pending move; the drag's span change is the first staged schedule edit.
- **Remove:** the Job Details panel "Manage crew" button (`onViewCrew`), the "Shifts — …"
  `Modal` + `ShiftList` render there, `shiftsJobId` / `setShiftsJobId`, and the live
  `handleAddShift`/`handleRenameShift`/`handleChangeSpan`/`handleChangeShiftDayWindow`/
  `handleDeleteShift` handlers (replaced by the `draft*` staged versions).

### 5. Data flow

```
open drawer (job) → editDraft = ensureJobAllocations(job); preview.stage({changes:[], primaryJobId})
  edit a card (rename/add/delete/crew) → update editDraft (+ OFF: detectShiftClashes warning)
  edit a card's span/hours →
     update editDraft
     cascade ON  → resolveShiftCascade(worldWithDraft, anchor) → preview.setChanges(followers)
     cascade OFF → preview.setChanges([]) + clash warning
  board renders editDraft (+ follower overlays) live
Apply → onUpdateJob(editDraft) + applyScheduleChanges(followers) + notify/undo
Cancel → discard editDraft + clear preview
```

## Edge cases

- **Legacy job (no allocations):** `ensureJobAllocations` makes one shift from
  `crewMemberIds` on open; Apply writes `allocations`, making the job shift-based.
- **Delete last shift:** blocked (delete disabled at one shift) — a scheduled job keeps ≥1.
- **Add shift:** seeded with a default span/window and no crew; the crew picker opens
  immediately so the user assigns members.
- **Envelope:** the `services/shifts` helpers recompute `job.startDate/endDate` from the
  allocations, so the board bar stays correct as cards are edited.
- **Multiple schedule edits, cascade ON:** the most-recently-edited shift is the anchor
  (consistent with Piece A); followers recompute per edit.
- **First-time scheduling (no prior dates):** cascade is unavailable (nothing to shift);
  the drawer still manages/creates shifts and Apply schedules the job.

## Testing strategy

TDD — failing test first; full suite stays green.

- **`ShiftList` `canDelete` guard:** delete button disabled/absent when one shift remains,
  present with 2+. (Extend `ShiftList` test if present, else add one.)
- **`SingleJobEditor` management mode:** renders the stacked shift cards + "Add shift" when
  in management mode; a card edit invokes the staged handler, not a live `onUpdateJob`.
- **Draft handlers:** the underlying `services/shifts` edits are already unit-tested; the
  view glue is verified at runtime.
- **Runtime verify (verify skill):** open a job's drawer → stacked shift cards; add a shift
  and assign crew; edit a shift's hours/dates; cascade ON re-places a clashing shift; Apply
  commits the draft + followers and the job shows the edits; Cancel discards; confirm the
  "Manage crew" button and the Shifts modal are gone. Seed/revert `data/mockData.ts` as
  needed.

## Dependencies & out of scope

- Reuses Piece B (`resolveShiftCascade`, `applyChangeToJob` window branch, apply-fold,
  `detectShiftClashes`) and Piece A (`ShiftHoursEditor`, shift-change producers) — no engine
  changes expected; this is a drawer/state re-architecture.
- **Out of scope:** per-shift month-view splitting; any change to how Work Orders create
  shifts; multi-job (bulk) shift management (the drawer manages one job at a time).
