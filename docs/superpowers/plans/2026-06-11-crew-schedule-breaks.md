# Crew Schedule Breaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users define crew breaks (paid/unpaid, fixed-time or flexible, any duration) as a company default that auto-applies to every scheduled member-day and can be overridden per member per day, with capacity and paid-hours numbers and the schedule views reflecting them.

**Architecture:** A break is a plain data record (`CrewBreak`) with three primitives — duration, paid flag, optional fixed time. The company default lives in `SchedulingSettings.defaultBreaks`; a per-member-day override lives in `CrewScheduleEntry.breaksOverride`. A single pure resolver (`resolveBreaks`) returns the effective breaks for a day: the override when present (empty array = "no breaks"), else the company default. All numbers (job-capacity, paid hours) are *derived* from these primitives — no paid/unpaid policy is hardcoded. The crew-hours grid subtracts break time from capacity and shows breaks per cell; the Day Board draws fixed breaks as anchored blocks and flexible breaks as floating chips.

**Tech Stack:** React + TypeScript, Vitest for unit/component tests, Tailwind for styling. Pure logic lives in `services/`, UI in `components/views/JobScheduling/` and `components/settings/`.

**Spec:** `docs/superpowers/specs/2026-06-11-crew-schedule-breaks-design.md`

---

## File Structure

**New files:**
- `services/crewBreaks.ts` — pure break logic: `resolveBreaks`, minute/hour math, `setMemberDayBreaks` mutation.
- `services/crewBreaks.test.ts` — unit tests for the above.
- `components/views/JobScheduling/BreakChip.tsx` — presentational chip for one break (used by grid and Day Board).
- `components/views/JobScheduling/BreakEditorModal.tsx` — add/edit/remove/reset breaks for one member-day.

**Modified files:**
- `types.ts` — add `CrewBreak`; add `defaultBreaks?` to `SchedulingSettings`; add `breaksOverride?` to `CrewScheduleEntry`.
- `services/crewHoursGrid.ts` — break-aware capacity, `paidHours`, `breaksByDay` on `MemberRow`; new `defaultBreaks` param on `buildCrewHoursGrid`.
- `services/crewHoursGrid.test.ts` — tests for the grid changes.
- `components/settings/SchedulingConfigView.tsx` — company default-breaks editor card.
- `components/views/JobScheduling/CrewHoursGrid.tsx` — render breaks per cell + paid-hours readout; open the editor.
- `components/views/JobScheduling/CrewHoursGrid.test.tsx` — tests for grid rendering.
- `components/views/JobScheduling/DayBoard.tsx` — anchored fixed-break blocks + floating flexible chips.
- `components/views/JobSchedulingView.tsx` — pass `defaultBreaks`, supply break resolvers, handle break edits, persist the member.

**Scope note (v1):** `computeWeeklyHours` (the crew *assignment list* capacity) is intentionally NOT made break-aware in v1 — only the crew-hours grid is. This is listed in the spec's "Out of scope for v1". Keep that boundary.

---

## Task 1: Add break types

**Files:**
- Modify: `types.ts:213-226` (SchedulingSettings), `types.ts:410-416` (CrewScheduleEntry)

- [ ] **Step 1: Add the `CrewBreak` interface and extend the two existing interfaces**

In `types.ts`, immediately **above** `export interface SchedulingSettings {` (currently line 213), add:

```typescript
/** A single break on a crew member's day. Stores only primitives — the paid flag
 *  and duration; numbers (capacity, paid hours) are derived elsewhere, never a
 *  hardcoded policy. `startTime` present = fixed/anchored; omitted = flexible. */
export interface CrewBreak {
  id: string;
  label?: string;            // 'Lunch', 'Coffee' — optional
  durationMinutes: number;   // 15, 30, 60, …
  paid: boolean;
  startTime?: string;        // 'HH:mm' = fixed (anchored block); omitted = flexible (floating chip)
}
```

Inside `SchedulingSettings`, add this field after `crewDailyCapacityHours?` (line 223):

```typescript
  /** Company-default break(s) applied to every scheduled member-day unless overridden. */
  defaultBreaks?: CrewBreak[];
```

Inside `CrewScheduleEntry` (lines 410-416), add after `reason?` (line 415):

```typescript
  /** Per-day break override. Absent = use company default; [] = explicitly no breaks;
   *  non-empty = exactly these breaks. */
  breaksOverride?: CrewBreak[];
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors referencing `types.ts` (pre-existing unrelated errors, if any, are unchanged).

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat: add CrewBreak type, defaultBreaks setting, breaksOverride on schedule"
```

---

## Task 2: Break resolution + math service

**Files:**
- Create: `services/crewBreaks.ts`
- Test: `services/crewBreaks.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `services/crewBreaks.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveBreaks, breakHours, paidBreakHours } from './crewBreaks';
import type { CrewBreak, CrewScheduleEntry } from '../types';

const lunch = (over: Partial<CrewBreak> = {}): CrewBreak =>
  ({ id: 'b1', label: 'Lunch', durationMinutes: 30, paid: false, startTime: '12:00', ...over });

const entry = (over: Partial<CrewScheduleEntry> = {}): CrewScheduleEntry =>
  ({ date: '2026-06-08', startTime: '08:00', endTime: '17:00', isOff: false, ...over });

