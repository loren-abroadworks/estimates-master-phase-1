# Skippable Shift Days + Per-Day Windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a scheduler skip individual days inside a shift's date range and give each worked day its own start/end time.

**Architecture:** A shift keeps `startDate`/`endDate` as its envelope and gains `skipDays?: string[]`. Per-day times reuse the existing `JobCrewAllocation.dailyHours` field, which is already read by `allocDayWindow` everywhere but has never been writable from the UI. One new predicate, `allocCoversDay(alloc, dateKey)`, replaces every hand-written range check so skipped days stop counting for capacity, boards, and the Actual Schedule. A new `ShiftDayList` component edits both concerns as one day list inside `CrewSelectionModal`.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react, Tailwind classes inline, `useTranslation()` from `@/i18n/LanguageContext`.

**Spec:** `docs/superpowers/specs/2026-08-18-shift-day-set-design.md`

## Global Constraints

- **Date keys are bare local `'YYYY-MM-DD'` strings.** Never `new Date('2026-08-19')` — that parses as UTC midnight and rolls back a day in negative-offset zones. Anchor at local noon: `new Date('2026-08-19T12:00:00')`. The codebase calls this "anchor at noon" and does it everywhere.
- **Absent `skipDays` must behave exactly as today.** Every new predicate treats `undefined` and `[]` identically to "no days skipped". There is no migration and no data backfill.
- **Guard, don't purge.** Skipping a day never deletes its `dailyHours` or `hoursAssignments` entries. Re-including the day restores them.
- **i18n:** every new user-visible string needs a key in BOTH `enManual` and `esManual` in `i18n/catalog.ts`. A catalog-integrity test fails the build if they drift. Key convention: `<area>.<Component>.<descriptor>`.
- **Tests:** `npx vitest run <path>` for one file, `npx vitest run` for all. `npx tsc --noEmit` must stay clean.
- **Commit style:** `feat:` / `fix:` / `test:` / `refactor:` prefix, imperative mood.

---

## File Structure

**Modified:**
- `types.ts` — `skipDays` on `JobCrewAllocation`.
- `services/scheduleEngine.ts` — `allocCoversDay`, `allocWorkedDayKeys` (new exports beside `allocDayWindow:193`).
- `services/crewWeeklyHours.ts:51` — `committedHoursOnDay` honors coverage.
- `services/crewHoursGrid.ts:81,113` — `memberJobDayHours`, `memberShiftDayHours` honor coverage.
- `services/productionBoard.ts:4,124,149` — `BoardCard.skipDays`, `boardShifts`, `cardOccupies`.
- `services/monthBoard.ts:58,83` — same for the month lane.
- `services/shifts.ts` — `normalizeAlloc`, applied on write; `moveAllocation` re-keys `skipDays`.
- `components/views/JobScheduling/JobDetailsPanel.tsx` — `jobActualSchedule` uses `allocCoversDay`.
- `components/views/JobScheduling/ShiftList.tsx:37` — read-only day rows hide skipped days.
- `components/modals/CrewSelectionModal.tsx` — hosts `ShiftDayList`, persists `skipDays` + `dailyHours`.
- `i18n/catalog.ts` — new keys, en + es.

**Created:**
- `components/modals/ShiftDayList.tsx` — the day list (include toggle, per-day times, bulk actions).
- `components/modals/ShiftDayList.test.tsx`.

`CrewSelectionModal.tsx` is 758 lines already; the day list goes in its own file so it can be tested without mounting the whole modal.

---

### Task 1: `skipDays` field + coverage predicates

**Files:**
- Modify: `types.ts:458-472` (the `JobCrewAllocation` interface)
- Modify: `services/scheduleEngine.ts` (add after `allocDayWindow`, line 197)
- Test: `services/scheduleEngine.test.ts`

**Interfaces:**
- Consumes: nothing — this is the foundation task.
- Produces:
  - `JobCrewAllocation.skipDays?: string[]`
  - `allocCoversDay(alloc: JobCrewAllocation, dateKey: string): boolean`
  - `allocWorkedDayKeys(alloc: JobCrewAllocation, nonWorkingWeekdays: number[]): string[]`

- [ ] **Step 1: Write the failing tests**

Append to `services/scheduleEngine.test.ts`:

```ts
describe('allocCoversDay', () => {
  const alloc: JobCrewAllocation = {
    id: 's1', name: 'Crew', memberIds: ['m1'],
    startDate: '2026-08-19', endDate: '2026-08-21',
    startTime: '08:00', endTime: '17:00',
  };

  it('covers every day in the range when nothing is skipped', () => {
    expect(allocCoversDay(alloc, '2026-08-19')).toBe(true);
    expect(allocCoversDay(alloc, '2026-08-20')).toBe(true);
    expect(allocCoversDay(alloc, '2026-08-21')).toBe(true);
  });

  it('does not cover days outside the range', () => {
    expect(allocCoversDay(alloc, '2026-08-18')).toBe(false);
    expect(allocCoversDay(alloc, '2026-08-22')).toBe(false);
  });

  it('does not cover a skipped day', () => {
    const skipping = { ...alloc, skipDays: ['2026-08-20'] };
    expect(allocCoversDay(skipping, '2026-08-19')).toBe(true);
    expect(allocCoversDay(skipping, '2026-08-20')).toBe(false);
    expect(allocCoversDay(skipping, '2026-08-21')).toBe(true);
  });

  it('treats an empty skip list the same as none', () => {
    expect(allocCoversDay({ ...alloc, skipDays: [] }, '2026-08-20')).toBe(true);
  });

  it('does not cover anything when the shift is undated', () => {
    expect(allocCoversDay({ ...alloc, startDate: '', endDate: '' }, '2026-08-19')).toBe(false);
  });
});

describe('allocWorkedDayKeys', () => {
  const alloc: JobCrewAllocation = {
    id: 's1', name: 'Crew', memberIds: ['m1'],
    startDate: '2026-08-19', endDate: '2026-08-25', // Wed → Tue, spans a weekend
    startTime: '08:00', endTime: '17:00',
  };

  it('lists the range minus weekends', () => {
    expect(allocWorkedDayKeys(alloc, [0, 6])).toEqual([
      '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-24', '2026-08-25',
    ]);
  });

  it('also drops skipped days', () => {
    const skipping = { ...alloc, skipDays: ['2026-08-20', '2026-08-24'] };
    expect(allocWorkedDayKeys(skipping, [0, 6])).toEqual([
      '2026-08-19', '2026-08-21', '2026-08-25',
    ]);
  });

  it('returns an empty list when every day is skipped (no silent fallback)', () => {
    const allSkipped = { ...alloc, skipDays: ['2026-08-19', '2026-08-20', '2026-08-21', '2026-08-24', '2026-08-25'] };
    expect(allocWorkedDayKeys(allSkipped, [0, 6])).toEqual([]);
  });

  it('returns nothing for an undated shift', () => {
    expect(allocWorkedDayKeys({ ...alloc, startDate: '', endDate: '' }, [0, 6])).toEqual([]);
  });
});
```

Make sure `JobCrewAllocation` is imported in the test file's type imports, and that `allocCoversDay` and `allocWorkedDayKeys` are added to the existing `import { … } from './scheduleEngine'` list at the top.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/scheduleEngine.test.ts -t "allocCoversDay"`
Expected: FAIL — `allocCoversDay is not a function`.

- [ ] **Step 3: Add the field to the type**

In `types.ts`, inside `JobCrewAllocation`, immediately after the `dailyHours` field (~line 469):

```ts
  /** Days inside [startDate, endDate] the shift does NOT work, as local 'YYYY-MM-DD'.
   *  Absent or empty means every day in the range is worked (the pre-skip behaviour).
   *  A skipped day keeps any `dailyHours` / `hoursAssignments` entries it has — they are
   *  made inert by `allocCoversDay`, not deleted — so re-including the day restores them. */
  skipDays?: string[];
```

