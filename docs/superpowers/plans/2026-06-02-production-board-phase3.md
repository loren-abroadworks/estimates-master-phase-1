# Production Board — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add **Smart Suggestions** (mock/heuristic fixes for detected issues) to the Reschedule Preview panel and a one-click **Auto-Fix Issues** button that merges all suggestions into the staged change set for review before Apply.

**Architecture:** A new pure module `services/rescheduleSuggestions.ts` (`buildSuggestions`) proposes a resolving `ProposedChange` for each changed job that currently has an issue (moves it to the next working, clear-weather, conflict-free day). The staging layer is refactored so `commit` applies the *current* staged changes (not a captured snapshot) and the reducer gains a `SET_CHANGES` action — this is what lets Auto-Fix rewrite the staged set. The panel renders a Smart Suggestions list + Auto-Fix button; `JobSchedulingView` wires them.

**Tech Stack:** React 19 + TS, Vite 6, Tailwind, lucide-react, Vitest. Builds on merged Phase 2 (`main`).

**Spec:** `docs/superpowers/specs/2026-06-02-production-board-reschedule-design.md` (Phase 3 section).

**Phase 3 decisions (confirmed earlier):** Smart data is mock/heuristic (no external API); **Auto-Fix = one-click "apply all suggestions"** into the staged set, then the user still reviews + Applies.

---

## Branch setup (do first)

- [ ] `cd /Users/MiggleWork/Downloads/feb-24-estimate-master && git checkout main && git checkout -b feature/production-board-phase3`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `services/reschedulePreview.ts` | `commit(effective)` signature + `SET_CHANGES` action | Modify |
| `services/reschedulePreview.test.ts` | Test for `SET_CHANGES` | Modify |
| `components/views/JobScheduling/useReschedulePreview.ts` | Expose `setChanges` | Modify |
| `services/rescheduleSuggestions.ts` | Pure `buildSuggestions(...)` → `Suggestion[]` | Create |
| `services/rescheduleSuggestions.test.ts` | Unit tests | Create |
| `components/views/JobSchedulingView.tsx` | Update 4 commit closures; compute suggestions; Auto-Fix handler | Modify |
| `components/views/JobScheduling/ReschedulePreviewPanel.tsx` | Smart Suggestions list + Auto-Fix button; Apply passes current changes | Modify |

---

## Task 1: Staging refactor — `commit(effective)` + `SET_CHANGES` (TDD where pure)

This unblocks Auto-Fix: the panel must commit the *current* staged changes, and Auto-Fix must be able to replace them.

**Files:** `services/reschedulePreview.ts` (+test), `components/views/JobScheduling/useReschedulePreview.ts`

- [ ] **Step 1: Update the staging types/reducer in `services/reschedulePreview.ts`**

Change `StagedReschedule.commit` to accept the effective changes, and add a `SET_CHANGES` action:
```ts
export interface StagedReschedule {
  changes: ProposedChange[];
  label: string;
  /** Commit the given (possibly Auto-Fixed) changes. */
  commit: (effective: ProposedChange[]) => void;
}

export type PreviewAction =
  | { type: 'STAGE'; payload: StagedReschedule }
  | { type: 'SET_CHANGES'; payload: ProposedChange[] }
  | { type: 'CLEAR' };

export const previewReducer = (state: PreviewState, action: PreviewAction): PreviewState => {
  switch (action.type) {
    case 'STAGE': return { staged: action.payload };
    case 'SET_CHANGES':
      return state.staged ? { staged: { ...state.staged, changes: action.payload } } : state;
    case 'CLEAR': return { staged: null };
    default: return state;
  }
};
```
(`summarizeStaged` and `initialPreviewState` unchanged.)

- [ ] **Step 2: Add a failing test for `SET_CHANGES` in `services/reschedulePreview.test.ts`**

