# Past-Day Reschedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A reschedule stops destroying the record of hours already worked: booked hours travel with a moved job, and days that have already elapsed stay where they are.

**Architecture:** Three stacked changes to pure service functions. P1 re-keys `hoursAssignments` alongside `dailyHours` in the two movers. P2 adds a `pinned?: true` flag on `JobCrewAllocation` plus a pure `splitPinnedPast` that partitions a shift at today's boundary into a frozen history shift and a moving remainder; `todayKey` is injected into `applyChangeToJob` so the engine stays date-free. P3 replaces job-level envelope day math with the union of the shifts' actually-worked days, which removes the phantom "missing hours" the split would otherwise create.

**Tech Stack:** TypeScript, React 19, Vite 6, Vitest 2 + @testing-library/react, Tailwind. All the service code here is pure — no I/O, no dates read from the clock.

**Spec:** `docs/superpowers/specs/2026-08-19-past-day-reschedule-design.md`

## Global Constraints

- **The engine reads no clock.** `services/scheduleEngine.ts:8` documents "No `Date.now()`". Never call `Date.now()`, `new Date()` with no argument, or `Math.random()` inside `services/scheduleEngine.ts` or `services/shifts.ts`. Today's date is always a `todayKey: string` parameter passed in by the caller.
- **Date keys are local `'YYYY-MM-DD'`.** Anchor any bare key at local noon before parsing — `new Date(`${key}T12:00:00`)`. A bare `new Date('2026-08-17')` parses as UTC midnight and rolls back a day in negative-offset zones. This bug is real and already commented on at `services/shifts.ts:112` and `ShiftList.tsx:31`.
- **Backwards compatibility is asserted, not assumed.** An allocation with no `pinned`, and an `applyChangeToJob` call with no `todayKey`, must behave *exactly* as they do today. Every task that touches shared code adds a test proving it.
- **Run tests with** `npx vitest run <path>`. Typecheck with `npx tsc --noEmit`. Both must pass before any commit.
- **New user-facing strings are localised.** Add the key to *both* `enManual` and `esManual` in `i18n/catalog.ts` (~line 10 and ~line 248). `i18n/translate.test.ts` has a `catalog integrity` suite that fails the build if a key exists in English but not Spanish. Key convention: `<area>.<Component>.<descriptor>`.
- **Do not migrate unrelated strings.** `ShiftList.tsx` currently uses hardcoded English ("Edit", "Unassigned"). Leave those alone; only the new string is localised.

---

## File Structure

**Modified:**
- `types.ts` — one field on `JobCrewAllocation` (~line 476) and one on `ProposedChange` (~line 48)
- `services/scheduleEngine.ts` — re-key hours in `applyChangeToJob` (:377), inject `todayKey`, add `jobWorkedDayKeys`, new `'all-past'` `SkipReason` (:35), repoint `scheduledWindowHours` (:181)
- `services/shifts.ts` — re-key hours in `moveAllocation` (:102), add `splitPinnedPast`
- `services/crewHoursGrid.ts` — repoint 5 job-level envelope call sites (:83, :180, :199, :255, :275)
- `App.tsx:204` — supply `todayKey` at the single commit funnel
- `components/views/JobScheduling/ShiftList.tsx` — render a pinned shift as read-only history
- `i18n/catalog.ts` — two new keys, en + es

