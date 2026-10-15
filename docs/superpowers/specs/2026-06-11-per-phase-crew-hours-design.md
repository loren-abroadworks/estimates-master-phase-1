# Per-Phase Crew Hours (Jobs This Week) — Design

**Date:** 2026-06-11
**Status:** Approved (pending implementation plan)

## Goal

In the "Jobs This Week" panel of the crew hours grid, let the user see how many
hours each **phase** of a job needs (e.g. the wash) and drag a single phase onto
a crew member so the assigned hours count **exclusively** toward that phase.

## Definitions

- **Phase** = one work-order task line item. For "Exterior Repaint" the phases are
  *Pressure Wash* (8h), *Scrape & Prime* (15h), *Siding Repaint* (35h),
  *Trim & Fascia* (20h), *Door & Railings* (7h). "The wash" = the *Pressure Wash*
  task.
- A phase's **estimated hours** = its `WorkOrderTask.estimatedHours`.
- Work-order tasks have **no dates of their own**. A phase therefore scopes *which
  bucket* hours count toward, not which days. The available days when assigning a
  phase are the job's working days in the current week (same as a whole-job assign).

## Architecture

Phase-tagged hours reuse the existing `JobCrewAllocation` array on a `Job`:

- Add optional `taskId?: string` to `JobCrewAllocation`. Its existing `name` field
  holds the phase label (the task description).
- Hours for a phase live in that allocation's
  `hoursAssignments[memberId][dateKey] = hours`.
- Because existing roll-ups (`memberJobDayHours`, `assignedHoursForJobInWeek`)
  already sum across **all** allocations, phase hours automatically roll up into
  the job's existing week total (e.g. `81 / 85h`) and missing-hours math. No double
  counting and no change to those functions.
- **Legacy / untagged hours** (assigned via `crewMemberIds` or an allocation with
  no `taskId`) keep working unchanged; they are simply "not tied to a phase."

### `taskId` resolution

A phase row maps to a `WorkOrderTask` via the job's linked work order
(`job.workOrderId` -> `WorkOrder.tasks`). The allocation that carries those hours
stores `taskId = task.id` and `name = task.description`.

## Components & Data Flow

### `services/crewHoursGrid.ts`

New pure helpers (no React):

- `buildPhaseRows(job, workOrder, weekKeys, standardDay): PhaseRow[]`
  - `PhaseRow = { taskId: string; name: string; estimated: number; assigned: number }`
  - `estimated` = `task.estimatedHours` (prorated to the week the same way
    `requiredHoursForWeek` prorates the job: by the share of the job's working days
    that fall in this week). Reuse the same proration ratio the job uses.
  - `assigned` = sum over all members and this week's days of hours in the
    allocation whose `taskId === task.id`.
  - Phases with `estimated === 0` are omitted.
  - Returns `[]` when the job has no linked work order or no tasks.

- `setMemberPhaseDayHours(job, taskId, phaseName, memberId, dateKey, hours): Job`
  - Finds the allocation with matching `taskId`; creates one
    (`{ id, name: phaseName, taskId, startDate, endDate, startTime, endTime,
    memberIds: [], hoursAssignments: {} }`) if none exists, seeded from the job's
    span/clock.
  - Writes/clears `hoursAssignments[memberId][dateKey]` exactly like
    `setMemberDayHours`, and maintains that allocation's `memberIds` (member dropped
    from the phase when their last day there hits 0). Removal is scoped to the
    phase only — other phases and legacy hours are untouched.
  - Returns a new `Job` via the existing `withFlattenedCrew` so `crewMemberIds`
    stays in sync. Pure (no mutation of the input).

The week model (`CrewHoursGridModel`) is unchanged; phase rows are derived on
demand in the component from the same `jobs`/`workOrders` already in scope.

### `components/views/JobScheduling/CrewHoursGrid.tsx`

- The "Jobs This Week" job card is unchanged when collapsed. When the job has
  phase rows, render a **"▾ Phases"** disclosure toggle at the bottom of the card.
- Expanded: a list of phase rows. Each row shows a drag handle, the phase name, and
  `assigned / estimated` hours (e.g. `0 / 8h`) — green when `assigned >= estimated`,
  amber when short. State for which cards are expanded is local component state
  keyed by job id.
- Each phase row is `draggable`. On `dragStart` it sets the existing
  `JOB_DND_TYPE` to the job id (so existing member-row drop targets still fire) and
  a new `JOB_PHASE_DND_TYPE` to the `taskId`. The whole-job drag on the card header
  still works (no phase => no taskId).
- The member-row drop handler reads the optional phase payload and forwards it.

### Drop → Assign Hours

- `onDropJobOnMember` gains an optional `taskId` (and phase name) argument.
- `JobSchedulingView` opens the existing `AssignHoursModal` with a new optional
  phase scope: `{ taskId, phaseName }`.
- `AssignHoursModal`, when given a phase scope:
  - Shows the phase name in its title (e.g. "Assign Pressure Wash to Mike").
  - Its "hours needed" readout reflects the **phase's** estimated hours, not the
    whole job.
  - Day inputs read/write the phase's allocation: existing values come from the
    `taskId` allocation; saving calls `setMemberPhaseDayHours`.
  - Without a phase scope the modal behaves exactly as today.

### Grid day-cell chip

When a member's hours come from a phase allocation, the day-cell chip shows the
phase name as a small tag under the job name (e.g. *Exterior Repaint* with a "Wash"
sub-label). Untagged/legacy chips render exactly as today. `MemberDayCell` gains an
optional `phaseName?: string`, populated in `buildCrewHoursGrid` from the
allocation's `name` when its `taskId` is set.

## Error / Edge Handling

- Job with no work order or no tasks: no "Phases" toggle; whole-job drag still works.
- Phase with 0 estimated hours: hidden from the list.
- A member assigned to multiple phases of the same job on the same day produces
  multiple chips (one per phase) in that day cell — expected and correct.
- Clearing a phase day to 0 removes only that phase allocation entry for the member.
- Existing untagged assignments are never silently re-tagged to a phase.

## Testing

`services/crewHoursGrid.test.ts`:
- `buildPhaseRows`: estimated pulled per task and prorated to the week; `assigned`
  summed only from the matching `taskId` allocation; zero-estimate phases omitted;
  empty when no work order/tasks.
- `setMemberPhaseDayHours`: creates a `taskId` allocation when none exists; hours
  roll up into `assignedHoursForJobInWeek`; setting another phase doesn't disturb
  the first; clearing to 0 removes the member from that phase only; input not
  mutated.

`components/views/JobScheduling/CrewHoursGrid.test.tsx`:
- Phases toggle expands to show rows; a phase row shows `assigned / estimated`;
  a phase row is draggable and carries its `taskId` on `dragStart`.

`components/views/JobScheduling/AssignHoursModal.test.tsx`:
- Given a phase scope, the title and hours-needed readout reflect the phase, and
  saving writes to the phase allocation.

## Out of Scope (YAGNI)

- Phase-level date ranges (tasks have no dates).
- Reordering or editing phases (they come from the work order).
- Showing phases anywhere other than the "Jobs This Week" panel and the resulting
  grid chips.
