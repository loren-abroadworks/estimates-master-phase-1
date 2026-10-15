# Cascade Following Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in "Cascade following jobs" toggle to the Edit Schedule sidebar so moving a job's start date shifts every later job by the same number of days.

**Architecture:** A pure engine helper (`cascadeFromEdit`) computes the merged change set (primary edit + calendar-shifted followers) by reusing the existing `shiftJobsFromPoint`. The single-edit staged preview carries a `primaryJobId` so the panel renders the editor for the edited job rather than the first row. `JobSchedulingView` holds the toggle state and recomputes the staged changes when the date or toggle changes. The existing apply path, daily-hours seeding, and conflict detection already iterate all staged changes, so followers persist and are validated for free.

**Tech Stack:** React + TypeScript, Vitest, Tailwind. Pure scheduling engine in `services/scheduleEngine.ts`.

---

## File Structure

- `services/scheduleEngine.ts` — add pure `cascadeFromEdit` helper (Task 1).
- `services/scheduleEngine.test.ts` — engine tests (Task 1).
- `services/reschedulePreview.ts` — add `primaryJobId` to `StagedReschedule` (Task 2).
- `components/views/JobScheduling/ReschedulePreviewPanel.tsx` — render editor for the primary job; thread cascade props (Task 2, Task 4).
- `components/views/JobSchedulingView.tsx` — `cascade` state, toggle handler, updated `handleChangeJobDate`, set `primaryJobId`, compute followers, board overlay (Task 3, Task 5).
- `components/views/JobScheduling/reschedule/SingleJobEditor.tsx` — toggle + info tooltip + followers summary (Task 4).
- `components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx` — component tests (Task 4).

---

## Task 1: Engine — `cascadeFromEdit`

**Files:**
- Modify: `services/scheduleEngine.ts`
- Test: `services/scheduleEngine.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `services/scheduleEngine.test.ts`:

```ts
import { cascadeFromEdit } from './scheduleEngine';

