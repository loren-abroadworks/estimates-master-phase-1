# Job Scheduling Shifts — Design

**Date:** 2026-07-10
**Status:** Approved (design)

## Problem

The Work Order page lets a user add multiple **shifts** to a job — different groups
of people working different days and different hours — via "Add Shift". The Job
Scheduling page cannot: its crew assignment collapses everything into a single
crew for the whole job. Users want the same shift granularity while scheduling,
including a "microscale" per-day/per-shift view of who works when.

### Root cause of the gap

The data model already supports shifts. Both `Job` and `WorkOrder` carry
`allocations: JobCrewAllocation[]`, and a `JobCrewAllocation` **is** a shift
(name, member list, date range, start/end time, per-member/per-day hours). The
*reading* side already loops over all allocations (`memberJobDayHours`,
`assignedHoursForJobInWeek`). But every *write* path in Job Scheduling hardcodes
`allocations[0]`:

- `JobSchedulingView.handleSaveCrewModal` always writes `allocations: [full]` and
  only ever edits `allocations[0]`.
- `crewHoursGrid.ts`: `setMemberDayHours`, `setMemberDayHoursPreservingSpan`,
  `assignMemberWeek` all target `ensureAllocations(job)[0]`.

So: model ✅ shifts, reads ✅ shifts, writes (Job Scheduling) ❌ one crew per job.

## Decisions (from brainstorming)

1. **Goal:** define and edit multiple shifts per job on the Job Scheduling page.
2. **Member × shift:** many-to-many — a member can be in multiple shifts on the
   same job (e.g. morning Prep + afternoon Finish).
3. **Shift hours:** per-day windows *within* a shift — each shift has its own
   per-day time grid, not just one window for its whole span.
4. **Editor:** one shared shift editor, surfaced from the Details panel, the
   schedule/reschedule drawer, and the sidebar.
5. **Boards:** per-shift bars on **both** the day board and the week board.
6. **Drag a shift bar:** moves **only that shift**; the job envelope recomputes.
7. **Cascade (when toggle ON):** job-granular for this phase — a shift move
   cascades whole downstream **jobs** that share the moved shift's members
   (see Approach note). Shift-granular cascade is a deferred follow-up.

## Approach

Chosen: **shift-native everywhere** (make "shift" first-class across the page)
rather than bolting a shift editor onto one entry point. Rejected alternatives:
"shifts as data, light UI" (leaves the Hours grid coarse — the exact pain point)
and "hours-grid-first" (heavy grid rewrite, diverges from the Work Order pattern).

## Design

### 1. Data model & migration

Extend `JobCrewAllocation` with per-day windows:

```ts
export interface JobCrewAllocation {
  id: string;
  name: string;                 // "Prep Crew", "Finish Team"
  memberIds: string[];
  startDate: string;            // shift span (YYYY-MM-DD)
  endDate: string;
  startTime: string;            // default window; per-day fallback
  endTime: string;
  color?: string;
  dailyHours?: Record<string, { startTime: string; endTime: string }>; // NEW
  hoursAssignments?: Record<string, Record<string, number>>;           // unchanged
}
```

- A shift's window on a day resolves as
  `alloc.dailyHours[day] ?? { alloc.startTime, alloc.endTime }`. Shifts with one
  window leave `dailyHours` empty and behave exactly as today — so the Work Order
  editor is unaffected.
- `Job.dailyHours` remains for whole-job time-shift/envelope math; the Hours grid
  and boards switch to reading each **shift's** window for its chips/bars.

**Migration (no data rewrite):**

- Reads already iterate `allocations[]`.
- `ensureAllocations` already synthesizes one shift named "Crew" for legacy jobs
  (`crewMemberIds`-only or a single unnamed allocation). This is the migration
  hook; a shift-less job simply shows one shift.
- **Write paths gain a `shiftId` (allocation id) parameter** — `setMemberDayHours`,
  `setMemberDayHoursPreservingSpan`, `assignMemberWeek`, and the view's
  `handleSaveCrewModal` — targeting the right shift, defaulting to the primary
  shift when only one exists.

### 2. Shared shift editor & entry points

- **`CrewSelectionModal`** (already used by Work Orders for one shift) gains a
  **per-day window row** so each day of the shift carries its own start/end time
  (writing `alloc.dailyHours`). Empty `dailyHours` ⇒ unchanged single-window
  behavior.
- **`ShiftList`** — the card list ("Add Shift", edit, delete), extracted from the
  inline markup in `WorkOrderView` (~lines 571–645) into a shared, storage-agnostic
  component taking `allocations` + `onChange(allocations)`. Reused by both
  `WorkOrderView` and Job Scheduling so the pages are identical and the logic
  lives once.
- **Entry points (all open the same editor):**
  - *Details panel* — "Manage crew" hosts `ShiftList` for the selected job
    (primary place, matches Work Orders).
  - *Schedule/reschedule drawer* — `SingleJobEditor`'s Crew section renders a
    compact `ShiftList`; edits stage into the drawer's pending state
    (`stagedCrewByJob`) and commit on Apply, like date edits.
  - *Sidebar / grid quick-assign* — resolves to a shift (see §5).
- **Write path:** `handleSaveCrewModal` updates the specific shift within
  `job.allocations[]` (add / replace by `id` / delete), mirroring
  `WorkOrderView.handleUpdateCrewAllocation`. Standalone edits write through
  `onUpdateJob`; in-drawer edits stage.

