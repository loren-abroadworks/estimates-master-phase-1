# Day View — Job Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Day scale to Job Scheduling that renders the selected date as an hourly timeline (rows = crew members or jobs), with click-to-open, drag-to-adjust-time, and rain-day marking.

**Architecture:** A new pure model module `services/dayBoard.ts` reuses the existing lane builders (`buildMemberLanes`/`buildJobLanes`) and `jobDayWindow` to position each job as a vertically-placed hour-block for one day. A new `components/views/JobScheduling/DayBoard.tsx` renders that timeline with its own vertical pointer-drag. `JobSchedulingView` gains a `'day'` scale wired into the existing date navigator and render branch. `ProductionBoard` is untouched.

**Tech Stack:** React + TypeScript, Tailwind, Vitest + @testing-library/react. Test command: `npx vitest run <file>`.

---

## File Structure

- **Create** `services/dayBoard.ts` — pure model: `buildDayBlocks`, `setJobDayWindow`, helper time math.
- **Create** `services/dayBoard.test.ts` — unit tests for the model.
- **Create** `components/views/JobScheduling/DayBoard.tsx` — timeline view component.
- **Create** `components/views/JobScheduling/DayBoard.test.tsx` — component tests.
- **Modify** `components/views/JobSchedulingView.tsx` — widen `scale` to include `'day'`, add day nav handlers, hours-mode guard, Day toggle button, and the render branch.

Existing building blocks reused (do not modify):
- `services/productionBoard.ts`: `BoardLane`, `BoardCard`, `buildMemberLanes`, `buildJobLanes`, `jobDayWindow`, `fmtClock`, `jobColor`.
- `services/scheduleEngine.ts`: `WorkingTimeConfig` (`weekendDays`, `workDayStartHour`, `workDayEndHour`), `toLocalDateKey`.
- `components/views/JobScheduling/JobCard.tsx` for card styling reference.

---

## Task 1: Day-block model — positioning math

**Files:**
- Create: `services/dayBoard.ts`
- Test: `services/dayBoard.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { buildDayBlocks } from './dayBoard';
import { buildJobLanes } from './productionBoard';
import { configFromSettings } from './scheduleEngine';
import type { Job } from '../types';

const cfg = configFromSettings(undefined, false); // 8:00–17:00, weekend [0,6]

const job = (over: Partial<Job> = {}): Job =>
  ({ id: 'j1', jobNumber: 'J-1', name: 'Repaint', stage: 'Scheduled', clientId: 'c1',
     startDate: '2026-06-10T08:00:00', endDate: '2026-06-10T17:00:00', ...over } as Job);

// 2026-06-10 is a Wednesday.
const DAY = '2026-06-10';

describe('buildDayBlocks', () => {
  it('positions a full-workday job to span the whole axis', () => {
    const lanes = buildJobLanes([job()], [new Date('2026-06-10T12:00:00')], cfg);
    const rows = buildDayBlocks(lanes, DAY, cfg.workDayStartHour, cfg.workDayEndHour);
    const block = rows[0].blocks[0];
    expect(block.topPct).toBe(0);
    expect(block.heightPct).toBe(100);
    expect(block.clamped).toBe(false);
  });

  it('positions a midday job partway down the axis (10:00–14:00 of 8–17)', () => {
    const j = job({ startDate: '2026-06-10T10:00:00', endDate: '2026-06-10T14:00:00' });
    const lanes = buildJobLanes([j], [new Date('2026-06-10T12:00:00')], cfg);
    const block = buildDayBlocks(lanes, DAY, 8, 17)[0].blocks[0];
    // axis = 9h. top = (10-8)/9, height = (14-10)/9.
    expect(block.topPct).toBeCloseTo((2 / 9) * 100, 5);
    expect(block.heightPct).toBeCloseTo((4 / 9) * 100, 5);
    expect(block.clamped).toBe(false);
  });

  it('clamps a job that starts before the axis and flags it', () => {
    const j = job({ startDate: '2026-06-10T06:00:00', endDate: '2026-06-10T12:00:00' });
    const lanes = buildJobLanes([j], [new Date('2026-06-10T12:00:00')], cfg);
    const block = buildDayBlocks(lanes, DAY, 8, 17)[0].blocks[0];
    expect(block.topPct).toBe(0);
    expect(block.heightPct).toBeCloseTo((4 / 9) * 100, 5); // 8→12
    expect(block.clamped).toBe(true);
  });

  it('clamps a job that ends after the axis and flags it', () => {
    const j = job({ startDate: '2026-06-10T15:00:00', endDate: '2026-06-10T20:00:00' });
    const lanes = buildJobLanes([j], [new Date('2026-06-10T12:00:00')], cfg);
    const block = buildDayBlocks(lanes, DAY, 8, 17)[0].blocks[0];
    expect(block.topPct).toBeCloseTo((7 / 9) * 100, 5); // 15
    expect(block.heightPct).toBeCloseTo((2 / 9) * 100, 5); // 15→17
    expect(block.clamped).toBe(true);
  });

  it('enforces a minimum height so a zero-length block still renders', () => {
    const j = job({ startDate: '2026-06-10T10:00:00', endDate: '2026-06-10T10:00:00' });
    const lanes = buildJobLanes([j], [new Date('2026-06-10T12:00:00')], cfg);
    const block = buildDayBlocks(lanes, DAY, 8, 17)[0].blocks[0];
    expect(block.heightPct).toBeGreaterThan(0);
  });

  it('uses the per-day dailyHours override when present', () => {
    const j = job({ dailyHours: { [DAY]: { startTime: '11:00', endTime: '13:00' } } });
    const lanes = buildJobLanes([j], [new Date('2026-06-10T12:00:00')], cfg);
    const block = buildDayBlocks(lanes, DAY, 8, 17)[0].blocks[0];
    expect(block.startTime).toBe('11:00');
    expect(block.endTime).toBe('13:00');
    expect(block.topPct).toBeCloseTo((3 / 9) * 100, 5); // 11
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run services/dayBoard.test.ts`
Expected: FAIL — "buildDayBlocks is not a function" / module not found.

