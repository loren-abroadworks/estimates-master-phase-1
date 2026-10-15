# Production Board & Reschedule Preview — Design

**Date:** 2026-06-02
**Status:** Approved for planning
**Topic:** Relocate rain-day / bulk-reschedule from the Sales Calendar into Job Scheduling, and grow Job Scheduling into a draggable Production Board with an inline Reschedule Preview panel.

## 1. Goal

Make **Job Scheduling** the single home for production rescheduling. Its "Assignments" crew×week grid becomes a draggable **Production Board** with an inline **Reschedule Preview** panel docked at the bottom. Every reschedule action — marking a rain day, bulk cascade, single-job move, or dragging a card — stages proposed changes into that panel; **nothing commits until the user hits Apply.** The rain-day / bulk-reschedule / single-move tools are removed from the **Sales Calendar**, which reverts to a clean sales/booking calendar.

This is modeled on the reference design: crew swimlanes × days with draggable job cards, a right rail (job detail / weekly weather), and a bottom panel with **Potential Issues**, **Preview Timeline**, **Smart Suggestions**, and **Apply / Auto-Fix / Review** controls.

## 2. Confirmed decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Where the board lives | Build into existing **Job Scheduling** view; move reschedule tools out of the Sales Calendar |
| 2 | Board vs existing tabs | Board **replaces the "Assignments" tab**; "Availability" tab stays |
| 3 | Preview behavior | **Everything previews first** — rain day, bulk, and drag-drop all stage into one inline panel; nothing commits until Apply. Retires the cascade *modal* |
| 4 | Smart Suggestions data | **Mock / heuristic** — no external API; local computation from seeded mock data + existing settings |
| 5 | Auto-Fix behavior | **One-click "apply all suggestions"** into the staged change set; user still reviews + Applies |
| 6 | Phasing | **Three phases** (see §7) |
| 7 | Drag-and-drop | **In the first cut** (Phase 1), which is why the core preview panel also lands in Phase 1 |

## 3. Architecture

### Existing pieces reused
- **`services/scheduleEngine.ts`** — pure functions that *return* a `ProposedChange[]` without committing:
  - `moveJobToSlot(jobs, jobId, newStart, newEnd)` — drag-drop and single-move.
  - `shiftJobsFromPoint(jobs, fromPoint, amount, unit, config[, scope])` — rain day + bulk cascade.
  - `moveJobToEnd(...)`, `detectConflicts(...)`, `configFromSettings(...)`, working-day helpers.
- **`App.tsx` `handleApplySchedule(changes, label, extraUndo?)`** — already commits changes, builds the inverse, pushes the undo stack, and shows the undo toast. The preview panel calls this **only on Apply**.
- **Rain-day persistence** — `settings.scheduling.rainDays` (array of `CalendarDayMark`) reused for the rain-day stripe + reporting.
- **Job locking** (`is_locked`) and **scope filters** (crew/category) carry over unchanged.

### New / changed modules
- **`JobSchedulingView.tsx`** — "Assignments" tab becomes the **Board** tab. Hosts `ProductionBoard`, `ReschedulePreviewPanel`, and the right rail. "Availability" tab untouched. Keeps the file thin by delegating to the components below.
- **`components/views/.../ProductionBoard.tsx`** (+ `JobCard`, drag handlers) — extracted from the current assignments grid: crew swimlanes × week days, draggable job cards, drop targets. Emits a proposed move via `moveJobToSlot` rather than mutating directly.
- **`useReschedulePreview` hook (or lightweight context)** — single source of truth for the in-flight reschedule: staged `ProposedChange[]`, source action label, detected issues, and suggestions. The board, the panel, and the action triggers all read/write through it.
- **`components/.../ReschedulePreviewPanel.tsx`** — the bottom dock. Three columns (Potential Issues · Preview Timeline · Smart Suggestions) + controls (`Apply Changes`, `Auto-Fix Issues`, `Review Manually`, `Cancel`). **Replaces `CascadeRescheduleModal`**, which is retired.
- **New pure helpers in `services/scheduleEngine.ts`:**
  - `detectIssues(stagedChanges, jobs, config, settings)` — richer than `detectConflicts`: double-booking, weekend/holiday work, past customer due date, crew daily-capacity overflow. Returns typed issues with severity.
  - `buildSuggestions(stagedChanges, jobs, config, settings)` — derives weather/capacity/customer-window suggestions from mock data. Each suggestion carries the concrete `ProposedChange` delta it would apply (so Auto-Fix can merge it).

