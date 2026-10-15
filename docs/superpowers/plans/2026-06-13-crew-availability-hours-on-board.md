# Crew Availability Hours on the Scheduling Board — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the Availability toggle is on, every crew member's row on the Job Scheduling board shows their per-day working-hours window (e.g. `8a–5p`) from their schedule settings, with an `Off` badge (+ reason) on off days.

**Architecture:** A single shared resolver (`services/crewAvailability.ts`) turns `member.schedule[dayKey]` (or the company default window) into a `DayAvailability` value. Three crew sub-views render it: the Week Board (`renderCellExtra`), the Week Hours grid (`CrewHoursGrid` via a new `availByDay` model field), and the Day timeline (`DayBoard` row label). Purely presentational — no schedule writes.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react. Test runner: `npx vitest run <path>`.

---

## File Structure

- **Create** `services/crewAvailability.ts` — `DayAvailability`, `resolveDayAvailability`, `formatAvailWindow`. One responsibility: resolve + format per-day availability.
- **Create** `services/crewAvailability.test.ts` — unit tests for the resolver/formatter.
- **Modify** `services/crewHoursGrid.ts` — add `availByDay` to `MemberRow`; add optional `defaultWindow` param to `buildCrewHoursGrid`.
- **Modify** `components/views/JobScheduling/CrewHoursGrid.tsx` — render the hours label per working-day cell when `showAvailability`.
- **Modify** `components/views/JobScheduling/CrewHoursGrid.test.tsx` — assert the label shows/hides.
- **Modify** `components/views/JobSchedulingView.tsx` — derive the default window; rewrite Week Board `renderCellExtra`; thread `defaultWindow` into both `buildCrewHoursGrid` calls; add the hours line to both Day `renderRowLabel` callbacks; remove the inline `formatAvail`.

---

## Task 1: Shared availability resolver

**Files:**
- Create: `services/crewAvailability.ts`
- Test: `services/crewAvailability.test.ts`

- [ ] **Step 1: Write the failing test**

Create `services/crewAvailability.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveDayAvailability, formatAvailWindow } from './crewAvailability';
import type { CrewMember } from '../types';

const DEF = { startTime: '08:00', endTime: '17:00' };
const member = (schedule?: CrewMember['schedule']): CrewMember => ({
  id: 'm1', name: 'Mike', role: 'Painter', schedule,
});

describe('resolveDayAvailability', () => {
  it('uses the per-day schedule entry when present', () => {
    const m = member({ '2026-06-08': { date: '2026-06-08', startTime: '07:00', endTime: '15:30', isOff: false } });
    expect(resolveDayAvailability(m, '2026-06-08', DEF)).toEqual({ off: false, startTime: '07:00', endTime: '15:30' });
  });

  it('falls back to the default window when there is no entry', () => {
    expect(resolveDayAvailability(member(), '2026-06-08', DEF)).toEqual({ off: false, startTime: '08:00', endTime: '17:00' });
  });

  it('reports off with the reason when the day is marked off', () => {
    const m = member({ '2026-06-08': { date: '2026-06-08', startTime: '08:00', endTime: '17:00', isOff: true, reason: 'PTO' } });
    expect(resolveDayAvailability(m, '2026-06-08', DEF)).toEqual({ off: true, reason: 'PTO', startTime: '08:00', endTime: '17:00' });
  });
});

describe('formatAvailWindow', () => {
  it('formats a whole-hour window compactly', () => {
    expect(formatAvailWindow({ off: false, startTime: '08:00', endTime: '17:00' })).toBe('8a–5p');
  });

  it('keeps minutes when not on the hour', () => {
    expect(formatAvailWindow({ off: false, startTime: '08:30', endTime: '12:00' })).toBe('8:30a–12p');
  });

  it('shows the reason (or "Off") when off', () => {
    expect(formatAvailWindow({ off: true, reason: 'PTO', startTime: '08:00', endTime: '17:00' })).toBe('PTO');
    expect(formatAvailWindow({ off: true, startTime: '08:00', endTime: '17:00' })).toBe('Off');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/crewAvailability.test.ts`
Expected: FAIL — cannot resolve `./crewAvailability`.

- [ ] **Step 3: Write minimal implementation**

Create `services/crewAvailability.ts`:

```ts
import type { CrewMember } from '../types';

export interface DayAvailability {
  off: boolean;
  reason?: string;
  startTime: string; // 'HH:mm'
  endTime: string;   // 'HH:mm'
}

/** A member's availability for one day: their schedule entry when present, else the
 *  company default window. `off` carries the optional reason. */
export const resolveDayAvailability = (
  member: CrewMember,
  dayKey: string,
  defaultWindow: { startTime: string; endTime: string },
): DayAvailability => {
  const s = member.schedule?.[dayKey];
  const startTime = s?.startTime || defaultWindow.startTime;
  const endTime = s?.endTime || defaultWindow.endTime;
  if (s?.isOff) return { off: true, reason: s.reason, startTime, endTime };
  return { off: false, startTime, endTime };
};

const compact = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'p' : 'a';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${period}` : `${h12}${period}`;
};

/** Compact board label: "8a–5p" on working days; reason or "Off" when off. */
export const formatAvailWindow = (a: DayAvailability): string =>
  a.off ? (a.reason || 'Off') : `${compact(a.startTime)}–${compact(a.endTime)}`;
```

Note: the separator is an en-dash (`–`, U+2013) to match the existing `EditableHoursChip`/`fmtClock` style.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/crewAvailability.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add services/crewAvailability.ts services/crewAvailability.test.ts
git commit -m "feat(schedule): shared crew day-availability resolver"
```

---

## Task 2: Week Board — show the hours window in `renderCellExtra`

**Files:**
- Modify: `components/views/JobSchedulingView.tsx` (imports; remove `formatAvail` ~594-598; add `availWindow` near ~393; rewrite `renderCellExtra` ~1338-1350)

- [ ] **Step 1: Add the import**

In `components/views/JobSchedulingView.tsx`, add near the other `services/` imports (alongside the `crewBreaks` import at line 32):

```ts
import { resolveDayAvailability, formatAvailWindow } from '../../services/crewAvailability';
```

- [ ] **Step 2: Add the default-window helper + memo**

Just after the `capacityHours` definition (around line 393-394), add:

```ts
  // Company default working window (members without a per-day schedule entry fall back
  // to this); used to render availability overlays on the crew board.
  const hourToHHmm = (h: number) => `${String(h).padStart(2, '0')}:00`;
  const availWindow = useMemo(
    () => ({ startTime: hourToHHmm(workConfig.workDayStartHour), endTime: hourToHHmm(workConfig.workDayEndHour) }),
    [workConfig.workDayStartHour, workConfig.workDayEndHour],
  );
```

- [ ] **Step 3: Remove the inline `formatAvail`**

Delete the `formatAvail` function (lines ~594-598):

```ts
  const formatAvail = (emp: CrewMember, dayKey: string) => {
    const s = emp.schedule?.[dayKey];
    if (s?.isOff) return { off: true as const, text: s.reason || 'Off' };
    return { off: false as const, text: `${s?.startTime || '08:00'}–${s?.endTime || '17:00'}` };
  };
```

- [ ] **Step 4: Rewrite the Week Board `renderCellExtra`**

Replace the `renderCellExtra` block on `ProductionBoard` (lines ~1338-1350):

```jsx
          renderCellExtra={view === 'member' && showAvailability
            ? (laneId, dayKey) => {
                const emp = allStaff.find(s => s.id === laneId);
                if (!emp) return null;
                const a = formatAvail(emp, dayKey);
                if (!a.off) return null;
                return (
                  <div className="absolute top-1 right-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded text-red-500 bg-red-50 dark:bg-red-900/30">
                    {a.text}
                  </div>
                );
              }
            : undefined}
```

with:

```jsx
          renderCellExtra={view === 'member' && showAvailability
            ? (laneId, dayKey) => {
                const emp = allStaff.find(s => s.id === laneId);
                if (!emp) return null;
                const a = resolveDayAvailability(emp, dayKey, availWindow);
                return a.off ? (
                  <div className="absolute top-1 right-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded text-red-500 bg-red-50 dark:bg-red-900/30">
                    {formatAvailWindow(a)}
                  </div>
                ) : (
                  <div className="absolute top-1 right-1 text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded text-gray-400 bg-gray-50 dark:bg-gray-900/40">
                    {formatAvailWindow(a)}
                  </div>
                );
              }
            : undefined}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean). If `CrewMember` is now an unused import, remove it from the import on line 8.

- [ ] **Step 6: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat(schedule): show hours window on the crew week board"
```

