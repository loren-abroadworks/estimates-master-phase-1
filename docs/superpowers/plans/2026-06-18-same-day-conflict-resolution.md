# Same-Day Conflict Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user edits a job's time and it overlaps another shared-crew job the same day, offer to slide the conflicting job(s) automatically — same-day if it fits, otherwise spilling to the next free working day — reviewed and applied inside the existing Reschedule preview panel.

**Architecture:** A new pure service `resolveSameDayConflicts` reads the proposed world (committed jobs with all staged changes applied) and the primary edit, walks a forward-cascade (slide each conflicting job to start right after the job that displaced it; spill to the next conflict-free day when it overflows the workday or is multi-day), and returns `ConflictResolution[]` proposals. `JobSchedulingView` computes these from the staged state and passes them through `ReschedulePreviewPanel` into `SingleJobEditor`, which renders a "Conflicting jobs" card with a "Move conflicting job" button. Activating it merges the proposals into the staged `changes` array; the existing Apply path commits everything together.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react, Tailwind, project i18n (`useTranslation` / `i18n/catalog.ts`).

## Global Constraints

- Test runner: `npm test` (`vitest run`); type-check: `npm run lint` (`tsc --noEmit`).
- All user-facing strings go through `useTranslation()` `t(...)`; add keys to **both** `enManual` and `esManual` in `i18n/catalog.ts` (manual keys override generated).
- Times are local `'HH:MM'` 24h strings; date keys are local `'YYYY-MM-DD'` (`toLocalDateKey`). Display clock via `fmtClock`, display dates via `formatDisplayDate`.
- Reuse existing engine primitives; do **not** duplicate conflict math. Shared-crew = `jobsShareCrew`; crew scope = `sharedCrewScope`; per-day window = `jobClockWindowOnDay`; next-day placement = `placeAfterConflictFree`.
- The resolver must be **total**: never throw; return `[]` when there are no conflicts.

### Deviation from spec (intentional refinement)

The spec described placing the slid job into the earliest `freeIntervals` gap. This plan instead places each conflicting job **immediately after the displacing job's end clock** and relies on the cascade loop to resolve any resulting domino. This is simpler, matches the literal "starts right after the job ends" behavior, and is more predictable (always pushes forward, converging to a same-day slide or a next-day spill). `freeIntervals`/`occupiedIntervals` are therefore not used. Same-day slides are limited to **single-day** conflicting jobs; multi-day conflicting jobs take the (spec-approved) next-day spill path, which preserves their full duration.

---

### Task 1: `resolveSameDayConflicts` service + `hoursToHHMM` export

**Files:**
- Modify: `services/scheduleEngine.ts:131` (export `hoursToHHMM`)
- Create: `services/resolveSameDayConflicts.ts`
- Test: `services/resolveSameDayConflicts.test.ts`

**Interfaces:**
- Consumes (all already exported unless noted): `ProposedChange`, `WorkingTimeConfig`, `ClockInterval`, `jobClockWindowOnDay`, `spannedDayKeys`, `occupiesWorkingDay`, `placeAfterConflictFree`, `formatDisplayDate`, and `hoursToHHMM` (newly exported in Step 1) from `services/scheduleEngine`; `sharedCrewScope`, `jobsShareCrew` from `services/rescheduleIssues`; `withStagedWindow`, `fmtClock` from `services/productionBoard`.
- Produces:
  - `interface ConflictResolution { jobId: string; jobName: string; jobNumber: string; kind: 'slide-same-day' | 'spill-next-day' | 'locked-blocked'; change: ProposedChange; label: string }`
  - `resolveSameDayConflicts(primary: ProposedChange, world: Job[], config: WorkingTimeConfig): ConflictResolution[]` — `world` is the proposed world (committed jobs with every non-skipped staged change, including `primary`, already applied).

- [ ] **Step 1: Export the `hoursToHHMM` helper**

In `services/scheduleEngine.ts`, change the private declaration (currently line 131) from:

