# Production Board — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Job Scheduling's "Assignments" tab into a draggable Production Board with an inline Reschedule Preview panel, relocate rain-day / bulk / single-move rescheduling out of the Sales Calendar, and make every reschedule preview-first (nothing commits until Apply).

**Architecture:** Two new pure modules (`services/productionBoard.ts` for the swimlane transform, `services/reschedulePreview.ts` for the staging reducer) are TDD'd with Vitest. New React components (`ProductionBoard`, `JobCard`, `ReschedulePreviewPanel`) live under `components/views/JobScheduling/` and are wired into `JobSchedulingView`. All reschedule actions build a `ProposedChange[]` via the existing pure `scheduleEngine`, stage it into the panel, and only commit through the existing `App.handleApplySchedule` on Apply. The Sales Calendar loses its reschedule tools but keeps the read-only rain-day stripe.

**Tech Stack:** React 19 + TypeScript, Vite 6, Tailwind (utility classes inline), lucide-react icons, Vitest + @testing-library/react (added in Task 1). HTML5 drag-and-drop (no new dnd dependency).

**Spec:** `docs/superpowers/specs/2026-06-02-production-board-reschedule-design.md` (Phase 1 only).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `services/productionBoard.ts` | Pure: transform jobs+crews into crew swimlanes with per-day job cards | Create |
| `services/productionBoard.test.ts` | Unit tests for `buildLanes` | Create |
| `services/reschedulePreview.ts` | Pure: staging reducer + `summarizeStaged` for the preview panel | Create |
| `services/reschedulePreview.test.ts` | Unit tests for reducer + summary | Create |
| `services/scheduleEngine.test.ts` | Unit tests for existing `moveJobToSlot` / `shiftJobsFromPoint` (spec §9) | Create |
| `components/views/JobScheduling/ProductionBoard.tsx` | Crew-swimlane board + drop targets; renders `JobCard`s | Create |
| `components/views/JobScheduling/JobCard.tsx` | Draggable job card | Create |
| `components/views/JobScheduling/ReschedulePreviewPanel.tsx` | Bottom dock: timeline + conflicts + Apply/Cancel | Create |
| `components/views/JobScheduling/useReschedulePreview.ts` | Hook wrapping the staging reducer | Create |
| `components/views/JobSchedulingView.tsx` | Host board + panel; relocate rain-day/bulk/single-move actions | Modify |
| `components/views/SalesCalendarView.tsx` | Remove reschedule tools; keep read-only rain stripe | Modify |
| `components/modals/CascadeRescheduleModal.tsx` | Repurposed into a bulk-config dialog that *stages* (no longer commits) | Modify |
| `components/drawers/SingleJobMoveDrawer.tsx` | `onApply` now stages instead of committing (caller change only) | Reuse |
| `App.tsx` | Pass scheduling props to `JobSchedulingView`; trim Calendar props | Modify |
| `vite.config.ts` / `package.json` | Vitest config + test scripts | Modify |

---

## Task 1: Project setup — git + Vitest

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `vitest.setup.ts`

- [ ] **Step 1: Initialize git and make a baseline commit**

```bash
cd /Users/MiggleWork/Downloads/feb-24-estimate-master
git init
git add -A
git commit -m "chore: baseline before Production Board Phase 1"
```

Expected: a repo with one commit. (`.gitignore` already excludes `node_modules`, `dist`, `.superpowers`.)

- [ ] **Step 2: Install Vitest + Testing Library**

Run:
```bash
npm install -D vitest@^2 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```
Expected: packages added to `devDependencies`, no errors.

- [ ] **Step 3: Add test scripts to `package.json`**

In the `"scripts"` block, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Configure Vitest in `vite.config.ts`**

The file currently exports a Vite config. Add a `test` block and the jsdom env. Full file:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
  },
});
```
> If `vite.config.ts` has extra existing fields (aliases, define), keep them — only add the `test` block and the triple-slash reference line.

- [ ] **Step 5: Create `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 6: Add a smoke test to prove the runner works**

Create `services/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('vitest', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Run the test**

Run: `npm test`
Expected: PASS, 1 passed.

- [ ] **Step 8: Delete the smoke test and commit**

```bash
rm services/smoke.test.ts
git add -A
git commit -m "chore: add Vitest + Testing Library"
```

---

## Task 2: `buildLanes` — pure swimlane transform (TDD)

Builds the board's data: one lane per crew group, each with the job cards that occupy the visible week. Jobs with no crew group fall into an "Unassigned" lane.

**Files:**
- Create: `services/productionBoard.ts`
- Test: `services/productionBoard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildLanes, BoardLane } from './productionBoard';
import { configFromSettings } from './scheduleEngine';
import type { Job, CrewGroup } from '../types';

const cfg = configFromSettings(undefined, false);

const weekDays = ['2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05']
  .map(k => new Date(`${k}T12:00:00`));