- [ ] **Step 4: Add the predicates**

In `services/scheduleEngine.ts`, directly after `allocDayWindow` (which ends at line 197):

```ts
/** Whether a shift actually works a given local 'YYYY-MM-DD': the day falls inside the
 *  shift's envelope AND is not in its skip list. This is the ONLY place the "does this
 *  shift cover this day" question is answered — capacity roll-ups, board occupancy and
 *  the Actual Schedule all route through it, so a skipped day cannot keep counting
 *  through some path that still compares the raw range. */
export const allocCoversDay = (alloc: JobCrewAllocation, dateKey: string): boolean =>
  !!alloc.startDate && !!alloc.endDate &&
  dateKey >= alloc.startDate && dateKey <= alloc.endDate &&
  !alloc.skipDays?.includes(dateKey);

/** The days a shift actually works: its span, less non-working weekdays, less its skip
 *  list. Unlike `workingDayKeys` this does NOT fall back to the full span when filtering
 *  empties the list — an all-skipped shift genuinely works no days, and callers need to
 *  see that rather than a span that silently reappears. */
export const allocWorkedDayKeys = (
  alloc: JobCrewAllocation,
  nonWorkingWeekdays: number[],
): string[] => {
  if (!alloc.startDate || !alloc.endDate) return [];
  return spannedDayKeys(`${alloc.startDate}T12:00:00`, `${alloc.endDate}T12:00:00`)
    .filter(k => !nonWorkingWeekdays.includes(new Date(`${k}T12:00:00`).getDay()))
    .filter(k => !alloc.skipDays?.includes(k));
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run services/scheduleEngine.test.ts`
Expected: PASS, including the pre-existing tests in that file.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add types.ts services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat: allocCoversDay / allocWorkedDayKeys and the skipDays field"
```

---

### Task 2: Skipped days stop counting toward capacity

This is the task most likely to ship a silent bug. All three sites consult the granular
`hoursAssignments` map **first** and only fall back to the date range when a member has no
granular entry. Left in that order, a skipped day keeps billing its per-member hours: the
scheduler unchecks a day and the numbers never move.

**Files:**
- Modify: `services/crewWeeklyHours.ts:51-81` (`committedHoursOnDay`)
- Modify: `services/crewHoursGrid.ts:81-119` (`memberJobDayHours`, `memberShiftDayHours`)
- Modify: `components/modals/CrewSelectionModal.tsx:279-292` (`getUnavailabilityReason`)
- Test: `services/crewWeeklyHours.test.ts`, `services/crewHoursGrid.test.ts`

**Interfaces:**
- Consumes: `allocCoversDay` from `services/scheduleEngine` (Task 1).
- Produces: no new signatures — behaviour change only. Later tasks assume a skipped day contributes 0 hours everywhere.

- [ ] **Step 1: Write the failing tests**

Append to `services/crewHoursGrid.test.ts`:

```ts
describe('skipped days contribute no hours', () => {
  const member = 'm1';
  const alloc: JobCrewAllocation = {
    id: 's1', name: 'Crew', memberIds: [member],
    startDate: '2026-08-19', endDate: '2026-08-21',
    startTime: '08:00', endTime: '17:00',
    skipDays: ['2026-08-20'],
  };
  const job: Job = {
    id: 'j1', jobNumber: 'J-1', name: 'Deck', clientId: 'c1', estimateId: 'e1',
    address: 'x', stage: 'Scheduled', dateCreated: '2026-08-01',
    startDate: '2026-08-19T08:00:00', endDate: '2026-08-21T17:00:00',
    allocations: [alloc],
  } as Job;

  it('memberShiftDayHours returns 0 on a skipped day, hours on a worked day', () => {
    expect(memberShiftDayHours(alloc, member, '2026-08-19')).toBe(9);
    expect(memberShiftDayHours(alloc, member, '2026-08-20')).toBe(0);
    expect(memberShiftDayHours(alloc, member, '2026-08-21')).toBe(9);
  });

  // The regression that matters: a granular per-member entry must NOT resurrect a
  // skipped day, because the map is consulted before the range check.
  it('memberShiftDayHours ignores a granular entry left on a skipped day', () => {
    const withGranular = { ...alloc, hoursAssignments: { [member]: { '2026-08-20': 8 } } };
    expect(memberShiftDayHours(withGranular, member, '2026-08-20')).toBe(0);
  });

  // Both days are in the granular map, so the ONLY difference between them is the skip.
  // A member's granular map is authoritative: days ABSENT from it count 0 regardless of
  // coverage, so putting only the skipped day in the map would prove nothing.
  it('memberJobDayHours ignores a granular entry left on a skipped day', () => {
    const withGranular = { ...alloc, hoursAssignments: { [member]: { '2026-08-19': 9, '2026-08-20': 8 } } };
    const j = { ...job, allocations: [withGranular] };
    expect(memberJobDayHours(j, member, '2026-08-20', 8)).toBe(0);
    expect(memberJobDayHours(j, member, '2026-08-19', 8)).toBe(9);
  });

  it('a member with no granular map falls back to the window on worked days only', () => {
    expect(memberJobDayHours(job, member, '2026-08-19', 8)).toBe(9);
    expect(memberJobDayHours(job, member, '2026-08-20', 8)).toBe(0);
    expect(memberJobDayHours(job, member, '2026-08-21', 8)).toBe(9);
  });
});
```

Append to `services/crewWeeklyHours.test.ts`:

```ts
describe('committedHoursOnDay with skipped days', () => {
  const member = { id: 'm1', name: 'Mike', role: 'Painter' } as CrewMember;
  const job = {
    id: 'j1', jobNumber: 'J-1', name: 'Deck', clientId: 'c1', estimateId: 'e1',
    address: 'x', stage: 'Scheduled', dateCreated: '2026-08-01',
    startDate: '2026-08-19T08:00:00', endDate: '2026-08-21T17:00:00',
    allocations: [{
      id: 's1', name: 'Crew', memberIds: ['m1'],
      startDate: '2026-08-19', endDate: '2026-08-21',
      startTime: '08:00', endTime: '17:00',
      skipDays: ['2026-08-20'],
    }],
  } as Job;

  it('counts a worked day and not a skipped one', () => {
    expect(committedHoursOnDay(member, [job], '2026-08-19')).toBe(9);
    expect(committedHoursOnDay(member, [job], '2026-08-20')).toBe(0);
  });

  it('ignores a granular entry left on a skipped day', () => {
    const j = {
      ...job,
      allocations: [{ ...job.allocations![0], hoursAssignments: { m1: { '2026-08-20': 8 } } }],
    } as Job;
    expect(committedHoursOnDay(member, [j], '2026-08-20')).toBe(0);
  });
});
```

Add any missing imports (`JobCrewAllocation`, `CrewMember`, `memberJobDayHours`, `committedHoursOnDay`) to each file's existing import lists.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/crewHoursGrid.test.ts services/crewWeeklyHours.test.ts`
Expected: FAIL — skipped days return 9 (or 8 for the granular cases) instead of 0.

- [ ] **Step 3: Guard `memberShiftDayHours`**

`services/crewHoursGrid.ts`, replace the body (lines 113-119):

```ts
export const memberShiftDayHours = (alloc: JobCrewAllocation, memberId: string, dateKey: string): number => {
  if (!alloc.memberIds?.includes(memberId)) return 0;
  // Coverage first: a skipped day contributes nothing even if a granular entry survives
  // on it, because the entry is kept (not purged) so re-including the day restores it.
  if (!allocCoversDay(alloc, dateKey)) return 0;
  const map = alloc.hoursAssignments?.[memberId];
  if (map) return map[dateKey] !== undefined ? map[dateKey] : 0;
  return allocWindowHours(alloc, dateKey);
};
```

