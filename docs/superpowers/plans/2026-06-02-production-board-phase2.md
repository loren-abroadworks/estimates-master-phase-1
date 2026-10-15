# Production Board — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rich **Potential Issues** detector to the Reschedule Preview panel (double-booking, weekend/holiday work, crew capacity overflow, past customer due date), a **Review Manually** expandable detail view, and a right-rail **weekly weather** widget — all from mock/heuristic data.

**Architecture:** A new pure module `services/rescheduleIssues.ts` (`detectIssues`) is TDD'd and consumed by `JobSchedulingView`, which passes the result into `ReschedulePreviewPanel`. New optional data fields (`Job.customerWindow`, `SchedulingSettings.mockWeather`, `SchedulingSettings.crewDailyCapacityHours`) are additive and seeded in `mockData`/`constants`. A new `WeatherRail` component renders the forecast strip. Phase 1's preview-first commit flow is untouched.

**Tech Stack:** React 19 + TS, Vite 6, Tailwind, lucide-react, Vitest. Builds on the merged Phase 1 (`main`).

**Spec:** `docs/superpowers/specs/2026-06-02-production-board-reschedule-design.md` (Phase 2 section).

**Phase 2 decisions (confirmed):** detect double-booking + weekend/holiday + capacity overflow + past-customer-due-date (adding+seeding `customerWindow.dueDate` now); weather rail backed by a new seeded `mockWeather` setting. Review Manually is a read-only expandable detail view in Phase 2 (per-row exclusion is a later enhancement).

---

## Branch setup (do first)

- [ ] Create the working branch off `main`:
```bash
cd /Users/MiggleWork/Downloads/feb-24-estimate-master
git checkout main && git pull --ff-only 2>/dev/null; git checkout -b feature/production-board-phase2
```

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `types.ts` | Add `WeatherKind`; `Job.customerWindow?`; `SchedulingSettings.mockWeather?` + `crewDailyCapacityHours?` | Modify |
| `constants.ts` | Add defaults for the new scheduling settings | Modify |
| `data/mockData.ts` | Seed `customerWindow.dueDate` on a few jobs + a week of `mockWeather` | Modify |
| `services/rescheduleIssues.ts` | Pure `detectIssues(...)` → `ScheduleIssue[]` | Create |
| `services/rescheduleIssues.test.ts` | Unit tests | Create |
| `components/views/JobScheduling/WeatherRail.tsx` | Weekly weather strip from `mockWeather` | Create |
| `components/views/JobScheduling/ReschedulePreviewPanel.tsx` | Render Potential Issues + Review Manually expand | Modify |
| `components/views/JobSchedulingView.tsx` | Compute issues, pass to panel, render WeatherRail | Modify |

---

## Task 1: Data model additions + seeds

**Files:** Modify `types.ts`, `constants.ts`, `data/mockData.ts`

- [ ] **Step 1: Add types in `types.ts`**

Add a weather kind type near the top-level type exports (e.g. just above `CalendarDayMark`):
```ts
export type WeatherKind = 'clear' | 'rain' | 'storm' | 'snow';
```
In the `Job` interface, add (after `category?`):
```ts
  // Optional customer scheduling window (mock; powers due-date issues & suggestions).
  customerWindow?: { preferredStart?: string; dueDate?: string };
```
In `SchedulingSettings`, add (after `workDayEndHour`):
```ts
  /** Per-crew daily capacity in hours; defaults to the workday length when unset. */
  crewDailyCapacityHours?: number;
  /** Mock forecast: local 'YYYY-MM-DD' -> weather kind. No external API. */
  mockWeather?: Record<string, WeatherKind>;
```

- [ ] **Step 2: Update `constants.ts` `DEFAULT_SETTINGS.scheduling`**

Add the two fields to the existing scheduling block:
```ts
  scheduling: {
    nonWorkingWeekdays: [0, 6],
    holidays: [],
    rainDays: [],
    workDayStartHour: 8,
    workDayEndHour: 17,
    crewDailyCapacityHours: 9,
    mockWeather: {},
  }
```

