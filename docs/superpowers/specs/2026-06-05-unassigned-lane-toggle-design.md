# Unassigned Lane — Naming & Toggle Design

**Date:** 2026-06-05
**Surface:** Job Scheduling → Crew board (week view, `boardMode === 'board'`)

---

## REVISION (2026-06-05, same day) — "Unassigned" reframed as "Available this week"

User clarification after first cut: the "Unassigned" row (a bucket for *jobs with no crew*)
was confusing in the per-person Crew view. What they actually want is to see **which crew
members are free** that week. Final behavior shipped:

- **Removed** the orphan-jobs "Unassigned" lane from the Crew board entirely. A job whose
  crew can't be resolved to a known member no longer appears on the per-member board (it
  still shows in the Job view).
- **Removed** the "Show unassigned" toggle (obsolete with the bucket gone).
- `buildMemberLanes` now flags every member with **no assigned work that week** as
  `available: true` and sorts them after the busy members.
- `ProductionBoard` renders an **"Available this week (N)"** section divider before the
  first available member, grouping free crew at the bottom by name.
- **Kept** from the first cut: seed active members only; a job assigned to an inactive
  member still gets its own named lane with an "Inactive" badge (`BoardLane.inactive`).

The sections below describe the original (superseded) toggle design; kept for the decision trail.

---

## Problem

On the Crew board, every job whose crew can't be matched to a recognized member is dumped into a single generic **"Unassigned"** lane. Two issues:

1. When the lane sits empty it's just dead space at the bottom of the board.
2. A job that *does* reference a real person — one who happens to be inactive/removed from the active roster — loses that identity; you can no longer tell who it was meant for.

## Goals

1. **Name the assigned person.** A job only falls into "Unassigned" when it has *no* crew members at all. If it references a member who exists in the roster but isn't active, that job gets its own row labeled with the person's name, subtly marked inactive.
2. **Toggle the Unassigned lane.** A "Show unassigned" control on the Crew board header lets the user hide the Unassigned lane. Default ON, so a job with nobody assigned is never silently hidden.

## Non-Goals

- No change to empty rows for *active* crew who have no work this week.
- No change to the Hours grid or Month view (the Unassigned lane is a week-board concept only).
- No persistence across sessions — toggle state lives in the view component.

## Design

### 1. `buildMemberLanes` (`services/productionBoard.ts`)

Today it seeds a lane for every member in the passed roster and routes any job with no *roster-matched* member to `'unassigned'`. Change the rules:

- **Seed only active members** (`status !== 'Inactive'`) — these always render, in input order, even with no work.
- For each job, resolve its member ids against the **full** roster (active *and* inactive). Each matched member gets a lane created **on demand** if not already seeded. Inactive members therefore only appear when they actually have a job.
- A lane created for an inactive member is flagged `inactive: true`.
- A job with **zero** roster-matched members routes to `'unassigned'` (unchanged behavior for the genuinely-unstaffed case).
- Ordering: active/seeded and inactive lanes keep insertion order (active first, since they're seeded before the job loop); `'unassigned'` always sorts last.

`BoardLane` gains an optional field:

```ts
export interface BoardLane {
  crewId: string;
  crewName: string;
  cardsByDay: Record<string, BoardCard[]>;
  inactive?: boolean;   // member exists in roster but status === 'Inactive'
}
```

`buildMemberLanes` keeps the same signature — it already receives the full roster (`allStaff`); the active/inactive split happens inside.

### 2. Crew board toggle (`components/views/JobSchedulingView.tsx`)

- New view state: `const [showUnassigned, setShowUnassigned] = useState(true);`
- `boardLanes` for the member view filters out the `'unassigned'` lane when `!showUnassigned`.
- A small toggle button beside the existing Board/Hours switch, rendered only when the Crew board is the active surface (`view === 'member' && boardMode === 'board' && scale === 'week'`) **and** an Unassigned lane actually exists. Hidden otherwise so it never appears as a no-op control.
- The member-view `renderRowLabel` shows a subtle "Inactive" badge when `lane.inactive` is true.

## Testing

Unit tests in `services/productionBoard.test.ts` for `buildMemberLanes`:

- Seeds only active members (an inactive member with no work produces no lane).
- A job assigned to an inactive member gets its own lane named after that member, flagged `inactive`, not folded into Unassigned.
- A job with no members still routes to a last-place `'unassigned'` lane (regression guard for existing behavior).

Existing tests that pass plain `{id,name,role}` staff (no `status`) must keep passing — absent `status` is treated as active.
