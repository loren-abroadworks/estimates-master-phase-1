# Month View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Month time-scale to the Job Scheduling page — a calendar grid (week rows × working-day columns) showing jobs as spanning bars, with click-to-open-details and drag-to-reschedule.

**Architecture:** Pure helpers (`buildMonthWeeks`, `buildMonthWeekLane`, `crewColorForJob`) build the grid + per-week bar lanes, reusing the existing `layoutLaneBars`, `visibleWeekDays`, and `occupiesWorkingDay`. A new `MonthBoard` component renders the grid (native HTML5 drag/drop). `JobSchedulingView` gains a `scale: 'week' | 'month'` toggle, month navigation, a member filter, and renders `MonthBoard` in month mode. Drag reuses the existing `handleDropJob` → `moveJobToSlot` → `preview.stage` pipeline.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react (jsdom), Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-03-month-view-design.md`

**Conventions:** `npm run lint` = `tsc --noEmit`; `npx vitest run` = full suite. Run both before each commit. Branch `feat/reschedule-drawer-redesign` (current). Commit footer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

**New files:**
- `services/monthBoard.ts` — `MonthDay`/`MonthWeek` types, `buildMonthWeeks`, `buildMonthWeekLane`.
- `services/monthBoard.test.ts` — their tests.
- `components/views/JobScheduling/MonthBoard.tsx` — the calendar grid component.
- `components/views/JobScheduling/MonthBoard.test.tsx` — its tests.

**Modified files:**
- `services/productionBoard.ts` — export `crewColorForJob` (uses existing private `laneIdForJob`).
- `services/productionBoard.test.ts` — test `crewColorForJob`.
- `components/views/JobSchedulingView.tsx` — `scale` toggle, month nav, member filter, render `MonthBoard`.

---

## Task 1: `buildMonthWeeks` helper

**Files:**
- Create: `services/monthBoard.ts`
- Create: `services/monthBoard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `services/monthBoard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildMonthWeeks } from './monthBoard';
import { configFromSettings } from './scheduleEngine';

const cfg = configFromSettings(undefined, false); // weekends [0,6] non-working

describe('buildMonthWeeks', () => {
  // June 2026: Jun 1 = Mon, Jun 30 = Tue. Grid starts Sun May 31.
  const ref = new Date(2026, 5, 15); // month index 5 = June

  it('returns one row per week covering the month, weekdays only', () => {
    const weeks = buildMonthWeeks(ref, cfg);
    expect(weeks).toHaveLength(5);
    // Sunday is filtered out, so each row starts Monday with 5 working days.
    expect(weeks[0].days).toHaveLength(5);
    expect(weeks[0].days[0].key).toBe('2026-06-01');
    expect(weeks[0].days[4].key).toBe('2026-06-05');
  });

  it('marks adjacent-month days with inMonth=false', () => {
    const weeks = buildMonthWeeks(ref, cfg);
    const lastWeek = weeks[weeks.length - 1];
    const july1 = lastWeek.days.find(d => d.key === '2026-07-01');
    expect(july1?.inMonth).toBe(false);
    expect(weeks[0].days.find(d => d.key === '2026-06-01')?.inMonth).toBe(true);
  });

  it('keeps weekend columns when weekends are working', () => {
    const weeks = buildMonthWeeks(ref, { ...cfg, weekendDays: [] });
    expect(weeks[0].days).toHaveLength(7);
    expect(weeks[0].days[0].key).toBe('2026-05-31'); // Sunday shown
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/monthBoard.test.ts`
Expected: FAIL — cannot find module `./monthBoard`.

- [ ] **Step 3: Implement `buildMonthWeeks`**

Create `services/monthBoard.ts`:

