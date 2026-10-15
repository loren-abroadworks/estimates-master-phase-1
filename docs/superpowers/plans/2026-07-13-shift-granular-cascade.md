# Shift-Granular Cascade (Crew-Timeline Conflict Resolver) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve scheduling conflicts at *shift* granularity across each crew member's whole timeline: when a moved shift double-books a member, re-place the *blocking shift* (not the whole job) into conflict-free time, chaining to anything that newly clashes — gated by the existing "Cascade following jobs" toggle.

**Architecture:** Approach 2 from the design — a new shift-level resolver (`services/shiftCascade.ts`) that reuses an **extracted placement core** (`placeHoursConflictFree` in `services/scheduleEngine.ts`), leaving the job-cascade path (`reflowAvoidingConflicts`) untouched in behavior. The core is extracted with a live `occupiedByDay` callback + an `onDayExhausted` hook so `reflowAvoidingConflicts` stays behavior-identical (its existing tests are the proof) while the resolver drives the same placement math. `ProposedChange.shiftId` (Phase 5) already carries a per-shift edit through preview → apply; this plan (a) teaches `applyChangeToJob` to apply a change's per-day windows to a shift, (b) folds multiple per-job changes on apply, and (c) wires the week-board and day-board drag triggers to the resolver.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react. Typecheck `npx tsc --noEmit`; run one test file with `npx vitest run <path>`; a single test with `-t "<name>"`.

## Global Constraints