const job = (over: Partial<Job>): Job => ({
  id: 'j1', jobNumber: 'J-1', name: 'Job 1', stage: 'Scheduled',
  startDate: '2026-06-02T08:00:00', endDate: '2026-06-02T17:00:00',
  ...over,
} as Job);

const crewA: CrewGroup = { id: 'c1', name: 'Crew A', memberIds: ['m1'] } as CrewGroup;

describe('buildLanes', () => {
  it('places a job in its crew lane on the day it occupies', () => {
    const lanes = buildLanes([job({ crewGroupId: 'c1' })], [crewA], weekDays, cfg);
    const laneA = lanes.find(l => l.crewId === 'c1') as BoardLane;
    expect(laneA).toBeTruthy();
    expect(laneA.cardsByDay['2026-06-02']).toHaveLength(1);
    expect(laneA.cardsByDay['2026-06-02'][0].jobId).toBe('j1');
    expect(laneA.cardsByDay['2026-06-01']).toBeUndefined();
  });

  it('puts jobs with no crew group in an Unassigned lane', () => {
    const lanes = buildLanes([job({})], [crewA], weekDays, cfg);
    const un = lanes.find(l => l.crewId === 'unassigned') as BoardLane;
    expect(un.cardsByDay['2026-06-02']).toHaveLength(1);
  });

  it('spans a multi-day job across each working day it covers', () => {
    const lanes = buildLanes(
      [job({ crewGroupId: 'c1', startDate: '2026-06-02T08:00:00', endDate: '2026-06-04T17:00:00' })],
      [crewA], weekDays, cfg,
    );
    const laneA = lanes.find(l => l.crewId === 'c1') as BoardLane;
    expect(Object.keys(laneA.cardsByDay).sort()).toEqual(['2026-06-02','2026-06-03','2026-06-04']);
  });
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `npm test -- productionBoard`
Expected: FAIL — `buildLanes` not exported.

- [ ] **Step 3: Implement `services/productionBoard.ts`**

```ts
import type { Job, CrewGroup } from '../types';
import { WorkingTimeConfig, occupiesWorkingDay, toLocalDateKey } from './scheduleEngine';

export interface BoardCard {
  jobId: string;
  jobName: string;
  jobNumber: string;
  color: string;
  startKey: string;        // local YYYY-MM-DD
  endKey: string;
  isLocked: boolean;
}

export interface BoardLane {
  crewId: string;          // CrewGroup id, or 'unassigned'
  crewName: string;
  /** day key -> cards present that day */
  cardsByDay: Record<string, BoardCard[]>;
}

const PALETTE = ['#06b6d4','#f97316','#ec4899','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];
export const jobColor = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

const laneIdForJob = (job: Job): string => {
  if (job.crewGroupId) return job.crewGroupId;
  const allocCrew = job.allocations?.[0]?.crewGroupId;
  if (allocCrew) return allocCrew;
  return 'unassigned';
};

export const buildLanes = (
  jobs: Job[],
  crews: CrewGroup[],
  weekDays: Date[],
  config: WorkingTimeConfig,
): BoardLane[] => {
  const dayKeys = weekDays.map(toLocalDateKey);
  const lanes = new Map<string, BoardLane>();
  const ensure = (crewId: string, crewName: string): BoardLane => {
    if (!lanes.has(crewId)) lanes.set(crewId, { crewId, crewName, cardsByDay: {} });
    return lanes.get(crewId)!;
  };

  // Seed a lane for every crew so empty lanes still render.
  crews.forEach(c => ensure(c.id, c.name));

  for (const job of jobs) {
    if (!job.startDate || job.stage === 'Completed' || job.stage === 'Marketing') continue;
    const laneId = laneIdForJob(job);
    const crewName = laneId === 'unassigned'
      ? 'Unassigned'
      : crews.find(c => c.id === laneId)?.name ?? 'Unassigned';
    const lane = ensure(laneId, crewName);

    const card: BoardCard = {
      jobId: job.id, jobName: job.name, jobNumber: job.jobNumber,
      color: jobColor(job.id),
      startKey: toLocalDateKey(new Date(job.startDate)),
      endKey: toLocalDateKey(new Date(job.endDate || job.startDate)),
      isLocked: !!job.is_locked,
    };
    for (const key of dayKeys) {
      if (occupiesWorkingDay(job.startDate, job.endDate, key, config)) {
        (lane.cardsByDay[key] ||= []).push(card);
      }
    }
  }

  // Stable order: crews first (input order), Unassigned last.
  return Array.from(lanes.values()).sort((a, b) => {
    if (a.crewId === 'unassigned') return 1;
    if (b.crewId === 'unassigned') return -1;
    return 0;
  });
};
```
> If `CrewGroup` has no `crewGroupId` on allocations, drop the `allocCrew` line — check `types.ts` `JobCrewAllocation`. The fallback to `'unassigned'` keeps it safe either way.

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm test -- productionBoard`
Expected: PASS, 3 passed.

- [ ] **Step 5: Commit**

```bash
git add services/productionBoard.ts services/productionBoard.test.ts
git commit -m "feat: buildLanes swimlane transform for production board"
```

---

## Task 3: Staging reducer + summary (TDD)

The single source of truth for the in-flight reschedule. Pure reducer; the hook in Task 4 wraps it.

**Files:**
- Create: `services/reschedulePreview.ts`
- Test: `services/reschedulePreview.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import {
  previewReducer, initialPreviewState, summarizeStaged, StagedReschedule,
} from './reschedulePreview';
import type { ProposedChange } from './scheduleEngine';

const change = (over: Partial<ProposedChange>): ProposedChange => ({
  jobId: 'j1', jobName: 'Job 1', jobNumber: 'J-1',
  oldStart: '2026-06-02T08:00:00', oldEnd: '2026-06-02T17:00:00',
  newStart: '2026-06-03T08:00:00', newEnd: '2026-06-03T17:00:00',
  ...over,
});

const staged = (changes: ProposedChange[]): StagedReschedule => ({
  changes, label: 'Test', commit: () => {},
});

describe('previewReducer', () => {
  it('STAGE stores the staged reschedule', () => {
    const s = previewReducer(initialPreviewState, { type: 'STAGE', payload: staged([change({})]) });
    expect(s.staged?.changes).toHaveLength(1);
  });
  it('CLEAR removes it', () => {
    const s1 = previewReducer(initialPreviewState, { type: 'STAGE', payload: staged([change({})]) });
    const s2 = previewReducer(s1, { type: 'CLEAR' });
    expect(s2.staged).toBeNull();
  });
});

describe('summarizeStaged', () => {
  it('counts changed vs skipped rows', () => {
    const sum = summarizeStaged([change({}), change({ jobId: 'j2', skipped: 'locked' })]);
    expect(sum).toEqual({ changedCount: 1, skippedCount: 1 });
  });
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `npm test -- reschedulePreview`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `services/reschedulePreview.ts`**

```ts
import type { ProposedChange } from './scheduleEngine';

export interface StagedReschedule {
  /** Proposed changes to preview (includes skipped/informational rows). */
  changes: ProposedChange[];
  /** Human label, reused as the undo/toast label on commit. */
  label: string;
  /** Performs the actual commit + side effects (calls App.handleApplySchedule). */
  commit: () => void;
}

export interface PreviewState {
  staged: StagedReschedule | null;
}

export type PreviewAction =
  | { type: 'STAGE'; payload: StagedReschedule }
  | { type: 'CLEAR' };

export const initialPreviewState: PreviewState = { staged: null };

export const previewReducer = (state: PreviewState, action: PreviewAction): PreviewState => {
  switch (action.type) {
    case 'STAGE': return { staged: action.payload };
    case 'CLEAR': return { staged: null };
    default: return state;
  }
};

export const summarizeStaged = (changes: ProposedChange[]) => ({
  changedCount: changes.filter(c => !c.skipped).length,
  skippedCount: changes.filter(c => c.skipped).length,
});
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npm test -- reschedulePreview`
Expected: PASS, 3 passed.

- [ ] **Step 5: Commit**

```bash
git add services/reschedulePreview.ts services/reschedulePreview.test.ts
git commit -m "feat: reschedule preview staging reducer"
```

---

## Task 4: `useReschedulePreview` hook

Thin wrapper so components share one staging store.

**Files:**
- Create: `components/views/JobScheduling/useReschedulePreview.ts`

- [ ] **Step 1: Implement the hook**

```ts
import { useReducer, useCallback } from 'react';
import {
  previewReducer, initialPreviewState, StagedReschedule, summarizeStaged,
} from '../../../services/reschedulePreview';

export const useReschedulePreview = () => {
  const [state, dispatch] = useReducer(previewReducer, initialPreviewState);

  const stage = useCallback((payload: StagedReschedule) => {
    dispatch({ type: 'STAGE', payload });
  }, []);
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  return {
    staged: state.staged,
    isPreviewing: state.staged !== null,
    summary: state.staged ? summarizeStaged(state.staged.changes) : null,
    stage,
    clear,
  };
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: no errors referencing this file.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobScheduling/useReschedulePreview.ts
git commit -m "feat: useReschedulePreview hook"
```

---

## Task 5: `JobCard` component (draggable)

**Files:**
- Create: `components/views/JobScheduling/JobCard.tsx`

- [ ] **Step 1: Implement `JobCard.tsx`**

```tsx
import React from 'react';
import { Lock } from 'lucide-react';
import { BoardCard } from '../../../services/productionBoard';

interface JobCardProps {
  card: BoardCard;
  draggable: boolean;
  onDragStart: (jobId: string) => void;
  onClick?: (jobId: string) => void;
}

export const JobCard = ({ card, draggable, onDragStart, onClick }: JobCardProps) => (
  <div
    draggable={draggable && !card.isLocked}
    onDragStart={(e) => { e.dataTransfer.setData('text/jobId', card.jobId); onDragStart(card.jobId); }}
    onClick={() => onClick?.(card.jobId)}
    className="text-white text-xs font-bold px-2 py-1.5 rounded-lg shadow-sm cursor-pointer truncate flex items-center gap-1"
    style={{ backgroundColor: card.color, opacity: card.isLocked ? 0.7 : 1 }}
    title={`${card.jobName} (${card.jobNumber})`}
  >
    {card.isLocked && <Lock className="w-3 h-3 shrink-0" />}
    <span className="truncate">{card.jobName}</span>
  </div>
);
```
> Locked cards are not draggable, mirroring the engine's lock semantics.

- [ ] **Step 2: Verify compile + commit**

```bash
npm run lint
git add components/views/JobScheduling/JobCard.tsx
git commit -m "feat: draggable JobCard"
```

---

## Task 6: `ProductionBoard` component (swimlanes + drop targets)

**Files:**
- Create: `components/views/JobScheduling/ProductionBoard.tsx`

- [ ] **Step 1: Implement `ProductionBoard.tsx`**

Renders `buildLanes` output as a grid: first column = crew name, one column per `weekDays`. Empty cells are drop targets; dropping calls `onDropJob(jobId, dayKey)`.

```tsx
import React, { useMemo, useState } from 'react';
import { Job, CrewGroup } from '../../../types';
import { WorkingTimeConfig, toLocalDateKey } from '../../../services/scheduleEngine';
import { buildLanes } from '../../../services/productionBoard';
import { JobCard } from './JobCard';

interface ProductionBoardProps {
  jobs: Job[];
  crews: CrewGroup[];
  weekDays: Date[];
  config: WorkingTimeConfig;
  canReschedule: boolean;
  onDropJob: (jobId: string, dayKey: string) => void;
  onViewJob?: (jobId: string) => void;
}

export const ProductionBoard = ({
  jobs, crews, weekDays, config, canReschedule, onDropJob, onViewJob,
}: ProductionBoardProps) => {
  const lanes = useMemo(() => buildLanes(jobs, crews, weekDays, config), [jobs, crews, weekDays, config]);
  const [dragJobId, setDragJobId] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<string | null>(null);
  const dayKeys = weekDays.map(toLocalDateKey);

  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800">
      <div
        className="grid min-w-[1000px]"
        style={{ gridTemplateColumns: `160px repeat(${weekDays.length}, 1fr)` }}
      >
        {/* Header row */}
        <div className="p-3 text-xs font-black uppercase tracking-widest text-gray-400 border-b border-r border-gray-100 dark:border-gray-700">Crew</div>
        {weekDays.map(d => (
          <div key={d.toISOString()} className="p-3 text-center border-b border-l border-gray-100 dark:border-gray-700">
            <div className="text-[10px] font-bold text-gray-400 uppercase">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
            <div className="text-lg font-black text-gray-900 dark:text-white">{d.getDate()}</div>
          </div>
        ))}

        {/* Lanes */}
        {lanes.map(lane => (
          <React.Fragment key={lane.crewId}>
            <div className="p-3 font-bold text-sm text-gray-700 dark:text-gray-200 border-b border-r border-gray-100 dark:border-gray-700 sticky left-0 bg-white dark:bg-gray-800 z-10">
              {lane.crewName}
            </div>
            {dayKeys.map(key => {
              const cellId = `${lane.crewId}:${key}`;
              return (
                <div
                  key={cellId}
                  onDragOver={(e) => { if (canReschedule) { e.preventDefault(); setHoverCell(cellId); } }}
                  onDragLeave={() => setHoverCell(c => (c === cellId ? null : c))}
                  onDrop={(e) => {
                    if (!canReschedule) return;
                    e.preventDefault();
                    const jobId = e.dataTransfer.getData('text/jobId') || dragJobId;
                    setHoverCell(null); setDragJobId(null);
                    if (jobId) onDropJob(jobId, key);
                  }}
                  className={`min-h-[64px] p-1.5 space-y-1 border-b border-l border-gray-100 dark:border-gray-800 ${hoverCell === cellId ? 'bg-primary-50 dark:bg-primary-900/30' : ''}`}
                >
                  {(lane.cardsByDay[key] || []).map(card => (
                    <JobCard
                      key={card.jobId}
                      card={card}
                      draggable={canReschedule}
                      onDragStart={setDragJobId}
                      onClick={onViewJob}
                    />
                  ))}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify compile + commit**

```bash
npm run lint
git add components/views/JobScheduling/ProductionBoard.tsx
git commit -m "feat: ProductionBoard swimlanes with drop targets"
```

---

## Task 7: `ReschedulePreviewPanel` component

Bottom dock showing the Preview Timeline + basic conflicts + Apply/Cancel.

**Files:**
- Create: `components/views/JobScheduling/ReschedulePreviewPanel.tsx`

- [ ] **Step 1: Implement `ReschedulePreviewPanel.tsx`**

```tsx
import React from 'react';
import { ArrowRight, AlertCircle, X } from 'lucide-react';
import { Button, Badge } from '../../UI';
import { StagedReschedule, summarizeStaged } from '../../../services/reschedulePreview';

interface ReschedulePreviewPanelProps {
  staged: StagedReschedule | null;
  /** Job ids that collide with a proposed change (from detectConflicts). */
  conflictJobIds: string[];
  onApply: () => void;
  onCancel: () => void;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export const ReschedulePreviewPanel = ({
  staged, conflictJobIds, onApply, onCancel,
}: ReschedulePreviewPanelProps) => {
  if (!staged) return null;
  const { changedCount, skippedCount } = summarizeStaged(staged.changes);
  const changed = staged.changes.filter(c => !c.skipped);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t-2 border-primary-500 shadow-2xl max-h-[40vh] overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-gray-900 dark:text-white">Reschedule Preview</h3>
            <Badge>{staged.label}</Badge>
            <span className="text-xs text-gray-500">{changedCount} changing{skippedCount ? ` · ${skippedCount} skipped` : ''}</span>
          </div>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        {conflictJobIds.length > 0 && (
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm mb-3">
            <AlertCircle className="w-4 h-4" /> {conflictJobIds.length} potential same-day conflict(s)
          </div>
        )}

        <div className="space-y-1 mb-4">
          {changed.map(c => (
            <div key={c.jobId} className="flex items-center gap-3 text-sm">
              <span className="font-bold text-gray-700 dark:text-gray-200 w-40 truncate">{c.jobName}</span>
              <span className="text-gray-400">{fmt(c.oldStart)}</span>
              <ArrowRight className="w-3 h-3 text-gray-400" />
              <span className="text-primary-600 dark:text-primary-400 font-medium">{fmt(c.newStart)}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={onApply} disabled={changedCount === 0}>Apply Changes</Button>
        </div>
      </div>
    </div>
  );
};
```
> Auto-Fix / Review Manually / Smart Suggestions are intentionally absent — Phases 2–3. `Badge` and `Button` come from `components/UI` (already used across the app).

- [ ] **Step 2: Verify compile + commit**

```bash
npm run lint
git add components/views/JobScheduling/ReschedulePreviewPanel.tsx
git commit -m "feat: ReschedulePreviewPanel (timeline + apply/cancel)"
```

---

## Task 8: Wire board + panel into `JobSchedulingView` (drag → stage → apply)

This replaces the "Assignments" tab body with the board and hosts the panel. Drag-drop is the first action wired in.

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`
- Modify: `App.tsx` (add props)

- [ ] **Step 1: Add the new props to `JobSchedulingViewProps`**

In `components/views/JobSchedulingView.tsx`, extend the interface (after `onUpdateJob`):
```ts
  onApplySchedule: (changes: ProposedChange[], label: string, extraUndo?: () => void) => void;
  settings: GlobalSettings;
  onUpdateSettings: (s: GlobalSettings) => void;
```
Add imports at the top:
```ts
import { GlobalSettings } from '../../types';
import { ProposedChange, configFromSettings, moveJobToSlot, detectConflicts, toLocalDateKey } from '../../services/scheduleEngine';
import { CURRENT_USER, canManageSchedule } from '../../constants';
import { ProductionBoard } from './JobScheduling/ProductionBoard';
import { ReschedulePreviewPanel } from './JobScheduling/ReschedulePreviewPanel';
import { useReschedulePreview } from './JobScheduling/useReschedulePreview';
```
> Confirm the exact exported names of `GlobalSettings`, `CURRENT_USER`, and `canManageSchedule` against `types.ts` / `constants.ts` (the Calendar imports them the same way — copy that import line).

- [ ] **Step 2: Add preview state + config inside the component**

Just after the existing `const [activeTab, ...]` line:
```ts
  const preview = useReschedulePreview();
  const workConfig = useMemo(() => configFromSettings(settings?.scheduling, false), [settings?.scheduling]);
  const canReschedule = canManageSchedule(CURRENT_USER.role);
```

- [ ] **Step 3: Add the drag-drop → stage handler**

```ts
  const referenceDate = new Date().toISOString();

  const handleDropJob = (jobId: string, dayKey: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job || job.is_locked) return;
    // Preserve duration: keep the job's day-span length, re-anchored to dayKey at workday start.
    const startISO = `${dayKey}T${String(workConfig.workDayStartHour).padStart(2, '0')}:00:00`;
    const durMs = job.startDate && job.endDate
      ? new Date(job.endDate).getTime() - new Date(job.startDate).getTime()
      : 0;
    const endISO = new Date(new Date(startISO).getTime() + durMs).toISOString();
    const change = moveJobToSlot(jobs, jobId, new Date(startISO).toISOString(), endISO);
    preview.stage({
      changes: [change],
      label: `Move ${job.name}`,
      commit: () => onApplySchedule([change], `Move ${job.name}`),
    });
    // Same-day conflicts are surfaced by the `conflictJobIds` memo below.
  };

  const conflictJobIds = useMemo(() => {
    if (!preview.staged) return [];
    return preview.staged.changes
      .filter(c => !c.skipped)
      .flatMap(c => detectConflicts(jobs, c.jobId, c.newStart, c.newEnd, workConfig));
  }, [preview.staged, jobs, workConfig]);
```

- [ ] **Step 4: Replace the "assignments" tab body with the board**

Find the `{activeTab === 'assignments' && ( ... )}` block (the `<Card>` with the member-hours `<table>`). Replace its inner content with:
```tsx
        {activeTab === 'assignments' && (
            <ProductionBoard
                jobs={jobs}
                crews={crews}
                weekDays={weekDays}
                config={workConfig}
                canReschedule={canReschedule}
                onDropJob={handleDropJob}
                onViewJob={(id) => onViewJob?.(id)}
            />
        )}
```
> Rename the tab label from "Assignments" to "Board" in the tab `<button>` (the `<Briefcase /> Assignments` button). Keep `activeTab` value `'assignments'` to avoid touching state typing, OR rename the union to `'board'` consistently — pick one and apply everywhere in the file.

- [ ] **Step 5: Render the panel at the end of the component's returned JSX**

Just before the final closing `</div>` of the component's return:
```tsx
        <ReschedulePreviewPanel
            staged={preview.staged}
            conflictJobIds={conflictJobIds}
            onApply={() => { preview.staged?.commit(); preview.clear(); }}
            onCancel={() => preview.clear()}
        />
```

- [ ] **Step 6: Pass the new props from `App.tsx`**

In `App.tsx`, the `case 'job_scheduling':` block, add to `<JobSchedulingView ...>`:
```tsx
                                onApplySchedule={handleApplySchedule}
                                settings={settings}
                                onUpdateSettings={setSettings}
```
> `settings` and `setSettings` already exist in `App.tsx` (passed to `SalesCalendarView`). `handleApplySchedule` is defined above.

- [ ] **Step 7: Verify + manual smoke test**

Run: `npm run lint` → no errors.
Run: `npm run dev`, open Job Scheduling → "Board" tab. Expected: crew swimlanes render; dragging a job card to another day opens the bottom Reschedule Preview panel with a timeline row; **Apply** commits (toast appears, card moves); **Cancel** discards (card snaps back).

- [ ] **Step 8: Commit**

```bash
git add components/views/JobSchedulingView.tsx App.tsx
git commit -m "feat: production board + preview panel in Job Scheduling (drag to reschedule)"
```

---

## Task 9: Relocate the rain-day action into the board

Rain day now **stages** (preview-first) instead of applying immediately.

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

- [ ] **Step 1: Add a "Mark Rain Day" control + handler**

Add a button near the date navigator (follow the existing button styling in the file). Handler:
```ts
  const handleMarkRainDay = (dateKey: string) => {
    if (!canReschedule) return;
    const cfgWithRain = configFromSettings(settings.scheduling, true);
    // Treat the marked day as non-working so jobs land on a real workday.
    const cfg = { ...cfgWithRain, holidays: [...cfgWithRain.holidays, dateKey] };
    const changes = shiftJobsFromPoint(jobs, `${dateKey}T00:00`, 1, 'days', cfg);
    const affected = changes.filter(c => !c.skipped).length;

    const existing = settings.scheduling?.rainDays || [];
    const alreadyMarked = existing.some(r => r.date === dateKey);
    const persist = () => {
      if (alreadyMarked) return;
      onUpdateSettings({
        ...settings,
        scheduling: {
          nonWorkingWeekdays: settings.scheduling?.nonWorkingWeekdays ?? [0, 6],
          holidays: settings.scheduling?.holidays ?? [],
          workDayStartHour: settings.scheduling?.workDayStartHour ?? 8,
          workDayEndHour: settings.scheduling?.workDayEndHour ?? 17,
          rainDays: [...existing, { date: dateKey, type: 'rain' }],
        },
      });
    };
    const undoPersist = () => onUpdateSettings(settings);

    preview.stage({
      changes,
      label: `Rain Day: ${affected} job${affected === 1 ? '' : 's'} shifted forward one workday`,
      commit: () => {
        persist();
        onApplySchedule(changes, `Rain Day: ${affected} job${affected === 1 ? '' : 's'} shifted forward one workday`, undoPersist);
      },
    });
  };
```
Add `shiftJobsFromPoint` to the `scheduleEngine` import line.
> This mirrors the old `SalesCalendarView.handleMarkRainDay` (lines 154–186) but stages instead of committing. Picking *which* date to mark: a simple approach for Phase 1 is a date input defaulting to today; a richer per-cell control comes later.

- [ ] **Step 2: Verify + manual test**

Run: `npm run lint`; `npm run dev`. Mark a rain day → panel previews the forward shift → Apply commits and the rain day persists (re-open: still marked); Undo via toast restores both jobs and the rain-day mark.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: rain-day reschedule (preview-first) in Job Scheduling"
```

---

## Task 10: Relocate bulk reschedule (inline-staging via repurposed dialog)

Keep the cascade config form, but its action **stages** into the panel instead of committing.

**Files:**
- Modify: `components/modals/CascadeRescheduleModal.tsx`
- Modify: `components/views/JobSchedulingView.tsx`

- [ ] **Step 1: Change the modal's `onApply` contract to "stage"**

`CascadeRescheduleModal` already computes `shiftJobsFromPoint` changes for its preview and calls `onApply(changes, label)`. No signature change is required — only the *caller* changes (Task 10 Step 2). Confirm the modal builds `changes` from its form and calls `onApply(changes, label)` exactly once on its Apply button. If it applies internally in any other way, route all paths through `onApply`.
> Net effect: the modal becomes a *config + compute* surface; commit happens later via the panel. This satisfies "retire the modal's commit role" without rewriting the scope-filter form in Phase 1.

- [ ] **Step 2: Host the dialog from `JobSchedulingView` and stage its result**

```ts
  const [isBulkOpen, setIsBulkOpen] = useState(false);
```
Render it (import `CascadeRescheduleModal`, and build the crew list it expects):
```tsx
        <CascadeRescheduleModal
            isOpen={isBulkOpen}
            onClose={() => setIsBulkOpen(false)}
            jobs={jobs}
            crew={allStaff}
            config={workConfig}
            onApply={(changes, label) => {
                preview.stage({ changes, label, commit: () => onApplySchedule(changes, label) });
                setIsBulkOpen(false);
            }}
        />
```
Add a "Bulk Reschedule" button (near the rain-day control) that calls `setIsBulkOpen(true)`.
> Confirm `CascadeRescheduleModal`'s prop names (`jobs`, `crew`, `config`, `initialFromDate?`, `onApply`) — they're defined at the top of that file. `allStaff` is the `CrewMember[]` it expects for the crew scope filter.

- [ ] **Step 3: Verify + manual test**

Run: `npm run lint`; `npm run dev`. Open Bulk Reschedule → configure from-date/amount/scope → Apply in the dialog → panel previews the cascade → Apply in the panel commits.

- [ ] **Step 4: Commit**

```bash
git add components/modals/CascadeRescheduleModal.tsx components/views/JobSchedulingView.tsx
git commit -m "feat: bulk reschedule stages into preview panel"
```

---

## Task 11: Relocate single-job move drawer (stages instead of commits)

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

- [ ] **Step 1: Host `SingleJobMoveDrawer` and stage its result**

```ts
  const [moveJob, setMoveJob] = useState<Job | null>(null);
```
Render:
```tsx
        <SingleJobMoveDrawer
            isOpen={!!moveJob}
            onClose={() => setMoveJob(null)}
            job={moveJob}
            jobs={jobs}
            config={workConfig}
            referenceDate={referenceDate}
            onApply={(changes, label) => {
                preview.stage({ changes, label, commit: () => onApplySchedule(changes, label) });
                setMoveJob(null);
            }}
        />
```
Import it: `import { SingleJobMoveDrawer } from '../drawers/SingleJobMoveDrawer';`. Trigger `setMoveJob(job)` from a card action (e.g. pass an `onMoveJob` down through `ProductionBoard`/`JobCard`, or open it from the job-detail click for Phase 1).
> `SingleJobMoveDrawer` already takes `onApply(changes, label)` — the drawer computes changes via `moveJobToEnd`/`moveJobToSlot` and never commits itself, so staging is a pure caller change.

- [ ] **Step 2: Verify + manual test**

Run: `npm run lint`; `npm run dev`. Open the move drawer for a job → choose end/slot → Apply → panel previews → Apply commits.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: single-job move stages into preview panel"
```

---

## Task 12: Remove reschedule tools from the Sales Calendar

The Calendar reverts to sales/booking; the rain-day **stripe stays read-only** (driven by persisted `rainDays`).

**Files:**
- Modify: `components/views/SalesCalendarView.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Delete reschedule state + handlers in `SalesCalendarView.tsx`**

Remove:
- Cascade state: `isCascadeOpen`, `cascadeFromDate`, `openCascade`, and the `<CascadeRescheduleModal .../>` render + its import.
- Single-move state: `moveJob`, `moveTab`, `isMoveOpen`, and the `<SingleJobMoveDrawer .../>` render + import.
- `handleMarkRainDay` and the context-menu items that call it / `openCascade` (the "Mark as Rain Day" and "Bulk reschedule from this day…" entries, ~lines 230–245).
- The "Bulk Reschedule" toolbar button (~line 1546) and the per-job Lock/Unlock reschedule affordances tied to cascade (keep job locking only if it's used elsewhere; otherwise remove the reschedule-only bits).

Keep: `rainDayMap` and the rain-day stripe rendering (it reads `settings.scheduling.rainDays`), and `settings` prop.

- [ ] **Step 2: Drop now-unused props from `SalesCalendarView`**

Remove `onApplySchedule` and `onUpdateSettings` from `SalesCalendarViewProps` and destructuring **if** nothing else uses them after Step 1. Keep `settings` (needed for the stripe). Update `configFromSettings` usage only if it was solely for cascades.

- [ ] **Step 3: Update `App.tsx` Calendar wiring**

In `case 'calendar':`, remove `onApplySchedule={handleApplySchedule}` and `onUpdateSettings={setSettings}` from `<SalesCalendarView>` (keep `settings={settings}`). Leave `onUpdateJob` if the Calendar still uses it for non-reschedule edits; otherwise remove.

- [ ] **Step 4: Verify**

Run: `npm run lint` → no unused-import / missing-prop errors.
Run: `npm run dev` → Calendar shows the rain stripe but has no rain-day/bulk/move actions; right-click does nothing reschedule-related. Job Scheduling has all the tools.

- [ ] **Step 5: Commit**

```bash
git add components/views/SalesCalendarView.tsx App.tsx
git commit -m "refactor: remove reschedule tools from Sales Calendar (moved to Job Scheduling)"
```

---

## Task 13: Add engine regression tests (spec §9) + final integration pass

**Files:**
- Create: `services/scheduleEngine.test.ts`

- [ ] **Step 1: Write tests for the functions the board relies on**

```ts
import { describe, it, expect } from 'vitest';
import { moveJobToSlot, shiftJobsFromPoint, configFromSettings } from './scheduleEngine';
import type { Job } from '../types';

const cfg = configFromSettings(undefined, true);
const j = (over: Partial<Job>): Job => ({
  id: 'j1', jobNumber: 'J-1', name: 'Job 1', stage: 'Scheduled',
  startDate: '2026-06-02T08:00:00', endDate: '2026-06-02T17:00:00', ...over,
} as Job);

describe('moveJobToSlot', () => {
  it('reanchors a job to the given slot and preserves the old dates', () => {
    const c = moveJobToSlot([j({})], 'j1', '2026-06-04T08:00:00', '2026-06-04T17:00:00');
    expect(c.oldStart).toBe('2026-06-02T08:00:00');
    expect(c.newStart).toBe('2026-06-04T08:00:00');
  });
});

describe('shiftJobsFromPoint', () => {
  it('marks locked jobs as skipped and shifts the rest forward', () => {
    const jobs = [j({}), j({ id: 'j2', jobNumber: 'J-2', is_locked: true })];
    const changes = shiftJobsFromPoint(jobs, '2026-06-02T00:00', 1, 'days', cfg);
    const locked = changes.find(c => c.jobId === 'j2');
    expect(locked?.skipped).toBe('locked');
    const moved = changes.find(c => c.jobId === 'j1');
    expect(moved?.skipped).toBeUndefined();
    expect(moved?.newStart).not.toBe(moved?.oldStart);
  });
});
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: all tests pass (productionBoard, reschedulePreview, scheduleEngine).

- [ ] **Step 3: Type-check the whole app**

Run: `npm run lint`
Expected: no TypeScript errors.

- [ ] **Step 4: Full manual regression checklist (dev server)**

Verify in `npm run dev`:
- [ ] Job Scheduling → Board: swimlanes per crew + Unassigned lane; week nav works.
- [ ] Drag a card → preview panel → Apply commits / Cancel discards.
- [ ] Locked card is not draggable.
- [ ] Rain Day → preview → Apply persists the rain day + shifts jobs; toast Undo restores both.
- [ ] Bulk Reschedule dialog → preview → Apply.
- [ ] Single-job move → preview → Apply.
- [ ] Availability tab unchanged.
- [ ] Sales Calendar: rain stripe still shows; no reschedule actions remain.

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.test.ts
git commit -m "test: engine regression tests for move + cascade"
```

---

## Done — Phase 1 complete

The board, preview-first rescheduling (drag / rain day / bulk / single move), and Calendar cleanup are shipped and tested. Phases 2 (Potential Issues + weather rail) and 3 (Smart Suggestions + Auto-Fix) get their own specs→plans, adding the `customerWindow`, `crewDailyCapacityHours`, and `mockWeather` data fields when first needed.