### Data flow
1. User acts (drag a card / mark rain day / open bulk reschedule).
2. The relevant pure engine fn produces a `ProposedChange[]` → staged in `useReschedulePreview` (**not applied**).
3. `detectIssues()` + `buildSuggestions()` run over the staged result → panel renders Issues, Timeline, Suggestions.
4. **Apply** → `handleApplySchedule(changes, label, extraUndo)` (commit + undo toast). **Auto-Fix** → merge every suggestion's delta into the staged set, re-run detection. **Review Manually** → keep panel open for per-row edits. **Cancel** → clear staged state, board returns to committed schedule.

## 4. Data model additions

In `types.ts` / defaults in `constants.ts` / seeds in `data/mockData.ts`:

- `Job.customerWindow?: { preferredStart?: string; dueDate?: string }` — optional. Powers "past customer due date" / "customer prefers AM" issues and suggestions. Absent on existing jobs ⇒ those checks simply don't fire.
- `SchedulingSettings.crewDailyCapacityHours?: number` — defaults to `workDayEndHour - workDayStartHour`. Powers capacity-overflow issues and the "crew has open capacity" suggestion.
- `SchedulingSettings.mockWeather?: Record<string /* YYYY-MM-DD */, 'clear' | 'rain' | 'storm' | 'snow'>` — seeded mock forecast in `mockData.ts`. Drives the right-rail weather widget and weather suggestions. **No external API.**

All three are additive and optional — existing data and flows keep working without them.

## 5. UI layout (from reference)

- **Board area:** crew swimlanes (rows) × week days (columns). Job cards are colored, draggable; empty cells are drop targets (`+`). Rain days get a stripe (reused treatment).
- **Right rail:** selected job detail; weekly weather strip sourced from `mockWeather`.
- **Bottom dock — Reschedule Preview panel** (appears when a reschedule is staged):
  - *Potential Issues* — severity-coded list from `detectIssues()`.
  - *Preview Timeline* — each changed job's `old → new` schedule.
  - *Smart Suggestions* — from `buildSuggestions()` (weather / capacity / customer window).
  - Controls: `Apply Changes` · `Auto-Fix Issues` · `Review Manually` · `Cancel`.

## 6. Sales Calendar cleanup

Remove from `SalesCalendarView.tsx`: rain-day context-menu action, bulk-reschedule launcher, single-job move drawer wiring, and the `CascadeRescheduleModal` import. The Calendar keeps its month/week views and the read-only rain-day stripe (still driven by persisted `rainDays`) but no longer mutates the schedule. `canReschedule` gating moves to Job Scheduling.

## 7. Phasing

Each phase is its own plan→implement cycle. Drag + preview-first both land in Phase 1, so the **minimal** preview panel (Timeline + Apply/Cancel) is in Phase 1; richer issues and suggestions follow.

- **Phase 1 — Board + core preview loop**
  - Extract `ProductionBoard` from the Assignments grid; add drag-drop (drag → `moveJobToSlot` → staged).
  - Relocate rain-day, bulk-reschedule, single-move, and locking from the Calendar into the board.
  - Build `ReschedulePreviewPanel` with **Preview Timeline + Apply/Cancel** and basic conflict surfacing (reuse `detectConflicts`).
  - Remove the reschedule tools from `SalesCalendarView`; retire `CascadeRescheduleModal`.
  - Result: a fully working preview→apply loop driven by all four action sources.

- **Phase 2 — Potential Issues + weather rail**
  - `detectIssues()`: double-booking, weekend/holiday work, past customer due date, capacity overflow — rendered with severity in the panel.
  - Right-rail weekly weather widget from `mockWeather`.
  - "Review Manually" per-row flow.

- **Phase 3 — Smart Suggestions + Auto-Fix**
  - `buildSuggestions()` from mock weather / heuristic capacity / customer windows.
  - "Auto-Fix Issues" = merge all suggestion deltas into the staged set, then re-detect.

## 8. Out of scope / assumptions

- No real weather API; no per-customer scheduling-preferences management UI (just the optional `customerWindow` field + mock seed).
- Job locking, scope filters (crew/category), and rain-day reporting carry over unchanged.
- `handleApplySchedule` / undo infrastructure in `App.tsx` is reused as-is, not reworked.

## 9. Testing

- **Pure helpers** (`detectIssues`, `buildSuggestions`, plus existing `moveJobToSlot` / `shiftJobsFromPoint` / `detectConflicts`) — unit tested with fixture jobs/settings.
- **Panel/board behavior** — staging does not commit; Apply commits via `handleApplySchedule`; Cancel discards; Auto-Fix merges suggestions and re-detects; drag produces the expected staged `ProposedChange`.
- **Calendar regression** — Calendar no longer mutates schedule; rain-day stripe still renders from persisted `rainDays`.
