# Conflict-Aware Schedule Reflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a job's hours are edited in the Edit Schedule panel, re-place the job's leftover hours into time the crew is actually free (instead of densely repacking and double-booking), moving blocking shared-crew jobs out of the way — all gated behind the existing "Cascade following jobs" toggle.

**Architecture:** Add pure clock-time primitives and a `reflowAvoidingConflicts` composer to `services/scheduleEngine.ts` (no React, fully unit-tested, deterministic). Wire `JobSchedulingView` so that with the master toggle ON, edits route through the composer and stage `[primary, ...displaced]` changes; with it OFF, hours are applied literally. Add a secondary "Keep existing days as-is" toggle (Smart vs Simple) that persists across editor opens.

**Tech Stack:** TypeScript, React, Vitest (`npx vitest run <file>`), existing `ProposedChange` → preview → Apply pipeline.

---

## Background the engineer needs

- A job's **total hours** is `scheduledWindowHours(job, config)` — the sum of its per-day window lengths (already defined in `scheduleEngine.ts:148`).
- **`dailyHours`** is `Record<string, { startTime: string; endTime: string }>` — **exactly one block per day per job** (a hard constraint; never produce two blocks for one day).
- Times are local `'HH:MM'`. Helpers already in `scheduleEngine.ts`: `hhmmToHours('13:30')→13.5` (private, line 137), `hoursToHHMM(13.5)→'13:30'` (private, line 131), `toLocalDateKey`, `spannedDayKeys`, `workingDayKeys`, `occupiesWorkingDay`, `advanceWorkingDays`, `isNonWorkingDay`, private `effectiveStart`/`effectiveEnd`/`isInScope`.
- **Conflict** = two jobs that share crew (caller supplies the crew scope), fall on the same day, and overlap in clock time.
- **Smart mode** extends a pinned day's window into adjacent free time (one block/day). **Simple mode** never touches existing days. Leftover that can't be placed on existing days goes to new working days; if a new day is fully blocked by shared-crew jobs, those jobs are bumped to after the project, bounded by an `untilDate` cutoff.

Spec: `docs/superpowers/specs/2026-06-13-conflict-aware-reflow-design.md`.

## File structure

| File | Responsibility | Change |
|---|---|---|
| `services/scheduleEngine.ts` | Clock-time primitives + `reflowAvoidingConflicts` | Modify (add ~5 exports + 2 private helpers) |
| `services/scheduleEngine.test.ts` | Unit tests for the above | Modify (add describe blocks) |
| `components/views/JobScheduling/reschedule/SingleJobEditor.tsx` | "Keep existing days as-is" secondary toggle | Modify |
| `components/views/JobScheduling/ReschedulePreviewPanel.tsx` | Thread the new props through | Modify |
| `components/views/JobSchedulingView.tsx` | State + route edits through composer / literal | Modify |
| `components/views/JobScheduling/ReschedulePreviewPanel.test.tsx` | Toggle render test | Modify |

---

## Task 1: `ClockInterval` type + `jobClockWindowOnDay`

A job's clock-time window on a single day, in fractional hours.

**Files:**
- Modify: `services/scheduleEngine.ts` (add after `freeIntervals`/near `occupiesWorkingDay`; place the new exports just below `occupiesWorkingDay`, before `advanceWorkingDays`)
- Test: `services/scheduleEngine.test.ts`

- [ ] **Step 1: Write the failing test**

Add at the end of `services/scheduleEngine.test.ts`:

```ts
import { jobClockWindowOnDay } from './scheduleEngine';

describe('jobClockWindowOnDay', () => {
  const cfg = { skipNonWorkingDays: true, weekendDays: [0, 6], holidays: [], workDayStartHour: 8, workDayEndHour: 17 };
  const mk = (over: Partial<Job>): Job => ({
    id: 'j', jobNumber: 'J', name: 'J', stage: 'Scheduled',
    startDate: '2026-06-09T08:00:00', endDate: '2026-06-11T17:00:00', ...over,
  } as Job);

  it('uses the per-day window when present', () => {
    const job = mk({ dailyHours: { '2026-06-09': { startTime: '13:00', endTime: '17:00' } } });
    expect(jobClockWindowOnDay(job, '2026-06-09', cfg)).toEqual({ start: 13, end: 17 });
  });

  it('clamps first day to start-time..workday-end and middle days to the full workday', () => {
    const job = mk({ startDate: '2026-06-09T10:00:00', endDate: '2026-06-11T15:00:00' });
    expect(jobClockWindowOnDay(job, '2026-06-09', cfg)).toEqual({ start: 10, end: 17 }); // first
    expect(jobClockWindowOnDay(job, '2026-06-10', cfg)).toEqual({ start: 8, end: 17 });  // middle
    expect(jobClockWindowOnDay(job, '2026-06-11', cfg)).toEqual({ start: 8, end: 15 });  // last
  });

  it('returns null for a day the job does not occupy', () => {
    expect(jobClockWindowOnDay(mk({}), '2026-06-12', cfg)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t "jobClockWindowOnDay"`
Expected: FAIL — `jobClockWindowOnDay is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `services/scheduleEngine.ts`, add immediately after `occupiesWorkingDay` (around line 296):

```ts
/** A clock-time window inside a single workday, in fractional hours (e.g. 13.5 = 1:30 PM). */
export interface ClockInterval { start: number; end: number }

/**
 * The clock-time window a job occupies on `dayKey`, in fractional hours, or null
 * when the job does not work that day. Uses the per-day window when present; else
 * clamps: first day = start-time → workday end, last day = workday start → end-time,
 * middle days = the full workday.
 */