### 3. Hours grid becomes shift-aware

One chip per **(job, shift)** instead of per job:

- `MemberDayCell` gains `shiftId` + `shiftName`. `buildCrewHoursGrid` iterates the
  member's shifts on that job/day (via `alloc.memberIds` + `hoursAssignments`),
  emitting one chip per shift the member works that day. A member in Prep (8–12,
  4h) and Finish (1–5, 4h) shows two chips.
- **Color & label:** chips tinted by shift (`alloc.color`, fallback: a shade of
  the job color) with a small shift-name label. Single-shift jobs look
  essentially unchanged (one chip, job color).
- **Window shown** comes from the shift's per-day window
  (`alloc.dailyHours[day] ?? alloc.start/endTime`), not `Job.dailyHours`.
- **Editing targets the shift:** `EditableHoursChip` edit/remove callbacks
  (`onEditDay`/`onRemoveDay` → `handleHoursEditDay` → `setMemberDayHours`) gain a
  `shiftId`, so hours update that shift's `hoursAssignments`.
  `setMemberDayHoursPreservingSpan` and `assignMemberWeek` take the same param.
- **Roll-ups unchanged:** day/week totals already sum all chips; per-shift chips
  sum to the same job total. Capacity/over-assignment warnings keep working.

### 4. Board rendering (day + week)

`BoardCard` gains shift identity (`shiftId`, `shiftName`, shift `color`). Lane
builders iterate shifts, not whole jobs:

- **Day board, Crew (member) view:** blocks built per `(member, shift)` using the
  shift's per-day window. Two shifts that day → two time blocks; existing
  overlap/segment layout handles them.
- **Week board:**
  - *Crew view:* one bar per shift the member is in, spanning the shift's days.
  - *Job view:* one bar per shift, each spanning its own range (a 3-shift job
    shows 3 stacked bars).
- **`layoutLaneBars` keys by `(jobId, shiftId)`** instead of `jobId`, so same-job
  shifts don't collapse into one bar; track-stacking handles overlaps.
- **Day occupancy** uses the shift's span (and, for member lanes, membership in
  that shift), not the job envelope.
- **Bar label/color:** shift name + shift window (or "varies" when its per-day
  windows differ), tinted by shift color. Legacy jobs synthesize one "Crew"
  shift → one bar, exactly like today.
- **Job envelope** (`Job.startDate/endDate`) recomputes to cover all shifts, so
  cascade/reschedule date math and month view stay correct.

### 5. Sidebar & quick-assign

- **"Jobs this week" sidebar** stays job-oriented for staffing progress; its
  assign action opens the shared shift editor for that job so you assign into a
  specific shift.
- **Drag-a-job-onto-a-member** needs a shift target: one shift ⇒ assign into it;
  multiple ⇒ small shift picker (or "New shift").
- **Assign Hours modal** (`assignMemberWeek` / `handleAssignDaysSubmit`) takes the
  `shiftId`, defaulting to the only/primary shift.

### 6. Drag & cascade

- **Dragging a shift bar** moves only that shift's dates; the job envelope
  recomputes to cover the remaining shifts.
- **Cascade toggle ON:** job-granular for this phase. If the moved shift's members
  appear in a later job, that whole job cascades (all its shifts move together),
  reusing today's cascade engine (`shiftJobsFromPoint`, `cascadeForPrimary`,
  `sharedCrewScope`, `reflowAvoidingConflicts`) with a shift as the trigger.
  - *Rationale:* the cascade engine reasons at job granularity and is heavily
    tested there. Job-level cascade keeps the mental model identical, avoids a
    risky rewrite, and remains correct (never leaves a double-book) — only
    slightly conservative (may slide a whole downstream job when one of its shifts
    strictly conflicts).
- **Same-job shift overlaps** (a member now in two overlapping shifts of one job)
  are caught by the existing same-day conflict resolution
  (`resolveSameDayConflicts`).
- **Deferred follow-up:** true shift-granular cascade (reflow only later *shifts*
  sharing the moved members).

## Testing strategy

TDD — every new behavior gets a failing test first; the full suite stays green.

- **Services** (`crewHoursGrid.test.ts`, `scheduleEngine.test.ts`, new shift helpers):
  write paths target the specified shift (default primary); `memberJobDayHours`
  sums a member across multiple shifts; per-day window resolution; `ensureAllocations`
  migration (legacy + multi-shift); job-envelope recompute.
- **Boards** (`productionBoard.test.ts`, `dayBoard.test.ts`): one bar per
  `(job, shift)`; `layoutLaneBars` keys by `(jobId, shiftId)` and stacks same-job
  shifts; day-board member blocks use the shift's per-day window.
- **Cascade** (`scheduleEngine.test.ts`, `rescheduleIssues.test.ts`): shift drag
  moves only that shift; cascade ON slides downstream jobs sharing the moved
  members; same-job overlaps flagged.
- **Components** (`ShiftList.test.tsx`, `CrewSelectionModal.test.tsx`,
  `CrewHoursGrid.test.tsx`): add/edit/delete shifts; per-day window row; grid
  renders one chip per shift with shift color/label; chip edits target their shift.

## Out of scope (this phase)

- Shift-granular cascade (only downstream *shifts* sharing members).
- Per-shift bars auto-splitting the month view.
- Any change to how Work Orders create shifts (they keep using the shared editor
  with single-window shifts).