```ts
const hoursToHHMM = (h: number): string => {
```

to:

```ts
export const hoursToHHMM = (h: number): string => {
```

- [ ] **Step 2: Write the failing tests**

Create `services/resolveSameDayConflicts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveSameDayConflicts } from './resolveSameDayConflicts';
import { configFromSettings, ProposedChange } from './scheduleEngine';
import type { Job } from '../types';

const cfg = configFromSettings(undefined, false); // 08:00–17:00, weekends [0,6]
const DAY = '2026-06-01'; // a Monday

const dayJob = (id: string, start: string, end: string, over: Partial<Job> = {}): Job => ({
  id, jobNumber: id, name: id, stage: 'Scheduled',
  startDate: `${DAY}T${start}:00`, endDate: `${DAY}T${end}:00`,
  dailyHours: { [DAY]: { startTime: start, endTime: end } },
  crewMemberIds: ['m1'], dateCreated: '', clientId: '', estimateId: '', address: '',
  ...over,
} as Job);

const primaryChange = (j: Job): ProposedChange => ({
  jobId: j.id, jobName: j.name, jobNumber: j.jobNumber,
  oldStart: j.startDate!, oldEnd: j.endDate!,
  newStart: j.startDate!, newEnd: j.endDate!, dailyHours: j.dailyHours,
});

describe('resolveSameDayConflicts', () => {
  it('slides a same-day overlapping shared-crew job to start after the edited job', () => {
    const a = dayJob('A', '08:00', '12:00');
    const b = dayJob('B', '10:00', '13:00');
    const res = resolveSameDayConflicts(primaryChange(a), [a, b], cfg);
    expect(res).toHaveLength(1);
    expect(res[0].jobId).toBe('B');
    expect(res[0].kind).toBe('slide-same-day');
    expect(res[0].change.dailyHours![DAY]).toEqual({ startTime: '12:00', endTime: '15:00' });
  });

  it('spills to the next working day when the slide overflows the workday', () => {
    const a = dayJob('A', '08:00', '15:00');
    const b = dayJob('B', '14:00', '17:00'); // 3h won't fit after 15:00
    const res = resolveSameDayConflicts(primaryChange(a), [a, b], cfg);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe('spill-next-day');
    expect(res[0].change.newStart.startsWith('2026-06-02')).toBe(true);
  });

  it('ignores overlaps when no crew member is shared', () => {
    const a = dayJob('A', '08:00', '12:00', { crewMemberIds: ['m1'] });
    const b = dayJob('B', '10:00', '13:00', { crewMemberIds: ['m2'] });
    expect(resolveSameDayConflicts(primaryChange(a), [a, b], cfg)).toEqual([]);
  });

  it('ignores shared-crew jobs that do not overlap in time', () => {
    const a = dayJob('A', '08:00', '10:00');
    const b = dayJob('B', '13:00', '15:00');
    expect(resolveSameDayConflicts(primaryChange(a), [a, b], cfg)).toEqual([]);
  });

  it('reports a locked conflicting job as unresolvable instead of moving it', () => {
    const a = dayJob('A', '08:00', '12:00');
    const b = dayJob('B', '10:00', '13:00', { is_locked: true });
    const res = resolveSameDayConflicts(primaryChange(a), [a, b], cfg);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe('locked-blocked');
    expect(res[0].change.newStart).toBe(b.startDate);
  });

  it('cascades: a slid job that then overlaps a third job moves it too', () => {
    const a = dayJob('A', '08:00', '12:00');
    const b = dayJob('B', '10:00', '13:00'); // -> 12:00–15:00
    const c = dayJob('C', '14:00', '15:00'); // overlaps B's new window -> 15:00–16:00
    const res = resolveSameDayConflicts(primaryChange(a), [a, b, c], cfg);
    const byId = Object.fromEntries(res.map(r => [r.jobId, r]));
    expect(res).toHaveLength(2);
    expect(byId.B.change.dailyHours![DAY]).toEqual({ startTime: '12:00', endTime: '15:00' });
    expect(byId.C.kind).toBe('slide-same-day');
    expect(byId.C.change.dailyHours![DAY]).toEqual({ startTime: '15:00', endTime: '16:00' });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- resolveSameDayConflicts`
