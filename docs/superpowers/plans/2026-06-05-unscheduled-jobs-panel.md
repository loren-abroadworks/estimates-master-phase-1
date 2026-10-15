# Unscheduled Jobs Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Unscheduled Jobs" section below the board in the Job Scheduling view's Job tab (both Week and Month scales) listing draggable cards for jobs with no start date; dragging a card onto a day opens the existing reschedule preview to schedule it.

**Architecture:** A dumb presentational component (`UnscheduledJobsPanel`) renders prebuilt cards and emits HTML5 `dataTransfer` drags. Both boards gain HTML5 drop handlers keyed on a shared `JOB_DND_TYPE` MIME constant, routing to the existing `onDropJob` (`handleDropJob`) which already stages a reschedule preview for a job with no prior dates. The parent (`JobSchedulingView`) derives the unscheduled jobs and renders the panel only in Job view.

**Tech Stack:** React + TypeScript, Vite, Vitest + @testing-library/react, Tailwind, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-06-05-unscheduled-jobs-panel-design.md`

**Branch:** `feat/unscheduled-jobs-panel` (already created; the spec commit is on it).

---

## File Structure

- **New** `components/views/JobScheduling/jobDnd.ts` — shared DND MIME constant.
- **New** `components/views/JobScheduling/UnscheduledJobsPanel.tsx` — panel component + `selectUnscheduledJobs` selector.
- **New** `components/views/JobScheduling/UnscheduledJobsPanel.test.tsx` — selector + component tests.
- **Modify** `components/views/JobScheduling/CrewHoursGrid.tsx` — import shared `JOB_DND_TYPE` instead of its private copy.
- **Modify** `components/views/JobScheduling/ProductionBoard.tsx` — add HTML5 drop handlers + drop-hover highlight to day cells.
- **Modify** `components/views/JobScheduling/ProductionBoard.test.tsx` — drop test.
- **Modify** `components/views/JobScheduling/MonthBoard.tsx` — read/write job id via `dataTransfer`.
- **Modify** `components/views/JobScheduling/MonthBoard.test.tsx` — external-drop test.
- **Modify** `components/views/JobSchedulingView.tsx` — derive unscheduled cards, render panel in Job view.

> NOTE: No change to `ReschedulePreviewPanel`/`SingleJobEditor` is needed. The dropped job uses `mode:'edit'`; `SingleJobEditor.fmtRange` already renders a `null` `oldStart` as `—` and `startDeltaDays` guards `oldStart`. Task 6 verifies this in the running app.

---

## Task 1: Shared DND constant

**Files:**
- Create: `components/views/JobScheduling/jobDnd.ts`
- Modify: `components/views/JobScheduling/CrewHoursGrid.tsx:8`

- [ ] **Step 1: Create the shared constant module**

Create `components/views/JobScheduling/jobDnd.ts`:

```ts
// MIME type carrying a dragged job's id between a job card and a drop target
// (crew member row, or a board day cell). Shared so every drag source/target
// uses the same channel.
export const JOB_DND_TYPE = 'application/x-job-id';
```

- [ ] **Step 2: Point CrewHoursGrid at the shared constant**

In `components/views/JobScheduling/CrewHoursGrid.tsx`, remove the local declaration on line 8:

```ts
// MIME type carrying the dragged job's id between a job card and a member row.
const JOB_DND_TYPE = 'application/x-job-id';
```

and add to the import block at the top of the file (after the `Toggle` import on line 5):

```ts
import { JOB_DND_TYPE } from './jobDnd';
```

- [ ] **Step 3: Verify existing CrewHoursGrid tests still pass**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx`
Expected: PASS (no behavior change).

- [ ] **Step 4: Commit**

```bash
git add components/views/JobScheduling/jobDnd.ts components/views/JobScheduling/CrewHoursGrid.tsx
git commit -m "refactor: extract shared JOB_DND_TYPE constant"
```

---

## Task 2: `selectUnscheduledJobs` selector