export const jobClockWindowOnDay = (
  job: Job,
  dayKey: string,
  config: WorkingTimeConfig,
): ClockInterval | null => {
  if (!occupiesWorkingDay(job.startDate, job.endDate, dayKey, config)) return null;
  const w = job.dailyHours?.[dayKey];
  if (w) return { start: hhmmToHours(w.startTime), end: hhmmToHours(w.endTime) };
  const s = effectiveStart(job, config);
  const e = effectiveEnd(job, config);
  const startKey = s ? toLocalDateKey(s) : dayKey;
  const endKey = e ? toLocalDateKey(e) : dayKey;
  const start = dayKey === startKey && s ? s.getHours() + s.getMinutes() / 60 : config.workDayStartHour;
  const end = dayKey === endKey && e ? e.getHours() + e.getMinutes() / 60 : config.workDayEndHour;
  return { start, end };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts -t "jobClockWindowOnDay"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat(schedule): jobClockWindowOnDay clock-time primitive"
```

---

## Task 2: `occupiedIntervals` (with private `mergeIntervals`)

Merged clock-time intervals occupied by in-scope (shared-crew) jobs on a day.

**Files:**
- Modify: `services/scheduleEngine.ts` (add after `jobClockWindowOnDay`)
- Test: `services/scheduleEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { occupiedIntervals } from './scheduleEngine';

describe('occupiedIntervals', () => {
  const cfg = { skipNonWorkingDays: true, weekendDays: [0, 6], holidays: [], workDayStartHour: 8, workDayEndHour: 17 };
  const mk = (over: Partial<Job>): Job => ({
    id: 'j', jobNumber: 'J', name: 'J', stage: 'Scheduled',
    startDate: '2026-06-09T08:00:00', endDate: '2026-06-09T17:00:00', crewMemberIds: ['m1'], ...over,
  } as Job);

  it('merges overlapping/adjacent shared-crew windows and excludes the subject', () => {
    const jobs = [
      mk({ id: 'self', dailyHours: { '2026-06-09': { startTime: '13:00', endTime: '17:00' } } }),
      mk({ id: 'a', dailyHours: { '2026-06-09': { startTime: '08:00', endTime: '10:00' } } }),
      mk({ id: 'b', dailyHours: { '2026-06-09': { startTime: '10:00', endTime: '12:00' } } }),
    ];
    const occ = occupiedIntervals(jobs, { crewMemberIds: ['m1'] }, '2026-06-09', cfg, 'self');
    expect(occ).toEqual([{ start: 8, end: 12 }]);
  });

  it('ignores jobs out of crew scope', () => {
    const jobs = [mk({ id: 'a', crewMemberIds: ['other'], dailyHours: { '2026-06-09': { startTime: '08:00', endTime: '12:00' } } })];
    expect(occupiedIntervals(jobs, { crewMemberIds: ['m1'] }, '2026-06-09', cfg)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t "occupiedIntervals"`
Expected: FAIL — `occupiedIntervals is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add after `jobClockWindowOnDay`:

```ts
/** Merge overlapping/touching intervals into a sorted, disjoint set. */
const mergeIntervals = (ivs: ClockInterval[]): ClockInterval[] => {
  const sorted = ivs.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: ClockInterval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else out.push({ start: iv.start, end: iv.end });
  }
  return out;
};

/**
 * Merged clock-time intervals occupied on `dayKey` by jobs in `scope` (shared crew),
 * excluding `excludeJobId`. Locked jobs ARE included (they are real commitments).
 */
export const occupiedIntervals = (
  jobs: Job[],
  scope: CascadeScope,
  dayKey: string,
  config: WorkingTimeConfig,
  excludeJobId?: string,
): ClockInterval[] => {
  const ivs: ClockInterval[] = [];
  for (const j of jobs) {
    if (j.id === excludeJobId) continue;
    if (!isInScope(j, scope)) continue;
    const w = jobClockWindowOnDay(j, dayKey, config);
    if (w) ivs.push(w);
  }
  return mergeIntervals(ivs);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts -t "occupiedIntervals"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat(schedule): occupiedIntervals + mergeIntervals"
```

---

## Task 3: `freeIntervals`

The complement of occupied intervals within the workday.

**Files:**
- Modify: `services/scheduleEngine.ts` (add after `occupiedIntervals`)
- Test: `services/scheduleEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { freeIntervals } from './scheduleEngine';

describe('freeIntervals', () => {
  const cfg = { skipNonWorkingDays: true, weekendDays: [0, 6], holidays: [], workDayStartHour: 8, workDayEndHour: 17 };

  it('returns the whole workday when nothing is occupied', () => {
    expect(freeIntervals([], cfg)).toEqual([{ start: 8, end: 17 }]);
  });

  it('returns gaps around occupied blocks, clamped to the workday', () => {
    expect(freeIntervals([{ start: 8, end: 12 }], cfg)).toEqual([{ start: 12, end: 17 }]);
    expect(freeIntervals([{ start: 8, end: 10 }, { start: 13, end: 17 }], cfg)).toEqual([{ start: 10, end: 13 }]);
  });

  it('is empty when the workday is fully occupied', () => {
    expect(freeIntervals([{ start: 7, end: 18 }], cfg)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t "freeIntervals"`
Expected: FAIL — `freeIntervals is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add after `occupiedIntervals`:

```ts
/** Free clock-time intervals within the workday, given occupied intervals. */
export const freeIntervals = (occupied: ClockInterval[], config: WorkingTimeConfig): ClockInterval[] => {
  const dayStart = config.workDayStartHour;
  const dayEnd = config.workDayEndHour;
  const merged = mergeIntervals(occupied);
  const free: ClockInterval[] = [];
  let cursor = dayStart;
  for (const iv of merged) {
    const s = Math.max(iv.start, dayStart);
    const e = Math.min(iv.end, dayEnd);
    if (e <= dayStart || s >= dayEnd) continue;
    if (s > cursor) free.push({ start: cursor, end: s });
    cursor = Math.max(cursor, e);
  }
  if (cursor < dayEnd) free.push({ start: cursor, end: dayEnd });
  return free;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts -t "freeIntervals"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat(schedule): freeIntervals complement of occupied time"
```

---

## Task 4: `placeAfterConflictFree` (move a displaced job past the project)

Find the earliest working slot after `afterISO` where a job's whole span is free of its own shared-crew conflicts. Used to bump blockers.

**Files:**
- Modify: `services/scheduleEngine.ts` (add after `freeIntervals`)
- Test: `services/scheduleEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { placeAfterConflictFree } from './scheduleEngine';

describe('placeAfterConflictFree', () => {
  const cfg = { skipNonWorkingDays: true, weekendDays: [0, 6], holidays: [], workDayStartHour: 8, workDayEndHour: 17 };
  const mk = (over: Partial<Job>): Job => ({
    id: 'j', jobNumber: 'J', name: 'J', stage: 'Scheduled',
    startDate: '2026-06-09T08:00:00', endDate: '2026-06-09T17:00:00', crewMemberIds: ['m1'], ...over,
  } as Job);

  it('places the job on the first working day after the anchor, preserving duration', () => {
    const job = mk({ id: 'blk' });
    const change = placeAfterConflictFree(job, '2026-06-12T17:00:00', [job], { crewMemberIds: ['m1'] }, cfg, new Set());
    expect(change.jobId).toBe('blk');
    expect(toLocalDateKey(new Date(change.newStart))).toBe('2026-06-15'); // Mon after Fri Jun 12
    expect(new Date(change.newEnd).getTime() - new Date(change.newStart).getTime())
      .toBe(new Date('2026-06-09T17:00:00').getTime() - new Date('2026-06-09T08:00:00').getTime());
  });

  it('skips forward past a day already occupied by a shared-crew job', () => {
    const job = mk({ id: 'blk' });
    const occupant = mk({ id: 'occ', startDate: '2026-06-15T08:00:00', endDate: '2026-06-15T17:00:00' });
    const change = placeAfterConflictFree(job, '2026-06-12T17:00:00', [job, occupant], { crewMemberIds: ['m1'] }, cfg, new Set());
    expect(toLocalDateKey(new Date(change.newStart))).toBe('2026-06-16');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t "placeAfterConflictFree"`
Expected: FAIL — `placeAfterConflictFree is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add after `freeIntervals`:

```ts
/**
 * Place `job` at the earliest working day strictly after `afterISO` whose whole
 * span is free of its own shared-crew conflicts (per `scope`), preserving duration.
 * `displacedIds` are jobs being moved away and so ignored as occupiers. Falls back
 * to the day right after the anchor if no conflict-free slot is found within 120
 * working days.
 */
export const placeAfterConflictFree = (
  job: Job,
  afterISO: string,
  jobs: Job[],
  scope: CascadeScope,
  config: WorkingTimeConfig,
  displacedIds: Set<string>,
): ProposedChange => {
  const base = {
    jobId: job.id, jobName: job.name, jobNumber: job.jobNumber,
    oldStart: job.startDate ?? null, oldEnd: job.endDate ?? null,
  };
  const s = effectiveStart(job, config);
  const e = effectiveEnd(job, config);
  const durationMs = s && e ? e.getTime() - s.getTime() : MS_PER_DAY;
  const occupiers = jobs.filter((j) => j.id !== job.id && !displacedIds.has(j.id));

  let day = advanceWorkingDays(new Date(afterISO), 1, config);
  let fallback: { newStart: string; newEnd: string } | null = null;
  for (let guard = 0; guard < 120; guard++) {
    day.setHours(config.workDayStartHour, 0, 0, 0);
    const ns = new Date(day);
    const ne = new Date(ns.getTime() + durationMs);
    if (!fallback) fallback = { newStart: ns.toISOString(), newEnd: ne.toISOString() };
    const dayKeys = workingDayKeys(ns.toISOString(), ne.toISOString(), config.weekendDays);
    const clash = dayKeys.some((dk) => occupiedIntervals(occupiers, scope, dk, config, job.id).length > 0);
    if (!clash) return { ...base, newStart: ns.toISOString(), newEnd: ne.toISOString() };
    day = advanceWorkingDays(day, 1, config);
  }
  return { ...base, newStart: fallback!.newStart, newEnd: fallback!.newEnd };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts -t "placeAfterConflictFree"`
Expected: PASS (2 tests). (`toLocalDateKey` is already imported in the test file.)

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat(schedule): placeAfterConflictFree bumps a job past the project"
```

---

## Task 5: `reflowAvoidingConflicts` — Smart extension on existing days

First slice of the composer: pin user windows, then (Smart only) extend pinned days into adjacent free time. No new days yet.

**Files:**
- Modify: `services/scheduleEngine.ts` (add after `placeAfterConflictFree`)
- Test: `services/scheduleEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { reflowAvoidingConflicts } from './scheduleEngine';

describe('reflowAvoidingConflicts — Smart extension', () => {
  const cfg = { skipNonWorkingDays: true, weekendDays: [0, 6], holidays: [], workDayStartHour: 8, workDayEndHour: 17 };
  const mk = (over: Partial<Job>): Job => ({
    id: 'self', jobNumber: 'S', name: 'Self', stage: 'Scheduled', crewMemberIds: ['m1'],
    startDate: '2026-06-09T13:00:00', endDate: '2026-06-10T17:00:00',
    dailyHours: { '2026-06-09': { startTime: '13:00', endTime: '17:00' }, '2026-06-10': { startTime: '13:00', endTime: '17:00' } },
    ...over,
  } as Job);
  const scopeOf = () => ({ crewMemberIds: ['m1'] });

  it('extends a pinned day into adjacent free time before adding a new day', () => {
    // Total = 8h. User shrinks Jun 9 to 1h (16:00-17:00). Jun 10 free 12:00-13:00 (morning busy 8-12).
    const self = mk({});
    const morning = { id: 'am', jobNumber: 'A', name: 'AM', stage: 'Scheduled', crewMemberIds: ['m1'],
      startDate: '2026-06-10T08:00:00', endDate: '2026-06-10T08:00:00',
      dailyHours: { '2026-06-10': { startTime: '08:00', endTime: '12:00' } } } as Job;
    const pinned = { '2026-06-09': { startTime: '16:00', endTime: '17:00' }, '2026-06-10': { startTime: '13:00', endTime: '17:00' } };
    const { primary, displaced } = reflowAvoidingConflicts(self, pinned, [self, morning], scopeOf, cfg, {});
    // 8h total - (1h + 4h pinned) = 3h leftover; Jun 10 can extend 13:00 back to 12:00 (+1h, morning blocks earlier).
    expect(primary.dailyHours!['2026-06-10']).toEqual({ startTime: '12:00', endTime: '17:00' });
    expect(displaced).toEqual([]); // remaining 2h handled by later tasks (new days)
  });

  it('Simple mode does not extend existing days', () => {
    const self = mk({});
    const pinned = { '2026-06-09': { startTime: '16:00', endTime: '17:00' }, '2026-06-10': { startTime: '13:00', endTime: '17:00' } };
    const { primary } = reflowAvoidingConflicts(self, pinned, [self], scopeOf, cfg, { keepExistingDaysAsIs: true });
    expect(primary.dailyHours!['2026-06-10']).toEqual({ startTime: '13:00', endTime: '17:00' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t "reflowAvoidingConflicts — Smart extension"`
Expected: FAIL — `reflowAvoidingConflicts is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add after `placeAfterConflictFree`:

```ts
export interface ReflowConflictResult {
  /** The edited job's resolved change (new per-day windows). */
  primary: ProposedChange;
  /** Other shared-crew jobs moved out of the way, in apply order. */
  displaced: ProposedChange[];
}

export interface ReflowConflictOptions {
  /** Simple mode: never extend existing days; all leftover goes to new days. */
  keepExistingDaysAsIs?: boolean;
  /** Local 'YYYY-MM-DD' cutoff: blockers whose original start is after this are
   *  left in place (not bumped). Empty/undefined = no limit. */
  untilDate?: string;
}

/**
 * Re-place the edited job's hours conflict-free. Pins the user's day windows
 * (`pinnedDayHours`), keeps the job's total at `scheduledWindowHours`, and places
 * leftover hours into conflict-free clock time — Smart mode extends existing days
 * into adjacent free time first; later tasks add new-day placement + bumping.
 *
 * `scopeOf` returns a job's shared-crew scope (caller wires `sharedCrewScope`),
 * keeping this function free of the crew/group dependency.
 */
export const reflowAvoidingConflicts = (
  job: Job,
  pinnedDayHours: Record<string, { startTime: string; endTime: string }>,
  jobs: Job[],
  scopeOf: (job: Job) => CascadeScope,
  config: WorkingTimeConfig,
  opts: ReflowConflictOptions = {},
): ReflowConflictResult => {
  const base = {
    jobId: job.id, jobName: job.name, jobNumber: job.jobNumber,
    oldStart: job.startDate ?? null, oldEnd: job.endDate ?? null,
  };
  const scope = scopeOf(job);
  const required = scheduledWindowHours(job, config);

  const result: Record<string, { startTime: string; endTime: string }> = {};
  const pinnedKeys = Object.keys(pinnedDayHours).sort();
  let pinnedTotal = 0;
  for (const k of pinnedKeys) {
    result[k] = { ...pinnedDayHours[k] };
    pinnedTotal += Math.max(0, hhmmToHours(pinnedDayHours[k].endTime) - hhmmToHours(pinnedDayHours[k].startTime));
  }
  let remaining = Math.round((required - pinnedTotal) * 10) / 10;

  const displaced: ProposedChange[] = [];
  const displacedIds = new Set<string>();
  const occupiersExceptSelf = () => jobs.filter((j) => j.id !== job.id && !displacedIds.has(j.id));

  // Smart: extend each pinned day into the free time adjacent to its window.
  if (!opts.keepExistingDaysAsIs) {
    for (const k of pinnedKeys) {
      if (remaining <= 0) break;
      const free = freeIntervals(occupiedIntervals(occupiersExceptSelf(), scope, k, config, job.id), config);
      const win = { start: hhmmToHours(result[k].startTime), end: hhmmToHours(result[k].endTime) };
      const host = free.find((f) => f.start <= win.start + 1e-9 && f.end >= win.end - 1e-9);
      if (!host) continue;
      let { start, end } = win;
      const takeLater = Math.min(host.end - end, remaining);
      end += takeLater; remaining = Math.round((remaining - takeLater) * 10) / 10;
      const takeEarlier = Math.min(start - host.start, remaining);
      start -= takeEarlier; remaining = Math.round((remaining - takeEarlier) * 10) / 10;
      result[k] = { startTime: hoursToHHMM(start), endTime: hoursToHHMM(end) };
    }
  }

  const keys = Object.keys(result).sort();
  const primary: ProposedChange = {
    ...base,
    newStart: `${keys[0]}T${result[keys[0]].startTime}:00`,
    newEnd: `${keys[keys.length - 1]}T${result[keys[keys.length - 1]].endTime}:00`,
    dailyHours: result,
  };
  return { primary, displaced };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts -t "reflowAvoidingConflicts — Smart extension"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat(schedule): reflowAvoidingConflicts pins + Smart adjacent extension"
```

---

## Task 6: `reflowAvoidingConflicts` — new-day placement + bumping

Place any still-remaining hours on new working days after the span; bump fully-blocking shared-crew jobs past the project end (bounded by `untilDate`). This replaces the `primary`-build tail added in Task 5 with the same tail *after* a placement loop.

**Files:**
- Modify: `services/scheduleEngine.ts` (`reflowAvoidingConflicts`)
- Test: `services/scheduleEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('reflowAvoidingConflicts — new days + bump', () => {
  const cfg = { skipNonWorkingDays: true, weekendDays: [0, 6], holidays: [], workDayStartHour: 8, workDayEndHour: 17 };
  const scopeOf = () => ({ crewMemberIds: ['m1'] });
  const self = {
    id: 'self', jobNumber: 'S', name: 'Self', stage: 'Scheduled', crewMemberIds: ['m1'],
    startDate: '2026-06-09T13:00:00', endDate: '2026-06-12T17:00:00',
    dailyHours: {
      '2026-06-09': { startTime: '13:00', endTime: '17:00' }, '2026-06-10': { startTime: '13:00', endTime: '17:00' },
      '2026-06-11': { startTime: '13:00', endTime: '17:00' }, '2026-06-12': { startTime: '13:00', endTime: '17:00' },
    },
  } as Job;

  it('puts leftover hours on a new working day (Simple mode)', () => {
    // 16h total; Jun 9 shrunk to 1h (16-17). Pinned = 1+4+4+4 = 13h → 3h leftover → new day Jun 15.
    const pinned = {
      '2026-06-09': { startTime: '16:00', endTime: '17:00' }, '2026-06-10': { startTime: '13:00', endTime: '17:00' },
      '2026-06-11': { startTime: '13:00', endTime: '17:00' }, '2026-06-12': { startTime: '13:00', endTime: '17:00' },
    };
    const { primary, displaced } = reflowAvoidingConflicts(self, pinned, [self], scopeOf, cfg, { keepExistingDaysAsIs: true });
    expect(primary.dailyHours!['2026-06-15']).toEqual({ startTime: '08:00', endTime: '11:00' });
    expect(displaced).toEqual([]);
  });

  it('bumps a shared-crew job that fully blocks the new day, then places the hours', () => {
    const blocker = {
      id: 'blk', jobNumber: 'B', name: 'Blocker', stage: 'Scheduled', crewMemberIds: ['m1'],
      startDate: '2026-06-15T08:00:00', endDate: '2026-06-15T17:00:00',
      dailyHours: { '2026-06-15': { startTime: '08:00', endTime: '17:00' } },
    } as Job;
    const pinned = {
      '2026-06-09': { startTime: '16:00', endTime: '17:00' }, '2026-06-10': { startTime: '13:00', endTime: '17:00' },
      '2026-06-11': { startTime: '13:00', endTime: '17:00' }, '2026-06-12': { startTime: '13:00', endTime: '17:00' },
    };
    const { primary, displaced } = reflowAvoidingConflicts(self, pinned, [self, blocker], scopeOf, cfg, { keepExistingDaysAsIs: true });
    expect(primary.dailyHours!['2026-06-15']).toEqual({ startTime: '08:00', endTime: '11:00' });
    expect(displaced.map((d) => d.jobId)).toEqual(['blk']);
    expect(new Date(displaced[0].newStart).getTime()).toBeGreaterThan(new Date('2026-06-15T11:00:00').getTime());
  });

  it('does not bump a blocker whose original start is after the untilDate cutoff', () => {
    const blocker = {
      id: 'blk', jobNumber: 'B', name: 'Blocker', stage: 'Scheduled', crewMemberIds: ['m1'],
      startDate: '2026-06-15T08:00:00', endDate: '2026-06-15T17:00:00',
      dailyHours: { '2026-06-15': { startTime: '08:00', endTime: '17:00' } },
    } as Job;
    const pinned = {
      '2026-06-09': { startTime: '16:00', endTime: '17:00' }, '2026-06-10': { startTime: '13:00', endTime: '17:00' },
      '2026-06-11': { startTime: '13:00', endTime: '17:00' }, '2026-06-12': { startTime: '13:00', endTime: '17:00' },
    };
    const { displaced } = reflowAvoidingConflicts(self, pinned, [self, blocker], scopeOf, cfg, { keepExistingDaysAsIs: true, untilDate: '2026-06-14' });
    expect(displaced).toEqual([]); // blocker protected; leftover lands on the next free day instead
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t "reflowAvoidingConflicts — new days"`
Expected: FAIL — `primary.dailyHours['2026-06-15']` is undefined (no new-day placement yet).

- [ ] **Step 3: Write minimal implementation**

In `reflowAvoidingConflicts`, insert the placement loop **between** the Smart-extension block and the `const keys = Object.keys(result).sort();` line:

```ts
  // New working days after the span for any remaining hours; bump fully-blocking
  // shared-crew jobs past the project end (bounded by untilDate).
  const latestEndISO = () => {
    const all = [
      ...Object.keys(result).map((k) => `${k}T${result[k].endTime}:00`),
      ...displaced.map((d) => d.newEnd),
    ].sort();
    return all[all.length - 1];
  };
  const lastPinned = pinnedKeys[pinnedKeys.length - 1];
  let cursor = new Date(`${lastPinned}T00:00:00`);
  for (let guard = 0; remaining > 0 && guard < 60; guard++) {
    cursor = advanceWorkingDays(cursor, 1, config);
    const dayKey = toLocalDateKey(cursor);
    const need = Math.min(remaining, config.workDayEndHour - config.workDayStartHour);

    let free = freeIntervals(occupiedIntervals(occupiersExceptSelf(), scope, dayKey, config, job.id), config);
    let slot = free.find((f) => f.end - f.start >= need - 1e-9) ?? free.find((f) => f.end - f.start >= 1e-9);

    if (!slot) {
      const blockers = occupiersExceptSelf().filter(
        (j) => !j.is_locked && jobClockWindowOnDay(j, dayKey, config)
          && (!opts.untilDate || !j.startDate || toLocalDateKey(new Date(j.startDate)) <= opts.untilDate),
      );
      for (const b of blockers) {
        const mv = placeAfterConflictFree(b, latestEndISO(), jobs, scopeOf(b), config, displacedIds);
        displaced.push(mv);
        displacedIds.add(b.id);
      }
      if (blockers.length > 0) {
        free = freeIntervals(occupiedIntervals(occupiersExceptSelf(), scope, dayKey, config, job.id), config);
        slot = free.find((f) => f.end - f.start >= 1e-9);
      }
    }

    if (slot) {
      const place = Math.min(need, slot.end - slot.start);
      result[dayKey] = { startTime: hoursToHHMM(slot.start), endTime: hoursToHHMM(slot.start + place) };
      remaining = Math.round((remaining - place) * 10) / 10;
    }
    // else: day unusable (e.g. all blockers protected) → loop advances to the next day.
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts -t "reflowAvoidingConflicts"`
Expected: PASS (Smart-extension + new-days describe blocks all green).

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat(schedule): reflowAvoidingConflicts new-day placement + bump"
```

---

## Task 7: Worked-example regression test (the bug from the screenshots)

Lock in the exact reported scenario end-to-end at the engine level.

**Files:**
- Test: `services/scheduleEngine.test.ts`

- [ ] **Step 1: Write the failing test (expected to PASS once implementation from Tasks 5–6 is correct; this is a guard against regressions)**

```ts
describe('reflowAvoidingConflicts — reported scenario', () => {
  const cfg = { skipNonWorkingDays: true, weekendDays: [0, 6], holidays: [], workDayStartHour: 8, workDayEndHour: 17 };
  const scopeOf = () => ({ crewMemberIds: ['m1'] });

  it('Jun 9 → 4 PM keeps the other afternoons and adds a new day, no morning double-book', () => {
    const self = {
      id: 'self', jobNumber: 'S', name: 'Downtown', stage: 'Scheduled', crewMemberIds: ['m1'],
      startDate: '2026-06-09T13:00:00', endDate: '2026-06-12T17:00:00',
      dailyHours: {
        '2026-06-09': { startTime: '13:00', endTime: '17:00' }, '2026-06-10': { startTime: '13:00', endTime: '17:00' },
        '2026-06-11': { startTime: '13:00', endTime: '17:00' }, '2026-06-12': { startTime: '13:00', endTime: '17:00' },
      },
    } as Job;
    // Shared-crew morning jobs Tue–Fri 8–12 so mornings are NOT free.
    const mornings = ['2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12'].map((d, i) => ({
      id: `am${i}`, jobNumber: `A${i}`, name: 'AM', stage: 'Scheduled', crewMemberIds: ['m1'],
      startDate: `${d}T08:00:00`, endDate: `${d}T12:00:00`, dailyHours: { [d]: { startTime: '08:00', endTime: '12:00' } },
    } as Job));
    const pinned = {
      '2026-06-09': { startTime: '16:00', endTime: '17:00' }, '2026-06-10': { startTime: '13:00', endTime: '17:00' },
      '2026-06-11': { startTime: '13:00', endTime: '17:00' }, '2026-06-12': { startTime: '13:00', endTime: '17:00' },
    };
    const { primary } = reflowAvoidingConflicts(self, pinned, [self, ...mornings], scopeOf, cfg, {});
    // Afternoons unchanged; 3h leftover on Jun 12 afternoon is full, mornings blocked → new day Jun 15 8–11.
    expect(primary.dailyHours!['2026-06-10']).toEqual({ startTime: '13:00', endTime: '17:00' });
    expect(primary.dailyHours!['2026-06-11']).toEqual({ startTime: '13:00', endTime: '17:00' });
    expect(primary.dailyHours!['2026-06-12']).toEqual({ startTime: '13:00', endTime: '17:00' });
    expect(primary.dailyHours!['2026-06-15']).toEqual({ startTime: '08:00', endTime: '11:00' });
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run services/scheduleEngine.test.ts -t "reported scenario"`
Expected: PASS. If it FAILS, fix `reflowAvoidingConflicts` (do not edit the test) until the windows match.

- [ ] **Step 3: Commit**

```bash
git add services/scheduleEngine.test.ts
git commit -m "test(schedule): reported Jun 9 4 PM scenario regression"
```

---

## Task 8: Secondary toggle in `SingleJobEditor`

Add "Keep existing days as-is" below the cascade toggle, shown only when cascade is ON.

**Files:**
- Modify: `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`
- Test: `components/views/JobScheduling/ReschedulePreviewPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `components/views/JobScheduling/ReschedulePreviewPanel.test.tsx` (it already imports `render`, `screen`, `fireEvent` and has a `baseStaged` helper; mirror the existing "Cascade following jobs" test around line 157):

```ts
it('shows "Keep existing days as-is" only when cascade is on and fires its toggle', () => {
  const onToggleKeepDays = vi.fn();
  const { rerender } = render(
    <ReschedulePreviewPanel staged={baseStaged({ mode: 'edit' })} issues={[]} suggestions={[]} impact={impact}
      onApply={noop} onCancel={noop} onAutoFix={noop}
      cascade={false} onToggleCascade={noop} keepExistingDaysAsIs={false} onToggleKeepExistingDays={onToggleKeepDays} />);
  expect(screen.queryByText('Keep existing days as-is')).not.toBeInTheDocument();

  rerender(
    <ReschedulePreviewPanel staged={baseStaged({ mode: 'edit' })} issues={[]} suggestions={[]} impact={impact}
      onApply={noop} onCancel={noop} onAutoFix={noop}
      cascade={true} onToggleCascade={noop} keepExistingDaysAsIs={false} onToggleKeepExistingDays={onToggleKeepDays} />);
  fireEvent.click(screen.getByLabelText('Keep existing days as-is'));
  expect(onToggleKeepDays).toHaveBeenCalledWith(true);
});
```

Ensure `vi` is imported in that test file (`import { describe, it, expect, vi } from 'vitest'`); add `vi` to the existing import if missing.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/ReschedulePreviewPanel.test.tsx -t "Keep existing days"`
Expected: FAIL — text never appears / prop not forwarded.

- [ ] **Step 3: Implement — add props to `SingleJobEditor`**

In `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`, add to `SingleJobEditorProps` (after the cascade props, near line 40):

```tsx
  /** Smart vs Simple placement. Off = Smart (extend existing days), on = Simple. */
  keepExistingDaysAsIs?: boolean;
  onToggleKeepExistingDays?: (on: boolean) => void;
```

Add to the destructured params (line 80) before the closing `}`:

```tsx
  keepExistingDaysAsIs, onToggleKeepExistingDays,
```

Inside the `{cascade && (...)}` block, immediately after the `<DatePicker value={cascadeUntil} ... />` "Stop cascade after" group's closing `</div>` (after line 171), add:

```tsx
              {onToggleKeepExistingDays && (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
                    Keep existing days as-is
                    <Tooltip content="On: leftover hours only ever go onto new days, never changing the days the job already covers. Off (Smart): existing days can grow into adjacent free time first to keep the job compact.">
                      <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" aria-label="About keeping existing days as-is" />
                    </Tooltip>
                  </span>
                  <Toggle ariaLabel="Keep existing days as-is" checked={!!keepExistingDaysAsIs} onChange={onToggleKeepExistingDays} />
                </div>
              )}
```

- [ ] **Step 4: Implement — forward through `ReschedulePreviewPanel`**

In `components/views/JobScheduling/ReschedulePreviewPanel.tsx`:

Add to `ReschedulePreviewPanelProps` (after the cascade props near line 50):

```tsx
  keepExistingDaysAsIs?: boolean;
  onToggleKeepExistingDays?: (on: boolean) => void;
```

Add to the destructure (line 56), at the end before `}`:

```tsx
  keepExistingDaysAsIs, onToggleKeepExistingDays,
```

In the `<SingleJobEditor .../>` JSX (near line 178, beside `cascade={cascade}`), add:

```tsx
              keepExistingDaysAsIs={keepExistingDaysAsIs}
              onToggleKeepExistingDays={onToggleKeepExistingDays}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/ReschedulePreviewPanel.test.tsx -t "Keep existing days"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/views/JobScheduling/reschedule/SingleJobEditor.tsx components/views/JobScheduling/ReschedulePreviewPanel.tsx components/views/JobScheduling/ReschedulePreviewPanel.test.tsx
git commit -m "feat(reschedule): Keep existing days as-is toggle"
```

---

## Task 9: Wire `keepExistingDaysAsIs` state (persists across opens) in `JobSchedulingView`

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

- [ ] **Step 1: Add state**

After line 235 (`const [cascadeUntil, setCascadeUntil] = useState<string>('');`), add:

```tsx
  // Placement mode for conflict-aware reflow: false = Smart (extend existing days),
  // true = Simple (new days only). Persists across editor opens (unlike `cascade`).
  const [keepExistingDaysAsIs, setKeepExistingDaysAsIs] = useState(false);
```

Do **not** add any `setKeepExistingDaysAsIs(false)` to the editor open/close handlers — it must persist.

- [ ] **Step 2: Pass to `ReschedulePreviewPanel`**

In the `<ReschedulePreviewPanel .../>` element (near line 1402, beside `onChangeCascadeUntil={handleChangeCascadeUntil}`), add:

```tsx
            keepExistingDaysAsIs={keepExistingDaysAsIs}
            onToggleKeepExistingDays={setKeepExistingDaysAsIs}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat(reschedule): persist Keep existing days as-is state"
```

---

## Task 10: Route edits through `reflowAvoidingConflicts` when cascade is ON

Replace the dense `timeShiftChange` reflow with the conflict-aware composer for the cascade-ON path, and stage the displaced jobs. Cascade-OFF stays literal.

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`
- Test: `services/scheduleEngine.test.ts` (an integration-style assertion that the wiring helper builds the expected scope) — plus manual verification.

- [ ] **Step 1: Import the composer**

In the `scheduleEngine` import (line 13), add `reflowAvoidingConflicts`:

```tsx
import { ProposedChange, configFromSettings, moveJobToSlot, shiftJobsFromPoint, toLocalDateKey, spannedDayKeys, workingDayKeys, applyDailyHours, cascadeFromEdit, cascadeForPrimary, cascadeLeapfrogIds, resolveTimeShiftCascade, timeShiftChange, primaryFromDailyEdits, reflowAvoidingConflicts } from '../../services/scheduleEngine';
```

- [ ] **Step 2: Build the pinned-hours + composer helper**

Add near `primaryFromEdits` (after it, around line 468):

```tsx
  // Conflict-aware reflow for the edited job using the current daily-hours edits as
  // the pinned windows. Returns the primary change plus any displaced shared-crew
  // jobs. Only used when the master cascade toggle is ON.
  const reflowWithConflicts = (jobId: string, pinned: Record<string, DayHours>) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return null;
    return reflowAvoidingConflicts(
      job, pinned, jobs, (j) => scopeForJob(j.id), workConfig,
      { keepExistingDaysAsIs, untilDate: cascadeUntil || undefined },
    );
  };
```

Note: `scopeForJob` (line 428) takes a jobId and returns the shared-crew scope; the lambda adapts it to `(job) => CascadeScope`.

- [ ] **Step 3: Update `handleShiftStartTime`**

Replace the body of `handleShiftStartTime` (lines 722–750) with:

```tsx
  const handleShiftStartTime = (jobId: string, dayKey: string, startTime: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || job.is_locked) return;

    // Update the first day's pinned start in the daily-hours edits.
    const firstDayWindow = dailyHoursEdits[jobId]?.[dayKey] ?? { startTime, endTime: `${String(workConfig.workDayEndHour).padStart(2, '0')}:00` };
    const pinned: Record<string, DayHours> = {
      ...dailyHoursEdits[jobId],
      [dayKey]: { startTime, endTime: firstDayWindow.endTime },
    };
    setDailyHoursEdits(prev => ({ ...prev, [jobId]: pinned }));

    const s = preview.staged;
    const editorOpen = !!s && s.primaryJobId === jobId;

    if (!cascade) {
      // Literal: peek whether a conflict-aware reflow would move anything; if so,
      // default the master toggle ON and run it. Otherwise leave hours as typed.
      const peek = reflowAvoidingConflicts(job, pinned, jobs, (j) => scopeForJob(j.id), workConfig, { keepExistingDaysAsIs, untilDate: cascadeUntil || undefined });
      const moved = peek.displaced.length > 0 || JSON.stringify(peek.primary.dailyHours) !== JSON.stringify(pinned);
      if (!moved) {
        if (!editorOpen) {
          preview.stage({ changes: [{ jobId: job.id, jobName: job.name, jobNumber: job.jobNumber, oldStart: job.startDate ?? null, oldEnd: job.endDate || job.startDate || null, newStart: job.startDate ?? '', newEnd: job.endDate || job.startDate || '' }], label: `Reschedule ${job.name}`, mode: 'edit', primaryJobId: jobId, commit: (eff) => onApplySchedule(eff, `Reschedule ${job.name}`) });
        }
        return;
      }
      setCascade(true);
      setCascadeUntil('');
      preview.setChanges([peek.primary, ...peek.displaced]);
      if (!editorOpen) preview.stage({ changes: [peek.primary, ...peek.displaced], label: `Reschedule ${job.name}`, mode: 'edit', primaryJobId: jobId, commit: (eff) => onApplySchedule(eff, `Reschedule ${job.name}`) });
      return;
    }

    const out = reflowWithConflicts(jobId, pinned);
    if (!out) return;
    if (editorOpen) preview.setChanges([out.primary, ...out.displaced]);
    else preview.stage({ changes: [out.primary, ...out.displaced], label: `Reschedule ${job.name}`, mode: 'edit', primaryJobId: jobId, commit: (eff) => onApplySchedule(eff, `Reschedule ${job.name}`) });
  };
```

- [ ] **Step 4: Update the cascade toggle + cutoff handlers to use the composer**

In `handleToggleCascade` (line 470), replace the final `preview.setChanges(...)` line with:

```tsx
    if (!on) { preview.setChanges([primaryFromEdits(staged)]); return; }
    const out = reflowWithConflicts(staged.jobId, dailyHoursEdits[staged.jobId] ?? {});
    preview.setChanges(out ? [out.primary, ...out.displaced] : [primaryFromEdits(staged)]);
```

In `handleChangeCascadeUntil` (line 482), replace its final `preview.setChanges(...)` line with the same composer call (it already early-returns when `!cascade`):

```tsx
    const out = reflowWithConflicts(staged.jobId, dailyHoursEdits[staged.jobId] ?? {});
    preview.setChanges(out ? [out.primary, ...out.displaced] : [primaryFromEdits(staged)]);
```

- [ ] **Step 5: Update `handleChangeDailyHour` to re-run the composer when cascade is ON**

Replace `handleChangeDailyHour` (lines 492–497) with:

```tsx
  const handleChangeDailyHour = (jobId: string, dateKey: string, field: 'startTime' | 'endTime', value: string) => {
    const pinned: Record<string, DayHours> = {
      ...dailyHoursEdits[jobId],
      [dateKey]: { ...dailyHoursEdits[jobId]?.[dateKey], [field]: value } as DayHours,
    };
    setDailyHoursEdits(prev => ({ ...prev, [jobId]: pinned }));
    if (!cascade) return; // literal: hours apply as typed on Apply
    const out = reflowWithConflicts(jobId, pinned);
    const s = preview.staged;
    if (out && s && s.primaryJobId === jobId) preview.setChanges([out.primary, ...out.displaced]);
  };
```

- [ ] **Step 6: Verify compile + full engine suite**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx vitest run services/scheduleEngine.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat(reschedule): route hours edits through conflict-aware reflow"
```

---

## Task 11: Full suite + typecheck + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all test files PASS (no regressions in the 331 baseline + new tests).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification (use the `verify` skill or run the app)**

Reproduce the reported flow:
1. Open Job Scheduling, edit **Downtown Commercial (#wo-4)**.
2. Turn **"Cascade following jobs"** ON.
3. Change **Jun 9** to start at **4 PM**.
4. Expect: Jun 10–12 stay **1–5 PM**, a **new day (Jun 15)** appears with the leftover ~3h at the earliest free slot, **no morning double-book** on Jun 10–12.
5. Toggle **"Keep existing days as-is"** and confirm Smart vs Simple differ only when an existing day has adjacent free time.
6. With cascade **OFF**, changing Jun 9 to 4 PM applies literally (no other day changes, leftover surfaces as the existing under-hours warning).
7. Close and reopen the editor — confirm **"Keep existing days as-is"** kept its last value.

- [ ] **Step 4: Commit any verification-driven fixes**

If verification reveals a bug, return to `superpowers:systematic-debugging`, add a failing engine test, fix, and commit:

```bash
git add -A
git commit -m "fix(reschedule): <specific fix from verification>"
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** clock-time primitive (Tasks 1–3), Smart extend (Task 5), new days + bump + cutoff (Task 6), reported scenario (Task 7), toggle + persistence (Tasks 8–9), master-gated routing with literal-when-off (Task 10).
- **Type consistency:** `ClockInterval`, `ReflowConflictResult`, `ReflowConflictOptions`, `reflowAvoidingConflicts(job, pinnedDayHours, jobs, scopeOf, config, opts)` are used identically across tasks. `DayHours` is the existing type alias in `JobSchedulingView.tsx`.
- **One block per day** is never violated: Smart only grows a day's single window; new days create one window each.
- **Guards:** placement loop (60) and `placeAfterConflictFree` (120) prevent infinite loops; the `untilDate` cutoff stops the bump chain.
