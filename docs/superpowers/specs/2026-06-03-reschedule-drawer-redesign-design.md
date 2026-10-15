# Reschedule Preview Drawer Redesign — Design

**Date:** 2026-06-03
**Status:** Approved (pending spec review)
**Area:** Job Scheduling view — `components/views/JobScheduling/ReschedulePreviewPanel.tsx` and its wiring in `JobSchedulingView.tsx`.

## Problem

The Reschedule Preview drawer serves two different jobs through one 10-section layout:

1. **Single-job editing** — opened by "Reschedule job" on one card, to adjust that job's dates, daily hours, and crew.
2. **Bulk reschedule preview** — opened by cascade/rain-day flows, to preview the ripple of shifting many jobs and apply it.

This dual role causes three concrete problems:

- **Mismatched framing.** Opening one job shows bulk language ("Jobs Affected: 1", "Total Delay 0d", "Applying will reschedule 1 job") even though nothing has moved — the user only wanted to edit.
- **Inconsistent save model (P1 trap).** Crew reassignment saves *immediately* (`handleChangeCrew → onUpdateJob`), while date/daily-hours edits are *staged* and only commit on **Apply**. A user who reassigns crew then clicks **Cancel** has already, silently, persisted the crew change.
- **Buried conflicts.** "Potential Issues" sits at section 7 of 10, below all the editing controls; Auto-Fix lives at the very bottom (section 10) and, when triggered, force-scrolls the body to the top — a workaround for wrong ordering.

## Goals

- Two distinct, mode-appropriate experiences sharing one drawer shell.
- A single, consistent save model: **stage everything, commit on Apply, revert on Cancel.**
- Conflicts and Auto-Fix surfaced at the top of both modes.
- One source of truth for each piece of schedule data (no duplicated date/range displays).
- Clearer terminology.

## Non-Goals

- No change to the scheduling engine, conflict detection, suggestion building, or impact computation (pure services stay as-is, except `RescheduleImpact` already carries the affected-name lists added recently).
- No change to the standalone bulk **CascadeRescheduleModal** or the crew **CrewSelectionModal**'s internal layout (only how the crew modal *commits* changes — see Save Model).
- No redesign of the board/calendar itself.

## Architecture

### Mode flag (explicit, not inferred)

Add an explicit mode to the staged reschedule so the drawer never guesses from job count:

```ts
// services/reschedulePreview.ts
export interface StagedReschedule {
  changes: ProposedChange[];
  label: string;
  commit: (effective: ProposedChange[]) => void;
  delayDays?: number;
  recompute?: (delayDays: number) => ProposedChange[];
  mode: 'edit' | 'bulk';            // NEW — required
}
```

Mode assignment at the five existing `preview.stage(...)` sites in `JobSchedulingView.tsx`:

| Stage site | Trigger | Mode |
|---|---|---|
| `handleRescheduleJob` | "Reschedule job" button on one job | `edit` |
| drag move to slot (`moveJobToSlot`) | dragging one job to a new day | `edit` |
| rain-day shift | system shifts affected jobs forward | `bulk` |
| cascade modal `onApply` | bulk cascade reschedule | `bulk` |
| `handleChangeDelay` recompute | Delay-by changed | preserve `s.mode` |

### Component decomposition

The single ~480-line `ReschedulePreviewPanel.tsx` splits into a shell plus two bodies and two shared pieces. All live under `components/views/JobScheduling/reschedule/`:

- **`ReschedulePreviewPanel.tsx`** (shell) — drawer chrome: backdrop, accent rail, header, footer, and the Auto-Fix preview/confirmation banners. Reads `staged.mode` and renders `<SingleJobEditor>` or `<BulkPreview>` as the body. Owns the `reviewing`/`autoFixPreview`/`autoFixApplied` UI state.
- **`SingleJobEditor.tsx`** — body for `mode: 'edit'`.
- **`BulkPreview.tsx`** — body for `mode: 'bulk'`.
- **`ConflictStrip.tsx`** (shared) — the top status strip: red "N conflicts · View" with an inline **Auto-Fix** button when a suggestion exists, or green "No conflicts." Used by both bodies.
- **`ImpactTiles.tsx`** (shared) — the stat-tile grid (with the hover-detail tooltips that already exist), reused full-size in bulk mode and compact in edit mode.

`PreviewTimeline`, `SmartSuggestionsCard`, `HoursStat`, `CrewAvatar` move/stay as imported helpers. The existing props on `ReschedulePreviewPanel` (issues, suggestions, impact, callbacks, `crewByJob`, `statsByJob`, `dailyHoursEdits`, `onChange*`, `onReassignCrew`) are passed through to whichever body needs them; each body takes only the props it uses.

## Single-job mode (`edit`)

Header: **"Edit Schedule"** title, job name as a badge, subtitle showing client name + `#WO`. No "changing/skipped" counts, no bulk delay summary.

Body order, top to bottom:

1. **Conflict strip** — `<ConflictStrip>`. Auto-Fix button shown only if a suggestion applies to this job.
2. **When** — two labeled fields, **Start Date** and **End Date** (the separated layout already built). Absolute dates only; **no "Delay by"** control in edit mode.
3. **Daily hours** — per-day start/end time rows for the spanned days (existing control, minus its own date pickers since "When" owns dates now).
4. **Crew** — member avatars + names + count, and an **"Edit crew"** button opening `CrewSelectionModal`. (See Save Model for how the modal commits.)
5. **Impact (compact)** — work order #, the Est / Assigned / **Logged** hours trio, and the resulting end date. One row, read-only. No "Jobs/Crews Affected" tiles in edit mode.

