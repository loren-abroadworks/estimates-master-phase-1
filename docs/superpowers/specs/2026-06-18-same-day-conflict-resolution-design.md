# Same-Day Conflict Resolution — "Move the conflicting job"

**Date:** 2026-06-18
**Status:** Design — approved, pending implementation plan
**Area:** Job Scheduling (`components/views/JobScheduling`, `services/`)

## Problem

When a user changes a job's time on the Job Scheduling page and the new window
overlaps **another job that shares a crew member on the same day**, today the
system can only offer to move the *edited* job to a future day
(`buildSuggestions`). It cannot offer to nudge the *other* (conflicting) job out
of the way, and it never resolves conflicts at time-of-day granularity on the
same day.

Users want: when an edit creates a same-day overlap, be told about it and
offered to **move the conflicting job**, with the system adjusting it
automatically.

## Decisions (from brainstorming)

1. **Resolution:** slide the conflicting job's *time* later the **same day** so
   it starts after the edited job ends.
2. **Fallback:** if the same-day slide doesn't fit (runs past workday end, or
   collides with a third job), **cascade** the resolution, then **spill** the
   conflicting job to the next free working day.
3. **UX surface:** handled **inside the existing Reschedule preview panel** —
   show the conflicting job(s) with a "Move conflicting job" action; the user
   reviews the proposed slide and presses **Apply**.

## What already exists (reused, not rebuilt)

- `detectIssues` (`services/rescheduleIssues.ts`) — flags a `double-book` when
  two jobs share a crew member **and** their clock windows overlap on the same
  day. This is exactly the conflict to resolve.
- `services/scheduleEngine.ts` primitives:
  - `occupiedIntervals` / `freeIntervals` — compute free clock-time windows on a
    day given shared-crew occupancy.
  - `jobClockWindowOnDay` — a job's clock window on a given day.
  - `placeAfterConflictFree` — next-day conflict-free placement (the spill path).
  - `spannedDayKeys`, `occupiesWorkingDay`, `workingDayKeys`, `isNonWorkingDay`.
  - `sharedCrewScope` (`rescheduleIssues.ts`) — the crew scope for a job.
- Time edits already route through the preview/Apply pipeline
  (`handleShiftStartTime` → `useReschedulePreview` → `onApplySchedule`), and the
  staged `changes` array already supports multiple jobs.
- The Reschedule panel already has a **preview → confirm** mechanism
  (`autoFixPreview` / `confirmAutoFix`) the new action will reuse.

## Approach (selected: A)

Add a focused, pure service that produces *proposals* to slide conflicting jobs,
surfaced in the existing panel as a distinct "Move conflicting job" action,
staged alongside the primary edit and applied together. Rejected alternatives:
extending `buildSuggestions` (B — muddies a day-granular, subject-only function
many tests depend on) and folding into the cascade reflow automatically (C —
removes the confirmation step the user explicitly asked for).

## Architecture & data flow

```
Time edit (DayBoard drag  or  SingleJobEditor TimeInput)
  └─> handleShiftStartTime (JobSchedulingView, existing)
        └─> preview.stage / setChanges → primary ProposedChange staged
  ┌──────────────────────────────────────────────────────────┐
  │ detectIssues(...)                  → double-book issues    │
  │ NEW resolveSameDayConflicts(...)   → ConflictResolution[]  │
  └──────────────────────────────────────────────────────────┘
        └─> SingleJobEditor shows conflicting jobs + "Move conflicting job"
              └─> preview → confirm → resolutions merged into staged changes
                    └─> Apply → onApplySchedule (existing)
```

The staging/apply path is unchanged; the resolver only produces additional
`ProposedChange`s merged into the existing staged `changes` array.

## New service: `services/resolveSameDayConflicts.ts`

Pure module built from existing engine primitives. Total function: never throws,
always returns an array (empty when there are no conflicts).

```ts
export interface ConflictResolution {
  jobId: string;
  jobName: string;
  kind: 'slide-same-day' | 'spill-next-day';
  change: ProposedChange;   // proposed new window for the conflicting job
  label: string;            // "Move Acme to 1:00–3:00 PM" / "...to Tue, Jun 23"
}

export const resolveSameDayConflicts = (
  primary: ProposedChange,
  jobs: Job[],              // proposed world (primary already applied)
  config: WorkingTimeConfig,
): ConflictResolution[]
```

**Algorithm (deterministic; conflicting jobs processed in start-time order):**

1. Find shared-crew jobs whose `jobClockWindowOnDay` overlaps the primary on a
   day the primary spans — the same predicate `detectIssues` uses, so detection
   and resolution never disagree.
