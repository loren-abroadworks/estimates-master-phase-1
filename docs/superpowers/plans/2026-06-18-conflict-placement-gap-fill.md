# Smarter Conflict Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Move conflicting job" place jobs into the nearest free same-day slot (gap-fill), push blockers to make room only when a day is packed, touch only the conflicting day of a multi-day project, and fall back to nearest-day (single-day) or an unresolved warning (multi-day) instead of spilling whole projects to far-future dates.

**Architecture:** Rewrite the placement logic in `services/resolveSameDayConflicts.ts` around two new pure helpers (`findSameDaySlot`, `findNearestDay`) built from existing engine primitives (`occupiedIntervals`, `freeIntervals`, `advanceWorkingDays`). The cascade loop stays, but each job tries gap-fill before a push placement, so only push placements (which intentionally overlap) seed a new cascade anchor. Two UI consumers swap their "movable" predicate for a shared `isMovableResolution` helper.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react, project i18n.

## Global Constraints

- Test runner: `npm test` (`vitest run`); type-check: `npm run lint` (`tsc --noEmit`).
- Times are local `'HH:MM'` 24h strings; date keys are local `'YYYY-MM-DD'` (`toLocalDateKey`). Clock display via `fmtClock`; date display via `formatDisplayDate`.
- Reuse engine primitives; do not duplicate interval math. Shared-crew = `jobsShareCrew`; crew scope = `sharedCrewScope`; per-day window = `jobClockWindowOnDay`; free time = `occupiedIntervals` + `freeIntervals`; working-day stepping = `advanceWorkingDays`.
- The resolver must stay **total**: never throw; return `[]` when there are no conflicts.
- Same-day placement (gap-fill or push) touches only `dailyHours[clashDay]`, recomputing `newStart`/`newEnd` only when the clash day is the job's first/last spanned day. Never split a multi-day project across non-contiguous dates.
- Placement rule: among free intervals on the day that fit the job's duration, pick the **earliest** one and place the job at its **start**.

---

### Task 1: Rewrite resolver placement (gap-fill + push fallback + nearest-day/unresolved)

**Files:**
- Modify: `services/resolveSameDayConflicts.ts` (replace `slideOrSpill`, add helpers, update kinds + main loop + merge filter)
- Test: `services/resolveSameDayConflicts.test.ts`

**Interfaces:**
- Consumes (all exported): `occupiedIntervals`, `freeIntervals`, `advanceWorkingDays`, `toLocalDateKey`, `CascadeScope`, `ClockInterval`, `jobClockWindowOnDay`, `spannedDayKeys`, `occupiesWorkingDay`, `formatDisplayDate`, `hoursToHHMM`, `applyDailyHours` from `services/scheduleEngine`; `sharedCrewScope`, `jobsShareCrew` from `services/rescheduleIssues`; `withStagedWindow`, `fmtClock` from `services/productionBoard`.
- Produces (relied on by Task 2):
  - `ConflictResolution.kind: 'slide-same-day' | 'move-to-day' | 'unresolved' | 'locked-blocked'` (`spill-next-day` removed).
  - `isMovableResolution(r: ConflictResolution): boolean` — true for `slide-same-day` / `move-to-day`.
  - `findSameDaySlot(durHours: number, dayKey: string, scope: CascadeScope, excludeJobId: string, world: Job[], config: WorkingTimeConfig): { startTime: string; endTime: string } | null`
  - `findNearestDay(job: Job, durHours: number, world: Job[], config: WorkingTimeConfig): { dayKey: string; slot: { startTime: string; endTime: string } } | null`
  - `resolveSameDayConflicts` and `mergeResolutionsIntoChanges` keep their existing signatures.

- [ ] **Step 1: Rewrite the resolver test file**