```ts
import type { Job, CrewGroup } from '../types';
import { WorkingTimeConfig, toLocalDateKey, occupiesWorkingDay } from './scheduleEngine';
import { visibleWeekDays, jobColor, BoardLane, BoardCard } from './productionBoard';

export interface MonthDay { date: Date; key: string; inMonth: boolean; }
export interface MonthWeek { days: MonthDay[]; }

/** Week rows covering the month containing `refDate`. Grid starts on the Sunday
 *  on/before the 1st and ends on the week containing the last day, so the first
 *  and last rows can include adjacent-month days (inMonth=false). Each week's
 *  days are filtered to working weekdays (weekends dropped per config). */
export const buildMonthWeeks = (refDate: Date, config: WorkingTimeConfig): MonthWeek[] => {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0); // last day of month
  const gridStart = new Date(year, month, 1 - first.getDay()); // back to Sunday

  const weeks: MonthWeek[] = [];
  const cursor = new Date(gridStart);
  // Guard at 6 rows (max any month spans) to avoid any chance of a runaway loop.
  for (let w = 0; w < 6; w++) {
    const seven: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() + i);
      seven.push(d);
    }
    const working = visibleWeekDays(seven, config);
    weeks.push({
      days: working.map(d => ({ date: d, key: toLocalDateKey(d), inMonth: d.getMonth() === month })),
    });
    const weekEnd = new Date(cursor);
    weekEnd.setDate(cursor.getDate() + 6);
    if (weekEnd.getTime() >= last.getTime()) break;
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/monthBoard.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add services/monthBoard.ts services/monthBoard.test.ts
git commit -m "feat: buildMonthWeeks helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `buildMonthWeekLane` helper

**Files:**
- Modify: `services/monthBoard.ts`
- Modify: `services/monthBoard.test.ts`

- [ ] **Step 1: Write the failing test (append to the existing file)**

Add to `services/monthBoard.test.ts`:

```ts
import { buildMonthWeekLane } from './monthBoard';
import { layoutLaneBars } from './productionBoard';
import type { Job } from '../types';

const job = (over: Partial<Job>): Job => ({
  id: 'j1', jobNumber: 'J-1', name: 'Job 1', stage: 'Scheduled',
  startDate: '2026-06-02T08:00:00', endDate: '2026-06-02T17:00:00', ...over,
} as Job);