- [ ] **Step 4: Guard `memberJobDayHours`**

Same file, replace the allocation loop inside `memberJobDayHours` (lines 87-101):

```ts
  if (job.allocations?.length) {
    let total = 0;
    for (const alloc of job.allocations) {
      if (!alloc.memberIds?.includes(memberId)) continue;
      // Coverage first — see memberShiftDayHours.
      if (!allocCoversDay(alloc, dateKey)) continue;
      const memberMap = alloc.hoursAssignments?.[memberId];
      if (memberMap) {
        // Granular map is authoritative within a covered day: only days explicitly set count.
        if (memberMap[dateKey] !== undefined) total += memberMap[dateKey];
      } else {
        // No granular data for this member: fall back to the SHIFT's window on this day.
        total += allocWindowHours(alloc, dateKey);
      }
    }
    return total;
  }
```

Add `allocCoversDay` to the `from './scheduleEngine'` import on line 2.

- [ ] **Step 5: Guard `committedHoursOnDay`**

`services/crewWeeklyHours.ts`, replace the allocation loop (lines 62-73):

```ts
    if (job.allocations?.length) {
      for (const alloc of job.allocations) {
        if (excludeAllocationId && alloc.id === excludeAllocationId) continue;
        if (!alloc.memberIds?.includes(member.id)) continue;
        // Coverage first: a skipped day must not keep billing a stale granular entry.
        if (!allocCoversDay(alloc, dateKey)) continue;
        const memberMap = alloc.hoursAssignments?.[member.id];
        if (memberMap) {
          // A granular map is authoritative within a covered day.
          if (memberMap[dateKey] !== undefined) total += memberMap[dateKey];
        } else {
          total += allocWindowHours(alloc, dateKey);
        }
      }
    }
```

Add `allocCoversDay` to the existing `from './scheduleEngine'` import at the top of the file.

- [ ] **Step 6: Guard the modal's own conflict scan**

`components/modals/CrewSelectionModal.tsx`, in `getUnavailabilityReason` (line 264), the
tooltip that explains why a member is over-booked scans *other* jobs' shifts with the same
map-before-range shape. Left alone, hovering a cell blames a job for hours on a day that job
skips. Replace the member branch (lines 279-292):

```ts
                 if (alloc.memberIds.includes(memberId)) {
                     // Coverage first — a day this shift skips can't be a source of conflict.
                     if (!allocCoversDay(alloc, dateStr)) continue;
                     if (alloc.hoursAssignments && alloc.hoursAssignments[memberId] && alloc.hoursAssignments[memberId][dateStr] !== undefined) {
                         const hrs = alloc.hoursAssignments[memberId][dateStr];
                         if (hrs > 0) {
                             assignedElsewhere += hrs;
                             conflicts.push(`${job.name}`);
                         }
                     } else {
                         assignedElsewhere += 8;
                         conflicts.push(`${job.name}`);
                     }
                 }
```

Add `allocCoversDay` to the file's `from '../../services/scheduleEngine'` import.

This is the same fix as the three service sites, so it belongs in this commit rather than in
Task 7 — Task 7 is about the editor UI, not about what counts as committed hours.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run services/crewHoursGrid.test.ts services/crewWeeklyHours.test.ts components/modals/CrewSelectionModal.test.tsx`
Expected: PASS.

- [ ] **Step 8: Run the whole suite — this touches shared capacity math**

Run: `npx vitest run`
Expected: all pass. If a pre-existing test now fails, read it: a fixture with no `skipDays` must be unaffected, so a failure means the guard changed behaviour for unskipped days (most likely by dropping the old `alloc.startDate && alloc.endDate && …` range condition somewhere it was load-bearing).

- [ ] **Step 9: Commit**

```bash
npx tsc --noEmit
git add services/crewHoursGrid.ts services/crewWeeklyHours.ts components/modals/CrewSelectionModal.tsx services/crewHoursGrid.test.ts services/crewWeeklyHours.test.ts
git commit -m "fix: skipped shift days contribute no hours to capacity roll-ups"
```

---

### Task 3: Board bars break across a skipped day

**Files:**
- Modify: `services/productionBoard.ts:4-17` (`BoardCard`), `:124-143` (`boardShifts`), `:149-150` (`cardOccupies`)
- Modify: `services/monthBoard.ts:58-70` (card build), `:83` (occupancy)
- Test: `services/productionBoard.test.ts`, `services/monthBoard.test.ts`

**Interfaces:**
- Consumes: `JobCrewAllocation.skipDays` (Task 1).
- Produces: `BoardCard.skipDays?: string[]` — every card builder populates it; every occupancy check honours it.

- [ ] **Step 1: Write the failing test**

Append to `services/productionBoard.test.ts`:

```ts
describe('boardShifts with skipped days', () => {
  const job: Job = {
    id: 'j1', jobNumber: 'J-1', name: 'Deck', clientId: 'c1', estimateId: 'e1',
    address: 'x', stage: 'Scheduled', dateCreated: '2026-08-01',
    startDate: '2026-08-19T08:00:00', endDate: '2026-08-21T17:00:00',
    allocations: [{
      id: 's1', name: 'Crew', memberIds: ['m1'],
      startDate: '2026-08-19', endDate: '2026-08-21',
      startTime: '08:00', endTime: '17:00',
      skipDays: ['2026-08-20'],
    }],
  } as Job;

  it('carries the shift skip list onto the card', () => {
    expect(boardShifts(job)[0].card.skipDays).toEqual(['2026-08-20']);
  });
});
```

Append to the existing lane-building describe in the same file (or add one) — a member lane must show the bar on both sides of the hole and nothing in it:

```ts
describe('buildMemberLanes with a skipped day', () => {
  const member: CrewMember = { id: 'm1', name: 'Mike', role: 'Painter' };
  const skipJob: Job = {
    id: 'j1', jobNumber: 'J-1', name: 'Deck', clientId: 'c1', estimateId: 'e1',
    address: 'x', stage: 'Scheduled', dateCreated: '2026-08-01',
    startDate: '2026-08-19T08:00:00', endDate: '2026-08-21T17:00:00',
    allocations: [{
      id: 's1', name: 'Crew', memberIds: ['m1'],
      startDate: '2026-08-19', endDate: '2026-08-21',
      startTime: '08:00', endTime: '17:00',
      skipDays: ['2026-08-20'],
    }],
  } as Job;

  it('places cards either side of the skipped day and none on it', () => {
    // Signature is buildMemberLanes(jobs, staff, weekDays: Date[], config) — note the
    // third argument is Date objects, NOT day keys.
    const weekDays = [new Date(2026, 7, 19), new Date(2026, 7, 20), new Date(2026, 7, 21)];
    const lanes = buildMemberLanes([skipJob], [member], weekDays, configFromSettings(undefined, false));
    const byDay = lanes[0].cardsByDay;
    expect(byDay['2026-08-19']?.length).toBe(1);
    expect(byDay['2026-08-20'] ?? []).toEqual([]);
    expect(byDay['2026-08-21']?.length).toBe(1);
  });
});
```

Aug 19–21 2026 are Wed/Thu/Fri, so weekend filtering can't confound this — the only reason
the 20th can come back empty is the skip list. Import `configFromSettings` from
`./scheduleEngine` if the test file doesn't already, and reuse the file's existing config
helper if it has one.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run services/productionBoard.test.ts -t "skipped"`
Expected: FAIL — `card.skipDays` is `undefined`, and the 20th has one card.

- [ ] **Step 3: Add the card field and populate it**

`services/productionBoard.ts`, in the `BoardCard` interface after `shiftName` (line 15):

```ts
  /** Days inside [startKey, endKey] the bar does NOT occupy (the shift's skipped days). */
  skipDays?: string[];
```

In `boardShifts` (line 124), inside the mapped card object, after `shiftId`/`shiftName`:

```ts
          ...(alloc.skipDays?.length ? { skipDays: alloc.skipDays } : {}),
```

- [ ] **Step 4: Honour it in occupancy**

`services/productionBoard.ts`, replace `cardOccupies` (lines 149-150):

```ts
const cardOccupies = (card: BoardCard, dayKey: string, config: WorkingTimeConfig): boolean =>
  !card.skipDays?.includes(dayKey) &&
  occupiesWorkingDay(`${card.startKey}T12:00:00`, `${card.endKey}T12:00:00`, dayKey, config);
```

- [ ] **Step 5: Mirror both changes in the month lane**

`services/monthBoard.ts`, in the allocation-based card build (after `shiftId`/`shiftName`, line 67):

```ts
            ...(alloc.skipDays?.length ? { skipDays: alloc.skipDays } : {}),
```

and at line 83, wrap the existing occupancy check:

```ts
        if (!card.skipDays?.includes(key) &&
            occupiesWorkingDay(`${card.startKey}T12:00:00`, `${card.endKey}T12:00:00`, key, config)) {
```

- [ ] **Step 6: Add the month test, then run both**

Append to the existing `describe('buildMonthWeekLane')` block in `services/monthBoard.test.ts`,
reusing that file's `job()` factory, `cfg`, and `weekKeys` conventions:

```ts
  it('leaves a skipped day empty and bars either side of it', () => {
    const weekKeys = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'];
    const j = job({
      startDate: '2026-06-02T08:00:00', endDate: '2026-06-04T17:00:00',
      allocations: [{
        id: 's1', name: 'Crew', memberIds: ['m1'],
        startDate: '2026-06-02', endDate: '2026-06-04',
        startTime: '08:00', endTime: '17:00',
        skipDays: ['2026-06-03'],
      }],
    });
    const lane = buildMonthWeekLane([j], weekKeys, cfg, () => '#abc');
    expect(lane.cardsByDay['2026-06-02']?.[0].jobId).toBe('j1');
    expect(lane.cardsByDay['2026-06-03']).toBeUndefined();
    expect(lane.cardsByDay['2026-06-04']?.[0].jobId).toBe('j1');
    // The hole splits what used to be one 3-column bar into two 1-column bars.
    const { bars } = layoutLaneBars(lane, weekKeys);
    expect(bars).toHaveLength(2);
    expect(bars.map(b => b.span)).toEqual([1, 1]);
  });
```

The two-bar assertion is the real payoff: the sibling test above it asserts the unskipped
version collapses into a single 3-column bar, so this pins the split behaviour rather than
just the empty day.

Run: `npx vitest run services/productionBoard.test.ts services/monthBoard.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npx tsc --noEmit
git add services/productionBoard.ts services/monthBoard.ts services/productionBoard.test.ts services/monthBoard.test.ts
git commit -m "feat: board bars skip a shift's skipped days"
```

---

### Task 4: Normalize on write, re-key on move

Two invariants the editor cannot be trusted to maintain on its own.

**Files:**
- Modify: `services/shifts.ts` (add `normalizeAlloc`; apply in `upsertAllocation:12` and `patchAlloc:50`; extend `moveAllocation:79`)
- Test: `services/shifts.test.ts`

**Interfaces:**
- Consumes: `JobCrewAllocation.skipDays` (Task 1).
- Produces: `normalizeAlloc(alloc: JobCrewAllocation): JobCrewAllocation` — exported for tests; applied automatically by `upsertAllocation`, `setAllocSpan`, `setAllocDayWindow`, `moveAllocation`.

- [ ] **Step 1: Write the failing tests**

Append to `services/shifts.test.ts`:

```ts
describe('normalizeAlloc', () => {
  const base: JobCrewAllocation = {
    id: 's1', name: 'Crew', memberIds: ['m1'],
    startDate: '2026-08-19', endDate: '2026-08-21',
    startTime: '08:00', endTime: '17:00',
  };

  it('leaves a shift with no skip list untouched', () => {
    expect(normalizeAlloc(base)).toEqual(base);
  });

  // A skipped boundary day would make recomputeJobEnvelope read the job's start time off
  // a day nobody works, and would start the board bar on a hole.
  it('trims the envelope inward past a skipped first day', () => {
    const n = normalizeAlloc({ ...base, skipDays: ['2026-08-19'] });
    expect(n.startDate).toBe('2026-08-20');
    expect(n.endDate).toBe('2026-08-21');
    expect(n.skipDays ?? []).toEqual([]); // the skip is now outside the range
  });

  it('trims the envelope inward past a skipped last day', () => {
    const n = normalizeAlloc({ ...base, skipDays: ['2026-08-21'] });
    expect(n.startDate).toBe('2026-08-19');
    expect(n.endDate).toBe('2026-08-20');
  });

  it('keeps an interior skip and drops out-of-range skips', () => {
    const n = normalizeAlloc({ ...base, skipDays: ['2026-08-20', '2026-08-30', '2026-08-01'] });
    expect(n.startDate).toBe('2026-08-19');
    expect(n.endDate).toBe('2026-08-21');
    expect(n.skipDays).toEqual(['2026-08-20']);
  });

  it('leaves an all-skipped shift dated but working nothing, rather than inventing a day', () => {
    const n = normalizeAlloc({ ...base, skipDays: ['2026-08-19', '2026-08-20', '2026-08-21'] });
    expect(n.startDate).toBe('2026-08-19');
    expect(n.endDate).toBe('2026-08-21');
    expect(n.skipDays).toEqual(['2026-08-19', '2026-08-20', '2026-08-21']);
  });
});

describe('moveAllocation with skipped days', () => {
  const job = {
    id: 'j1', jobNumber: 'J-1', name: 'Deck', clientId: 'c1', estimateId: 'e1',
    address: 'x', stage: 'Scheduled', dateCreated: '2026-08-01',
    startDate: '2026-08-19T08:00:00', endDate: '2026-08-21T17:00:00',
    allocations: [{
      id: 's1', name: 'Crew', memberIds: ['m1'],
      startDate: '2026-08-19', endDate: '2026-08-21',
      startTime: '08:00', endTime: '17:00',
      skipDays: ['2026-08-20'],
      dailyHours: { '2026-08-21': { startTime: '07:00', endTime: '12:00' } },
    }],
  } as Job;

  it('re-keys skipDays by the same delta as dailyHours', () => {
    const moved = moveAllocation(job, 's1', '2026-08-26'); // +7 days
    const a = moved.allocations![0];
    expect(a.startDate).toBe('2026-08-26');
    expect(a.endDate).toBe('2026-08-28');
    expect(a.skipDays).toEqual(['2026-08-27']);
    expect(a.dailyHours).toEqual({ '2026-08-28': { startTime: '07:00', endTime: '12:00' } });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/shifts.test.ts`
Expected: FAIL — `normalizeAlloc is not a function`; the moved shift still skips `2026-08-20`.

- [ ] **Step 3: Implement `normalizeAlloc`**

`services/shifts.ts`, after the `addDaysToKey` helper (line 76) so it can use it:

```ts
/** Keep a shift's skip list and envelope consistent:
 *  - the envelope's first/last day is never itself skipped (a skipped boundary makes
 *    `recomputeJobEnvelope` read boundary times off a day nobody works, and starts the
 *    board bar on a hole), so trim inward past any skipped boundary days;
 *  - skip keys outside the envelope are dropped, so shrinking the range later cannot
 *    resurrect a skip the user can no longer see.
 *  An all-skipped shift is left alone: there is no day to trim to, and the editor blocks
 *  saving one, so silently inventing a worked day would be the worse failure. */
export const normalizeAlloc = (alloc: JobCrewAllocation): JobCrewAllocation => {
  const skips = alloc.skipDays;
  if (!skips?.length || !alloc.startDate || !alloc.endDate) return alloc;

  let start = alloc.startDate;
  let end = alloc.endDate;
  while (start <= end && skips.includes(start)) start = addDaysToKey(start, 1);
  while (end >= start && skips.includes(end)) end = addDaysToKey(end, -1);
  if (start > end) return alloc; // every day skipped — leave as authored

  const kept = skips.filter(k => k >= start && k <= end);
  return { ...alloc, startDate: start, endDate: end, skipDays: kept };
};
```