- [ ] **Step 3: Seed mock data in `data/mockData.ts`**

READ the existing `MOCK_JOBS` (starts ~line 874) and the `jobDay(dayOffset, hour)` helper (~line 867).
- Add a `customerWindow` with a `dueDate` to TWO jobs so the due-date issue is demonstrable. Use a date string `'YYYY-MM-DD'`. For at least one job, set `dueDate` to a day BEFORE a plausible post-shift end (so shifting it forward trips "past due"). Derive the key from the same day math as `jobDay` — add a small helper if needed:
```ts
const dayKey = (dayOffset: number) => {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + dayOffset);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
```
  Example: on `job-2` add `customerWindow: { dueDate: dayKey(1) }` (its endDate is `jobDay(1,17)`, so any forward shift trips past-due).
- Seed `mockWeather` so the rail shows variety. The simplest, robust place is to export a helper-built object and reference it from wherever `DEFAULT_SETTINGS` is materialized for the running app. Since the app initializes settings from `DEFAULT_SETTINGS` (`constants.ts`), seed `mockWeather` THERE is awkward (constants shouldn't compute dates). Instead, export `MOCK_WEATHER` from `mockData.ts`:
```ts
export const MOCK_WEATHER: Record<string, WeatherKind> = {
  [dayKey(0)]: 'clear', [dayKey(1)]: 'rain', [dayKey(2)]: 'clear',
  [dayKey(3)]: 'storm', [dayKey(4)]: 'clear', [dayKey(5)]: 'clear', [dayKey(6)]: 'snow',
};
```
  Import `WeatherKind` in `mockData.ts`.

- [ ] **Step 4: Wire `MOCK_WEATHER` into the initial settings in `App.tsx`**

READ how `App.tsx` initializes settings (it uses `DEFAULT_SETTINGS`). Find the `useState` that holds `settings` (search `DEFAULT_SETTINGS`). Merge the mock weather into the initial scheduling settings so the rail has data without polluting `constants.ts`:
```ts
  const [settings, setSettings] = useState<GlobalSettings>({
    ...DEFAULT_SETTINGS,
    scheduling: { ...DEFAULT_SETTINGS.scheduling, mockWeather: MOCK_WEATHER },
  });
```
Adjust to match the ACTUAL existing initializer (it may already spread something — preserve it). Import `MOCK_WEATHER` from `./data/mockData`. If `settings` is initialized differently, make the minimal change that seeds `scheduling.mockWeather` from `MOCK_WEATHER`.

- [ ] **Step 5: Verify + commit**

Run: `npm run lint` → clean. `npm test` → 13 pass (no behavior change yet).
```bash
git add types.ts constants.ts data/mockData.ts App.tsx
git commit -m "feat: add customerWindow, crewDailyCapacityHours, mockWeather data + seeds"
```

---

## Task 2: `detectIssues` pure detector (TDD)

**Files:** Create `services/rescheduleIssues.ts`, `services/rescheduleIssues.test.ts`

Detects issues in the *proposed world* (committed jobs with the staged non-skipped changes applied).

- [ ] **Step 1: Write the failing test `services/rescheduleIssues.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { detectIssues, ScheduleIssue } from './rescheduleIssues';
import { configFromSettings, ProposedChange } from './scheduleEngine';
import type { Job } from '../types';

const cfg = configFromSettings(undefined, false); // weekends [0,6], no holidays
const WORKDAY = cfg.workDayEndHour - cfg.workDayStartHour; // 9
const capacity = WORKDAY; // 1 job/day per member by default

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

const kinds = (issues: ScheduleIssue[]) => issues.map(i => i.kind).sort();

describe('detectIssues', () => {
  it('flags weekend work when a job lands on Saturday', () => {
    // 2026-06-06 is a Saturday
    const jobs = [job({})];
    const chs = [change({ newStart: '2026-06-06T08:00:00', newEnd: '2026-06-06T17:00:00' })];
    expect(kinds(detectIssues(chs, jobs, cfg, capacity))).toContain('weekend');
  });

  it('flags double-booking when two proposed jobs share a member on the same day', () => {
    const jobs = [job({}), job({ id: 'j2', jobNumber: 'J-2', name: 'Job 2', crewMemberIds: ['m1'], startDate: '2026-06-09T08:00:00', endDate: '2026-06-09T17:00:00' })];
    // move j1 onto j2's day (Tue 2026-06-09), sharing member m1
    const chs = [change({ newStart: '2026-06-09T08:00:00', newEnd: '2026-06-09T17:00:00' })];
    const k = kinds(detectIssues(chs, jobs, cfg, capacity));
    expect(k).toContain('double-book');
  });

  it('flags past-due when the new end is after the customer due date', () => {
    const jobs = [job({ customerWindow: { dueDate: '2026-06-02' } })];
    const chs = [change({ newStart: '2026-06-04T08:00:00', newEnd: '2026-06-04T17:00:00' })];
    expect(kinds(detectIssues(chs, jobs, cfg, capacity))).toContain('past-due');
  });

  it('flags capacity overflow when a member exceeds capacity on a day', () => {
    const jobs = [job({}), job({ id: 'j2', jobNumber: 'J-2', crewMemberIds: ['m1'], startDate: '2026-06-09T08:00:00', endDate: '2026-06-09T17:00:00' })];
    const chs = [change({ newStart: '2026-06-09T08:00:00', newEnd: '2026-06-09T17:00:00' })];
    // capacity = 9h = 1 job/day; member m1 now on 2 jobs same day -> overflow
    expect(kinds(detectIssues(chs, jobs, cfg, capacity))).toContain('capacity');
  });

  it('returns no issues for a clean weekday move with no conflicts', () => {
    const jobs = [job({})];
    const chs = [change({ newStart: '2026-06-03T08:00:00', newEnd: '2026-06-03T17:00:00' })];
    expect(detectIssues(chs, jobs, cfg, capacity)).toHaveLength(0);
  });

  it('ignores skipped changes', () => {
    const jobs = [job({})];
    const chs = [change({ skipped: 'locked', newStart: '2026-06-06T08:00:00', newEnd: '2026-06-06T17:00:00' })];
    expect(detectIssues(chs, jobs, cfg, capacity)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run `npm test -- rescheduleIssues` → confirm FAIL (module not found).**

- [ ] **Step 3: Implement `services/rescheduleIssues.ts`**

```ts
import type { Job } from '../types';
import {
  ProposedChange, WorkingTimeConfig, isNonWorkingDay, toLocalDateKey,
} from './scheduleEngine';

export type IssueKind = 'double-book' | 'weekend' | 'capacity' | 'past-due';
export type IssueSeverity = 'high' | 'medium' | 'low';

export interface ScheduleIssue {
  jobId: string;
  jobName: string;
  kind: IssueKind;
  severity: IssueSeverity;
  message: string;
}

/**
 * Detect scheduling issues in the PROPOSED world: committed jobs with the
 * staged (non-skipped) changes applied. Only changed jobs are evaluated as the
 * subject of an issue; conflicts are checked against the full proposed world.
 * Heuristic capacity: default capacity (= workday length) allows 1 job/day per
 * member, so capacity overflow coincides with double-booking under defaults and
 * only diverges when crewDailyCapacityHours is lowered. (No per-job hours exist.)
 */
export const detectIssues = (
  changes: ProposedChange[],
  jobs: Job[],
  config: WorkingTimeConfig,
  capacityHours: number,
): ScheduleIssue[] => {
  const applied = changes.filter(c => !c.skipped);
  if (applied.length === 0) return [];

  // Proposed world: clone jobs, apply new dates for changed jobs.
  const changeById = new Map(applied.map(c => [c.jobId, c]));
  const world: Job[] = jobs.map(j => {
    const c = changeById.get(j.id);
    return c ? { ...j, startDate: c.newStart, endDate: c.newEnd } : j;
  });

  const workdayLen = Math.max(1, config.workDayEndHour - config.workDayStartHour);
  const maxJobsPerDay = Math.max(1, Math.floor((capacityHours || workdayLen) / workdayLen));

  const dayKeyOf = (iso: string) => toLocalDateKey(new Date(iso));
  const membersOf = (j: Job) => j.crewMemberIds || [];

  const issues: ScheduleIssue[] = [];

  for (const c of applied) {
    const subject = world.find(j => j.id === c.jobId);
    if (!subject) continue;
    const dayKey = dayKeyOf(c.newStart);
    const dayDate = new Date(c.newStart);

    // weekend / holiday
    if (isNonWorkingDay(dayDate, config)) {
      issues.push({ jobId: c.jobId, jobName: c.jobName, kind: 'weekend', severity: 'medium',
        message: `${c.jobName} lands on a non-working day` });
    }

    // past customer due date
    const due = subject.customerWindow?.dueDate;
    if (due && dayKeyOf(c.newEnd) > due) {
      issues.push({ jobId: c.jobId, jobName: c.jobName, kind: 'past-due', severity: 'high',
        message: `${c.jobName} ends after the customer due date (${due})` });
    }

    // double-booking: another job in the proposed world, same day, shared member
    const myMembers = new Set(membersOf(subject));
    if (myMembers.size > 0) {
      const clash = world.some(other =>
        other.id !== subject.id &&
        other.startDate && toLocalDateKey(new Date(other.startDate)) === dayKey &&
        membersOf(other).some(m => myMembers.has(m)),
      );
      if (clash) {
        issues.push({ jobId: c.jobId, jobName: c.jobName, kind: 'double-book', severity: 'high',
          message: `${c.jobName} shares a crew member with another job that day` });
      }

      // capacity: any of my members on more jobs that day than capacity allows
      const over = [...myMembers].some(m => {
        const count = world.filter(j =>
          j.startDate && toLocalDateKey(new Date(j.startDate)) === dayKey && membersOf(j).includes(m),
        ).length;
        return count > maxJobsPerDay;
      });
      if (over) {
        issues.push({ jobId: c.jobId, jobName: c.jobName, kind: 'capacity', severity: 'medium',
          message: `Crew over capacity on ${dayKey}` });
      }
    }
  }

  return issues;
};
```
> READ `services/scheduleEngine.ts` to confirm `isNonWorkingDay`, `toLocalDateKey`, `WorkingTimeConfig`, and `ProposedChange` are exported (they are, from Phase 1). The day-key string comparison for due dates works because both sides are `YYYY-MM-DD` (lexicographic = chronological).

- [ ] **Step 4: Run `npm test -- rescheduleIssues` → all pass (6 tests).**
- [ ] **Step 5: Commit**
```bash
git add services/rescheduleIssues.ts services/rescheduleIssues.test.ts
git commit -m "feat: detectIssues — double-book/weekend/capacity/past-due"
```

---

## Task 3: Wire issues into `JobSchedulingView` + panel prop swap

**Files:** Modify `components/views/JobSchedulingView.tsx`

- [ ] **Step 1: Replace the `conflictJobIds` memo with an `issues` memo**

READ the existing `conflictJobIds` memo (~line 325). Add the import:
```ts
import { detectIssues, ScheduleIssue } from '../../services/rescheduleIssues';
```
Replace the memo with:
```ts
  const issues = useMemo<ScheduleIssue[]>(() => {
    if (!preview.staged) return [];
    const capacity = settings.scheduling?.crewDailyCapacityHours
      ?? (workConfig.workDayEndHour - workConfig.workDayStartHour);
    return detectIssues(preview.staged.changes, jobs, workConfig, capacity);
  }, [preview.staged, jobs, workConfig, settings.scheduling?.crewDailyCapacityHours]);
```
Remove the now-unused `detectConflicts` import IF it is no longer used elsewhere in the file (search first; `handleDropJob` may still reference it — if so, keep it).

- [ ] **Step 2: Update the panel render to pass `issues`**

Change the `<ReschedulePreviewPanel ... conflictJobIds={conflictJobIds} />` to:
```tsx
            issues={issues}
```
(Remove the `conflictJobIds={...}` prop.)

- [ ] **Step 3: Verify + commit**

Run: `npm run lint` (will fail until Task 4 updates the panel's prop type — that's expected if done out of order; do Task 4 next and lint together). To keep commits green, do Task 4 BEFORE committing, then:
```bash
npm run lint && npm test
git add components/views/JobSchedulingView.tsx
git commit -m "feat: compute Potential Issues for the preview panel"
```
> NOTE: Tasks 3 and 4 are interdependent (the panel prop changes from `conflictJobIds` to `issues`). Implement both, then run lint/test/commit together. Commit Task 3 + Task 4 files in one commit if that keeps the tree green, or commit Task 4 first.

---

## Task 4: `ReschedulePreviewPanel` — Potential Issues + Review Manually

**Files:** Modify `components/views/JobScheduling/ReschedulePreviewPanel.tsx`

- [ ] **Step 1: Swap the `conflictJobIds` prop for `issues` and render the issues list**

Replace the props interface field `conflictJobIds: string[]` with:
```ts
  issues: import('../../../services/rescheduleIssues').ScheduleIssue[];
```
(Or add a top import: `import { ScheduleIssue } from '../../../services/rescheduleIssues';` and use `issues: ScheduleIssue[];`.)

Replace the existing `{conflictJobIds.length > 0 && (...)}` block with a Potential Issues section:
```tsx
        {issues.length > 0 && (
          <div className="mb-3 space-y-1">
            <div className="text-xs font-black uppercase tracking-widest text-gray-400">Potential Issues</div>
            {issues.map((iss, i) => (
              <div key={`${iss.jobId}-${iss.kind}-${i}`} className="flex items-center gap-2 text-sm">
                <span className={
                  iss.severity === 'high' ? 'text-red-500'
                  : iss.severity === 'medium' ? 'text-amber-500' : 'text-gray-400'
                }>
                  <AlertCircle className="w-4 h-4" />
                </span>
                <span className="text-gray-700 dark:text-gray-200">{iss.message}</span>
              </div>
            ))}
          </div>
        )}
```

- [ ] **Step 2: Add a "Review Manually" expand toggle (read-only detail)**

Add local state and a button. Import `useState` from React and `ChevronDown`/`ChevronUp` from lucide-react.
```tsx
  const [reviewing, setReviewing] = useState(false);
```
In the footer button row, add (left of Cancel):
```tsx
          <Button variant="ghost" onClick={() => setReviewing(r => !r)}>
            {reviewing ? 'Hide details' : 'Review Manually'}
          </Button>
```
When `reviewing`, render an expanded per-row detail block ABOVE the footer that lists every changed job with its old→new and any issues attached to that job:
```tsx
        {reviewing && (
          <div className="mb-4 border rounded-lg border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
            {changed.map(c => {
              const jobIssues = issues.filter(i => i.jobId === c.jobId);
              return (
                <div key={`rev-${c.jobId}`} className="p-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-bold w-40 truncate">{c.jobName}</span>
                    <span className="text-gray-400">{fmt(c.oldStart)}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <span className="text-primary-600 dark:text-primary-400">{fmt(c.newStart)}</span>
                  </div>
                  {jobIssues.map((iss, i) => (
                    <div key={i} className="ml-1 mt-1 text-xs text-amber-600 dark:text-amber-400">• {iss.message}</div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
```
> Confirm `Button` supports `variant="ghost"` (Phase 1 review confirmed variants include `'ghost'`). If not, use `'secondary'`.

- [ ] **Step 3: Verify (with Task 3) + commit**
```bash
npm run lint && npm test
git add components/views/JobScheduling/ReschedulePreviewPanel.tsx
git commit -m "feat: Potential Issues list + Review Manually detail in preview panel"
```

---

## Task 5: `WeatherRail` component + integrate into the board view

**Files:** Create `components/views/JobScheduling/WeatherRail.tsx`; Modify `components/views/JobSchedulingView.tsx`

- [ ] **Step 1: Implement `WeatherRail.tsx`**

```tsx
import React from 'react';
import { Sun, CloudRain, CloudSnow, CloudLightning } from 'lucide-react';
import { WeatherKind } from '../../../types';
import { toLocalDateKey } from '../../../services/scheduleEngine';

interface WeatherRailProps {
  weekDays: Date[];
  mockWeather: Record<string, WeatherKind>;
}

const ICON: Record<WeatherKind, React.ReactNode> = {
  clear: <Sun className="w-4 h-4 text-amber-500" />,
  rain: <CloudRain className="w-4 h-4 text-blue-500" />,
  storm: <CloudLightning className="w-4 h-4 text-purple-500" />,
  snow: <CloudSnow className="w-4 h-4 text-sky-400" />,
};

export const WeatherRail = ({ weekDays, mockWeather }: WeatherRailProps) => (
  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
    <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">This Week</div>
    <div className="space-y-1.5">
      {weekDays.map(d => {
        const kind = mockWeather[toLocalDateKey(d)] || 'clear';
        return (
          <div key={d.toISOString()} className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-300">{d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</span>
            <span className="flex items-center gap-1 capitalize text-gray-500">{ICON[kind]} {kind}</span>
          </div>
        );
      })}
    </div>
  </div>
);
```

- [ ] **Step 2: Render `WeatherRail` alongside the board in `JobSchedulingView`**

READ where `<ProductionBoard .../>` renders (~line 530). Wrap the board + a right rail in a flex row so the rail sits to the right. Import `WeatherRail`. Minimal approach:
```tsx
        {activeTab === 'assignments' && (
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <ProductionBoard /* ...existing props unchanged... */ />
            </div>
            <div className="lg:w-56 shrink-0">
              <WeatherRail weekDays={weekDays} mockWeather={settings.scheduling?.mockWeather || {}} />
            </div>
          </div>
        )}
```
Keep all existing `<ProductionBoard>` props exactly as they are.

- [ ] **Step 3: Verify + commit**
```bash
npm run lint && npm test
git add components/views/JobScheduling/WeatherRail.tsx components/views/JobSchedulingView.tsx
git commit -m "feat: weekly weather rail on the production board"
```

---

## Task 6: Final integration pass

**Files:** none (verification + commit)

- [ ] **Step 1: Full suite** — `npm test` → all pass (Phase 1's 13 + the 6 new = 19). Report the count.
- [ ] **Step 2: Type-check** — `npm run lint` → clean.
- [ ] **Step 3: Build** — `npm run build` → succeeds.
- [ ] **Step 4: Manual checklist (dev server `npm run dev`):**
  - [ ] Job Scheduling → Board shows the weekly weather rail on the right.
  - [ ] Staging a reschedule (drag / rain day / bulk / single-move) shows a **Potential Issues** list when applicable (try moving a job onto a weekend, or onto another job's day to trigger double-book/capacity, or a job past its seeded due date).
  - [ ] "Review Manually" expands per-row detail with issues annotated; "Hide details" collapses it.
  - [ ] Apply / Cancel still behave as in Phase 1.
- [ ] **Step 5:** No extra commit needed if all green (work already committed per task).

---

## Done — Phase 2 complete

Potential Issues detection, Review Manually detail, and the weather rail are in. Phase 3 (Smart Suggestions + Auto-Fix) reuses `mockWeather`, `crewDailyCapacityHours`, and `customerWindow` (incl. `preferredStart`). Deferred cleanup items live in `docs/superpowers/backlog.md`.