**Files:**
- Create: `components/views/JobScheduling/UnscheduledJobsPanel.tsx` (selector only for now)
- Create: `components/views/JobScheduling/UnscheduledJobsPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/views/JobScheduling/UnscheduledJobsPanel.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnscheduledJobsPanel, selectUnscheduledJobs, type UnscheduledJobCard } from './UnscheduledJobsPanel';
import type { Job } from '../../../types';

const job = (over: Partial<Job>): Job => ({
  id: 'j1', jobNumber: 'J-1', name: 'Exterior Repaint', stage: 'Confirmed',
  ...over,
} as Job);

describe('selectUnscheduledJobs', () => {
  it('returns only jobs with no startDate', () => {
    const jobs = [
      job({ id: 'a' }),
      job({ id: 'b', startDate: '2026-06-02T08:00:00' }),
    ];
    expect(selectUnscheduledJobs(jobs).map(j => j.id)).toEqual(['a']);
  });

  it('excludes Cancelled jobs even when they have no startDate', () => {
    const jobs = [
      job({ id: 'a' }),
      job({ id: 'c', stage: 'Cancelled' }),
    ];
    expect(selectUnscheduledJobs(jobs).map(j => j.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/UnscheduledJobsPanel.test.tsx`
Expected: FAIL — cannot resolve `./UnscheduledJobsPanel`.

- [ ] **Step 3: Create the component file with the selector + types**

Create `components/views/JobScheduling/UnscheduledJobsPanel.tsx`:

```tsx
import React from 'react';
import { GripVertical, CheckCircle2, Clock } from 'lucide-react';
import type { Job } from '../../../types';
import { JOB_DND_TYPE } from './jobDnd';

export interface UnscheduledJobCard {
  job: Job;
  clientName?: string;
  color: string;
  estHours?: number;
}

interface UnscheduledJobsPanelProps {
  cards: UnscheduledJobCard[];
  canReschedule: boolean;
  onSelectJob: (jobId: string) => void;
}

// Active jobs not yet placed on the calendar: no startDate, excluding Cancelled.
export const selectUnscheduledJobs = (jobs: Job[]): Job[] =>
  jobs.filter(j => !j.startDate && j.stage !== 'Cancelled');

export const UnscheduledJobsPanel = ({ cards, canReschedule, onSelectJob }: UnscheduledJobsPanelProps) => (
  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-5 mt-6">
    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Unscheduled Jobs</h3>
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map(({ job, clientName, color, estHours }) => (
        <li
          key={job.id}
          draggable={canReschedule}
          onDragStart={canReschedule ? (e) => {
            e.dataTransfer.setData(JOB_DND_TYPE, job.id);
            e.dataTransfer.effectAllowed = 'copy';
          } : undefined}
          onClick={() => onSelectJob(job.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectJob(job.id); } }}
          role="button"
          tabIndex={0}
          title={canReschedule
            ? `Click to view details · drag onto a day to schedule · ${job.jobNumber} ${job.name}`
            : `Click to view details · ${job.jobNumber} ${job.name}`}
          className={`group relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-3 pl-4 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-all ${canReschedule ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
        >
          <span className="absolute left-0 top-2 bottom-2 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm text-gray-900 dark:text-white truncate">{job.name}</div>
              <div className="text-[11px] text-gray-400 truncate">{job.jobNumber}{clientName ? ` · ${clientName}` : ''}</div>
            </div>
            {canReschedule && <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 group-hover:text-gray-400" />}
          </div>
          {estHours != null && estHours > 0 && (
            <div className="mt-2 flex items-center gap-1 text-[11px] text-gray-400">
              <Clock className="w-3.5 h-3.5" /> ~{estHours}h est
            </div>
          )}
        </li>
      ))}
    </ul>
    {cards.length === 0 && (
      <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
        <CheckCircle2 className="w-4 h-4" /> All jobs are scheduled.
      </p>
    )}
  </div>
);
```

- [ ] **Step 4: Run the selector tests to verify they pass**

Run: `npx vitest run components/views/JobScheduling/UnscheduledJobsPanel.test.tsx`
Expected: PASS (the two `selectUnscheduledJobs` tests).

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/UnscheduledJobsPanel.tsx components/views/JobScheduling/UnscheduledJobsPanel.test.tsx
git commit -m "feat: add UnscheduledJobsPanel with selectUnscheduledJobs selector"
```

---

## Task 3: `UnscheduledJobsPanel` component behavior

**Files:**
- Modify: `components/views/JobScheduling/UnscheduledJobsPanel.test.tsx`

The component is already implemented in Task 2. This task adds its behavior tests.

- [ ] **Step 1: Add the failing component tests**

Append inside `components/views/JobScheduling/UnscheduledJobsPanel.test.tsx` (after the `selectUnscheduledJobs` describe block):