Footer: hint text "Saves N days of hours + crew on Apply" and **Cancel / Apply** buttons. Apply is enabled whenever there is any staged edit (date, hours, or crew), not only when the start date moved.

## Bulk mode (`bulk`)

Header: **"Reschedule Preview"** title with the existing `staged.label` badge and the "N changing · M skipped · K to resolve" summary line.

Body order:

1. **Conflict strip** — `<ConflictStrip>` with Auto-Fix as the primary action.
2. **Delay by** — the relative N-days dropdown (only when `recompute` is present).
3. **Impact** — full four-tile `<ImpactTiles>` (Jobs Affected, Crews Affected, Total Delay, New End Date) with hover details.
4. **Affected jobs** — a compact list: per job, name + `old → new` start, with an inline conflict marker when that job has an issue. Replaces the heavy per-job Job-Details / Crew / Daily-Hours blocks (which don't scale past a few jobs). The existing "Per-job detail" review list is folded into this section.
5. **Timeline** — `<PreviewTimeline>`.

Footer: **Cancel / Apply · N jobs**.

## Save model

All edits stage into the preview; **Apply** commits them atomically; **Cancel** discards them.

The current `onApply` in `JobSchedulingView.tsx` already folds `dailyHoursEdits` into the committed changes. Two changes make the model consistent:

- **Crew reassignment is staged, not immediate.** Today `handleSaveCrewModal → handleChangeCrew → onUpdateJob` writes through instantly. Instead, the chosen crew/allocation is held in transient state (a `stagedCrewByJob` map keyed by jobId, parallel to `dailyHoursEdits`) and surfaced in the drawer's Crew section as a pending value. `onApply` writes the staged crew into the job (`onUpdateJob` with `crewMemberIds` + `allocations`) alongside the date/hours commit. `onCancel` clears the staged crew with the rest.
- **Apply enablement in edit mode** keys off "any pending edit exists" (date changed OR `dailyHoursEdits[jobId]` present OR `stagedCrewByJob[jobId]` present), so hours/crew-only edits are committable.

The `CrewSelectionModal` itself is unchanged internally; only its `onSave` handler in the view changes — from "write through immediately" to "record into staged crew state."

## Terminology

- **"Rendered" → "Logged"** for actual hours, with a tooltip "actual hours logged." Applies in `ImpactTiles`/compact impact and in `CrewSelectionModal`'s stats header (which uses the same label).
- Schedule range is shown editable in **one** place per mode (edit: "When"; bulk: per-job `old → new`); the read-only "Job Schedule: X – Y" duplicate is removed.

## Data flow

```
JobSchedulingView
  ├─ preview.staged: StagedReschedule { mode, changes, commit, recompute?, delayDays? }
  ├─ dailyHoursEdits:   Record<jobId, Record<dateKey, {startTime,endTime}>>   (existing)
  ├─ stagedCrewByJob:   Record<jobId, {memberIds, allocation}>                (NEW)
  └─ <ReschedulePreviewPanel staged=… issues=… suggestions=… impact=… …>
        ├─ mode==='edit' → <SingleJobEditor>   (When / Daily hours / Crew / compact Impact)
        └─ mode==='bulk' → <BulkPreview>        (Delay / Impact / Affected jobs / Timeline)

Apply (edit): for the job → onUpdateJob({…job, dailyHours, crewMemberIds, allocations}); commit(applyDailyHours(change, edits))
Apply (bulk): commit(changes folded with each job's dailyHoursEdits)   (existing behavior)
Cancel: preview.clear() + reset dailyHoursEdits + stagedCrewByJob
```

## Testing

Pure-logic and reducer changes get unit tests; presentational layout is verified by component tests where behavior (not pixels) matters, consistent with the existing suite.

- **`reschedulePreview` reducer** — `STAGE` carries `mode`; `SET_CHANGES` preserves `mode`.
- **`ReschedulePreviewPanel`** — renders `SingleJobEditor` for `mode:'edit'` (asserts "Edit Schedule" header, no "Jobs Affected" tile) and `BulkPreview` for `mode:'bulk'` (asserts impact tiles + affected-jobs list). Conflict strip appears at the top in both.
- **`ConflictStrip`** — shows count + Auto-Fix when issues/suggestions exist; green "No conflicts" otherwise.
- **Save model** — a test at the view level (or a focused handler test) asserting that the crew modal's save records into staged state and does **not** call `onUpdateJob` until Apply, and that Cancel discards staged crew.
- Existing `rescheduleImpact`, `rescheduleIssues`, `rescheduleSuggestions`, `productionBoard`, `jobStats`, `crewWeeklyHours` tests stay green unchanged.

## Risks / Notes

- The staged-crew change touches the same `onUpdateJob` path the board lanes read; the compact Crew section must reflect staged (pending) crew, not the persisted job, so the preview matches what Apply will write.
- Drag-move uses `edit` mode but has no `recompute`; the editor must not assume a delay control exists (it doesn't render one in edit mode anyway).
- Keep `RescheduleImpact.affectedJobNames` / `affectedCrewNames` (added recently) — bulk mode's affected-jobs list and tile tooltips rely on them.
