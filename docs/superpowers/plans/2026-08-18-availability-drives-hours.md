# Availability Drives a Member's Hours — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A crew member's schedule (off days, half days) becomes the source of truth for their scheduled hours — the grid, capacity readouts, and per-day totals all follow it, saving a schedule trims bookings that no longer fit, and hours a scheduler types anyway are kept and flagged.

**Architecture:** One primitive, `availableHoursOn(member, dayKey, standardDay, defaultBreaks)`, replaces every "a standard day unless they're off" hardcode. A pure `availabilityTrim.ts` turns a schedule change into a list of booking trims, applied through the existing `setMemberDayHoursPreservingSpan`. `MemberDayCell` gains three flags so the grid can render amber warnings instead of hiding work.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react, Tailwind classes inline. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-18-availability-drives-hours-design.md`

## Global Constraints

- **No schedule entry for a day → `standardDay`, unchanged.** Never derive a member's hours from the *fallback* company window; only a schedule entry the user actually set may change their hours. This is what keeps existing capacity numbers (and the existing 751 tests) stable.
- **A window's hours are the window less its unpaid breaks**, via the existing `workingDayCapacity(windowHours, breaks)` from `services/crewBreaks.ts`. Paid breaks stay in.
- **Never block an assignment.** Every availability conflict is advisory: amber ring plus a tooltip line. The scheduler's typed number always survives.
- **Pure services, no `Date.now()` in them.** Every service function takes its inputs and returns new values; `Job` objects are replaced, never mutated in place.
- **i18n:** every user-visible string goes through `t(...)` with a key added to BOTH `enManual` and the Spanish block in `i18n/catalog.ts`. Key convention: `<area>.<Component>.<descriptor>`.
- **Tests:** Vitest. Run a single file with `npx vitest run <path>`; the whole suite with `npm test`. Typecheck with `npm run lint` (that's `tsc --noEmit`).
- **Commit style:** conventional prefix, lowercase subject, and every commit ends with the trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Run `npm test` and `npm run lint` before every commit.** Both must be green.

---

### Task 1: The availability primitive

The one function every later task reads. Lives beside `resolveDayAvailability`, which already resolves a member-day's window.

**Files:**
- Modify: `services/crewAvailability.ts` (append; it currently ends with `windowOutsideAvailability`)
- Test: `services/crewAvailability.test.ts` (append a new `describe`)

**Interfaces:**
- Consumes: `resolveBreaks`, `workingDayCapacity` from `services/crewBreaks.ts`; `configFromSettings` from `services/scheduleEngine.ts`; types `CrewMember`, `CrewBreak`, `SchedulingSettings` from `../types`.
- Produces:
  - `availableHoursOn(member: CrewMember, dayKey: string, standardDay: number, defaultBreaks?: CrewBreak[]): number`
  - `companyStandardDay(scheduling: SchedulingSettings | undefined): number`

- [ ] **Step 1: Write the failing tests**

Append to `services/crewAvailability.test.ts`. Check the top of that file first — it already defines helpers; if a `member(...)` factory exists, reuse it instead of redefining.

```ts
describe('availableHoursOn', () => {
  const lunch = { id: 'b1', label: 'Lunch', durationMinutes: 60, paid: false, startTime: '12:00' };

  it('falls back to the standard day when the member has no entry for that day', () => {
    const m = { id: 'm1', name: 'Mike' } as CrewMember;
    expect(availableHoursOn(m, '2026-08-18', 8, [lunch])).toBe(8);
  });

  it('is zero on a day the member is off', () => {
    const m = { id: 'm1', name: 'Mike', schedule: {
      '2026-08-18': { date: '2026-08-18', startTime: '08:00', endTime: '17:00', isOff: true },
    } } as CrewMember;
    expect(availableHoursOn(m, '2026-08-18', 8, [lunch])).toBe(0);
  });

  it('is the half-day window on a morning-only day, with no lunch inside it', () => {
    const m = { id: 'm1', name: 'Mike', schedule: {
      '2026-08-18': { date: '2026-08-18', startTime: '08:00', endTime: '12:00', isOff: false },
    } } as CrewMember;
    expect(availableHoursOn(m, '2026-08-18', 8, [lunch])).toBe(4);
  });

  it('carves an unpaid lunch out of a full window, so 8am-5pm holds 8h of work', () => {
    const m = { id: 'm1', name: 'Mike', schedule: {
      '2026-08-18': { date: '2026-08-18', startTime: '08:00', endTime: '17:00', isOff: false },
    } } as CrewMember;
    expect(availableHoursOn(m, '2026-08-18', 8, [lunch])).toBe(8);
  });

  it('honors a per-day break override ahead of the company default', () => {
    const m = { id: 'm1', name: 'Mike', schedule: {
      '2026-08-18': { date: '2026-08-18', startTime: '08:00', endTime: '17:00', isOff: false, breaksOverride: [] },
    } } as CrewMember;
    expect(availableHoursOn(m, '2026-08-18', 8, [lunch])).toBe(9);
  });

  it('falls back to the standard day when an entry carries no times', () => {
    const m = { id: 'm1', name: 'Mike', schedule: {
      '2026-08-18': { date: '2026-08-18', startTime: '', endTime: '', isOff: false },
    } as CrewMember['schedule'] } as CrewMember;
    expect(availableHoursOn(m, '2026-08-18', 8, [lunch])).toBe(8);
  });
});

describe('companyStandardDay', () => {
  it('takes an explicit crew daily capacity as-is', () => {
    expect(companyStandardDay({
      nonWorkingWeekdays: [0, 6], holidays: [], rainDays: [],
      workDayStartHour: 8, workDayEndHour: 17, crewDailyCapacityHours: 7.5,
    })).toBe(7.5);
  });

  it('derives the day from the company window less unpaid breaks when unset', () => {
    expect(companyStandardDay({
      nonWorkingWeekdays: [0, 6], holidays: [], rainDays: [],
      workDayStartHour: 8, workDayEndHour: 17,
      defaultBreaks: [{ id: 'b1', durationMinutes: 60, paid: false, startTime: '12:00' }],
    })).toBe(8);
  });

  it('falls back to the default 8am-5pm window with no settings at all', () => {
    expect(companyStandardDay(undefined)).toBe(9);
  });
});
```

Add `availableHoursOn, companyStandardDay` to the file's existing import from `./crewAvailability`, and make sure `CrewMember` is imported as a type.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/crewAvailability.test.ts`
Expected: FAIL — `availableHoursOn is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `services/crewAvailability.ts`, and extend its import line at the top:

```ts
import type { CrewBreak, CrewMember, SchedulingSettings } from '../types';
import { resolveBreaks, workingDayCapacity } from './crewBreaks';
import { configFromSettings } from './scheduleEngine';
```

```ts
/** Hours a member can actually work on one day — the yardstick every per-person figure
 *  is measured against.
 *
 *  No schedule entry means the company standard day: deriving from the *fallback*
 *  window would quietly re-rate every member who has never had a schedule set. Only a
 *  schedule someone actually typed changes their hours. Off is zero. Otherwise it is
 *  their window less its unpaid breaks — the same basis as `standardDay` itself, so
 *  8am–5pm with an unpaid hour lunch stays 8h and 8am–12pm becomes 4h. */