Replace the entire contents of `services/resolveSameDayConflicts.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import {
  resolveSameDayConflicts, mergeResolutionsIntoChanges, findSameDaySlot,
  isMovableResolution, ConflictResolution,
} from './resolveSameDayConflicts';
import { configFromSettings, ProposedChange } from './scheduleEngine';
import { sharedCrewScope } from './rescheduleIssues';
import type { Job } from '../types';

const cfg = configFromSettings(undefined, false); // 08:00–17:00, weekends [0,6]

const makeJob = (
  id: string, start: string, end: string, days: Record<string, [string, string]>, over: Partial<Job> = {},
): Job => ({
  id, jobNumber: id, name: id, stage: 'Scheduled',
  startDate: start, endDate: end,
  dailyHours: Object.fromEntries(Object.entries(days).map(([k, [s, e]]) => [k, { startTime: s, endTime: e }])),
  crewMemberIds: ['m1'], dateCreated: '', clientId: '', estimateId: '', address: '',
  ...over,
} as Job);

// Single-day job on `day` with one clock window.
const dayJob = (id: string, day: string, s: string, e: string, over: Partial<Job> = {}): Job =>
  makeJob(id, `${day}T${s}:00`, `${day}T${e}:00`, { [day]: [s, e] }, over);

const primaryChange = (j: Job): ProposedChange => ({
  jobId: j.id, jobName: j.name, jobNumber: j.jobNumber,
  oldStart: j.startDate!, oldEnd: j.endDate!,
  newStart: j.startDate!, newEnd: j.endDate!, dailyHours: j.dailyHours,
});

const D = '2026-06-01'; // Monday

describe('resolveSameDayConflicts', () => {
  it('gap-fills into the earliest free slot (the freed morning), not after the anchor', () => {
    const a = dayJob('A', D, '13:00', '17:00'); // primary, afternoon
    const b = dayJob('B', D, '13:00', '17:00'); // 4h, overlaps A
    const res = resolveSameDayConflicts(primaryChange(a), [a, b], cfg);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe('slide-same-day');
    expect(res[0].change.dailyHours![D]).toEqual({ startTime: '08:00', endTime: '12:00' });
  });

  it('gap-fills the earliest free slot when the morning is occupied', () => {
    const a = dayJob('A', D, '08:00', '12:00'); // primary, morning
    const b = dayJob('B', D, '10:00', '13:00'); // 3h, overlaps A
    const res = resolveSameDayConflicts(primaryChange(a), [a, b], cfg);
    expect(res[0].kind).toBe('slide-same-day');
    expect(res[0].change.dailyHours![D]).toEqual({ startTime: '12:00', endTime: '15:00' });
  });

  it('multi-day: gap-fills only the conflicting day, preserving the project span', () => {
    const a = dayJob('A', '2026-06-02', '13:00', '17:00'); // primary, single day, Tue
    // Downtown spans Mon–Wed, 13:00–17:00 each working day; clash on Tue Jun 2.
    const b = makeJob('B', '2026-06-01T13:00:00', '2026-06-03T17:00:00', {
      '2026-06-01': ['13:00', '17:00'], '2026-06-02': ['13:00', '17:00'], '2026-06-03': ['13:00', '17:00'],
    });
    const res = resolveSameDayConflicts(primaryChange(a), [a, b], cfg);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe('slide-same-day');
    expect(res[0].change.dailyHours!['2026-06-02']).toEqual({ startTime: '08:00', endTime: '12:00' });
    expect(res[0].change.newStart).toBe('2026-06-01T13:00:00'); // first day untouched
    expect(res[0].change.newEnd).toBe('2026-06-03T17:00:00');   // last day untouched
  });

  it('pushes a blocker to make room when no gap fits, cascading to the bumped job', () => {
    const a = dayJob('A', D, '08:00', '12:00');  // primary
    const b = dayJob('B', D, '10:00', '13:00');  // 3h
    const c = dayJob('C', D, '14:00', '15:00');  // 1h, sits in B's would-be slot
    const res = resolveSameDayConflicts(primaryChange(a), [a, b, c], cfg);
    const byId = Object.fromEntries(res.map(r => [r.jobId, r]));
    expect(res).toHaveLength(2);
    expect(byId.B.change.dailyHours![D]).toEqual({ startTime: '12:00', endTime: '15:00' });
    expect(byId.C.kind).toBe('slide-same-day');
    expect(byId.C.change.dailyHours![D]).toEqual({ startTime: '15:00', endTime: '16:00' });
  });

  it('single-day with no same-day fit moves to the nearest working day', () => {
    const day = '2026-06-03'; // Wednesday
    const a = dayJob('A', day, '08:00', '15:00'); // primary fills most of the day
    const b = dayJob('B', day, '14:00', '17:00'); // 3h won't fit after 15:00
    const res = resolveSameDayConflicts(primaryChange(a), [a, b], cfg);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe('move-to-day');
    expect(res[0].change.newStart).toBe('2026-06-02T08:00:00'); // nearest day, tie -> earlier (Tue)
    expect(res[0].change.dailyHours!['2026-06-02']).toEqual({ startTime: '08:00', endTime: '11:00' });
  });

  it('multi-day with no same-day fit is reported as unresolved (project untouched)', () => {
    const a = dayJob('A', '2026-06-02', '08:00', '17:00'); // primary fills the whole day
    const b = makeJob('B', '2026-06-01T13:00:00', '2026-06-03T17:00:00', {
      '2026-06-01': ['13:00', '17:00'], '2026-06-02': ['13:00', '17:00'], '2026-06-03': ['13:00', '17:00'],
    });
    const res = resolveSameDayConflicts(primaryChange(a), [a, b], cfg);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe('unresolved');
  });

  it('ignores overlaps when no crew member is shared', () => {
    const a = dayJob('A', D, '08:00', '12:00', { crewMemberIds: ['m1'] });
    const b = dayJob('B', D, '10:00', '13:00', { crewMemberIds: ['m2'] });
    expect(resolveSameDayConflicts(primaryChange(a), [a, b], cfg)).toEqual([]);
  });

  it('ignores shared-crew jobs that do not overlap in time', () => {
    const a = dayJob('A', D, '08:00', '10:00');
    const b = dayJob('B', D, '13:00', '15:00');
    expect(resolveSameDayConflicts(primaryChange(a), [a, b], cfg)).toEqual([]);
  });

  it('reports a locked conflicting job as unresolvable instead of moving it', () => {
    const a = dayJob('A', D, '08:00', '12:00');
    const b = dayJob('B', D, '10:00', '13:00', { is_locked: true });
    const res = resolveSameDayConflicts(primaryChange(a), [a, b], cfg);
    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe('locked-blocked');
    expect(res[0].change.newStart).toBe(b.startDate);
  });
});

describe('findSameDaySlot', () => {
  const scope = sharedCrewScope({ id: 'x', crewMemberIds: ['m1'] } as Job);

  it('returns the earliest free interval that fits, placed at its start', () => {
    const a = dayJob('A', D, '13:00', '17:00');
    const slot = findSameDaySlot(4, D, scope, 'B', [a], cfg);
    expect(slot).toEqual({ startTime: '08:00', endTime: '12:00' });
  });

  it('returns null when nothing fits', () => {
    const a = dayJob('A', D, '08:00', '17:00');
    expect(findSameDaySlot(4, D, scope, 'B', [a], cfg)).toBeNull();
  });
});

describe('isMovableResolution', () => {
  const mk = (kind: ConflictResolution['kind']): ConflictResolution =>
    ({ jobId: 'x', jobName: 'X', jobNumber: 'x', kind, change: {} as ProposedChange, label: '' });
  it('is true only for slide-same-day and move-to-day', () => {
    expect(isMovableResolution(mk('slide-same-day'))).toBe(true);
    expect(isMovableResolution(mk('move-to-day'))).toBe(true);
    expect(isMovableResolution(mk('unresolved'))).toBe(false);
    expect(isMovableResolution(mk('locked-blocked'))).toBe(false);
  });
});

describe('mergeResolutionsIntoChanges', () => {
  const primary: ProposedChange = {
    jobId: 'd', jobName: 'Downtown', jobNumber: 'wo-4',
    oldStart: '2026-06-16T13:00:00', oldEnd: '2026-06-19T17:00:00',
    newStart: '2026-06-16T13:00:00', newEnd: '2026-06-19T17:00:00',
  };
  const edits = {
    d: {
      '2026-06-16': { startTime: '13:00', endTime: '17:00' },
      '2026-06-18': { startTime: '08:00', endTime: '12:00' },
      '2026-06-19': { startTime: '13:00', endTime: '17:00' },
    },
  };
  const slide: ConflictResolution = {
    jobId: 'ak', jobName: 'Anderson', jobNumber: 'wo-5', kind: 'slide-same-day',
    change: {
      jobId: 'ak', jobName: 'Anderson', jobNumber: 'wo-5',
      oldStart: '2026-06-18T08:00:00', oldEnd: '2026-06-18T12:00:00',
      newStart: '2026-06-18T12:00:00', newEnd: '2026-06-18T16:00:00',
      dailyHours: { '2026-06-18': { startTime: '12:00', endTime: '16:00' } },
    },
    label: 'Move Anderson to 12:00 PM–4:00 PM',
  };

  it('bakes in-flight per-day edits into the primary change so a re-seed preserves them', () => {
    const merged = mergeResolutionsIntoChanges([primary], [slide], edits);
    const d = merged.find(c => c.jobId === 'd')!;
    expect(d.dailyHours!['2026-06-18']).toEqual({ startTime: '08:00', endTime: '12:00' });
    expect(merged.find(c => c.jobId === 'ak')).toBeTruthy();
  });

  it('adds the moved conflicting job and keeps the existing primary', () => {
    const merged = mergeResolutionsIntoChanges([primary], [slide], edits);
    expect(merged.map(c => c.jobId).sort()).toEqual(['ak', 'd']);
    expect(merged.find(c => c.jobId === 'ak')!.newStart).toBe('2026-06-18T12:00:00');
  });

  it('does not stage unresolved or locked-blocked resolutions', () => {
    const unresolved: ConflictResolution = { ...slide, kind: 'unresolved' };
    const locked: ConflictResolution = { ...slide, kind: 'locked-blocked' };
    expect(mergeResolutionsIntoChanges([primary], [unresolved], edits).map(c => c.jobId)).toEqual(['d']);
    expect(mergeResolutionsIntoChanges([primary], [locked], edits).map(c => c.jobId)).toEqual(['d']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- resolveSameDayConflicts`