- **Behavior-preserving extraction is a hard gate.** The existing `reflowAvoidingConflicts` tests in `services/scheduleEngine.test.ts` MUST stay green through Task 1 with zero edits to their assertions. If any changes, the extraction changed behavior — fix the extraction, not the test.
- **Date keys are bare `YYYY-MM-DD`.** `new Date('YYYY-MM-DD')` parses as UTC midnight and can drop a day in negative-offset zones. Any Date math on a date key MUST anchor at local noon (`` `${key}T12:00:00` ``) or go through the existing `toLocalDateKey` / `advanceWorkingDays` / `workingDayKeys`.
- **A `JobCrewAllocation` IS a shift.** Fields: `{ id, name, memberIds[], startDate/endDate (YYYY-MM-DD), startTime/endTime (HH:mm), color?, dailyHours?: Record<dateKey,{startTime,endTime}> }`. A shift's window on a day is `allocDayWindow(alloc, dayKey)` (per-day override, else default `startTime`/`endTime`).
- **Envelope is derived, never hand-set.** All allocation mutations recompute the job span via `recomputeJobEnvelope(job)` (earliest shift start … latest shift end, carrying boundary-day times). Never set `job.startDate/endDate` directly on a shift path.
- **The moved (anchor) shift is pinned.** The resolver never relocates it; everything else reflows around it. Without this the resolver could "solve" a clash by undoing the user's move.
- **Placement policy is the page's existing Smart/Simple.** A displaced shift is re-placed with the same `keepExistingDaysAsIs` + `untilDate` semantics the job cascade uses — no new placement behavior is invented. "Forward" is the fallback, not a hard rule: a bumped shift can land earlier the same day when Smart finds room.
- **Cascade is gated by the existing toggle.** ON → auto-resolve the chain. OFF → apply only the moved shift, relocate nothing, show a **non-blocking** warning listing resulting crew clashes (mirrors today's warning behavior). The user may proceed regardless.
- **Legacy / single-shift jobs unchanged.** A job with no `allocations` renders and drags exactly as today; every shift-aware branch falls back to the whole-job path when `shiftId` is absent.
- **TDD.** Failing test first, minimal implementation, green, commit — one commit per task.
- **Commit footer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Out of scope (do not build):** the shift-native sidebar redesign (Piece A) and therefore the *sidebar DAILY HOURS* trigger; per-shift month-view splitting; any change to how Work Orders create shifts; earlier-than-necessary "optimization" beyond the existing Smart/Simple reflow. This plan is Piece B and is independently shippable without Piece A.

---

## File Structure

- `services/scheduleEngine.ts` — **Modify.** Add `placeHoursConflictFree` (the extracted placement core) + its options interface; refactor `reflowAvoidingConflicts` to call it (behavior-preserving); extend `applyChangeToJob`'s shift branch to apply `change.dailyHours` to the allocation.
- `services/shiftCascade.ts` — **Create.** Crew-timeline model (`ShiftOccurrence`, `buildMemberTimelines`, `occurrencesClash`, `clashesWith`), the resolver `resolveShiftCascade`, the OFF-path detector `detectShiftClashes`, and `ResidualClash`/`ShiftClash` types + `shiftRequiredHours` helper.
- `App.tsx` — **Modify.** `applyScheduleChanges` folds *all* non-skipped changes for a job (multi-shift-per-job); `handleApplySchedule` dedupes the inverse/affected lists by jobId.
- `components/views/JobSchedulingView.tsx` — **Modify.** ON path: route shift-staged changes through `resolveShiftCascade` (via `restageForPrimary`); hold `residualClashes` and surface them. Day-board block drag (`handleChangeDayWindow`) stages a preview when cascade ON, instant-write + warning when OFF.
- Test files: `services/scheduleEngine.test.ts` (**Modify** — new core + apply-branch tests, existing reflow tests untouched), `services/shiftCascade.test.ts` (**Create**).

---

### Task 1: Extract `placeHoursConflictFree` and refactor `reflowAvoidingConflicts` onto it

Lift the placement logic (Smart-extend of pinned days + new-day fill for leftover hours) out of `reflowAvoidingConflicts` into a shared, exported core parameterized by a live `occupiedByDay` callback, a `canExtendEarlier` guard, and an `onDayExhausted` hook. `reflowAvoidingConflicts` becomes a thin wrapper that supplies those callbacks (its blocker-bumping lives in the hook), so its behavior is identical by construction. The resolver (Task 4) calls the same core with no `onDayExhausted`.

**Files:**
- Modify: `services/scheduleEngine.ts`
- Test: `services/scheduleEngine.test.ts`

**Interfaces:**
- Consumes (all already in `scheduleEngine.ts`, module-private or exported): `ClockInterval`, `freeIntervals`, `hhmmToHours`, `hoursToHHMM`, `advanceWorkingDays`, `toLocalDateKey`, `occupiedIntervals`, `jobClockWindowOnDay`, `placeAfterConflictFree`, `scheduledWindowHours`, `WorkingTimeConfig`, `CascadeScope`, `ProposedChange`.
- Produces:
  ```ts
  export interface PlaceHoursOptions {
    keepExistingDaysAsIs?: boolean;      // Simple: no Smart-extend of pinned days
    untilDate?: string;                  // passed to onDayExhausted for blocker filtering
    fromKey: string;                     // inclusive first working day for NEW placement
    canExtendEarlier?: (dayKey: string) => boolean;   // default: () => true
    onDayExhausted?: (dayKey: string, coreLatestEndISO: string) => boolean; // default: absent → skip day
  }
  export const placeHoursConflictFree = (
    pinnedDayHours: Record<string, { startTime: string; endTime: string }>,
    requiredHours: number,
    occupiedByDay: (dayKey: string) => ClockInterval[],
    config: WorkingTimeConfig,
    opts: PlaceHoursOptions,
  ): { dayHours: Record<string, { startTime: string; endTime: string }>; unplaced: number };
  ```
  `reflowAvoidingConflicts` keeps its exact current signature and `ReflowConflictResult` return.

- [ ] **Step 1: Write the failing direct-core tests**

Add to `services/scheduleEngine.test.ts` (import `placeHoursConflictFree` alongside the existing engine imports):

```ts
import { placeHoursConflictFree } from './scheduleEngine';

describe('placeHoursConflictFree', () => {
  const config = { skipNonWorkingDays: true, weekendDays: [0, 6], holidays: [], workDayStartHour: 8, workDayEndHour: 17 };
  const noneBusy = () => [];

  it('keeps a pinned day and places leftover hours on the next working day (Simple)', () => {
    const out = placeHoursConflictFree(
      { '2026-07-06': { startTime: '08:00', endTime: '12:00' } }, // 4h pinned
      12,                                                          // needs 8h more
      noneBusy, config,
      { keepExistingDaysAsIs: true, fromKey: '2026-07-07' },
    );
    expect(out.dayHours['2026-07-06']).toEqual({ startTime: '08:00', endTime: '12:00' });
    expect(out.dayHours['2026-07-07']).toEqual({ startTime: '08:00', endTime: '16:00' }); // 8h
    expect(out.unplaced).toBe(0);
  });

  it('Smart mode extends the pinned day into adjacent free time before opening a new day', () => {
    const out = placeHoursConflictFree(
      { '2026-07-06': { startTime: '08:00', endTime: '12:00' } }, // 4h pinned
      7, noneBusy, config,
      { keepExistingDaysAsIs: false, fromKey: '2026-07-07' },
    );
    expect(out.dayHours['2026-07-06']).toEqual({ startTime: '08:00', endTime: '15:00' }); // extended to 7h, one day
    expect(out.dayHours['2026-07-07']).toBeUndefined();
    expect(out.unplaced).toBe(0);
  });

  it('places into a free gap and reports unplaced when the day cannot hold it and no exhaust hook', () => {
    const busy = (k: string) => (k === '2026-07-06' ? [{ start: 8, end: 16 }] : []); // only 16-17 free
    const out = placeHoursConflictFree(
      {}, 4, busy, config,
      { keepExistingDaysAsIs: true, fromKey: '2026-07-06' },
    );
    expect(out.dayHours['2026-07-06']).toEqual({ startTime: '16:00', endTime: '17:00' }); // 1h fits
    expect(out.unplaced).toBe(3);                                                          // 3h could not place
  });

  it('retries a day when onDayExhausted frees room', () => {
    let freed = false;
    const busy = (k: string) => (k === '2026-07-06' && !freed ? [{ start: 8, end: 17 }] : []);
    const out = placeHoursConflictFree(
      {}, 2, busy, config,
      { keepExistingDaysAsIs: true, fromKey: '2026-07-06', onDayExhausted: () => { freed = true; return true; } },
    );
    expect(out.dayHours['2026-07-06']).toEqual({ startTime: '08:00', endTime: '10:00' });
    expect(out.unplaced).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t placeHoursConflictFree`
Expected: FAIL — `placeHoursConflictFree is not a function`.

- [ ] **Step 3: Add the core**

In `services/scheduleEngine.ts`, add **before** `reflowAvoidingConflicts` (so it is defined for the wrapper):

```ts
export interface PlaceHoursOptions {
  /** Simple mode: never Smart-extend the pinned days into adjacent free time. */
  keepExistingDaysAsIs?: boolean;
  /** Passed through to `onDayExhausted` so callers can bound blocker bumping. */
  untilDate?: string;
  /** Inclusive first working day to consider for NEW (leftover) placement. */
  fromKey: string;
  /** Whether a pinned day may grow EARLIER (default: yes). Callers that must not undo
   *  a user's start-later edit return false for that day. */
  canExtendEarlier?: (dayKey: string) => boolean;
  /** Called when a NEW day has no free slot. The caller may free space (e.g. bump
   *  blocking shared-crew jobs) and return true to retry the day with a fresh occupied
   *  read; return false (or omit the hook) to skip the day and count hours as unplaced.
   *  `coreLatestEndISO` is the latest end this core has placed so far. */
  onDayExhausted?: (dayKey: string, coreLatestEndISO: string) => boolean;
}

/**
 * Place `requiredHours` of work into conflict-free clock time: pinned days are kept
 * (and, in Smart mode, extended into adjacent free time), then leftover hours fill
 * working days from `fromKey` forward, reading busy time via `occupiedByDay`. Returns
 * the resulting per-day windows and any hours that could not be placed. This is the
 * shared placement core behind both `reflowAvoidingConflicts` (job cascade) and
 * `resolveShiftCascade` (shift cascade); the two differ only in the callbacks they pass.
 */
export const placeHoursConflictFree = (
  pinnedDayHours: Record<string, { startTime: string; endTime: string }>,
  requiredHours: number,
  occupiedByDay: (dayKey: string) => ClockInterval[],
  config: WorkingTimeConfig,
  opts: PlaceHoursOptions,
): { dayHours: Record<string, { startTime: string; endTime: string }>; unplaced: number } => {
  const result: Record<string, { startTime: string; endTime: string }> = {};
  const pinnedKeys = Object.keys(pinnedDayHours).sort();
  let pinnedTotal = 0;
  for (const k of pinnedKeys) {
    result[k] = { ...pinnedDayHours[k] };
    pinnedTotal += Math.max(0, hhmmToHours(pinnedDayHours[k].endTime) - hhmmToHours(pinnedDayHours[k].startTime));
  }
  let remaining = Math.round((requiredHours - pinnedTotal) * 10) / 10;

  // Smart: extend each pinned day into the free time adjacent to its window. Grow the
  // END later; grow the START earlier only when `canExtendEarlier` allows it.
  if (!opts.keepExistingDaysAsIs) {
    for (const k of pinnedKeys) {
      if (remaining <= 0) break;
      const free = freeIntervals(occupiedByDay(k), config);
      const win = { start: hhmmToHours(result[k].startTime), end: hhmmToHours(result[k].endTime) };
      const host = free.find((f) => f.start <= win.start + 1e-9 && f.end >= win.end - 1e-9);
      if (!host) continue;
      const canEarlier = opts.canExtendEarlier ? opts.canExtendEarlier(k) : true;
      let { start, end } = win;
      const takeLater = Math.min(host.end - end, remaining);
      end += takeLater; remaining = Math.round((remaining - takeLater) * 10) / 10;
      if (canEarlier) {
        const takeEarlier = Math.min(start - host.start, remaining);
        start -= takeEarlier; remaining = Math.round((remaining - takeEarlier) * 10) / 10;
      }
      result[k] = { startTime: hoursToHHMM(start), endTime: hoursToHHMM(end) };
    }
  }

  const latestEndISO = () => {
    const all = Object.keys(result).map((k) => `${k}T${result[k].endTime}:00`).sort();
    return all[all.length - 1] ?? `${opts.fromKey}T${hoursToHHMM(config.workDayStartHour)}:00`;
  };

  // Leftover hours onto working days from `fromKey` (inclusive). Step back one calendar
  // day so the first `advanceWorkingDays(+1)` lands on `fromKey` when it is a working day
  // (else on the next working day) — matching the job cascade's "strictly after the pinned
  // span" behavior when the caller passes the day after the span as `fromKey`.
  let cursor = new Date(`${opts.fromKey}T12:00:00`);
  cursor.setDate(cursor.getDate() - 1);
  for (let guard = 0; remaining > 0 && guard < 60; guard++) {
    cursor = advanceWorkingDays(cursor, 1, config);
    const dayKey = toLocalDateKey(cursor);
    const need = Math.min(remaining, config.workDayEndHour - config.workDayStartHour);
    let free = freeIntervals(occupiedByDay(dayKey), config);
    let slot = free.find((f) => f.end - f.start >= need - 1e-9) ?? free.find((f) => f.end - f.start >= 1e-9);
    if (!slot && opts.onDayExhausted) {
      const retry = opts.onDayExhausted(dayKey, latestEndISO());
      if (retry) { free = freeIntervals(occupiedByDay(dayKey), config); slot = free.find((f) => f.end - f.start >= 1e-9); }
    }
    if (slot) {
      const place = Math.min(need, slot.end - slot.start);
      result[dayKey] = { startTime: hoursToHHMM(slot.start), endTime: hoursToHHMM(slot.start + place) };
      remaining = Math.round((remaining - place) * 10) / 10;
    }
    // else: day unusable → loop advances to the next working day.
  }

  return { dayHours: result, unplaced: Math.max(0, remaining) };
};
```

> `advanceWorkingDays` uses `setDate`, so anchoring `cursor` at `T12:00:00` and stepping back one calendar day is DST/zone-safe. `freeIntervals` already merges the intervals `occupiedByDay` returns, so callers may return raw (unmerged) intervals.

- [ ] **Step 4: Refactor `reflowAvoidingConflicts` to call the core**

Replace the body of `reflowAvoidingConflicts` (the current lines from `const scope = scopeOf(job);` through the `return { primary, displaced };`) with a wrapper that supplies the callbacks. Keep the `base`, `scope`, `required`, `displaced`, `displacedIds`, and `occupiersExceptSelf` setup:

```ts
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

  const displaced: ProposedChange[] = [];
  const displacedIds = new Set<string>();
  const occupiersExceptSelf = () => jobs.filter((j) => j.id !== job.id && !displacedIds.has(j.id));

  const pinnedKeys = Object.keys(pinnedDayHours).sort();
  // New days start on the working day strictly after the pinned span (unchanged behavior).
  const lastPinned = pinnedKeys[pinnedKeys.length - 1] ?? toLocalDateKey(new Date());
  const fromKey = toLocalDateKey(advanceWorkingDays(new Date(`${lastPinned}T12:00:00`), 1, config));

  const { dayHours: result } = placeHoursConflictFree(
    pinnedDayHours,
    required,
    (k) => occupiedIntervals(occupiersExceptSelf(), scope, k, config, job.id),
    config,
    {
      keepExistingDaysAsIs: opts.keepExistingDaysAsIs,
      untilDate: opts.untilDate,
      fromKey,
      // Only grow earlier when the user hasn't pushed this day's start later than its original.
      canExtendEarlier: (k) => {
        const originalStart = job.dailyHours?.[k]?.startTime;
        return originalStart === undefined
          || hhmmToHours(pinnedDayHours[k].startTime) <= hhmmToHours(originalStart) + 1e-9;
      },
      // Bump fully-blocking shared-crew jobs forward, then retry the day.
      onDayExhausted: (dayKey, coreLatestEndISO) => {
        const blockers = occupiersExceptSelf().filter(
          (j) => !j.is_locked && jobClockWindowOnDay(j, dayKey, config)
            && (!opts.untilDate || !j.startDate || toLocalDateKey(new Date(j.startDate)) <= opts.untilDate),
        );
        const dayEndISO = `${dayKey}T${hoursToHHMM(config.workDayEndHour)}:00`;
        const anchor = [coreLatestEndISO, dayEndISO, ...displaced.map((d) => d.newEnd)].sort().pop()!;
        for (const b of blockers) {
          displaced.push(placeAfterConflictFree(b, anchor, jobs, scopeOf(b), config, displacedIds));
          displacedIds.add(b.id);
        }
        return blockers.length > 0;
      },
    },
  );

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

> Delete the now-unused inline `latestEndISO` that lived in the old body (the core owns its own). `advanceWorkingDays`, `occupiedIntervals`, `jobClockWindowOnDay`, `placeAfterConflictFree`, `scheduledWindowHours`, `hhmmToHours`, `hoursToHHMM`, `toLocalDateKey` are all already in this module.

- [ ] **Step 5: Run the new core tests AND the full existing engine suite**

Run: `npx vitest run services/scheduleEngine.test.ts`
Expected: PASS — the 4 new `placeHoursConflictFree` tests pass **and every pre-existing `reflowAvoidingConflicts` / cascade test stays green with no edits**. If a reflow test fails, the extraction diverged — fix the wrapper/core, not the test.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "refactor(scheduling): extract placeHoursConflictFree from reflowAvoidingConflicts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `applyChangeToJob` applies a change's per-day windows to a shift

Today the `shiftId` branch of `applyChangeToJob` only *moves* a shift's start day (delta re-key) and ignores `change.dailyHours`. The resolver's follower changes and the day-board time-edit both carry the shift's new per-day windows, so the branch must apply them: set the allocation's dates/times/`dailyHours` from `change.dailyHours` when present, keeping the delta-move path when it is absent (e.g. the Phase 5 week-board drag preview, which carries no `dailyHours`).

**Files:**
- Modify: `services/scheduleEngine.ts`
- Test: `services/scheduleEngine.test.ts`

**Interfaces:**
- Consumes: `ProposedChange` (has `shiftId?`, `dailyHours?`), `recomputeJobEnvelope`, `toLocalDateKey`.
- Produces: `applyChangeToJob(job, change)` unchanged signature; new behavior — when `change.shiftId` **and** a non-empty `change.dailyHours` are set, the named allocation's `startDate`/`endDate`/`startTime`/`endTime`/`dailyHours` are set from that (complete) map. The no-`dailyHours` shift path and the legacy job path are unchanged.

- [ ] **Step 1: Write the failing test**

Add to `services/scheduleEngine.test.ts`:

```ts
describe('applyChangeToJob (shift window apply)', () => {
  const job = {
    id: 'j1', name: 'J', jobNumber: '1',
    startDate: '2026-07-06T08:00:00', endDate: '2026-07-06T12:00:00',
    allocations: [
      { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-07-06', endDate: '2026-07-06', startTime: '08:00', endTime: '12:00' },
    ],
  } as unknown as Job;

  it('applies the change dailyHours as the allocation windows and re-derives its span', () => {
    const change: ProposedChange = {
      jobId: 'j1', jobName: 'J', jobNumber: '1', shiftId: 's1',
      oldStart: '2026-07-06T08:00:00', oldEnd: '2026-07-06T12:00:00',
      newStart: '2026-07-08T08:00:00', newEnd: '2026-07-09T12:00:00',
      dailyHours: {
        '2026-07-08': { startTime: '08:00', endTime: '17:00' },
        '2026-07-09': { startTime: '08:00', endTime: '12:00' },
      },
    };
    const out = applyChangeToJob(job, change);
    const a = out.allocations!.find(x => x.id === 's1')!;
    expect(a.startDate).toBe('2026-07-08');
    expect(a.endDate).toBe('2026-07-09');
    expect(a.startTime).toBe('08:00');
    expect(a.endTime).toBe('12:00');
    expect(a.dailyHours).toEqual(change.dailyHours);
    expect(out.startDate).toBe('2026-07-08T08:00:00'); // envelope recomputed
    expect(out.endDate).toBe('2026-07-09T12:00:00');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t "shift window apply"`
Expected: FAIL — the delta-move branch ignores `change.dailyHours`, so `a.dailyHours` / dates are wrong.

- [ ] **Step 3: Implement**

In `applyChangeToJob`, replace the `if (change.shiftId) { ... }` block with a version that branches on `change.dailyHours`:

```ts
  if (change.shiftId) {
    const windows = change.dailyHours;
    if (windows && Object.keys(windows).length > 0) {
      // The change carries the shift's complete new per-day windows (resolver / day
      // edit). Set the allocation's span + windows from them and recompute the envelope.
      const keys = Object.keys(windows).sort();
      const start = keys[0];
      const end = keys[keys.length - 1];
      const allocations = (job.allocations ?? []).map(a =>
        a.id === change.shiftId
          ? { ...a, startDate: start, endDate: end, startTime: windows[start].startTime, endTime: windows[end].endTime, dailyHours: { ...windows } }
          : a,
      );
      return recomputeJobEnvelope({ ...job, allocations });
    }
    // No explicit windows: move only the named allocation's start day, re-keying its
    // per-day windows by the same delta, then recompute the envelope. (Re-keyed inline
    // rather than via shifts.moveAllocation to avoid a shifts.ts <-> scheduleEngine.ts cycle.)
    const newStartKey = toLocalDateKey(new Date(change.newStart));
    const allocations = (job.allocations ?? []).map(a => {
      if (a.id !== change.shiftId || !a.startDate) return a;
      const delta = Math.round(
        (new Date(`${newStartKey}T12:00:00`).getTime() - new Date(`${a.startDate}T12:00:00`).getTime()) / 86_400_000,
      );
      const rekey = (k: string): string => {
        const d = new Date(`${k}T12:00:00`);
        d.setDate(d.getDate() + delta);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      return {
        ...a,
        startDate: newStartKey,
        endDate: a.endDate ? rekey(a.endDate) : newStartKey,
        ...(a.dailyHours ? { dailyHours: Object.fromEntries(Object.entries(a.dailyHours).map(([k, w]) => [rekey(k), w])) } : {}),
      };
    });
    return recomputeJobEnvelope({ ...job, allocations });
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts`
Expected: PASS — the new test plus the existing `applyChangeToJob (shift move)` tests (no-`dailyHours` path) all green.

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat(scheduling): applyChangeToJob applies a change's per-day windows to a shift

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Crew-timeline model & conflict detection (`services/shiftCascade.ts`)

The "personal timeline": every dated shift on every schedulable job, expanded across its working days, grouped by crew member. Conflict = two occurrences on the same member, same day, with overlapping clock windows.

**Files:**
- Create: `services/shiftCascade.ts`
- Test: `services/shiftCascade.test.ts`

**Interfaces:**
- Consumes: `Job`, `JobCrewAllocation` from `../types`; `WorkingTimeConfig`, `allocDayWindow`, `workingDayKeys`, `toLocalDateKey` from `./scheduleEngine`.
- Produces:
  ```ts
  export interface ShiftOccurrence { jobId: string; shiftId: string; shiftName: string; memberIds: string[]; dateKey: string; startMin: number; endMin: number; }
  export interface ShiftRef { jobId: string; shiftId: string; }
  export const buildMemberTimelines: (jobs: Job[], config: WorkingTimeConfig) => Map<string, ShiftOccurrence[]>;
  export const occurrencesClash: (a: ShiftOccurrence, b: ShiftOccurrence) => boolean;
  export const clashesWith: (target: ShiftRef, timelines: Map<string, ShiftOccurrence[]>, pinned: Set<string>) => ShiftRef[];
  ```

- [ ] **Step 1: Write the failing test**

Create `services/shiftCascade.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Job } from '../types';
import { buildMemberTimelines, occurrencesClash, clashesWith } from './shiftCascade';

const config = { skipNonWorkingDays: true, weekendDays: [0, 6], holidays: [], workDayStartHour: 8, workDayEndHour: 17 };

const job = (id: string, allocs: any[]): Job => ({ id, name: id, jobNumber: id, stage: 'Scheduled', allocations: allocs } as unknown as Job);

describe('buildMemberTimelines', () => {
  it('pools occurrences per member across jobs and days', () => {
    const jobs = [
      job('j1', [{ id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-07-06', endDate: '2026-07-07', startTime: '08:00', endTime: '12:00' }]),
      job('j2', [{ id: 's2', name: 'Paint', memberIds: ['m1', 'm2'], startDate: '2026-07-06', endDate: '2026-07-06', startTime: '13:00', endTime: '17:00' }]),
    ];
    const tl = buildMemberTimelines(jobs, config);
    expect(tl.get('m1')!.map(o => o.dateKey).sort()).toEqual(['2026-07-06', '2026-07-06', '2026-07-07']);
    expect(tl.get('m2')!).toHaveLength(1);
  });
});

describe('occurrencesClash', () => {
  const occ = (dateKey: string, startMin: number, endMin: number): any => ({ jobId: 'j', shiftId: 's', shiftName: 's', memberIds: ['m1'], dateKey, startMin, endMin });
  it('true when same day and clock windows overlap', () => {
    expect(occurrencesClash(occ('2026-07-06', 480, 720), occ('2026-07-06', 600, 900))).toBe(true);
  });
  it('false when same day but windows are back-to-back', () => {
    expect(occurrencesClash(occ('2026-07-06', 480, 720), occ('2026-07-06', 720, 900))).toBe(false);
  });
  it('false on different days', () => {
    expect(occurrencesClash(occ('2026-07-06', 480, 720), occ('2026-07-07', 480, 720))).toBe(false);
  });
});

describe('clashesWith', () => {
  it('returns shifts overlapping the target on a shared member, excluding pinned', () => {
    const jobs = [
      job('j1', [{ id: 's1', name: 'A', memberIds: ['m1'], startDate: '2026-07-06', endDate: '2026-07-06', startTime: '14:00', endTime: '16:00' }]),
      job('j2', [{ id: 's2', name: 'B', memberIds: ['m1'], startDate: '2026-07-06', endDate: '2026-07-06', startTime: '11:00', endTime: '16:00' }]),
    ];
    const tl = buildMemberTimelines(jobs, config);
    expect(clashesWith({ jobId: 'j1', shiftId: 's1' }, tl, new Set(['s1']))).toEqual([{ jobId: 'j2', shiftId: 's2' }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run services/shiftCascade.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `services/shiftCascade.ts`:

```ts
import type { Job, JobCrewAllocation } from '../types';
import { WorkingTimeConfig, allocDayWindow, workingDayKeys } from './scheduleEngine';

export interface ShiftOccurrence {
  jobId: string;
  shiftId: string;
  shiftName: string;
  memberIds: string[];
  dateKey: string;
  startMin: number;
  endMin: number;
}

export interface ShiftRef { jobId: string; shiftId: string; }

const toMin = (t: string): number => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

/** Every dated shift on every job, expanded across its working days, grouped by member.
 *  This is each crew member's "personal timeline" — job-agnostic. */
export const buildMemberTimelines = (jobs: Job[], config: WorkingTimeConfig): Map<string, ShiftOccurrence[]> => {
  const timelines = new Map<string, ShiftOccurrence[]>();
  for (const job of jobs) {
    for (const alloc of job.allocations ?? []) {
      if (!alloc.startDate || !alloc.endDate) continue;
      const days = workingDayKeys(`${alloc.startDate}T12:00:00`, `${alloc.endDate}T12:00:00`, config.weekendDays);
      for (const dateKey of days) {
        const w = allocDayWindow(alloc, dateKey);
        const occ: ShiftOccurrence = {
          jobId: job.id, shiftId: alloc.id, shiftName: alloc.name, memberIds: alloc.memberIds ?? [],
          dateKey, startMin: toMin(w.startTime), endMin: toMin(w.endTime),
        };
        for (const m of occ.memberIds) {
          const arr = timelines.get(m) ?? [];
          arr.push(occ);
          timelines.set(m, arr);
        }
      }
    }
  }
  return timelines;
};

/** Same calendar day and overlapping clock windows (each starts before the other ends). */
export const occurrencesClash = (a: ShiftOccurrence, b: ShiftOccurrence): boolean =>
  a.dateKey === b.dateKey && a.startMin < b.endMin && b.startMin < a.endMin;

/** The distinct shifts (excluding `pinned` shift ids and the target itself) that overlap
 *  `target` on any member whose timeline both share. */
export const clashesWith = (target: ShiftRef, timelines: Map<string, ShiftOccurrence[]>, pinned: Set<string>): ShiftRef[] => {
  const targetOccs: ShiftOccurrence[] = [];
  for (const occs of timelines.values()) for (const o of occs) if (o.shiftId === target.shiftId && o.jobId === target.jobId) targetOccs.push(o);

  const found = new Map<string, ShiftRef>();
  for (const to of targetOccs) {
    for (const m of to.memberIds) {
      for (const o of timelines.get(m) ?? []) {
        if (o.shiftId === target.shiftId) continue;
        if (pinned.has(o.shiftId)) continue;
        if (occurrencesClash(to, o)) found.set(`${o.jobId}:${o.shiftId}`, { jobId: o.jobId, shiftId: o.shiftId });
      }
    }
  }
  return [...found.values()];
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run services/shiftCascade.test.ts`
Expected: PASS (all detection tests).

- [ ] **Step 5: Commit**

```bash
git add services/shiftCascade.ts services/shiftCascade.test.ts
git commit -m "feat(scheduling): crew-timeline model + shift clash detection

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: The resolver `resolveShiftCascade`

Given the anchor's staged change (a `shiftId` `ProposedChange`), resolve the whole chain: re-place each clashing shift into conflict-free time via `placeHoursConflictFree`, chaining to anything the re-placement newly clashes with, leaving the anchor pinned. Returns **follower** changes (the anchor is not re-emitted) plus `ResidualClash`es for anything that could not be placed within `untilDate` / bounds.

**Files:**
- Modify: `services/shiftCascade.ts`
- Test: `services/shiftCascade.test.ts`

**Interfaces:**
- Consumes: `applyChangeToJob`, `placeHoursConflictFree`, `PlaceHoursOptions`, `ClockInterval`, `WorkingTimeConfig`, `ProposedChange`, `allocDayWindow`, `workingDayKeys`, `toLocalDateKey`, `advanceWorkingDays` from `./scheduleEngine`; `buildMemberTimelines`, `clashesWith`, `ShiftRef` from this module.
- Produces:
  ```ts
  export interface ResidualClash { jobId: string; jobName: string; shiftId: string; shiftName: string; memberIds: string[]; message: string; }
  export const shiftRequiredHours: (alloc: JobCrewAllocation, config: WorkingTimeConfig) => number;
  export const resolveShiftCascade: (
    jobs: Job[],
    anchor: ProposedChange,   // anchor.shiftId is set; already describes the moved shift's new position
    config: WorkingTimeConfig,
    opts: { keepExistingDaysAsIs?: boolean; untilDate?: string },
  ) => { changes: ProposedChange[]; residual: ResidualClash[] };
  ```

- [ ] **Step 1: Write the failing test (the John scenario + chain + residual)**

Add to `services/shiftCascade.test.ts`:

```ts
import { resolveShiftCascade, shiftRequiredHours } from './shiftCascade';
import type { ProposedChange } from './scheduleEngine';

const alloc = (id: string, name: string, members: string[], startDate: string, endDate: string, startTime: string, endTime: string) =>
  ({ id, name, memberIds: members, startDate, endDate, startTime, endTime });

describe('resolveShiftCascade', () => {
  it('re-places a shift the moved shift now double-books (the John scenario)', () => {
    // John (m1) is on Shift A (7-10) and Shift B (11-16) same day. Move A to 14:00-16:00
    // → A now overlaps B on m1. Resolver re-places B (the blocker), leaving A pinned.
    const jobs = [
      job('j1', [alloc('sA', 'A', ['m1'], '2026-07-06', '2026-07-06', '14:00', '16:00')]),  // already moved
      job('j2', [alloc('sB', 'B', ['m1'], '2026-07-06', '2026-07-06', '11:00', '16:00')]),
    ];
    const anchor: ProposedChange = {
      jobId: 'j1', jobName: 'j1', jobNumber: 'j1', shiftId: 'sA',
      oldStart: '2026-07-06T07:00:00', oldEnd: '2026-07-06T10:00:00',
      newStart: '2026-07-06T14:00:00', newEnd: '2026-07-06T16:00:00',
    };
    const { changes, residual } = resolveShiftCascade(jobs, anchor, config, {});
    expect(residual).toEqual([]);
    // Exactly one follower — Shift B — and it no longer overlaps 14:00-16:00 on m1.
    expect(changes.map(c => c.shiftId)).toEqual(['sB']);
    const bWindows = changes[0].dailyHours!;
    const overlaps14to16 = Object.values(bWindows).some(w => w.startTime < '16:00' && w.endTime > '14:00' && Object.keys(bWindows).includes('2026-07-06'));
    // B's Jul-6 window must not cover 14-16; simplest assertion: B spilled off Jul-6 or sits before 14:00.
    expect(changes[0].newStart >= '2026-07-06T16:00:00' || changes[0].newStart.startsWith('2026-07-07') || bWindows['2026-07-06']?.endTime <= '14:00').toBe(true);
  });

  it('leaves the anchor shift untouched (never emits a change for it)', () => {
    const jobs = [
      job('j1', [alloc('sA', 'A', ['m1'], '2026-07-06', '2026-07-06', '14:00', '16:00')]),
      job('j2', [alloc('sB', 'B', ['m1'], '2026-07-06', '2026-07-06', '11:00', '16:00')]),
    ];
    const anchor: ProposedChange = { jobId: 'j1', jobName: 'j1', jobNumber: 'j1', shiftId: 'sA', oldStart: null, oldEnd: null, newStart: '2026-07-06T14:00:00', newEnd: '2026-07-06T16:00:00' };
    const { changes } = resolveShiftCascade(jobs, anchor, config, {});
    expect(changes.every(c => c.shiftId !== 'sA')).toBe(true);
  });

  it('reports a ResidualClash when a blocker cannot be placed before untilDate', () => {
    const jobs = [
      job('j1', [alloc('sA', 'A', ['m1'], '2026-07-06', '2026-07-06', '08:00', '17:00')]), // fills the whole day
      job('j2', [alloc('sB', 'B', ['m1'], '2026-07-06', '2026-07-06', '08:00', '17:00')]),
    ];
    const anchor: ProposedChange = { jobId: 'j1', jobName: 'j1', jobNumber: 'j1', shiftId: 'sA', oldStart: null, oldEnd: null, newStart: '2026-07-06T08:00:00', newEnd: '2026-07-06T17:00:00' };
    // untilDate == the clash day means the blocker cannot spill to a later day.
    const { changes, residual } = resolveShiftCascade(jobs, anchor, config, { untilDate: '2026-07-06' });
    expect(changes).toEqual([]);
    expect(residual).toHaveLength(1);
    expect(residual[0].shiftId).toBe('sB');
  });
});
```

> The John-scenario assertion is deliberately permissive about *where* B lands (Smart may pull it before 14:00 the same day; Simple spills to the next day) — it only asserts B no longer overlaps the anchor window. Task 8's runtime verify pins the exact UX.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run services/shiftCascade.test.ts -t resolveShiftCascade`
Expected: FAIL — `resolveShiftCascade is not a function`.

- [ ] **Step 3: Implement the resolver**

Append to `services/shiftCascade.ts`:

```ts
import { applyChangeToJob, placeHoursConflictFree, advanceWorkingDays } from './scheduleEngine';

/** Total working-hours a shift covers, summed over its working days. */
export const shiftRequiredHours = (alloc: JobCrewAllocation, config: WorkingTimeConfig): number => {
  if (!alloc.startDate || !alloc.endDate) return 0;
  const days = workingDayKeys(`${alloc.startDate}T12:00:00`, `${alloc.endDate}T12:00:00`, config.weekendDays);
  let total = 0;
  for (const k of days) {
    const w = allocDayWindow(alloc, k);
    total += Math.max(0, toMin(w.endTime) - toMin(w.startTime)) / 60;
  }
  return Math.round(total * 10) / 10;
};

export interface ResidualClash {
  jobId: string; jobName: string; shiftId: string; shiftName: string; memberIds: string[]; message: string;
}

/**
 * Resolve a shift move's chain: the anchor (moved) shift is pinned; each shift it (or a
 * subsequently re-placed shift) double-books on a shared member is re-placed into
 * conflict-free time with the page's Smart/Simple policy. Returns follower per-shift
 * changes (never the anchor) and residual clashes that could not be resolved in bounds.
 */
export const resolveShiftCascade = (
  jobs: Job[],
  anchor: ProposedChange,
  config: WorkingTimeConfig,
  opts: { keepExistingDaysAsIs?: boolean; untilDate?: string },
): { changes: ProposedChange[]; residual: ResidualClash[] } => {
  if (!anchor.shiftId) return { changes: [], residual: [] };

  // World with the anchor applied (envelope + windows already reflect the move).
  let world: Job[] = jobs.map(j => (j.id === anchor.jobId ? applyChangeToJob(j, anchor) : j));

  const pinned = new Set<string>([anchor.shiftId]);
  const changes: ProposedChange[] = [];
  const residual: ResidualClash[] = [];
  const visited = new Map<string, string>();       // shiftId → last placed start key
  const queue: ShiftRef[] = [{ jobId: anchor.jobId, shiftId: anchor.shiftId }];

  const findAlloc = (ref: ShiftRef) => {
    const j = world.find(x => x.id === ref.jobId);
    const a = j?.allocations?.find(x => x.id === ref.shiftId);
    return j && a ? { job: j, alloc: a } : null;
  };

  let guard = 0;
  while (queue.length && guard++ < 200) {
    const cur = queue.shift()!;
    const timelines = buildMemberTimelines(world, config);
    const clashing = clashesWith(cur, timelines, pinned)
      .map(ref => findAlloc(ref))
      .filter((x): x is NonNullable<typeof x> => !!x && !!x.alloc.startDate)
      // Earliest-start-first for deterministic ordering.
      .sort((a, b) => (a.alloc.startDate! < b.alloc.startDate! ? -1 : a.alloc.startDate! > b.alloc.startDate! ? 1 : 0));

    for (const { job, alloc } of clashing) {
      if (pinned.has(alloc.id)) continue;
      const clashKey = alloc.startDate!;
      const required = shiftRequiredHours(alloc, config);
      // Busy time for this shift's crew = the pinned shifts' intervals on that day.
      const occupiedByDay = (dayKey: string): { start: number; end: number }[] => {
        const ivs: { start: number; end: number }[] = [];
        const tl = buildMemberTimelines(world, config);
        for (const m of alloc.memberIds ?? []) {
          for (const o of tl.get(m) ?? []) {
            if (o.dateKey === dayKey && pinned.has(o.shiftId) && o.shiftId !== alloc.id) ivs.push({ start: o.startMin / 60, end: o.endMin / 60 });
          }
        }
        return ivs;
      };
      // Smart may pull the shift earlier the same day → start candidates at the clash day.
      // Simple spills forward → start at the next working day.
      const fromKey = opts.keepExistingDaysAsIs
        ? toLocalDateKey(advanceWorkingDays(new Date(`${clashKey}T12:00:00`), 1, config))
        : clashKey;

      const { dayHours, unplaced } = placeHoursConflictFree(
        {}, required, occupiedByDay, config,
        { keepExistingDaysAsIs: opts.keepExistingDaysAsIs, untilDate: opts.untilDate, fromKey },
      );

      const keys = Object.keys(dayHours).sort();
      if (unplaced > 0 || keys.length === 0
        || (opts.untilDate && keys[keys.length - 1] > opts.untilDate)) {
        residual.push({
          jobId: job.id, jobName: job.name, shiftId: alloc.id, shiftName: alloc.name,
          memberIds: alloc.memberIds ?? [],
          message: `${alloc.name} on ${job.name} could not be re-placed conflict-free`,
        });
        pinned.add(alloc.id); // stop reprocessing; it stays where it is
        continue;
      }

      const newStartKey = keys[0];
      if (visited.get(alloc.id) === newStartKey) { pinned.add(alloc.id); continue; } // no forward progress
      visited.set(alloc.id, newStartKey);

      const change: ProposedChange = {
        jobId: job.id, jobName: job.name, jobNumber: job.jobNumber,
        oldStart: `${alloc.startDate}T${allocDayWindow(alloc, alloc.startDate!).startTime}:00`,
        oldEnd: `${alloc.endDate}T${allocDayWindow(alloc, alloc.endDate!).endTime}:00`,
        newStart: `${newStartKey}T${dayHours[newStartKey].startTime}:00`,
        newEnd: `${keys[keys.length - 1]}T${dayHours[keys[keys.length - 1]].endTime}:00`,
        shiftId: alloc.id, dailyHours: dayHours,
      };
      changes.push(change);
      pinned.add(alloc.id);
      world = world.map(j => (j.id === job.id ? applyChangeToJob(j, change) : j));
      queue.push({ jobId: job.id, shiftId: alloc.id }); // its new spot may clash further
    }
  }

  // Collapse to the last change per shift (a shift re-queued and re-placed once here, but
  // guard against duplicates from the chain).
  const lastByShift = new Map<string, ProposedChange>();
  for (const c of changes) lastByShift.set(c.shiftId!, c);
  return { changes: [...lastByShift.values()], residual };
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run services/shiftCascade.test.ts`
Expected: PASS (detection + resolver tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add services/shiftCascade.ts services/shiftCascade.test.ts
git commit -m "feat(scheduling): resolveShiftCascade re-places clashing shifts along the chain

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Fold multiple per-job changes on apply

`resolveShiftCascade` can move several shifts on one job (e.g. Prep bumps Finish). `App.applyScheduleChanges` matches **one** change per job by `jobId`, so a second shift change on the same job is silently dropped. Fold all non-skipped changes for a job through `applyChangeToJob` in turn; dedupe the undo/affected lists.

**Files:**
- Modify: `App.tsx`
- Test: covered by the resolver tests (Task 4) + runtime verify (Task 8). `applyScheduleChanges`/`handleApplySchedule` are App-internal wiring with no isolated unit harness; the fold correctness is proven by `applyChangeToJob` chaining (already tested) and the Task 8 two-shift-per-job runtime check.

**Interfaces:**
- Consumes: `applyChangeToJob` (Task 2 — each shift change recomputes the envelope from the running accumulator's allocations, so chaining is correct).
- Produces: no signature change.

- [ ] **Step 1: Fold in `applyScheduleChanges`**

In `App.tsx`, replace `applyScheduleChanges` (currently ~lines 159–164):

```tsx
  const applyScheduleChanges = (changes: ProposedChange[]) => {
    setJobs(prev => prev.map(j => {
      const forJob = changes.filter(ch => ch.jobId === j.id && !ch.skipped);
      if (forJob.length === 0) return j;
      // Apply every change for this job in turn (multi-shift cascade); each shift edit
      // recomputes the envelope, so folding preserves earlier moves. Legacy job changes
      // are one-per-job, so this reduces to a single application for them.
      return forJob.reduce((acc, ch) => applyChangeToJob(acc, ch), j);
    }));
  };
```

- [ ] **Step 2: Dedupe the inverse/affected lists in `handleApplySchedule`**

Multiple changes per job would otherwise push duplicate inverse entries and duplicate activity-log ids. In `handleApplySchedule`, replace the `inverse` construction (currently ~lines 195–202) so it keeps one entry per job (the pre-commit snapshot is the same for every change on that job):

```tsx
    const seen = new Set<string>();
    const inverse = applied
      .filter(c => { if (seen.has(c.jobId)) return false; seen.add(c.jobId); return true; })
      .map(c => ({
        jobId: c.jobId,
        startDate: c.oldStart ?? undefined,
        endDate: c.oldEnd ?? undefined,
        dailyHours: jobs.find(j => j.id === c.jobId)?.dailyHours,
      }));
```

And dedupe `affectedIds` (currently ~line 208, `const affectedIds = applied.map(c => c.jobId);`):

```tsx
    const affectedIds = [...new Set(applied.map(c => c.jobId))];
```

- [ ] **Step 3: Typecheck + full suite**

Run: `npx tsc --noEmit` then `npx vitest run`
Expected: clean + all pass (no regressions; existing single-change flows behave identically).

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(scheduling): fold multiple per-job shift changes on apply

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: OFF-path shift-grain double-book detection

When cascade is OFF, the moved shift applies alone and nothing reflows — but the user must see a non-blocking warning listing any resulting crew clashes. Add a detector over the crew timelines that returns clashing member/day/shift facts.

**Files:**
- Modify: `services/shiftCascade.ts`
- Test: `services/shiftCascade.test.ts`

**Interfaces:**
- Consumes: `buildMemberTimelines`, `occurrencesClash` (this module), `WorkingTimeConfig`.
- Produces:
  ```ts
  export interface ShiftClash { memberId: string; dateKey: string; a: ShiftRef; b: ShiftRef; message: string; }
  export const detectShiftClashes: (jobs: Job[], config: WorkingTimeConfig) => ShiftClash[];
  ```

- [ ] **Step 1: Write the failing test**

Add to `services/shiftCascade.test.ts`:

```ts
import { detectShiftClashes } from './shiftCascade';

describe('detectShiftClashes', () => {
  it('reports a member double-booked by two overlapping shifts on a day', () => {
    const jobs = [
      job('j1', [alloc('sA', 'A', ['m1'], '2026-07-06', '2026-07-06', '08:00', '12:00')]),
      job('j2', [alloc('sB', 'B', ['m1'], '2026-07-06', '2026-07-06', '10:00', '14:00')]),
    ];
    const clashes = detectShiftClashes(jobs, config);
    expect(clashes).toHaveLength(1);
    expect(clashes[0].memberId).toBe('m1');
    expect(clashes[0].dateKey).toBe('2026-07-06');
  });

  it('returns nothing when windows do not overlap', () => {
    const jobs = [
      job('j1', [alloc('sA', 'A', ['m1'], '2026-07-06', '2026-07-06', '08:00', '12:00')]),
      job('j2', [alloc('sB', 'B', ['m1'], '2026-07-06', '2026-07-06', '13:00', '17:00')]),
    ];
    expect(detectShiftClashes(jobs, config)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run services/shiftCascade.test.ts -t detectShiftClashes`
Expected: FAIL — `detectShiftClashes is not a function`.

- [ ] **Step 3: Implement**

Append to `services/shiftCascade.ts`:

```ts
export interface ShiftClash { memberId: string; dateKey: string; a: ShiftRef; b: ShiftRef; message: string; }

/** Every member double-booked by two overlapping shift occurrences on a day, across the
 *  whole schedule. Used for the cascade-OFF non-blocking warning. Each unordered pair is
 *  reported once per member/day. */
export const detectShiftClashes = (jobs: Job[], config: WorkingTimeConfig): ShiftClash[] => {
  const timelines = buildMemberTimelines(jobs, config);
  const out: ShiftClash[] = [];
  const seen = new Set<string>();
  for (const [memberId, occs] of timelines) {
    for (let i = 0; i < occs.length; i++) {
      for (let k = i + 1; k < occs.length; k++) {
        const a = occs[i], b = occs[k];
        if (a.shiftId === b.shiftId) continue;
        if (!occurrencesClash(a, b)) continue;
        const pair = [a.shiftId, b.shiftId].sort().join('|');
        const key = `${memberId}:${a.dateKey}:${pair}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          memberId, dateKey: a.dateKey,
          a: { jobId: a.jobId, shiftId: a.shiftId }, b: { jobId: b.jobId, shiftId: b.shiftId },
          message: `${a.shiftName} overlaps ${b.shiftName} on the same crew member`,
        });
      }
    }
  }
  return out;
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run services/shiftCascade.test.ts`
Expected: PASS (all shiftCascade tests).

- [ ] **Step 5: Commit**

```bash
git add services/shiftCascade.ts services/shiftCascade.test.ts
git commit -m "feat(scheduling): detectShiftClashes for the cascade-off warning

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Wire the ON path into the view (week-board shift drag + cascade toggle)

Route a staged shift move through `resolveShiftCascade` when cascade is ON: `restageForPrimary` (called by the cascade toggle and the "until" control) detects `staged.shiftId` and calls the resolver, setting `[primary, ...followers]` on the preview. Hold residual clashes in state so they can be surfaced.

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`
- Test: covered by the resolver's own tests (Task 4) + Task 8 runtime verify; the view wiring is a thin dispatch with no isolated unit harness (the existing view suite must stay green).

**Interfaces:**
- Consumes: `resolveShiftCascade`, `ResidualClash` from `../../services/shiftCascade`; the existing `preview`, `cascade`, `cascadeUntil`, `keepExistingDaysAsIs`, `workConfig`, `scopeForJob`.
- Produces: a view-local `restageShiftMove(primary, until)`; `restageForPrimary` short-circuits to it for shift-staged changes; `residualClashes` state.

- [ ] **Step 1: Import and add residual state**

In `components/views/JobSchedulingView.tsx`, add to the `shiftCascade` import (the view already imports from `../../services/scheduleEngine` and `../../services/shifts`):

```tsx
import { resolveShiftCascade, ResidualClash } from '../../services/shiftCascade';
```

Add state near the other cascade state (`const [cascade, setCascade] = useState(false);`):

```tsx
  const [residualClashes, setResidualClashes] = useState<ResidualClash[]>([]);
```

Clear it whenever the preview clears — extend the existing reset effect (`useEffect(() => { if (!preview.staged) { setPendingMoveId(null); setAutoFixDest(null); } }, [preview.staged]);`):

```tsx
  useEffect(() => { if (!preview.staged) { setPendingMoveId(null); setAutoFixDest(null); setResidualClashes([]); } }, [preview.staged]);
```

- [ ] **Step 2: Add `restageShiftMove` and branch `restageForPrimary`**

Add `restageShiftMove` just above `restageForPrimary`:

```tsx
  // Re-stage a staged shift MOVE: cascade ON runs the shift resolver (followers +
  // residual clashes); cascade OFF stages only the moved shift.
  const restageShiftMove = (primary: ProposedChange, until: string) => {
    if (!cascade) { preview.setChanges([primary]); setResidualClashes([]); return; }
    const { changes, residual } = resolveShiftCascade(jobs, primary, workConfig, {
      keepExistingDaysAsIs, untilDate: until || undefined,
    });
    preview.setChanges([primary, ...changes]);
    setResidualClashes(residual);
  };
```

Then, at the **top** of `restageForPrimary`, before the `startDayMoved` logic, add the shift short-circuit:

```tsx
  const restageForPrimary = (staged: ProposedChange, until: string) => {
    if (staged.shiftId) { restageShiftMove(staged, until); return; }
    const startDayMoved = !!staged.oldStart
      && toLocalDateKey(new Date(staged.newStart)) !== toLocalDateKey(new Date(staged.oldStart));
    // ...existing body unchanged...
```

> `handleToggleCascade` and `handleChangeCascadeUntil` already funnel through `restageForPrimary`, so turning cascade ON (or changing the cutoff) after a week-board shift drag now runs the resolver. The week-board drag itself (`handleDropJob`, Phase 5) already stages the `shiftId` primary and sets cascade OFF, so the initial staged state shows just the moved shift until the user opts into cascade — exactly the design's gated behavior.

- [ ] **Step 3: Surface residual clashes (non-blocking)**

Find where the staged preview's issues/warnings render (the drawer uses `detectIssues`/`ScheduleIssue`; search for where `ScheduleIssue`s are listed in the reschedule drawer). Render `residualClashes` as additional non-blocking warning rows there. Minimal, consistent with the existing issue list — add, near the issues render:

```tsx
        {residualClashes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {residualClashes.map((r) => (
              <li key={`${r.jobId}:${r.shiftId}`} className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {r.message}
              </li>
            ))}
          </ul>
        )}
```

> Use the `AlertTriangle` icon already imported by the view (it is used elsewhere in the scheduling UI). If it is not imported in this file, add it to the existing `lucide-react` import. These are warnings only — Apply stays enabled.

- [ ] **Step 4: Typecheck + full suite**

Run: `npx tsc --noEmit` then `npx vitest run`
Expected: clean + all pass (existing view tests green; no behavior change until cascade is toggled ON on a shift move).

- [ ] **Step 5: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat(scheduling): cascade-on shift move runs the shift resolver

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Day-board block drag — stage a preview when cascade ON, instant + warning when OFF

The day-board block drag (`handleChangeDayWindow` for a `shiftId`) currently writes instantly. Per the design, when cascade is ON it must stage the time change through the preview so the resolver can run; when OFF it keeps the instant write but shows a non-blocking clash warning.

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`
- Test: covered by the resolver/detector tests + Task 9 runtime verify.

**Interfaces:**
- Consumes: `allocDayWindow`, `workingDayKeys` from `../../services/scheduleEngine`; `detectShiftClashes` from `../../services/shiftCascade`; `setAllocDayWindow` (already imported); `preview.stage`, `showToast`/toast mechanism the view already uses for messages, `onApplySchedule`.
- Produces: a shift-aware `handleChangeDayWindow` with ON (stage) / OFF (instant + warning) branches.

- [ ] **Step 1: Add the ON/OFF branches**

Ensure the view imports `allocDayWindow`, `workingDayKeys` (add to the existing `../../services/scheduleEngine` import if missing) and `detectShiftClashes` (add to the Task 7 `shiftCascade` import):

```tsx
import { resolveShiftCascade, ResidualClash, detectShiftClashes } from '../../services/shiftCascade';
```

Replace the `shiftId` branch of `handleChangeDayWindow` (currently `if (shiftId) { onUpdateJob(setAllocDayWindow(job, shiftId, dayKey, window)); return; }`):

```tsx
    if (shiftId) {
      const alloc = job.allocations?.find(a => a.id === shiftId);
      if (!alloc) return;
      if (cascade) {
        // Stage the time edit as a shift change so the resolver runs on toggle/apply.
        // The change carries the shift's COMPLETE per-day windows (all working days),
        // with the edited day overridden — applyChangeToJob replaces the allocation's
        // windows from this map.
        const days = alloc.startDate && alloc.endDate
          ? workingDayKeys(`${alloc.startDate}T12:00:00`, `${alloc.endDate}T12:00:00`, workConfig.weekendDays)
          : [dayKey];
        const dailyHours: Record<string, { startTime: string; endTime: string }> = {};
        for (const k of days) dailyHours[k] = k === dayKey ? window : allocDayWindow(alloc, k);
        const startKey = Object.keys(dailyHours).sort()[0];
        const endKey = Object.keys(dailyHours).sort().pop()!;
        const change: ProposedChange = {
          jobId, jobName: job.name, jobNumber: job.jobNumber, shiftId,
          oldStart: `${alloc.startDate}T${allocDayWindow(alloc, alloc.startDate!).startTime}:00`,
          oldEnd: `${alloc.endDate}T${allocDayWindow(alloc, alloc.endDate!).endTime}:00`,
          newStart: `${startKey}T${dailyHours[startKey].startTime}:00`,
          newEnd: `${endKey}T${dailyHours[endKey].endTime}:00`,
          dailyHours,
        };
        setCascade(true); // day-board edit with cascade already on: keep it on for the preview
        preview.stage({
          changes: [change], label: `Edit ${alloc.name}`, mode: 'edit', primaryJobId: jobId,
          commit: (eff) => onApplySchedule(eff, `Edit ${alloc.name}`),
        });
        restageShiftMove(change, cascadeUntil);
        setPendingMoveId(jobId);
        return;
      }
      // Cascade OFF: instant write, then a non-blocking clash warning if it double-books.
      const next = setAllocDayWindow(job, shiftId, dayKey, window);
      onUpdateJob(next);
      const world = jobs.map(j => (j.id === jobId ? next : j));
      const clashes = detectShiftClashes(world, workConfig);
      if (clashes.length) showToast(`Heads up: ${clashes[0].message} on ${clashes[0].dateKey}`);
      return;
    }
```

> Confirm the view's toast helper name — the view already surfaces messages (search for `showToast`/`toast` usage in this file); use whatever it already calls. If the view has no direct toast, thread the warning into the existing preview/issue surface instead. `restageShiftMove` is defined in Task 7.

- [ ] **Step 2: Typecheck + full suite**

Run: `npx tsc --noEmit` then `npx vitest run`
Expected: clean + all pass. Existing day-board tests (legacy job block, `shiftId` undefined) are untouched by the shift branch.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat(scheduling): day-board shift edit stages a cascade preview (on) or warns (off)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Full-suite verification + runtime verify + finish the branch

**Files:** none (verification only).

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all pass. This plan adds ~13 tests (4 core + 2 apply-branch + 3 detection + 3 resolver + 2 OFF-detector, minus overlaps) on top of the current baseline; no regressions, and every pre-existing `reflowAvoidingConflicts` test is unchanged.

- [ ] **Step 3: Runtime verify (verify skill)**

Announce and use the **verify** skill. Seed a scenario in `data/mockData.ts`: one member (e.g. `m1`) on two shifts the same day whose windows will overlap after a move (the John scenario), plus a downstream job sharing only one shift's member. Start the Vite dev server, drive Chromium via Playwright, and confirm:
1. **Week board, cascade ON:** drag the anchor shift so it overlaps the other shift on `m1` → the blocking shift re-places to conflict-free time; the anchor stays where dropped; Apply commits both; the job envelope covers the moved shifts.
2. **Chain:** if the re-placed shift then overlaps a third shift on a shared member, that one moves too.
3. **Cascade OFF:** the same drag applies only the moved shift and shows a **non-blocking** clash warning; Apply stays enabled.
4. **Day board, cascade ON:** drag a shift block's time so it overlaps a shared member's other shift → a preview stages and the resolver re-places the blocker; OFF → instant write + warning.
5. **Residual:** with a tight "until" cutoff, an unplaceable blocker stays put and is listed as a residual-clash warning (never silently double-booked).
Then revert the seed: `git checkout -- data/mockData.ts`.

- [ ] **Step 4: Finish the branch**

Announce and use **superpowers:finishing-a-development-branch** — verify tests, present the options, execute the user's choice.

---

## Self-Review

**Spec coverage (design §1–§6, edge cases, testing strategy):**
- §1 shared placement core extraction, behavior-preserving, reflow calls it → **Task 1** (guardrail: existing reflow tests untouched). ✅
- §2 crew-timeline model + detection (`buildMemberTimelines`, `occurrencesClash`, `clashesWith`) → **Task 3**. ✅
- §3 resolver (`resolveShiftCascade`): anchor pinned, earliest-start-first, per-shift occupied = pinned shifts' intervals for the crew, Smart/Simple + `untilDate`, visited-set termination, residual clashes → **Task 4**. ✅
- §4 multi-shift-per-job change model — fold all changes for a job on apply → **Task 5** (relies on the Phase 5 `shiftId` machinery + Task 2's window-apply). ✅
- §5 preview/triggers/OFF path: ON runs the resolver via the preview; week-board shift drag wired; day-board block drag stages ON / instant+warning OFF; OFF-path double-book warning → **Tasks 6, 7, 8**. Sidebar DAILY HOURS trigger is explicitly **out of scope (Piece A dependency)** per Global Constraints. ✅
- §6 data flow (move → primary `shiftId` change → resolve → `SET_CHANGES` → per-shift placeholders → Apply folds per job) → **Tasks 5, 7** (the boards already render per-shift placeholders from Phase 4/5; `preview.setChanges` is `SET_CHANGES`). ✅
- Extra correctness gap surfaced during planning, not explicit in the design: `applyChangeToJob`'s shift branch ignored `change.dailyHours` (needed for resolver followers and day-board edits) → **Task 2**. ✅
- Edge cases (multi-day per-day overlap, same-job overlap via member timeline, legacy/single-shift jobs, non-working days, unresolvable → residual, anchor invariance, termination) → covered by Tasks 3/4 implementation + tests; legacy fallback guaranteed by the `shiftId`-absent branches (Global Constraints). ✅

**Placeholder scan:** none — every code step shows the code; every test step shows the assertion; every run step shows the command + expected result.

**Type consistency:**
- `placeHoursConflictFree(pinnedDayHours, requiredHours, occupiedByDay, config, PlaceHoursOptions)` (Task 1) is consumed with matching arg types by `reflowAvoidingConflicts` (Task 1) and `resolveShiftCascade` (Task 4).
- `ProposedChange.shiftId?` + `dailyHours?` (existing) drive `applyChangeToJob`'s window/move branches (Task 2), the resolver's follower changes (Task 4), and the apply fold (Task 5).
- `resolveShiftCascade(jobs, anchor: ProposedChange, config, {keepExistingDaysAsIs?, untilDate?}) → {changes: ProposedChange[]; residual: ResidualClash[]}` (Task 4) matches the view's `restageShiftMove` call (Task 7).
- `ShiftRef`/`ShiftOccurrence` (Task 3) are consumed by `clashesWith`, the resolver, and `detectShiftClashes` (Tasks 3/4/6).
- `detectShiftClashes(jobs, config) → ShiftClash[]` (Task 6) matches the OFF-path call in `handleChangeDayWindow` (Task 8).
- `ResidualClash` (Task 4) is the state type in the view (Task 7).

**Sequencing:** Task 1 (core) precedes Task 4 (resolver uses it). Task 2 (window-apply) precedes Tasks 4/5/8 (their changes carry `dailyHours`). Task 3 precedes Tasks 4 and 6. Tasks 7/8 (view) come after the engine (Tasks 1–6). Task 9 verifies end-to-end.