Expected: FAIL — `Failed to resolve import "./resolveSameDayConflicts"` (module not created yet).

- [ ] **Step 4: Implement the service**

Create `services/resolveSameDayConflicts.ts`:

```ts
import type { Job } from '../types';
import {
  ProposedChange, WorkingTimeConfig, ClockInterval,
  jobClockWindowOnDay, spannedDayKeys, occupiesWorkingDay,
  placeAfterConflictFree, formatDisplayDate, hoursToHHMM,
} from './scheduleEngine';
import { sharedCrewScope, jobsShareCrew } from './rescheduleIssues';
import { withStagedWindow, fmtClock } from './productionBoard';

const EPS = 1e-9;

export interface ConflictResolution {
  jobId: string;
  jobName: string;
  jobNumber: string;
  kind: 'slide-same-day' | 'spill-next-day' | 'locked-blocked';
  change: ProposedChange;
  label: string;
}

const clockOverlaps = (a: ClockInterval | null, b: ClockInterval | null): boolean =>
  !!a && !!b && a.start < b.end - EPS && b.start < a.end - EPS;

const baseOf = (job: Job) => ({
  jobId: job.id, jobName: job.name, jobNumber: job.jobNumber,
  oldStart: job.startDate ?? null, oldEnd: job.endDate ?? null,
});

/**
 * Move `job` so it starts right after `anchor` ends on `dayKey`. Single-day jobs
 * slide within the same day when they still fit before the workday end; otherwise
 * (overflow or multi-day) they spill to the next conflict-free working day.
 */
const slideOrSpill = (
  job: Job, anchor: Job, dayKey: string, world: Job[], config: WorkingTimeConfig,
): ConflictResolution => {
  const base = baseOf(job);
  const scope = sharedCrewScope(job);
  const win = jobClockWindowOnDay(job, dayKey, config)!;
  const anchorWin = jobClockWindowOnDay(anchor, dayKey, config)!;
  const durHours = win.end - win.start;
  const singleDay = spannedDayKeys(job.startDate!, job.endDate ?? job.startDate!).length === 1;
  const startH = anchorWin.end;
  const endH = startH + durHours;

  if (singleDay && endH <= config.workDayEndHour + EPS) {
    const startTime = hoursToHHMM(startH);
    const endTime = hoursToHHMM(endH);
    return {
      ...base, kind: 'slide-same-day',
      change: {
        ...base, newStart: `${dayKey}T${startTime}:00`, newEnd: `${dayKey}T${endTime}:00`,
        dailyHours: { ...job.dailyHours, [dayKey]: { startTime, endTime } },
      },
      label: `Move ${job.name} to ${fmtClock(startTime)}–${fmtClock(endTime)}`,
    };
  }

  const change = placeAfterConflictFree(
    job, `${dayKey}T23:59:00`, world, scope, config, new Set([job.id]));
  return {
    ...base, kind: 'spill-next-day', change,
    label: `Move ${job.name} to ${formatDisplayDate(change.newStart)}`,
  };
};

export const resolveSameDayConflicts = (
  primary: ProposedChange,
  world: Job[],
  config: WorkingTimeConfig,
): ConflictResolution[] => {
  const subject = world.find(j => j.id === primary.jobId);
  if (!subject) return [];

  const work = world.slice();                  // mutable copy; updated as we resolve
  const resolutions: ConflictResolution[] = [];
  const visited = new Set<string>([subject.id]);
  let anchors: Job[] = [subject];

  // Forward cascade: each resolved job becomes an anchor whose own (new) window may
  // displace further shared-crew jobs. `visited` + the guard bound prevent cycles.
  for (let guard = 0; guard < 200 && anchors.length > 0; guard++) {
    const next: Job[] = [];
    for (const anchor of anchors) {
      const anchorDays = spannedDayKeys(anchor.startDate!, anchor.endDate ?? anchor.startDate!);
      for (const other of work) {
        if (visited.has(other.id)) continue;
        if (!jobsShareCrew(anchor, other)) continue;
        const clashDay = anchorDays.find(dk =>
          occupiesWorkingDay(other.startDate, other.endDate, dk, config) &&
          clockOverlaps(jobClockWindowOnDay(anchor, dk, config), jobClockWindowOnDay(other, dk, config)));
        if (!clashDay) continue;

        visited.add(other.id);
        if (other.is_locked) {
          resolutions.push({
            ...baseOf(other), kind: 'locked-blocked',
            change: { ...baseOf(other), newStart: other.startDate!, newEnd: other.endDate ?? other.startDate! },
            label: `${other.name} is locked and can't be moved`,
          });
          continue;
        }

        const res = slideOrSpill(other, anchor, clashDay, work, config);
        resolutions.push(res);
        const idx = work.findIndex(j => j.id === other.id);
        const moved = withStagedWindow(other, res.change);
        work[idx] = moved;
        next.push(moved);
      }
    }
    anchors = next;
  }
  return resolutions;
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- resolveSameDayConflicts`
Expected: PASS (6 passing).

- [ ] **Step 6: Type-check**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add services/scheduleEngine.ts services/resolveSameDayConflicts.ts services/resolveSameDayConflicts.test.ts
git commit -m "feat(scheduling): resolveSameDayConflicts service (slide/spill conflicting jobs)"
```