Append:
```ts
describe('previewReducer SET_CHANGES', () => {
  it('replaces the staged changes, preserving label and commit', () => {
    const c0 = change({});
    const c1 = change({ jobId: 'j2', jobName: 'Job 2' });
    const commit = () => {};
    const s1 = previewReducer(initialPreviewState, { type: 'STAGE', payload: { changes: [c0], label: 'L', commit } });
    const s2 = previewReducer(s1, { type: 'SET_CHANGES', payload: [c0, c1] });
    expect(s2.staged?.changes).toHaveLength(2);
    expect(s2.staged?.label).toBe('L');
    expect(s2.staged?.commit).toBe(commit);
  });
  it('SET_CHANGES is a no-op when nothing is staged', () => {
    const s = previewReducer(initialPreviewState, { type: 'SET_CHANGES', payload: [change({})] });
    expect(s.staged).toBeNull();
  });
});
```
The existing `staged(...)` helper in this test file builds `commit: () => {}` — that still satisfies the new `(effective) => void` type (a 0-arg fn is assignable). Leave existing tests as-is. Run `npm test -- reschedulePreview` → the two new tests should pass once Step 1 is in (write test, confirm red against the OLD reducer first if you implement test before reducer; either order is fine since both are in this task — ensure final state is green).

- [ ] **Step 3: Expose `setChanges` from the hook `useReschedulePreview.ts`**

```ts
  const setChanges = useCallback((changes: ProposedChange[]) => {
    dispatch({ type: 'SET_CHANGES', payload: changes });
  }, []);
```
Import `ProposedChange` type (from `../../../services/scheduleEngine`) for the param. Add `setChanges` to the returned object.

- [ ] **Step 4: Update the 4 commit closures + panel Apply** in `components/views/JobSchedulingView.tsx`

Every `preview.stage({ ..., commit: () => onApplySchedule(X, label, ...) })` becomes `commit: (eff) => onApplySchedule(eff, label, ...)`:
  - **drag** (`handleDropJob`): `commit: (eff) => onApplySchedule(eff, \`Move ${job.name}\`)`
  - **rain** (`handleMarkRainDay`): `commit: (eff) => { persist(); onApplySchedule(eff, label, undoPersist); }`
  - **bulk** (`CascadeRescheduleModal.onApply`): `commit: (eff) => onApplySchedule(eff, label)`
  - **single-move** (`SingleJobMoveDrawer.onApply`): `commit: (eff) => onApplySchedule(eff, label)`

- [ ] **Step 5:** In `components/views/JobScheduling/ReschedulePreviewPanel.tsx`, change Apply to pass the current changes. Find the `onApply` prop usage — actually `onApply` is a no-arg callback owned by the parent. Simplest: the PARENT (`JobSchedulingView`) owns the Apply wiring. Update the panel's `onApply` call site in `JobSchedulingView`:
```tsx
            onApply={() => { preview.staged?.commit(preview.staged.changes); preview.clear(); }}
```
(The panel's `onApply: () => void` prop signature is unchanged; only the parent's closure changes. No panel prop change needed for this step.)

- [ ] **Step 6: Verify + commit**

`npm test` → all pass (19 + 2 new = 21). `npm run lint` → clean. `npm run build` → succeeds.
```bash
git add services/reschedulePreview.ts services/reschedulePreview.test.ts components/views/JobScheduling/useReschedulePreview.ts components/views/JobSchedulingView.tsx
git commit -m "refactor: commit applies current staged changes; add SET_CHANGES for Auto-Fix"
```

---

## Task 2: `buildSuggestions` pure module (TDD)

For each non-skipped staged change that currently has an issue, propose a resolving move to the next working, clear-weather, conflict-free day.

**Files:** Create `services/rescheduleSuggestions.ts`, `services/rescheduleSuggestions.test.ts`

