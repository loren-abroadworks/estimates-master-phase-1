# Consolidate the Single-Job Conflict UI

**Date:** 2026-06-18
**Status:** Design — approved, pending implementation plan
**Area:** Job Scheduling — `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`

## Problem

The single-job edit panel shows three overlapping conflict blocks at once (see the reported screenshot):

1. A red **"N conflicts"** strip with an **Auto-Fix** button (`ConflictStrip`, driven by `detectIssues` count).
2. One amber **issue row per issue** on the edited job (`jobIssues`), including overlap rows like *"Exterior Repaint overlaps Downtown Commercial on the same crew that day"*.
3. The amber **conflict-resolution card** *"N jobs conflict with this time"* with the **Move conflicting job** button (`conflictResolutions`).

This is redundant and confusing:
- The overlap is stated twice — once as a `double-book` issue row, once as a conflict-card entry.
- Two **"N"** counts that look identical but mean different things (issues on the edited job vs. number of conflicting other jobs).
- Two competing resolution actions: **Auto-Fix** moves the edited job away; **Move conflicting job** moves the other jobs.

## Decisions (from brainstorming)

1. **Resolution action:** keep only **Move conflicting job** (the gap-fill / nearest-day resolver). Drop **Auto-Fix** (move-my-own-job) from the single-job editor.
2. **Structure:** card-only + advisories. Remove the red count strip and the duplicate overlap rows; keep non-overlap problems (due-date, weekend, capacity) as separate advisory notes; show green "No conflicts" only when fully clear.

Scope is the **single-job edit panel only**. Bulk mode (`BulkPreview`) keeps its Auto-Fix unchanged.

## New structure (top of `SingleJobEditor`)

Split the edited job's issues by kind:

```ts
const advisories = jobIssues.filter(i => i.kind !== 'double-book'); // due-date, weekend, capacity
const hasProblems = conflictResolutions.length > 0 || advisories.length > 0;
```

Render, in order:

- **Green "No conflicts"** — only when `!hasProblems`. Reuses the existing green `ConflictStrip` branch and the `noConflicts` copy.
- **Advisory notes** — one amber row per `advisories` entry (the non-overlap problems the conflict card cannot fix, e.g. *"Exterior Repaint ends after the customer due date (June 18, 2026)"*).
- **Conflict card** — unchanged: lists conflicting jobs with their `slide-same-day` / `move-to-day` / `unresolved` resolutions and the **Move conflicting job** button (shown when any resolution `isMovableResolution`).

## Removed

- The red **"N conflicts"** strip and its **Auto-Fix** button in the single-job editor.
- The **`double-book` issue rows** — the conflict card already represents every overlap from the resolution angle.

The duplicate overlap text and the two ambiguous "N" counts both disappear; the only conflict header left is the card's *"N jobs conflict with this time."*

## Why this loses no information

Detection (`detectIssues`) and resolution (`resolveSameDayConflicts`) now share the same shared-crew + same-day-overlap predicate and the same edited-window view (the `bakeDailyEdits` fix), so a `double-book` on the edited job always corresponds to at least one entry in the conflict card. Dropping the `double-book` rows therefore drops only duplication — the overlap is still shown once, in the card. Non-overlap issue kinds (`past-due`, `weekend`, `capacity`) are unaffected and remain as advisory notes, which is the only place they surface.

## Component-level changes

- `SingleJobEditor.tsx`:
  - Compute `advisories` and `hasProblems`.
  - Render: green "No conflicts" when `!hasProblems`; an amber note per advisory; the existing conflict card.
  - Stop rendering the red `ConflictStrip` (count + Auto-Fix) and the `jobIssues.map` overlap rows.
  - The `suggestions` / `onAutoFix` / `canAutoFix` inputs are no longer used by the single-job path; trim them from `SingleJobEditor`'s props (they remain wired to `BulkPreview` via `ReschedulePreviewPanel`).
- No changes to `resolveSameDayConflicts`, `detectIssues`, the bulk path, or i18n. The green confirmation reuses `views.JobScheduling.reschedule.ConflictStrip.noConflicts`; advisory messages already come from `detectIssues`.

## Testing

Component tests (`SingleJobEditor.test.tsx`):

- **Advisory-only** (e.g. a `past-due` issue, no `conflictResolutions`) → the advisory note renders; no conflict card; no green box.
- **Overlap present** (`conflictResolutions` non-empty) → conflict card renders; no `double-book` row; no green box; no red strip / Auto-Fix button.
- **Fully clear** (no issues, no resolutions) → green "No conflicts" only.
- **Mixed** (a `past-due` advisory + a `double-book` whose job appears in `conflictResolutions`, i.e. the screenshot case) → exactly one advisory note + the conflict card; no red strip, no duplicate overlap row, no green box.
- The existing tests for the conflict card (`renders the conflicting-jobs card…`, `unresolved`/`move-to-day`, locked hides button) continue to pass.

Run `npm test` and `npm run lint` after; the change is confined to `SingleJobEditor` and its test.

## Out of scope

- Bulk-mode conflict UI (`BulkPreview`) and its Auto-Fix.
- The `ConflictStrip` component itself (still used for the green confirmation here and by bulk); not deleted.
- Any change to conflict detection or resolution logic.