---

### Task 2: i18n keys

**Files:**
- Modify: `i18n/catalog.ts` (`enManual` object near line 10; `esManual` object near line 133)

**Interfaces:**
- Produces translation keys consumed by Task 3:
  - `views.JobScheduling.reschedule.SingleJobEditor.conflictingJobSingular`
  - `views.JobScheduling.reschedule.SingleJobEditor.conflictingJobPlural` (param `{count}`)
  - `views.JobScheduling.reschedule.SingleJobEditor.moveConflicting`

- [ ] **Step 1: Add the English keys**

In `i18n/catalog.ts`, inside the `enManual` object (anywhere before its closing `};`), add:

```ts
  'views.JobScheduling.reschedule.SingleJobEditor.conflictingJobSingular': '1 job conflicts with this time',
  'views.JobScheduling.reschedule.SingleJobEditor.conflictingJobPlural': '{count} jobs conflict with this time',
  'views.JobScheduling.reschedule.SingleJobEditor.moveConflicting': 'Move conflicting job',
```

- [ ] **Step 2: Add the Spanish keys**

In `i18n/catalog.ts`, inside the `esManual` object (anywhere before its closing `};`), add:

```ts
  'views.JobScheduling.reschedule.SingleJobEditor.conflictingJobSingular': '1 trabajo entra en conflicto con este horario',
  'views.JobScheduling.reschedule.SingleJobEditor.conflictingJobPlural': '{count} trabajos entran en conflicto con este horario',
  'views.JobScheduling.reschedule.SingleJobEditor.moveConflicting': 'Mover trabajo en conflicto',
```