- [ ] **Step 1: Write the failing test `services/rescheduleSuggestions.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildSuggestions, Suggestion } from './rescheduleSuggestions';
import { configFromSettings, ProposedChange } from './scheduleEngine';
import type { Job, WeatherKind } from '../types';

const cfg = configFromSettings(undefined, false); // weekends [0,6]
const capacity = cfg.workDayEndHour - cfg.workDayStartHour;

const job = (over: Partial<Job>): Job => ({
  id: 'j1', jobNumber: 'J-1', name: 'Job 1', stage: 'Scheduled',
  startDate: '2026-06-02T08:00:00', endDate: '2026-06-02T17:00:00',
  crewMemberIds: ['m1'], dateCreated: '', clientId: '', estimateId: '', address: '',
  ...over,
} as Job);

const change = (over: Partial<ProposedChange>): ProposedChange => ({
  jobId: 'j1', jobName: 'Job 1', jobNumber: 'J-1',
  oldStart: '2026-06-02T08:00:00', oldEnd: '2026-06-02T17:00:00',
  newStart: '2026-06-02T08:00:00', newEnd: '2026-06-02T17:00:00',
  ...over,
});

describe('buildSuggestions', () => {
  it('suggests moving a job off a weekend to the next working day', () => {
    const jobs = [job({})];
    const chs = [change({ newStart: '2026-06-06T08:00:00', newEnd: '2026-06-06T17:00:00' })]; // Sat
    const sugg = buildSuggestions(chs, jobs, cfg, { mockWeather: {}, capacityHours: capacity });
    expect(sugg).toHaveLength(1);
    expect(sugg[0].jobId).toBe('j1');
    // Mon 2026-06-08 is the next working day
    expect(sugg[0].change.newStart.startsWith('2026-06-08')).toBe(true);
  });

  it('suggests moving a job off a rain day to the next clear working day', () => {
    const jobs = [job({})];
    const weather: Record<string, WeatherKind> = { '2026-06-03': 'rain', '2026-06-04': 'clear' };
    const chs = [change({ newStart: '2026-06-03T08:00:00', newEnd: '2026-06-03T17:00:00' })]; // Wed, rain
    const sugg = buildSuggestions(chs, jobs, cfg, { mockWeather: weather, capacityHours: capacity });
    expect(sugg).toHaveLength(1);
    expect(sugg[0].change.newStart.startsWith('2026-06-04')).toBe(true); // Thu clear
  });

  it('returns no suggestion for a clean change', () => {
    const jobs = [job({})];
    const chs = [change({ newStart: '2026-06-04T08:00:00', newEnd: '2026-06-04T17:00:00' })]; // Thu, clear, no conflict
    expect(buildSuggestions(chs, jobs, cfg, { mockWeather: {}, capacityHours: capacity })).toHaveLength(0);
  });

  it('preserves the original old dates and the job duration in the suggested change', () => {
    const jobs = [job({})];
    const chs = [change({ newStart: '2026-06-06T08:00:00', newEnd: '2026-06-06T17:00:00' })];
    const s = buildSuggestions(chs, jobs, cfg, { mockWeather: {}, capacityHours: capacity })[0];
    expect(s.change.oldStart).toBe('2026-06-02T08:00:00'); // original committed start
    // duration preserved (9h same-day)
    const dur = new Date(s.change.newEnd).getTime() - new Date(s.change.newStart).getTime();
    expect(dur).toBe(9 * 3_600_000);
  });

  it('ignores skipped changes', () => {
    const jobs = [job({})];
    const chs = [change({ skipped: 'locked', newStart: '2026-06-06T08:00:00', newEnd: '2026-06-06T17:00:00' })];
    expect(buildSuggestions(chs, jobs, cfg, { mockWeather: {}, capacityHours: capacity })).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run `npm test -- rescheduleSuggestions` → FAIL (module not found).**

- [ ] **Step 3: Implement `services/rescheduleSuggestions.ts`**

```ts
import type { Job, WeatherKind } from '../types';
import {
  ProposedChange, WorkingTimeConfig, isNonWorkingDay, toLocalDateKey,
} from './scheduleEngine';
import { detectIssues } from './rescheduleIssues';

export interface Suggestion {
  id: string;
  jobId: string;
  label: string;
  /** The resolving change to merge into the staged set on Auto-Fix. */
  change: ProposedChange;
}

