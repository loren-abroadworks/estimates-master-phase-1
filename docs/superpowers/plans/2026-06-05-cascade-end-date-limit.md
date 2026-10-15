# Cascade End-Date Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user cap how far a single-job cascade reaches by setting an optional end date — jobs scheduled after that date stay put.

**Architecture:** `cascadeFromEdit` gains an optional `untilDate`; followers whose *original* start day is after the cutoff become informational `after-limit` skipped rows instead of moving. A pure helper flags moved followers that leapfrog a protected job. The single-job editor (`SingleJobEditor`) gains a "Stop cascade after" date control plus summary/warning lines; `JobSchedulingView` owns the `cascadeUntil` state and derives what the editor displays.

**Tech Stack:** TypeScript, React 19, Vite, Vitest, Testing Library.

---

## Spec reconciliation (read first)

The spec (`docs/superpowers/specs/2026-06-05-cascade-end-date-limit-design.md`) mentions `BulkPreview.tsx` for rendering protected rows. That is wrong for this feature: single-job-edit cascade renders **only** `SingleJobEditor` (see `ReschedulePreviewPanel.tsx:151-169`); `BulkPreview` is for bulk/from-point reschedules, which this feature does not touch. All UI for protected jobs and the leapfrog warning therefore lives in `SingleJobEditor`. No `BulkPreview` changes are made. (The spec's preview section is corrected in the same commit as Task 4.)

## File map

- **`services/scheduleEngine.ts`** — extend `SkipReason`; add `untilDate` param to `cascadeFromEdit`; add `cascadeLeapfrogIds` helper. (Tasks 1, 2)
- **`services/scheduleEngine.test.ts`** — tests for the cutoff behavior and the leapfrog helper. (Tasks 1, 2)
- **`components/views/JobSchedulingView.tsx`** — `cascadeUntil` state, recompute handler, thread into the two `cascadeFromEdit` call sites, derive protected followers + leapfrog names, pass props down. (Task 3)
- **`components/views/JobScheduling/ReschedulePreviewPanel.tsx`** — pass the new props through to `SingleJobEditor`. (Task 3)
- **`components/views/JobScheduling/reschedule/SingleJobEditor.tsx`** — date control, clear button, protected-count line, leapfrog warning. (Task 4)
- **`docs/superpowers/specs/2026-06-05-cascade-end-date-limit-design.md`** — fix the preview section to reference `SingleJobEditor`. (Task 4)

---

## Task 1: Engine — `untilDate` cutoff in `cascadeFromEdit`

**Files:**
- Modify: `services/scheduleEngine.ts:35` (SkipReason) and `services/scheduleEngine.ts:318-332` (cascadeFromEdit)
- Test: `services/scheduleEngine.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `services/scheduleEngine.test.ts` (inside the file, after the existing `describe('cascadeFromEdit', ...)` block at the end). It reuses the `jobs` and `primaryMovedTwoDays` fixtures — redeclare them locally so the block is self-contained:

```ts
describe('cascadeFromEdit with end-date limit', () => {
  // primary j1 Jun 2 -> Jun 4 (+2 calendar days). followers j2 (Jun 4), j3 (Jun 9). cfg skips weekends.
  const jobs = [
    j({}),
    j({ id: 'j2', jobNumber: 'J-2', name: 'Job 2', startDate: '2026-06-04T08:00:00', endDate: '2026-06-04T17:00:00' }),
    j({ id: 'j3', jobNumber: 'J-3', name: 'Job 3', startDate: '2026-06-09T08:00:00', endDate: '2026-06-09T17:00:00' }),
  ];
  const primaryMovedTwoDays: ProposedChange = {
    jobId: 'j1', jobName: 'Job 1', jobNumber: 'J-1',
    oldStart: '2026-06-02T08:00:00', oldEnd: '2026-06-02T17:00:00',
    newStart: '2026-06-04T08:00:00', newEnd: '2026-06-04T17:00:00',
  };

  it('protects followers whose ORIGINAL start is after the cutoff', () => {
    const changes = cascadeFromEdit(jobs, primaryMovedTwoDays, cfg, '2026-06-05');
    const j2 = changes.find(c => c.jobId === 'j2'); // Jun 4 <= cutoff -> moves
    const j3 = changes.find(c => c.jobId === 'j3'); // Jun 9 > cutoff -> protected
    expect(j2?.skipped).toBeUndefined();
    expect(toLocalDateKey(new Date(j2!.newStart))).toBe('2026-06-06');
    expect(j3?.skipped).toBe('after-limit');
    expect(j3?.newStart).toBe('2026-06-09T08:00:00'); // unchanged
    expect(j3?.newEnd).toBe('2026-06-09T17:00:00');
  });

  it('moves a follower scheduled exactly ON the cutoff date', () => {
    const changes = cascadeFromEdit(jobs, primaryMovedTwoDays, cfg, '2026-06-09');
    const j3 = changes.find(c => c.jobId === 'j3'); // Jun 9 == cutoff -> moves
    expect(j3?.skipped).toBeUndefined();
    expect(toLocalDateKey(new Date(j3!.newStart))).toBe('2026-06-11');
  });

  it('behaves exactly like no-limit when untilDate is empty', () => {
    expect(cascadeFromEdit(jobs, primaryMovedTwoDays, cfg, '')).toEqual(
      cascadeFromEdit(jobs, primaryMovedTwoDays, cfg),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/scheduleEngine.test.ts -t "end-date limit"`
Expected: FAIL — `cascadeFromEdit` ignores the 4th argument, so `j3.skipped` is `undefined` (and the protected-row assertion fails).

- [ ] **Step 3: Extend the `SkipReason` type**

In `services/scheduleEngine.ts`, change line 35 from:

```ts
export type SkipReason = 'locked' | 'unscheduled' | 'before-point' | 'out-of-scope';
```

to:

```ts
export type SkipReason = 'locked' | 'unscheduled' | 'before-point' | 'out-of-scope' | 'after-limit';
```

- [ ] **Step 4: Add the `untilDate` parameter to `cascadeFromEdit`**

In `services/scheduleEngine.ts`, replace the whole `cascadeFromEdit` function (lines 318-332) with:

```ts
export const cascadeFromEdit = (
  jobs: Job[],
  primaryChange: ProposedChange,
  config: WorkingTimeConfig,
  /** Local 'YYYY-MM-DD'. Followers whose ORIGINAL start day is after this are
   *  left untouched (returned as `after-limit` rows). Empty/undefined = no limit. */
  untilDate?: string,
): ProposedChange[] => {
  if (!primaryChange.oldStart) return [primaryChange];
  const deltaDays = Math.round(
    (localDayStartMs(primaryChange.newStart) - localDayStartMs(primaryChange.oldStart)) / MS_PER_DAY,
  );
  if (deltaDays === 0) return [primaryChange];
  const calendarConfig = { ...config, skipNonWorkingDays: false };
  const shifted = shiftJobsFromPoint(jobs, primaryChange.oldStart, deltaDays, 'days', calendarConfig);
  const followers = shifted.filter(c => c.jobId !== primaryChange.jobId && !c.skipped);

  if (!untilDate) return [primaryChange, ...followers];

  const moved: ProposedChange[] = [];
  const protectedRows: ProposedChange[] = [];
  for (const f of followers) {
    // Compare the follower's ORIGINAL start day (Option A). On/before the cutoff moves; strictly after is protected.
    if (f.oldStart && toLocalDateKey(new Date(f.oldStart)) > untilDate) {
      protectedRows.push({
        jobId: f.jobId, jobName: f.jobName, jobNumber: f.jobNumber,
        oldStart: f.oldStart, oldEnd: f.oldEnd,
        newStart: f.oldStart, newEnd: f.oldEnd ?? f.oldStart,
        skipped: 'after-limit',
      });
    } else {
      moved.push(f);
    }
  }
  return [primaryChange, ...moved, ...protectedRows];
};
```

(`toLocalDateKey` and `localDayStartMs` already exist in this file. ISO `YYYY-MM-DD` strings compare correctly with `>`.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run services/scheduleEngine.test.ts -t "end-date limit"`
Expected: PASS (3 tests). Also run the full engine file to confirm no regressions: `npx vitest run services/scheduleEngine.test.ts` — Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat: optional end-date cutoff in cascadeFromEdit"
```

---

## Task 2: Engine — leapfrog detection helper

A moved follower can slide *past* a protected job (e.g. follower at Jun 4 moves +2 to Jun 6 while a protected job is frozen at Jun 5). `cascadeLeapfrogIds` returns the ids of moved followers (excluding the primary) whose new start day is on/after the earliest protected job's start day.

**Files:**
- Modify: `services/scheduleEngine.ts` (add function after `cascadeFromEdit`)
- Test: `services/scheduleEngine.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `services/scheduleEngine.test.ts`:

```ts
describe('cascadeLeapfrogIds', () => {
  const pc = (over: Partial<ProposedChange>): ProposedChange => ({
    jobId: 'x', jobName: 'X', jobNumber: 'X-1',
    oldStart: '2026-06-01T08:00:00', oldEnd: '2026-06-01T17:00:00',
    newStart: '2026-06-01T08:00:00', newEnd: '2026-06-01T17:00:00', ...over,
  });

  it('flags moved followers that land on/after a protected job', () => {
    const changes = [
      pc({ jobId: 'j1', newStart: '2026-06-04T08:00:00' }),                       // primary (excluded)
      pc({ jobId: 'j2', newStart: '2026-06-06T08:00:00' }),                       // moved, lands after Jun 5 -> flagged
      pc({ jobId: 'j3', newStart: '2026-06-05T08:00:00', skipped: 'after-limit' }), // protected at Jun 5
    ];
    expect(cascadeLeapfrogIds(changes, 'j1')).toEqual(['j2']);
  });

  it('does not flag a moved follower that stays before every protected job', () => {
    const changes = [
      pc({ jobId: 'j1', newStart: '2026-06-04T08:00:00' }),
      pc({ jobId: 'j2', newStart: '2026-06-04T08:00:00' }),                       // before Jun 9
      pc({ jobId: 'j3', newStart: '2026-06-09T08:00:00', skipped: 'after-limit' }),
    ];
    expect(cascadeLeapfrogIds(changes, 'j1')).toEqual([]);
  });

  it('returns [] when nothing is protected', () => {
    const changes = [
      pc({ jobId: 'j1', newStart: '2026-06-04T08:00:00' }),
      pc({ jobId: 'j2', newStart: '2026-06-06T08:00:00' }),
    ];
    expect(cascadeLeapfrogIds(changes, 'j1')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/scheduleEngine.test.ts -t "cascadeLeapfrogIds"`
Expected: FAIL — `cascadeLeapfrogIds is not a function` / not exported.

- [ ] **Step 3: Implement the helper**

In `services/scheduleEngine.ts`, add directly after the `cascadeFromEdit` function:

```ts
/**
 * Ids of moved followers (excluding the primary) that now land on or after the
 * earliest `after-limit` protected job — i.e. the cascade leapfrogged a job the
 * cutoff was meant to protect. Non-blocking; the UI surfaces it as a warning.
 */
export const cascadeLeapfrogIds = (
  changes: ProposedChange[],
  primaryJobId?: string,
): string[] => {
  const protectedDays = changes
    .filter(c => c.skipped === 'after-limit')
    .map(c => localDayStartMs(c.newStart));
  if (protectedDays.length === 0) return [];
  const earliest = Math.min(...protectedDays);
  return changes
    .filter(c => !c.skipped && c.jobId !== primaryJobId)
    .filter(c => localDayStartMs(c.newStart) >= earliest)
    .map(c => c.jobId);
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run services/scheduleEngine.test.ts -t "cascadeLeapfrogIds"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat: add cascadeLeapfrogIds engine helper"
```

---

## Task 3: View state — `cascadeUntil` plus prop threading

Wire the cutoff into `JobSchedulingView`: hold the date, feed it to both `cascadeFromEdit` call sites, recompute on change, and derive the protected followers + leapfrog names for the editor. Then pass everything through `ReschedulePreviewPanel`.

**Files:**
- Modify: `components/views/JobSchedulingView.tsx` (lines 216, 409, 412-420, 553-557, 972-974)
- Modify: `components/views/JobScheduling/ReschedulePreviewPanel.tsx` (props interface + passthrough)

- [ ] **Step 1: Add the `cascadeUntil` state**

In `components/views/JobSchedulingView.tsx`, immediately after line 216 (`const [cascade, setCascade] = useState(false);`), add:

```ts
  // Optional cutoff for the cascade. Empty = no limit. Followers scheduled after this date stay put.
  const [cascadeUntil, setCascadeUntil] = useState<string>('');
```

- [ ] **Step 2: Thread `cascadeUntil` into `handleChangeJobDate`**

In `components/views/JobSchedulingView.tsx`, change line 409 from:

```ts
    preview.setChanges(cascade ? cascadeFromEdit(jobs, primaryChange, workConfig) : [primaryChange]);
```

to:

```ts
    preview.setChanges(cascade ? cascadeFromEdit(jobs, primaryChange, workConfig, cascadeUntil) : [primaryChange]);
```

- [ ] **Step 3: Thread `cascadeUntil` into `handleToggleCascade` and add `handleChangeCascadeUntil`**

In `components/views/JobSchedulingView.tsx`, replace the `handleToggleCascade` function (lines 412-420) with:

```ts
  const handleToggleCascade = (on: boolean) => {
    setCascade(on);
    const s = preview.staged;
    if (!s) return;
    const primaryId = s.primaryJobId;
    const primary = s.changes.find(c => c.jobId === primaryId && !c.skipped) ?? s.changes.find(c => !c.skipped);
    if (!primary) return;
    preview.setChanges(on ? cascadeFromEdit(jobs, primary, workConfig, cascadeUntil) : [primary]);
  };

  const handleChangeCascadeUntil = (date: string) => {
    setCascadeUntil(date);
    const s = preview.staged;
    if (!s || !cascade) return;
    const primaryId = s.primaryJobId;
    const primary = s.changes.find(c => c.jobId === primaryId && !c.skipped) ?? s.changes.find(c => !c.skipped);
    if (!primary) return;
    preview.setChanges(cascadeFromEdit(jobs, primary, workConfig, date));
  };
```

- [ ] **Step 4: Derive protected followers and leapfrog names**

In `components/views/JobSchedulingView.tsx`, replace the `cascadeFollowers` memo (lines 552-557) with the existing memo plus two new derived values. First update the import on line 13 to include `cascadeLeapfrogIds`:

```ts
import { ProposedChange, configFromSettings, moveJobToSlot, shiftJobsFromPoint, toLocalDateKey, spannedDayKeys, workingDayKeys, applyDailyHours, cascadeFromEdit, cascadeLeapfrogIds } from '../../services/scheduleEngine';
```

Then replace lines 552-557 with:

```ts
  // Followers (excluding the primary) that will shift when cascade is on — for the editor summary.
  const cascadeFollowers = useMemo<ProposedChange[]>(() => {
    const s = preview.staged;
    if (!s || s.mode !== 'edit' || !cascade) return [];
    return s.changes.filter(c => c.jobId !== s.primaryJobId && !c.skipped);
  }, [preview.staged, cascade]);

  // Followers left untouched because they fall after the cutoff date.
  const cascadeProtected = useMemo<ProposedChange[]>(() => {
    const s = preview.staged;
    if (!s || s.mode !== 'edit' || !cascade) return [];
    return s.changes.filter(c => c.skipped === 'after-limit');
  }, [preview.staged, cascade]);

  // Names of moved followers that leapfrogged a protected job (non-blocking warning).
  const cascadeLeapfrogNames = useMemo<string[]>(() => {
    const s = preview.staged;
    if (!s || s.mode !== 'edit' || !cascade) return [];
    const ids = new Set(cascadeLeapfrogIds(s.changes, s.primaryJobId));
    return s.changes.filter(c => ids.has(c.jobId)).map(c => c.jobName);
  }, [preview.staged, cascade]);
```

- [ ] **Step 5: Pass the new props to `ReschedulePreviewPanel`**

In `components/views/JobSchedulingView.tsx`, find the `ReschedulePreviewPanel` usage (the props around lines 972-974: `cascade`, `onToggleCascade`, `followingJobs`). Replace those three lines with:

```ts
            cascade={cascade}
            onToggleCascade={handleToggleCascade}
            followingJobs={cascadeFollowers}
            cascadeUntil={cascadeUntil}
            onChangeCascadeUntil={handleChangeCascadeUntil}
            protectedJobs={cascadeProtected}
            leapfrogJobNames={cascadeLeapfrogNames}
```

- [ ] **Step 6: Reset `cascadeUntil` when the cascade toggle goes off**

Still in `handleToggleCascade` (edited in Step 3), the cutoff should not silently persist after turning cascade off. Update the `setCascade(on)` line to also clear the cutoff when turning off. Change the first line of `handleToggleCascade` from:

```ts
    setCascade(on);
```

to:

```ts
    setCascade(on);
    if (!on) setCascadeUntil('');
```

- [ ] **Step 7: Add the props to `ReschedulePreviewPanel` and pass them through**

In `components/views/JobScheduling/ReschedulePreviewPanel.tsx`, add to the `ReschedulePreviewPanelProps` interface, directly after the `followingJobs?` line (line 40):

```ts
  /** Cascade end-date cutoff (local 'YYYY-MM-DD'); empty = no limit. */
  cascadeUntil?: string;
  onChangeCascadeUntil?: (date: string) => void;
  /** Followers left untouched because they fall after the cutoff. */
  protectedJobs?: import('../../../services/scheduleEngine').ProposedChange[];
  /** Names of moved followers that leapfrogged a protected job. */
  leapfrogJobNames?: string[];
```

Then add them to the destructured props (line 46, after `followingJobs,`):

```ts
  cascade, onToggleCascade, followingJobs, cascadeUntil, onChangeCascadeUntil, protectedJobs, leapfrogJobNames,
```

And pass them into `<SingleJobEditor>` (after `followingJobs={followingJobs}` on line 168):

```ts
              cascadeUntil={cascadeUntil}
              onChangeCascadeUntil={onChangeCascadeUntil}
              protectedJobs={protectedJobs}
              leapfrogJobNames={leapfrogJobNames}
```

- [ ] **Step 8: Verify it compiles**

Run: `npm run lint`
Expected: PASS (no TypeScript errors). `SingleJobEditor` does not yet accept the new props — TypeScript will error on the unknown props in Step 7's JSX. That is expected here; if `npm run lint` fails *only* with "Property 'cascadeUntil' does not exist on type ... SingleJobEditorProps" (and siblings), proceed to Task 4, which adds them. Any *other* error must be fixed before moving on.

- [ ] **Step 9: Commit**

```bash
git add components/views/JobSchedulingView.tsx components/views/JobScheduling/ReschedulePreviewPanel.tsx
git commit -m "feat: own cascadeUntil state and thread cascade limit props"
```

---

## Task 4: Editor UI — date control, clear, protected count, leapfrog warning

Add the cutoff date control and summary lines to `SingleJobEditor`. Surface protected count and the leapfrog warning so the user understands exactly what moved and what stayed.

**Files:**
- Modify: `components/views/JobScheduling/reschedule/SingleJobEditor.tsx` (props interface line 29-33, destructure line 53-54, cascade box lines 92-112)
- Modify: `docs/superpowers/specs/2026-06-05-cascade-end-date-limit-design.md` (fix preview section)

- [ ] **Step 1: Write the failing UI test**

Create `components/views/JobScheduling/reschedule/SingleJobEditor.cascadeLimit.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SingleJobEditor } from './SingleJobEditor';
import type { ProposedChange } from '../../../../services/scheduleEngine';

const change: ProposedChange = {
  jobId: 'j1', jobName: 'Job 1', jobNumber: 'J-1',
  oldStart: '2026-06-02T08:00:00', oldEnd: '2026-06-02T17:00:00',
  newStart: '2026-06-04T08:00:00', newEnd: '2026-06-04T17:00:00',
};

const baseProps = {
  change, issues: [], suggestions: [], onAutoFix: () => {}, crew: [], dayHours: {},
  onChangeJobDate: () => {}, onToggleCascade: () => {},
} as const;

describe('SingleJobEditor cascade end-date limit', () => {
  it('shows the cutoff control only when cascade is on', () => {
    const { rerender } = render(<SingleJobEditor {...baseProps} cascade={false} />);
    expect(screen.queryByText(/stop cascade after/i)).toBeNull();
    rerender(<SingleJobEditor {...baseProps} cascade={true} />);
    expect(screen.getByText(/stop cascade after/i)).toBeInTheDocument();
  });

  it('reports the protected count when jobs fall after the cutoff', () => {
    const protectedJobs: ProposedChange[] = [
      { ...change, jobId: 'j3', jobName: 'Job 3', skipped: 'after-limit' },
    ];
    render(<SingleJobEditor {...baseProps} cascade={true} cascadeUntil="2026-06-05" protectedJobs={protectedJobs} />);
    expect(screen.getByText(/1 job after .* left unchanged/i)).toBeInTheDocument();
  });

  it('warns when a moved follower leapfrogs a protected job', () => {
    render(<SingleJobEditor {...baseProps} cascade={true} cascadeUntil="2026-06-05" leapfrogJobNames={['Job 2']} />);
    expect(screen.getByText(/lands after a protected job/i)).toBeInTheDocument();
  });

  it('clears the cutoff via the Clear button', async () => {
    const onChangeCascadeUntil = vi.fn();
    render(<SingleJobEditor {...baseProps} cascade={true} cascadeUntil="2026-06-05" onChangeCascadeUntil={onChangeCascadeUntil} />);
    await userEvent.click(screen.getByRole('button', { name: /clear cascade cutoff/i }));
    expect(onChangeCascadeUntil).toHaveBeenCalledWith('');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/reschedule/SingleJobEditor.cascadeLimit.test.tsx`
Expected: FAIL — "Stop cascade after" text is not rendered; props don't exist.

- [ ] **Step 3: Add the new props to `SingleJobEditorProps`**

In `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`, in the interface, replace the `followingJobs?` line (line 33) with:

```ts
  /** Followers (excluding the primary) that will shift when cascade is on. */
  followingJobs?: ProposedChange[];
  /** Cascade end-date cutoff (local 'YYYY-MM-DD'); empty = no limit. */
  cascadeUntil?: string;
  onChangeCascadeUntil?: (date: string) => void;
  /** Followers left untouched because they fall after the cutoff. */
  protectedJobs?: ProposedChange[];
  /** Names of moved followers that leapfrogged a protected job. */
  leapfrogJobNames?: string[];
```

- [ ] **Step 4: Destructure the new props**

In `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`, change the destructuring (line 54) from:

```ts
  change: c, clientName, issues, suggestions, onAutoFix, stats, crew, onReassignCrew, dayHours, onChangeDailyHour, onChangeJobDate, nonWorkingWeekdays = [], autoFixPreviewActive, cascade, onToggleCascade, followingJobs = [],
```

to:

```ts
  change: c, clientName, issues, suggestions, onAutoFix, stats, crew, onReassignCrew, dayHours, onChangeDailyHour, onChangeJobDate, nonWorkingWeekdays = [], autoFixPreviewActive, cascade, onToggleCascade, followingJobs = [], cascadeUntil = '', onChangeCascadeUntil, protectedJobs = [], leapfrogJobNames = [],
```

- [ ] **Step 5: Add a cutoff-label formatter**

In `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`, just after the `showCascadeSummary` line (line 65), add:

```ts
  const cutoffLabel = cascadeUntil
    ? new Date(`${cascadeUntil}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';
```

- [ ] **Step 6: Render the date control and summary lines**

In `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`, replace the block that renders the toggle row and summary (lines 103-111, the `{showCascadeSummary && (...)}` block and its surroundings inside the cascade box) so the cascade box reads:

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

              {cascade && onChangeCascadeUntil && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Stop cascade after</label>
                    {cascadeUntil && (
                      <button
                        type="button"
                        aria-label="Clear cascade cutoff"
                        onClick={() => onChangeCascadeUntil('')}
                        className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <DatePicker value={cascadeUntil} onChange={onChangeCascadeUntil} />
                  {!cascadeUntil && (
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">No limit — every later job shifts.</p>
                  )}
                </div>
              )}

              {showCascadeSummary && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    {followingJobs.length} later job{followingJobs.length === 1 ? '' : 's'} will shift by {deltaLabel}
                  </span>
                  <span className="block mt-0.5 truncate">{followingJobs.map(f => f.jobName).join(', ')}</span>
                </div>
              )}

              {cascade && protectedJobs.length > 0 && cutoffLabel && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-semibold text-gray-700 dark:text-gray-200">{protectedJobs.length} job{protectedJobs.length === 1 ? '' : 's'} after {cutoffLabel}</span> left unchanged.
                </p>
              )}

              {cascade && leapfrogJobNames.length > 0 && (
                <p className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-300">
                  ⚠️ {leapfrogJobNames.join(', ')} now land{leapfrogJobNames.length === 1 ? 's' : ''} after a protected job past your cutoff.
                </p>
              )}
            </div>
          )}
```

(`DatePicker` is already imported at line 10.)

- [ ] **Step 7: Run the UI test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/reschedule/SingleJobEditor.cascadeLimit.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 8: Verify the whole project compiles and tests pass**

Run: `npm run lint && npx vitest run`
Expected: PASS — no TypeScript errors, all tests green.

- [ ] **Step 9: Fix the spec's preview section**

In `docs/superpowers/specs/2026-06-05-cascade-end-date-limit-design.md`, find the heading `### Preview rows — \`ReschedulePreviewPanel.tsx\` / \`reschedule/BulkPreview.tsx\`` and replace that section's body so it describes the actual implementation: single-job cascade renders only `SingleJobEditor`; protected jobs appear as a "{n} jobs after {date} left unchanged" line and the leapfrog warning as an amber note, both inside the cascade box. Remove the `BulkPreview` / greyed-row references.

- [ ] **Step 10: Commit**

```bash
git add components/views/JobScheduling/reschedule/SingleJobEditor.tsx components/views/JobScheduling/reschedule/SingleJobEditor.cascadeLimit.test.tsx docs/superpowers/specs/2026-06-05-cascade-end-date-limit-design.md
git commit -m "feat: cascade cutoff date control, protected count, and leapfrog warning"
```

---

## Task 5: Manual verification

**Files:** none (manual).

- [ ] **Step 1: Launch the app**

Run: `npm run dev` and open the printed local URL.

- [ ] **Step 2: Drive the feature**

1. Open Job Scheduling. Click a job to open the edit drawer; change its start date forward several days.
2. Turn **Cascade following jobs** ON — confirm later jobs shift on the board and the "N later jobs will shift" summary appears, with an empty **Stop cascade after** control reading "No limit — every later job shifts."
3. Pick a cutoff date between two later jobs. Confirm: jobs after the cutoff snap back to their original places on the board, and the editor shows "{n} jobs after {date} left unchanged."
4. Set up a leapfrog (cutoff just before a job that a moved job will pass) and confirm the amber "⚠️ … now lands after a protected job past your cutoff" note appears, and Apply is still enabled.
5. Click **Clear** — confirm full cascade returns.
6. Toggle cascade OFF then ON — confirm the cutoff reset to empty.

- [ ] **Step 3: Confirm**

All six behaviors hold. If any required installs, env vars, or patches were needed to launch, recommend `/run-skill-generator` in the report.

---

## Self-review notes

- **Spec coverage:** Decision 1 (compare current date) → Task 1 Step 4 `f.oldStart` comparison + test. Decision 2 (on-the-date moves) → Task 1 `>` comparison + "exactly ON" test. Decision 3 (allow + warn) → Task 2 helper + Task 4 amber note; Apply stays enabled (no change to the Apply gate). Decision 4 (empty/opt-in) → `cascadeUntil` defaults `''`, empty-arg test, "No limit" hint.
- **Types:** `after-limit` added to `SkipReason` (Task 1) and used consistently in Tasks 2-4. `cascadeLeapfrogIds(changes, primaryJobId?)` signature matches its call in Task 3 Step 4. Prop names (`cascadeUntil`, `onChangeCascadeUntil`, `protectedJobs`, `leapfrogJobNames`) are identical across Tasks 3 and 4.
- **No placeholders:** every code step has full code; every run step has an expected result.