- [ ] **Step 3: Type-check**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add i18n/catalog.ts
git commit -m "i18n(scheduling): conflicting-jobs card strings"
```

---

### Task 3: "Conflicting jobs" card in `SingleJobEditor`

**Files:**
- Modify: `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`
- Test: `components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx`

**Interfaces:**
- Consumes: `ConflictResolution` from `services/resolveSameDayConflicts` (Task 1); keys from Task 2.
- Produces: two new optional props on `SingleJobEditor` — `conflictResolutions?: ConflictResolution[]` (default `[]`) and `onMoveConflicts?: () => void` — relied on by Task 4's wiring.

- [ ] **Step 1: Write the failing tests**

Append to the `describe('SingleJobEditor', ...)` block in `SingleJobEditor.test.tsx`:

```ts
  it('renders the conflicting-jobs card and Move button when there are resolutions', () => {
    const onMoveConflicts = vi.fn();
    render(
      <SingleJobEditor
        {...base}
        conflictResolutions={[
          { jobId: 'b', jobName: 'Fence Job', jobNumber: '0002', kind: 'slide-same-day',
            change: { ...change, jobId: 'b' }, label: 'Move Fence Job to 1:00 PM–3:00 PM' },
        ]}
        onMoveConflicts={onMoveConflicts}
      />,
    );
    expect(screen.getByText('Move Fence Job to 1:00 PM–3:00 PM')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /move conflicting job/i }));
    expect(onMoveConflicts).toHaveBeenCalled();
  });

  it('hides the Move button when the only conflict is a locked job', () => {
    render(
      <SingleJobEditor
        {...base}
        conflictResolutions={[
          { jobId: 'b', jobName: 'Fence Job', jobNumber: '0002', kind: 'locked-blocked',
            change: { ...change, jobId: 'b' }, label: "Fence Job is locked and can't be moved" },
        ]}
        onMoveConflicts={vi.fn()}
      />,
    );
    expect(screen.getByText("Fence Job is locked and can't be moved")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /move conflicting job/i })).not.toBeInTheDocument();
  });

  it('renders no conflicting-jobs card when there are no resolutions', () => {
    render(<SingleJobEditor {...base} />);
    expect(screen.queryByRole('button', { name: /move conflicting job/i })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- SingleJobEditor`
Expected: FAIL — the new tests can't find the card text / Move button.

- [ ] **Step 3: Add the imports**

In `SingleJobEditor.tsx`, update the lucide import (line 2) to include `Wand2`:

```ts
import { Briefcase, CalendarClock, Users, UserCog, Info, AlertTriangle, Wand2 } from 'lucide-react';
```

Add the type import after the existing `Suggestion` import (line 6):

```ts
import { ConflictResolution } from '../../../../services/resolveSameDayConflicts';
```

- [ ] **Step 4: Add the props**

In `SingleJobEditorProps` (the interface ending at line 49), add before the closing brace:

```ts
  /** Same-day conflicts created by this edit, with proposed slides/spills. */
  conflictResolutions?: ConflictResolution[];
  /** Stage the conflict resolutions into the preview (the "Move conflicting job" action). */
  onMoveConflicts?: () => void;
```

Then add both to the destructured params (the object ending `}: SingleJobEditorProps) => {` near line 84), e.g. append `conflictResolutions = [], onMoveConflicts,` to the destructure list.

- [ ] **Step 5: Render the card**

In `SingleJobEditor.tsx`, immediately after the `jobIssues.length > 0` block (which ends at line 129, right before the `{/* When */}` comment), insert:

```tsx
      {conflictResolutions.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20 p-3">
          <div className="flex items-center gap-1.5 text-sm font-bold text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {conflictResolutions.length === 1
              ? t('views.JobScheduling.reschedule.SingleJobEditor.conflictingJobSingular')
              : t('views.JobScheduling.reschedule.SingleJobEditor.conflictingJobPlural', { count: conflictResolutions.length })}
          </div>
          <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-300">
            {conflictResolutions.map(r => <li key={r.jobId}>• {r.label}</li>)}
          </ul>
          {onMoveConflicts && conflictResolutions.some(r => r.kind !== 'locked-blocked') && (
            <button
              onClick={onMoveConflicts}
              className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-primary-700"
            >
              <Wand2 className="w-3.5 h-3.5" /> {t('views.JobScheduling.reschedule.SingleJobEditor.moveConflicting')}
            </button>
          )}
        </div>
      )}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- SingleJobEditor`
Expected: PASS (existing + 3 new).

- [ ] **Step 7: Commit**

```bash
git add components/views/JobScheduling/reschedule/SingleJobEditor.tsx components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx
git commit -m "feat(scheduling): conflicting-jobs card in SingleJobEditor"
```

---

### Task 4: Wire the resolver through the panel and view

**Files:**
- Modify: `components/views/JobScheduling/ReschedulePreviewPanel.tsx`
- Modify: `components/views/JobSchedulingView.tsx`
- Test: `components/views/JobScheduling/ReschedulePreviewPanel.test.tsx`

**Interfaces:**
- Consumes: `resolveSameDayConflicts`, `ConflictResolution` (Task 1); `conflictResolutions` / `onMoveConflicts` props on `SingleJobEditor` (Task 3); existing `withStagedWindow` (`services/productionBoard`), `preview.setChanges`, `dailyHoursEdits`.
- Produces: end-to-end behavior — pressing "Move conflicting job" merges proposals into the staged `changes` and the existing Apply commits them.

- [ ] **Step 1: Add pass-through props to `ReschedulePreviewPanel`**

In `ReschedulePreviewPanel.tsx`, add the type import after the `Suggestion` import (line 6):

```ts
import { ConflictResolution } from '../../../services/resolveSameDayConflicts';
```

Add to `ReschedulePreviewPanelProps` (before its closing brace, ~line 54):

```ts
  conflictResolutions?: ConflictResolution[];
  onMoveConflicts?: () => void;
