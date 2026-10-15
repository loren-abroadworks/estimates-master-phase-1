# Cascade end-date limit

**Date:** 2026-06-05
**Status:** Approved, ready for implementation plan

## Problem

When the "Cascade following jobs" toggle is on, editing a job shifts **every**
following job by the same calendar delta, all the way to the end of the
schedule. There is no upper bound. A single edit can ripple into jobs months
out that the user would rather leave frozen (firm client commitments,
already-confirmed dates).

Users want to cap how far the cascade reaches: set an end date, and any job
scheduled **after** that date is left untouched.

## Decisions (all confirmed with user)

1. **Boundary semantics — compare the job's CURRENT (original) start date.**
   "Don't touch anything currently scheduled after the cutoff." The boundary
   maps to what the user sees on the board right now, giving a predictable
   blast radius. (Rejected: comparing the job's *new* shifted date.)

2. **Jobs exactly ON the cutoff date still move.** The cutoff means "after this
   date is safe," so the date itself is still in play.

3. **Leapfrog handling — allow, but warn.** Because we compare original dates, a
   moved job can slide *past* a protected job (e.g. a job at Mar 18 shifts +5 to
   Mar 23, jumping over a protected job frozen at Mar 22). This is allowed and
   non-blocking, matching how the app already treats same-day conflicts. The
   moved row shows a warning badge. (Rejected: blocking the move, which would
   silently turn into "new-date" semantics at the edge.)

4. **Empty by default — opt-in.** The date control appears when cascade is
   toggled on, but starts empty. Empty = no limit = exactly today's behavior.
   Nothing changes for users who don't need the limit. (Rejected: pre-filling
   with the last job's date, or auto-applying a fixed window.)

## Architecture

### Engine — `services/scheduleEngine.ts`

`cascadeFromEdit` gains one optional parameter:

```ts
export const cascadeFromEdit = (
  jobs: Job[],
  primaryChange: ProposedChange,
  config: WorkingTimeConfig,
  untilDate?: string,   // local 'YYYY-MM-DD'; undefined/empty = no limit
): ProposedChange[]
```

Behavior:

- `untilDate` empty/undefined → unchanged from today.
- `untilDate` set → for each candidate follower, compare its **current start**
  (`oldStart`, by local calendar day) to `untilDate`. If the follower's current
  start day is **strictly after** `untilDate`, it is **not** shifted; it is
  returned as an informational skipped row with a new reason.

New `SkipReason` member: `'after-limit'`.

```ts
export type SkipReason =
  'locked' | 'unscheduled' | 'before-point' | 'out-of-scope' | 'after-limit';
```

Implementation note: `cascadeFromEdit` currently delegates to
`shiftJobsFromPoint` then filters. The cutoff is applied as a post-filter on the
followers returned by `shiftJobsFromPoint`: any follower whose `oldStart` day is
after `untilDate` is converted from a shifted change into an
`{ ...base, skipped: 'after-limit' }` row (keeping its original dates). The
primary change is never affected by the cutoff.

### Leapfrog detection

After the cascade is computed, compare each **moved** follower against the
**protected** (`after-limit`) jobs using the existing same-day/ordering logic
from `detectConflicts`. A moved job that lands on or after a protected job's
start is flagged. The flag is surfaced as a non-blocking warning on that row in
the preview (see UI). Detection lives alongside the existing conflict checks so
both paths render consistently.

### State — `components/views/JobSchedulingView.tsx`

- Add `const [cascadeUntil, setCascadeUntil] = useState<string>('')` next to the
  existing `cascade` state (~line 216).
- Thread `cascadeUntil` into both `cascadeFromEdit` call sites:
  - `handleChangeJobDate` (~line 409)
  - `handleToggleCascade` (~line 419)
- Add a `handleChangeCascadeUntil(date: string)` handler that updates state and
  recomputes the staged changes via `cascadeFromEdit`, mirroring
  `handleToggleCascade`.
- Pass `cascadeUntil` and the handler down to the editor alongside the existing
  `cascade` / `onToggleCascade` props (~line 972).
- Update the `cascadeFollowers` memo (~line 553) so the followers summary can
  also report the protected count (or derive protected count separately from the
  staged `after-limit` rows).

### Editor UI — `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`
and `ReschedulePreviewPanel.tsx`

- New props: `cascadeUntil?: string`, `onChangeCascadeUntil?: (date: string) => void`.
- When cascade is on, render a date control directly under the toggle:

  ```
  [✓] Cascade following jobs
      Stop cascade after: [ date ▼ ]   (empty by default)
  ```

- Followers summary, when a limit is active, reports both sides:

  > "Cascading 3 jobs by +5 days. 2 jobs after Mar 20 left unchanged."

  When no limit is set, the summary is unchanged from today.

### Preview — `reschedule/SingleJobEditor.tsx`

Single-job-edit cascade renders **only** `SingleJobEditor` (see
`ReschedulePreviewPanel.tsx`); `BulkPreview` is for bulk/from-point reschedules
and is not touched. Protected jobs and the leapfrog warning therefore surface
inside the editor's cascade box, not as separate preview rows:

- A protected-count line summarizes the `after-limit` rows:

  > 2 jobs after Mar 20 left unchanged.

- A non-blocking amber warning lists any moved followers that leapfrogged a
  protected job:

  > ⚠️ Job B now lands after a protected job past your cutoff.

  Apply stays enabled (consistent with existing conflict warnings). Protected
  jobs simply keep their board positions (no placeholder), so the board already
  shows them unchanged.

## Testing

### Engine — `services/scheduleEngine.test.ts`

- Cutoff empty/undefined → identical output to current `cascadeFromEdit`.
- Cutoff set → followers with current start after the cutoff become
  `after-limit` skipped rows with original dates preserved.
- A follower scheduled **exactly on** the cutoff date still moves.
- Leapfrog case: a follower before the cutoff shifts past a protected follower;
  assert the moved/protected split and that the protected job keeps its dates.
- Primary change is never affected by the cutoff.

### UI

- Date control renders only when cascade is on; absent when off.
- Clearing the date restores full cascade behavior.
- Followers summary reflects the protected count when a limit is active.

## Out of scope

- Persisting the cutoff date between sessions.
- A cutoff for drag-based / bulk reschedules (this is for single-job edit
  cascade only, matching where `cascadeFromEdit` is used).
- Any change to `shiftJobsFromPoint`'s existing `scope` (crew/category) filter.