describe('cascadeFromEdit', () => {
  // Primary j1 originally Jun 2; followers j2 (Jun 4) and j3 (Jun 9). cfg skips weekends.
  const jobs = [
    j({}),
    j({ id: 'j2', jobNumber: 'J-2', name: 'Job 2', startDate: '2026-06-04T08:00:00', endDate: '2026-06-04T17:00:00' }),
    j({ id: 'j3', jobNumber: 'J-3', name: 'Job 3', startDate: '2026-06-09T08:00:00', endDate: '2026-06-09T17:00:00' }),
  ];
  const primaryMovedTwoDays = {
    jobId: 'j1', jobName: 'Job 1', jobNumber: 'J-1',
    oldStart: '2026-06-02T08:00:00', oldEnd: '2026-06-02T17:00:00',
    newStart: '2026-06-04T08:00:00', newEnd: '2026-06-04T17:00:00',
  };

  it('shifts every later job by the same calendar delta as the primary start', () => {
    const changes = cascadeFromEdit(jobs, primaryMovedTwoDays, cfg);
    // primary kept verbatim as the first row
    expect(changes[0]).toEqual(primaryMovedTwoDays);
    const j2 = changes.find(c => c.jobId === 'j2');
    const j3 = changes.find(c => c.jobId === 'j3');
    // +2 calendar days each, NOT weekend-skipped
    expect(j2?.newStart).toBe('2026-06-06T08:00:00.000Z'.slice(0, 10) + 'T08:00:00');
    expect(j3?.newStart.slice(0, 10)).toBe('2026-06-11');
  });

  it('returns only the primary change when the start did not move', () => {
    const noMove = { ...primaryMovedTwoDays, newStart: '2026-06-02T08:00:00', newEnd: '2026-06-02T17:00:00' };
    expect(cascadeFromEdit(jobs, noMove, cfg)).toEqual([noMove]);
  });

  it('leaves locked and earlier jobs out of the follower set', () => {
    const withLockedAndEarlier = [
      ...jobs,
      j({ id: 'j4', jobNumber: 'J-4', name: 'Locked', startDate: '2026-06-10T08:00:00', endDate: '2026-06-10T17:00:00', is_locked: true }),
      j({ id: 'j5', jobNumber: 'J-5', name: 'Earlier', startDate: '2026-05-30T08:00:00', endDate: '2026-05-30T17:00:00' }),
    ];
    const changes = cascadeFromEdit(withLockedAndEarlier, primaryMovedTwoDays, cfg);
    const ids = changes.map(c => c.jobId);
    expect(ids).not.toContain('j4'); // locked → skipped → excluded
    expect(ids).not.toContain('j5'); // before the primary → excluded
    expect(ids).toEqual(expect.arrayContaining(['j1', 'j2', 'j3']));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/scheduleEngine.test.ts -t cascadeFromEdit`
Expected: FAIL — `cascadeFromEdit is not a function` / not exported.

- [ ] **Step 3: Implement `cascadeFromEdit`**

In `services/scheduleEngine.ts`, after the `shiftJobsFromPoint` function, add:

```ts
/** Local-midnight epoch ms for a date, ignoring time-of-day (calendar-day math). */
const localDayStartMs = (iso: string): number => {
  const d = new Date(iso);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};

/**
 * Cascade helper for single-job edits. Keeps the user's freely-edited primary
 * change and shifts every job scheduled AFTER the primary's original start by the
 * same number of CALENDAR days the primary's start moved, so the gaps between jobs
 * are preserved. Followers move by a pure calendar delta (never weekend-skipping)
 * to stay aligned with the primary's explicit new date. Locked, unscheduled, and
 * earlier jobs are left untouched.
 *
 * Returns [primaryChange, ...shiftedFollowers]. When the start did not move
 * (delta 0) or the primary has no original start, returns [primaryChange] only.
 */
export const cascadeFromEdit = (
  jobs: Job[],
  primaryChange: ProposedChange,
  config: WorkingTimeConfig,
): ProposedChange[] => {
  if (!primaryChange.oldStart) return [primaryChange];
  const deltaDays = Math.round(
    (localDayStartMs(primaryChange.newStart) - localDayStartMs(primaryChange.oldStart)) / MS_PER_DAY,
  );
  if (deltaDays === 0) return [primaryChange];
  const calendarConfig = { ...config, skipNonWorkingDays: false };
  const shifted = shiftJobsFromPoint(jobs, primaryChange.oldStart, deltaDays, 'days', calendarConfig);
  const followers = shifted.filter(c => c.jobId !== primaryChange.jobId && !c.skipped);
  return [primaryChange, ...followers];
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run services/scheduleEngine.test.ts -t cascadeFromEdit`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat: add cascadeFromEdit engine helper for single-job cascade"
```

---

## Task 2: Carry `primaryJobId` through the staged edit and render the right job

**Files:**
- Modify: `services/reschedulePreview.ts`
- Modify: `components/views/JobScheduling/ReschedulePreviewPanel.tsx:58`
- Modify: `components/views/JobSchedulingView.tsx` (two edit-stage sites: `handleDropJob` ~line 346, `handleRescheduleJob` ~line 629)

- [ ] **Step 1: Add `primaryJobId` to the staged type**

In `services/reschedulePreview.ts`, add the field to `StagedReschedule` (after `mode`):

```ts
  /** Which drawer experience to render: single-job editor vs bulk preview. */
  mode: 'edit' | 'bulk';
  /** In edit mode, the job actually being edited (the editor + header key off it,
   *  even when cascade adds follower rows to `changes`). */
  primaryJobId?: string;
```

- [ ] **Step 2: Render the editor for the primary job in the panel**

In `components/views/JobScheduling/ReschedulePreviewPanel.tsx`, replace line 58:

```ts
  const editChange = changed[0];
```

with:

```ts
  const editChange = staged.primaryJobId
    ? (changed.find(c => c.jobId === staged.primaryJobId) ?? changed[0])
    : changed[0];
```

- [ ] **Step 3: Set `primaryJobId` at both edit-stage sites**

In `components/views/JobSchedulingView.tsx`, `handleDropJob` (~line 346), add `primaryJobId`:

```ts
    preview.stage({
      changes: [change],
      label: `Move ${job.name}`,
      mode: 'edit',
      primaryJobId: jobId,
      commit: (eff) => onApplySchedule(eff, `Move ${job.name}`),
    });
```

In `handleRescheduleJob` (~line 629), add `primaryJobId`:

```ts
    preview.stage({ changes: [change], label, mode: 'edit', primaryJobId: job.id, commit: (eff) => onApplySchedule(eff, label), recompute, delayDays: 0 });
```

- [ ] **Step 4: Verify type-check and existing tests pass**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in the modified files.

Run: `npx vitest run services/reschedulePreview.test.ts components/views/JobScheduling/ReschedulePreviewPanel.test.tsx`
Expected: PASS (existing tests unaffected — `primaryJobId` is optional and falls back to `changed[0]`).

- [ ] **Step 5: Commit**

```bash
git add services/reschedulePreview.ts components/views/JobScheduling/ReschedulePreviewPanel.tsx components/views/JobSchedulingView.tsx
git commit -m "feat: carry primaryJobId so the editor renders the edited job under cascade"
```

---

## Task 3: View — cascade state and recompute on edit/toggle

**Files:**
- Modify: `components/views/JobSchedulingView.tsx` (state near line 212; `handleChangeJobDate` ~line 388; stage sites from Task 2)

- [ ] **Step 1: Add cascade state and reset it when a single edit is staged**

In `components/views/JobSchedulingView.tsx`, near the other reschedule state (~line 212), add:

```ts
  // "Cascade following jobs" toggle for the single-job editor. Opt-in per edit.
  const [cascade, setCascade] = useState(false);
```

Reset it to `false` in **both** edit-stage sites so each editor opens with cascade off.
In `handleDropJob`, immediately before `preview.stage({`:

```ts
    setCascade(false);
```

In `handleRescheduleJob`, immediately before `preview.stage({`:

```ts
    setCascade(false);
```

- [ ] **Step 2: Add a helper that recomputes the staged set from the primary change**

In `components/views/JobSchedulingView.tsx`, import `cascadeFromEdit` by adding it to the existing `scheduleEngine` import (line 13):

```ts
import { ProposedChange, configFromSettings, moveJobToSlot, shiftJobsFromPoint, toLocalDateKey, spannedDayKeys, workingDayKeys, applyDailyHours, cascadeFromEdit } from '../../services/scheduleEngine';
```

Replace `handleChangeJobDate` (~lines 388-406) with a version that recomputes the primary change, then expands to followers when cascade is on:

```ts
  const handleChangeJobDate = (jobId: string, field: 'start' | 'end', value: string) => {
    if (!value) return;
    const s = preview.staged;
    if (!s) return;
    const primaryId = s.primaryJobId ?? jobId;
    const prev = s.changes.find(c => c.jobId === primaryId && !c.skipped);
    if (!prev) return;
    const keys = spannedDayKeys(prev.newStart, prev.newEnd);
    let startDate = keys[0];
    let endDate = keys[keys.length - 1];
    if (field === 'start') startDate = value; else endDate = value;
    if (endDate < startDate) endDate = startDate; // keep end on/after start
    const primaryChange: ProposedChange = {
      ...prev,
      newStart: `${startDate}T${hhmm(prev.newStart)}:00`,
      newEnd: `${endDate}T${hhmm(prev.newEnd || prev.newStart)}:00`,
    };
    preview.setChanges(cascade ? cascadeFromEdit(jobs, primaryChange, workConfig) : [primaryChange]);
  };
```

- [ ] **Step 3: Add the toggle handler**

In `components/views/JobSchedulingView.tsx`, directly after `handleChangeJobDate`, add:

```ts
  const handleToggleCascade = (on: boolean) => {
    setCascade(on);
    const s = preview.staged;
    if (!s) return;
    const primaryId = s.primaryJobId;
    const primary = s.changes.find(c => c.jobId === primaryId && !c.skipped) ?? s.changes.find(c => !c.skipped);
    if (!primary) return;
    preview.setChanges(on ? cascadeFromEdit(jobs, primary, workConfig) : [primary]);
  };
```

- [ ] **Step 4: Verify type-check passes**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (`handleToggleCascade` is wired into the panel in Task 4.)

- [ ] **Step 5: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: cascade state + recompute staged changes on edit/toggle"
```

---

## Task 4: SingleJobEditor UI — toggle, info tooltip, followers summary

**Files:**
- Modify: `components/UI.tsx` (`Toggle` — add optional `ariaLabel`)
- Modify: `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`
- Modify: `components/views/JobScheduling/ReschedulePreviewPanel.tsx` (thread props; pass-through ~line 144-159)
- Modify: `components/views/JobSchedulingView.tsx` (compute followers; pass props to panel ~line 907-942)
- Test: `components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Append to `components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx` (match the existing import/render style at the top of that file; this assumes `render`, `screen` from `@testing-library/react` and a `baseChange` helper — if the file lacks them, mirror the existing test's setup):

```ts
import { fireEvent } from '@testing-library/react';

describe('SingleJobEditor cascade toggle', () => {
  const change = {
    jobId: 'j1', jobName: 'Smith Living Room', jobNumber: 'J-1',
    oldStart: '2026-06-04T08:00:00', oldEnd: '2026-06-04T17:00:00',
    newStart: '2026-06-06T08:00:00', newEnd: '2026-06-06T17:00:00',
  };
  const base = {
    change, issues: [], suggestions: [], onAutoFix: () => {}, crew: [],
    dayHours: {}, onChangeJobDate: () => {},
  };

  it('renders the cascade toggle and calls onToggleCascade', () => {
    const onToggleCascade = vi.fn();
    render(<SingleJobEditor {...base} cascade={false} onToggleCascade={onToggleCascade} followingJobs={[]} />);
    const toggle = screen.getByRole('button', { name: /cascade following jobs/i });
    fireEvent.click(toggle);
    expect(onToggleCascade).toHaveBeenCalledWith(true);
  });

  it('shows a summary of following jobs when cascade is on and the start moved', () => {
    const followingJobs = [
      { jobId: 'j2', jobName: 'Miller Exterior', jobNumber: 'J-2', oldStart: '2026-06-05T08:00:00', oldEnd: '2026-06-05T17:00:00', newStart: '2026-06-07T08:00:00', newEnd: '2026-06-07T17:00:00' },
    ];
    render(<SingleJobEditor {...base} cascade={true} onToggleCascade={() => {}} followingJobs={followingJobs} />);
    expect(screen.getByText(/1 later job will shift by \+2 days/i)).toBeInTheDocument();
    expect(screen.getByText(/Miller Exterior/)).toBeInTheDocument();
  });

  it('shows no summary when cascade is off', () => {
    render(<SingleJobEditor {...base} cascade={false} onToggleCascade={() => {}} followingJobs={[]} />);
    expect(screen.queryByText(/later job/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx -t cascade`
Expected: FAIL — toggle button not found / unknown props.

- [ ] **Step 3: Give the shared `Toggle` an optional accessible name**

In `components/UI.tsx`, update the `Toggle` component (line 623) so the button can carry an accessible name (the shared label renders as a sibling `<span>`, which does not name the button):

```tsx
export const Toggle = ({ label, checked, onChange, ariaLabel }: { label?: string, checked: boolean, onChange: (val: boolean) => void, ariaLabel?: string }) => (
  <div className="flex items-center justify-between gap-4">
    {label && <span className={Typography.body}>{label}</span>}
    <button
      onClick={() => onChange(!checked)}
      aria-label={ariaLabel}
      aria-pressed={checked}
      className={`w-12 h-7 rounded-full relative transition-colors duration-300 flex-shrink-0 ${checked ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`}
    >
      <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);
```

- [ ] **Step 4: Add props and UI to `SingleJobEditor`**

In `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`:

Update the imports (line 1-10 region) — add the icon and UI components:

```ts
import { Briefcase, CalendarClock, Users, UserCog, Info } from 'lucide-react';
import { Toggle, Tooltip } from '../../UI';
```

Add to `SingleJobEditorProps` (after `autoFixPreviewActive?`):

```ts
  /** "Cascade following jobs" toggle state. */
  cascade?: boolean;
  onToggleCascade?: (on: boolean) => void;
  /** Followers (excluding the primary) that will shift when cascade is on. */
  followingJobs?: ProposedChange[];
```

Note: add `ProposedChange` to the existing `scheduleEngine` import at the top of the file:

```ts
import { ProposedChange, spannedDayKeys, workingDayKeys } from '../../../../services/scheduleEngine';
```

Add `cascade`, `onToggleCascade`, `followingJobs = []` to the destructured props in the function signature (line 47-49).

Inside the component body, after the `canAutoFix` line (~line 53), compute the day delta and label:

```ts
  const startDeltaDays = Math.round(
    (new Date(`${spannedDayKeys(c.newStart, c.newEnd)[0]}T00:00:00`).getTime()
      - new Date(`${c.oldStart ? spannedDayKeys(c.oldStart, c.oldEnd ?? c.oldStart)[0] : spannedDayKeys(c.newStart, c.newEnd)[0]}T00:00:00`).getTime())
    / 86_400_000,
  );
  const deltaLabel = `${startDeltaDays > 0 ? '+' : ''}${startDeltaDays} day${Math.abs(startDeltaDays) === 1 ? '' : 's'}`;
  const showCascadeSummary = cascade && followingJobs.length > 0 && startDeltaDays !== 0;
```

In the "When" section, immediately after the closing `</div>` of the date-picker grid and before that section's closing `</div>` (i.e. inside the `onChangeJobDate &&` block, after the `grid grid-cols-2` div), insert the toggle and summary:

```tsx
          {onToggleCascade && (
            <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
                  Cascade following jobs
                  <Tooltip content="Moving this job's start date will also shift every later job by the same number of days, keeping the gaps between jobs. Turn off to move only this job.">
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" aria-label="About cascade following jobs" />
                  </Tooltip>
                </span>
                <Toggle ariaLabel="Cascade following jobs" checked={!!cascade} onChange={onToggleCascade} />
              </div>
              {showCascadeSummary && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    {followingJobs.length} later job{followingJobs.length === 1 ? '' : 's'} will shift by {deltaLabel}
                  </span>
                  <span className="block mt-0.5 truncate">{followingJobs.map(f => f.jobName).join(', ')}</span>
                </div>
              )}
            </div>
          )}
```

Note: the visible label is the `<span>` (with the ⓘ tooltip); the `Toggle` is given only `ariaLabel` (no `label` prop) so there is no duplicate visible text, and its button is reachable via `getByRole('button', { name: /cascade following jobs/i })`.

- [ ] **Step 5: Thread the props through the panel**

In `components/views/JobScheduling/ReschedulePreviewPanel.tsx`:

Add to `ReschedulePreviewPanelProps`:

```ts
  /** Cascade toggle for the single-job editor. */
  cascade?: boolean;
  onToggleCascade?: (on: boolean) => void;
  followingJobs?: import('../../../services/scheduleEngine').ProposedChange[];
```

Add `cascade, onToggleCascade, followingJobs` to the destructured props.

Pass them to `<SingleJobEditor>` (in the `isEdit && editChange` branch):

```tsx
              autoFixPreviewActive={!!autoFixPreview}
              cascade={cascade}
              onToggleCascade={onToggleCascade}
              followingJobs={followingJobs}
```

- [ ] **Step 6: Compute followers and pass props from the view**

In `components/views/JobSchedulingView.tsx`, add a memo near the other staged-derived memos (e.g. after `clientNameByJob`, ~line 529):

```ts
  // Followers (excluding the primary) that will shift when cascade is on — for the editor summary.
  const cascadeFollowers = useMemo<ProposedChange[]>(() => {
    const s = preview.staged;
    if (!s || s.mode !== 'edit' || !cascade) return [];
    return s.changes.filter(c => c.jobId !== s.primaryJobId && !c.skipped);
  }, [preview.staged, cascade]);
```

Pass to the `<ReschedulePreviewPanel>` (~line 942, alongside `nonWorkingWeekdays`):

```tsx
            nonWorkingWeekdays={workConfig.weekendDays}
            cascade={cascade}
            onToggleCascade={handleToggleCascade}
            followingJobs={cascadeFollowers}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx`
Expected: PASS (cascade tests + existing tests).

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add components/UI.tsx components/views/JobScheduling/reschedule/SingleJobEditor.tsx components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx components/views/JobScheduling/ReschedulePreviewPanel.tsx components/views/JobSchedulingView.tsx
git commit -m "feat: cascade toggle, info tooltip, and followers summary in editor"
```

---

## Task 5: Reflect cascade moves on the board (preview placeholders)

**Files:**
- Modify: `components/views/JobSchedulingView.tsx` (`displayJobs` memo ~line 417-431)

- [ ] **Step 1: Overlay all staged edit-mode changes on the board**

In `components/views/JobSchedulingView.tsx`, update the `displayJobs` memo so that, in edit mode, every non-skipped staged change (primary + cascade followers) is reflected on the board. Replace the memo body:

```ts
  const displayJobs = useMemo<Job[]>(() => {
    const s = preview.staged;
    if (!s) return jobs;
    // In edit mode, reflect the primary + any cascade followers as placeholders.
    const stagedById = s.mode === 'edit'
      ? new Map(s.changes.filter(c => !c.skipped).map(c => [c.jobId, c]))
      : null;
    return jobs.map(j => {
      // Auto-Fix preview: place the job at its proposed destination.
      const dest = autoFixDest?.[j.id];
      if (dest) return { ...j, startDate: dest.newStart, endDate: dest.newEnd };
      // Dragged job: place it at its staged day.
      if (j.id === pendingMoveId) {
        const ch = s.changes.find(c => c.jobId === pendingMoveId && !c.skipped);
        if (ch) return { ...j, startDate: ch.newStart, endDate: ch.newEnd };
      }
      // Single-edit (incl. cascade): reflect each staged change on the board.
      const staged = stagedById?.get(j.id);
      if (staged) return { ...j, startDate: staged.newStart, endDate: staged.newEnd };
      return j;
    });
  }, [jobs, preview.staged, pendingMoveId, autoFixDest]);
```

- [ ] **Step 2: Verify type-check and full test suite pass**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: reflect single-edit and cascade moves as board placeholders"
```

---

## Manual verification

After Task 5, run the app (`/run`) and:

1. Open Job Scheduling, click a job → "Reschedule" (or drag a job) to open the Edit Schedule sidebar.
2. Confirm the "Cascade following jobs" toggle and ⓘ tooltip appear under the date pickers, default **off**.
3. Change the start date forward by N days with cascade **off** → only that job moves on the board.
4. Toggle cascade **on** → later jobs shift by the same N days; the summary line lists them; the board placeholders reflect the ripple.
5. Confirm the conflict strip / Auto-Fix reflects the full set, and **Apply** persists primary + followers.
6. Toggle cascade **off** again → followers snap back to original; only the primary remains staged.

---

## Self-Review Notes

- **Spec coverage:** scope=all later jobs (Task 1 `shiftJobsFromPoint` over all jobs, no scope arg); start-delta amount (Task 1 `deltaDays` from start only); off-by-default (Task 3 `setCascade(false)` on stage); toggle + info icon + summary (Task 4); board reflects ripple (Task 5); conflict detection/apply unchanged (already iterate `staged.changes`).
- **Calendar vs working-day shift:** followers use a pure calendar delta (`skipNonWorkingDays: false`) to match the primary's explicit new date and "keep the gaps" — documented in `cascadeFromEdit`.
- **Primary identity:** `primaryJobId` (Task 2) ensures the editor/header/stats render the edited job, not a follower row.
- **Type consistency:** `cascadeFromEdit(jobs, primaryChange, config)`, `handleToggleCascade(on)`, props `cascade` / `onToggleCascade` / `followingJobs` are used identically across engine, view, panel, and editor.