```

Add both to the destructured params of the component (the list ending near line 60) — append `conflictResolutions, onMoveConflicts,`.

In the `<SingleJobEditor .../>` JSX (lines 167–194), add these two props (e.g. after `leapfrogJobNames={leapfrogJobNames}`):

```tsx
              conflictResolutions={conflictResolutions}
              onMoveConflicts={onMoveConflicts}
```

- [ ] **Step 2: Compute resolutions in `JobSchedulingView`**

In `JobSchedulingView.tsx`, add imports near the other service imports (the `rescheduleIssues` import is line 15):

```ts
import { resolveSameDayConflicts, ConflictResolution } from '../../services/resolveSameDayConflicts';
import { withStagedWindow } from '../../services/productionBoard';
```

(If `withStagedWindow` is already imported from `productionBoard`, add only `resolveSameDayConflicts, ConflictResolution`.)

Immediately after the `suggestions` memo (ends line 640), add:

```ts
  const conflictResolutions = useMemo<ConflictResolution[]>(() => {
    const s = preview.staged;
    if (!s || s.mode !== 'edit' || !s.primaryJobId) return [];
    const primary = s.changes.find(c => c.jobId === s.primaryJobId && !c.skipped);
    if (!primary) return [];
    // Proposed world: committed jobs with every non-skipped staged change applied,
    // including this edit and any conflicting jobs already moved. Once a conflicting
    // job is staged into its new slot it no longer clashes, so the card self-clears.
    const world = jobs.map(j => {
      const c = s.changes.find(cc => cc.jobId === j.id && !cc.skipped);
      return c ? withStagedWindow(j, c, dailyHoursEdits[j.id]) : j;
    });
    return resolveSameDayConflicts(primary, world, workConfig);
  }, [preview.staged, jobs, workConfig, dailyHoursEdits]);

  const handleMoveConflicts = () => {
    const s = preview.staged;
    if (!s) return;
    const movable = conflictResolutions.filter(r => r.kind !== 'locked-blocked');
    if (movable.length === 0) return;
    const byId = new Map(s.changes.map(c => [c.jobId, c]));
    for (const r of movable) byId.set(r.jobId, r.change);
    preview.setChanges([...byId.values()]);
  };
```

- [ ] **Step 3: Pass the props into the panel**

In the `<ReschedulePreviewPanel .../>` JSX (starts line 1421), add after `leapfrogJobNames={cascadeLeapfrogNames}` (line 1467):

```tsx
            conflictResolutions={conflictResolutions}
            onMoveConflicts={handleMoveConflicts}