**Test files (all exist; extend, don't create):**
- `services/scheduleEngine.test.ts`, `services/shifts.test.ts`, `services/crewHoursGrid.test.ts`

No new files. Every change lands in the module that already owns the concept.

---

## Task 1: Re-key `hoursAssignments` in `applyChangeToJob` (P1)

The live data loss. A moved job's booked hours currently read 0 on both the old and the new dates.

**Files:**
- Modify: `services/scheduleEngine.ts:377-450` (`applyChangeToJob`, all three branches)
- Test: `services/scheduleEngine.test.ts`

**Interfaces:**
- Consumes: nothing — first task.
- Produces: no signature change. `applyChangeToJob(job, change)` keeps its exact current shape; only the returned allocations gain correctly-keyed `hoursAssignments`.

**Background you need:** `applyChangeToJob` has three branches. Each already defines a local `rekey(k: string): string` closure that shifts a date key by the change's calendar delta. Two branches (`:397` named-shift, `:429` job-level) define `rekey`; the first branch (`:381`, explicit windows) does not — it sets the span directly from `change.dailyHours`, so you must derive a delta there. `hoursAssignments` is `Record<memberId, Record<dateKey, hours>>` — a *nested* map, so re-keying means mapping the inner object of every member.

- [ ] **Step 1: Write the failing test**

Add to `services/scheduleEngine.test.ts`:

```ts
describe('applyChangeToJob — booked hours travel with the job', () => {
  // A 3-day job, one member booked 8h on each day, granular (hoursAssignments set).
  const granularJob = (): Job => ({
    id: 'j1', jobNumber: 'J-1', name: 'Deck', clientId: 'c1', estimateId: 'e1',
    address: 'x', stage: 'Scheduled', dateCreated: '2026-01-01',
    startDate: '2026-08-17T08:00:00', endDate: '2026-08-19T17:00:00',
    crewMemberIds: ['m1'],
    allocations: [{
      id: 'a1', name: 'Crew', memberIds: ['m1'],
      startDate: '2026-08-17', endDate: '2026-08-19',
      startTime: '08:00', endTime: '17:00',
      hoursAssignments: { m1: { '2026-08-17': 8, '2026-08-18': 8, '2026-08-19': 8 } },
    }],
  } as Job);

  const change = (over: Partial<ProposedChange> = {}): ProposedChange => ({
    jobId: 'j1', jobName: 'Deck', jobNumber: 'J-1',
    oldStart: '2026-08-17T08:00:00', oldEnd: '2026-08-19T17:00:00',
    newStart: '2026-08-24T08:00:00', newEnd: '2026-08-26T17:00:00',
    ...over,
  });

  it('re-keys hours by the delta on a job-level move', () => {
    const out = applyChangeToJob(granularJob(), change());
    expect(out.allocations![0].hoursAssignments).toEqual({
      m1: { '2026-08-24': 8, '2026-08-25': 8, '2026-08-26': 8 },
    });
  });

  it('re-keys hours on a shift-scoped move', () => {
    const out = applyChangeToJob(granularJob(), change({ shiftId: 'a1' }));
    expect(out.allocations![0].hoursAssignments).toEqual({
      m1: { '2026-08-24': 8, '2026-08-25': 8, '2026-08-26': 8 },
    });
  });

  it('re-keys hours on a shift move carrying explicit per-day windows', () => {
    const out = applyChangeToJob(granularJob(), change({
      shiftId: 'a1',
      dailyHours: {
        '2026-08-24': { startTime: '08:00', endTime: '17:00' },
        '2026-08-25': { startTime: '08:00', endTime: '17:00' },
        '2026-08-26': { startTime: '08:00', endTime: '17:00' },
      },
    }));
    expect(out.allocations![0].hoursAssignments).toEqual({
      m1: { '2026-08-24': 8, '2026-08-25': 8, '2026-08-26': 8 },
    });
  });

  it('re-keys every member independently', () => {
    const base = granularJob();
    base.allocations![0].memberIds = ['m1', 'm2'];
    base.allocations![0].hoursAssignments = {
      m1: { '2026-08-17': 8 },
      m2: { '2026-08-18': 4, '2026-08-19': 4 },
    };
    const out = applyChangeToJob(base, change());
    expect(out.allocations![0].hoursAssignments).toEqual({
      m1: { '2026-08-24': 8 },
      m2: { '2026-08-25': 4, '2026-08-26': 4 },
    });
  });

  it('leaves a job with no granular hours untouched', () => {
    const base = granularJob();
    delete base.allocations![0].hoursAssignments;
    const out = applyChangeToJob(base, change());
    expect(out.allocations![0].hoursAssignments).toBeUndefined();
    expect(out.allocations![0].startDate).toBe('2026-08-24');
  });
});
```

If `Job` / `ProposedChange` are not already imported in this test file, add them to the existing import lines.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/scheduleEngine.test.ts -t "booked hours travel"`

Expected: the four re-keying tests FAIL, each showing `hoursAssignments` still keyed `2026-08-17/18/19`. The "no granular hours" test PASSES already — that is correct, it is the regression guard.

- [ ] **Step 3: Add a shared re-key helper**

In `services/scheduleEngine.ts`, immediately above `applyChangeToJob` (before line 377):

```ts
/** Re-key a shift's per-member day hours through `rekey`. `hoursAssignments` is a nested
 *  Record<memberId, Record<dateKey, hours>>, so both levels are rebuilt. Returns a spreadable
 *  fragment: `{}` when the shift has no granular hours, so the field stays absent. */
const rekeyHoursAssignments = (
  alloc: JobCrewAllocation,
  rekey: (k: string) => string,
): Pick<JobCrewAllocation, 'hoursAssignments'> | Record<string, never> =>
  alloc.hoursAssignments
    ? {
        hoursAssignments: Object.fromEntries(
          Object.entries(alloc.hoursAssignments).map(([memberId, days]) => [
            memberId,
            Object.fromEntries(Object.entries(days).map(([k, h]) => [rekey(k), h])),
          ]),
        ),
      }
    : {};
```

- [ ] **Step 4: Call it from the named-shift branch**

In the named-shift branch (~`:411`), add the fragment beside the existing `dailyHours` spread:

```ts
      return {
        ...a,
        startDate: newStartKey,
        endDate: a.endDate ? rekey(a.endDate) : newStartKey,
        ...(a.dailyHours ? { dailyHours: Object.fromEntries(Object.entries(a.dailyHours).map(([k, w]) => [rekey(k), w])) } : {}),
        ...rekeyHoursAssignments(a, rekey),
      };
```

- [ ] **Step 5: Call it from the job-level branch**

In the job-level branch (~`:434`), same addition:

```ts
    const moved = (job.allocations ?? []).map(a => !a.startDate ? a : ({
      ...a,
      startDate: rekey(a.startDate),
      endDate: a.endDate ? rekey(a.endDate) : rekey(a.startDate),
      ...(a.dailyHours ? { dailyHours: Object.fromEntries(Object.entries(a.dailyHours).map(([k, w]) => [rekey(k), w])) } : {}),
      ...rekeyHoursAssignments(a, rekey),
    }));
```

- [ ] **Step 6: Give the explicit-windows branch a delta and call it**

The explicit-windows branch (`:381`) has no `rekey` because it sets the span from `change.dailyHours` directly. Derive one from the new first day against the allocation's own previous start. Replace the branch's `allocations` mapping:

```ts
      const keys = Object.keys(windows).sort();
      const start = keys[0];
      const end = keys[keys.length - 1];
      const allocations = (job.allocations ?? []).map(a => {
        if (a.id !== change.shiftId) return a;
        // The windows replace the span outright; hours re-key by the same first-day delta.
        const delta = a.startDate
          ? Math.round(
              (new Date(`${start}T12:00:00`).getTime() - new Date(`${a.startDate}T12:00:00`).getTime()) / 86_400_000,
            )
          : 0;
        const rekey = (k: string): string => {
          const d = new Date(`${k}T12:00:00`);
          d.setDate(d.getDate() + delta);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        return {
          ...a,
          startDate: start,
          endDate: end,
          startTime: windows[start].startTime,
          endTime: windows[end].endTime,
          dailyHours: { ...windows },
          ...rekeyHoursAssignments(a, rekey),
        };
      });
      return recomputeJobEnvelope({ ...job, allocations });
```

- [ ] **Step 7: Run the new tests, then the whole suite**

Run: `npx vitest run services/scheduleEngine.test.ts`
Expected: PASS, including all pre-existing tests in the file.

Run: `npx vitest run && npx tsc --noEmit`
Expected: all suites pass, no type errors. Pay attention to `services/shiftCascade.test.ts` and `services/reschedulePreview.test.ts` — they exercise `applyChangeToJob` hardest.

- [ ] **Step 8: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "fix(scheduling): booked hours travel with a moved job

applyChangeToJob re-keyed dailyHours but not hoursAssignments, so a moved
job's per-member day hours stayed on the old dates. memberShiftDayHours
then read 0 on the old days (the shift no longer covers them) AND 0 on
the new days: its 'if (map)' gate skips the shift-window fallback because
the map is non-empty, just wrongly keyed. Since the app has no timesheet,
those entries were the only record the work happened.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Re-key `hoursAssignments` in `moveAllocation` (P1)

The same defect in the other mover. Separate task because it is a separate module with its own test file and could be reviewed independently.

**Files:**
- Modify: `services/shifts.ts:102-119` (`moveAllocation`)
- Test: `services/shifts.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 — `moveAllocation` has its own `addDaysToKey` helper and does not import the private `rekeyHoursAssignments`.
- Produces: no signature change. `moveAllocation(job, shiftId, newStartKey)` unchanged.

- [ ] **Step 1: Write the failing test**

Add to `services/shifts.test.ts` (the file already defines `job()` and `shift()` factories at the top — reuse them):

```ts
describe('moveAllocation — granular hours move with the shift', () => {
  it('re-keys hoursAssignments by the same delta as the span', () => {
    const base = job({
      allocations: [shift({
        startDate: '2026-06-08', endDate: '2026-06-09',
        hoursAssignments: { m1: { '2026-06-08': 4, '2026-06-09': 4 } },
      })],
    });
    const out = moveAllocation(base, 'prep', '2026-06-15');
    const a = out.allocations![0];
    expect(a.startDate).toBe('2026-06-15');
    expect(a.endDate).toBe('2026-06-16');
    expect(a.hoursAssignments).toEqual({ m1: { '2026-06-15': 4, '2026-06-16': 4 } });
  });

  it('re-keys every member independently', () => {
    const base = job({
      allocations: [shift({
        startDate: '2026-06-08', endDate: '2026-06-09', memberIds: ['m1', 'm2'],
        hoursAssignments: { m1: { '2026-06-08': 4 }, m2: { '2026-06-09': 8 } },
      })],
    });
    const out = moveAllocation(base, 'prep', '2026-06-15');
    expect(out.allocations![0].hoursAssignments).toEqual({
      m1: { '2026-06-15': 4 }, m2: { '2026-06-16': 8 },
    });
  });

  it('leaves a shift with no granular hours untouched', () => {
    const out = moveAllocation(job({ allocations: [shift()] }), 'prep', '2026-06-15');
    expect(out.allocations![0].hoursAssignments).toBeUndefined();
    expect(out.allocations![0].startDate).toBe('2026-06-15');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/shifts.test.ts -t "granular hours move"`
Expected: the first two FAIL with `hoursAssignments` still on `2026-06-08/09`. The third PASSES (regression guard).

- [ ] **Step 3: Implement**

In `services/shifts.ts:102`, inside `moveAllocation`'s patch callback, beside the existing `dailyHours` and `skipDays` re-keys:

```ts
    const hoursAssignments = a.hoursAssignments
      ? Object.fromEntries(
          Object.entries(a.hoursAssignments).map(([memberId, days]) => [
            memberId,
            Object.fromEntries(Object.entries(days).map(([k, h]) => [addDaysToKey(k, delta), h])),
          ]),
        )
      : a.hoursAssignments;
```

and add it to the returned object beside the others:

```ts
      ...(hoursAssignments ? { hoursAssignments } : {}),
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run services/shifts.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add services/shifts.ts services/shifts.test.ts
git commit -m "fix(scheduling): moveAllocation re-keys granular hours too

Same defect as applyChangeToJob: the span, dailyHours and skipDays moved
but hoursAssignments stayed on the old dates.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: The `pinned` flag and `splitPinnedPast` (P2)

The split itself, as a pure function with no callers yet. Landing it alone keeps the risky arithmetic under test before anything depends on it.

**Files:**
- Modify: `types.ts` (~line 476, after `skipDays` on `JobCrewAllocation`)
- Modify: `services/shifts.ts` (add `splitPinnedPast` after `moveAllocation`)
- Test: `services/shifts.test.ts`

**Interfaces:**
- Consumes: `allocWorkedDayKeys(alloc, nonWorkingWeekdays): string[]` from `services/scheduleEngine.ts:213` — a shift's actually-worked day keys (span, less non-working weekdays, less `skipDays`). Already imported into `shifts.ts`? No — `shifts.ts` currently imports only `recomputeJobEnvelope`. Add `allocWorkedDayKeys` to that import.
- Produces, relied on by Tasks 4 and 5:
  ```ts
  splitPinnedPast(
    alloc: JobCrewAllocation,
    todayKey: string,
    nonWorkingWeekdays: number[],
  ): { pinned?: JobCrewAllocation; moving?: JobCrewAllocation }
  ```
  Exactly one of the two properties may be absent. `pinned` is present when at least one worked day is `< todayKey`; `moving` is present when at least one worked day is `>= todayKey`. Both present = a real split. `pinned.pinned === true` always.

**Design notes for the implementer:**
- The pinned clone's id must be **deterministic** — no `Math.random()`/`Date.now()` in this module. Use `` `${alloc.id}-worked` ``.
- Hours are **partitioned, never duplicated**: each date key of `dailyHours` / `hoursAssignments` / `skipDays` lands in exactly one of the two shifts.
- Compare date keys with plain string `<` / `>=`. `'YYYY-MM-DD'` sorts lexicographically the same as chronologically, which is why the rest of this codebase does the same (e.g. `allocCoversDay` at `scheduleEngine.ts:204`).

- [ ] **Step 1: Add the model field**

In `types.ts`, on `JobCrewAllocation` immediately after the `skipDays` field (~line 476):

```ts
  /** This shift is history: its days have elapsed and were worked. Never moved, never
   *  re-keyed, read-only in the editor. Set once when a reschedule splits a shift at
   *  today's boundary; never recomputed against the calendar afterwards. */
  pinned?: true;
```

- [ ] **Step 2: Write the failing test**

Add to `services/shifts.test.ts`. Import `splitPinnedPast` on the existing import line.

```ts
describe('splitPinnedPast', () => {
  // Mon 2026-08-17 … Wed 2026-08-19, 8h/day for m1. Weekends off.
  const WEEKENDS = [0, 6];
  const threeDay = (over: Partial<JobCrewAllocation> = {}): JobCrewAllocation => shift({
    id: 'a1', name: 'Crew', memberIds: ['m1'],
    startDate: '2026-08-17', endDate: '2026-08-19', startTime: '08:00', endTime: '17:00',
    hoursAssignments: { m1: { '2026-08-17': 8, '2026-08-18': 8, '2026-08-19': 8 } },
    ...over,
  });

  it('does not split when no day has elapsed', () => {
    const out = splitPinnedPast(threeDay(), '2026-08-17', WEEKENDS);
    expect(out.pinned).toBeUndefined();
    expect(out.moving).toEqual(threeDay());
  });

  it('pins the whole shift when every day has elapsed', () => {
    const out = splitPinnedPast(threeDay(), '2026-08-20', WEEKENDS);
    expect(out.moving).toBeUndefined();
    expect(out.pinned!.pinned).toBe(true);
    expect(out.pinned!.id).toBe('a1'); // nothing to split from, so it keeps its identity
    expect(out.pinned!.hoursAssignments).toEqual({
      m1: { '2026-08-17': 8, '2026-08-18': 8, '2026-08-19': 8 },
    });
  });

  it('splits into a frozen past shift and a moving remainder', () => {
    const out = splitPinnedPast(threeDay(), '2026-08-19', WEEKENDS);

    expect(out.pinned!.id).toBe('a1-worked');
    expect(out.pinned!.pinned).toBe(true);
    expect(out.pinned!.memberIds).toEqual(['m1']);
    expect(out.pinned!.startDate).toBe('2026-08-17');
    expect(out.pinned!.endDate).toBe('2026-08-18');
    expect(out.pinned!.hoursAssignments).toEqual({ m1: { '2026-08-17': 8, '2026-08-18': 8 } });

    expect(out.moving!.id).toBe('a1'); // the live shift keeps the original id
    expect(out.moving!.pinned).toBeUndefined();
    expect(out.moving!.startDate).toBe('2026-08-19');
    expect(out.moving!.endDate).toBe('2026-08-19');
    expect(out.moving!.hoursAssignments).toEqual({ m1: { '2026-08-19': 8 } });
  });

  it('partitions hours without duplicating or losing any', () => {
    const out = splitPinnedPast(threeDay(), '2026-08-19', WEEKENDS);
    const sum = (a?: JobCrewAllocation) =>
      Object.values(a?.hoursAssignments?.m1 ?? {}).reduce((s, h) => s + h, 0);
    expect(sum(out.pinned) + sum(out.moving)).toBe(24);
  });

  it('partitions per-day windows and skip days by the same boundary', () => {
    const out = splitPinnedPast(threeDay({
      startDate: '2026-08-17', endDate: '2026-08-21',
      skipDays: ['2026-08-18', '2026-08-20'],
      dailyHours: {
        '2026-08-17': { startTime: '08:00', endTime: '12:00' },
        '2026-08-21': { startTime: '13:00', endTime: '17:00' },
      },
    }), '2026-08-19', WEEKENDS);

    expect(out.pinned!.dailyHours).toEqual({ '2026-08-17': { startTime: '08:00', endTime: '12:00' } });
    expect(out.pinned!.skipDays).toEqual(['2026-08-18']);
    expect(out.moving!.dailyHours).toEqual({ '2026-08-21': { startTime: '13:00', endTime: '17:00' } });
    expect(out.moving!.skipDays).toEqual(['2026-08-20']);
  });

  it('ignores skipped days when deciding what has elapsed', () => {
    // Mon 17 is skipped, so the earliest WORKED day is Tue 18. With today = Tue 18,
    // nothing has actually been worked yet, so there is nothing to pin.
    const out = splitPinnedPast(threeDay({ skipDays: ['2026-08-17'] }), '2026-08-18', WEEKENDS);
    expect(out.pinned).toBeUndefined();
    expect(out.moving!.startDate).toBe('2026-08-18'); // normalizeAlloc trims the leading skip
  });

  it('treats an undated shift as nothing to split', () => {
    const out = splitPinnedPast(
      shift({ startDate: '', endDate: '' }) as JobCrewAllocation, '2026-08-19', WEEKENDS,
    );
    expect(out.pinned).toBeUndefined();
    expect(out.moving).toBeDefined();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run services/shifts.test.ts -t "splitPinnedPast"`
Expected: FAIL — `splitPinnedPast is not a function` (or a TS import error).

- [ ] **Step 4: Implement**

In `services/shifts.ts`, after `moveAllocation`. Update the top import to
`import { recomputeJobEnvelope, allocWorkedDayKeys } from './scheduleEngine';`

```ts
/** Split a shift at today's boundary into the history it has already worked and the
 *  remainder still to come.
 *
 *  Elapsed days are history: they keep their hours and windows rather than sliding with a
 *  reschedule, because with no timesheet in the model `hoursAssignments` on an elapsed day is
 *  the ONLY record that the work happened. Moving it destroys that record, frees the member's
 *  capacity, and invites the completed work to be booked again.
 *
 *  The boundary is strictly before `todayKey`: today itself stays movable, because rain
 *  arriving at 9am and the day's work being pushed out is the commonest reschedule there is.
 *
 *  Skipped days never count as worked — the decision is made on `allocWorkedDayKeys`, not the
 *  raw span. Returns `{ moving }` alone when nothing has elapsed, `{ pinned }` alone when
 *  everything has, and both when it genuinely splits. Hours are partitioned: every date key
 *  lands in exactly one side. */
export const splitPinnedPast = (
  alloc: JobCrewAllocation,
  todayKey: string,
  nonWorkingWeekdays: number[],
): { pinned?: JobCrewAllocation; moving?: JobCrewAllocation } => {
  const worked = allocWorkedDayKeys(alloc, nonWorkingWeekdays);
  const past = worked.filter(k => k < todayKey);
  const future = worked.filter(k => k >= todayKey);

  if (!past.length) return { moving: alloc };
  if (!future.length) return { pinned: { ...alloc, pinned: true } };

  // Keep only the date-keyed entries on one side of the boundary. Absent stays absent so a
  // shift that never had windows/hours does not grow empty maps.
  const sliceDays = <T,>(
    map: Record<string, T> | undefined, keep: (k: string) => boolean,
  ): Record<string, T> | undefined => {
    if (!map) return undefined;
    return Object.fromEntries(Object.entries(map).filter(([k]) => keep(k)));
  };
  const sliceHours = (
    ha: JobCrewAllocation['hoursAssignments'], keep: (k: string) => boolean,
  ): JobCrewAllocation['hoursAssignments'] => {
    if (!ha) return undefined;
    return Object.fromEntries(
      Object.entries(ha).map(([memberId, days]) => [memberId, sliceDays(days, keep)!]),
    );
  };

  const isPast = (k: string) => k < todayKey;
  const isFuture = (k: string) => k >= todayKey;

  const pinned = normalizeAlloc({
    ...alloc,
    id: `${alloc.id}-worked`,
    pinned: true,
    startDate: past[0],
    endDate: past[past.length - 1],
    ...(alloc.dailyHours ? { dailyHours: sliceDays(alloc.dailyHours, isPast)! } : {}),
    ...(alloc.skipDays ? { skipDays: alloc.skipDays.filter(isPast) } : {}),
    ...(alloc.hoursAssignments ? { hoursAssignments: sliceHours(alloc.hoursAssignments, isPast)! } : {}),
  });

  const moving = normalizeAlloc({
    ...alloc,
    startDate: future[0],
    endDate: alloc.endDate,
    ...(alloc.dailyHours ? { dailyHours: sliceDays(alloc.dailyHours, isFuture)! } : {}),
    ...(alloc.skipDays ? { skipDays: alloc.skipDays.filter(isFuture) } : {}),
    ...(alloc.hoursAssignments ? { hoursAssignments: sliceHours(alloc.hoursAssignments, isFuture)! } : {}),
  });

  return { pinned, moving };
};
```

`normalizeAlloc` is already defined in this file at `:85` and is not exported-only — call it directly.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run services/shifts.test.ts && npx tsc --noEmit`
Expected: PASS. If the "ignores skipped days" case fails on `moving.startDate`, check that you passed `future[0]` (the first *worked* future day) and not `todayKey`.

- [ ] **Step 6: Commit**

```bash
git add types.ts services/shifts.ts services/shifts.test.ts
git commit -m "feat(scheduling): splitPinnedPast partitions a shift at today

Elapsed days are history. With no timesheet in the model, hoursAssignments
on an elapsed day is the only record the work happened, so a reschedule
must not slide it. The boundary is strictly before today: today itself
stays movable, since a rain day pushed out at 9am is the commonest
reschedule there is.

Skipped days never count as worked. Hours are partitioned, never
duplicated. No callers yet.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Wire the split into `applyChangeToJob` (P2)

**Files:**
- Modify: `types.ts` (`SkipReason` ~line 35, `ProposedChange` ~line 48)
- Modify: `services/scheduleEngine.ts:377` (`applyChangeToJob` signature + all three branches)
- Modify: `App.tsx:204`
- Test: `services/scheduleEngine.test.ts`

**Interfaces:**
- Consumes: `splitPinnedPast(alloc, todayKey, nonWorkingWeekdays)` from Task 3.
- Produces:
  ```ts
  applyChangeToJob(job: Job, change: ProposedChange, opts?: { todayKey?: string; nonWorkingWeekdays?: number[] }): Job
  ```
  Omitting `opts` — or omitting `todayKey` within it — means no pinning and byte-identical behaviour to Tasks 1–2.

**⚠ The one place this goes wrong.** Today's code derives the delta from `job.startDate` / `alloc.startDate`. After a split that day is pinned history, so reusing it misplaces the remainder. Job Aug 17–19, today Aug 19, admin moves it to Aug 24: the delta from Aug 17 is 7 days, landing Wednesday's work on **Aug 26** — not the Aug 24 that was asked for. **Split first, then measure the delta from the first surviving day.** When nothing is pinned, the first surviving day *is* the old start, so this reduces to today's arithmetic exactly.

`shifts.ts` already imports from `scheduleEngine.ts`, so importing `splitPinnedPast` back into `scheduleEngine.ts` would create a cycle. Note the existing comment at `scheduleEngine.ts:395` — the codebase already re-keys inline "to avoid a shifts.ts <-> scheduleEngine.ts import cycle." **So `applyChangeToJob` must not import from `shifts.ts`.** Instead, add the `opts` parameter and have the *caller* (`App.tsx`) do the splitting. Concretely: `applyChangeToJob` gains the `opts`, and a new exported wrapper in `shifts.ts` composes them.

- [ ] **Step 1: Add the model fields**

`types.ts`, extend `SkipReason` (~line 35):

```ts
export type SkipReason = 'locked' | 'unscheduled' | 'before-point' | 'out-of-scope' | 'after-limit' | 'all-past';
```

and add to `ProposedChange` (~line 48, after `dailyHours`):

```ts
  /** Elapsed days this change will keep as worked rather than move. Descriptive only —
   *  the commit recomputes the split from splitPinnedPast. */
  pinnedDays?: string[];
```

- [ ] **Step 2: Write the failing test**

Add to `services/scheduleEngine.test.ts`, reusing the `granularJob()` / `change()` factories from Task 1 (hoist them to the file's top-level `describe` scope if they are nested):

```ts
describe('applyChangeToJobPinningPast — elapsed days stay put', () => {
  const WEEKENDS = [0, 6];

  it('keeps elapsed days and lands the remainder exactly on newStart', () => {
    // Job Mon 17 - Wed 19, today is Wed 19, pushed to Mon 24.
    // Mon/Tue are history; Wednesday's 8h must land on Aug 24 — NOT Aug 26.
    const out = applyChangeToJobPinningPast(
      granularJob(), change(), { todayKey: '2026-08-19', nonWorkingWeekdays: WEEKENDS },
    );

    const pinned = out.allocations!.find(a => a.pinned)!;
    const moving = out.allocations!.find(a => !a.pinned)!;

    expect(pinned.startDate).toBe('2026-08-17');
    expect(pinned.endDate).toBe('2026-08-18');
    expect(pinned.hoursAssignments).toEqual({ m1: { '2026-08-17': 8, '2026-08-18': 8 } });

    expect(moving.startDate).toBe('2026-08-24');
    expect(moving.hoursAssignments).toEqual({ m1: { '2026-08-24': 8 } });
  });

  it('is a no-op with no todayKey, matching the unpinned behaviour exactly', () => {
    const withOpts = applyChangeToJobPinningPast(granularJob(), change(), { nonWorkingWeekdays: WEEKENDS });
    const without = applyChangeToJob(granularJob(), change());
    expect(withOpts).toEqual(without);
    expect(withOpts.allocations!.some(a => a.pinned)).toBe(false);
  });

  it('leaves an already-pinned shift alone on a second reschedule', () => {
    const once = applyChangeToJobPinningPast(
      granularJob(), change(), { todayKey: '2026-08-19', nonWorkingWeekdays: WEEKENDS },
    );
    const twice = applyChangeToJobPinningPast(
      once,
      change({ oldStart: '2026-08-24T08:00:00', newStart: '2026-08-31T08:00:00', newEnd: '2026-08-31T17:00:00' }),
      { todayKey: '2026-08-19', nonWorkingWeekdays: WEEKENDS },
    );
    const pinned = twice.allocations!.filter(a => a.pinned);
    expect(pinned).toHaveLength(1);
    expect(pinned[0].hoursAssignments).toEqual({ m1: { '2026-08-17': 8, '2026-08-18': 8 } });
    expect(twice.allocations!.find(a => !a.pinned)!.startDate).toBe('2026-08-31');
  });

  it('does not split a job whose every day is still ahead', () => {
    const out = applyChangeToJobPinningPast(
      granularJob(), change(), { todayKey: '2026-08-17', nonWorkingWeekdays: WEEKENDS },
    );
    expect(out.allocations).toHaveLength(1);
    expect(out.allocations![0].pinned).toBeUndefined();
    expect(out.allocations![0].startDate).toBe('2026-08-24');
  });

  it('spans the job envelope across both the pinned and the moved shift', () => {
    const out = applyChangeToJobPinningPast(
      granularJob(), change(), { todayKey: '2026-08-19', nonWorkingWeekdays: WEEKENDS },
    );
    expect(out.startDate!.startsWith('2026-08-17')).toBe(true);
    expect(out.endDate!.startsWith('2026-08-24')).toBe(true);
  });
});
```

Import `applyChangeToJobPinningPast` from `./shifts` in this test file.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run services/scheduleEngine.test.ts -t "elapsed days stay put"`
Expected: FAIL — `applyChangeToJobPinningPast is not a function`.

- [ ] **Step 4: Add the `opts` parameter to `applyChangeToJob`**

In `services/scheduleEngine.ts:377`, change the signature and the two delta computations so the delta is measured from a caller-supplied origin rather than always the old start:

```ts
export const applyChangeToJob = (
  job: Job,
  change: ProposedChange,
  opts: { deltaFromKey?: string } = {},
): Job => {
```

In the named-shift branch, replace the delta's origin:

```ts
      const originKey = opts.deltaFromKey ?? a.startDate;
      const delta = Math.round(
        (new Date(`${newStartKey}T12:00:00`).getTime() - new Date(`${originKey}T12:00:00`).getTime()) / 86_400_000,
      );
```

In the job-level branch, likewise:

```ts
    const originKey = opts.deltaFromKey ?? toLocalDateKey(new Date(job.startDate));
    const delta = Math.round(
      (new Date(`${toLocalDateKey(new Date(change.newStart))}T12:00:00`).getTime()
        - new Date(`${originKey}T12:00:00`).getTime()) / 86_400_000,
    );
```

With `deltaFromKey` omitted this is exactly today's arithmetic, so Tasks 1–2 stay green.

- [ ] **Step 5: Add the composing wrapper in `shifts.ts`**

`splitPinnedPast` lives in `shifts.ts`, which already imports from `scheduleEngine.ts`; putting the wrapper here keeps the dependency one-way and avoids the cycle called out at `scheduleEngine.ts:395`. Add after `splitPinnedPast`:

```ts
/** Commit a change, keeping any elapsed days as history.
 *
 *  Splits every unpinned shift at `todayKey` first, then moves only the remainders — and
 *  measures the move's delta from the first SURVIVING day rather than the old start. That
 *  distinction is the whole point: a job running Mon-Wed that is pushed to the following Monday
 *  must land Wednesday's work on that Monday, not a further two days out because the delta was
 *  measured from a Monday that is now frozen history.
 *
 *  Without `todayKey` this is plain `applyChangeToJob`, so existing callers are unaffected. */
export const applyChangeToJobPinningPast = (
  job: Job,
  change: ProposedChange,
  opts: { todayKey?: string; nonWorkingWeekdays?: number[] } = {},
): Job => {
  const { todayKey, nonWorkingWeekdays = [] } = opts;
  if (!todayKey || !job.allocations?.length) return applyChangeToJob(job, change);

  const target = change.shiftId
    ? job.allocations.filter(a => a.id === change.shiftId)
    : job.allocations;
  const splits = target
    .filter(a => !a.pinned)
    .map(a => ({ id: a.id, ...splitPinnedPast(a, todayKey, nonWorkingWeekdays) }));

  const pinnedShifts = splits.map(s => s.pinned).filter((a): a is JobCrewAllocation => !!a);
  const movingShifts = splits.map(s => s.moving).filter((a): a is JobCrewAllocation => !!a);

  // Everything this change would touch has already elapsed — there is nothing left to move.
  if (!movingShifts.length) return job;
  if (!pinnedShifts.length) return applyChangeToJob(job, change);

  // The surviving remainder's earliest day becomes the delta origin.
  const deltaFromKey = movingShifts
    .map(a => a.startDate)
    .filter(Boolean)
    .sort()[0];

  const untouched = job.allocations.filter(
    a => a.pinned || !splits.some(s => s.id === a.id),
  );
  const staged: Job = { ...job, allocations: [...untouched, ...pinnedShifts, ...movingShifts] };

  return applyChangeToJob(staged, change, { deltaFromKey });
};
```

`applyChangeToJob`'s own branches already skip nothing by id for job-level changes, so add one guard there: in the job-level branch's `moved` mapping, return `a` unchanged when `a.pinned` is set.

```ts
    const moved = (job.allocations ?? []).map(a => (!a.startDate || a.pinned) ? a : ({
```

Do the same in the named-shift branch's mapping:

```ts
      if (a.id !== change.shiftId || !a.startDate || a.pinned) return a;
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run services/scheduleEngine.test.ts services/shifts.test.ts && npx tsc --noEmit`
Expected: PASS, including every Task 1–3 test.

- [ ] **Step 7: Wire the commit funnel**

`App.tsx:204` is the single funnel for every reschedule.

`App.tsx:53` currently reads
`import { ProposedChange, applyChangeToJob, configFromSettings } from './services/scheduleEngine';`.
There is **no `workConfig` in scope** in this file (the pattern at `App.tsx:143` derives what it
needs on the spot: `configFromSettings(settings.scheduling, false).weekendDays`), and
`toLocalDateKey` is **not imported**. So make both imports explicit:

```ts
import { ProposedChange, configFromSettings, toLocalDateKey } from './services/scheduleEngine';
import { applyChangeToJobPinningPast } from './services/shifts';
```

`applyChangeToJob` is no longer referenced in `App.tsx` after this change — drop it from the
import rather than leaving it unused.

```ts
  // Apply a batch of schedule changes in a single immutable pass.
  const applyScheduleChanges = (changes: ProposedChange[]) => {
    // Today's date enters the scheduling code ONLY here. The engine is pure by design
    // (scheduleEngine.ts:8), so the boundary between history and the future is injected.
    const todayKey = toLocalDateKey(new Date());
    const nonWorkingWeekdays = configFromSettings(settings.scheduling, false).weekendDays;
    setJobs(prev => prev.map(j => {
      const forJob = changes.filter(ch => ch.jobId === j.id && !ch.skipped);
      if (forJob.length === 0) return j;
      // Apply every change for this job in turn (multi-shift cascade); each shift edit
      // recomputes the envelope, so folding preserves earlier moves.
      return forJob.reduce(
        (acc, ch) => applyChangeToJobPinningPast(acc, ch, { todayKey, nonWorkingWeekdays }),
        j,
      );
    }));
  };
```

- [ ] **Step 8: Run the whole suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all suites pass, no type errors.

- [ ] **Step 9: Commit**

```bash
git add types.ts services/scheduleEngine.ts services/shifts.ts services/scheduleEngine.test.ts App.tsx
git commit -m "feat(scheduling): a reschedule keeps the days already worked

Elapsed shifts are split off and frozen; only the remainder moves. The
delta is measured from the first SURVIVING day, not the old start: a job
running Mon-Wed pushed to the next Monday must land Wednesday's work on
that Monday, not two days further out because the origin was a Monday
that is now history.

Today's date enters the scheduling code at exactly one point, App.tsx's
commit funnel. The engine stays pure; without todayKey this is plain
applyChangeToJob.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: `jobWorkedDayKeys` — job day math from the shifts (P3)

Without this, P2 defeats its own purpose. `requiredHoursForWeek` (`crewHoursGrid.ts:75`) pro-rates by day count over the **envelope**: `required = estimate * inWeek / total`. A 3-day 24h job pinned Mon/Tue with Wednesday pushed to Aug 24 spans Aug 17→24 — six working days, not three — so the week of Aug 17 asks for `24 × 5/6 = 20h` against 16h assigned and falsely reports *"4h missing"*. That phantom number is exactly the prompt that causes completed work to be re-booked.

**Files:**
- Modify: `services/scheduleEngine.ts` (add `jobWorkedDayKeys` after `allocWorkedDayKeys` at `:221`; repoint `scheduledWindowHours` at `:181`)
- Modify: `services/crewHoursGrid.ts:83, 180, 199, 255, 275`
- Test: `services/scheduleEngine.test.ts`, `services/crewHoursGrid.test.ts`

**Interfaces:**
- Consumes: `allocWorkedDayKeys` (`scheduleEngine.ts:213`), `workingDayKeys` (`:119`).
- Produces:
  ```ts
  jobWorkedDayKeys(job: Job, nonWorkingWeekdays: number[]): string[]
  ```
  Sorted, de-duplicated. Falls back to `workingDayKeys(job.startDate, job.endDate, nonWorkingWeekdays)` when the job has no dated allocations (legacy jobs), and returns `[]` for an unscheduled job.

- [ ] **Step 1: Write the failing test**

Add to `services/scheduleEngine.test.ts`:

```ts
describe('jobWorkedDayKeys', () => {
  const WEEKENDS = [0, 6];
  const base = {
    id: 'j1', jobNumber: 'J-1', name: 'Deck', clientId: 'c1', estimateId: 'e1',
    address: 'x', stage: 'Scheduled', dateCreated: '2026-01-01',
  };

  it('unions the days its shifts actually work, skipping the gap between them', () => {
    const job = {
      ...base,
      startDate: '2026-08-17T08:00:00', endDate: '2026-08-24T17:00:00',
      allocations: [
        { id: 'a1-worked', name: 'Crew', memberIds: ['m1'], pinned: true,
          startDate: '2026-08-17', endDate: '2026-08-18', startTime: '08:00', endTime: '17:00' },
        { id: 'a1', name: 'Crew', memberIds: ['m1'],
          startDate: '2026-08-24', endDate: '2026-08-24', startTime: '08:00', endTime: '17:00' },
      ],
    } as Job;
    // Aug 19, 20, 21 are inside the envelope but worked by no shift.
    expect(jobWorkedDayKeys(job, WEEKENDS)).toEqual(['2026-08-17', '2026-08-18', '2026-08-24']);
  });

  it('de-duplicates days two shifts share', () => {
    const job = {
      ...base,
      startDate: '2026-08-17T08:00:00', endDate: '2026-08-18T17:00:00',
      allocations: [
        { id: 'am', name: 'AM', memberIds: ['m1'], startDate: '2026-08-17', endDate: '2026-08-18', startTime: '08:00', endTime: '12:00' },
        { id: 'pm', name: 'PM', memberIds: ['m2'], startDate: '2026-08-17', endDate: '2026-08-18', startTime: '13:00', endTime: '17:00' },
      ],
    } as Job;
    expect(jobWorkedDayKeys(job, WEEKENDS)).toEqual(['2026-08-17', '2026-08-18']);
  });

  it('respects a shift\'s skipDays', () => {
    const job = {
      ...base,
      startDate: '2026-08-17T08:00:00', endDate: '2026-08-19T17:00:00',
      allocations: [
        { id: 'a1', name: 'Crew', memberIds: ['m1'], startDate: '2026-08-17', endDate: '2026-08-19',
          startTime: '08:00', endTime: '17:00', skipDays: ['2026-08-18'] },
      ],
    } as Job;
    expect(jobWorkedDayKeys(job, WEEKENDS)).toEqual(['2026-08-17', '2026-08-19']);
  });

  it('falls back to the envelope for a legacy job with no dated shifts', () => {
    const job = { ...base, startDate: '2026-08-17T08:00:00', endDate: '2026-08-19T17:00:00' } as Job;
    expect(jobWorkedDayKeys(job, WEEKENDS)).toEqual(['2026-08-17', '2026-08-18', '2026-08-19']);
  });

  it('returns nothing for an unscheduled job', () => {
    expect(jobWorkedDayKeys({ ...base, startDate: '' } as Job, WEEKENDS)).toEqual([]);
  });
});
```

And add to `services/crewHoursGrid.test.ts` the behaviour this exists to fix:

```ts
describe('requiredHoursForWeek — a gapped job pro-rates over worked days', () => {
  const WEEKENDS = [0, 6];
  const wo = [{ id: 'wo1', totalProductionHours: 24 }] as any;
  // Mon 17 + Tue 18 pinned as worked, Wednesday's day pushed out to Mon 24.
  const gapped = {
    id: 'j1', jobNumber: 'J-1', name: 'Deck', workOrderId: 'wo1', stage: 'Scheduled',
    startDate: '2026-08-17T08:00:00', endDate: '2026-08-24T17:00:00',
    allocations: [
      { id: 'a1-worked', name: 'Crew', memberIds: ['m1'], pinned: true,
        startDate: '2026-08-17', endDate: '2026-08-18', startTime: '08:00', endTime: '17:00' },
      { id: 'a1', name: 'Crew', memberIds: ['m1'],
        startDate: '2026-08-24', endDate: '2026-08-24', startTime: '08:00', endTime: '17:00' },
    ],
  } as any;

  it('asks for two thirds of the estimate in the week holding two of three worked days', () => {
    const weekOf17 = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21'];
    // 3 worked days total, 2 of them this week -> 24 * 2/3. The envelope would have said
    // 24 * 5/6 = 20h and reported a phantom 4h missing.
    expect(requiredHoursForWeek(gapped, wo, weekOf17, WEEKENDS).required).toBe(16);
  });

  it('asks for the remaining third in the week holding the moved day', () => {
    const weekOf24 = ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28'];
    expect(requiredHoursForWeek(gapped, wo, weekOf24, WEEKENDS).required).toBe(8);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/scheduleEngine.test.ts -t "jobWorkedDayKeys" services/crewHoursGrid.test.ts -t "gapped job pro-rates"`
Expected: `jobWorkedDayKeys is not a function`, and the gapped-job cases returning `20` and `4` instead of `16` and `8`.

- [ ] **Step 3: Implement `jobWorkedDayKeys`**

In `services/scheduleEngine.ts`, immediately after `allocWorkedDayKeys` (~`:221`):

```ts
/** The days a JOB actually works: the union of its shifts' worked days, sorted and
 *  de-duplicated. This is deliberately NOT the envelope. Once a reschedule can pin elapsed
 *  days into their own shift, a job legitimately has gaps — worked days, then nothing, then
 *  the moved remainder — and counting the gap as working days silently inflates every
 *  day-count pro-rate that reads it. Legacy jobs with no dated shifts fall back to the
 *  envelope, which for them is the same thing. */
export const jobWorkedDayKeys = (job: Job, nonWorkingWeekdays: number[]): string[] => {
  if (!job.startDate) return [];
  const dated = (job.allocations ?? []).filter(a => a.startDate && a.endDate);
  if (!dated.length) {
    return workingDayKeys(job.startDate, job.endDate ?? job.startDate, nonWorkingWeekdays);
  }
  const keys = new Set<string>();
  for (const a of dated) for (const k of allocWorkedDayKeys(a, nonWorkingWeekdays)) keys.add(k);
  return [...keys].sort();
};
```

- [ ] **Step 4: Repoint the six job-level callers**

`services/scheduleEngine.ts:181` inside `scheduledWindowHours`:

```ts
  const keys = jobWorkedDayKeys(job, config.weekendDays);
```

`services/crewHoursGrid.ts` — add `jobWorkedDayKeys` to the existing `./scheduleEngine` import, then:

- `:83` in `requiredHoursForWeek` → `const allKeys = jobWorkedDayKeys(job, weekendDays);`
- `:180` in `jobsScheduledInWeek` → `const keys = jobWorkedDayKeys(j, weekendDays);`
- `:199` in `buildJobSummaries` → `const jobKeys = new Set(jobWorkedDayKeys(j, weekendDays));`
- `:255` in `assignableDayKeys` → `const jobKeys = new Set(jobWorkedDayKeys(job, weekendDays));`
- `:275` in `noEligibleDaysReason` → `return { kind: 'notThisWeek', jobDays: jobWorkedDayKeys(job, weekendDays) };`

Leave `:208` (`allocKeys`, already per-shift), `:230` and `:343` alone — they are not job-envelope reads.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run services/scheduleEngine.test.ts services/crewHoursGrid.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Run the whole suite and read any failure carefully**

Run: `npx vitest run`

Expected: PASS. This step changes shared read paths, so if something fails, decide deliberately rather than editing the assertion to match. A failure is legitimate only if the old expectation encoded envelope behaviour for a **gapped** job. For an ungapped job the two are identical, so a failure there is a real regression — most likely a fixture whose allocation dates disagree with its job envelope. Check `services/skipDaysAcrossSurfaces.test.ts` first: it exists to pin exactly this cross-surface behaviour.

- [ ] **Step 7: Commit**

```bash
git add services/scheduleEngine.ts services/crewHoursGrid.ts services/scheduleEngine.test.ts services/crewHoursGrid.test.ts
git commit -m "fix(scheduling): a job's working days come from its shifts, not its envelope

requiredHoursForWeek pro-rates the estimate by day count. Reading that
count off the envelope counts the gap a pinned-past split leaves behind,
so a 3-day 24h job split Mon/Tue + Mon asked for 24 x 5/6 in the first
week against 16h assigned and reported a phantom 4h missing — the exact
prompt that gets completed work booked a second time.

jobWorkedDayKeys unions the shifts' worked days instead, which keeps
allocCoversDay the single authority on whether a day is worked rather
than adding a rival to it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: A pinned shift reads as history in the UI

**Files:**
- Modify: `i18n/catalog.ts` (~line 10 `enManual`, ~line 248 `esManual`)
- Modify: `components/views/JobScheduling/ShiftList.tsx`
- Test: create `components/views/JobScheduling/ShiftList.pinned.test.tsx` (the existing `ShiftList.test.tsx` is large; a focused file keeps this reviewable)

**Interfaces:**
- Consumes: `alloc.pinned` from Task 3.
- Produces: nothing other tasks depend on.

**Note:** `ShiftList.tsx` currently uses hardcoded English for its existing labels. Do **not** migrate them — only the two new strings are localised, via `useTranslation` as `CrewHoursGrid.tsx:12` does it.

- [ ] **Step 1: Add the i18n keys**

In `i18n/catalog.ts`, in `enManual`:

```ts
  // --- Pinned (already-worked) shifts (ShiftList) ---
  'views.JobScheduling.ShiftList.worked': 'Worked',
  'views.JobScheduling.ShiftList.workedHint': 'Already worked — a reschedule leaves these days where they are.',
```

and the matching entries in `esManual`:

```ts
  // --- Turnos ya trabajados (ShiftList) ---
  'views.JobScheduling.ShiftList.worked': 'Trabajado',
  'views.JobScheduling.ShiftList.workedHint': 'Ya trabajado: una reprogramación deja estos días donde están.',
```

- [ ] **Step 2: Write the failing test**

Create `components/views/JobScheduling/ShiftList.pinned.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShiftList } from './ShiftList';
import type { JobCrewAllocation, CrewMember } from '../../../types';

const staff = [{ id: 'm1', name: 'Mike Smith', role: 'Painter' }] as CrewMember[];
const shift = (over: Partial<JobCrewAllocation> = {}): JobCrewAllocation => ({
  id: 'a1', name: 'Crew', memberIds: ['m1'],
  startDate: '2026-08-17', endDate: '2026-08-18', startTime: '08:00', endTime: '17:00',
  ...over,
});

const renderList = (allocations: JobCrewAllocation[]) =>
  render(<ShiftList allocations={allocations} allStaff={staff} weekendDays={[0, 6]}
    onEditMembers={vi.fn()} onAddShift={vi.fn()} onDeleteShift={vi.fn()} />);

describe('ShiftList — a pinned shift is history', () => {
  it('badges a pinned shift as worked', () => {
    renderList([shift({ id: 'a1-worked', pinned: true })]);
    expect(screen.getByText('Worked')).toBeInTheDocument();
  });

  it('offers no edit or delete control on a pinned shift', () => {
    renderList([shift({ id: 'a1-worked', pinned: true })]);
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete shift/i })).not.toBeInTheDocument();
  });

  it('leaves an ordinary shift fully editable', () => {
    renderList([shift()]);
    expect(screen.queryByText('Worked')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete shift/i })).toBeInTheDocument();
  });

  it('renders a pinned and a live shift side by side', () => {
    renderList([shift({ id: 'a1-worked', pinned: true }), shift({ id: 'a1', startDate: '2026-08-24', endDate: '2026-08-24' })]);
    expect(screen.getAllByText('Worked')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /delete shift/i })).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/ShiftList.pinned.test.tsx`
Expected: FAIL — no "Worked" text, and the Edit/Delete buttons present on the pinned card.

- [ ] **Step 4: Implement**

In `ShiftList.tsx`, add the translation hook and gate the controls. Add to the imports:

```tsx
import { useTranslation } from '@/i18n/LanguageContext';
```

Inside the component body, before `return`:

```tsx
  const { t } = useTranslation();
```

Then in the card's header, replace the header block with:

```tsx
            {/* Header: shift name + Edit / Delete. A pinned shift is history — it carries a
                Worked badge and no controls, because moving or deleting it would destroy the
                only record that the work happened. */}
            <div className="flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate font-bold text-gray-900 dark:text-white">{alloc.name || 'Shift'}</span>
              {alloc.pinned ? (
                <span
                  title={t('views.JobScheduling.ShiftList.workedHint')}
                  className="text-[11px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300"
                >{t('views.JobScheduling.ShiftList.worked')}</span>
              ) : (
                <>
                  <button onClick={() => onEditMembers(alloc.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button aria-label="Delete shift" disabled={!canDelete} onClick={() => canDelete && onDeleteShift(alloc.id)}
                    className={`p-1.5 rounded-lg ${canDelete ? 'text-gray-400 hover:text-red-600' : 'text-gray-200 dark:text-gray-700 cursor-not-allowed'}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run components/views/JobScheduling/ShiftList.pinned.test.tsx components/views/JobScheduling/ShiftList.test.tsx i18n/translate.test.ts`
Expected: PASS. `i18n/translate.test.ts`'s `catalog integrity` suite confirms both new keys have Spanish.

- [ ] **Step 6: Run the whole suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add i18n/catalog.ts components/views/JobScheduling/ShiftList.tsx components/views/JobScheduling/ShiftList.pinned.test.tsx
git commit -m "feat(scheduling): a worked shift reads as history in the shift list

A pinned shift carries a Worked badge and no edit or delete control:
moving or deleting it would destroy the only record that the work
happened.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: The reschedule preview says what it will keep

The preview must not lie about the split. Last task because it depends on every prior one.

**Files:**
- Modify: `components/views/JobSchedulingView.tsx` (the preview builders, around `:480` and `:886`)
- Modify: `components/views/JobScheduling/reschedule/BulkPreview.tsx`
- Modify: `i18n/catalog.ts`
- Test: `components/views/JobScheduling/reschedule/BulkPreview.test.tsx`

**Interfaces:**
- Consumes: `ProposedChange.pinnedDays?: string[]` (Task 4), `splitPinnedPast` (Task 3).
- Produces: nothing downstream.

- [ ] **Step 1: Add the i18n key**

`enManual`:

```ts
  'views.JobScheduling.BulkPreview.keepsWorkedDays': 'Keeps {count} worked day(s) in place',
```

`esManual`:

```ts
  'views.JobScheduling.BulkPreview.keepsWorkedDays': 'Mantiene {count} día(s) ya trabajado(s) en su lugar',
```

- [ ] **Step 2: Write the failing test**

The file already has an `mk(id, name)` change factory (`:8`) and a `base` props object (`:20`).
Reuse both — append to `components/views/JobScheduling/reschedule/BulkPreview.test.tsx`:

```tsx
describe('BulkPreview — elapsed days are called out', () => {
  it('says how many worked days a change will keep in place', () => {
    const withPinned: ProposedChange = { ...mk('a', 'Repaint Deck'), pinnedDays: ['2026-08-17', '2026-08-18'] };
    render(<BulkPreview {...base} changes={[withPinned]} />);
    expect(screen.getByText(/keeps 2 worked day/i)).toBeInTheDocument();
  });

  it('says nothing when no day has elapsed', () => {
    render(<BulkPreview {...base} />);
    expect(screen.queryByText(/worked day/i)).not.toBeInTheDocument();
  });
});
```

`BulkPreview.tsx` already has `useTranslation` wired (`:11` and `:32`), so no hook to add.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/reschedule/BulkPreview.test.tsx -t "elapsed days are called out"`
Expected: FAIL — no "keeps 2 worked day" text.

- [ ] **Step 4: Render the line**

In `BulkPreview.tsx`, inside the row for each change, after the existing old→new date line:

```tsx
              {!!change.pinnedDays?.length && (
                <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  {t('views.JobScheduling.BulkPreview.keepsWorkedDays', { count: change.pinnedDays.length })}
                </div>
              )}
```

`t` is already destructured at `BulkPreview.tsx:32`, so no further wiring is needed.

- [ ] **Step 5: Populate `pinnedDays` in the preview builders**

In `JobSchedulingView.tsx`, wherever `ProposedChange[]` rows are built for display (around `:480` and `:886`), map each change through a helper that computes the elapsed days with the same function the commit uses, so preview and commit cannot diverge:

```ts
  // The preview must describe exactly what the commit will do, so it asks the same
  // function. todayKey lives in the view, never in the engine.
  const withPinnedDays = (changes: ProposedChange[]): ProposedChange[] => {
    const todayKey = toLocalDateKey(new Date());
    return changes.map(ch => {
      const job = jobs.find(j => j.id === ch.jobId);
      if (!job?.allocations?.length) return ch;
      const target = ch.shiftId
        ? job.allocations.filter(a => a.id === ch.shiftId)
        : job.allocations;
      const pinnedDays = target
        .filter(a => !a.pinned)
        .flatMap(a => splitPinnedPast(a, todayKey, workConfig.weekendDays).pinned
          ? allocWorkedDayKeys(splitPinnedPast(a, todayKey, workConfig.weekendDays).pinned!, workConfig.weekendDays)
          : []);
      return pinnedDays.length ? { ...ch, pinnedDays } : ch;
    });
  };
```

Call `withPinnedDays(...)` on the change arrays handed to the preview components. Import `splitPinnedPast` from `../../services/shifts` and `allocWorkedDayKeys` from `../../services/scheduleEngine`.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run components/views/JobScheduling/reschedule/BulkPreview.test.tsx i18n/translate.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Run the whole suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 8: Verify in the running app**

Run: `npm run dev`, open the Job Scheduling board, and check an in-flight job — one with days before today and days after. Reschedule it forward and confirm: the preview names the worked days it will keep, the past chips stay exactly where they were with their hours intact, the remainder lands on the date you asked for, and the shift list shows a Worked badge on the frozen shift.

- [ ] **Step 9: Commit**

```bash
git add i18n/catalog.ts components/views/JobSchedulingView.tsx components/views/JobScheduling/reschedule/BulkPreview.tsx components/views/JobScheduling/reschedule/BulkPreview.test.tsx
git commit -m "feat(scheduling): the reschedule preview says which worked days it keeps

The preview asks the same splitPinnedPast the commit does, so the two
cannot diverge about what a move will and will not touch.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** — every section maps to a task:

| Spec section | Task |
|---|---|
| 1. `types.ts` — `pinned?: true` | 3 |
| 2. re-key in `applyChangeToJob` | 1 |
| 3. re-key in `moveAllocation`; `splitPinnedPast` | 2, 3 |
| 4. injected `todayKey`; delta from first surviving day | 4 |
| 5. `pinnedDays`, `'all-past'` skip reason, preview parity | 4, 7 |
| 6. `jobWorkedDayKeys` + call sites | 5 |
| 7. pinned shift reads as history | 6 |

**Two deliberate deviations from the spec, both discovered while writing the plan:**

1. **`applyChangeToJob` does not call `splitPinnedPast`.** The spec implied it would, but `shifts.ts` imports from `scheduleEngine.ts`, so that would create the exact import cycle the codebase already works around at `scheduleEngine.ts:395`. Instead `applyChangeToJob` gains a neutral `deltaFromKey` option and a new `applyChangeToJobPinningPast` wrapper in `shifts.ts` composes the two. Same behaviour, dependency stays one-way.

2. **`'all-past'` is defined but the plan never emits it as a `skipped` row.** Task 4 returns the job unchanged when every targeted day has elapsed, which is the correct commit behaviour, but nothing yet builds a skipped row with that reason for the preview to render. The type is in place; wiring the row is a small follow-up. Flagging rather than hiding it.

**Placeholder scan:** clean — every code step carries the actual code. Three claims about
surrounding code were verified against the files rather than assumed, and two were wrong on the
first pass and are now corrected in place: `App.tsx` has no `workConfig` in scope and does not
import `toLocalDateKey` (Task 4 Step 7 now spells out both imports), and
`BulkPreview.test.tsx` uses an `mk()`/`base` pair rather than the `change()`/`renderPreview()`
helpers first written (Task 7 Step 2 now uses the real ones). `BulkPreview.tsx` already has
`useTranslation` wired, and `crewHoursGrid.ts:2` already imports from `./scheduleEngine`, so
Task 5's import edit is an addition to an existing line.

The one remaining "match local naming" instruction is Task 4 Step 2's note to hoist Task 1's
`granularJob()` / `change()` factories if they ended up nested — a mechanical scoping detail, not
a deferred decision.

**Type consistency:** `splitPinnedPast` returns `{ pinned?, moving? }` in Task 3 and is destructured that way in Tasks 4 and 7. `jobWorkedDayKeys(job, nonWorkingWeekdays)` is defined in Task 5 and called with that arity at all six sites. `applyChangeToJob`'s third parameter is `{ deltaFromKey?: string }` throughout; the wrapper's is `{ todayKey?: string; nonWorkingWeekdays?: number[] }`. `pinned?: true` (not `boolean`) everywhere.

---

## Execution Notes

**Ship boundary:** Tasks 1–2 are the live data loss and are independently shippable — no model change, no policy, no UI. Tasks 3–5 must land together; P2 without P3 produces the phantom "missing hours" that causes the very re-booking this fixes. Tasks 6–7 are the UI making the new behaviour legible.

**Working tree note:** there are uncommitted card-highlight changes in `CrewHoursGrid.tsx`, `EditableHoursChip.tsx`, `JobSchedulingView.tsx` and their tests. Task 5 touches `crewHoursGrid.ts` (the service, not the component) and Task 7 touches `JobSchedulingView.tsx`. Commit or stash the highlight work before starting so the commits here stay clean.