2. For each conflicting job, compute that day's `freeIntervals`, excluding the
   conflicting job itself and treating the primary's *new* window as occupied.
3. Pick the earliest free interval `≥ primary.end` whose length `≥` the job's
   duration → `ProposedChange` with updated `dailyHours[dayKey]`, kind
   `slide-same-day`.
4. If none fits → `placeAfterConflictFree` for a next-day slot, kind
   `spill-next-day`.
5. Add the resolved job to a working copy of the world so the next conflicting
   job resolves against it (cascade). Guard with a `visited` set and a fixed
   iteration cap to prevent cycles.

The resolver returns proposals only; it never mutates jobs.

## UI changes (additive)

**`SingleJobEditor.tsx`** — new optional props:

```ts
conflictResolutions?: ConflictResolution[];
onMoveConflicts?: () => void;
```

When `conflictResolutions.length > 0`, render a **"Conflicting jobs"** card
directly under the existing `ConflictStrip` / issue list:

- One row per conflicting job with a before→after line —
  `Acme · 8:00–10:00 AM → 1:00–3:00 PM` (slide) or `→ Tue, Jun 23` (spill), so
  slide vs spill is visually obvious.
- A primary **"Move conflicting job(s)"** button → `onMoveConflicts`.

The proposals flow through the existing preview-card → Apply path
(`autoFixPreview` / `confirmAutoFix` in `ReschedulePreviewPanel`), so there is no
second confirmation paradigm.

**`ConflictStrip.tsx`** — unchanged structurally; the existing double-book
message ("X overlaps Y on the same crew that day") sits above the new card,
which turns that statement into an action.

**`JobSchedulingView.tsx`** — wiring:

- Compute `resolveSameDayConflicts(...)` from the staged primary change
  (memoized; inputs already available for `detectIssues`).
- `onMoveConflicts` merges the resolutions' `ProposedChange`s into
  `preview.setChanges([...])`, deduping by `jobId` (primary kept).
- Thread `conflictResolutions` + `onMoveConflicts` through
  `ReschedulePreviewPanel` → `SingleJobEditor`.

**i18n:** new keys under `views.JobScheduling.reschedule.*` (card title, button
singular/plural, before/after labels), following the existing translation
pattern in these components.

## Edge cases & error handling

| Case | Behavior |
|---|---|
| Conflicting job is **locked** (`is_locked`) | Never proposed; surfaced as an unresolvable note, not a button. Consistent with `occupiedIntervals` including locked jobs as real commitments. |
| Slide runs **past workday end** | Falls through to next-day spill. |
| Sliding B **bumps into C** | Cascade resolves C; `visited` set + iteration cap prevents loops. |
| **Multi-day** conflicting job | Resolved on the shared overlapping day; `placeAfterConflictFree` preserves full duration on spill. |
| Conflicting job spans a **non-working day** | Handled by existing `workingDayKeys` / `occupiesWorkingDay`. |
| **No fit anywhere** within cap | Existing `placeAfterConflictFree` fallback (day after anchor); never throws. |
| User edits again after previewing | Resolutions recompute from new staged state (memo deps); preview refreshes. |

The resolver is total, so the UI degrades to today's behavior if anything is
unexpected.

## Testing plan

**Unit — `services/resolveSameDayConflicts.test.ts`** (bulk of coverage):

- Single same-day overlap → one `slide-same-day` proposal starting at primary's
  end.
- Slide doesn't fit before workday end → `spill-next-day`.
- Slide bumps a third job → cascade produces two proposals.
- Locked conflicting job → excluded.
- No shared crew / no time overlap → empty array.
- Multi-day conflicting job → correct day resolved, duration preserved.
- Cycle guard → terminates, no duplicate proposals.
- Parity: every job the resolver targets is one `detectIssues` flags as
  `double-book`.

**Component — extend `SingleJobEditor.test.tsx`:**

- Card renders only when `conflictResolutions` non-empty.
- Button calls `onMoveConflicts`.
- Before→after labels render slide vs spill correctly.

**Integration — extend `ReschedulePreviewPanel.test.tsx`:**

- Preview → confirm merges proposals into staged changes; Apply commits primary
  + slides together.

Run the existing `rescheduleIssues` / `scheduleEngine` suites to confirm no
regression (the resolver only reads engine primitives).

## Out of scope

- Moving the conflicting job to a *different time the user picks manually*
  (this feature is automatic-slide only).
- Resolving conflicts that don't share a crew member.
- Bulk-mode (multi-job) reschedule conflict resolution — this targets the
  single-job edit flow.