export const availableHoursOn = (
  member: CrewMember,
  dayKey: string,
  standardDay: number,
  defaultBreaks: CrewBreak[] = [],
): number => {
  const entry = member.schedule?.[dayKey];
  if (!entry) return standardDay;
  if (entry.isOff) return 0;
  if (!entry.startTime || !entry.endTime) return standardDay;
  return workingDayCapacity(
    windowHoursOf(entry.startTime, entry.endTime),
    resolveBreaks(entry, defaultBreaks),
  );
};

/** The company's standard working day: the configured per-crew capacity when set, else
 *  the company window less its unpaid default breaks. Shared so App and the scheduling
 *  view can never disagree about the number. */
export const companyStandardDay = (scheduling: SchedulingSettings | undefined): number => {
  if (scheduling?.crewDailyCapacityHours) return scheduling.crewDailyCapacityHours;
  const cfg = configFromSettings(scheduling, false);
  return workingDayCapacity(cfg.workDayEndHour - cfg.workDayStartHour, scheduling?.defaultBreaks ?? []);
};
```

The file already has a private `toH`; add a private helper beside it if one isn't already there:

```ts
const windowHoursOf = (startTime: string, endTime: string): number =>
  Math.max(0, round1(toH(endTime) - toH(startTime)));
```

(`toH` and `round1` already exist in this file — reuse them rather than redefining.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run services/crewAvailability.test.ts` → PASS
Run: `npm test && npm run lint` → both green.

- [ ] **Step 5: Commit**