- [ ] **Step 4: Apply it on every write path**

In `services/shifts.ts`, `upsertAllocation` (line 12) — normalize the incoming shift:

```ts
export const upsertAllocation = (job: Job, allocation: JobCrewAllocation): Job => {
  const incoming = normalizeAlloc(allocation);
  const existing = job.allocations ?? [];
  const has = existing.some(a => a.id === incoming.id);
  const allocations = has
    ? existing.map(a => (a.id === incoming.id ? incoming : a))
    : [...existing, incoming];
  return syncCrew(job, allocations);
};
```

and `patchAlloc` (line 50) so `setAllocSpan` / `setAllocDayWindow` / `moveAllocation` all inherit it:

```ts
const patchAlloc = (job: Job, shiftId: string, patch: (a: JobCrewAllocation) => JobCrewAllocation): Job => {
  const existing = job.allocations ?? [];
  if (!existing.some(a => a.id === shiftId)) return job;
  return syncCrew(job, existing.map(a => (a.id === shiftId ? normalizeAlloc(patch(a)) : a)));
};
```

- [ ] **Step 5: Re-key `skipDays` in `moveAllocation`**

`services/shifts.ts`, in `moveAllocation` (line 79), beside the existing `dailyHours` re-key:

```ts
    const dailyHours = a.dailyHours
      ? Object.fromEntries(Object.entries(a.dailyHours).map(([k, w]) => [addDaysToKey(k, delta), w]))
      : a.dailyHours;
    // Skips are calendar days like the windows — a moved shift must skip the same day of
    // the shift, not the same date it used to skip.
    const skipDays = a.skipDays?.map(k => addDaysToKey(k, delta));
    return {
      ...a,
      startDate: newStartKey,
      endDate: a.endDate ? addDaysToKey(a.endDate, delta) : newStartKey,
      ...(dailyHours ? { dailyHours } : {}),
      ...(skipDays ? { skipDays } : {}),
    };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run services/shifts.test.ts`
Expected: PASS. Then `npx vitest run` — `normalizeAlloc` now runs on every shift write, so any pre-existing shift test is a canary. A fixture without `skipDays` returns early and must be byte-identical.

- [ ] **Step 7: Commit**

```bash
npx tsc --noEmit
git add services/shifts.ts services/shifts.test.ts
git commit -m "feat: normalize shift skip lists and re-key them on move"
```

---

### Task 5: Skipped days disappear from the read-only surfaces

**Files:**
- Modify: `components/views/JobScheduling/JobDetailsPanel.tsx` (`jobActualSchedule`, the `dated.filter` inside it)
- Modify: `components/views/JobScheduling/ShiftList.tsx:5,37`
- Test: `components/views/JobScheduling/JobDetailsPanel.test.tsx`, `components/views/JobScheduling/ShiftList.test.tsx`

**Interfaces:**
- Consumes: `allocCoversDay`, `allocWorkedDayKeys` (Task 1).
- Produces: no new signatures.

- [ ] **Step 1: Write the failing tests**

Append to `components/views/JobScheduling/JobDetailsPanel.test.tsx`, inside the existing `describe('jobActualSchedule')`:

```ts
  it('omits days the shift skips', () => {
    const skipping: Job = {
      ...job,
      startDate: '2026-06-08T12:00:00', endDate: '2026-06-10T12:00:00',
      allocations: [{
        id: 's1', name: 'Crew', memberIds: [],
        startDate: '2026-06-08', endDate: '2026-06-10',
        startTime: '08:00', endTime: '17:00',
        skipDays: ['2026-06-09'],
      }],
    };
    expect(jobActualSchedule(skipping).map(d => d.dateKey)).toEqual(['2026-06-08', '2026-06-10']);
  });
```

Append to `components/views/JobScheduling/ShiftList.test.tsx`:

```ts
it('does not list a day the shift skips', () => {
  const allocations = [{
    id: 'prep', name: 'Prep', memberIds: ['m1'],
    startDate: '2026-06-08', endDate: '2026-06-10',
    startTime: '08:00', endTime: '12:00',
    skipDays: ['2026-06-09'],
  }];
  render(<ShiftList {...props} allocations={allocations} />);
  expect(screen.getByText(/Jun 8/)).toBeTruthy();
  expect(screen.queryByText(/Jun 9/)).toBeNull();
  expect(screen.getByText(/Jun 10/)).toBeTruthy();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/views/JobScheduling/JobDetailsPanel.test.tsx components/views/JobScheduling/ShiftList.test.tsx`
Expected: FAIL — Jun 9 appears in both.

- [ ] **Step 3: Route `jobActualSchedule` through `allocCoversDay`**

In `components/views/JobScheduling/JobDetailsPanel.tsx`, inside `jobActualSchedule`, replace the per-day coverage filter:

```ts
    const windows = dated
      .filter(a => allocCoversDay(a, key))
      .map(a => allocDayWindow(a, key));
```

and add `allocCoversDay` to the `from '../../../services/scheduleEngine'` import on line 4.

- [ ] **Step 4: Route `ShiftList` through `allocWorkedDayKeys`**

In `components/views/JobScheduling/ShiftList.tsx`, replace line 37:

```ts
        const days = allocWorkedDayKeys(alloc, weekendDays);
```

Update the import on line 5 to `import { allocDayWindow, allocWorkedDayKeys } from '../../../services/scheduleEngine';` and drop `workingDayKeys` if nothing else in the file uses it. Note `allocWorkedDayKeys` takes the allocation and bare date keys — no `atNoon()` wrapping, it anchors internally. Leave `atNoon` in place; `fmtDay` still uses it.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run components/views/JobScheduling/JobDetailsPanel.test.tsx components/views/JobScheduling/ShiftList.test.tsx`
Expected: PASS.

`allocWorkedDayKeys` deliberately drops `workingDayKeys`' "fall back to the full span" behaviour. If a `ShiftList` test covering a weekend-only shift now renders no day rows, that is the new intended behaviour — update the test's expectation rather than reinstating the fallback.

- [ ] **Step 6: Commit**

```bash
npx tsc --noEmit
git add components/views/JobScheduling/JobDetailsPanel.tsx components/views/JobScheduling/ShiftList.tsx components/views/JobScheduling/JobDetailsPanel.test.tsx components/views/JobScheduling/ShiftList.test.tsx
git commit -m "feat: hide skipped days from Actual Schedule and the shift list"
```

---

### Task 6: `ShiftDayList` component

A controlled component: it owns no state, renders one row per day in the range, and reports
every change upward. Kept out of `CrewSelectionModal` (758 lines) so it is testable alone.

**Files:**
- Create: `components/modals/ShiftDayList.tsx`
- Create: `components/modals/ShiftDayList.test.tsx`
- Modify: `i18n/catalog.ts` (`enManual` ~line 25, `esManual` ~line 227 — near the other `CrewSelectionModal` shift-date keys)

**Interfaces:**
- Consumes: `fmtClock` from `services/productionBoard`.
- Produces:

```ts
export interface ShiftDayListProps {
  /** Every day in the shift's range, as local 'YYYY-MM-DD', in order. */
  dayKeys: string[];
  /** Days currently skipped (a subset of dayKeys). */
  skipDays: string[];
  /** Per-day window overrides; a day absent here uses defaultStart/defaultEnd. */
  dayHours: Record<string, { startTime: string; endTime: string }>;
  defaultStart: string;   // 'HH:mm'
  defaultEnd: string;     // 'HH:mm'
  /** JS getDay() values treated as weekends, for the Skip weekends action. */
  weekendDays: number[];
  onToggleDay: (dateKey: string, include: boolean) => void;
  onChangeDayWindow: (dateKey: string, window: { startTime: string; endTime: string }) => void;
  onSkipAll: (dateKeys: string[]) => void;   // replaces the whole skip list
}
export const ShiftDayList = (props: ShiftDayListProps) => …
```

- [ ] **Step 1: Add the i18n keys**

In `i18n/catalog.ts`, `enManual` (after `'modals.CrewSelectionModal.shiftDates'`, line 25):

```ts
  'modals.CrewSelectionModal.days': 'Days',
  'modals.CrewSelectionModal.skipWeekends': 'Skip weekends',
  'modals.CrewSelectionModal.allDaysOn': 'All on',
  'modals.CrewSelectionModal.allDaysOff': 'All off',
  'modals.CrewSelectionModal.daySkipped': 'Skipped',
  'modals.CrewSelectionModal.dayDefaultHint': 'Default {start} – {end} applies to days without their own times.',
  'modals.CrewSelectionModal.noDaysSelected': 'Select at least one day to schedule this shift.',
  'modals.CrewSelectionModal.includeDay': 'Work this day',
