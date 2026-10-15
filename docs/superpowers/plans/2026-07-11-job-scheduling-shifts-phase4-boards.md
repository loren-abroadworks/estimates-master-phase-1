# Job Scheduling Shifts — Phase 4 (Boards shift-aware) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the day board and week board render one bar/block per **(job, shift)** — each with its own dates, per-day window, label, and color — instead of one bar per job.

**Architecture:** A job's board bars are derived by a new pure helper `boardShifts(job)`: jobs with `allocations` yield one `BoardCard` per shift; legacy jobs (crew via `crewMemberIds`, no allocations) yield a single job-spanning card exactly as today. The lane builders (`buildMemberLanes`, `buildJobLanes`) and `layoutLaneBars` become shift-aware; `withDayWindows` resolves each card's per-day window from its shift; `DayBoard`/`ProductionBoard`/`JobCard` render the shift identity and thread `shiftId` through the day-board hours handlers.

**Tech Stack:** React 19 + TypeScript, Vitest + @testing-library/react. Typecheck with `npx tsc --noEmit`; run tests with `npx vitest run <file>`.

## Global Constraints

- **Preserve legacy behavior exactly.** A job with no `allocations` must render one bar per job, tinted by `jobColor(job.id)`, spanning the job envelope — identical to today. Every existing board test that uses allocation-free jobs must stay green untouched.
- **Date-only anchoring.** Shift dates (`alloc.startDate`/`endDate`) are bare `YYYY-MM-DD`. `new Date('YYYY-MM-DD')` parses as UTC midnight and drops a day in negative-offset zones. When feeding a shift date into `occupiesWorkingDay` (which calls `new Date(...)`), anchor at local noon: `` `${dateKey}T12:00:00` ``. Never pass a bare shift date into a `Date` constructor.
- **Scope of this phase = rendering only.** Dragging a bar still moves the **whole job** via the existing `onDropJob(jobId, day)` path (unchanged). Moving a single shift, the drag-assign shift picker, and cascade are **Phase 5** — do not build them here.
- **Job envelope recompute is already wired** (Phase 1 `recomputeJobEnvelope` + `services/shifts.ts` `syncCrew`). No envelope work in this phase.
- Commit convention footer on every commit:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## File Structure

- `services/productionBoard.ts` — `BoardCard` gains `shiftId`/`shiftName`; add `shiftCardHours` + `boardShifts`; `buildMemberLanes`/`buildJobLanes`/`layoutLaneBars` become shift-aware. (Tasks 1–3)
- `services/dayBoard.ts` — `withDayWindows` resolves each card's window from its shift. (Task 4)
- `components/views/JobScheduling/JobCard.tsx` — render shift name + window. (Task 5)
- `components/views/JobScheduling/DayBoard.tsx` — per-shift block keys/`data-shift-id`; shift label; thread `shiftId` through `blockHours`/`onEditBlockHours`/`onRemoveBlockHours`. (Task 6)
- `components/views/JobScheduling/ProductionBoard.tsx` — per-shift bar keys. (Task 7)
- `components/views/JobSchedulingView.tsx` — thread `shiftId` through the day-board hours handlers + `dayCellsFor`. (Task 8)
- Test files: `services/productionBoard.test.ts`, `services/dayBoard.test.ts`, `components/views/JobScheduling/JobCard.test.tsx` (create if absent), `DayBoard.test.tsx`, `ProductionBoard.test.tsx`.

---

## Task 1: `BoardCard` shift identity + `shiftCardHours` + `boardShifts` helper

**Files:**
- Modify: `services/productionBoard.ts`
- Test: `services/productionBoard.test.ts`

**Interfaces:**
- Consumes: `allocDayWindow(alloc, dateKey)` from `./scheduleEngine`; `JobCrewAllocation` from `../types`; existing `cardFor`, `memberIdsOf`, `jobColor`.
- Produces:
  - `interface BoardCard { …; shiftId?: string; shiftName?: string }`
  - `shiftCardHours(alloc: JobCrewAllocation): { startTime: string; endTime: string }`
  - `boardShifts(job: Job): { card: BoardCard; memberIds: string[] }[]`

- [ ] **Step 1: Write the failing test**

Add to `services/productionBoard.test.ts` (near the top-level `describe`s; the file already imports `job`, `staff`, `weekDays`, `cfg`). Add `boardShifts` and `shiftCardHours` to the existing import from `./productionBoard`:

```ts
describe('boardShifts', () => {
  it('yields one card per shift, tinted and spanned by the shift', () => {
    const j = job({
      id: 'j', name: 'Repaint', startDate: '2026-06-01T08:00:00', endDate: '2026-06-03T17:00:00',
      allocations: [
        { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-06-01', endDate: '2026-06-01', startTime: '08:00', endTime: '12:00', color: '#123456' },
        { id: 's2', name: 'Finish', memberIds: ['m1', 'm2'], startDate: '2026-06-02', endDate: '2026-06-03', startTime: '13:00', endTime: '17:00' },
      ],
    });
    const shifts = boardShifts(j);
    expect(shifts).toHaveLength(2);
    expect(shifts[0].card).toMatchObject({ shiftId: 's1', shiftName: 'Prep', color: '#123456', startKey: '2026-06-01', endKey: '2026-06-01', startTime: '08:00', endTime: '12:00' });
    expect(shifts[0].memberIds).toEqual(['m1']);
    expect(shifts[1].card).toMatchObject({ shiftId: 's2', shiftName: 'Finish', startKey: '2026-06-02', endKey: '2026-06-03', startTime: '13:00', endTime: '17:00' });
    expect(shifts[1].memberIds).toEqual(['m1', 'm2']);
  });

  it('falls back to a single job-spanning card with no shift identity for legacy jobs', () => {
    const j = job({ id: 'j', crewMemberIds: ['m1'], startDate: '2026-06-01T08:00:00', endDate: '2026-06-02T17:00:00' });
    const shifts = boardShifts(j);
    expect(shifts).toHaveLength(1);
    expect(shifts[0].card.shiftId).toBeUndefined();
    expect(shifts[0].card.shiftName).toBeUndefined();
    expect(shifts[0].memberIds).toEqual(['m1']);
  });

  it('skips shifts with no start date', () => {
    const j = job({ id: 'j', startDate: '2026-06-01T08:00:00', endDate: '2026-06-01T17:00:00',
      allocations: [{ id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '', endDate: '', startTime: '08:00', endTime: '12:00' }] });
    expect(boardShifts(j)).toHaveLength(0);
  });
});

describe('shiftCardHours', () => {
  it('uses the shift start-day start and end-day end, honoring per-day overrides', () => {
    const alloc = { id: 's', name: 'x', memberIds: [], startDate: '2026-06-01', endDate: '2026-06-03',
      startTime: '08:00', endTime: '17:00', dailyHours: { '2026-06-03': { startTime: '09:00', endTime: '15:00' } } };
    expect(shiftCardHours(alloc)).toEqual({ startTime: '08:00', endTime: '15:00' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/productionBoard.test.ts -t "boardShifts|shiftCardHours"`
Expected: FAIL — `boardShifts`/`shiftCardHours` not exported.

- [ ] **Step 3: Write minimal implementation**

In `services/productionBoard.ts`:

Update the imports at the top:
```ts
import type { Job, CrewMember, JobCrewAllocation } from '../types';
import { WorkingTimeConfig, occupiesWorkingDay, toLocalDateKey, allocDayWindow } from './scheduleEngine';
```

Add `shiftId`/`shiftName` to the `BoardCard` interface (after `endTime`):
```ts
export interface BoardCard {
  jobId: string;
  jobName: string;
  jobNumber: string;
  color: string;
  startKey: string;        // local YYYY-MM-DD
  endKey: string;
  isLocked: boolean;
  startTime: string;       // HH:mm — first working day's start
  endTime: string;         // HH:mm — last working day's end
  shiftId?: string;        // present when this bar is one shift of a multi-shift job
  shiftName?: string;
}
```

