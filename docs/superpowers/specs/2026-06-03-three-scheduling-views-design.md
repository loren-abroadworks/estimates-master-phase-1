# Three Job-Scheduling Views — Design

**Date:** 2026-06-03
**Status:** Approved

## Problem

The Job Scheduling page has two tabs: a crew-grouped production board ("Assignments")
and a per-member availability table ("Availability"). Schedulers want to look at the
same week through different lenses — by crew, by individual team member, and by job —
without leaving the board.

## Goals

- Replace the two tabs with a 3-way view switcher: **Crew · Crew Member · Job**.
- All three are the same week-grid board (day columns) differing only in row grouping.
- Preserve all existing chrome across views: week navigation, Bulk Reschedule,
  drag-to-reschedule → reschedule preview, rain-day marking, right-docked panels.
- Fold the old Availability editing into the Crew Member view.

## Non-Goals

- No crew/member reassignment via drag (drop still only changes the date, as today).
- No new month/calendar or map view.
- Unscheduled-job backlog is out of scope.

## Views

1. **Crew** (current board) — one row per crew. Unchanged; `buildLanes`.
2. **Crew Member** — one row per team member. A job appears in the row of every member
   assigned to it (`crewMemberIds`, unioned with `allocations[].memberIds`); members with
   no jobs still render. Each member/day cell shows the member's availability (Available
   `start–end`, or OFF + reason) behind their job cards; clicking the cell's availability
   area opens the existing `EditAvailabilityModal`. Jobs with no resolvable member fall to
   an "Unassigned" row.
3. **Job** — one row per job that occupies the visible week; the job's card sits on its
   scheduled day(s). Ordered by start day, then name.

## Architecture

### Lane builders (`services/productionBoard.ts`, pure + unit-tested)

Reuse the existing `BoardLane` shape (`{ crewId, crewName, cardsByDay }`) as a generic
row (`crewId`/`crewName` act as row id/label). Reuse `BoardCard`, `jobColor`,
`occupiesWorkingDay`, and the existing job filter (`startDate` present; stage not
Completed/Marketing/Cancelled).

```ts
buildMemberLanes(jobs: Job[], staff: CrewMember[], weekDays: Date[], config): BoardLane[]
// - seed a lane per staff member (crewId = member.id, crewName = member.name)
// - memberIdsOf(job) = unique(job.crewMemberIds ∪ job.allocations[].memberIds)
// - push each job's card to every assigned member's lane on occupied days
// - jobs with no resolvable member → 'unassigned' lane
// - order: staff input order, 'unassigned' last

buildJobLanes(jobs: Job[], weekDays: Date[], config): BoardLane[]
// - one lane per job that occupies ≥1 visible day (crewId = job.id, crewName = job.name)
// - card placed on occupied days
// - order: by earliest occupied dayKey, then name
```

### `ProductionBoard` generalization

The board currently builds crew lanes internally. Generalize it to render any lanes:

- Accept `lanes: BoardLane[]` as a prop (caller builds them); drop the internal
  `buildLanes` call and the now-unused `jobs`/`crews` props.
- Add optional render hooks, all backward-compatible (crew view passes none):
  - `renderRowLabel?: (lane: BoardLane) => React.ReactNode` — default renders `lane.crewName`.
  - `renderCellExtra?: (laneId: string, dayKey: string) => React.ReactNode` — rendered
    behind the cards (member availability overlay).
  - `onCellActivate?: (laneId: string, dayKey: string) => void` — fired when the cell
    background (not a card) is clicked (member → edit availability).
- Drag/drop, rain-day context menu, ghost, and `JobCard` rendering are unchanged. Drop
  still calls `onDropJob(jobId, dayKey)` (date-only move) for every variant.
- `JobCard`'s `onClick` gains `e.stopPropagation()` so clicking a card doesn't also fire
  the cell's `onCellActivate`.

### `JobSchedulingView` changes

- Replace `activeTab: 'availability' | 'assignments'` with `view: 'crew' | 'member' | 'job'`
  (default `'crew'`); rebuild the tab bar as a 3-way switcher.
- Build the lanes per view with `useMemo` and pass to one `ProductionBoard`:
  - crew → `buildLanes(jobs, crews, weekDays, config)`.
  - member → `buildMemberLanes(jobs, allStaff, weekDays, config)` + `renderRowLabel`
    (avatar + name + role), `renderCellExtra` (availability from `emp.schedule[dayKey]`),
    `onCellActivate` → `openAvailabilityModal(emp, day)`.
  - job → `buildJobLanes(jobs, weekDays, config)` + `renderRowLabel` (job name).
- Remove the old `availability` table block; `EditAvailabilityModal` is reused by the
  member view's `onCellActivate`.
- The right-docked panel gutter (`panelOpen` → `lg:pr-[440px]`) and Bulk Reschedule are
  unaffected; the view switcher and week nav remain above the board in every view.

## Testing

- `services/productionBoard.test.ts`: add cases for `buildMemberLanes` (one lane per
  member, multi-member duplication, Unassigned bucket, empty-member lane seeded) and
  `buildJobLanes` (one lane per occupying job, ordering, excludes non-occupying/Completed).
- Light render test: `ProductionBoard` renders a passed `renderRowLabel` and fires
  `onCellActivate` on cell-background click.

## Risks / Notes

- A multi-member job duplicates across rows in the Member view (intended) — the same
  `jobId` card appears in several lanes; React keys are per-lane so this is fine.
- `BoardLane.crewId/crewName` are repurposed as generic id/label to avoid churning the
  type and its existing tests; field names stay but semantics generalize.