```

and in `esManual` (after the matching `shiftDates` key, line 227):

```ts
  'modals.CrewSelectionModal.days': 'Días',
  'modals.CrewSelectionModal.skipWeekends': 'Omitir fines de semana',
  'modals.CrewSelectionModal.allDaysOn': 'Todos',
  'modals.CrewSelectionModal.allDaysOff': 'Ninguno',
  'modals.CrewSelectionModal.daySkipped': 'Omitido',
  'modals.CrewSelectionModal.dayDefaultHint': 'El horario predeterminado {start} – {end} se aplica a los días sin horario propio.',
  'modals.CrewSelectionModal.noDaysSelected': 'Selecciona al menos un día para programar este turno.',
  'modals.CrewSelectionModal.includeDay': 'Trabajar este día',
```

Run: `npx vitest run i18n`
Expected: PASS — the catalog-integrity test confirms en and es agree.

- [ ] **Step 2: Write the failing component tests**

Create `components/modals/ShiftDayList.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShiftDayList } from './ShiftDayList';

// Wed 2026-08-19 → Sun 2026-08-23
const dayKeys = ['2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'];
const noop = () => {};
const props = {
  dayKeys, skipDays: [], dayHours: {},
  defaultStart: '08:00', defaultEnd: '17:00',
  weekendDays: [0, 6],
  onToggleDay: noop, onChangeDayWindow: noop, onSkipAll: noop,
};