- [ ] **Step 3: Implement the model**

Create `services/dayBoard.ts`:

```typescript
import type { Job } from '../types';
import { WorkingTimeConfig } from './scheduleEngine';
import { BoardLane, BoardCard, jobColor } from './productionBoard';

const MIN_HEIGHT_PCT = 4; // smallest visible block

export interface DayBlock {
  card: BoardCard;
  topPct: number;     // 0–100, block top within the hour axis
  heightPct: number;  // 0–100, block height
  startTime: string;  // HH:mm shown on the block (pre-clamp)
  endTime: string;
  clamped: boolean;   // true if real times fell outside the axis
}

export interface DayRow {
  laneId: string;
  laneName: string;
  blocks: DayBlock[];
}

// "HH:mm" -> fractional hours (e.g. "10:30" -> 10.5).
const toHours = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h + (m || 0) / 60;
};

/** Turn each lane's cards into vertically-positioned hour blocks for one day.
 *  Times are taken from the card's per-day window (already resolved by the lane
 *  builder via jobDayWindow), clamped to [axisStart, axisEnd]. */
export const buildDayBlocks = (
  lanes: BoardLane[],
  dayKey: string,
  axisStart: number,
  axisEnd: number,
): DayRow[] => {
  const span = Math.max(1, axisEnd - axisStart);
  return lanes.map(lane => {
    const cards = lane.cardsByDay[dayKey] ?? [];
    const blocks = cards.map<DayBlock>(card => {
      const rawStart = toHours(card.startTime);
      const rawEnd = toHours(card.endTime);
      const start = Math.min(Math.max(rawStart, axisStart), axisEnd);
      const end = Math.min(Math.max(rawEnd, axisStart), axisEnd);
      const topPct = ((start - axisStart) / span) * 100;
      const heightPct = Math.max(MIN_HEIGHT_PCT, ((end - start) / span) * 100);
      return {
        card,
        topPct,
        heightPct,
        startTime: card.startTime,
        endTime: card.endTime,
        clamped: rawStart < axisStart || rawEnd > axisEnd,
      };
    });
    return { laneId: lane.crewId, laneName: lane.crewName, blocks };
  });
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run services/dayBoard.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add services/dayBoard.ts services/dayBoard.test.ts
git commit -m "feat: day-board block positioning model"
```