interface SuggestionOpts {
  mockWeather: Record<string, WeatherKind>;
  capacityHours: number;
}

const MS_PER_DAY = 86_400_000;
const BAD_WEATHER: WeatherKind[] = ['rain', 'storm', 'snow'];

/**
 * For each non-skipped staged change that currently has a detected issue,
 * propose a move to the next day that is: a working day, clear (or unknown)
 * weather, and free of a same-day shared-member conflict in the proposed world.
 * Mock/heuristic — no external API. Returns at most one suggestion per job.
 */
export const buildSuggestions = (
  changes: ProposedChange[],
  jobs: Job[],
  config: WorkingTimeConfig,
  opts: SuggestionOpts,
): Suggestion[] => {
  const applied = changes.filter(c => !c.skipped);
  if (applied.length === 0) return [];

  // Jobs that have an issue worth fixing.
  const issues = detectIssues(changes, jobs, config, opts.capacityHours);
  const flagged = new Set(issues.map(i => i.jobId));
  if (flagged.size === 0) return [];

  const changeById = new Map(applied.map(c => [c.jobId, c]));
  const world: Job[] = jobs.map(j => {
    const c = changeById.get(j.id);
    return c ? { ...j, startDate: c.newStart, endDate: c.newEnd } : j;
  });
  const membersOf = (j: Job) => j.crewMemberIds || [];

  const isBadWeather = (key: string) => BAD_WEATHER.includes(opts.mockWeather[key]);

  const suggestions: Suggestion[] = [];

  for (const c of applied) {
    if (!flagged.has(c.jobId)) continue;
    const subject = world.find(j => j.id === c.jobId);
    if (!subject) continue;
    const myMembers = new Set(membersOf(subject));
    const durMs = new Date(c.newEnd).getTime() - new Date(c.newStart).getTime();

    // Scan forward up to 21 days for a good slot.
    let candidate: Date | null = null;
    for (let i = 1; i <= 21; i++) {
      const d = new Date(c.newStart);
      d.setDate(d.getDate() + i);
      const key = toLocalDateKey(d);
      if (isNonWorkingDay(d, config)) continue;
      if (isBadWeather(key)) continue;
      const clash = world.some(other =>
        other.id !== subject.id &&
        other.startDate && toLocalDateKey(new Date(other.startDate)) === key &&
        membersOf(other).some(m => myMembers.has(m)),
      );
      if (clash) continue;
      candidate = d;
      break;
    }
    if (!candidate) continue;

    candidate.setHours(config.workDayStartHour, 0, 0, 0);
    const newStart = candidate.toISOString();
    const newEnd = new Date(candidate.getTime() + durMs).toISOString();
    suggestions.push({
      id: `sugg-${c.jobId}`,
      jobId: c.jobId,
      label: `Move ${c.jobName} to ${toLocalDateKey(candidate)}`,
      change: { ...c, newStart, newEnd },
    });
  }

  return suggestions;
};
```
> READ `services/rescheduleIssues.ts` + `services/scheduleEngine.ts` to confirm exports. The suggestion's `change` spreads the staged change `c` (keeping `oldStart`/`oldEnd`/`jobName`/etc.) and overrides `newStart`/`newEnd`.

- [ ] **Step 4: `npm test -- rescheduleSuggestions` → 5 pass.**
- [ ] **Step 5: Commit** `git add services/rescheduleSuggestions.ts services/rescheduleSuggestions.test.ts && git commit -m "feat: buildSuggestions — resolve issues by moving to next good day"`

---

## Task 3: Panel — Smart Suggestions list + Auto-Fix button

**Files:** Modify `components/views/JobScheduling/ReschedulePreviewPanel.tsx`

- [ ] **Step 1: Add props** for suggestions + auto-fix. Add to the interface:
```ts
  suggestions: import('../../../services/rescheduleSuggestions').Suggestion[];
  onAutoFix: () => void;