describe('ShiftDayList', () => {
  it('renders one row per day with the default window', () => {
    render(<ShiftDayList {...props} />);
    expect(screen.getAllByRole('checkbox').length).toBe(5);
    expect(screen.getAllByDisplayValue('08:00').length).toBe(5);
    expect(screen.getAllByDisplayValue('17:00').length).toBe(5);
  });

  it('shows a per-day override instead of the default', () => {
    render(<ShiftDayList {...props} dayHours={{ '2026-08-21': { startTime: '07:00', endTime: '12:00' } }} />);
    expect(screen.getByDisplayValue('07:00')).toBeTruthy();
    expect(screen.getByDisplayValue('12:00')).toBeTruthy();
  });

  it('renders a skipped day unchecked, with no time inputs', () => {
    render(<ShiftDayList {...props} skipDays={['2026-08-20']} />);
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes[1].checked).toBe(false);
    // 4 worked days × 2 inputs
    expect(screen.getAllByDisplayValue('08:00').length).toBe(4);
    expect(screen.getByText('Skipped')).toBeTruthy();
  });

  it('reports a day being switched off', () => {
    const onToggleDay = vi.fn();
    render(<ShiftDayList {...props} onToggleDay={onToggleDay} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(onToggleDay).toHaveBeenCalledWith('2026-08-20', false);
  });

  it('reports a day being switched back on', () => {
    const onToggleDay = vi.fn();
    render(<ShiftDayList {...props} skipDays={['2026-08-20']} onToggleDay={onToggleDay} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(onToggleDay).toHaveBeenCalledWith('2026-08-20', true);
  });

  it('reports a per-day start time change', () => {
    const onChangeDayWindow = vi.fn();
    render(<ShiftDayList {...props} onChangeDayWindow={onChangeDayWindow} />);
    fireEvent.change(screen.getAllByDisplayValue('08:00')[0], { target: { value: '07:00' } });
    expect(onChangeDayWindow).toHaveBeenCalledWith('2026-08-19', { startTime: '07:00', endTime: '17:00' });
  });

  it('Skip weekends skips exactly the weekend days in range', () => {
    const onSkipAll = vi.fn();
    render(<ShiftDayList {...props} onSkipAll={onSkipAll} />);
    fireEvent.click(screen.getByText('Skip weekends'));
    expect(onSkipAll).toHaveBeenCalledWith(['2026-08-22', '2026-08-23']);
  });

  it('All off skips every day; All on clears the list', () => {
    const onSkipAll = vi.fn();
    render(<ShiftDayList {...props} skipDays={['2026-08-20']} onSkipAll={onSkipAll} />);
    fireEvent.click(screen.getByText('All off'));
    expect(onSkipAll).toHaveBeenCalledWith(dayKeys);
    fireEvent.click(screen.getByText('All on'));
    expect(onSkipAll).toHaveBeenCalledWith([]);
  });

  it('shows each worked day its hours', () => {
    render(<ShiftDayList {...props} dayHours={{ '2026-08-21': { startTime: '07:00', endTime: '12:00' } }} />);
    expect(screen.getAllByText('9.0h').length).toBe(4);
    expect(screen.getByText('5.0h')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run components/modals/ShiftDayList.test.tsx`
Expected: FAIL — cannot resolve `./ShiftDayList`.

- [ ] **Step 4: Implement the component**

Create `components/modals/ShiftDayList.tsx`:

```tsx
import React from 'react';
import { useTranslation } from '@/i18n/LanguageContext';

export interface ShiftDayListProps {
  /** Every day in the shift's range, as local 'YYYY-MM-DD', in order. */
  dayKeys: string[];
  /** Days currently skipped (a subset of dayKeys). */
  skipDays: string[];
  /** Per-day window overrides; a day absent here uses defaultStart/defaultEnd. */
  dayHours: Record<string, { startTime: string; endTime: string }>;
  defaultStart: string;
  defaultEnd: string;
  /** JS getDay() values treated as weekends, for the Skip weekends action. */
  weekendDays: number[];
  onToggleDay: (dateKey: string, include: boolean) => void;
  onChangeDayWindow: (dateKey: string, window: { startTime: string; endTime: string }) => void;
  /** Replaces the whole skip list (bulk actions). */
  onSkipAll: (dateKeys: string[]) => void;
}

const toH = (t: string) => { const [h, m] = t.split(':').map(Number); return h + (m || 0) / 60; };
const windowHours = (startTime: string, endTime: string) =>
  Math.max(0, Math.round((toH(endTime) - toH(startTime)) * 10) / 10);

// Bare date keys parse as UTC midnight and roll back a day in negative-offset zones.
const atNoon = (key: string) => new Date(`${key}T12:00:00`);

export const ShiftDayList = ({
  dayKeys, skipDays, dayHours, defaultStart, defaultEnd, weekendDays,
  onToggleDay, onChangeDayWindow, onSkipAll,
}: ShiftDayListProps) => {
  const { t } = useTranslation();
  const windowFor = (key: string) => dayHours[key] ?? { startTime: defaultStart, endTime: defaultEnd };

  const bulk = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick}
      className="text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:underline">
      {label}
    </button>
  );

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          {t('modals.CrewSelectionModal.days')}
        </span>
        <div className="flex items-center gap-3">
          {bulk(t('modals.CrewSelectionModal.skipWeekends'),
                () => onSkipAll(dayKeys.filter(k => weekendDays.includes(atNoon(k).getDay()))))}
          {bulk(t('modals.CrewSelectionModal.allDaysOn'), () => onSkipAll([]))}
          {bulk(t('modals.CrewSelectionModal.allDaysOff'), () => onSkipAll([...dayKeys]))}
        </div>
      </div>

      <div className="max-h-52 overflow-y-auto custom-scrollbar rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
        {dayKeys.map(key => {
          const skipped = skipDays.includes(key);
          const w = windowFor(key);
          return (
            <div key={key} className={`flex items-center gap-2 px-2.5 py-1.5 ${skipped ? 'bg-gray-50/70 dark:bg-gray-900/40' : ''}`}>
              <input
                type="checkbox"
                checked={!skipped}
                aria-label={t('modals.CrewSelectionModal.includeDay')}
                onChange={e => onToggleDay(key, e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-400 flex-shrink-0"
              />
              <span className={`w-28 shrink-0 text-xs font-semibold ${skipped ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200'}`}>
                {atNoon(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>

              {skipped ? (
                <span className="flex-1 text-xs font-medium text-gray-400">
                  {t('modals.CrewSelectionModal.daySkipped')}
                </span>
              ) : (
                <>
                  <input
                    type="time"
                    value={w.startTime}
                    onChange={e => onChangeDayWindow(key, { ...w, startTime: e.target.value })}
                    className="p-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md text-xs outline-none focus:ring-2 focus:ring-primary-400/20 focus:border-primary-400"
                  />
                  <span className="text-gray-400 text-xs">–</span>
                  <input
                    type="time"
                    value={w.endTime}
                    onChange={e => onChangeDayWindow(key, { ...w, endTime: e.target.value })}
                    className="p-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md text-xs outline-none focus:ring-2 focus:ring-primary-400/20 focus:border-primary-400"
                  />
                  <span className="ml-auto text-[11px] font-bold tabular-nums text-gray-500 dark:text-gray-400">
                    {windowHours(w.startTime, w.endTime).toFixed(1)}h
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-1.5 text-[11px] text-gray-400">
        {t('modals.CrewSelectionModal.dayDefaultHint', { start: defaultStart, end: defaultEnd })}
      </p>
    </div>
  );
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run components/modals/ShiftDayList.test.tsx`
Expected: PASS. Tests assert English copy, so they exercise the real catalog — if a string assertion fails, the key is missing from `enManual`, not wrong in the test.

- [ ] **Step 6: Commit**

```bash
npx tsc --noEmit
git add components/modals/ShiftDayList.tsx components/modals/ShiftDayList.test.tsx i18n/catalog.ts
git commit -m "feat: ShiftDayList — per-day include toggle and window editor"
```

---

### Task 7: Wire the day list into `CrewSelectionModal`

**Files:**
- Modify: `components/modals/CrewSelectionModal.tsx` — imports, draft state (~line 129), open effect (155-190), `handleSave` (341-366), `dayKeys`/`dayCountLabel` (385-388), the Shift dates box (531-543), grid day columns (595-612) and cells (660-714), footer.
- Test: `components/modals/CrewSelectionModal.test.tsx`

**Interfaces:**
- Consumes: `ShiftDayList` (Task 6); `JobCrewAllocation.skipDays` (Task 1).
- Produces: the `onSave` payload now carries `skipDays: string[]` and `dailyHours: Record<string, {startTime, endTime}>` in its `Partial<JobCrewAllocation>`.

- [ ] **Step 1: Write the failing tests**

Append to `components/modals/CrewSelectionModal.test.tsx`. The day list only renders in the
**full** modal (`!simplified`), so these use the file's existing `fullBase` fixture from
`describe('CrewSelectionModal — full modal (Job Scheduling shift)')`, not the `base` one.
The confirm button reads **"Confirm Schedule"** (`confirmSchedule`) when no `confirmLabel`
override is passed, and it is already `disabled` when no crew is selected — so give these
`currentCrew={staff}` and a shift with members, or the disabled assertion proves nothing.

```tsx
describe('CrewSelectionModal — shift day list', () => {
  const spanning = {
    id: 'shift-1', name: 'General Crew', memberIds: ['m1'],
    startDate: '2026-08-19', endDate: '2026-08-21',   // Wed → Fri
    startTime: '08:00', endTime: '17:00',
  };
  const dayBase = {
    isOpen: true as const,
    onClose: vi.fn(),
    onSave: vi.fn(),
    allStaff: staff,
    existingJobs: [],
    jobStartDate: '2026-08-19T08:00:00',
    jobEndDate: '2026-08-21T17:00:00',
    hideWorkOrder: true as const,
    currentCrew: [staff[0]],
  };

  it('seeds skipped days and per-day windows from the shift being edited', () => {
    render(<CrewSelectionModal {...dayBase} allocationToEdit={{
      ...spanning,
      skipDays: ['2026-08-20'],
      dailyHours: { '2026-08-21': { startTime: '07:00', endTime: '12:00' } },
    }} />);
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes.map(b => b.checked)).toEqual([true, false, true]);
    expect(screen.getByDisplayValue('07:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12:00')).toBeInTheDocument();
  });

  it('counts only worked days in the day badge', () => {
    render(<CrewSelectionModal {...dayBase} allocationToEdit={{ ...spanning, skipDays: ['2026-08-20'] }} />);
    expect(screen.getAllByText('2 days').length).toBeGreaterThan(0);
    expect(screen.queryByText('3 days')).toBeNull();
  });

  it('round-trips skipDays and dailyHours through onSave', () => {
    const onSave = vi.fn();
    render(<CrewSelectionModal {...dayBase} onSave={onSave} allocationToEdit={{
      ...spanning,
      skipDays: ['2026-08-20'],
      dailyHours: { '2026-08-21': { startTime: '07:00', endTime: '12:00' } },
    }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    const payload = onSave.mock.calls[0][1];
    expect(payload.skipDays).toEqual(['2026-08-20']);
    expect(payload.dailyHours).toEqual({ '2026-08-21': { startTime: '07:00', endTime: '12:00' } });
  });

  it('switching a day off adds it to the saved skip list', () => {
    const onSave = vi.fn();
    render(<CrewSelectionModal {...dayBase} onSave={onSave} allocationToEdit={spanning} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    expect(onSave.mock.calls[0][1].skipDays).toEqual(['2026-08-20']);
  });

  it('blocks saving when every day is skipped', () => {
    const onSave = vi.fn();
    render(<CrewSelectionModal {...dayBase} onSave={onSave} allocationToEdit={{
      ...spanning, skipDays: ['2026-08-19', '2026-08-20', '2026-08-21'],
    }} />);
    expect(screen.getByText('Select at least one day to schedule this shift.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
```

**DOM-order hazard.** An existing test (`'keeps an edited default start time through a parent
re-render'`) grabs `container.querySelectorAll('input[type="time"]')[0]` and expects the
**default** Start Time. `ShiftDayList` adds many `input[type="time"]` elements, so it must
render *after* the left settings column in DOM order — which it does, since the left column
(`md:w-1/3`) precedes the Shift dates box (`md:w-2/3`) in the JSX. Do not reorder those two
columns, and if that test breaks, this is why.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/modals/CrewSelectionModal.test.tsx`
Expected: FAIL — no checkboxes, badge reads "3 days", payload has no `skipDays`.

- [ ] **Step 3: Add draft state and seed it**

In `components/modals/CrewSelectionModal.tsx`, after `defaultEndTime` (line 130):

```ts
  // Which days of the range the shift skips, and any per-day window overrides. Both are
  // keyed by local 'YYYY-MM-DD' and are seeded from the shift being edited.
  const [skipDays, setSkipDays] = useState<string[]>([]);
  const [dayHours, setDayHours] = useState<Record<string, { startTime: string; endTime: string }>>({});
```

In the open effect, in the `allocationToEdit` branch (after line 161):

```ts
          setSkipDays(allocationToEdit.skipDays ?? []);
          setDayHours({ ...(allocationToEdit.dailyHours ?? {}) });
```

and in the "Defaults for New" branch (after line 176):

```ts
          setSkipDays([]);
          setDayHours({});
```

- [ ] **Step 4: Derive worked days, and count them**

Replace `dayKeys` / `dayCountLabel` (lines 385-388):

```ts
  // Column alignment uses the FULL range (skipped days keep their greyed column so the
  // scheduler can switch them back on); capacity roll-ups use worked days only.
  const dayKeys = dateRange.map(toLocalDateKey);
  const workedDayKeys = dayKeys.filter(k => !skipDays.includes(k));
  const dayCountLabel = workedDayKeys.length === 1
      ? t('modals.CrewSelectionModal.dayLower')
      : t('modals.CrewSelectionModal.daysLower', { count: workedDayKeys.length });
```

Then change the shift-capacity meter (line 401) to measure worked days only:

```ts
      shiftBars[m.id] = computeShiftCapacity(m, workedDayKeys, hoursAssignments, defaultDailyHours);
```

Leave `dayBars` on `dayKeys` so its indices still line up with the `dateRange.map` header.

- [ ] **Step 5: Render the day list**

In the Shift dates box, after the two `DatePicker`s (closing `</div>` at line 543):

```tsx
                <ShiftDayList
                    dayKeys={dayKeys}
                    skipDays={skipDays}
                    dayHours={dayHours}
                    defaultStart={defaultStartTime}
                    defaultEnd={defaultEndTime}
                    weekendDays={weekendDays}
                    onToggleDay={(key, include) => setSkipDays(prev =>
                        include ? prev.filter(k => k !== key) : (prev.includes(key) ? prev : [...prev, key]))}
                    onChangeDayWindow={(key, w) => setDayHours(prev => ({ ...prev, [key]: w }))}
                    onSkipAll={setSkipDays}
                />
```

Import it at the top: `import { ShiftDayList } from './ShiftDayList';`

- [ ] **Step 6: Grey the skipped columns in the grid**

In the day `<th>` (line 595), extend the class expression so a skipped column reads as off, and hide its capacity chips:

```tsx
                            {dateRange.map((d, dayIdx) => {
                                const isWeekend = weekendDays.includes(d.getDay());
                                const dayKey = toLocalDateKey(d);
                                const isSkipped = skipDays.includes(dayKey);
                                const bars = dayBars[dayIdx];
                                return (
                                    <th key={d.toISOString()} className={`p-2 border-b border-l border-gray-200 dark:border-gray-700 text-center align-bottom ${isSkipped ? 'bg-gray-100 dark:bg-gray-800 opacity-60' : isWeekend ? 'bg-gray-100/50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-900'}`} style={{ width: COL_DAY, minWidth: COL_DAY }}>
```

and guard the chips (line 604): `{selectedMembers.length > 0 && !isSkipped && (`.

In the member cell (line 660), disable the hours input on a skipped day so the greyed column cannot take new hours:

```tsx
                                {dateRange.map(d => {
                                    const dStr = toLocalDateKey(d);
                                    const isSkipped = skipDays.includes(dStr);
```

give the `<td>` the same `isSkipped ? 'bg-gray-100 dark:bg-gray-800 opacity-60' : …` treatment, add `disabled={isSkipped}` to the `<input type="number">`, and when `isSkipped` render the caption as `t('modals.CrewSelectionModal.daySkipped')` instead of the hours-left text.

The existing hours are left in `hoursAssignments` untouched — guard, don't purge, so re-including the day brings them back.

- [ ] **Step 7: Persist, and block the empty case**

In `handleSave` (line 341), add both fields to the scheduled branch:

```ts
            memberIds: selectedIds,
            hoursAssignments: hoursAssignments,
            skipDays,
            dailyHours: dayHours,
```

`dailyHours` was never persisted before this line — that is a fix in its own right, not just plumbing for the new feature.

Guard the top of the function:

```ts
  const noWorkedDays = !isUnscheduled && dateRange.length > 0 && workedDayKeys.length === 0;

  const handleSave = () => {
      if (noWorkedDays) return;
```

and in the footer, disable the confirm button with `disabled={noWorkedDays}` plus an inline message beside it:

```tsx
      {noWorkedDays && (
          <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
              {t('modals.CrewSelectionModal.noDaysSelected')}
          </span>
      )}
```

Read the actual footer markup before inserting; place the message where it is visible next to the button.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run components/modals/CrewSelectionModal.test.tsx`
Expected: PASS.

- [ ] **Step 9: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. `CrewSelectionModal` has existing tests around cell hours and capacity meters; a failure there most likely comes from Step 4's `workedDayKeys` swap in `computeShiftCapacity` — verify against a fixture with no `skipDays`, where `workedDayKeys` must equal `dayKeys` exactly.

- [ ] **Step 10: Commit**

```bash
git add components/modals/CrewSelectionModal.tsx components/modals/CrewSelectionModal.test.tsx
git commit -m "feat: skip days and set per-day times in the shift editor"
```

---

### Task 8: Manual verification in the running app

Automated tests do not prove the surfaces agree with each other, which is exactly the class
of bug that started this work (Daily Hours reading 12:00 PM – 12:00 PM while the shift said
8:00 AM – 5:00 PM).

**Files:** none — verification only.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` and open http://localhost:3000/

- [ ] **Step 2: Walk the feature**

- [ ] Job Scheduling → open a job → **View shifts** → **Edit** a shift.
- [ ] Set the range to a 3-day span. Uncheck the middle day. The badge drops to **2 days**, and the middle grid column greys out with its input disabled.
- [ ] Set the last day to 07:00–12:00. Its row reads **5.0h**; the other worked day still reads the default.
- [ ] Apply. Confirm on the week board that the bar appears on days 1 and 3 and **not** on day 2.
- [ ] Open the job drawer: **Actual Schedule → Daily Hours** lists two rows, the second reading 7:00 AM – 12:00 PM. The skipped day is absent.
- [ ] Check a crew member's capacity for the skipped day — the shift contributes 0h, and their "hours left" reflects that.
- [ ] Re-open the editor, re-check the skipped day: its previous times come back (guard, don't purge).
- [ ] Extend the range across a weekend and click **Skip weekends** — exactly Sat/Sun get unchecked.
- [ ] Uncheck every day: the confirm button disables and the "Select at least one day" message shows.
- [ ] Drag the shift to a later week on the board, then re-open it: the same *day of the shift* is still skipped, not the same calendar date.

- [ ] **Step 3: Record the result**

If any step misbehaves, use `superpowers:systematic-debugging` before patching — find the root cause rather than adjusting the symptom. Note anything deferred.

---

## Notes for the executor

- **Out of scope, do not fix here:** conflict detection reasons over the job envelope, not per-shift days (`services/rescheduleIssues.ts:110`, `services/resolveSameDayConflicts.ts:183`). A skipped day can still read as occupied in an overlap warning. This coarseness already exists for any multi-shift job with a gap between shifts; making conflicts shift-aware is a separate change. If you notice it during Task 8, note it — don't expand scope.
- **The uncommitted `JobDetailsPanel` fix.** The branch may carry an uncommitted fix to `jobActualSchedule` (Actual Schedule reading 12:00 PM – 12:00 PM from a noon-anchored envelope) plus its tests. Task 5 modifies that same function. Commit it first, separately, so Task 5's diff stays about skipped days.
- **Per-crew-member skipping is already possible** via `hoursAssignments` (Mike Wed+Fri, Sara Wed only). Don't build a second mechanism for it.