---

## Task 2: `setJobDayWindow` helper (drag-commit target)

**Files:**
- Modify: `services/dayBoard.ts`
- Test: `services/dayBoard.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `services/dayBoard.test.ts`:

```typescript
import { setJobDayWindow } from './dayBoard';

describe('setJobDayWindow', () => {
  it('writes the day window into dailyHours without mutating the input', () => {
    const j = job();
    const next = setJobDayWindow(j, DAY, { startTime: '09:30', endTime: '15:30' });
    expect(next).not.toBe(j);
    expect(j.dailyHours).toBeUndefined();
    expect(next.dailyHours?.[DAY]).toEqual({ startTime: '09:30', endTime: '15:30' });
  });

  it('leaves other days untouched', () => {
    const j = job({ dailyHours: { '2026-06-11': { startTime: '08:00', endTime: '12:00' } } });
    const next = setJobDayWindow(j, DAY, { startTime: '10:00', endTime: '14:00' });
    expect(next.dailyHours?.['2026-06-11']).toEqual({ startTime: '08:00', endTime: '12:00' });
    expect(next.dailyHours?.[DAY]).toEqual({ startTime: '10:00', endTime: '14:00' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run services/dayBoard.test.ts`
Expected: FAIL — "setJobDayWindow is not a function".

- [ ] **Step 3: Implement**

Append to `services/dayBoard.ts`:

```typescript
/** Pure: return a new Job with this day's start/end clock times set in dailyHours. */
export const setJobDayWindow = (
  job: Job,
  dayKey: string,
  window: { startTime: string; endTime: string },
): Job => ({
  ...job,
  dailyHours: { ...job.dailyHours, [dayKey]: window },
});
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run services/dayBoard.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add services/dayBoard.ts services/dayBoard.test.ts
git commit -m "feat: setJobDayWindow helper for day-view drag commit"
```

---

## Task 3: `DayBoard` component — render rows, hour axis, blocks

**Files:**
- Create: `components/views/JobScheduling/DayBoard.tsx`
- Test: `components/views/JobScheduling/DayBoard.test.tsx`

- [ ] **Step 1: Write failing render tests**

Create `components/views/JobScheduling/DayBoard.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayBoard } from './DayBoard';
import { buildJobLanes } from '../../../services/productionBoard';
import { configFromSettings } from '../../../services/scheduleEngine';
import type { Job } from '../../../types';

const cfg = configFromSettings(undefined, false);
const DAY = '2026-06-10';

const job = (over: Partial<Job> = {}): Job =>
  ({ id: 'j1', jobNumber: 'J-1', name: 'Repaint', stage: 'Scheduled', clientId: 'c1',
     startDate: '2026-06-10T10:00:00', endDate: '2026-06-10T14:00:00', ...over } as Job);

const lanesFor = (jobs: Job[]) => buildJobLanes(jobs, [new Date('2026-06-10T12:00:00')], cfg);

const base = {
  dayKey: DAY,
  config: cfg,
  canReschedule: true,
  renderRowLabel: undefined,
  onViewJob: vi.fn(),
  onChangeDayWindow: vi.fn(),
  onMarkRainDay: vi.fn(),
  rainDays: [] as { date: string }[],
};

describe('DayBoard', () => {
  it('renders hour gridline labels for the configured workday', () => {
    render(<DayBoard {...base} lanes={lanesFor([job()])} />);
    expect(screen.getByText('8:00 AM')).toBeInTheDocument();
    expect(screen.getByText('5:00 PM')).toBeInTheDocument();
  });

  it('renders a block for each job in the day', () => {
    render(<DayBoard {...base} lanes={lanesFor([job()])} />);
    expect(screen.getByText('Repaint')).toBeInTheDocument();
  });

  it('opens details when a block is clicked', () => {
    const onViewJob = vi.fn();
    render(<DayBoard {...base} onViewJob={onViewJob} lanes={lanesFor([job()])} />);
    fireEvent.click(screen.getByText('Repaint'));
    expect(onViewJob).toHaveBeenCalledWith('j1');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run components/views/JobScheduling/DayBoard.test.tsx`
Expected: FAIL — cannot find module './DayBoard'.

- [ ] **Step 3: Implement the component (render only, drag added in Task 4)**

Create `components/views/JobScheduling/DayBoard.tsx`:

```tsx
import React, { useMemo } from 'react';
import { CloudRain } from 'lucide-react';
import { WorkingTimeConfig } from '../../../services/scheduleEngine';
import { BoardLane, fmtClock } from '../../../services/productionBoard';
import { buildDayBlocks } from '../../../services/dayBoard';

const pad2 = (n: number) => String(n).padStart(2, '0');

interface DayBoardProps {
  lanes: BoardLane[];
  dayKey: string;
  config: WorkingTimeConfig;
  canReschedule: boolean;
  rainDays?: { date: string }[];
  renderRowLabel?: (lane: BoardLane) => React.ReactNode;
  onViewJob?: (jobId: string) => void;
  /** Commit a new start/end clock for a job on this day. */
  onChangeDayWindow?: (jobId: string, dayKey: string, window: { startTime: string; endTime: string }) => void;
  onMarkRainDay?: (dayKey: string) => void;
}

export const DayBoard = ({
  lanes, dayKey, config, canReschedule, rainDays, renderRowLabel, onViewJob, onMarkRainDay,
}: DayBoardProps) => {
  const axisStart = config.workDayStartHour;
  const axisEnd = config.workDayEndHour;
  const rows = useMemo(
    () => buildDayBlocks(lanes, dayKey, axisStart, axisEnd),
    [lanes, dayKey, axisStart, axisEnd],
  );
  const hourLabels = useMemo(() => {
    const out: string[] = [];
    for (let h = axisStart; h <= axisEnd; h++) out.push(`${pad2(h)}:00`);
    return out;
  }, [axisStart, axisEnd]);
  const isRain = (rainDays || []).some(r => r.date === dayKey);
  const canMarkRain = canReschedule && !!onMarkRainDay;

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!canMarkRain) return;
    e.preventDefault();
    onMarkRainDay!(dayKey);
  };

  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: '160px 64px 1fr' }}>
        {/* Header */}
        <div className="p-3 text-xs font-black uppercase tracking-widest text-gray-400 border-b border-r border-gray-100 dark:border-gray-700">Crew</div>
        <div className="border-b border-gray-100 dark:border-gray-700" />
        <div
          onContextMenu={handleContextMenu}
          title={canMarkRain ? 'Right-click to mark as rain day' : undefined}
          className={`p-3 text-center border-b border-l border-gray-100 dark:border-gray-700 ${canMarkRain ? 'cursor-context-menu' : ''}`}
        >
          <div className="text-lg font-black text-gray-900 dark:text-white">
            {new Date(`${dayKey}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          {isRain && (
            <span className="mt-1 inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded-full">
              <CloudRain className="w-2.5 h-2.5" /> Rain
            </span>
          )}
        </div>

        {/* Rows */}
        {rows.map(row => (
          <React.Fragment key={row.laneId}>
            <div className="p-3 font-bold text-sm text-gray-700 dark:text-gray-200 border-b border-r border-gray-100 dark:border-gray-700 sticky left-0 bg-white dark:bg-gray-800 z-10 flex items-center">
              {renderRowLabel ? renderRowLabel(lanes.find(l => l.crewId === row.laneId)!) : row.laneName}
            </div>
            {/* Hour-label gutter */}
            <div className="relative border-b border-gray-100 dark:border-gray-800">
              {hourLabels.map((hhmm, i) => (
                <div
                  key={hhmm}
                  className="absolute right-1 text-[10px] font-bold text-gray-400 -translate-y-1/2"
                  style={{ top: `${(i / (hourLabels.length - 1)) * 100}%` }}
                >
                  {fmtClock(hhmm)}
                </div>
              ))}
            </div>
            {/* Timeline column */}
            <div
              onContextMenu={handleContextMenu}
              className="relative border-b border-l border-gray-100 dark:border-gray-800"
              style={{ minHeight: 180 }}
            >
              {/* Hour gridlines */}
              {hourLabels.map((hhmm, i) => (
                <div
                  key={hhmm}
                  className="absolute inset-x-0 border-t border-gray-100 dark:border-gray-800"
                  style={{ top: `${(i / (hourLabels.length - 1)) * 100}%` }}
                />
              ))}
              {isRain && (
                <div
                  className="pointer-events-none absolute inset-0 opacity-70"
                  style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(59,130,246,0.14) 6px, rgba(59,130,246,0.14) 12px)' }}
                />
              )}
              {/* Job blocks */}
              {row.blocks.map(block => (
                <div
                  key={block.card.jobId}
                  data-job-id={block.card.jobId}
                  onClick={() => onViewJob?.(block.card.jobId)}
                  className={`absolute left-1 right-1 rounded-lg px-2 py-1 text-white text-xs font-bold shadow cursor-pointer overflow-hidden ${block.clamped ? 'ring-2 ring-white/40' : ''}`}
                  style={{ top: `${block.topPct}%`, height: `${block.heightPct}%`, backgroundColor: block.card.color }}
                >
                  <div className="truncate">{block.card.jobName}</div>
                  <div className="text-[10px] opacity-90 truncate">{fmtClock(block.startTime)}–{fmtClock(block.endTime)}</div>
                </div>
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run components/views/JobScheduling/DayBoard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/DayBoard.tsx components/views/JobScheduling/DayBoard.test.tsx
git commit -m "feat: DayBoard hourly timeline render"
```

---

## Task 4: Drag-to-change-time + read-only/lock guards

**Files:**
- Modify: `components/views/JobScheduling/DayBoard.tsx`
- Test: `components/views/JobScheduling/DayBoard.test.tsx`

Drag uses pointer events with vertical movement mapped to a clock delta, snapped to 15 minutes, preserving block duration. Because jsdom has no layout, the test drives the exposed drag math directly via a small pure helper rather than simulating pixel geometry.

- [ ] **Step 1: Add failing tests**

Append to `services/dayBoard.test.ts` (math helper) — and note we also add a component guard test below:

```typescript
import { shiftDayWindow } from './dayBoard';

describe('shiftDayWindow', () => {
  it('shifts both ends by the snapped delta, preserving duration', () => {
    const r = shiftDayWindow({ startTime: '10:00', endTime: '14:00' }, 1, 8, 17); // +1h
    expect(r).toEqual({ startTime: '11:00', endTime: '15:00' });
  });

  it('snaps to 15-minute increments', () => {
    const r = shiftDayWindow({ startTime: '10:00', endTime: '12:00' }, 0.2, 8, 17); // 0.2h -> 15min
    expect(r).toEqual({ startTime: '10:15', endTime: '12:15' });
  });

  it('clamps so the block stays within the axis', () => {
    const r = shiftDayWindow({ startTime: '08:00', endTime: '12:00' }, -2, 8, 17); // can't go before 8
    expect(r).toEqual({ startTime: '08:00', endTime: '12:00' });
  });

  it('clamps at the bottom edge', () => {
    const r = shiftDayWindow({ startTime: '14:00', endTime: '17:00' }, 5, 8, 17);
    expect(r).toEqual({ startTime: '14:00', endTime: '17:00' });
  });
});
```

And append a component guard test to `components/views/JobScheduling/DayBoard.test.tsx`:

```tsx
import { setJobDayWindow } from '../../../services/dayBoard'; // referenced by view, sanity import

describe('DayBoard drag guards', () => {
  it('marks blocks non-draggable in read-only mode', () => {
    const { container } = render(<DayBoard {...base} canReschedule={false} lanes={lanesFor([job()])} />);
    const block = container.querySelector('[data-job-id="j1"]') as HTMLElement;
    expect(block.dataset.draggable).toBe('false');
  });

  it('marks a locked job non-draggable', () => {
    const locked = job({ is_locked: true });
    const { container } = render(<DayBoard {...base} lanes={lanesFor([locked])} />);
    const block = container.querySelector('[data-job-id="j1"]') as HTMLElement;
    expect(block.dataset.draggable).toBe('false');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run services/dayBoard.test.ts components/views/JobScheduling/DayBoard.test.tsx`
Expected: FAIL — "shiftDayWindow is not a function" and `dataset.draggable` undefined.

- [ ] **Step 3a: Implement `shiftDayWindow`**

Append to `services/dayBoard.ts`:

```typescript
const SNAP_HOURS = 0.25; // 15 minutes

const fromHours = (h: number): string => {
  const total = Math.round(h * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** Shift a day window by deltaHours, snapped to 15 min, clamped so the block
 *  stays within [axisStart, axisEnd] and keeps its duration. */
export const shiftDayWindow = (
  window: { startTime: string; endTime: string },
  deltaHours: number,
  axisStart: number,
  axisEnd: number,
): { startTime: string; endTime: string } => {
  const toH = (s: string) => { const [h, m] = s.split(':').map(Number); return h + (m || 0) / 60; };
  const start = toH(window.startTime);
  const end = toH(window.endTime);
  const dur = end - start;
  const snapped = Math.round(deltaHours / SNAP_HOURS) * SNAP_HOURS;
  let newStart = start + snapped;
  newStart = Math.max(axisStart, Math.min(newStart, axisEnd - dur));
  return { startTime: fromHours(newStart), endTime: fromHours(newStart + dur) };
};
```

- [ ] **Step 3b: Wire drag into the component**

In `components/views/JobScheduling/DayBoard.tsx`:

Add `shiftDayWindow` to the import from `dayBoard`:
```tsx
import { buildDayBlocks, shiftDayWindow } from '../../../services/dayBoard';
```

Add `onChangeDayWindow` to the destructured props (it is already in `DayBoardProps`):
```tsx
export const DayBoard = ({
  lanes, dayKey, config, canReschedule, rainDays, renderRowLabel, onViewJob, onChangeDayWindow, onMarkRainDay,
}: DayBoardProps) => {
```

Add a ref + pointer-drag effect inside the component, before `return`:
```tsx
  const dragRef = React.useRef<{ jobId: string; startY: number; colHeight: number; window: { startTime: string; endTime: string }; moved: boolean } | null>(null);

  React.useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      d.moved = true;
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d || !d.moved) return;
      const deltaPx = e.clientY - d.startY;
      const deltaHours = (deltaPx / d.colHeight) * (axisEnd - axisStart);
      const next = shiftDayWindow(d.window, deltaHours, axisStart, axisEnd);
      onChangeDayWindow?.(d.jobId, dayKey, next);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [axisStart, axisEnd, dayKey, onChangeDayWindow]);
```

Replace the job-block `<div>` with a draggable-aware version that records `data-draggable` and starts the drag. Inside `row.blocks.map(block => ...)`, compute per-block draggability and wire handlers:
```tsx
              {row.blocks.map(block => {
                const draggable = canReschedule && !block.card.isLocked && !!onChangeDayWindow;
                return (
                  <div
                    key={block.card.jobId}
                    data-job-id={block.card.jobId}
                    data-draggable={draggable ? 'true' : 'false'}
                    onPointerDown={draggable ? (e) => {
                      if (e.button !== 0) return;
                      const col = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                      dragRef.current = { jobId: block.card.jobId, startY: e.clientY, colHeight: col.height || 1, window: { startTime: block.startTime, endTime: block.endTime }, moved: false };
                    } : undefined}
                    onClick={() => { if (!dragRef.current) onViewJob?.(block.card.jobId); }}
                    className={`absolute left-1 right-1 rounded-lg px-2 py-1 text-white text-xs font-bold shadow overflow-hidden ${draggable ? 'cursor-grab' : 'cursor-pointer'} ${block.clamped ? 'ring-2 ring-white/40' : ''}`}
                    style={{ top: `${block.topPct}%`, height: `${block.heightPct}%`, backgroundColor: block.card.color }}
                  >
                    <div className="truncate">{block.card.jobName}</div>
                    <div className="text-[10px] opacity-90 truncate">{fmtClock(block.startTime)}–{fmtClock(block.endTime)}</div>
                  </div>
                );
              })}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run services/dayBoard.test.ts components/views/JobScheduling/DayBoard.test.tsx`
Expected: PASS (all tests, including the new drag-math and guard tests).

- [ ] **Step 5: Commit**

```bash
git add services/dayBoard.ts services/dayBoard.test.ts components/views/JobScheduling/DayBoard.tsx components/views/JobScheduling/DayBoard.test.tsx
git commit -m "feat: DayBoard drag-to-change-time with lock/read-only guards"
```

---

## Task 5: Wire Day scale into `JobSchedulingView`

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

No new unit test file — this is integration wiring; verified by typecheck, the full test suite, and the manual check at the end. Follow the existing Month patterns exactly.

- [ ] **Step 1: Import DayBoard, buildDayBlocks target, and setJobDayWindow**

Near the other `JobScheduling/*` imports (around line 30-36), add:
```tsx
import { DayBoard } from './JobScheduling/DayBoard';
import { setJobDayWindow } from '../../services/dayBoard';
```

- [ ] **Step 2: Widen the scale state**

Line 194 currently:
```tsx
  const [scale, setScale] = useState<'week' | 'month'>('week');
```
Change to:
```tsx
  const [scale, setScale] = useState<'week' | 'month' | 'day'>('week');
```

- [ ] **Step 3: Add day navigation handlers**

After `handleNextMonth` (around line 318), add:
```tsx
  const handlePrevDay = () => {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
  };

  const handleNextDay = () => {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
  };
```

- [ ] **Step 4: Keep the Hours sub-mode week-only when switching to Day**

The existing effect (around line 321-323):
```tsx
  useEffect(() => {
    if (view === 'member' && boardMode === 'hours' && scale === 'month') setScale('week');
  }, [view, boardMode, scale]);
```
Change the condition to also snap back from `day`:
```tsx
  useEffect(() => {
    if (view === 'member' && boardMode === 'hours' && scale !== 'week') setScale('week');
  }, [view, boardMode, scale]);
```

- [ ] **Step 5: Add the selected day key**

After `weekDays` / `monthWeeks` derivations (around line 286), add:
```tsx
  const selectedDayKey = useMemo(() => toLocalDateKey(currentDate), [currentDate]);
```

- [ ] **Step 6: Compute day lanes**

The existing `boardLanes` (lines 478-481) builds member/job lanes for `weekDays`. The Day view needs lanes for a single day. Add a dedicated memo after `boardLanes`:
```tsx
  // Lanes for the single selected day (Day scale). Reuses the week builders with a
  // one-element day list so a job appears only if it occupies the selected date.
  const dayLanes = useMemo<BoardLane[]>(() => {
    const days = [currentDate];
    return view === 'member'
      ? buildMemberLanes(displayJobs, allStaff, days, workConfig)
      : buildJobLanes(displayJobs, days, workConfig);
  }, [view, displayJobs, allStaff, currentDate, workConfig]);
```

- [ ] **Step 7: Commit a day-window change immediately**

After `handleHoursRemoveDay` (around line 645), add:
```tsx
  // Day view: drag committed a new start/end clock for a job on one day.
  const handleChangeDayWindow = (jobId: string, dayKey: string, window: { startTime: string; endTime: string }) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    onUpdateJob(setJobDayWindow(job, dayKey, window));
  };
```

- [ ] **Step 8: Update the date-navigator nav buttons + label for `day`**

The prev/next buttons (lines 882, 893) and the label (lines 886-891) currently branch on `scale === 'month'`. Update them to handle three scales.

Prev button (line 882) — change `onClick`:
```tsx
            <button onClick={scale === 'month' ? handlePrevMonth : scale === 'day' ? handlePrevDay : handlePrevWeek} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-500 dark:text-gray-400">
```
Next button (line 893):
```tsx
            <button onClick={scale === 'month' ? handleNextMonth : scale === 'day' ? handleNextDay : handleNextWeek} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-500 dark:text-gray-400">
```
Label kicker (line 886):
```tsx
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1">{scale === 'month' ? 'Month' : scale === 'day' ? 'Day' : 'Week Of'}</span>
```
Label heading (lines 888-890):
```tsx
                    {scale === 'month'
                        ? currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
                        : scale === 'day'
                        ? currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                        : weekStart.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
```

- [ ] **Step 9: Add the Day toggle button**

After the Month button (line 898), add a Day button that, like Month, is disabled while the hours grid is active:
```tsx
                <button onClick={() => setScale('day')} disabled={hoursGridActive} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${scale === 'day' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'} ${hoursGridActive ? 'opacity-40 cursor-not-allowed' : ''}`}>Day</button>
```

- [ ] **Step 10: Add the render branch**

The render currently chains `hoursGridActive ? CrewHoursGrid : scale === 'month' ? MonthBoard : ProductionBoard` (lines 945-1016). Insert a Day branch before the `scale === 'month'` check. Change line 955 from:
```tsx
        ) : scale === 'month' ? (
```
to:
```tsx
        ) : scale === 'day' ? (
          <DayBoard
            lanes={dayLanes}
            dayKey={selectedDayKey}
            config={workConfig}
            canReschedule={canReschedule}
            rainDays={settings.scheduling?.rainDays}
            onViewJob={(id) => { const j = jobs.find(x => x.id === id); if (j) setSelectedJob(j); }}
            onChangeDayWindow={handleChangeDayWindow}
            onMarkRainDay={handleMarkRainDay}
            renderRowLabel={
              view === 'member'
              ? (lane) => {
                  const emp = allStaff.find(s => s.id === lane.crewId);
                  return (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border border-white dark:border-gray-600 shrink-0">
                        {emp?.photo ? <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" /> : <User className="w-full h-full p-1.5 text-gray-400" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{lane.crewName}</div>
                        {lane.inactive
                          ? <div className="text-[11px] text-amber-500 truncate">Inactive</div>
                          : emp?.role && <div className="text-[11px] text-gray-400 truncate">{emp.role}</div>}
                      </div>
                    </div>
                  );
                }
              : undefined}
          />
        ) : scale === 'month' ? (
```

- [ ] **Step 11: Typecheck and run the full suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run`
Expected: all tests pass (existing + new dayBoard/DayBoard tests).

- [ ] **Step 12: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: wire Day scale into Job Scheduling view"
```

---

## Task 6: Manual verification

- [ ] **Step 1: Run the app and verify Day view**

Run the dev server (`npm run dev`) and in Job Scheduling:
1. Click **Day** in the date navigator — the timeline renders for today with hour gridlines (8 AM–5 PM by default).
2. Prev/next arrows step one day at a time; the heading shows the full date.
3. Toggle **Job** / **Crew** — rows switch between jobs and members.
4. A job with morning/afternoon hours renders as a block positioned at the right vertical offset; a job whose times exceed the workday shows the clamp ring.
5. Click a block → JobDetailsPanel opens.
6. Drag a block up/down → its time updates and persists (re-open Day view, block stays moved). Locked jobs don't drag.
7. Right-click the day column → marks a rain day (hatch appears).
8. In Crew view, switch to the **Hours** sub-mode, then confirm the **Day** button is disabled; switching modes from Day snaps back to Week.

- [ ] **Step 2: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: day view manual-verification adjustments"
```

---

## Self-Review Notes

- **Spec coverage:** hourly timeline (Task 1/3), working-hours axis + clamping (Task 1), both Job & Crew views (Task 5 `dayLanes` + `renderRowLabel`), click-to-open (Task 3), drag-to-change-time immediate commit (Task 4 + Task 5 `handleChangeDayWindow`), rain-day marking (Task 3/5), Hours-stays-week-only + Day disabled when hours active (Task 5), per-day `dailyHours` override (Task 1), locked/read-only guards (Task 4), testing (Tasks 1–4). All spec sections map to tasks.
- **Type consistency:** `DayBlock`/`DayRow` defined in Task 1; `setJobDayWindow` (Task 2), `shiftDayWindow` (Task 4), `buildDayBlocks` (Task 1) names used consistently in component and view. `onChangeDayWindow` prop name consistent across DayBoard and the view's `handleChangeDayWindow`.
- **No placeholders:** every code step contains full code and exact commands.