```
(Or a top import `import { Suggestion } from '../../../services/rescheduleSuggestions';` and `suggestions: Suggestion[];`.) Destructure both.

- [ ] **Step 2: Render a Smart Suggestions section** (after the Potential Issues block):
```tsx
        {suggestions.length > 0 && (
          <div className="mb-3 space-y-1">
            <div className="text-xs font-black uppercase tracking-widest text-gray-400">Smart Suggestions</div>
            {suggestions.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                {s.label}
              </div>
            ))}
          </div>
        )}
```
Import `Lightbulb` from lucide-react.

- [ ] **Step 3: Add the Auto-Fix button** in the footer row, between Review Manually and Cancel — only when there are suggestions:
```tsx
          {suggestions.length > 0 && (
            <Button variant="secondary" onClick={onAutoFix}>Auto-Fix Issues</Button>
          )}
```

- [ ] **Step 4: Verify (with Task 4) + commit** (panel prop additions need the parent to pass them — do Task 4, then lint/commit together).

---

## Task 4: Wire suggestions + Auto-Fix into `JobSchedulingView`

**Files:** Modify `components/views/JobSchedulingView.tsx`

- [ ] **Step 1: Compute suggestions** (near the `issues` memo):
```ts
import { buildSuggestions, Suggestion } from '../../services/rescheduleSuggestions';
```
```ts
  const suggestions = useMemo<Suggestion[]>(() => {
    if (!preview.staged) return [];
    const capacity = settings.scheduling?.crewDailyCapacityHours
      ?? (workConfig.workDayEndHour - workConfig.workDayStartHour);
    return buildSuggestions(preview.staged.changes, jobs, workConfig, {
      mockWeather: settings.scheduling?.mockWeather || {},
      capacityHours: capacity,
    });
  }, [preview.staged, jobs, workConfig, settings.scheduling?.crewDailyCapacityHours, settings.scheduling?.mockWeather]);
```

- [ ] **Step 2: Add the Auto-Fix handler** — merge every suggestion's change into the staged set by jobId, then `setChanges`:
```ts
  const handleAutoFix = () => {
    if (!preview.staged) return;
    const byId = new Map(suggestions.map(s => [s.jobId, s.change]));
    const merged = preview.staged.changes.map(c => byId.get(c.jobId) ?? c);
    preview.setChanges(merged);
  };
```
(`setChanges` comes from the hook — added in Task 1.)

- [ ] **Step 3: Pass the new props** to `<ReschedulePreviewPanel>`:
```tsx
            suggestions={suggestions}
            onAutoFix={handleAutoFix}
```

- [ ] **Step 4: Verify + commit** (Tasks 3 + 4 together):
```bash
npm run lint && npm test
git add components/views/JobScheduling/ReschedulePreviewPanel.tsx components/views/JobSchedulingView.tsx
git commit -m "feat: Smart Suggestions + one-click Auto-Fix in preview panel"
```

---

## Task 5: Final integration pass

- [ ] **Step 1:** `npm test` → all pass (21 + 5 new = 26). Report count.
- [ ] **Step 2:** `npm run lint` → clean.
- [ ] **Step 3:** `npm run build` → succeeds.
- [ ] **Step 4: Manual checklist (`npm run dev`):**
  - [ ] Stage a reschedule that creates an issue (e.g. drag a job onto a weekend, or onto a `mockWeather` rain/storm day, or onto another job's day).
  - [ ] A **Smart Suggestions** list appears with a "Move {job} to {date}" entry.
  - [ ] Clicking **Auto-Fix Issues** rewrites the staged changes (timeline updates to the suggested dates) and the Potential Issues list shrinks/clears.
  - [ ] **Apply** commits the (Auto-Fixed) changes; Cancel discards.
  - [ ] Phase 1/2 behavior intact (drag/rain/bulk/single-move, issues, weather rail, Review Manually).
- [ ] **Step 5:** No extra commit if green.

---

## Done — Phase 3 complete

Smart Suggestions + Auto-Fix close out the Production Board build. After this, address the deferred items in `docs/superpowers/backlog.md` (incl. the user's running list).
