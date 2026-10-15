# Three Job-Scheduling Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Job Scheduling page's two tabs with a Crew · Crew Member · Job view switcher — the same week-grid board grouped three ways — folding availability editing into the Crew Member view.

**Architecture:** Two new pure lane builders (`buildMemberLanes`, `buildJobLanes`) in `services/productionBoard.ts` return the existing `BoardLane` shape. `ProductionBoard` is generalized to render a passed `lanes` array plus optional `renderRowLabel` / `renderCellExtra` / `onCellActivate` hooks. `JobSchedulingView` swaps its two-tab state for a three-view switcher, builds the right lanes per view, and supplies the member view's availability overlay + edit handler.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react, Tailwind, lucide-react.

---

## File Structure

- **Modify** `services/productionBoard.ts` — add `buildMemberLanes`, `buildJobLanes` (reuse `BoardLane`, `BoardCard`, `jobColor`, `occupiesWorkingDay`).
- **Modify** `services/productionBoard.test.ts` — tests for both builders.
- **Modify** `components/views/JobScheduling/JobCard.tsx` — `stopPropagation` on card click.
- **Modify** `components/views/JobScheduling/ProductionBoard.tsx` — accept `lanes` + render hooks; drop internal `buildLanes`/`jobs`/`crews`.
- **Create** `components/views/JobScheduling/ProductionBoard.test.tsx` — render-hook tests.
- **Modify** `components/views/JobSchedulingView.tsx` — 3-view switcher, per-view lane building, member availability overlay, remove old availability table.

Conventions to mirror (read first):
- `services/productionBoard.test.ts` — existing builder-test style (fixed ISO dates, `describe`/`it`).
- The existing `buildLanes` in `services/productionBoard.ts:45` — job filter, `occupiesWorkingDay`, lane seeding, ordering.
- `components/views/JobScheduling/JobDetailsPanel.test.tsx` — render-test style.

---

## Task 1: `buildMemberLanes`

**Files:**
- Modify: `services/productionBoard.ts`
- Test: `services/productionBoard.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `services/productionBoard.test.ts` (reuse the file's existing `job`/`crew`/`cfg`/`weekDays` helpers if present; otherwise mirror the existing fixtures in that file). Use whatever `weekDays`/`config` builders the existing tests use; the assertions below only depend on lane identity/grouping:

```ts
import { buildMemberLanes } from './productionBoard';