Expected: FAIL — `findSameDaySlot` / `isMovableResolution` not exported, and the gap-fill/move-to-day/unresolved expectations don't match the current `slide-after-anchor`/`spill-next-day` logic.

- [ ] **Step 3: Rewrite `services/resolveSameDayConflicts.ts`**

Replace the file's top imports, kinds, helpers, `slideOrSpill`, and the main loop. Replace the whole file with:

```ts
import type { Job } from '../types';
import {
  ProposedChange, WorkingTimeConfig, CascadeScope, ClockInterval,
  jobClockWindowOnDay, spannedDayKeys, occupiesWorkingDay,
  occupiedIntervals, freeIntervals, advanceWorkingDays, toLocalDateKey,
  formatDisplayDate, hoursToHHMM, applyDailyHours,
} from './scheduleEngine';
import { sharedCrewScope, jobsShareCrew } from './rescheduleIssues';
import { withStagedWindow, fmtClock } from './productionBoard';

const EPS = 1e-9;

export interface ConflictResolution {
  jobId: string;
  jobName: string;
  jobNumber: string;
  kind: 'slide-same-day' | 'move-to-day' | 'unresolved' | 'locked-blocked';
  change: ProposedChange;
  label: string;
}

/** Resolutions that represent an actual move to stage (vs. informational notes). */
export const isMovableResolution = (r: ConflictResolution): boolean =>
  r.kind === 'slide-same-day' || r.kind === 'move-to-day';

const clockOverlaps = (a: ClockInterval | null, b: ClockInterval | null): boolean =>
  !!a && !!b && a.start < b.end - EPS && b.start < a.end - EPS;

const baseOf = (job: Job) => ({
  jobId: job.id, jobName: job.name, jobNumber: job.jobNumber,
  oldStart: job.startDate ?? null, oldEnd: job.endDate ?? null,
});

type Slot = { startTime: string; endTime: string };

/**
 * Earliest free clock-time slot of length `durHours` on `dayKey`, honoring the
 * shared-crew occupancy in `scope` (excluding `excludeJobId`). The job is placed
 * at the start of the earliest interval that fits; null when nothing fits.
 */
export const findSameDaySlot = (
  durHours: number, dayKey: string, scope: CascadeScope, excludeJobId: string,
  world: Job[], config: WorkingTimeConfig,
): Slot | null => {
  const occupied = occupiedIntervals(world, scope, dayKey, config, excludeJobId);
  const free = freeIntervals(occupied, config).filter(iv => iv.end - iv.start >= durHours - EPS);
  if (free.length === 0) return null;
  const startH = free[0].start;
  return { startTime: hoursToHHMM(startH), endTime: hoursToHHMM(startH + durHours) };
};

/**
 * Nearest working day (searching outward from the job's original day, both
 * directions, tie -> earlier) that has a free slot for a `durHours` window.
 */
export const findNearestDay = (
  job: Job, durHours: number, world: Job[], config: WorkingTimeConfig,
): { dayKey: string; slot: Slot } | null => {
  const scope = sharedCrewScope(job);
  const origin = new Date(job.startDate!);
  for (let d = 1; d <= 60; d++) {
    for (const dir of [-1, 1]) {
      const cand = advanceWorkingDays(origin, d * dir, config);
      const dayKey = toLocalDateKey(cand);
      const slot = findSameDaySlot(durHours, dayKey, scope, job.id, world, config);
      if (slot) return { dayKey, slot };
    }
  }
  return null;
};

const slideLabel = (job: Job, slot: Slot) =>
  `Move ${job.name} to ${fmtClock(slot.startTime)}–${fmtClock(slot.endTime)}`;

/**
 * Resolve one conflicting `job` displaced by `anchor` on `dayKey`:
 *   1. gap-fill into a free same-day slot (no cascade);
 *   2. else push right after the anchor's end if it fits the workday (cascades);
 *   3. else single-day -> nearest day; multi-day -> unresolved.
 * Same-day placement edits only `dailyHours[dayKey]`, recomputing newStart/newEnd
 * only when `dayKey` is the job's first/last spanned day. Returns the resolution
 * and whether it should seed a new cascade anchor.
 */
const resolveConflict = (
  job: Job, anchor: Job, dayKey: string, world: Job[], config: WorkingTimeConfig,
): { res: ConflictResolution; cascade: boolean } => {
  const base = baseOf(job);
  const win = jobClockWindowOnDay(job, dayKey, config)!;
  const anchorWin = jobClockWindowOnDay(anchor, dayKey, config)!;
  const durHours = win.end - win.start;
  const scope = sharedCrewScope(job);
  const spanned = spannedDayKeys(job.startDate!, job.endDate ?? job.startDate!);
  const isMultiDay = spanned.length > 1;

  const sameDayChange = (slot: Slot): ProposedChange => ({
    ...base,
    newStart: dayKey === spanned[0] ? `${dayKey}T${slot.startTime}:00` : job.startDate!,
    newEnd: dayKey === spanned[spanned.length - 1] ? `${dayKey}T${slot.endTime}:00` : (job.endDate ?? job.startDate!),
    dailyHours: { ...job.dailyHours, [dayKey]: slot },
  });

  // 1. Gap-fill same day.
  const gap = findSameDaySlot(durHours, dayKey, scope, job.id, world, config);
  if (gap) {
    return { res: { ...base, kind: 'slide-same-day', change: sameDayChange(gap), label: slideLabel(job, gap) }, cascade: false };
  }

  // 2. Push-to-make-room: place right after the anchor's end if it fits the workday.
  const pushStart = anchorWin.end;
  if (pushStart + durHours <= config.workDayEndHour + EPS) {
    const slot: Slot = { startTime: hoursToHHMM(pushStart), endTime: hoursToHHMM(pushStart + durHours) };
    return { res: { ...base, kind: 'slide-same-day', change: sameDayChange(slot), label: slideLabel(job, slot) }, cascade: true };
  }

  // 3a. Single-day: relocate the whole job to the nearest fitting working day.
  if (!isMultiDay) {
    const near = findNearestDay(job, durHours, world, config);
    if (near) {
      return {
        res: {
          ...base, kind: 'move-to-day',
          change: {
            ...base, newStart: `${near.dayKey}T${near.slot.startTime}:00`, newEnd: `${near.dayKey}T${near.slot.endTime}:00`,
            dailyHours: { [near.dayKey]: near.slot },
          },
          label: `Move ${job.name} to ${formatDisplayDate(near.dayKey)}, ${fmtClock(near.slot.startTime)}–${fmtClock(near.slot.endTime)}`,
        },
        cascade: false,
      };
    }
  }

  // 3b. Multi-day (or single-day with no day found): leave it for manual handling.
  return {
    res: {
      ...base, kind: 'unresolved',
      change: { ...base, newStart: job.startDate!, newEnd: job.endDate ?? job.startDate! },
      label: `${job.name} can't fit on ${formatDisplayDate(dayKey)} — reschedule manually`,
    },
    cascade: false,
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

  // Each anchor's window may displace shared-crew jobs. Gap-fill placements are
  // conflict-free (no new anchor); push placements intentionally overlap, so the
  // bumped job is enqueued as the next anchor. `visited` + the bound prevent cycles.
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

        const { res, cascade } = resolveConflict(other, anchor, clashDay, work, config);
        resolutions.push(res);
        if (isMovableResolution(res)) {
          const idx = work.findIndex(j => j.id === other.id);
          work[idx] = withStagedWindow(other, res.change);
          if (cascade) next.push(work[idx]);
        }
      }
    }
    anchors = next;
  }
  return resolutions;
};