describe('buildMonthWeekLane', () => {
  const weekKeys = ['2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05'];

  it('places a multi-day job on each working day it spans', () => {
    const j = job({ startDate: '2026-06-02T08:00:00', endDate: '2026-06-04T17:00:00' });
    const lane = buildMonthWeekLane([j], weekKeys, cfg, () => '#abc');
    expect(lane.cardsByDay['2026-06-02']?.[0].jobId).toBe('j1');
    expect(lane.cardsByDay['2026-06-04']?.[0].jobId).toBe('j1');
    expect(lane.cardsByDay['2026-06-01']).toBeUndefined();
    // layoutLaneBars turns it into a single 3-column bar.
    const { bars } = layoutLaneBars(lane, weekKeys);
    expect(bars).toHaveLength(1);
    expect(bars[0].startCol).toBe(1);
    expect(bars[0].span).toBe(3);
  });

  it('applies the color callback and skips non-schedulable jobs', () => {
    const lane = buildMonthWeekLane(
      [job({ id: 'done', stage: 'Completed' }), job({ id: 'live' })],
      weekKeys, cfg, () => '#123456',
    );
    expect(lane.cardsByDay['2026-06-02']?.map(c => c.jobId)).toEqual(['live']);
    expect(lane.cardsByDay['2026-06-02']?.[0].color).toBe('#123456');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/monthBoard.test.ts`
Expected: FAIL — `buildMonthWeekLane` is not exported.

- [ ] **Step 3: Implement `buildMonthWeekLane`**

Append to `services/monthBoard.ts`:

```ts
const schedulable = (job: Job): boolean =>
  !!job.startDate && job.stage !== 'Completed' && job.stage !== 'Marketing' && job.stage !== 'Cancelled';

/** A single board lane holding every schedulable job that occupies any of the
 *  given week's working days. `color` sets each card's bar color (crew color). */
export const buildMonthWeekLane = (
  jobs: Job[],
  weekDayKeys: string[],
  config: WorkingTimeConfig,
  color: (job: Job) => string,
): BoardLane => {
  const lane: BoardLane = { crewId: 'month', crewName: '', cardsByDay: {} };
  for (const job of jobs) {
    if (!schedulable(job)) continue;
    const card: BoardCard = {
      jobId: job.id, jobName: job.name, jobNumber: job.jobNumber,
      color: color(job),
      startKey: toLocalDateKey(new Date(job.startDate!)),
      endKey: toLocalDateKey(new Date(job.endDate || job.startDate!)),
      isLocked: !!job.is_locked,
    };
    for (const key of weekDayKeys) {
      if (occupiesWorkingDay(job.startDate!, job.endDate, key, config)) {
        (lane.cardsByDay[key] ||= []).push(card);
      }
    }
  }
  return lane;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/monthBoard.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add services/monthBoard.ts services/monthBoard.test.ts
git commit -m "feat: buildMonthWeekLane helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `crewColorForJob` helper

**Files:**
- Modify: `services/productionBoard.ts`
- Modify: `services/productionBoard.test.ts`

- [ ] **Step 1: Write the failing test (append to existing describe blocks)**

Add to `services/productionBoard.test.ts`:

```ts
import { crewColorForJob } from './productionBoard';

describe('crewColorForJob', () => {
  const crewWithColor: CrewGroup = { id: 'c1', name: 'Crew A', color: '#ff8800', memberIds: ['m1'] } as CrewGroup;

  it('uses the crew color when the job maps to a crew', () => {
    expect(crewColorForJob(job({ crewGroupId: 'c1' }), [crewWithColor])).toBe('#ff8800');
  });

  it('falls back to the per-job color when no crew matches', () => {
    const j = job({ crewGroupId: undefined, crewMemberIds: [] });
    expect(crewColorForJob(j, [crewWithColor])).toBe(jobColor(j.id));
  });
});
```

(Note: `job`, `crewA`, `jobColor` are already imported/defined at the top of this test file; only add the `crewColorForJob` import and the new describe block.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/productionBoard.test.ts`
Expected: FAIL — `crewColorForJob` is not exported.

- [ ] **Step 3: Implement `crewColorForJob`**

In `services/productionBoard.ts`, add after `laneIdForJob` (it uses that private helper):

```ts
/** Display color for a job's month-view bar: its crew's color when the job maps
 *  to a known crew, else the deterministic per-job color. */
export const crewColorForJob = (job: Job, crews: CrewGroup[]): string => {
  const laneId = laneIdForJob(job, crews);
  const crew = crews.find(c => c.id === laneId);
  return crew?.color || jobColor(job.id);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/productionBoard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/productionBoard.ts services/productionBoard.test.ts
git commit -m "feat: crewColorForJob helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `MonthBoard` component

**Files:**
- Create: `components/views/JobScheduling/MonthBoard.tsx`
- Create: `components/views/JobScheduling/MonthBoard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/views/JobScheduling/MonthBoard.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonthBoard } from './MonthBoard';
import { buildMonthWeeks } from '../../../services/monthBoard';
import { configFromSettings } from '../../../services/scheduleEngine';
import type { Job } from '../../../types';

const cfg = configFromSettings(undefined, false);
const weeks = buildMonthWeeks(new Date(2026, 5, 15), cfg);

const job = (over: Partial<Job>): Job => ({
  id: 'j1', jobNumber: 'J-1', name: 'Exterior Repaint', stage: 'Scheduled',
  startDate: '2026-06-02T08:00:00', endDate: '2026-06-04T17:00:00', ...over,
} as Job);

const base = {
  weeks, jobs: [job({})], config: cfg, colorForJob: () => '#3b82f6',
  canReschedule: true, onSelectJob: vi.fn(), onDropJob: vi.fn(),
};

describe('MonthBoard', () => {
  it('renders weekday headers and day-number cells', () => {
    render(<MonthBoard {...base} />);
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0); // Jun 1 cell
  });

  it('renders a spanning bar for a multi-day job', () => {
    render(<MonthBoard {...base} />);
    expect(screen.getByText('Exterior Repaint')).toBeInTheDocument();
  });

  it('calls onSelectJob when a job bar is clicked', () => {
    render(<MonthBoard {...base} />);
    fireEvent.click(screen.getByText('Exterior Repaint'));
    expect(base.onSelectJob).toHaveBeenCalledWith('j1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/MonthBoard.test.tsx`
Expected: FAIL — cannot find module `./MonthBoard`.

- [ ] **Step 3: Implement `MonthBoard`**

Create `components/views/JobScheduling/MonthBoard.tsx`:

```tsx
import React, { useRef } from 'react';
import type { Job, CrewGroup } from '../../../types';
import { WorkingTimeConfig } from '../../../services/scheduleEngine';
import { layoutLaneBars } from '../../../services/productionBoard';
import { MonthWeek, buildMonthWeekLane } from '../../../services/monthBoard';

const DATE_BAND = 26; // px reserved at the top of each cell for the date number
const BAR_ROW = 26;   // px per stacked bar track

interface MonthBoardProps {
  weeks: MonthWeek[];
  jobs: Job[];
  config: WorkingTimeConfig;
  colorForJob: (job: Job) => string;
  canReschedule?: boolean;
  onSelectJob: (jobId: string) => void;
  onDropJob?: (jobId: string, dayKey: string) => void;
}

export const MonthBoard = ({ weeks, jobs, config, colorForJob, canReschedule, onSelectJob, onDropJob }: MonthBoardProps) => {
  const dragged = useRef<string | null>(null);
  const cols = weeks[0]?.days.length ?? 5;
  const weekdayNames = (weeks[0]?.days ?? []).map(d =>
    d.date.toLocaleDateString(undefined, { weekday: 'short' }));

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 overflow-hidden">
      {/* Weekday header */}
      <div className="grid border-b border-gray-100 dark:border-gray-700" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {weekdayNames.map((name, i) => (
          <div key={i} className="p-2 text-center text-[10px] font-black uppercase tracking-widest text-gray-400 border-l first:border-l-0 border-gray-100 dark:border-gray-700">{name}</div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => {
        const dayKeys = week.days.map(d => d.key);
        const lane = buildMonthWeekLane(jobs, dayKeys, config, colorForJob);
        const { bars, trackCount } = layoutLaneBars(lane, dayKeys);
        const rowHeight = DATE_BAND + Math.max(1, trackCount) * BAR_ROW + 6;
        return (
          <div key={wi} className="relative border-b last:border-b-0 border-gray-100 dark:border-gray-700" style={{ minHeight: rowHeight }}>
            {/* Day cells */}
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {week.days.map(d => (
                <div
                  key={d.key}
                  onDragOver={onDropJob ? (e => e.preventDefault()) : undefined}
                  onDrop={onDropJob ? (() => { if (dragged.current) onDropJob(dragged.current, d.key); dragged.current = null; }) : undefined}
                  className={`border-l first:border-l-0 border-gray-100 dark:border-gray-800 ${d.inMonth ? '' : 'bg-gray-50/60 dark:bg-gray-900/30'}`}
                >
                  <div className={`p-1.5 text-right text-xs font-bold ${d.inMonth ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'}`}>
                    {d.date.getDate()}
                  </div>
                </div>
              ))}
            </div>

            {/* Spanning bars */}
            <div className="absolute inset-x-0" style={{ top: DATE_BAND }}>
              {bars.map(bar => (
                <button
                  key={bar.card.jobId}
                  draggable={!!canReschedule}
                  onDragStart={() => { dragged.current = bar.card.jobId; }}
                  onClick={() => onSelectJob(bar.card.jobId)}
                  className="absolute text-left rounded-md px-2 text-[11px] font-bold text-white truncate shadow-sm hover:brightness-110"
                  style={{
                    left: `calc(${(bar.startCol / cols) * 100}% + 2px)`,
                    width: `calc(${(bar.span / cols) * 100}% - 4px)`,
                    top: bar.track * BAR_ROW,
                    height: BAR_ROW - 4,
                    lineHeight: `${BAR_ROW - 4}px`,
                    backgroundColor: bar.card.color,
                  }}
                  title={bar.card.jobName}
                >
                  {bar.card.jobName}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/MonthBoard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Run lint + full suite**

Run: `npm run lint && npx vitest run`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add components/views/JobScheduling/MonthBoard.tsx components/views/JobScheduling/MonthBoard.test.tsx
git commit -m "feat: MonthBoard calendar grid component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire Month view into JobSchedulingView

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

No new automated test (the view is integration-heavy; helpers + component are covered). Success = lint clean + full suite green + the manual checks below.

- [ ] **Step 1: Add imports**

Add near the other service/component imports:

```ts
import { MonthBoard } from './JobScheduling/MonthBoard';
import { buildMonthWeeks } from '../../services/monthBoard';
import { crewColorForJob } from '../../services/productionBoard';
```

(`crewColorForJob` joins the existing `import { buildLanes, buildMemberLanes, buildJobLanes, visibleWeekDays, BoardLane } from '../../services/productionBoard';` — add it to that list instead of a second import if preferred.)

- [ ] **Step 2: Add state**

Near `const [view, setView] = useState<'crew' | 'member' | 'job'>('crew');`:

```ts
  const [scale, setScale] = useState<'week' | 'month'>('week');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
```

- [ ] **Step 3: Add month navigation handlers**

After `handleNextWeek`:

```ts
  const handlePrevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNextMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };
```

- [ ] **Step 4: Add month-data memos**

After the `weekDays` memo:

```ts
  const monthWeeks = useMemo(() => buildMonthWeeks(currentDate, workConfig), [currentDate, workConfig]);
  const monthJobs = useMemo(() => {
    if (view === 'member' && selectedMemberId) {
      return displayJobs.filter(j => assignedMembers(j).some(m => m.id === selectedMemberId));
    }
    return displayJobs;
  }, [view, selectedMemberId, displayJobs, assignedMembers]);
```

(Place this AFTER `displayJobs` and `assignedMembers` are defined. `assignedMembers` is the existing `useCallback`; `displayJobs` is the existing derived job list passed to the lane builders.)

- [ ] **Step 5: Add the Week | Month toggle to the date navigator**

In the Date Navigator block, replace the existing left/center/right week controls so the prev/next buttons and label are scale-aware, and add the toggle. Replace the `<button onClick={handlePrevWeek}>…</button>` … center label … `<button onClick={handleNextWeek}>…</button>` trio with:

```tsx
            <button onClick={scale === 'month' ? handlePrevMonth : handlePrevWeek} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-500 dark:text-gray-400">
                <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="text-center flex-1">
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1">{scale === 'month' ? 'Month' : 'Week Of'}</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {scale === 'month'
                        ? currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
                        : weekStart.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
            </div>
            <button onClick={scale === 'month' ? handleNextMonth : handleNextWeek} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-500 dark:text-gray-400">
                <ChevronRight className="w-6 h-6" />
            </button>
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                <button onClick={() => setScale('week')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${scale === 'week' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'}`}>Week</button>
                <button onClick={() => setScale('month')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${scale === 'month' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'}`}>Month</button>
            </div>
```

- [ ] **Step 6: Add the member filter dropdown (month + member only)**

Immediately AFTER the Date Navigator `</div>` (the closing div of the navigator block), add:

```tsx
        {scale === 'month' && view === 'member' && (
            <div className="mb-6 flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Member</span>
                <select
                    value={selectedMemberId ?? ''}
                    onChange={e => setSelectedMemberId(e.target.value || null)}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium"
                >
                    <option value="">All members</option>
                    {allStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
        )}
```

- [ ] **Step 7: Render MonthBoard in month mode**

Wrap the existing `<ProductionBoard … />` so the month board renders instead when `scale === 'month'`. Replace the `<ProductionBoard` opening with a conditional:

```tsx
        {scale === 'month' ? (
          <MonthBoard
            weeks={monthWeeks}
            jobs={monthJobs}
            config={workConfig}
            colorForJob={(j) => crewColorForJob(j, crews)}
            canReschedule={canReschedule}
            onSelectJob={(id) => { const j = jobs.find(x => x.id === id); if (j) setSelectedJob(j); }}
            onDropJob={handleDropJob}
          />
        ) : (
          <ProductionBoard
            lanes={boardLanes}
            weekDays={weekDays}
            config={workConfig}
            canReschedule={canReschedule}
            pendingIds={pendingIds}
            rainDays={settings.scheduling?.rainDays}
            onDropJob={handleDropJob}
            onMarkRainDay={handleMarkRainDay}
            onViewJob={(id) => { const j = jobs.find(x => x.id === id); if (j) setSelectedJob(j); }}
            onMoveJob={(id) => { const j = jobs.find(x => x.id === id); if (j) setMoveJob(j); }}
            renderRowLabel={/* keep the existing renderRowLabel expression unchanged */ undefined as any}
            /* keep all other existing ProductionBoard props unchanged */
          />
        )}
```

IMPORTANT: Do not actually replace `renderRowLabel` with `undefined` — keep the existing `<ProductionBoard .../>` element exactly as it is today (all its current props, including the full `renderRowLabel` and `renderCellExtra` expressions). Only wrap it in the `{scale === 'month' ? <MonthBoard…/> : ( <ProductionBoard…/> )}` conditional. The snippet above abbreviates the unchanged props — preserve them verbatim from the current file.

- [ ] **Step 8: Run lint + full suite**

Run: `npm run lint && npx vitest run`
Expected: PASS, no regressions (113 tests: 110 prior + 3 from Task 4; Tasks 1-3 added more — confirm the count only goes up and nothing fails).

- [ ] **Step 9: Manual verification**

Run `npm run dev`, open Job Scheduling:
- Toggle **Month** → calendar grid of the current month, Mon–Fri columns, faded adjacent-month days.
- A multi-day job shows as one spanning bar; a job crossing a week boundary appears as a segment in each week row.
- Click a bar → Job Details panel opens.
- Drag a bar onto another day → reschedule drawer opens (edit mode) with the new date staged.
- Switch lane toggle to **Crew Member** in month mode → member dropdown appears; pick a member → calendar filters to their jobs.
- Prev/next navigates by month; switching back to **Week** restores the board.

- [ ] **Step 10: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: Month view toggle, navigation, and MonthBoard wiring

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Finish

- [ ] **Step 1:** Run `npm run lint && npx vitest run` — confirm green.
- [ ] **Step 2:** REQUIRED SUB-SKILL: Use superpowers:finishing-a-development-branch.

---

## Self-Review

**Spec coverage:**
- Separate Week|Month toggle + month nav → Task 5 (Steps 2,3,5) ✓
- Working-day columns / weekend hiding (reuse `visibleWeekDays`) → Task 1 ✓
- Spanning bars via `layoutLaneBars`, per-week segments → Tasks 2, 4 ✓
- Adjacent-month faded days (`inMonth`) → Tasks 1, 4 ✓
- Lane toggle as filter; member dropdown → Task 5 (Steps 4,6) ✓
- Crew-color bars → Task 3 + Task 5 (`colorForJob`) ✓
- Click → Job Details panel → Task 4 + Task 5 (`onSelectJob` → `setSelectedJob`) ✓
- Drag → reschedule via existing pipeline (`handleDropJob`) → Task 4 (native DnD) + Task 5 (`onDropJob={handleDropJob}`) ✓
- Testing: `buildMonthWeeks`, `buildMonthWeekLane`, `crewColorForJob`, `MonthBoard` → Tasks 1-4 ✓

**Placeholder scan:** No TBD/TODO. Task 5 Step 7 intentionally references "keep existing props verbatim" with an explicit instruction not to change them — this is a preservation directive, not a placeholder.

**Type consistency:** `MonthWeek`/`MonthDay` defined in Task 1, consumed in Tasks 4-5. `buildMonthWeekLane(jobs, weekDayKeys, config, color)` signature consistent across Task 2 (def) and Task 4 (call). `crewColorForJob(job, crews)` consistent Task 3 (def) and Task 5 (call). `BoardLane`/`BoardCard`/`layoutLaneBars` imported from `productionBoard` match existing exports. `MonthBoard` props match between Task 4 def and Task 5 usage (`weeks, jobs, config, colorForJob, canReschedule, onSelectJob, onDropJob`).