---

## Task 3: Week Hours grid model — `availByDay`

**Files:**
- Modify: `services/crewHoursGrid.ts` (`MemberRow` interface ~8-24; `buildCrewHoursGrid` signature ~334-342; row build ~357-385)
- Modify: `services/crewHoursGrid.test.ts` (add one assertion)

- [ ] **Step 1: Write the failing test**

In `services/crewHoursGrid.test.ts`, inside the `describe('buildCrewHoursGrid', ...)` block (after line 217), add:

```ts
  it('exposes a resolved availability window per day, defaulting when no schedule entry', () => {
    const model = buildCrewHoursGrid([member()], [], [], weekDates, WEEKEND, 8, [], { startTime: '07:00', endTime: '15:00' });
    const key = model.dayKeys[0];
    expect(model.rows[0].availByDay[key]).toEqual({ off: false, startTime: '07:00', endTime: '15:00' });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: FAIL — `availByDay` is undefined (and the 8th arg is not yet accepted).

- [ ] **Step 3: Add the import + `availByDay` field**

In `services/crewHoursGrid.ts`, add to the imports at the top:

```ts
import { resolveDayAvailability, type DayAvailability } from './crewAvailability';
```

Add to the `MemberRow` interface (after `breaksByDay` at line 21):

```ts
  /** Resolved availability window per day key (schedule entry or default window). */
  availByDay: Record<string, DayAvailability>;