```

- [ ] **Step 4: Write the integration test**

Add to `components/views/JobScheduling/ReschedulePreviewPanel.test.tsx` (reuse the file's existing `staged`/render helpers; this test only needs the new props). Insert inside the top-level `describe`:

```ts
  it('shows conflict resolutions and fires onMoveConflicts in edit mode', () => {
    const onMoveConflicts = vi.fn();
    const staged = {
      mode: 'edit' as const,
      primaryJobId: 'a',
      label: 'Reschedule Job A',
      changes: [{
        jobId: 'a', jobName: 'Job A', jobNumber: '0001',
        oldStart: '2026-06-01T08:00:00', oldEnd: '2026-06-01T12:00:00',
        newStart: '2026-06-01T08:00:00', newEnd: '2026-06-01T12:00:00',
      }],
      commit: vi.fn(),
    };
    render(
      <ReschedulePreviewPanel
        staged={staged}
        issues={[]}
        suggestions={[]}
        impact={{ affectedJobs: 0, affectedMembers: 0, totalHours: 0 } as any}
        onApply={vi.fn()}
        onCancel={vi.fn()}
        onAutoFix={vi.fn()}
        conflictResolutions={[
          { jobId: 'b', jobName: 'Job B', jobNumber: '0002', kind: 'slide-same-day',
            change: { ...staged.changes[0], jobId: 'b' }, label: 'Move Job B to 12:00 PM–3:00 PM' },
        ]}
        onMoveConflicts={onMoveConflicts}
      />,
    );
    expect(screen.getByText('Move Job B to 12:00 PM–3:00 PM')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /move conflicting job/i }));
    expect(onMoveConflicts).toHaveBeenCalled();
  });
```

> Note: if the existing test file already defines a compatible `staged` factory or `impact` fixture, use those instead of the inline literals above to stay DRY. Confirm the imports at the top of the test file include `vi`, `render`, `screen`, `fireEvent`; add any that are missing.

- [ ] **Step 5: Run the integration test to verify it fails, then passes**

Run: `npm test -- ReschedulePreviewPanel`
Expected first run (before Steps 1/3 are saved): FAIL. After all edits: PASS.

- [ ] **Step 6: Full test + type-check**

Run: `npm test`
Expected: all suites pass.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/views/JobScheduling/ReschedulePreviewPanel.tsx components/views/JobScheduling/ReschedulePreviewPanel.test.tsx components/views/JobSchedulingView.tsx
git commit -m "feat(scheduling): wire same-day conflict resolution into reschedule panel"
```

---

## Self-Review

**Spec coverage:**
- Slide conflicting job same-day → Task 1 `slide-same-day` (+ test) → ✅
- Cascade then spill to next day → Task 1 cascade loop + `spill-next-day` (+ tests) → ✅
- Surface inside reschedule panel with confirm → Tasks 3 & 4 (card + Move button + merge into staged, Apply commits) → ✅
- Detection ↔ resolution parity (shared crew + time overlap on a shared day) → Task 1 uses `jobsShareCrew` + `clockOverlaps` + `occupiesWorkingDay`, the same predicate family as `detectIssues` → ✅
- Locked job unresolvable note → Task 1 `locked-blocked` + Task 3 hides Move button when only locked → ✅
- Multi-day conflicting job → Task 1 routes to `placeAfterConflictFree` spill (duration preserved) → ✅
- Card self-clears after applying a move → Task 4 builds the proposed world from staged changes → ✅
- i18n in en + es → Task 2 → ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output.

**Type consistency:** `ConflictResolution` shape (`jobId`, `jobName`, `jobNumber`, `kind`, `change`, `label`) is identical across Tasks 1, 3, 4. `resolveSameDayConflicts(primary, world, config)` signature matches its call site in Task 4. `hoursToHHMM` exported in Task 1 Step 1 before use. Prop names `conflictResolutions` / `onMoveConflicts` consistent across `SingleJobEditor`, `ReschedulePreviewPanel`, and the view.