Add the two helpers just below `cardFor` (which stays as-is):
```ts
/** Start/end clock for a shift's board bar: its start-day start → end-day end,
 *  honoring per-day window overrides. */
export const shiftCardHours = (alloc: JobCrewAllocation): { startTime: string; endTime: string } => ({
  startTime: allocDayWindow(alloc, alloc.startDate).startTime,
  endTime: allocDayWindow(alloc, alloc.endDate).endTime,
});

/** The board bars for a job, one per shift, each paired with the members that shift
 *  covers (for member-lane placement). Jobs with `allocations` yield one card per
 *  dated shift (tinted by shift color, spanning the shift's own dates); legacy jobs
 *  (crew via `crewMemberIds`, no allocations) yield a single job-spanning card with
 *  no shift identity — unchanged from before shifts. */
export const boardShifts = (job: Job): { card: BoardCard; memberIds: string[] }[] => {
  if (job.allocations?.length) {
    return job.allocations
      .filter(a => a.startDate)
      .map(alloc => ({
        card: {
          jobId: job.id, jobName: job.name, jobNumber: job.jobNumber,
          color: alloc.color ?? jobColor(job.id),
          startKey: alloc.startDate,
          endKey: alloc.endDate || alloc.startDate,
          isLocked: !!job.is_locked,
          shiftId: alloc.id, shiftName: alloc.name,
          ...shiftCardHours(alloc),
        },
        memberIds: alloc.memberIds ?? [],
      }));
  }
  return [{ card: cardFor(job), memberIds: memberIdsOf(job) }];
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/productionBoard.test.ts -t "boardShifts|shiftCardHours"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/productionBoard.ts services/productionBoard.test.ts
git commit -m "feat(scheduling): boardShifts helper — one BoardCard per shift

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Lane builders iterate shifts

**Files:**
- Modify: `services/productionBoard.ts` (`buildMemberLanes`, `buildJobLanes`; add private `cardOccupies`)
- Test: `services/productionBoard.test.ts`

**Interfaces:**
- Consumes: `boardShifts` (Task 1), `occupiesWorkingDay`, `schedulable`, `ensure`.
- Produces: unchanged public signatures for `buildMemberLanes(jobs, staff, weekDays, config)` and `buildJobLanes(jobs, weekDays, config)`; a job's shifts now appear as separate cards in `cardsByDay`, and a member lane only receives the shifts that member is in.

- [ ] **Step 1: Write the failing test**

Add to `services/productionBoard.test.ts`:

```ts
describe('shift-aware lanes', () => {
  const multiShift = job({
    id: 'j', name: 'Repaint',
    startDate: '2026-06-01T08:00:00', endDate: '2026-06-02T17:00:00',
    allocations: [
      { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-06-01', endDate: '2026-06-01', startTime: '08:00', endTime: '12:00' },
      { id: 's2', name: 'Finish', memberIds: ['m2'], startDate: '2026-06-02', endDate: '2026-06-02', startTime: '13:00', endTime: '17:00' },
    ],
  });

  it('places each shift only in the lanes of its own members (member view)', () => {
    const lanes = buildMemberLanes([multiShift], staff, weekDays, cfg);
    const m1 = lanes.find(l => l.crewId === 'm1')!;
    const m2 = lanes.find(l => l.crewId === 'm2')!;
    expect(m1.cardsByDay['2026-06-01']?.map(c => c.shiftId)).toEqual(['s1']);
    expect(m1.cardsByDay['2026-06-02']).toBeUndefined(); // m1 not in the Finish shift
    expect(m2.cardsByDay['2026-06-02']?.map(c => c.shiftId)).toEqual(['s2']);
  });

  it('emits one card per shift on the job lane (job view)', () => {
    const [lane] = buildJobLanes([multiShift], weekDays, cfg);
    expect(lane.cardsByDay['2026-06-01'].map(c => c.shiftId)).toEqual(['s1']);
    expect(lane.cardsByDay['2026-06-02'].map(c => c.shiftId)).toEqual(['s2']);
  });
});
```

(`staff` must include members `m1` and `m2`. Check the test file's `staff` fixture; if it lacks them, extend it — e.g. `const staff = [{ id: 'm1', name: 'Ann', role: 'Painter' }, { id: 'm2', name: 'Bob', role: 'Painter' }] as any` — matching the shape already used by existing `buildMemberLanes` tests.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/productionBoard.test.ts -t "shift-aware lanes"`
Expected: FAIL — cards have no `shiftId`, or `m1` wrongly holds the Finish shift.

- [ ] **Step 3: Write minimal implementation**

In `services/productionBoard.ts`, add a private per-card occupancy helper (below `cardFor`/`boardShifts`):
```ts
// A card occupies a day when the day falls in the card's span and is a working day.
// Card date keys are bare YYYY-MM-DD; anchor at local noon so the Date parse used by
// occupiesWorkingDay doesn't drop a day in negative-offset timezones.
const cardOccupies = (card: BoardCard, dayKey: string, config: WorkingTimeConfig): boolean =>
  occupiesWorkingDay(`${card.startKey}T12:00:00`, `${card.endKey}T12:00:00`, dayKey, config);
```

Rewrite the `for (const job of jobs)` loop in `buildMemberLanes`:
```ts
  for (const job of jobs) {
    if (!schedulable(job)) continue;
    for (const { card, memberIds } of boardShifts(job)) {
      const known = memberIds.filter(id => byId.has(id));
      for (const target of known) {
        const member = byId.get(target)!;
        const lane = ensure(target, member.name, member.status === 'Inactive');
        for (const key of dayKeys) {
          if (cardOccupies(card, key, config)) (lane.cardsByDay[key] ||= []).push(card);
        }
      }
    }
  }
```

Rewrite the `for (const job of jobs)` loop in `buildJobLanes`:
```ts
  for (const job of jobs) {
    if (!schedulable(job)) continue;
    const cardsByDay: Record<string, BoardCard[]> = {};
    for (const { card } of boardShifts(job)) {
      for (const key of dayKeys) {
        if (cardOccupies(card, key, config)) (cardsByDay[key] ||= []).push(card);
      }
    }
    if (Object.keys(cardsByDay).length === 0) continue; // not in this week
    lanes.push({ crewId: job.id, crewName: job.name, cardsByDay });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/productionBoard.test.ts`
Expected: PASS — new tests pass AND all existing `buildMemberLanes`/`buildJobLanes` tests (allocation-free jobs → single legacy card) stay green.

- [ ] **Step 5: Commit**

```bash
git add services/productionBoard.ts services/productionBoard.test.ts
git commit -m "feat(scheduling): lane builders emit one card per shift

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `layoutLaneBars` keys by (jobId, shiftId)

**Files:**
- Modify: `services/productionBoard.ts` (`layoutLaneBars`)
- Test: `services/productionBoard.test.ts`

**Interfaces:**
- Produces: `layoutLaneBars(lane, dayKeys)` unchanged signature; two shifts of the same job now become two separate bars (stacked when they overlap) instead of collapsing into one.

- [ ] **Step 1: Write the failing test**

Add to the `describe('layoutLaneBars', …)` block in `services/productionBoard.test.ts` (extend the local `lane(...)` helper to accept `shiftId`):

```ts
  it('keeps two shifts of the same job as separate bars', () => {
    const l = {
      crewId: 'L', crewName: 'L', cardsByDay: {
        '2026-06-01': [{ jobId: 'a', jobName: 'A', jobNumber: 'n', color: '#000', startKey: '2026-06-01', endKey: '2026-06-01', isLocked: false, shiftId: 's1', shiftName: 'Prep', startTime: '08:00', endTime: '12:00' }],
        '2026-06-02': [{ jobId: 'a', jobName: 'A', jobNumber: 'n', color: '#000', startKey: '2026-06-02', endKey: '2026-06-02', isLocked: false, shiftId: 's2', shiftName: 'Finish', startTime: '13:00', endTime: '17:00' }],
      },
    } as any;
    const { bars } = layoutLaneBars(l, keys);
    expect(bars).toHaveLength(2);
    expect(bars.map(b => b.card.shiftId).sort()).toEqual(['s1', 's2']);
  });

  it('stacks two overlapping shifts of the same job on separate tracks', () => {
    const l = {
      crewId: 'L', crewName: 'L', cardsByDay: {
        '2026-06-01': [
          { jobId: 'a', jobName: 'A', jobNumber: 'n', color: '#000', startKey: '2026-06-01', endKey: '2026-06-01', isLocked: false, shiftId: 's1', shiftName: 'Prep', startTime: '08:00', endTime: '12:00' },
          { jobId: 'a', jobName: 'A', jobNumber: 'n', color: '#000', startKey: '2026-06-01', endKey: '2026-06-01', isLocked: false, shiftId: 's2', shiftName: 'Finish', startTime: '13:00', endTime: '17:00' },
        ],
      },
    } as any;
    expect(layoutLaneBars(l, keys).trackCount).toBe(2);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/productionBoard.test.ts -t "layoutLaneBars"`
Expected: FAIL — same-job shifts collapse into one bar (keyed by `jobId`).

- [ ] **Step 3: Write minimal implementation**

In `layoutLaneBars`, change the `cols` map to key by job **and** shift, and add a shift-name tiebreak to the sort:
```ts
  const cols = new Map<string, { card: BoardCard; idxs: number[] }>();
  dayKeys.forEach((key, i) => {
    for (const card of lane.cardsByDay[key] || []) {
      const barKey = `${card.jobId}::${card.shiftId ?? ''}`;
      const entry = cols.get(barKey) ?? { card, idxs: [] };
      entry.idxs.push(i);
      cols.set(barKey, entry);
    }
  });
```
And the sort:
```ts
  bars.sort((a, b) =>
    a.startCol - b.startCol
    || a.card.jobName.localeCompare(b.card.jobName)
    || (a.card.shiftName ?? '').localeCompare(b.card.shiftName ?? ''));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/productionBoard.test.ts`
Expected: PASS — new tests pass AND existing `layoutLaneBars` tests (cards without `shiftId` → key `jobId::`) stay green.

- [ ] **Step 5: Commit**

```bash
git add services/productionBoard.ts services/productionBoard.test.ts
git commit -m "feat(scheduling): layoutLaneBars keys bars by (jobId, shiftId)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `withDayWindows` resolves each card's shift window

**Files:**
- Modify: `services/dayBoard.ts` (`withDayWindows`)
- Test: `services/dayBoard.test.ts`

**Interfaces:**
- Consumes: `allocDayWindow` from `./scheduleEngine`; `jobDayWindow` (already imported).
- Produces: `withDayWindows(lanes, jobs)` unchanged signature; a shift card's per-day clock now comes from its shift's `dailyHours[day] ?? shift default`, not the job window.

- [ ] **Step 1: Write the failing test**

Add to `services/dayBoard.test.ts` (follow the file's existing import/fixture style):

```ts
describe('withDayWindows (shift-aware)', () => {
  it('resolves a shift card to its own per-day window', () => {
    const j = {
      id: 'j', name: 'Repaint', jobNumber: 'J-1', stage: 'Scheduled', clientId: 'c1',
      startDate: '2026-06-10T08:00:00', endDate: '2026-06-10T17:00:00',
      allocations: [{ id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-06-10', endDate: '2026-06-10',
        startTime: '08:00', endTime: '12:00', dailyHours: { '2026-06-10': { startTime: '09:00', endTime: '11:30' } } }],
    } as any;
    const lanes = [{ crewId: 'm1', crewName: 'Ann', cardsByDay: {
      '2026-06-10': [{ jobId: 'j', jobName: 'Repaint', jobNumber: 'J-1', color: '#000', startKey: '2026-06-10', endKey: '2026-06-10', isLocked: false, shiftId: 's1', shiftName: 'Prep', startTime: '08:00', endTime: '12:00' }],
    } }] as any;
    const out = withDayWindows(lanes, [j]);
    expect(out[0].cardsByDay['2026-06-10'][0]).toMatchObject({ startTime: '09:00', endTime: '11:30' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/dayBoard.test.ts -t "shift-aware"`
Expected: FAIL — the card keeps `08:00–12:00` (job window path ignores the shift's `dailyHours`).

- [ ] **Step 3: Write minimal implementation**

In `services/dayBoard.ts`, add the import:
```ts
import { allocDayWindow } from './scheduleEngine';
```
Rewrite the per-card mapping inside `withDayWindows`:
```ts
        cards.map(card => {
          const job = byId.get(card.jobId);
          if (!job) return card;
          const alloc = card.shiftId ? job.allocations?.find(a => a.id === card.shiftId) : undefined;
          const win = alloc ? allocDayWindow(alloc, key) : jobDayWindow(job, key);
          return win ? { ...card, startTime: win.startTime, endTime: win.endTime } : card;
        }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/dayBoard.test.ts`
Expected: PASS — new test passes and existing `withDayWindows` tests (legacy cards, no `shiftId`) stay green.

- [ ] **Step 5: Commit**

```bash
git add services/dayBoard.ts services/dayBoard.test.ts
git commit -m "feat(scheduling): day board resolves per-shift day windows

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `JobCard` shows the shift name

**Files:**
- Modify: `components/views/JobScheduling/JobCard.tsx`
- Test: `components/views/JobScheduling/JobCard.test.tsx` (create if it does not exist)

**Interfaces:**
- Consumes: `BoardCard` (now carries `shiftName`).
- Produces: when `card.shiftName` is set, the bar shows the shift name prefixed on its time line and in its `title`; single-shift/legacy cards look unchanged.

- [ ] **Step 1: Write the failing test**

Create/append `components/views/JobScheduling/JobCard.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JobCard } from './JobCard';
import type { BoardCard } from '../../../services/productionBoard';

const card = (over: Partial<BoardCard> = {}): BoardCard => ({
  jobId: 'j', jobName: 'Repaint', jobNumber: 'J-1', color: '#123456',
  startKey: '2026-06-01', endKey: '2026-06-01', isLocked: false,
  startTime: '08:00', endTime: '12:00', ...over,
});

describe('JobCard shift label', () => {
  it('shows the shift name when present', () => {
    render(<JobCard card={card({ shiftName: 'Prep' })} draggable={false} onPointerDownDrag={vi.fn()} />);
    expect(screen.getByText(/Prep/)).toBeInTheDocument();
  });

  it('omits a shift prefix for a legacy card', () => {
    render(<JobCard card={card()} draggable={false} onPointerDownDrag={vi.fn()} />);
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/JobCard.test.tsx`
Expected: FAIL — no `Prep` text rendered.

- [ ] **Step 3: Write minimal implementation**

In `JobCard.tsx`, update the time line and the `title`:
```tsx
      title={`${card.jobName} (${card.jobNumber})${card.shiftName ? ` · ${card.shiftName}` : ''} · ${fmtTime(card.startTime)} – ${fmtTime(card.endTime)}${titleSuffix}`}
```
```tsx
      <span className="text-[10px] font-semibold opacity-80 leading-tight truncate pr-6">
        {card.shiftName ? `${card.shiftName} · ` : ''}{fmtTime(card.startTime)} – {fmtTime(card.endTime)}
      </span>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/JobCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/JobCard.tsx components/views/JobScheduling/JobCard.test.tsx
git commit -m "feat(scheduling): JobCard shows shift name on the bar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `DayBoard` renders per-shift blocks and threads `shiftId`

**Files:**
- Modify: `components/views/JobScheduling/DayBoard.tsx`
- Test: `components/views/JobScheduling/DayBoard.test.tsx`

**Interfaces:**
- Produces (widened `DayBoardProps`):
  - `blockHours?: (laneId: string, jobId: string, shiftId?: string) => { hours: number; editable: boolean } | null`
  - `onEditBlockHours?: (laneId: string, jobId: string, hours: number, shiftId?: string) => void`
  - `onRemoveBlockHours?: (laneId: string, jobId: string, shiftId?: string) => void`
  - Each block carries `data-shift-id` and its React key includes the shift id; a shift block shows the shift name on its time line.

- [ ] **Step 1: Write the failing test**

Add to `components/views/JobScheduling/DayBoard.test.tsx`:

```tsx
describe('DayBoard shift-aware blocks', () => {
  const twoShiftJob = job({
    allocations: [
      { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-06-10', endDate: '2026-06-10', startTime: '08:00', endTime: '12:00' },
      { id: 's2', name: 'Finish', memberIds: ['m1'], startDate: '2026-06-10', endDate: '2026-06-10', startTime: '13:00', endTime: '17:00' },
    ],
  });

  it('renders one block per shift with a shift id', () => {
    const { container } = render(<DayBoard {...base} lanes={lanesFor([twoShiftJob])} />);
    expect(container.querySelector('[data-shift-id="s1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-shift-id="s2"]')).toBeInTheDocument();
  });

  it('passes the shift id to blockHours', () => {
    const blockHours = vi.fn(() => ({ hours: 4, editable: true }));
    render(<DayBoard {...base} lanes={lanesFor([twoShiftJob])} blockHours={blockHours} onEditBlockHours={vi.fn()} onRemoveBlockHours={vi.fn()} />);
    expect(blockHours).toHaveBeenCalledWith('j1', 'j1', 's1');
    expect(blockHours).toHaveBeenCalledWith('j1', 'j1', 's2');
  });
});
```

(Job-view `buildJobLanes` gives `crewId === job.id === 'j1'`; that is the `laneId`. The `job()` fixture already sets `id: 'j1'`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/DayBoard.test.tsx -t "shift-aware"`
Expected: FAIL — no `data-shift-id`; `blockHours` called with 2 args.

- [ ] **Step 3: Write minimal implementation**

In `DayBoard.tsx`:

Widen the three prop types in `DayBoardProps`:
```ts
  blockHours?: (laneId: string, jobId: string, shiftId?: string) => { hours: number; editable: boolean } | null;
  onEditBlockHours?: (laneId: string, jobId: string, hours: number, shiftId?: string) => void;
  onRemoveBlockHours?: (laneId: string, jobId: string, shiftId?: string) => void;
```

In the block render, resolve hours with the shift id:
```ts
              const hrs = blockHours?.(row.laneId, block.card.jobId, block.card.shiftId) ?? null;
```

Update the segment element — add `data-shift-id`, include the shift in the key, and prefix the shift name on the time line, and pass the shift id in the edit/remove callbacks:
```tsx
              return segments.map((seg, i) => (
                <div
                  key={`${block.card.jobId}:${block.card.shiftId ?? ''}-${i}`}
                  data-job-id={block.card.jobId}
                  data-shift-id={block.card.shiftId ?? ''}
                  data-draggable={draggable ? 'true' : 'false'}
                  onPointerDown={onPointerDown}
                  onClick={() => { if (!dragRef.current) onViewJob?.(block.card.jobId); }}
                  className={`absolute p-px ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                  style={{ top: `${seg.topPct}%`, height: `${seg.heightPct}%`, left: `${block.leftPct}%`, width: `${block.widthPct}%`, zIndex: 5 + block.zIndex }}
                >
                  <div
                    className={`h-full w-full rounded-lg pl-2.5 pr-2 py-1 shadow-sm overflow-hidden text-white ${block.clamped ? 'ring-2 ring-inset ring-primary-400/40' : ''}`}
                    style={{ backgroundColor: block.card.color }}
                  >
                    <div className="text-xs font-bold truncate leading-tight">{block.card.jobName}</div>
                    {i === 0 && (
                      <div className="flex items-center gap-1 text-[10px] font-medium text-white/80">
                        <span className="truncate">{block.card.shiftName ? `${block.card.shiftName} · ` : ''}{fmtClock(block.startTime)} – {fmtClock(block.endTime)}</span>
                        {hrs && (
                          hrs.editable && onEditBlockHours ? (
                            <span className="ml-auto flex items-center gap-0.5 shrink-0">
                              <TimelineHoursField
                                hours={hrs.hours}
                                label={t('views.JobScheduling.DayBoard.hoursAriaLabel', { jobName: block.card.jobName })}
                                onCommit={(h) => onEditBlockHours(row.laneId, block.card.jobId, h, block.card.shiftId)}
                                onRemove={() => onRemoveBlockHours?.(row.laneId, block.card.jobId, block.card.shiftId)}
                              />
                              <span>{t('views.JobScheduling.DayBoard.hoursUnit')}</span>
                            </span>
                          ) : (
                            <span className="ml-auto shrink-0 font-bold text-white">{hrs.hours}h</span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/DayBoard.test.tsx`
Expected: PASS — new tests pass and existing DayBoard tests (`data-job-id="j1"`, drag guards, etc.) stay green.

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/DayBoard.tsx components/views/JobScheduling/DayBoard.test.tsx
git commit -m "feat(scheduling): day board renders per-shift blocks

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: `ProductionBoard` week-board per-shift bar keys

**Files:**
- Modify: `components/views/JobScheduling/ProductionBoard.tsx`
- Test: `components/views/JobScheduling/ProductionBoard.test.tsx`

**Interfaces:**
- Produces: each spanning bar's React key includes the shift id so same-job shifts render as distinct bars; the bar body (`JobCard`) already shows the shift name from Task 5. Drag still calls `onDropJob(jobId, day)` — whole-job move, unchanged.

- [ ] **Step 1: Write the failing test**

Add to `components/views/JobScheduling/ProductionBoard.test.tsx` (match the file's existing render/fixture helpers; build lanes with `buildJobLanes` over a two-shift job so the job lane holds two shift cards):

```tsx
it('renders one bar per shift for a multi-shift job (job view)', () => {
  const j = job({
    id: 'j', name: 'Repaint',
    startDate: '2026-06-01T08:00:00', endDate: '2026-06-02T17:00:00',
    allocations: [
      { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-06-01', endDate: '2026-06-01', startTime: '08:00', endTime: '12:00' },
      { id: 's2', name: 'Finish', memberIds: ['m2'], startDate: '2026-06-02', endDate: '2026-06-02', startTime: '13:00', endTime: '17:00' },
    ],
  });
  const lanes = buildJobLanes([j], weekDays, cfg);
  render(<ProductionBoard {...base} lanes={lanes} />);
  expect(screen.getByText('Prep', { exact: false })).toBeInTheDocument();
  expect(screen.getByText('Finish', { exact: false })).toBeInTheDocument();
});
```

(Reuse the file's existing `job`, `weekDays`, `cfg`, `base`, and `buildJobLanes` import. If `buildJobLanes` is not yet imported in this test file, add it to the `./productionBoard`-style import.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/ProductionBoard.test.tsx -t "multi-shift"`
Expected: FAIL — React key collision means only one of the two same-job bars renders, so one of `Prep`/`Finish` is missing.

- [ ] **Step 3: Write minimal implementation**

In `ProductionBoard.tsx`, change the spanning-bar key:
```tsx
                  {bars.map(bar => (
                    <div
                      key={`${bar.card.jobId}:${bar.card.shiftId ?? ''}`}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/ProductionBoard.test.tsx`
Expected: PASS — new test passes and existing ProductionBoard tests stay green.

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/ProductionBoard.tsx components/views/JobScheduling/ProductionBoard.test.tsx
git commit -m "feat(scheduling): week board keys bars by shift

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Wire the view — thread `shiftId` through day-board hours

**Files:**
- Modify: `components/views/JobSchedulingView.tsx` (`dayCellsFor`, `dayBlockHours`, `handleEditBlockHours`, `handleRemoveBlockHours`)

**Interfaces:**
- Consumes: `handleHoursEditDay(memberId, dayKey, jobId, hours, shiftId?)` and `handleHoursRemoveDay(memberId, dayKey, jobId, shiftId?)` (Phase 3 — already take a trailing `shiftId`); the widened `DayBoard` callbacks from Task 6.
- Produces: the Day + Hours board edits/removes the specific shift's hours; nothing else changes.

- [ ] **Step 1: Update `dayCellsFor` and the three block-hours handlers**

In `JobSchedulingView.tsx`, replace lines ~903–920 with the shift-aware versions:
```ts
  // Day + Hours timeline: the selected day's hour cells for a (member, job, shift) block.
  const dayCellsFor = (memberId: string, jobId: string, shiftId?: string) => {
    const row = dayModel?.rows.find(r => r.memberId === memberId);
    return (row?.cellsByDay[selectedDayKey] ?? []).filter(c =>
      c.jobId === jobId && (shiftId === undefined || c.shiftId === shiftId));
  };
  // Assigned crew-hours shown on a timeline block; always inline-editable since each
  // (member, job, shift) block maps to a single cell.
  const dayBlockHours = (memberId: string, jobId: string, shiftId?: string) => {
    if (!dayModel) return null;
    const cells = dayCellsFor(memberId, jobId, shiftId);
    const hours = Math.round(cells.reduce((s, c) => s + c.hours, 0) * 10) / 10;
    return { hours, editable: true };
  };
  const handleEditBlockHours = (memberId: string, jobId: string, hours: number, shiftId?: string) => {
    handleHoursEditDay(memberId, selectedDayKey, jobId, hours, shiftId);
  };
  const handleRemoveBlockHours = (memberId: string, jobId: string, shiftId?: string) => {
    handleHoursRemoveDay(memberId, selectedDayKey, jobId, shiftId);
  };
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Confirms the widened `DayBoard` prop types and the `handleHoursEditDay`/`handleHoursRemoveDay` signatures line up.)

- [ ] **Step 3: Run the affected suites**

Run: `npx vitest run components/views/JobScheduling services/productionBoard.test.ts services/dayBoard.test.ts services/crewHoursGrid.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat(scheduling): day-board hours edit targets the shift

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Full verification & finish

- [ ] **Step 1: Typecheck + full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all suites pass.

- [ ] **Step 2: Runtime verification (verify skill)**

Temporarily seed a two-shift job in `data/mockData.ts` (e.g. give `job-2` two `allocations` — a morning "Prep" and an afternoon "Finish" on overlapping days), launch the app, log in, open **Job Scheduling**, and confirm on the **running app**:
- **Week board, Job view:** the two-shift job shows two stacked bars labeled `Prep` / `Finish`, each with its own window; single-shift/legacy jobs still show one bar.
- **Week board, Crew view:** each member sees only the shift(s) they're in.
- **Day + Board / Day + Hours:** two blocks for that job on a shared day, each with its shift name and window; editing hours on one block changes only that shift.

Capture a screenshot of the week board. Then `git checkout -- data/mockData.ts` to revert the seed.

- [ ] **Step 3: Finish the branch**

REQUIRED SUB-SKILL: Use superpowers:finishing-a-development-branch. Verify tests pass, then present the merge/PR/keep/discard options and execute the user's choice.

---

## Self-Review

- **Spec coverage (§4 Board rendering):** `BoardCard` shift identity (Task 1) ✓; lane builders iterate shifts (Task 2) ✓; `layoutLaneBars` keys by `(jobId, shiftId)` (Task 3) ✓; day-board blocks use the shift's per-day window (Task 4) ✓; bar label/color = shift name + shift color (Tasks 1, 5, 6) ✓; day occupancy uses the shift span and member-shift membership (Task 2) ✓; legacy jobs synthesize one bar (Task 1 fallback, exercised by unchanged existing tests) ✓; job envelope recompute already wired (Global Constraints) ✓.
- **Deferred to Phase 5 (explicitly out of scope here):** dragging a single shift; the drag-assign shift picker for multi-shift jobs (spec §5); cascade (spec §6). Whole-job drag is preserved unchanged.
- **Placeholders:** none — every code step shows the code.
- **Type consistency:** `boardShifts` returns `{ card: BoardCard; memberIds: string[] }[]`, consumed with that exact shape by both lane builders (Task 2). `shiftId` bar key `` `${jobId}::${shiftId ?? ''}` `` is used consistently in `layoutLaneBars` (Task 3), and `` `${jobId}:${shiftId ?? ''}` `` for React element keys in `DayBoard`/`ProductionBoard` (element keys need only be unique per list, so the separator difference is harmless). The `blockHours`/`onEditBlockHours`/`onRemoveBlockHours` signatures widened in Task 6 match the view handlers updated in Task 8.