```

- [ ] **Step 4: Add the optional `defaultWindow` param**

Change the `buildCrewHoursGrid` signature (lines 334-342) — add a final optional param after `defaultBreaks`:

```ts
export const buildCrewHoursGrid = (
  members: CrewMember[],
  jobs: Job[],
  workOrders: WorkOrder[],
  weekDays: Date[],
  weekendDays: number[],
  standardDay: number,
  defaultBreaks: CrewBreak[] = [],
  defaultWindow: { startTime: string; endTime: string } = { startTime: '08:00', endTime: '17:00' },
): CrewHoursGridModel => {
```

- [ ] **Step 5: Populate `availByDay` in the row loop**

In the per-member block, add an `availByDay` accumulator next to `offByDay` (after line 352):

```ts
    const offByDay: Record<string, boolean> = {};
    const availByDay: Record<string, DayAvailability> = {};
```

Inside the `for (const key of dayKeys)` loop, after `offByDay[key] = ...` (line 358), add:

```ts
      availByDay[key] = resolveDayAvailability(m, key, defaultWindow);
```

Add `availByDay` to the returned row object (in the `return { ... }` at lines 379-385, alongside `cellsByDay, offByDay, breaksByDay`):

```ts
      cellsByDay, offByDay, breaksByDay, availByDay,
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS (existing tests + the new one). Existing 6/7-arg callers still compile because `defaultWindow` is optional.

- [ ] **Step 7: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "feat(schedule): expose per-day availByDay on the hours grid model"
```

---

## Task 4: Week Hours grid — render the hours label

**Files:**
- Modify: `components/views/JobScheduling/CrewHoursGrid.tsx` (working-day cell body ~193-212)
- Modify: `components/views/JobScheduling/CrewHoursGrid.test.tsx` (add a test)

- [ ] **Step 1: Write the failing test**

In `components/views/JobScheduling/CrewHoursGrid.test.tsx`, first add `availByDay` to the shared `model` fixture's row (it's a required `MemberRow` field now) — add after `breaksByDay` (line 13):

```ts
    availByDay: { '2026-06-08': { off: false, startTime: '08:00', endTime: '17:00' }, '2026-06-09': { off: false, startTime: '08:00', endTime: '17:00' } },
```

Then add this test before the closing `});` of the `describe('CrewHoursGrid', ...)` block:

```ts
  it('shows the per-day hours window on a working cell, hidden when showAvailability is false', () => {
    const { rerender } = render(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.getAllByText('8a–5p').length).toBeGreaterThan(0);
    rerender(<CrewHoursGrid model={model} canEdit showAvailability={false} onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.queryByText('8a–5p')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx`
Expected: FAIL — `8a–5p` is not rendered.

- [ ] **Step 3: Import the formatter**

In `components/views/JobScheduling/CrewHoursGrid.tsx`, add to the imports:

```ts
import { formatAvailWindow } from '../../../services/crewAvailability';
```

- [ ] **Step 4: Render the hours label in the working-day cell**

In the cell body (the `else` branch, inside `<div className="space-y-1.5">` at line 194), add the hours label as the first child, before `{cells.map(...)}`:

```jsx
                      <div className="space-y-1.5">
                        {showAvailability && row.availByDay[k] && !row.availByDay[k].off && (
                          <div className="text-[10px] font-semibold text-gray-400 tabular-nums">{formatAvailWindow(row.availByDay[k])}</div>
                        )}
                        {cells.map(cell => renderChip(row, k, cell))}
```

(Leave the rest of the block — break chips, `+ break` — unchanged.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx`
Expected: PASS (all existing tests + the new one).

- [ ] **Step 6: Commit**

```bash
git add components/views/JobScheduling/CrewHoursGrid.tsx components/views/JobScheduling/CrewHoursGrid.test.tsx
git commit -m "feat(schedule): show hours window in the crew week hours grid"
```

---

## Task 5: Day timeline — hours line under the member name + thread `defaultWindow`

**Files:**
- Modify: `components/views/JobSchedulingView.tsx` (both `buildCrewHoursGrid` calls ~582, ~590; Day+Hours `renderRowLabel` ~1223-1228; Day+Board `renderRowLabel` ~1284-1289)

- [ ] **Step 1: Thread `defaultWindow` into both grid builders**

Update the `hoursModel` call (line 582) to pass `availWindow` as the 8th arg:

```ts
      ? buildCrewHoursGrid(activeStaff, displayJobs, workOrders, weekDays, workConfig.weekendDays, capacityHours, settings.scheduling?.defaultBreaks ?? [], availWindow)
```

Update the `dayModel` call (line 590) likewise:

```ts
      ? buildCrewHoursGrid(activeStaff, displayJobs, workOrders, [currentDate], workConfig.weekendDays, capacityHours, settings.scheduling?.defaultBreaks ?? [], availWindow)
```

Add `availWindow` to both `useMemo` dependency arrays (lines 584 and 592) — append `, availWindow` before the closing `]`.

Note: `availWindow` is defined in Task 2 Step 2 (above line 580), so it is in scope here.

- [ ] **Step 2: Add the hours line to the Day+Hours `renderRowLabel`**

In the Day+Hours `DayBoard` `renderRowLabel` (the block starting line 1211), inside `<div className="min-w-0">`, after the inactive/role line (line 1227), add:

```jsx
                              {!lane.inactive && showAvailability && (() => {
                                const a = resolveDayAvailability(emp ?? { id: lane.crewId, name: lane.crewName, role: '' }, selectedDayKey, availWindow);
                                return <div className="text-[11px] text-gray-400 truncate tabular-nums">{formatAvailWindow(a)}</div>;
                              })()}
```

- [ ] **Step 3: Add the hours line to the Day+Board `renderRowLabel`**

In the Day+Board `DayBoard` `renderRowLabel` (the block starting line 1276), inside its `<div className="min-w-0">`, after the inactive/role line (line 1288), add the identical snippet:

```jsx
                      {!lane.inactive && showAvailability && (() => {
                        const a = resolveDayAvailability(emp ?? { id: lane.crewId, name: lane.crewName, role: '' }, selectedDayKey, availWindow);
                        return <div className="text-[11px] text-gray-400 truncate tabular-nums">{formatAvailWindow(a)}</div>;
                      })()}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 5: Run the JobScheduling suite**

Run: `npx vitest run components/views/JobScheduling/ services/crewHoursGrid.test.ts services/crewAvailability.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat(schedule): show hours window on the day timeline crew rows"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 3: Manual smoke (optional but recommended)**

Start the app, go to Job Scheduling → switch to the **Crew** (member) view:
- Week Board: working days show `8a–5p`; toggle Availability off → labels vanish, job bars stay.
- Week Hours: each working cell shows `8a–5p` above its chips; toggle off → gone.
- Day (Board and Hours): each member row shows `8a–5p` under the name; toggle off → gone.
- A member-day marked off in the Edit Team Member modal shows `Off`/reason instead.
```