describe('resolveBreaks', () => {
  it('uses the company default when no override is present', () => {
    expect(resolveBreaks(entry(), [lunch()])).toEqual([lunch()]);
  });

  it('uses the override when one is set', () => {
    const custom = [lunch({ durationMinutes: 60 })];
    expect(resolveBreaks(entry({ breaksOverride: custom }), [lunch()])).toEqual(custom);
  });

  it('treats an empty override array as "no breaks today"', () => {
    expect(resolveBreaks(entry({ breaksOverride: [] }), [lunch()])).toEqual([]);
  });

  it('returns the default when the entry itself is undefined', () => {
    expect(resolveBreaks(undefined, [lunch()])).toEqual([lunch()]);
  });

  it('returns an empty array when there is no override and no default', () => {
    expect(resolveBreaks(undefined, [])).toEqual([]);
  });
});

describe('breakHours / paidBreakHours', () => {
  it('sums all break minutes into hours regardless of paid flag', () => {
    expect(breakHours([lunch({ durationMinutes: 30, paid: true }), lunch({ id: 'b2', durationMinutes: 15, paid: false })])).toBe(0.75);
  });

  it('counts only paid breaks toward paid hours', () => {
    expect(paidBreakHours([lunch({ durationMinutes: 30, paid: true }), lunch({ id: 'b2', durationMinutes: 30, paid: false })])).toBe(0.5);
  });

  it('returns 0 for an empty list', () => {
    expect(breakHours([])).toBe(0);
    expect(paidBreakHours([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/crewBreaks.test.ts`
Expected: FAIL — `Failed to resolve import "./crewBreaks"`.

- [ ] **Step 3: Write the implementation**

Create `services/crewBreaks.ts`:

```typescript
import type { CrewBreak, CrewScheduleEntry } from '../types';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Effective breaks for a member-day: the override when present (empty array = no
 *  breaks), otherwise the company default. Single source of truth for reads. */
export const resolveBreaks = (
  entry: CrewScheduleEntry | undefined,
  defaultBreaks: CrewBreak[],
): CrewBreak[] => entry?.breaksOverride ?? defaultBreaks ?? [];

const sumMinutes = (breaks: CrewBreak[]) => breaks.reduce((s, b) => s + (b.durationMinutes || 0), 0);

/** Total break time in hours (all breaks — paid and unpaid both reduce job-capacity). */
export const breakHours = (breaks: CrewBreak[]): number => round1(sumMinutes(breaks) / 60);

/** Paid-only break time in hours (added to paid hours; unpaid breaks are not paid). */
export const paidBreakHours = (breaks: CrewBreak[]): number =>
  round1(sumMinutes(breaks.filter(b => b.paid)) / 60);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run services/crewBreaks.test.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add services/crewBreaks.ts services/crewBreaks.test.ts
git commit -m "feat: crewBreaks service — resolveBreaks + break-hours math"
```

---

## Task 3: `setMemberDayBreaks` mutation

**Files:**
- Modify: `services/crewBreaks.ts`
- Test: `services/crewBreaks.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `services/crewBreaks.test.ts`:

```typescript
import { setMemberDayBreaks } from './crewBreaks';
import type { CrewMember } from '../types';

const member = (over: Partial<CrewMember> = {}): CrewMember =>
  ({ id: 'm1', name: 'Mike', role: 'Painter', ...over });

describe('setMemberDayBreaks', () => {
  it('sets a break override, creating a schedule entry when none exists', () => {
    const next = setMemberDayBreaks(member(), '2026-06-08', [lunch()]);
    expect(next.schedule!['2026-06-08'].breaksOverride).toEqual([lunch()]);
    expect(next.schedule!['2026-06-08'].isOff).toBe(false);
  });

  it('stores an empty array as an explicit "no breaks" override', () => {
    const next = setMemberDayBreaks(member(), '2026-06-08', []);
    expect(next.schedule!['2026-06-08'].breaksOverride).toEqual([]);
  });

  it('reverts to the company default by clearing the override (undefined)', () => {
    const m = member({ schedule: { '2026-06-08': entry({ breaksOverride: [lunch()] }) } });
    const next = setMemberDayBreaks(m, '2026-06-08', undefined);
    expect(next.schedule!['2026-06-08'].breaksOverride).toBeUndefined();
  });

  it('preserves existing entry fields (isOff, reason) when overriding breaks', () => {
    const m = member({ schedule: { '2026-06-08': entry({ isOff: true, reason: 'PTO' }) } });
    const next = setMemberDayBreaks(m, '2026-06-08', [lunch()]);
    expect(next.schedule!['2026-06-08'].isOff).toBe(true);
    expect(next.schedule!['2026-06-08'].reason).toBe('PTO');
  });

  it('does not mutate the original member', () => {
    const m = member();
    setMemberDayBreaks(m, '2026-06-08', [lunch()]);
    expect(m.schedule).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/crewBreaks.test.ts`
Expected: FAIL — `setMemberDayBreaks is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `services/crewBreaks.ts`:

```typescript
import type { CrewMember } from '../types';

/** Set a member's break override for one day (immutably).
 *  - `breaks` array  → store as the override ([] = explicit "no breaks").
 *  - `breaks` undefined → clear the override, reverting the day to the company default. */
export const setMemberDayBreaks = (
  member: CrewMember,
  dateKey: string,
  breaks: CrewBreak[] | undefined,
): CrewMember => {
  const schedule = { ...(member.schedule ?? {}) };
  const existing = schedule[dateKey];

  if (breaks === undefined) {
    if (!existing) return member;
    const { breaksOverride, ...rest } = existing;
    schedule[dateKey] = rest;
  } else {
    schedule[dateKey] = {
      date: dateKey,
      startTime: existing?.startTime ?? '08:00',
      endTime: existing?.endTime ?? '17:00',
      isOff: existing?.isOff ?? false,
      ...(existing?.reason !== undefined ? { reason: existing.reason } : {}),
      breaksOverride: breaks,
    };
  }
  return { ...member, schedule };
};
```

Add `CrewMember` to the existing top import: change `import type { CrewBreak, CrewScheduleEntry } from '../types';` to `import type { CrewBreak, CrewScheduleEntry, CrewMember } from '../types';` and delete the separate `import type { CrewMember }` line you might have added — keep a single import line.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run services/crewBreaks.test.ts`
Expected: PASS — all tests green (13 total).

- [ ] **Step 5: Commit**

```bash
git add services/crewBreaks.ts services/crewBreaks.test.ts
git commit -m "feat: setMemberDayBreaks mutation for per-day break overrides"
```

---

## Task 4: Break-aware capacity + paid hours in the crew-hours grid

**Files:**
- Modify: `services/crewHoursGrid.ts` (MemberRow interface ~lines 7-19; `buildCrewHoursGrid` signature ~line 284 and body ~lines 295-348)
- Test: `services/crewHoursGrid.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `services/crewHoursGrid.test.ts` (the file already imports `buildCrewHoursGrid` and defines `member`, `weekKeys`, `WEEKEND`):

```typescript
import type { CrewBreak } from '../types';

// Mon 2026-06-08 .. Fri 2026-06-12 as Date objects (local noon to avoid TZ drift).
const weekDates = ['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']
  .map(k => new Date(`${k}T12:00:00`));
const lunch30: CrewBreak = { id: 'b1', label: 'Lunch', durationMinutes: 30, paid: false, startTime: '12:00' };

describe('buildCrewHoursGrid — breaks', () => {
  it('subtracts all break time from weekly capacity (5 days × 0.5h = 2.5h off 40h)', () => {
    const model = buildCrewHoursGrid([member()], [], [], weekDates, WEEKEND, 8, [lunch30]);
    expect(model.rows[0].capacity).toBe(37.5);
  });

  it('exposes resolved breaks per working day in breaksByDay', () => {
    const model = buildCrewHoursGrid([member()], [], [], weekDates, WEEKEND, 8, [lunch30]);
    expect(model.rows[0].breaksByDay['2026-06-08']).toEqual([lunch30]);
  });

  it('honours a per-day override (empty array = no break that day)', () => {
    const m = member({ schedule: { '2026-06-08': { date: '2026-06-08', startTime: '08:00', endTime: '17:00', isOff: false, breaksOverride: [] } } });
    const model = buildCrewHoursGrid([m], [], [], weekDates, WEEKEND, 8, [lunch30]);
    // 4 days × 0.5h break = 2.0h off 40h
    expect(model.rows[0].capacity).toBe(38);
    expect(model.rows[0].breaksByDay['2026-06-08']).toEqual([]);
  });

  it('paidHours adds paid break time to worked hours; unpaid breaks do not count', () => {
    const paid: CrewBreak = { id: 'b2', durationMinutes: 30, paid: true };
    // No jobs → weekTotal 0; 5 paid 30m breaks = 2.5h paid.
    const model = buildCrewHoursGrid([member()], [], [], weekDates, WEEKEND, 8, [paid]);
    expect(model.rows[0].paidHours).toBe(2.5);
    const unpaidModel = buildCrewHoursGrid([member()], [], [], weekDates, WEEKEND, 8, [lunch30]);
    expect(unpaidModel.rows[0].paidHours).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: FAIL — `buildCrewHoursGrid` expects 6 args / `breaksByDay`/`paidHours` undefined.

- [ ] **Step 3: Implement the grid changes**

In `services/crewHoursGrid.ts`:

(a) Add imports near the top (after the existing imports, line 4):

```typescript
import { resolveBreaks, breakHours, paidBreakHours } from './crewBreaks';
import type { CrewBreak } from '../types';
```

(b) Extend the `MemberRow` interface (after `overCapacity: boolean;`, line 18):

```typescript
  /** Effective breaks per working day key (resolved default-or-override). */
  breaksByDay: Record<string, CrewBreak[]>;
  /** Worked job hours + paid break hours for the week. */
  paidHours: number;
```

(c) Change the `buildCrewHoursGrid` signature (line 284-291) to accept default breaks:

```typescript
export const buildCrewHoursGrid = (
  members: CrewMember[],
  jobs: Job[],
  workOrders: WorkOrder[],
  weekDays: Date[],
  weekendDays: number[],
  standardDay: number,
  defaultBreaks: CrewBreak[] = [],
): CrewHoursGridModel => {
```

(d) Inside the `members.map(m => {` block, replace the capacity line (currently line 299
`const capacity = computeWeeklyHours(m, weekDays, [], { standardDay }).capacity;`) and add break accumulation. Replace from that line through where `cellsByDay`/`offByDay`/`weekTotal` are declared with:

```typescript
    const baseCapacity = computeWeeklyHours(m, weekDays, [], { standardDay }).capacity;
    const cellsByDay: Record<string, MemberDayCell[]> = {};
    const offByDay: Record<string, boolean> = {};
    const breaksByDay: Record<string, CrewBreak[]> = {};
    let weekTotal = 0;
    let weekBreakHours = 0;
    let weekPaidBreakHours = 0;
```

(e) Inside the `for (const key of dayKeys)` loop, after `offByDay[key] = !!m.schedule?.[key]?.isOff;`, add break resolution (breaks only count on working, non-off days — `dayKeys` are already working days, so just guard on off):

```typescript
      const dayBreaks = offByDay[key] ? [] : resolveBreaks(m.schedule?.[key], defaultBreaks);
      breaksByDay[key] = dayBreaks;
      weekBreakHours += breakHours(dayBreaks);
      weekPaidBreakHours += paidBreakHours(dayBreaks);
```

(f) Replace the `return { … }` for the row (lines 316-321) with the break-aware version:

```typescript
    const capacity = Math.max(0, round1(baseCapacity - weekBreakHours));
    const paidHours = round1(weekTotal + weekPaidBreakHours);
    return {
      memberId: m.id, name: m.name, role: m.role, photo: m.photo, color: m.color,
      cellsByDay, offByDay, breaksByDay,
      weekTotal, capacity, remaining: Math.max(0, round1(capacity - weekTotal)),
      overCapacity: weekTotal > capacity,
      paidHours,
    };
```

(Keep the existing `weekTotal = round1(weekTotal);` line that precedes the return.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS — new break tests green AND all pre-existing tests still green (the new param defaults to `[]`, so old call sites and old tests are unaffected).

- [ ] **Step 5: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "feat: break-aware capacity, paidHours, and breaksByDay in crew hours grid"
```

---

## Task 5: Company default-breaks editor in Settings

**Files:**
- Modify: `components/settings/SchedulingConfigView.tsx`

This adds a "Crew Breaks" card to the existing scheduling settings, editing `settings.scheduling.defaultBreaks`.

- [ ] **Step 1: Add imports and a break-row helper**

In `components/settings/SchedulingConfigView.tsx`, update the top imports:

- Add `Coffee` to the lucide import (line 2): `import { CalendarClock, CloudRain, Plus, Trash2, CalendarDays, Coffee } from 'lucide-react';`
- Add `CrewBreak` to the types import (line 5): `import { GlobalSettings, SchedulingSettings, CalendarDayMark, CrewBreak } from '../../types';`

Inside the component, after the `removeRainDay` definition (line 64), add break handlers:

```typescript
  const breaks = sched.defaultBreaks ?? [];
  const updateBreak = (id: string, patch: Partial<CrewBreak>) =>
    update({ defaultBreaks: breaks.map(b => (b.id === id ? { ...b, ...patch } : b)) });
  const addBreak = () =>
    update({ defaultBreaks: [...breaks, { id: `brk-${breaks.length + 1}-${breaks.reduce((s, b) => s + b.durationMinutes, 0)}`, label: 'Break', durationMinutes: 30, paid: false }] });
  const removeBreak = (id: string) => update({ defaultBreaks: breaks.filter(b => b.id !== id) });
```

Note: the `id` is derived (no `Date.now()`/`Math.random()`) to keep it deterministic; uniqueness within the small default list is sufficient.

- [ ] **Step 2: Add the Crew Breaks card to the JSX**

Insert this `Card` block immediately **after** the closing `</Card>` of the "Working days" card (after line 108, before the `{/* Holidays */}` comment):

```tsx
        {/* Crew breaks (company default) */}
        <Card className="p-6 md:p-8 shadow-lg border-0 bg-white dark:bg-gray-800">
          <h3 className="font-bold text-gray-800 dark:text-white text-xl font-heading mb-1 flex items-center gap-2">
            <Coffee className="w-5 h-5 text-primary-600 dark:text-primary-400" /> Crew Breaks
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Your company's standard break(s). These apply automatically to every scheduled crew day. You can change or remove them for any one person on any one day from the crew hours grid.
          </p>

          <div className="space-y-3">
            {breaks.length === 0 && <div className="text-center py-6 text-gray-400 dark:text-gray-500 italic">No standard breaks. Crews are scheduled with no break unless you add one per day.</div>}
            {breaks.map((b) => (
              <div key={b.id} className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="flex-1 min-w-[140px]">
                  <TextInput label="Name" placeholder="e.g. Lunch" value={b.label ?? ''} onChange={(v) => updateBreak(b.id, { label: v })} />
                </div>
                <div className="w-28">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-2">Minutes</span>
                  <input type="number" min={0} step={5} value={b.durationMinutes} onChange={(e) => updateBreak(b.id, { durationMinutes: Math.max(0, Number(e.target.value) || 0) })} className={TIME_INPUT_CLASS} />
                </div>
                <div className="w-32">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-2">Time</span>
                  <input type="time" step={300} value={b.startTime ?? ''} onChange={(e) => updateBreak(b.id, { startTime: e.target.value || undefined })} className={TIME_INPUT_CLASS} />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Paid</span>
                  <Toggle checked={b.paid} onChange={(v) => updateBreak(b.id, { paid: v })} />
                </div>
                <button onClick={() => removeBreak(b.id)} aria-label={`Remove ${b.label || 'break'}`} className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Leave <strong>Time</strong> empty for a flexible break (no fixed time) — it shows as a tag rather than a timed block. A blank time means "anytime during the day."</p>
          <Button onClick={addBreak} variant="secondary" className="mt-4"><Plus className="w-4 h-4 mr-2" /> Add break</Button>
        </Card>
```

**Note on `Toggle` / `Button` props:** This file already imports `Toggle` and `Button` from `'../UI'` and uses `<Toggle>` and `<Button variant=...>` elsewhere in the codebase. If `Toggle`'s prop is not `checked`/`onChange`, open `components/UI` to confirm the exact prop names and adjust this block to match (do not guess — read the component). Likewise confirm `Button` supports `variant="secondary"`; if not, drop the `variant` prop.

- [ ] **Step 3: Verify it compiles and renders**

Run: `npx tsc --noEmit`
Expected: No new type errors from this file.

Run the app (`npm run dev` or the project's start script), open Settings → Scheduling, and confirm: the Crew Breaks card appears, you can add a break, edit its name/minutes/time, toggle paid, and remove it. Values persist via the existing `setSettings` flow.

- [ ] **Step 4: Commit**

```bash
git add components/settings/SchedulingConfigView.tsx
git commit -m "feat: company default crew-breaks editor in scheduling settings"
```

---

## Task 6: BreakChip component

**Files:**
- Create: `components/views/JobScheduling/BreakChip.tsx`

A small presentational chip shared by the grid and the Day Board.

- [ ] **Step 1: Create the component**

Create `components/views/JobScheduling/BreakChip.tsx`:

```tsx
import React from 'react';
import { Coffee } from 'lucide-react';
import type { CrewBreak } from '../../../types';
import { fmtClock } from '../../../services/productionBoard';

/** A compact pill describing one break: icon, label/time, duration, and a paid/unpaid hint.
 *  `floating` styles it as the flexible (un-anchored) chip; the default suits inline lists. */
export const BreakChip = ({ brk, floating = false, onClick }: {
  brk: CrewBreak;
  floating?: boolean;
  onClick?: () => void;
}) => {
  const mins = brk.durationMinutes;
  const dur = mins % 60 === 0 ? `${mins / 60}h` : `${mins}m`;
  const timeOrFlex = brk.startTime ? fmtClock(brk.startTime) : 'flexible';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      title={`${brk.label || 'Break'} · ${dur} · ${timeOrFlex} · ${brk.paid ? 'paid' : 'unpaid'}`}
      className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
        floating ? 'border border-dashed' : ''
      } bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 ${
        onClick ? 'hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer' : ''
      }`}
    >
      <Coffee className="w-3 h-3 shrink-0" />
      <span className="truncate">{brk.label || 'Break'} · {dur}</span>
      <span className="text-gray-400">{timeOrFlex}</span>
      {!brk.paid && <span className="text-gray-400">· unpaid</span>}
    </Tag>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobScheduling/BreakChip.tsx
git commit -m "feat: BreakChip presentational component"
```

---

## Task 7: Break editor modal

**Files:**
- Create: `components/views/JobScheduling/BreakEditorModal.tsx`

Edits one member-day's breaks: shows the resolved breaks, lets the user add/edit/remove, and "Reset to company default". Returns `CrewBreak[]` (possibly empty) on save, or `undefined` for reset.

- [ ] **Step 1: Create the modal**

Create `components/views/JobScheduling/BreakEditorModal.tsx`:

```tsx
import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button, TextInput, Toggle } from '../../UI';
import type { CrewBreak } from '../../../types';

interface BreakEditorModalProps {
  memberName: string;
  dateKey: string;
  /** The currently-effective breaks for this day (resolved default-or-override). */
  initialBreaks: CrewBreak[];
  /** Whether this day is currently following the company default (no override set). */
  isDefault: boolean;
  onClose: () => void;
  /** Save the edited list (empty array = explicit "no breaks"). */
  onSave: (breaks: CrewBreak[]) => void;
  /** Drop the override so the day follows the company default again. */
  onResetToDefault: () => void;
}

const newId = (list: CrewBreak[]) => `brk-${list.length + 1}-${list.reduce((s, b) => s + b.durationMinutes, 0)}`;

export const BreakEditorModal = ({
  memberName, dateKey, initialBreaks, isDefault, onClose, onSave, onResetToDefault,
}: BreakEditorModalProps) => {
  const [draft, setDraft] = useState<CrewBreak[]>(initialBreaks);

  const patch = (id: string, p: Partial<CrewBreak>) => setDraft(d => d.map(b => (b.id === id ? { ...b, ...p } : b)));
  const add = () => setDraft(d => [...d, { id: newId(d), label: 'Break', durationMinutes: 30, paid: false }]);
  const remove = (id: string) => setDraft(d => d.filter(b => b.id !== id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Breaks · {memberName}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{dateKey}{isDefault && ' · following company default'}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
          {draft.length === 0 && <div className="text-center py-6 text-gray-400 italic">No breaks for this day.</div>}
          {draft.map((b) => (
            <div key={b.id} className="flex flex-wrap items-end gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-[120px]">
                <TextInput label="Name" placeholder="Lunch" value={b.label ?? ''} onChange={(v) => patch(b.id, { label: v })} />
              </div>
              <div className="w-24">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Minutes</span>
                <input type="number" min={0} step={5} value={b.durationMinutes} onChange={(e) => patch(b.id, { durationMinutes: Math.max(0, Number(e.target.value) || 0) })} className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-100 text-gray-900 dark:text-white" />
              </div>
              <div className="w-28">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Time</span>
                <input type="time" step={300} value={b.startTime ?? ''} onChange={(e) => patch(b.id, { startTime: e.target.value || undefined })} className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-primary-100 text-gray-900 dark:text-white" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Paid</span>
                <Toggle checked={b.paid} onChange={(v) => patch(b.id, { paid: v })} />
              </div>
              <button onClick={() => remove(b.id)} aria-label="Remove break" className="p-2 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <Button onClick={add} variant="secondary"><Plus className="w-4 h-4 mr-2" /> Add break</Button>
        </div>

        <div className="flex items-center justify-between gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
          <button onClick={onResetToDefault} className="text-sm font-semibold text-gray-500 hover:text-primary-600">Reset to company default</button>
          <div className="flex gap-2">
            <Button onClick={onClose} variant="secondary">Cancel</Button>
            <Button onClick={() => onSave(draft)}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

**Note:** Confirm `Button`/`Toggle`/`TextInput` prop names against `components/UI` (same caveat as Task 5). Match the existing modal pattern in `components/views/JobScheduling/AssignHoursModal.tsx` for overlay/escape behaviour if it differs from the above.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobScheduling/BreakEditorModal.tsx
git commit -m "feat: BreakEditorModal for per-member-day break overrides"
```

---

## Task 8: Show + edit breaks in the Crew Hours Grid

**Files:**
- Modify: `components/views/JobScheduling/CrewHoursGrid.tsx`
- Test: `components/views/JobScheduling/CrewHoursGrid.test.tsx`

- [ ] **Step 1: Write a failing render test**

Open `components/views/JobScheduling/CrewHoursGrid.test.tsx`, read its existing setup (how it builds a `model` and renders `<CrewHoursGrid>`), then add a test that a member-day's resolved break renders. Add the helper fields (`breaksByDay`, `paidHours`) to whatever row factory the test uses. Example test body (adapt the model-building to the file's existing helpers):

```typescript
it('renders a break chip for a member-day with breaks', () => {
  const model = makeModel({
    rows: [makeRow({
      memberId: 'm1', name: 'Mike',
      breaksByDay: { [DAY]: [{ id: 'b1', label: 'Lunch', durationMinutes: 30, paid: false, startTime: '12:00' }] },
      paidHours: 7.5,
    })],
  });
  render(<CrewHoursGrid model={model} canEdit={false} onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
  expect(screen.getByTitle(/Lunch · 30m/)).toBeInTheDocument();
});
```

If the test file has no `makeModel`/`makeRow` helpers, build the `CrewHoursGridModel` inline matching the interface in `services/crewHoursGrid.ts` (every `MemberRow` now needs `breaksByDay` and `paidHours`).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx`
Expected: FAIL — no element with that title (breaks not rendered yet).

- [ ] **Step 3: Implement rendering + the edit entry point**

In `components/views/JobScheduling/CrewHoursGrid.tsx`:

(a) Add imports:

```typescript
import { BreakChip } from './BreakChip';
import type { CrewBreak } from '../../../types';
```

(b) Add an optional prop to `CrewHoursGridProps` (after `onSelectJob?`, line 21) so the parent can open the editor. Keeping it optional means the Day view and existing call sites need no change:

```typescript
  /** Open the break editor for a member-day (omit to render breaks read-only). */
  onEditBreaks?: (memberId: string, dateKey: string) => void;
```

Add `onEditBreaks` to the destructured props (line 45).

(c) Render the breaks inside the day cell. In the `weekTable`'s day `<td>` (lines 168-178), replace the non-off branch so breaks render under the job chips:

```tsx
                  <td key={k} className={`px-2 py-3 align-top ${row.offByDay[k] ? 'bg-gray-50/70 dark:bg-gray-900/30' : ''}`}>
                    {row.offByDay[k] ? (
                      <div className="grid place-items-center h-9 text-[10px] font-bold uppercase tracking-wider text-gray-400">Off</div>
                    ) : (
                      <div className="space-y-1.5">
                        {cells.map(cell => renderChip(row, k, cell))}
                        {(row.breaksByDay[k] ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {(row.breaksByDay[k] ?? []).map(brk => (
                              <BreakChip
                                key={brk.id}
                                brk={brk}
                                floating={!brk.startTime}
                                onClick={canEdit && onEditBreaks ? () => onEditBreaks(row.memberId, k) : undefined}
                              />
                            ))}
                          </div>
                        )}
                        {canEdit && onEditBreaks && (row.breaksByDay[k] ?? []).length === 0 && (
                          <button type="button" onClick={() => onEditBreaks(row.memberId, k)} className="text-[10px] font-semibold text-gray-400 hover:text-primary-600">+ break</button>
                        )}
                      </div>
                    )}
                  </td>
```

(d) Show paid hours in the capacity readout. In `renderCapacity` (lines 90-106), add a paid-hours line after the existing `flex items-baseline` div (after line 100):

```tsx
        <div className="text-[10px] text-gray-400 mb-1">{row.paidHours}h paid</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx`
Expected: PASS — break chip renders; existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/CrewHoursGrid.tsx components/views/JobScheduling/CrewHoursGrid.test.tsx
git commit -m "feat: render and edit per-day breaks in the crew hours grid"
```

---

## Task 9: Wire defaults, break editing, and persistence in JobSchedulingView

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

This connects everything: pass `defaultBreaks` into the grid model, render the modal, and persist break edits onto the crew member.

- [ ] **Step 1: Read the view and locate the integration points**

Read `components/views/JobSchedulingView.tsx`. Find:
- where it calls `buildCrewHoursGrid(...)`,
- where it renders `<CrewHoursGrid ... />`,
- how it loads/saves crew members (the setter used when a member changes — e.g. an `onUpdateMember`/`setCrewMembers` prop or context),
- how `settings` (GlobalSettings) is available.

- [ ] **Step 2: Pass default breaks into the grid model**

At the `buildCrewHoursGrid(...)` call, add the new 7th argument:

```typescript
settings.scheduling?.defaultBreaks ?? []
```

So the call becomes `buildCrewHoursGrid(members, jobs, workOrders, weekDays, weekendDays, standardDay, settings.scheduling?.defaultBreaks ?? [])` (match the existing variable names in the file).

- [ ] **Step 3: Add break-editor state and handlers**

Add imports:

```typescript
import { BreakEditorModal } from './JobScheduling/BreakEditorModal';
import { resolveBreaks, setMemberDayBreaks } from '../../services/crewBreaks';
```

(Adjust the relative paths to match this file's location — `JobSchedulingView.tsx` is in `components/views/`, so the modal is `./JobScheduling/BreakEditorModal` and the service is `../../services/crewBreaks`.)

Add state for the open editor:

```typescript
const [breakEdit, setBreakEdit] = useState<{ memberId: string; dateKey: string } | null>(null);
```

Add a handler passed to the grid as `onEditBreaks`:

```typescript
const handleEditBreaks = (memberId: string, dateKey: string) => setBreakEdit({ memberId, dateKey });
```

Wire it onto the grid: add `onEditBreaks={handleEditBreaks}` to the `<CrewHoursGrid ... />` props (only where editing is enabled — i.e. where `canEdit` is true).

- [ ] **Step 4: Render the modal and persist edits**

Where the member is updated elsewhere in this file, reuse that same setter. Render the modal near the other modals/overlays in the returned JSX:

```tsx
{breakEdit && (() => {
  const member = members.find(m => m.id === breakEdit.memberId);
  if (!member) return null;
  const defaults = settings.scheduling?.defaultBreaks ?? [];
  const entry = member.schedule?.[breakEdit.dateKey];
  const persist = (updated: typeof member) => {
    // Replace with this file's existing member-update mechanism
    // (e.g. onUpdateMember(updated) or setCrewMembers(ms => ms.map(...))).
    onUpdateMember(updated);
    setBreakEdit(null);
  };
  return (
    <BreakEditorModal
      memberName={member.name}
      dateKey={breakEdit.dateKey}
      initialBreaks={resolveBreaks(entry, defaults)}
      isDefault={entry?.breaksOverride === undefined}
      onClose={() => setBreakEdit(null)}
      onSave={(breaks) => persist(setMemberDayBreaks(member, breakEdit.dateKey, breaks))}
      onResetToDefault={() => persist(setMemberDayBreaks(member, breakEdit.dateKey, undefined))}
    />
  );
})()}
```

Replace `onUpdateMember(updated)` with the file's actual member-persistence call (found in Step 1). If members come from props with no setter, thread one through following the existing pattern used for other member edits in the scheduling view.

- [ ] **Step 5: Verify end-to-end**

Run: `npx tsc --noEmit` (expect no new errors).
Run the app, open Job Scheduling → crew hours grid:
- A member-day with the company default shows the break chip.
- Click the chip (or "+ break") → modal opens, pre-filled with the resolved breaks.
- Edit/add/remove → Save → the chip and the member's capacity/paid numbers update.
- "Reset to company default" → the day follows the default again.
- Changing the company default in Settings updates untouched days but not overridden ones.

- [ ] **Step 6: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: wire break defaults, editor, and persistence into job scheduling view"
```

---

## Task 10: Draw breaks on the Day Board timeline

**Files:**
- Modify: `components/views/JobScheduling/DayBoard.tsx`, `components/views/JobSchedulingView.tsx`

Fixed breaks (with `startTime`) render as anchored blocks at their clock time; flexible breaks (no `startTime`) render as floating chips at the top of the lane column.

- [ ] **Step 1: Add a `laneBreaks` prop to DayBoard**

In `components/views/JobScheduling/DayBoard.tsx`:

(a) Add imports:

```typescript
import type { CrewBreak } from '../../../types';
import { BreakChip } from './BreakChip';
```

(b) Add to `DayBoardProps` (after `onRemoveBlockHours?`, line 33):

```typescript
  /** Effective breaks for a lane (member) on this day. Fixed breaks anchor to their
   *  time; flexible breaks (no startTime) float at the top of the column. */
  laneBreaks?: (laneId: string) => CrewBreak[];
```

Add `laneBreaks` to the destructured props (line 70-71).

(c) Add a helper above the component (after `HOUR_HEIGHT`, line 11):

```typescript
// Convert 'HH:mm' to a fractional hour (e.g. '12:30' -> 12.5). Returns null if blank.
const hhmmToHours = (t?: string): number | null => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
};
```

(d) Render breaks inside the lane column, after the `{row.blocks.map(block => ...)}` loop closes (after line 269, still inside the lane `<div>`):

```tsx
            {(() => {
              const lb = laneBreaks?.(row.laneId) ?? [];
              const fixed = lb.filter(b => b.startTime);
              const flexible = lb.filter(b => !b.startTime);
              return (
                <>
                  {fixed.map(b => {
                    const startH = hhmmToHours(b.startTime)!;
                    const top = ((startH - axisStart) / span) * 100;
                    const height = (b.durationMinutes / 60 / span) * 100;
                    return (
                      <div
                        key={b.id}
                        className="pointer-events-none absolute inset-x-1 z-[4] rounded-md border border-dashed border-gray-400/70 bg-gray-200/70 dark:bg-gray-600/60 px-1.5 py-0.5 overflow-hidden"
                        style={{ top: `${top}%`, height: `${Math.max(2, height)}%` }}
                        title={`${b.label || 'Break'} · ${b.paid ? 'paid' : 'unpaid'}`}
                      >
                        <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-200 truncate">{b.label || 'Break'} · {fmtClock(b.startTime!)}</span>
                      </div>
                    );
                  })}
                  {flexible.length > 0 && (
                    <div className="absolute top-1 inset-x-1 z-[6] flex flex-wrap gap-1">
                      {flexible.map(b => <BreakChip key={b.id} brk={b} floating />)}
                    </div>
                  )}
                </>
              );
            })()}
```

- [ ] **Step 2: Supply `laneBreaks` from JobSchedulingView**

In `components/views/JobSchedulingView.tsx`, where `<DayBoard ... />` is rendered, add a resolver prop. The Day Board's lane id is the crew member id in the crew view:

```tsx
laneBreaks={(laneId) => {
  const m = members.find(mm => mm.id === laneId);
  return resolveBreaks(m?.schedule?.[dayKey], settings.scheduling?.defaultBreaks ?? []);
}}
```

Use the file's actual variable for the selected day key (the `dayKey` passed to `<DayBoard>`). `resolveBreaks` is already imported from Task 9.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` (no new errors).
Run the app, open the Day Board view:
- A fixed break (e.g. lunch 12:00) shows a dashed block at noon.
- A flexible break (no time) shows a floating chip at the top of the lane.

- [ ] **Step 4: Commit**

```bash
git add components/views/JobScheduling/DayBoard.tsx components/views/JobSchedulingView.tsx
git commit -m "feat: draw fixed-time breaks as blocks and flexible breaks as chips on the day board"
```

---

## Final verification

- [ ] **Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: No new errors introduced by this work.

- [ ] **Manual smoke test** (per the spec's plain-English behavior)

1. Settings → add a 30-min unpaid lunch at 12:00 as the company default.
2. Crew hours grid: every scheduled member shows the lunch chip; capacity dropped by 0.5h/day.
3. Override one member's day to a 1-hour lunch; another to "no break" (remove all). Confirm only those days change.
4. Change the company default to 45 min; untouched days follow it, overridden days don't.
5. Day Board: fixed lunch shows a block at noon; switch a break to flexible (clear its time) and confirm it shows as a floating chip.

---

## Self-review notes (for the implementer)

- **Type names are consistent across tasks:** `CrewBreak` (with `id`, `label?`, `durationMinutes`, `paid`, `startTime?`), `resolveBreaks(entry, defaultBreaks)`, `breakHours`, `paidBreakHours`, `setMemberDayBreaks(member, dateKey, breaks)`, and the new `MemberRow` fields `breaksByDay` / `paidHours`. Use these exact names.
- **UI component props (`Button`, `Toggle`, `TextInput`):** Tasks 5 and 7 assume `Toggle` uses `checked`/`onChange` and `Button` supports `variant`. These are assumptions — open `components/UI` once at the start of Task 5 and confirm/adjust; the same confirmed prop shapes apply to Task 7.
- **No `Date.now()`/`Math.random()` for break ids** — ids are derived from list length + total minutes, which is deterministic and unique enough within these small lists.
- **v1 boundary:** `computeWeeklyHours` (crew assignment list) stays break-unaware; only the crew-hours grid and Day Board reflect breaks. This is deliberate per the spec.