describe('buildMemberLanes', () => {
  const week = [new Date('2026-06-01T00:00:00'), new Date('2026-06-02T00:00:00'), new Date('2026-06-03T00:00:00')];
  const config = { workDayStartHour: 8, workDayEndHour: 17, skipNonWorkingDays: false, workingDays: [0,1,2,3,4,5,6] } as any;
  const staff = [
    { id: 'm1', name: 'Alice', role: 'Lead' },
    { id: 'm2', name: 'Bob', role: 'Painter' },
  ] as any[];
  const baseJob = (over: any) => ({
    id: 'j', jobNumber: 'J1', name: 'Job', stage: 'Scheduled',
    startDate: '2026-06-02T08:00:00', endDate: '2026-06-02T17:00:00', ...over,
  });

  it('seeds a lane per staff member in input order, Unassigned last', () => {
    const lanes = buildMemberLanes([], staff, week, config);
    expect(lanes.map(l => l.crewId)).toEqual(['m1', 'm2']);
  });

  it('places a job in every assigned member lane (multi-member duplication)', () => {
    const job = baseJob({ id: 'jA', name: 'Repaint', crewMemberIds: ['m1', 'm2'] });
    const lanes = buildMemberLanes([job], staff, week, config);
    const m1 = lanes.find(l => l.crewId === 'm1')!;
    const m2 = lanes.find(l => l.crewId === 'm2')!;
    expect(m1.cardsByDay['2026-06-02'][0].jobId).toBe('jA');
    expect(m2.cardsByDay['2026-06-02'][0].jobId).toBe('jA');
  });

  it('routes a job with no resolvable member to an Unassigned lane', () => {
    const job = baseJob({ id: 'jU', crewMemberIds: [] });
    const lanes = buildMemberLanes([job], staff, week, config);
    const un = lanes.find(l => l.crewId === 'unassigned')!;
    expect(un.crewName).toBe('Unassigned');
    expect(un.cardsByDay['2026-06-02'][0].jobId).toBe('jU');
  });

  it('unions allocations[].memberIds with crewMemberIds', () => {
    const job = baseJob({ id: 'jX', crewMemberIds: ['m1'], allocations: [{ id: 'a', name: 'x', memberIds: ['m2'], startDate: '', endDate: '', startTime: '', endTime: '' }] });
    const lanes = buildMemberLanes([job], staff, week, config);
    expect(lanes.find(l => l.crewId === 'm1')!.cardsByDay['2026-06-02']).toHaveLength(1);
    expect(lanes.find(l => l.crewId === 'm2')!.cardsByDay['2026-06-02']).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run services/productionBoard.test.ts`
Expected: FAIL — `buildMemberLanes` is not exported.

- [ ] **Step 3: Implement**

In `services/productionBoard.ts`, add the import for `CrewMember` and the builder. Update the top import:

```ts
import type { Job, CrewGroup, CrewMember } from '../types';
```

Then append:

```ts
const memberIdsOf = (job: Job): string[] => {
  const ids = new Set<string>(job.crewMemberIds || []);
  job.allocations?.forEach(a => a.memberIds?.forEach(m => ids.add(m)));
  return [...ids];
};

const schedulable = (job: Job): boolean =>
  !!job.startDate && job.stage !== 'Completed' && job.stage !== 'Marketing' && job.stage !== 'Cancelled';

const cardFor = (job: Job): BoardCard => ({
  jobId: job.id, jobName: job.name, jobNumber: job.jobNumber,
  color: jobColor(job.id),
  startKey: toLocalDateKey(new Date(job.startDate!)),
  endKey: toLocalDateKey(new Date(job.endDate || job.startDate!)),
  isLocked: !!job.is_locked,
});

export const buildMemberLanes = (
  jobs: Job[],
  staff: CrewMember[],
  weekDays: Date[],
  config: WorkingTimeConfig,
): BoardLane[] => {
  const dayKeys = weekDays.map(toLocalDateKey);
  const lanes = new Map<string, BoardLane>();
  const ensure = (id: string, name: string): BoardLane => {
    if (!lanes.has(id)) lanes.set(id, { crewId: id, crewName: name, cardsByDay: {} });
    return lanes.get(id)!;
  };

  staff.forEach(m => ensure(m.id, m.name));

  for (const job of jobs) {
    if (!schedulable(job)) continue;
    const known = memberIdsOf(job).filter(id => staff.some(s => s.id === id));
    const targets = known.length ? known : ['unassigned'];
    const card = cardFor(job);
    for (const target of targets) {
      const lane = target === 'unassigned' ? ensure('unassigned', 'Unassigned') : lanes.get(target)!;
      for (const key of dayKeys) {
        if (occupiesWorkingDay(job.startDate!, job.endDate, key, config)) {
          (lane.cardsByDay[key] ||= []).push(card);
        }
      }
    }
  }

  return Array.from(lanes.values()).sort((a, b) => {
    if (a.crewId === 'unassigned') return 1;
    if (b.crewId === 'unassigned') return -1;
    return 0;
  });
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run services/productionBoard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/productionBoard.ts services/productionBoard.test.ts
git commit -m "feat: buildMemberLanes (group board rows by team member)"
```

---

## Task 2: `buildJobLanes`

**Files:**
- Modify: `services/productionBoard.ts`
- Test: `services/productionBoard.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { buildJobLanes } from './productionBoard';

describe('buildJobLanes', () => {
  const week = [new Date('2026-06-01T00:00:00'), new Date('2026-06-02T00:00:00'), new Date('2026-06-03T00:00:00')];
  const config = { workDayStartHour: 8, workDayEndHour: 17, skipNonWorkingDays: false, workingDays: [0,1,2,3,4,5,6] } as any;
  const baseJob = (over: any) => ({
    id: 'j', jobNumber: 'J1', name: 'Job', stage: 'Scheduled',
    startDate: '2026-06-02T08:00:00', endDate: '2026-06-02T17:00:00', ...over,
  });

  it('creates one lane per occupying job, ordered by start day then name', () => {
    const a = baseJob({ id: 'a', name: 'Zebra', startDate: '2026-06-01T08:00:00', endDate: '2026-06-01T17:00:00' });
    const b = baseJob({ id: 'b', name: 'Alpha', startDate: '2026-06-02T08:00:00', endDate: '2026-06-02T17:00:00' });
    const lanes = buildJobLanes([b, a], week, config);
    expect(lanes.map(l => l.crewName)).toEqual(['Zebra', 'Alpha']); // Jun 1 before Jun 2
    expect(lanes[0].cardsByDay['2026-06-01'][0].jobId).toBe('a');
  });

  it('excludes jobs that do not occupy any visible day and Completed jobs', () => {
    const offWeek = baseJob({ id: 'off', startDate: '2026-07-01T08:00:00', endDate: '2026-07-01T17:00:00' });
    const done = baseJob({ id: 'done', stage: 'Completed' });
    expect(buildJobLanes([offWeek, done], week, config)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run services/productionBoard.test.ts`
Expected: FAIL — `buildJobLanes` is not exported.

- [ ] **Step 3: Implement**

Append to `services/productionBoard.ts` (reuses `schedulable`/`cardFor` from Task 1):

```ts
export const buildJobLanes = (
  jobs: Job[],
  weekDays: Date[],
  config: WorkingTimeConfig,
): BoardLane[] => {
  const dayKeys = weekDays.map(toLocalDateKey);
  const lanes: BoardLane[] = [];

  for (const job of jobs) {
    if (!schedulable(job)) continue;
    const card = cardFor(job);
    const cardsByDay: Record<string, BoardCard[]> = {};
    for (const key of dayKeys) {
      if (occupiesWorkingDay(job.startDate!, job.endDate, key, config)) cardsByDay[key] = [card];
    }
    if (Object.keys(cardsByDay).length === 0) continue; // not in this week
    lanes.push({ crewId: job.id, crewName: job.name, cardsByDay });
  }

  const firstKey = (l: BoardLane) => Object.keys(l.cardsByDay).sort()[0] ?? '';
  return lanes.sort((a, b) => firstKey(a).localeCompare(firstKey(b)) || a.crewName.localeCompare(b.crewName));
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run services/productionBoard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/productionBoard.ts services/productionBoard.test.ts
git commit -m "feat: buildJobLanes (one board row per job)"
```

---

## Task 3: `JobCard` click stops propagation

**Files:**
- Modify: `components/views/JobScheduling/JobCard.tsx`

- [ ] **Step 1: Update the click handler**

In `components/views/JobScheduling/JobCard.tsx`, change the `onClick` so a card click doesn't bubble to the cell (which will own an availability-edit click in the member view):

```tsx
      onClick={(e) => { e.stopPropagation(); onClick?.(card.jobId); }}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobScheduling/JobCard.tsx
git commit -m "fix: JobCard click stops propagation to cell"
```

---

## Task 4: Generalize `ProductionBoard` (accept lanes + render hooks)

**Files:**
- Modify: `components/views/JobScheduling/ProductionBoard.tsx`

- [ ] **Step 1: Change props to accept prebuilt lanes + hooks**

Replace the props interface and the lanes line. New interface:

```tsx
interface ProductionBoardProps {
  lanes: BoardLane[];
  weekDays: Date[];
  config: WorkingTimeConfig;
  canReschedule: boolean;
  rainDays?: { date: string }[];
  onDropJob: (jobId: string, dayKey: string) => void;
  onMarkRainDay?: (dayKey: string) => void;
  onViewJob?: (jobId: string) => void;
  onMoveJob?: (jobId: string) => void;
  renderRowLabel?: (lane: BoardLane) => React.ReactNode;
  renderCellExtra?: (laneId: string, dayKey: string) => React.ReactNode;
  onCellActivate?: (laneId: string, dayKey: string) => void;
}
```

Update the destructure and remove the internal build:

```tsx
export const ProductionBoard = ({
  lanes, weekDays, config, canReschedule, rainDays, onDropJob, onMarkRainDay, onViewJob, onMoveJob,
  renderRowLabel, renderCellExtra, onCellActivate,
}: ProductionBoardProps) => {
```

Delete this line (no longer builds lanes internally):

```tsx
  const lanes = useMemo(() => buildLanes(jobs, crews, weekDays, config), [jobs, crews, weekDays, config]);
```

Update imports: drop `Job, CrewGroup` and `buildLanes` if now unused, keep `BoardCard` and add `BoardLane`:

```tsx
import { BoardCard, BoardLane } from '../../../services/productionBoard';
```

(`useMemo` may now be unused — remove it from the React import if so. `Job`/`CrewGroup` import line can be deleted if nothing else uses them.)

- [ ] **Step 2: Render the row label via the hook**

Find the crew-name lane label cell (the sticky left cell rendering `{lane.crewName}`) and replace its inner content:

```tsx
            <div className="p-3 font-bold text-sm text-gray-700 dark:text-gray-200 border-b border-r border-gray-100 dark:border-gray-700 sticky left-0 bg-white dark:bg-gray-800 z-10">
              {renderRowLabel ? renderRowLabel(lane) : lane.crewName}
            </div>
```

- [ ] **Step 3: Render cell extra + activation on the lane cells**

Find the lane day cell (`data-cell-id={cellId}` ... `onContextMenu={...}`) and add the overlay + click. Replace the cell opening tag and inner top:

```tsx
                <div
                  key={cellId}
                  data-cell-id={cellId}
                  data-cell-day={dayKey}
                  onContextMenu={(e) => handleContextMenu(e, dayKey)}
                  onClick={onCellActivate ? () => onCellActivate(lane.crewId, dayKey) : undefined}
                  className={`relative min-h-[64px] p-1.5 space-y-1 border-b border-l border-gray-100 dark:border-gray-800 ${onCellActivate ? 'cursor-pointer' : ''} ${hoverCell === cellId ? 'bg-primary-50 dark:bg-primary-900/30' : ''}`}
                >
                  {renderCellExtra && (
                    <div className="pointer-events-none absolute inset-0 z-0">{renderCellExtra(lane.crewId, dayKey)}</div>
                  )}
```

(Leave the existing rain overlay and the `relative z-10` cards wrapper as-is, after this.)

- [ ] **Step 4: Verify typecheck**

Run: `npm run lint`
Expected: FAIL — `JobSchedulingView` still passes the old `jobs`/`crews` props. Fixed in Task 6.

- [ ] **Step 5: Commit (after Task 6 makes lint pass)**

```bash
git add components/views/JobScheduling/ProductionBoard.tsx
git commit -m "feat: generalize ProductionBoard to render any lanes + row/cell hooks"
```

---

## Task 5: `ProductionBoard` render-hook test

**Files:**
- Create: `components/views/JobScheduling/ProductionBoard.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductionBoard } from './ProductionBoard';
import type { BoardLane } from '../../../services/productionBoard';

const config = { workDayStartHour: 8, workDayEndHour: 17, skipNonWorkingDays: false, workingDays: [0,1,2,3,4,5,6] } as any;
const week = [new Date('2026-06-01T00:00:00')];
const lanes: BoardLane[] = [{ crewId: 'm1', crewName: 'Alice', cardsByDay: {} }];

describe('ProductionBoard hooks', () => {
  it('renders a custom row label', () => {
    render(<ProductionBoard lanes={lanes} weekDays={week} config={config} canReschedule={false} onDropJob={vi.fn()} renderRowLabel={(l) => <span>★ {l.crewName}</span>} />);
    expect(screen.getByText('★ Alice')).toBeInTheDocument();
  });

  it('fires onCellActivate when a cell background is clicked', () => {
    const onCellActivate = vi.fn();
    render(<ProductionBoard lanes={lanes} weekDays={week} config={config} canReschedule={false} onDropJob={vi.fn()} onCellActivate={onCellActivate} />);
    const cell = document.querySelector('[data-cell-id="m1:2026-06-01"]') as HTMLElement;
    fireEvent.click(cell);
    expect(onCellActivate).toHaveBeenCalledWith('m1', '2026-06-01');
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run components/views/JobScheduling/ProductionBoard.test.tsx`
Expected: PASS (requires Task 4).

- [ ] **Step 3: Commit**

```bash
git add components/views/JobScheduling/ProductionBoard.test.tsx
git commit -m "test: ProductionBoard render hooks"
```

---

## Task 6: Three-view switcher in `JobSchedulingView`

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

- [ ] **Step 1: Import the new builders**

Add to the imports (near the other service imports around line 13):

```ts
import { buildLanes, buildMemberLanes, buildJobLanes, BoardLane } from '../../services/productionBoard';
```

- [ ] **Step 2: Replace the tab state with a view state**

Change the state declaration (currently `useState<'availability' | 'assignments'>('assignments')`):

```ts
  const [view, setView] = useState<'crew' | 'member' | 'job'>('crew');
```

- [ ] **Step 3: Build the lanes for the active view**

After `capacityHours` is computed (around line 342), add:

```ts
  const boardLanes = useMemo<BoardLane[]>(() => {
    if (view === 'member') return buildMemberLanes(jobs, allStaff, weekDays, workConfig);
    if (view === 'job') return buildJobLanes(jobs, weekDays, workConfig);
    return buildLanes(jobs, crews, weekDays, workConfig);
  }, [view, jobs, allStaff, crews, weekDays, workConfig]);

  const formatAvail = (emp: CrewMember, dayKey: string) => {
    const s = emp.schedule?.[dayKey];
    if (s?.isOff) return { off: true as const, text: s.reason || 'Off' };
    return { off: false as const, text: `${s?.startTime || '08:00'}–${s?.endTime || '17:00'}` };
  };
```

(`CrewMember` is already imported on line 8. If `formatToAmPm` exists in this file it can be used instead of raw times — optional; raw `HH:mm` is acceptable.)

- [ ] **Step 4: Replace the tab bar with a 3-view switcher**

Find the two `<button>`s that call `setActiveTab('assignments')` / `setActiveTab('availability')` (around lines 457-466) and replace the pair with three buttons. Match the existing button classes; only the labels and handlers change:

```tsx
                  <button
                    onClick={() => setView('crew')}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${view === 'crew' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    Crew
                  </button>
                  <button
                    onClick={() => setView('member')}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${view === 'member' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    Crew Member
                  </button>
                  <button
                    onClick={() => setView('job')}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${view === 'job' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    Job
                  </button>
```

- [ ] **Step 5: Remove the old availability table block**

Delete the entire `{activeTab === 'availability' && ( ... )}` block (around lines 500-563, the `<Card>` with the `renderTableHead()` table). The `renderTableHead` helper and `formatToAmPm`/`openAvailabilityModal` stay (the modal is reused below).

- [ ] **Step 6: Replace the assignments board block with the single view-driven board**

Find the `{activeTab === 'assignments' && ( <ProductionBoard jobs={jobs} crews={crews} ... /> )}` block (around line 566) and replace it with one board fed by `boardLanes` and the per-view hooks:

```tsx
        <ProductionBoard
          lanes={boardLanes}
          weekDays={weekDays}
          config={workConfig}
          canReschedule={canReschedule}
          rainDays={settings.scheduling?.rainDays}
          onDropJob={handleDropJob}
          onMarkRainDay={handleMarkRainDay}
          onViewJob={(id) => { const j = jobs.find(x => x.id === id); if (j) setSelectedJob(j); }}
          onMoveJob={(id) => { const j = jobs.find(x => x.id === id); if (j) setMoveJob(j); }}
          renderRowLabel={view === 'member'
            ? (lane) => {
                const emp = allStaff.find(s => s.id === lane.crewId);
                return (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border border-white dark:border-gray-600 shrink-0">
                      {emp?.photo ? <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" /> : <User className="w-full h-full p-1.5 text-gray-400" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{lane.crewName}</div>
                      {emp?.role && <div className="text-[11px] text-gray-400 truncate">{emp.role}</div>}
                    </div>
                  </div>
                );
              }
            : undefined}
          renderCellExtra={view === 'member'
            ? (laneId, dayKey) => {
                const emp = allStaff.find(s => s.id === laneId);
                if (!emp) return null;
                const a = formatAvail(emp, dayKey);
                return (
                  <div className={`absolute top-1 right-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${a.off ? 'text-red-500 bg-red-50 dark:bg-red-900/30' : 'text-green-600 bg-green-50 dark:bg-green-900/30'}`}>
                    {a.off ? 'Off' : a.text}
                  </div>
                );
              }
            : undefined}
          onCellActivate={view === 'member'
            ? (laneId, dayKey) => {
                const emp = allStaff.find(s => s.id === laneId);
                if (emp) openAvailabilityModal(emp, new Date(`${dayKey}T00:00:00`));
              }
            : undefined}
        />
```

(`User` icon is already imported in this file — it is used by the old availability table; keep the import even after deleting that table since it is now used here. Verify `openAvailabilityModal(emp, date)` signature matches the existing helper used by the old table at `onClick={() => openAvailabilityModal(emp, day)}`.)

- [ ] **Step 7: Verify the whole project typechecks and tests pass**

Run: `npm run lint && npx vitest run`
Expected: PASS — no type errors; all tests green.

- [ ] **Step 8: Commit**

```bash
git add components/views/JobSchedulingView.tsx components/views/JobScheduling/ProductionBoard.tsx
git commit -m "feat: Crew / Crew Member / Job view switcher on Job Scheduling"
```

---

## Task 7: Manual verification

**Files:** none (manual).

- [ ] **Step 1: Run the app**

Run: `npm run dev`, open Job Scheduling.

- [ ] **Step 2: Crew view** — confirm it matches today's board (rows = crews), drag-to-reschedule still opens the preview panel, rain-day right-click still works.

- [ ] **Step 3: Crew Member view** — switch to Crew Member; confirm one row per team member with avatar/role; a job shared by two members shows in both rows; each cell shows availability (hours, or Off); clicking an empty cell opens the Edit Availability modal; clicking a job card opens the job (not the availability modal).

- [ ] **Step 4: Job view** — switch to Job; confirm one row per job in the week, ordered by start day; drag still reschedules.

- [ ] **Step 5: Cross-view chrome** — week navigation, Bulk Reschedule, and the right-docked panels work in all three views; switching views preserves the selected week.

---

## Self-Review Notes

- **Spec coverage:** 3-view switcher (Task 6), Crew (existing `buildLanes`, Task 6), Crew Member with multi-member duplication + Unassigned + availability overlay + edit (Tasks 1, 6), Job one-row-per-job (Tasks 2, 6), board generalization with hooks (Task 4), JobCard propagation fix (Task 3), availability table removed (Task 6 Step 5), tests (Tasks 1, 2, 5). All spec sections covered.
- **Type consistency:** `BoardLane`/`BoardCard` reused verbatim; `buildMemberLanes(jobs, staff, weekDays, config)` and `buildJobLanes(jobs, weekDays, config)` signatures match their call sites in Task 6; `renderRowLabel`/`renderCellExtra`/`onCellActivate` names match between Task 4 (definition) and Task 6 (usage); `crewId` used as the generic lane/member/job id throughout.
- **Placeholder scan:** every code step is complete; no TBD/TODO. Helper-reuse notes (`schedulable`/`cardFor`) point to Task 1 where they are defined.
- **Note:** Task 4 intentionally leaves the build red until Task 6 wires the new props — Tasks 4–6 land together (commit order: 4 after 6 makes lint pass, per Task 4 Step 5).