```tsx
const card = (over: Partial<UnscheduledJobCard> = {}): UnscheduledJobCard => ({
  job: job({ id: 'a', name: 'Smith Living Room', jobNumber: 'J-9' }),
  clientName: 'Smith',
  color: '#10b981',
  estHours: 16,
  ...over,
});

describe('UnscheduledJobsPanel', () => {
  it('renders a card with name, number, client, and hours hint', () => {
    render(<UnscheduledJobsPanel cards={[card()]} canReschedule onSelectJob={vi.fn()} />);
    expect(screen.getByText('Smith Living Room')).toBeInTheDocument();
    expect(screen.getByText('J-9 · Smith')).toBeInTheDocument();
    expect(screen.getByText('~16h est')).toBeInTheDocument();
  });

  it('sets the dragged job id on dragStart', () => {
    render(<UnscheduledJobsPanel cards={[card()]} canReschedule onSelectJob={vi.fn()} />);
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByText('Smith Living Room').closest('li')!, {
      dataTransfer: { setData, effectAllowed: '' },
    });
    expect(setData).toHaveBeenCalledWith('application/x-job-id', 'a');
  });

  it('calls onSelectJob when a card is clicked', () => {
    const onSelectJob = vi.fn();
    render(<UnscheduledJobsPanel cards={[card()]} canReschedule onSelectJob={onSelectJob} />);
    fireEvent.click(screen.getByText('Smith Living Room').closest('li')!);
    expect(onSelectJob).toHaveBeenCalledWith('a');
  });

  it('is not draggable when canReschedule is false', () => {
    render(<UnscheduledJobsPanel cards={[card()]} canReschedule={false} onSelectJob={vi.fn()} />);
    const li = screen.getByText('Smith Living Room').closest('li')!;
    expect(li.getAttribute('draggable')).toBe('false');
  });

  it('shows the empty state when there are no cards', () => {
    render(<UnscheduledJobsPanel cards={[]} canReschedule onSelectJob={vi.fn()} />);
    expect(screen.getByText('All jobs are scheduled.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `npx vitest run components/views/JobScheduling/UnscheduledJobsPanel.test.tsx`
Expected: PASS (all selector + component tests).

> If the "not draggable" assertion fails because React renders `draggable={false}` as omitted, change the assertion to `expect(li.getAttribute('draggable')).not.toBe('true');`.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobScheduling/UnscheduledJobsPanel.test.tsx
git commit -m "test: cover UnscheduledJobsPanel drag, click, and empty state"
```

---

## Task 4: ProductionBoard accepts external drops

**Files:**
- Modify: `components/views/JobScheduling/ProductionBoard.tsx`
- Modify: `components/views/JobScheduling/ProductionBoard.test.tsx`

- [ ] **Step 1: Write the failing test**

Append inside the `describe('ProductionBoard hooks', ...)` block in `components/views/JobScheduling/ProductionBoard.test.tsx`:

```tsx
it('fires onDropJob when a job is dropped on a day cell via dataTransfer', () => {
  const onDropJob = vi.fn();
  render(<ProductionBoard lanes={lanes} weekDays={week} config={config} canReschedule onDropJob={onDropJob} />);
  const cell = document.querySelector('[data-cell-id="m1:2026-06-01"]') as HTMLElement;
  fireEvent.drop(cell, { dataTransfer: { getData: () => 'job-7' } });
  expect(onDropJob).toHaveBeenCalledWith('job-7', '2026-06-01');
});

it('does not fire onDropJob on drop when canReschedule is false', () => {
  const onDropJob = vi.fn();
  render(<ProductionBoard lanes={lanes} weekDays={week} config={config} canReschedule={false} onDropJob={onDropJob} />);
  const cell = document.querySelector('[data-cell-id="m1:2026-06-01"]') as HTMLElement;
  fireEvent.drop(cell, { dataTransfer: { getData: () => 'job-7' } });
  expect(onDropJob).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/ProductionBoard.test.tsx -t "dataTransfer"`
Expected: FAIL — `onDropJob` not called (no drop handler yet).

- [ ] **Step 3: Add the import and drop-hover state**

In `components/views/JobScheduling/ProductionBoard.tsx`:

Add to the imports near the top (the file already imports React hooks; add this import line with the other local imports):

```ts
import { JOB_DND_TYPE } from './jobDnd';
```

Add the drop-hover state alongside the other `useState` declarations inside the component (next to `const [hoverCells, setHoverCells] = useState...` near line 43):

```ts
// Cell highlighted while an external (HTML5) job card is dragged over it.
const [dropHoverCell, setDropHoverCell] = useState<string | null>(null);
```

- [ ] **Step 4: Add the drop handlers and highlight to the day cell**