```bash
git add services/crewAvailability.ts services/crewAvailability.test.ts
git commit -m "feat(scheduling): one figure for the hours a member can work

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Weekly capacity follows the schedule

`computeWeeklyHours` currently credits `standardDay` for every non-weekend day the member isn't off, so a half day counts as a whole one. That figure is the `25 / 54h` denominator in the crew grid.

**Files:**
- Modify: `services/crewWeeklyHours.ts:124-142` (`computeWeeklyHours`) and its `CommitmentOptions` interface at `:13-24`
- Modify: `services/crewHoursGrid.ts:371` (pass `defaultBreaks` through)
- Modify: `components/modals/CrewSelectionModal.tsx:417-422` (`capacityOpts` gains `defaultBreaks`)
- Test: `services/crewWeeklyHours.test.ts`

**Interfaces:**
- Consumes: `availableHoursOn` from Task 1.
- Produces: `CommitmentOptions.defaultBreaks?: CrewBreak[]`; `computeWeeklyHours` keeps its exact signature.

- [ ] **Step 1: Write the failing test**

Append to `services/crewWeeklyHours.test.ts` (reuse the file's existing `member(...)` / week-days helpers if present):

```ts
describe('computeWeeklyHours — capacity follows the member schedule', () => {
  const lunch = { id: 'b1', durationMinutes: 60, paid: false, startTime: '12:00' };
  // Mon 2026-08-17 .. Fri 2026-08-21
  const week = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21']
    .map(k => new Date(`${k}T12:00:00`));

  it('counts a half day as half a day and an off day as none', () => {
    const m = { id: 'm1', name: 'Mike', schedule: {
      '2026-08-17': { date: '2026-08-17', startTime: '08:00', endTime: '17:00', isOff: false },
      '2026-08-18': { date: '2026-08-18', startTime: '08:00', endTime: '12:00', isOff: false },
      '2026-08-19': { date: '2026-08-19', startTime: '08:00', endTime: '17:00', isOff: true },
    } } as CrewMember;
    // Mon 8 + Tue 4 + Wed 0 (off) + Thu 8 + Fri 8 (no entry -> standard day) = 28
    const r = computeWeeklyHours(m, week, [], { standardDay: 8, weekendDays: [0, 6], defaultBreaks: [lunch] });
    expect(r.capacity).toBe(28);
  });

  it('leaves a member with no schedule on the standard day for every weekday', () => {
    const m = { id: 'm2', name: 'Ana' } as CrewMember;
    const r = computeWeeklyHours(m, week, [], { standardDay: 8, weekendDays: [0, 6], defaultBreaks: [lunch] });
    expect(r.capacity).toBe(40);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run services/crewWeeklyHours.test.ts`
Expected: FAIL — capacity is `40`, not `28` (the half day and the off day both counted as 8/0 wrongly: today off gives 0 but the half day gives 8).

- [ ] **Step 3: Write the implementation**

In `services/crewWeeklyHours.ts`, add to `CommitmentOptions`:

```ts
  /** Company-default breaks, so a member-day's window can be read net of unpaid time.
   *  Defaults to [] — callers that don't pass it keep the pre-availability behavior
   *  for members whose days carry no schedule entry. */
  defaultBreaks?: CrewBreak[];
```

Import the primitive and the type:

```ts
import type { CrewBreak, CrewMember, Job, JobCrewAllocation } from '../types';
import { availableHoursOn } from './crewAvailability';
```

Replace the capacity accumulation inside `computeWeeklyHours`:

```ts
  for (const d of weekDays) {
    const dateKey = toLocalDateKey(d);
    const nonWorking = weekendDays.includes(d.getDay());
    // The member's own day, not a blanket standard one: a half day is half a day.
    if (!nonWorking) capacity += availableHoursOn(member, dateKey, standardDay, opts.defaultBreaks ?? []);
    assigned += committedHoursOnDay(member, jobs, dateKey, { ...opts, standardDay });
  }
```

Then thread `defaultBreaks` through the two call sites so the figure is right on screen:

- `services/crewHoursGrid.ts:371` becomes:
  ```ts
    const baseCapacity = computeWeeklyHours(m, weekDays, [], { standardDay, weekendDays, defaultBreaks }).capacity;
  ```
  (`defaultBreaks` is already a parameter of `buildCrewHoursGrid`.)
- `components/modals/CrewSelectionModal.tsx:417-422` — add `defaultBreaks,` to the `capacityOpts` object literal (the component already has `defaultBreaks` in scope; confirm the identifier before editing).

**Watch for a circular import:** `crewAvailability` must not import `crewWeeklyHours`. It doesn't — it imports only `crewBreaks`, `scheduleEngine`, and types. Keep it that way.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run services/crewWeeklyHours.test.ts` → PASS
Run: `npm test` → green. If a pre-existing test's capacity figure changed, read it: it is only correct to update when the member in that fixture has an explicit half-day or off entry. A changed number for a member with **no** schedule entry means the implementation broke the Global Constraint — fix the code, not the test. Any test you do update gets a trailing comment saying why.
Run: `npm run lint` → clean.

- [ ] **Step 5: Commit**

```bash
git add services/crewWeeklyHours.ts services/crewWeeklyHours.test.ts services/crewHoursGrid.ts components/modals/CrewSelectionModal.tsx
git commit -m "fix(scheduling): a half day counts as half a day of capacity

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The day caption follows the schedule

`computeDayLoad` powers the crew picker's "X of Yh" line. It has the same hardcode.

**Files:**
- Modify: `services/shiftCapacity.ts:150-165` (`computeDayLoad`)
- Test: `services/shiftCapacity.test.ts` (find the file's existing `computeDayLoad` describe and append to it)

**Interfaces:**
- Consumes: `availableHoursOn` from Task 1.
- Produces: `computeDayLoad`'s `opts` gains `defaultBreaks?: CrewBreak[]`; return shape `DayLoad` is unchanged.

- [ ] **Step 1: Write the failing test**

```ts
it('measures a half day against the half-day window', () => {
  const m = { id: 'm1', name: 'Mike', schedule: {
    '2026-08-18': { date: '2026-08-18', startTime: '08:00', endTime: '12:00', isOff: false },
  } } as CrewMember;
  const load = computeDayLoad(m, '2026-08-18', [], 4, { standardDay: 8 });
  expect(load.capacity).toBe(4);
  expect(load.over).toBe(0);
});

it('reports hours past a half day as over', () => {
  const m = { id: 'm1', name: 'Mike', schedule: {
    '2026-08-18': { date: '2026-08-18', startTime: '08:00', endTime: '12:00', isOff: false },
  } } as CrewMember;
  const load = computeDayLoad(m, '2026-08-18', [], 9, { standardDay: 8 });
  expect(load.capacity).toBe(4);
  expect(load.over).toBe(5);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run services/shiftCapacity.test.ts`
Expected: FAIL — `capacity` is `8`, expected `4`.

- [ ] **Step 3: Write the implementation**

In `services/shiftCapacity.ts`, import the primitive:

```ts
import { availableHoursOn } from './crewAvailability';
```

Widen the opts and replace the capacity line in `computeDayLoad`:

```ts
export const computeDayLoad = (
  member: CrewMember,
  dayKey: string,
  jobs: Job[],
  cellHours: number,
  opts: { standardDay?: number; excludeJobId?: string; excludeAllocationId?: string; defaultBreaks?: CrewBreak[] } = {},
): DayLoad => {
  // Their own day: off is zero, a half day is half, no entry is the standard day.
  const capacity = availableHoursOn(member, dayKey, opts.standardDay ?? 8, opts.defaultBreaks ?? []);
```

Add `CrewBreak` to the file's type import. Leave `memberDayCapacity` and `isOffOn` alone — they measure the shift window, which is a fact about the job, not the person.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run services/shiftCapacity.test.ts` → PASS
Run: `npm test && npm run lint` → green. Same rule as Task 2 for any pre-existing figure that moves.

- [ ] **Step 5: Commit**

```bash
git add services/shiftCapacity.ts services/shiftCapacity.test.ts
git commit -m "fix(scheduling): the day caption measures the member's own day

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The grid model carries availability and flags

`buildCrewHoursGrid` gets the per-day available hours onto each row, uses it for the column totals, and marks each chip that fights the member's schedule. Rendering comes in Task 5 — this task is data only.

**Files:**
- Modify: `services/crewHoursGrid.ts` — `MemberDayCell` (`:8-19`), `MemberRow` (`:20-37`), the row loop (`:377-421`), the day totals (`:437-450`)
- Test: `services/crewHoursGrid.test.ts`

**Interfaces:**
- Consumes: `availableHoursOn` (Task 1); `windowOutsideAvailability` and `resolveDayAvailability`, both already imported in this file.
- Produces:
  - `MemberDayCell.onOffDay?: boolean`
  - `MemberDayCell.outsideAvailability?: { before: number; after: number }`
  - `MemberDayCell.overAvailableHours?: number`
  - `MemberRow.availableHoursByDay: Record<string, number>`

- [ ] **Step 1: Write the failing tests**

Append to `services/crewHoursGrid.test.ts`. Model the fixtures on the file's existing `buildCrewHoursGrid` describe — copy its `weekDays`/`member(...)` setup rather than inventing new shapes.

```ts
describe('buildCrewHoursGrid — availability flags on the cells', () => {
  const lunch = { id: 'b1', durationMinutes: 60, paid: false, startTime: '12:00' };
  const days = [new Date('2026-08-18T12:00:00')];
  const shiftJob = () => job({ allocations: [{ id: 'a', name: 'Crew',
    startDate: '2026-08-18', endDate: '2026-08-18', startTime: '13:00', endTime: '17:00',
    memberIds: ['m1'], hoursAssignments: { m1: { '2026-08-18': 4 } } }] });

  it('flags a chip that sits outside the member\'s working window', () => {
    // They work mornings; the shift runs 1–5pm, entirely after their day ends.
    const m = member({ schedule: {
      '2026-08-18': { date: '2026-08-18', startTime: '08:00', endTime: '12:00', isOff: false },
    } });
    const model = buildCrewHoursGrid([m], [shiftJob()], [], days, WEEKEND, 8, [lunch]);
    const cell = model.rows[0].cellsByDay['2026-08-18'][0];
    expect(cell.outsideAvailability).toEqual({ before: 0, after: 5 });
  });

  it('flags a chip on a day the member is off, and keeps the chip', () => {
    const m = member({ schedule: {
      '2026-08-18': { date: '2026-08-18', startTime: '08:00', endTime: '17:00', isOff: true },
    } });
    const model = buildCrewHoursGrid([m], [shiftJob()], [], days, WEEKEND, 8, [lunch]);
    const cell = model.rows[0].cellsByDay['2026-08-18'][0];
    expect(cell.onOffDay).toBe(true);
    expect(cell.hours).toBe(4); // the booking is still visible, not hidden
  });

  it('reports hours booked past what the member can work that day', () => {
    const m = member({ schedule: {
      '2026-08-18': { date: '2026-08-18', startTime: '08:00', endTime: '12:00', isOff: false },
    } });
    const model = buildCrewHoursGrid([m], [shiftJob()], [], days, WEEKEND, 8, [lunch]);
    // 4h booked against a 4h day is not over; the flag is about volume only.
    expect(model.rows[0].cellsByDay['2026-08-18'][0].overAvailableHours).toBeUndefined();
    expect(model.rows[0].availableHoursByDay['2026-08-18']).toBe(4);
  });

  it('leaves an in-window chip on a normal day unflagged', () => {
    const m = member({ schedule: {
      '2026-08-18': { date: '2026-08-18', startTime: '08:00', endTime: '17:00', isOff: false },
    } });
    const model = buildCrewHoursGrid([m], [shiftJob()], [], days, WEEKEND, 8, [lunch]);
    const cell = model.rows[0].cellsByDay['2026-08-18'][0];
    expect(cell.onOffDay).toBeUndefined();
    expect(cell.outsideAvailability).toBeUndefined();
    expect(cell.overAvailableHours).toBeUndefined();
  });

  it('builds the day column capacity from what each member can actually work', () => {
    const half = member({ id: 'm1', schedule: {
      '2026-08-18': { date: '2026-08-18', startTime: '08:00', endTime: '12:00', isOff: false },
    } });
    const off = member({ id: 'm2', name: 'Ana', schedule: {
      '2026-08-18': { date: '2026-08-18', startTime: '08:00', endTime: '17:00', isOff: true },
    } });
    const plain = member({ id: 'm3', name: 'Sam' });
    const model = buildCrewHoursGrid([half, off, plain], [], [], days, WEEKEND, 8, [lunch]);
    expect(model.dayTotals['2026-08-18'].capacity).toBe(12); // 4 + 0 + 8
  });
});
```

The `member(...)` factory at the top of the test file takes a `Partial<CrewMember>`; if it doesn't accept `schedule` overrides cleanly, widen it rather than hand-rolling members in each test.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: FAIL — `outsideAvailability` is `undefined`; the off-day test finds a chip but no `onOffDay`; `availableHoursByDay` is `undefined`; the day capacity reads `24` (three standard days) instead of `12`.

- [ ] **Step 3: Write the implementation**

In `services/crewHoursGrid.ts`, extend the two interfaces:

```ts
export interface MemberDayCell {
  // ...existing fields...
  /** The member is off this day, yet this booking is on it. Advisory only. */
  onOffDay?: boolean;
  /** Hours of this chip's window that fall before / after the member's working day.
   *  Absent when the window sits inside their hours. */
  outsideAvailability?: { before: number; after: number };
  /** Hours booked past what the member can work this day. Absent when within it. */
  overAvailableHours?: number;
}
```

```ts
export interface MemberRow {
  // ...existing fields...
  /** Hours the member can work each day: 0 when off, their window less unpaid breaks
   *  when they have one, else the standard day. The day totals read the same figure. */
  availableHoursByDay: Record<string, number>;
}
```

Import the primitive (the file already imports `resolveDayAvailability` from `./crewAvailability` — extend that line):

```ts
import { resolveDayAvailability, availableHoursOn, windowOutsideAvailability, type DayAvailability } from './crewAvailability';
```

In the row loop, alongside `offByDay[key] = …`, add:

```ts
      availableHoursByDay[key] = availableHoursOn(m, key, standardDay, defaultBreaks);
```

declaring `const availableHoursByDay: Record<string, number> = {};` beside the other per-day maps, and returning it in the row object.

Inside `pushCell`, after `hours`/`grossHours` are computed, derive the flags. `w` is the chip's window for the day and may be null for a legacy job with no window — guard it:

```ts
          const avail = availByDay[key];
          // WHEN: does this window fall outside their day? An off day is reported on its
          // own, so windowOutsideAvailability deliberately returns nothing for it.
          const fit = w ? windowOutsideAvailability(avail, w) : { before: 0, after: 0, outside: false };
          // HOW MUCH: hours booked past the day they can work. Both flags can fire.
          const over = round1(Math.max(0, gross - availableHoursByDay[key]));
          cells.push({
            // ...existing fields...
            ...(avail.off ? { onOffDay: true } : {}),
            ...(fit.outside ? { outsideAvailability: { before: fit.before, after: fit.after } } : {}),
            ...(over > 0 ? { overAvailableHours: over } : {}),
          });
```

`availByDay[key]` and `availableHoursByDay[key]` are both assigned earlier in the same iteration, so they're populated before `pushCell` runs. Confirm that ordering when you edit.

Then the day totals — replace `capacity += row.offByDay[key] ? 0 : standardDay;` with:

```ts
      capacity += row.availableHoursByDay[key] ?? standardDay;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run services/crewHoursGrid.test.ts` → PASS
Run: `npm test && npm run lint` → green. `MemberRow` gained a required field, so any test or fixture that builds a `MemberRow` by hand needs `availableHoursByDay` added — `components/views/JobScheduling/CrewHoursGrid.test.tsx` has such a fixture. Give those days the value that matches the fixture's intent (`8` for a plain working day).

- [ ] **Step 5: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts components/views/JobScheduling/CrewHoursGrid.test.tsx
git commit -m "feat(scheduling): the grid model knows what each member can work

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The grid shows the conflict instead of hiding the work

Two visible changes: an off day stops replacing its chips with the word "Off", and a chip that fights the member's schedule turns amber and says why.

**Files:**
- Modify: `components/views/JobScheduling/EditableHoursChip.tsx`
- Modify: `components/views/JobScheduling/CrewHoursGrid.tsx` (the day-cell body: the `showAvailability && row.offByDay[k] ? … : …` ternary)
- Modify: `i18n/catalog.ts` (both `enManual` and the Spanish block)
- Test: `components/views/JobScheduling/CrewHoursGrid.test.tsx`

**Interfaces:**
- Consumes: `MemberDayCell.onOffDay` / `.outsideAvailability` / `.overAvailableHours` from Task 4.
- Produces: nothing other tasks depend on.

New i18n keys — add each to BOTH language blocks in `i18n/catalog.ts`, next to the existing `views.JobScheduling.*` entries:

| Key | en | es |
|---|---|---|
| `views.JobScheduling.CrewHoursGrid.offBadge` | `Off` | `Libre` |
| `views.JobScheduling.EditableHoursChip.offThatDay` | `{name} is off this day` | `{name} está libre este día` |
| `views.JobScheduling.EditableHoursChip.outsideWorkWindow` | `Outside {window}` | `Fuera de {window}` |
| `views.JobScheduling.EditableHoursChip.overAvailable` | `{hours}h past the {available}h they work this day` | `{hours}h más de las {available}h que trabaja este día` |

- [ ] **Step 1: Write the failing tests**

Append to `components/views/JobScheduling/CrewHoursGrid.test.tsx`:

```ts
describe('CrewHoursGrid — availability conflicts are shown, not hidden', () => {
  const offRow = (): CrewHoursGridModel => ({
    ...model,
    rows: [{
      ...model.rows[0],
      offByDay: { '2026-06-08': true, '2026-06-09': false },
      cellsByDay: {
        '2026-06-08': [{ jobId: 'staffed', jobNumber: 'J-1', jobName: 'Staffed', hours: 8, color: '#06b6d4',
          startTime: '08:00', endTime: '17:00', onOffDay: true }],
        '2026-06-09': [],
      },
      availableHoursByDay: { '2026-06-08': 0, '2026-06-09': 8 },
    }],
  });

  it('keeps an off day\'s booked chip on screen, alongside an Off badge', () => {
    render(<CrewHoursGrid model={offRow()} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()}
      onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    // The booking is still editable — the scheduler can see and fix it.
    expect(screen.getByLabelText(/J-1 hours for Mike on 2026-06-08/i)).toHaveValue(8);
    expect(screen.getByText(/^Off$/)).toBeInTheDocument();
  });

  it('says why a chip is flagged when it falls outside the member\'s hours', () => {
    const outside: CrewHoursGridModel = {
      ...model,
      rows: [{
        ...model.rows[0],
        availableHoursByDay: { '2026-06-08': 4, '2026-06-09': 8 },
        cellsByDay: {
          '2026-06-08': [{ jobId: 'staffed', jobNumber: 'J-1', jobName: 'Staffed', hours: 4, color: '#06b6d4',
            startTime: '13:00', endTime: '17:00', outsideAvailability: { before: 0, after: 5 } }],
          '2026-06-09': [],
        },
        availByDay: {
          '2026-06-08': { off: false, startTime: '08:00', endTime: '12:00' },
          '2026-06-09': { off: false, startTime: '08:00', endTime: '17:00' },
        },
      }],
    };
    render(<CrewHoursGrid model={outside} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()}
      onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.getByLabelText(/J-1 hours for Mike on 2026-06-08/i))
      .toHaveAttribute('title', expect.stringContaining('Outside 8am–12pm'));
  });
});
```

`toHaveAttribute` with `expect.stringContaining` works in this suite via jest-dom; if it doesn't type-check, read the attribute and assert with `toContain` instead.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx`
Expected: FAIL — the first test can't find the hours input (the off cell renders only the word "Off"); the second finds no `Outside 8am–12pm` in the title.

- [ ] **Step 3: Write the implementation**

**`EditableHoursChip.tsx`** — the chip already builds a `breakTitle` for the hours field. Add the availability lines to it and an amber ring. Compute above the `return`:

```ts
  // Advisory only: the number the scheduler typed always stands. The chip just says
  // what it disagrees with — the same wording the crew picker uses.
  const availabilityLines = [
    cell.onOffDay ? t('views.JobScheduling.EditableHoursChip.offThatDay', { name: memberName }) : '',
    cell.outsideAvailability && availWindow
      ? t('views.JobScheduling.EditableHoursChip.outsideWorkWindow', { window: availWindow })
      : '',
    cell.overAvailableHours
      ? t('views.JobScheduling.EditableHoursChip.overAvailable', { hours: cell.overAvailableHours, available: availableHours ?? 0 })
      : '',
  ].filter(Boolean);
  const flagged = availabilityLines.length > 0;
  const hoursTitle = [breakTitle, ...availabilityLines].filter(Boolean).join(' · ') || undefined;
```

That needs two new optional props — the member's window label and their hours for the day, which only the grid knows:

```ts
  /** The member's working window that day, e.g. "8am–12pm", for the warning text. */
  availWindow?: string;
  /** Hours the member can work that day, for the "past the Xh they work" warning. */
  availableHours?: number;
  /** The member's name, for the off-day warning. */
  memberName?: string;
```

Use `hoursTitle` in place of `breakTitle` on both the `<input>` and the read-only `<span>`, and add the amber ring to the input's className when `flagged`:

```tsx
          className={`w-8 text-right text-xs font-bold text-white rounded px-0.5 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
            flagged ? 'bg-amber-300/40 ring-2 ring-amber-300 focus:bg-amber-300/60' : 'bg-white/25 focus:bg-white/40'
          }`}
```

With no new props passed, `flagged` is false and the chip renders exactly as it does now — which is what keeps the Day-view timeline untouched.

**`CrewHoursGrid.tsx`** — in `renderChip`, pass the three new props:

```tsx
      availWindow={formatWindow(row.availByDay[k].startTime, row.availByDay[k].endTime)}
      availableHours={row.availableHoursByDay[k]}
      memberName={row.name}
```

Import `formatWindow` alongside the existing `formatAvailWindow` import from `../../../services/crewAvailability`.

Then the day-cell body. Today an off day short-circuits the whole cell:

```tsx
                    {showAvailability && row.offByDay[k] ? (
                      <div className="grid place-items-center h-9 text-[10px] font-bold uppercase tracking-wider text-gray-400">{t('...off')}</div>
                    ) : (
                      <div className="space-y-1.5"> …chips… </div>
                    )}
```

Replace it so the badge and the chips coexist. An off day with nothing booked looks exactly as it does today; an off day with a booking shows both:

```tsx
                    <div className="space-y-1.5">
                      {showAvailability && row.offByDay[k] ? (
                        // The badge replaces the window label, never the work: hours booked
                        // on an off day must stay visible to be fixable.
                        <div
                          className="grid place-items-center h-9 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400"
                          title={row.availByDay[k]?.reason || undefined}
                        >
                          {t('views.JobScheduling.CrewHoursGrid.offBadge')}
                        </div>
                      ) : (
                        showAvailability && row.availByDay[k] && !row.availByDay[k].off && (
                          <div className="text-[10px] font-semibold text-gray-400 tabular-nums">{formatAvailWindow(row.availByDay[k])}</div>
                        )
                      )}
                      {cells.map(cell => renderChip(row, k, cell))}
                      {showAvailability && !row.offByDay[k] && (row.breaksByDay[k] ?? []).length > 0 && (
                        <div className="space-y-1 pt-0.5">
                          {(row.breaksByDay[k] ?? []).map(brk => (
                            <BreakChip key={brk.id} brk={brk} floating={!brk.startTime} />
                          ))}
                        </div>
                      )}
                    </div>
```

Leave the `off` translation key in the catalog even though the cell now uses `offBadge` — other surfaces use it.

Do **not** change the drop-target rule from the transfer feature: `canAcceptTransfer` already refuses an off day, and it should stay that way. The flag is for hours already there, not an invitation to add more.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx` → PASS
Run: `npm test && npm run lint` → green. There is a catalog-integrity test that fails if `en` and `es` drift — if it complains, a key is missing from one block.

- [ ] **Step 5: Verify by eye**

Run `npm run dev`, open Job Scheduling in the Hours grid, and set a member to a half day in Settings → their schedule. The chip's hours field should be amber with a tooltip reading `Outside 8am–12pm`; an off day should show an amber `Off` above any booking rather than swallowing it.

- [ ] **Step 6: Commit**

```bash
git add components/views/JobScheduling/EditableHoursChip.tsx components/views/JobScheduling/CrewHoursGrid.tsx components/views/JobScheduling/CrewHoursGrid.test.tsx i18n/catalog.ts
git commit -m "feat(scheduling): an off day flags its bookings instead of hiding them

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Turning a schedule change into booking trims

The pure half of "saving a schedule updates their hours". No React, no state — jobs and two versions of a member in, a list of trims out.

**Files:**
- Create: `services/availabilityTrim.ts`
- Create: `services/availabilityTrim.test.ts`

**Interfaces:**
- Consumes: `memberShiftDayHours`, `setMemberDayHoursPreservingSpan` from `services/crewHoursGrid.ts`; `allocDayWindow`, `allocCoversDay` from `services/scheduleEngine.ts`; `resolveBreaks`, `unpaidFixedBreakHoursInWindow` from `services/crewBreaks.ts`; `resolveDayAvailability` from `services/crewAvailability.ts`.
- Produces:
  - `interface BookingTrim { jobId: string; jobNumber: string; shiftId?: string; memberId: string; dateKey: string; from: number; to: number }`
  - `availabilityTrims(jobs: Job[], next: CrewMember, prev: CrewMember | undefined, defaultBreaks: CrewBreak[]): BookingTrim[]`
  - `applyAvailabilityTrims(jobs: Job[], trims: BookingTrim[], weekendDays: number[], standardDay: number): Job[]`

- [ ] **Step 1: Write the failing tests**

Create `services/availabilityTrim.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { availabilityTrims, applyAvailabilityTrims } from './availabilityTrim';
import { memberJobDayHours } from './crewHoursGrid';
import type { CrewMember, Job } from '../types';

const WEEKEND = [0, 6];
const DAY = '2026-08-18';

const job = (over: Partial<Job> = {}): Job =>
  ({ id: 'j1', jobNumber: 'J-1', name: 'Job', stage: 'Scheduled', clientId: 'c1', estimateId: 'e1',
     address: '1 St', dateCreated: '2026-01-01', ...over } as Job);

// One shift, 8am–5pm on the one day, with Mike booked 9h.
const booked = (over: Partial<Job> = {}) => job({
  allocations: [{ id: 'a', name: 'Crew', startDate: DAY, endDate: DAY,
    startTime: '08:00', endTime: '17:00', memberIds: ['m1'],
    hoursAssignments: { m1: { [DAY]: 9 } } }],
  ...over,
});

const mike = (entry?: Partial<CrewMember['schedule'][string]>): CrewMember =>
  ({ id: 'm1', name: 'Mike', role: 'Painter',
     ...(entry ? { schedule: { [DAY]: { date: DAY, startTime: '08:00', endTime: '17:00', isOff: false, ...entry } } } : {}),
   } as CrewMember);

describe('availabilityTrims', () => {
  it('trims a booking down to a new half day', () => {
    const trims = availabilityTrims([booked()], mike({ endTime: '12:00' }), mike(), []);
    expect(trims).toEqual([{ jobId: 'j1', jobNumber: 'J-1', shiftId: 'a', memberId: 'm1', dateKey: DAY, from: 9, to: 4 }]);
  });

  it('removes the booking when the day is marked off', () => {
    const trims = availabilityTrims([booked()], mike({ isOff: true }), mike(), []);
    expect(trims).toEqual([{ jobId: 'j1', jobNumber: 'J-1', shiftId: 'a', memberId: 'm1', dateKey: DAY, from: 9, to: 0 }]);
  });

  it('leaves a booking alone when the new window misses the shift entirely', () => {
    // They now work mornings; the shift is 1–5pm. Nothing sensible to trim to, and
    // deleting the whole booking over a settings save would be too destructive.
    const afternoon = job({ allocations: [{ id: 'a', name: 'Crew', startDate: DAY, endDate: DAY,
      startTime: '13:00', endTime: '17:00', memberIds: ['m1'], hoursAssignments: { m1: { [DAY]: 4 } } }] });
    const trims = availabilityTrims([afternoon], mike({ endTime: '12:00' }), mike(), []);
    expect(trims).toEqual([]);
  });

  it('ignores days whose schedule entry did not change', () => {
    const trims = availabilityTrims([booked()], mike(), mike(), []);
    expect(trims).toEqual([]);
  });

  it('ignores a day whose schedule entry was deleted', () => {
    // Clearing an entry says nothing about the member; it must not trim their booking.
    const cleared = { id: 'm1', name: 'Mike', role: 'Painter', schedule: {} } as CrewMember;
    expect(availabilityTrims([booked()], cleared, mike({ endTime: '12:00' }), [])).toEqual([]);
  });

  it('ignores an edit that touches no schedule at all', () => {
    const before = mike();
    const renamed = { ...before, name: 'Michael' } as CrewMember;
    expect(availabilityTrims([booked()], renamed, before, [])).toEqual([]);
  });

  it('emits nothing when the booking already fits the new window', () => {
    const light = job({ allocations: [{ id: 'a', name: 'Crew', startDate: DAY, endDate: DAY,
      startTime: '08:00', endTime: '17:00', memberIds: ['m1'], hoursAssignments: { m1: { [DAY]: 3 } } }] });
    expect(availabilityTrims([light], mike({ endTime: '12:00' }), mike(), [])).toEqual([]);
  });

  it('carves an unpaid lunch out of the room a half day leaves', () => {
    // 8am–1pm is 5h of window; an unpaid noon hour inside it leaves 4h of work.
    const lunch = [{ id: 'b1', durationMinutes: 60, paid: false, startTime: '12:00' }];
    const trims = availabilityTrims([booked()], mike({ endTime: '13:00' }), mike(), lunch);
    expect(trims[0].to).toBe(4);
  });

  it('trims every shift the member holds that day', () => {
    const twoShifts = job({ allocations: [
      { id: 'am', name: 'AM', startDate: DAY, endDate: DAY, startTime: '08:00', endTime: '12:00',
        memberIds: ['m1'], hoursAssignments: { m1: { [DAY]: 4 } } },
      { id: 'pm', name: 'PM', startDate: DAY, endDate: DAY, startTime: '13:00', endTime: '17:00',
        memberIds: ['m1'], hoursAssignments: { m1: { [DAY]: 4 } } },
    ] });
    const trims = availabilityTrims([twoShifts], mike({ isOff: true }), mike(), []);
    expect(trims.map(t => t.shiftId)).toEqual(['am', 'pm']);
    expect(trims.every(t => t.to === 0)).toBe(true);
  });
});

describe('applyAvailabilityTrims', () => {
  it('writes a trim onto the job', () => {
    const jobs = [booked()];
    const trims = availabilityTrims(jobs, mike({ endTime: '12:00' }), mike(), []);
    const next = applyAvailabilityTrims(jobs, trims, WEEKEND, 8);
    expect(memberJobDayHours(next[0], 'm1', DAY, 8)).toBe(4);
  });

  it('folds two trims on one job into a single job value', () => {
    const twoShifts = job({ allocations: [
      { id: 'am', name: 'AM', startDate: DAY, endDate: DAY, startTime: '08:00', endTime: '12:00',
        memberIds: ['m1'], hoursAssignments: { m1: { [DAY]: 4 } } },
      { id: 'pm', name: 'PM', startDate: DAY, endDate: DAY, startTime: '13:00', endTime: '17:00',
        memberIds: ['m1'], hoursAssignments: { m1: { [DAY]: 4 } } },
    ] });
    const trims = availabilityTrims([twoShifts], mike({ isOff: true }), mike(), []);
    const next = applyAvailabilityTrims([twoShifts], trims, WEEKEND, 8);
    expect(next).toHaveLength(1);
    expect(memberJobDayHours(next[0], 'm1', DAY, 8)).toBe(0);
  });

  it('returns the untouched jobs unchanged, by identity', () => {
    const other = job({ id: 'j2', jobNumber: 'J-2' });
    const jobs = [booked(), other];
    const trims = availabilityTrims(jobs, mike({ endTime: '12:00' }), mike(), []);
    const next = applyAvailabilityTrims(jobs, trims, WEEKEND, 8);
    expect(next[1]).toBe(other);
  });

  it('skips a locked job', () => {
    const locked = booked({ is_locked: true });
    const trims = availabilityTrims([locked], mike({ endTime: '12:00' }), mike(), []);
    expect(trims).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/availabilityTrim.test.ts`
Expected: FAIL — `Failed to resolve import "./availabilityTrim"`.

- [ ] **Step 3: Write the implementation**

Create `services/availabilityTrim.ts`:

```ts
import type { CrewBreak, CrewMember, Job, JobCrewAllocation } from '../types';
import { allocCoversDay, allocDayWindow } from './scheduleEngine';
import { memberShiftDayHours, setMemberDayHoursPreservingSpan } from './crewHoursGrid';
import { resolveBreaks, unpaidFixedBreakHoursInWindow } from './crewBreaks';
import { resolveDayAvailability } from './crewAvailability';

/** One booking rewritten to fit a member's new schedule. `to === 0` removes it. */
export interface BookingTrim {
  jobId: string;
  jobNumber: string;
  shiftId?: string;
  memberId: string;
  dateKey: string;
  from: number;
  to: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const toH = (t: string) => { const [h, m] = t.split(':').map(Number); return h + (m || 0) / 60; };

/** Days whose schedule entry differs between two versions of a member. A profile-only
 *  edit yields none, so saving a name never rewrites a booking. */
const changedDays = (next: CrewMember, prev: CrewMember | undefined): string[] => {
  const a = prev?.schedule ?? {};
  const b = next.schedule ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter(k => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null));
};

/** Hours of work the member's new day leaves inside a shift's window: the overlap of the
 *  two windows, less the unpaid breaks sitting in it. */
const roomInsideWindow = (
  member: CrewMember,
  dateKey: string,
  win: { startTime: string; endTime: string },
  defaultBreaks: CrewBreak[],
): number => {
  const avail = resolveDayAvailability(member, dateKey, { startTime: win.startTime, endTime: win.endTime });
  if (avail.off) return 0;
  const startTime = toH(avail.startTime) > toH(win.startTime) ? avail.startTime : win.startTime;
  const endTime = toH(avail.endTime) < toH(win.endTime) ? avail.endTime : win.endTime;
  const overlap = round1(Math.max(0, toH(endTime) - toH(startTime)));
  if (overlap <= 0) return 0;
  const breaks = resolveBreaks(member.schedule?.[dateKey], defaultBreaks);
  return round1(Math.max(0, overlap - unpaidFixedBreakHoursInWindow(breaks, startTime, endTime)));
};

/** Bookings that no longer fit a member's schedule, for the days that schedule just
 *  changed on.
 *
 *  Off means the whole person-day is gone, so the booking goes to zero. A working window
 *  that misses the shift entirely is a statement about where the SHIFT sits, not the
 *  person — those hours are left alone and flagged in the grid instead, because deleting
 *  a whole booking on a settings save is too destructive to do silently. */
export const availabilityTrims = (
  jobs: Job[],
  next: CrewMember,
  prev: CrewMember | undefined,
  defaultBreaks: CrewBreak[],
): BookingTrim[] => {
  const days = changedDays(next, prev);
  if (!days.length) return [];
  const trims: BookingTrim[] = [];
  for (const job of jobs) {
    if (job.is_locked) continue;
    const allocs: JobCrewAllocation[] = job.allocations ?? [];
    for (const dateKey of days) {
      // A day whose entry was DELETED makes no statement about the member, so it trims
      // nothing. Without this, clearing a schedule entry would trim every booking on it
      // down to the shift window less breaks.
      const entry = next.schedule?.[dateKey];
      if (!entry) continue;
      const off = !!entry.isOff;
      for (const alloc of allocs) {
        if (!allocCoversDay(alloc, dateKey)) continue;
        const from = memberShiftDayHours(alloc, next.id, dateKey);
        if (from <= 0) continue;
        const win = allocDayWindow(alloc, dateKey);
        const room = roomInsideWindow(next, dateKey, win, defaultBreaks);
        // No overlap on a working day: keep the hours, let the grid flag them.
        if (!off && room <= 0) continue;
        const to = off ? 0 : Math.min(from, room);
        if (to === from) continue;
        trims.push({ jobId: job.id, jobNumber: job.jobNumber, shiftId: alloc.id, memberId: next.id, dateKey, from, to });
      }
    }
  }
  return trims;
};

/** Apply trims, one new `Job` per affected job. Trims on the same job are folded
 *  together: separate writes to one job would clobber each other. */
export const applyAvailabilityTrims = (
  jobs: Job[],
  trims: BookingTrim[],
  weekendDays: number[],
  standardDay: number,
): Job[] => {
  if (!trims.length) return jobs;
  const byJob = new Map<string, BookingTrim[]>();
  for (const t of trims) byJob.set(t.jobId, [...(byJob.get(t.jobId) ?? []), t]);
  return jobs.map(job => {
    const mine = byJob.get(job.id);
    if (!mine) return job;
    return mine.reduce(
      (acc, t) => setMemberDayHoursPreservingSpan(acc, t.memberId, t.dateKey, t.to, weekendDays, standardDay, t.shiftId),
      job,
    );
  });
};
```

Note on legacy jobs: a job with no `allocations` has no shift window to compare against, so it yields no trims. Every scheduled job has had shifts since `2026-07-13-scheduled-jobs-always-have-shifts`, so this only spares genuinely legacy data.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run services/availabilityTrim.test.ts` → PASS
Run: `npm test && npm run lint` → green.

- [ ] **Step 5: Commit**

```bash
git add services/availabilityTrim.ts services/availabilityTrim.test.ts
git commit -m "feat(scheduling): work out which bookings a new schedule no longer fits

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Saving a schedule trims the bookings

Both schedule editors — `AddEmployeeModal` in Settings and `EditAvailabilityModal` / the break editor inside `JobSchedulingView` — reach App through `onEditEmployee`. That single funnel is where the trim runs, because App owns `jobs`, `showToast`, and `logActivity`.

**Files:**
- Modify: `App.tsx` — add `handleEditEmployee` near `handleApplySchedule` (around `:189`), and replace the two inline `onEditEmployee={(e) => setEmployees(...)}` props (`:319` for `JobSchedulingView`, `:572` for `SettingsPage`)
- Modify: `i18n/catalog.ts`
- Test: manual (App.tsx has no test harness in this repo; the logic it calls is covered by Task 6)

**Interfaces:**
- Consumes: `availabilityTrims`, `applyAvailabilityTrims` (Task 6); `companyStandardDay` (Task 1).
- Produces: `handleEditEmployee(emp: CrewMember): void`.

New i18n keys, both language blocks:

| Key | en | es |
|---|---|---|
| `App.trimmedBooking` | `Trimmed 1 booking to {name}'s hours` | `Se ajustó 1 asignación a las horas de {name}` |
| `App.trimmedBookings` | `Trimmed {count} bookings to {name}'s hours` | `Se ajustaron {count} asignaciones a las horas de {name}` |

- [ ] **Step 1: Translate without the hook**

`App.tsx` *renders* `LanguageProvider` (`:242`), so it is the provider's parent and cannot call `useTranslation()`. Use the non-hook resolver instead, which is exactly what it exists for:

```tsx
import { translate } from './i18n/translate';
```

and call it with the language App already holds in settings:

```tsx
const tr = (key: string, vars?: Record<string, string | number>) =>
  translate(settings.appLanguage, key, vars);
```

Put `tr` next to `showToast`. (App's one existing toast string, `'You do not have permission to reschedule jobs.'` at `:194`, is hardcoded English — leave it alone; that's a separate cleanup, not this task's job.)

- [ ] **Step 2: Write the handler**

In `App.tsx`, beside the other schedule actions:

```tsx
  // Saving a member's schedule is the newer instruction, so bookings that no longer fit
  // it are trimmed: a half day comes down to the hours they now work, an off day drops
  // its bookings. Undo restores the hours, not the schedule — that leaves them as an
  // override, which the grid flags amber, exactly as if a scheduler had typed them back.
  const handleEditEmployee = (emp: CrewMember) => {
    const prev = employees.find(e => e.id === emp.id);
    setEmployees(prevList => prevList.map(e => (e.id === emp.id ? emp : e)));

    const standardDay = companyStandardDay(settings.scheduling); // for applying the trims
    const defaultBreaks = settings.scheduling?.defaultBreaks ?? [];
    const trims = availabilityTrims(jobs, emp, prev, defaultBreaks);
    if (!trims.length) return;

    const weekendDays = configFromSettings(settings.scheduling, false).weekendDays;
    const affected = new Set(trims.map(t => t.jobId));
    const snapshot = jobs.filter(j => affected.has(j.id));
    setJobs(prevJobs => applyAvailabilityTrims(prevJobs, trims, weekendDays, standardDay));
    logActivity(
      'Trimmed bookings to availability',
      [...affected],
      trims.map(t => `${t.jobNumber} ${t.dateKey}: ${t.from}h → ${t.to}h`).join('; '),
    );
    showToast(
      trims.length === 1
        ? tr('App.trimmedBooking', { name: emp.name })
        : tr('App.trimmedBookings', { count: trims.length, name: emp.name }),
      () => setJobs(prevJobs => prevJobs.map(j => snapshot.find(s => s.id === j.id) ?? j)),
    );
  };
```

Add the imports:

```tsx
import { availabilityTrims, applyAvailabilityTrims } from './services/availabilityTrim';
import { companyStandardDay } from './services/crewAvailability';
import { configFromSettings } from './services/scheduleEngine';
```

(`configFromSettings` may already be imported — check before adding.)

Then point both props at it:

```tsx
  onEditEmployee={handleEditEmployee}
```

replacing the inline arrow at `:319` (JobSchedulingView) and `:572` (SettingsPage).

- [ ] **Step 3: Typecheck**

Run: `npm run lint` → clean. `logActivity`'s signature is `(action: string, affectedJobIds: string[], details?: string)`; `showToast`'s is `(message: string, onUndo?: () => void)`. Match them exactly.

- [ ] **Step 4: Verify by hand**

Run `npm run dev`:

1. Job Scheduling → Hours grid. Note a member with hours on a weekday, say 9h Tuesday.
2. Settings → that member → Schedule → set Tuesday to 08:00 AM–12:00 PM → Save Member.
3. The grid's Tuesday chip should now read 4h, a toast should say `Trimmed 1 booking to <name>'s hours`, and their `/ 54h` capacity should drop by the difference.
4. Press Undo on the toast → 9h returns, now amber, tooltip `Outside 8am–12pm`.
5. Type 9 into the chip by hand → it stays 9 and stays amber. It is never clamped back.
6. Set another day to Off → its bookings disappear from the grid, and the cell shows the amber `Off` badge.
7. Edit only the member's name → no toast, no hours change.

- [ ] **Step 5: Run the full suite and commit**

```bash
npm test && npm run lint
git add App.tsx i18n/catalog.ts
git commit -m "feat(scheduling): saving a schedule trims the bookings that no longer fit

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Notes for the executor

- **The one rule that keeps this safe:** no schedule entry means the standard day. If you find yourself updating a pile of existing test expectations, stop — you have almost certainly started deriving hours from the *fallback* window, which re-rates every member who never had a schedule set.
- **`MemberRow.availableHoursByDay` is required, not optional.** That's deliberate: a hand-built fixture that forgets it should fail to compile rather than silently fall back.
- Tasks 1–4 are data and pure functions with no visible effect; Task 5 is the first task you can see in the browser; Task 7 is the first that writes job data.
