# Collapse Crew / Crew Member views into a single "Crew" view

**Date:** 2026-06-05
**Status:** Approved — ready for implementation plan

## Problem

The Job Scheduling page has three view tabs that swap the rows of one board:

- **Job** — one row per job
- **Crew** — rows grouped by *crew team* (`CrewGroup`, e.g. "Team A"), via `buildLanes`
- **Crew Member** — one row per *individual person*, via `buildMemberLanes` (also owns the weekly Hours sub-mode)

"Crew" (teams) and "Crew Member" (people) are easy to confuse, and "Job" vs "Crew" also feel similar. The team scheduling workflow is built around individuals — their availability and expertise — not fixed teams, so the team-grouped board view earns little of its confusion cost.

## Goal

Reduce the board to **two** view tabs: `Job` and `Crew`, where "Crew" is the current per-person board (formerly "Crew Member"). Remove the team-grouped view.

## Scope

All UI changes live in `components/views/JobSchedulingView.tsx`, plus deleting one orphaned component.

1. **View tabs** — Remove the middle "Crew" (teams) button. Relabel the "Crew Member" button to **"Crew"**, keeping its `User` icon and its Board/Hours sub-toggle.
2. **View state** — Narrow the type from `'crew' | 'member' | 'job'` → `'member' | 'job'`. Keep the internal value `'member'` (the rest of the file is member-named: `assignMemberId`, `selectedMemberId`, `boardMode`, etc.); only the user-facing label says "Crew." Default view stays `'job'`.
3. **Lane builder** — `boardLanes` drops the `buildLanes` (teams) branch: `member` → `buildMemberLanes`, else → `buildJobLanes`.
4. **Row labels** — Remove the `view === 'crew'` branch that rendered `<CrewLaneLabel>`.
5. **Imports** — Drop now-unused `buildLanes`, `CrewLaneLabel`, and the `Users` icon import.
6. **Delete** `components/views/JobScheduling/CrewLaneLabel.tsx` — orphaned once the teams view is gone.

## Explicitly out of scope (no change)

- **Crew groups/teams as a data concept stay intact.** They still drive month-view job coloring (`crewColorForJob`) and the crew-assignment modal (`CrewSelectionModal`). This removes a *view*, not the model.
- `buildLanes` stays in `services/productionBoard.ts` with its existing tests — a pure, tested function; removing it would mean deleting passing tests for no functional gain. It becomes dead app-code; logged to the deferred-cleanup backlog instead.
- Hours grid, month view, reschedule drawer, and all other behavior are untouched.

## Testing

- No automated test asserts the teams *view*; `productionBoard.test.ts` targets `buildLanes` directly, which we keep — so the suite should stay green.
- Run the existing test suite to confirm no regressions.
- Manual check: load Job Scheduling, confirm exactly two tabs (`Job`, `Crew`) render, that "Crew" shows per-person rows, and that its Board/Hours sub-toggle and per-day availability/hours editing still work.