In the background day-cell `<div>` (currently lines 205-212), add the three handlers and extend the highlight condition. Replace:

```tsx
                      <div
                        key={cellId}
                        data-cell-id={cellId}
                        data-cell-day={dayKey}
                        onContextMenu={(e) => handleContextMenu(e, dayKey)}
                        onClick={onCellActivate ? () => onCellActivate(lane.crewId, dayKey) : undefined}
                        className={`relative border-l border-gray-100 dark:border-gray-800 ${onCellActivate ? 'cursor-pointer' : ''} ${hoverCells.has(cellId) ? 'bg-primary-100 dark:bg-primary-900/40 ring-1 ring-inset ring-primary-300 dark:ring-primary-700' : ''}`}
                      >
```

with:

```tsx
                      <div
                        key={cellId}
                        data-cell-id={cellId}
                        data-cell-day={dayKey}
                        onContextMenu={(e) => handleContextMenu(e, dayKey)}
                        onClick={onCellActivate ? () => onCellActivate(lane.crewId, dayKey) : undefined}
                        onDragOver={canReschedule ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropHoverCell(cellId); } : undefined}
                        onDragLeave={canReschedule ? () => setDropHoverCell(prev => (prev === cellId ? null : prev)) : undefined}
                        onDrop={canReschedule ? (e) => { e.preventDefault(); setDropHoverCell(null); const id = e.dataTransfer.getData(JOB_DND_TYPE); if (id) onDropJob(id, dayKey); } : undefined}
                        className={`relative border-l border-gray-100 dark:border-gray-800 ${onCellActivate ? 'cursor-pointer' : ''} ${(hoverCells.has(cellId) || dropHoverCell === cellId) ? 'bg-primary-100 dark:bg-primary-900/40 ring-1 ring-inset ring-primary-300 dark:ring-primary-700' : ''}`}
                      >
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run components/views/JobScheduling/ProductionBoard.test.tsx`
Expected: PASS (new drop tests + all existing ProductionBoard tests).

- [ ] **Step 6: Commit**

```bash
git add components/views/JobScheduling/ProductionBoard.tsx components/views/JobScheduling/ProductionBoard.test.tsx
git commit -m "feat: ProductionBoard accepts HTML5 job drops on day cells"
```

---

## Task 5: MonthBoard accepts external drops

**Files:**
- Modify: `components/views/JobScheduling/MonthBoard.tsx`
- Modify: `components/views/JobScheduling/MonthBoard.test.tsx`

- [ ] **Step 1: Write the failing test**

Append inside the `describe('MonthBoard', ...)` block in `components/views/JobScheduling/MonthBoard.test.tsx`:

```tsx
it('calls onDropJob with the id from dataTransfer when an external card is dropped', () => {
  const onDropJob = vi.fn();
  render(<MonthBoard {...base} jobs={[]} onDropJob={onDropJob} />);
  // The first in-month day cell — Jun 1, 2026 is a Monday in this grid.
  const cell = screen.getByText('1').closest('div')!.parentElement!;
  fireEvent.drop(cell, { dataTransfer: { getData: () => 'job-42' } });
  expect(onDropJob).toHaveBeenCalled();
  expect(onDropJob.mock.calls[0][0]).toBe('job-42');
});
```

> The day-number `1` is rendered inside a child `<div>` of the cell; `.closest('div').parentElement` resolves to the cell `<div>` that carries `onDrop`. If the DOM nesting differs, target the cell directly with `container.querySelectorAll('[draggable]')`'s parent grid instead; the assertion that matters is that `onDropJob` receives `'job-42'`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/MonthBoard.test.tsx -t "dataTransfer"`
Expected: FAIL — `onDropJob` receives `null`/`undefined` for the id (current `onDrop` only reads the internal `dragged` ref, which an external card never sets).

- [ ] **Step 3: Add the shared import**

In `components/views/JobScheduling/MonthBoard.tsx`, add to the imports at the top:

```ts
import { JOB_DND_TYPE } from './jobDnd';
```

- [ ] **Step 4: Read/write the job id via dataTransfer**

In `components/views/JobScheduling/MonthBoard.tsx`, update the cell `onDrop` (line 49). Replace:

```tsx
                  onDrop={onDropJob ? (() => { if (dragged.current) onDropJob(dragged.current, d.key); dragged.current = null; }) : undefined}
```

with:

```tsx
                  onDrop={onDropJob ? ((e) => { const id = e.dataTransfer.getData(JOB_DND_TYPE) || dragged.current; if (id) onDropJob(id, d.key); dragged.current = null; }) : undefined}
```

Then update the internal card `onDragStart` (line 65) so internal drags use the same channel. Replace:

```tsx
                  onDragStart={() => { dragged.current = bar.card.jobId; }}
```

with:

```tsx
                  onDragStart={(e) => { dragged.current = bar.card.jobId; e.dataTransfer.setData(JOB_DND_TYPE, bar.card.jobId); }}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run components/views/JobScheduling/MonthBoard.test.tsx`
Expected: PASS (new external-drop test + all existing MonthBoard tests, including the internal-drag drop).

- [ ] **Step 6: Commit**

```bash
git add components/views/JobScheduling/MonthBoard.tsx components/views/JobScheduling/MonthBoard.test.tsx
git commit -m "feat: MonthBoard routes job drops through dataTransfer"
```

---

## Task 6: Wire the panel into JobSchedulingView

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

- [ ] **Step 1: Add the import**

In `components/views/JobSchedulingView.tsx`, add with the other `./JobScheduling/*` imports (e.g. after the `AssignHoursModal` import on line 30):

```ts
import { UnscheduledJobsPanel, selectUnscheduledJobs, type UnscheduledJobCard } from './JobScheduling/UnscheduledJobsPanel';
```

(`computeJobStats` and `crewColorForJob` are already imported in this file; `clients`, `crews`, `workOrders` are already props.)

- [ ] **Step 2: Derive the unscheduled cards**

In `components/views/JobSchedulingView.tsx`, add this `useMemo` near the other derived data (e.g. after `activeStaff` around line 480):

```tsx
  // Jobs not yet placed on the calendar, shown as draggable cards below the
  // board in Job view. Dropping one on a day routes through handleDropJob.
  const unscheduledCards = useMemo<UnscheduledJobCard[]>(() =>
    selectUnscheduledJobs(jobs).map(job => ({
      job,
      clientName: clients.find(c => c.id === job.clientId)?.name,
      color: crewColorForJob(job, crews),
      estHours: computeJobStats(job, workOrders).estHours,
    })),
  [jobs, clients, crews, workOrders]);
```

- [ ] **Step 3: Render the panel after the board block**

In `components/views/JobSchedulingView.tsx`, immediately after the board-rendering block closes (the `) }` that ends the `hoursGridActive ? ... : scale === 'month' ? <MonthBoard/> : <ProductionBoard/>` expression, currently the `)}` on line 938) and before `<SingleJobMoveDrawer ...>`, insert:

```tsx
        {view === 'job' && (
          <UnscheduledJobsPanel
            cards={unscheduledCards}
            canReschedule={canReschedule}
            onSelectJob={(id) => { const j = jobs.find(x => x.id === id); if (j) setSelectedJob(j); }}
          />
        )}
```

- [ ] **Step 4: Type-check and run the full scheduling test suite**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npx vitest run components/views/JobScheduling`
Expected: PASS.

- [ ] **Step 5: Manually verify in the app**

Run: `npm run dev`, open the Job Scheduling view, Job tab.
Verify:
- An "Unscheduled Jobs" section appears below the board in both Week and Month, with a card per job that has no start date; it is absent in the Crew tab.
- Dragging a card onto a board day (Week and Month) opens the reschedule preview drawer. The "from" date shows `—` (not blank/NaN). Pressing Apply schedules the job; its card then disappears from the section.
- Clicking a card opens the job details panel.

- [ ] **Step 6: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: show Unscheduled Jobs panel in Job Scheduling Job view"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Confirm the working tree contains only intended changes**

Run: `git status` and `git log --oneline feat/unscheduled-jobs-panel`
Expected: the task commits above; the pre-existing unrelated working-tree modifications from before this work remain unstaged and untouched.

---

## Self-Review Notes

- **Spec coverage:** shared DND constant (Task 1), selector + panel + visuals (Tasks 2–3), ProductionBoard drop (Task 4), MonthBoard drop (Task 5), JobSchedulingView wiring + both-scales + Job-view-only guard (Task 6), null-`oldStart` handling (verified already handled; Task 6 Step 5 confirms in-app). All spec sections map to a task.
- **Type consistency:** `selectUnscheduledJobs`, `UnscheduledJobCard`, `UnscheduledJobsPanel`, and `JOB_DND_TYPE` names are identical across the panel, tests, board edits, and view wiring.
- **No placeholders:** every code step shows complete code and exact commands.