/**
 * Merge conflict resolutions into the staged `changes` array for the "Move
 * conflicting job" action. Each existing change first has the user's in-flight
 * per-day edits (`dailyHoursEdits`) baked into its `dailyHours` (and its
 * start/end clock via `applyDailyHours`). This matters because committing the
 * resolutions re-seeds the editor's per-day hours from the staged changes — so
 * an edit that lived only in `dailyHoursEdits` (e.g. a mid-span window change
 * with cascade off) would otherwise be discarded on the round-trip. Only movable
 * resolutions (`slide-same-day` / `move-to-day`) overlay by jobId; `unresolved`
 * and `locked-blocked` are informational and never staged.
 */
export const mergeResolutionsIntoChanges = (
  changes: ProposedChange[],
  resolutions: ConflictResolution[],
  dailyHoursEdits: Record<string, Record<string, { startTime: string; endTime: string }>>,
): ProposedChange[] => {
  const withEdits = (c: ProposedChange): ProposedChange => {
    const edits = dailyHoursEdits[c.jobId];
    if (!edits) return c;
    return { ...applyDailyHours(c, edits), dailyHours: { ...c.dailyHours, ...edits } };
  };
  const byId = new Map(changes.map(c => [c.jobId, withEdits(c)]));
  for (const r of resolutions) {
    if (!isMovableResolution(r)) continue;
    byId.set(r.jobId, r.change);
  }
  return [...byId.values()];
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- resolveSameDayConflicts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Type-check**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add services/resolveSameDayConflicts.ts services/resolveSameDayConflicts.test.ts
git commit -m "feat(scheduling): gap-fill conflict placement with push-to-make-room cascade"
```

---

### Task 2: Update UI consumers to the new movable predicate + unresolved note

**Files:**
- Modify: `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`
- Modify: `components/views/JobSchedulingView.tsx`
- Test: `components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx`

**Interfaces:**
- Consumes: `isMovableResolution`, `ConflictResolution` from `services/resolveSameDayConflicts` (Task 1).
- Produces: the card's Move button shows only when at least one resolution is movable; `unresolved` and `locked-blocked` render as notes.

- [ ] **Step 1: Write the failing test**

Append to the `describe('SingleJobEditor', ...)` block in `SingleJobEditor.test.tsx`:

```ts
  it('renders an unresolved conflict as a note with no Move button', () => {
    render(
      <SingleJobEditor
        {...base}
        conflictResolutions={[
          { jobId: 'b', jobName: 'Fence Job', jobNumber: '0002', kind: 'unresolved',
            change: { ...change, jobId: 'b' }, label: "Fence Job can't fit on Jun 17 — reschedule manually" },
        ]}
        onMoveConflicts={vi.fn()}
      />,
    );
    expect(screen.getByText("Fence Job can't fit on Jun 17 — reschedule manually")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /move conflicting job/i })).not.toBeInTheDocument();
  });

  it('shows the Move button for a move-to-day resolution', () => {
    const onMoveConflicts = vi.fn();
    render(
      <SingleJobEditor
        {...base}
        conflictResolutions={[
          { jobId: 'b', jobName: 'Fence Job', jobNumber: '0002', kind: 'move-to-day',
            change: { ...change, jobId: 'b' }, label: 'Move Fence Job to Tue, Jun 16, 8:00 AM–11:00 AM' },
        ]}
        onMoveConflicts={onMoveConflicts}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /move conflicting job/i }));
    expect(onMoveConflicts).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- SingleJobEditor`
Expected: FAIL — the current predicate `r.kind !== 'locked-blocked'` shows the Move button for `unresolved` (first new test fails).

- [ ] **Step 3: Update `SingleJobEditor.tsx`**

Add `isMovableResolution` to the existing import from the resolver (currently `import { ConflictResolution } from '../../../../services/resolveSameDayConflicts';`):

```ts
import { ConflictResolution, isMovableResolution } from '../../../../services/resolveSameDayConflicts';
```

Change the Move-button guard (currently `{onMoveConflicts && conflictResolutions.some(r => r.kind !== 'locked-blocked') && (`) to:

```tsx
          {onMoveConflicts && conflictResolutions.some(isMovableResolution) && (
```

- [ ] **Step 4: Update `JobSchedulingView.tsx`**

Add `isMovableResolution` to the existing resolver import (currently `import { resolveSameDayConflicts, mergeResolutionsIntoChanges, ConflictResolution } from '../../services/resolveSameDayConflicts';`):

```ts
import { resolveSameDayConflicts, mergeResolutionsIntoChanges, isMovableResolution, ConflictResolution } from '../../services/resolveSameDayConflicts';
```

In `handleMoveConflicts`, change the guard (currently `if (!conflictResolutions.some(r => r.kind !== 'locked-blocked')) return;`) to:

```ts
    if (!conflictResolutions.some(isMovableResolution)) return;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- SingleJobEditor`
Expected: PASS (existing + 2 new).

- [ ] **Step 6: Full suite + type-check**

Run: `npm test`
Expected: all suites pass.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/views/JobScheduling/reschedule/SingleJobEditor.tsx components/views/JobSchedulingView.tsx components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx
git commit -m "feat(scheduling): gate Move-conflicting button on movable resolutions; show unresolved note"
```

---

## Self-Review

**Spec coverage:**
- Gap-fill earliest free slot (8 AM–12 PM) → Task 1 `findSameDaySlot` + test "gap-fills into the earliest free slot" → ✅
- Multi-day touches only the clash day, span preserved → Task 1 `sameDayChange` + test "multi-day: gap-fills only the conflicting day" → ✅
- Push-to-make-room cascade fallback → Task 1 step 2 of `resolveConflict` + test "pushes a blocker to make room" → ✅
- Single-day no-fit → nearest day (both directions, tie earlier) → Task 1 `findNearestDay` + test "single-day with no same-day fit" → ✅
- Multi-day no-fit → unresolved, project untouched → Task 1 + test "multi-day with no same-day fit is reported as unresolved" → ✅
- Kinds updated, `spill-next-day` removed, `isMovableResolution` → Task 1 + `isMovableResolution` test → ✅
- UI predicate change + unresolved note, no new props/i18n → Task 2 + tests → ✅
- Locked blocker unchanged → Task 1 retains locked branch + existing locked test → ✅
- Resolver stays total → returns `[]` early; every path returns a resolution → ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output.

**Type consistency:** `ConflictResolution.kind` union, `findSameDaySlot`/`findNearestDay` signatures, `isMovableResolution`, and `Slot` shape are identical across Task 1 definitions and Task 2 usage. `resolveSameDayConflicts` and `mergeResolutionsIntoChanges` keep their Task-from-prior-work signatures, so `JobSchedulingView` call sites need no change beyond the import + guard.
