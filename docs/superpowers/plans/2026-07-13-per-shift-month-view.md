# Per-Shift Month View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render one bar per shift (not per job) in the Month view, labelled by shift name, draggable per shift into the cards drawer; legacy (allocation-less) jobs unchanged.

**Architecture:** `buildMonthWeekLane` emits one `BoardCard` per dated shift (with `shiftId`/`shiftName`, the shift's own span/window, color `alloc.color ?? color(job)`); `layoutLaneBars` already stacks bars by `(jobId, shiftId)`, so no layout change. `MonthBoard` keys/labels bars by shift and carries the shift id through its native DnD to `onDropJob(jobId, dayKey, shiftId)` — the view's `handleDropJob` already accepts that 3rd arg and routes a shift move to the cards drawer.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react. Typecheck `npx tsc --noEmit`; one test file `npx vitest run <path>`.

## Global Constraints

- **Legacy jobs unchanged.** A job with no `allocations` emits a single job-spanning card labelled by job name, drag = job-level (no `shiftId`) — identical to today.
- **Preserve the color callback.** `buildMonthWeekLane`'s `color(job)` param is the fallback (its existing test asserts the callback is applied); a shift uses `alloc.color ?? color(job)`.
- **Date keys are bare `YYYY-MM-DD`.** Occupancy math anchors card spans at local noon (as the existing `occupiesWorkingDay` call already does).
- **TDD.** Failing test first, minimal code, green, commit — one commit per task.
- **Commit footer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Out of scope:** Week/Day boards, the drawer, and `handleDropJob` (all reused as-is).

---

## File Structure

- `services/monthBoard.ts` — **Modify.** `buildMonthWeekLane` emits per-shift cards.
- `components/views/JobScheduling/MonthBoard.tsx` — **Modify.** Per-shift bar `key`/label; DnD carries `shiftId`; `onDropJob` widened to `(jobId, dayKey, shiftId?)`.
- Tests: `services/monthBoard.test.ts` (**Modify**), `components/views/JobScheduling/MonthBoard.test.tsx` (**Modify**).

---

### Task 1: `buildMonthWeekLane` emits per-shift cards

**Files:**
- Modify: `services/monthBoard.ts`
- Test: `services/monthBoard.test.ts`

**Interfaces:**
- Consumes: `boardShifts` is NOT reused (its color is `alloc.color ?? jobColor`, but the Month lane must apply the passed `color(job)` fallback). Import `shiftCardHours` from `./productionBoard` (already exported) for a shift's window; keep `cardHours` for the legacy card.
- Produces: `buildMonthWeekLane` unchanged signature; for an allocation-based job it now pushes one `BoardCard` per dated shift (`shiftId`, `shiftName`, shift span/window, `alloc.color ?? color(job)`); a legacy job still pushes one job card.

- [ ] **Step 1: Write the failing test**

Add to `services/monthBoard.test.ts` (inside the `buildMonthWeekLane` describe):

```ts
  it('emits one card per shift for an allocation-based job', () => {
    const j = job({
      id: 'multi', startDate: '2026-06-02T08:00:00', endDate: '2026-06-03T17:00:00',
      allocations: [
        { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-06-02', endDate: '2026-06-02', startTime: '08:00', endTime: '12:00' },
        { id: 's2', name: 'Finish', memberIds: ['m1'], startDate: '2026-06-03', endDate: '2026-06-03', startTime: '08:00', endTime: '12:00' },
      ],
    } as Partial<Job>);
    const lane = buildMonthWeekLane([j], weekKeys, cfg, () => '#abc');
    // Prep sits only on Jun 2, Finish only on Jun 3, each carrying its shift identity.
    expect(lane.cardsByDay['2026-06-02']?.map(c => c.shiftId)).toEqual(['s1']);
    expect(lane.cardsByDay['2026-06-02']?.[0].shiftName).toBe('Prep');
    expect(lane.cardsByDay['2026-06-03']?.map(c => c.shiftId)).toEqual(['s2']);
    expect(lane.cardsByDay['2026-06-03']?.[0].shiftName).toBe('Finish');
    // layoutLaneBars renders two separate 1-day bars.
    const { bars } = layoutLaneBars(lane, weekKeys);
    expect(bars).toHaveLength(2);
  });

  it('emits a single job card for a legacy job (no allocations)', () => {
    const lane = buildMonthWeekLane([job({ id: 'legacy' })], weekKeys, cfg, () => '#abc');
    const card = lane.cardsByDay['2026-06-02']?.[0];
    expect(card?.jobId).toBe('legacy');
    expect(card?.shiftId).toBeUndefined();
    expect(card?.color).toBe('#abc');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run services/monthBoard.test.ts -t "one card per shift"`
Expected: FAIL — the current builder emits one job card (no `shiftId`), so `cardsByDay['2026-06-02'].map(c => c.shiftId)` is `[undefined]`.

- [ ] **Step 3: Implement**

In `services/monthBoard.ts`:

1. Extend the productionBoard import:
```ts
import { visibleWeekDays, BoardLane, BoardCard, cardHours, shiftCardHours } from './productionBoard';
```

2. Replace the body of `buildMonthWeekLane`'s job loop so allocation-based jobs emit per-shift cards:
```ts
export const buildMonthWeekLane = (
  jobs: Job[],
  weekDayKeys: string[],
  config: WorkingTimeConfig,
  color: (job: Job) => string,
): BoardLane => {
  const lane: BoardLane = { crewId: 'month', crewName: '', cardsByDay: {} };
  for (const job of jobs) {
    if (!schedulable(job)) continue;

    // One card per dated shift (allocation-based job), else one job card (legacy).
    const cards: BoardCard[] = job.allocations?.length
      ? job.allocations
          .filter(a => a.startDate)
          .map(alloc => ({
            jobId: job.id, jobName: job.name, jobNumber: job.jobNumber,
            color: alloc.color ?? color(job),
            startKey: alloc.startDate,
            endKey: alloc.endDate || alloc.startDate,
            isLocked: !!job.is_locked,
            shiftId: alloc.id, shiftName: alloc.name,
            ...shiftCardHours(alloc),
          }))
      : [{
          jobId: job.id, jobName: job.name, jobNumber: job.jobNumber,
          color: color(job),
          startKey: toLocalDateKey(new Date(job.startDate!)),
          endKey: toLocalDateKey(new Date(job.endDate || job.startDate!)),
          isLocked: !!job.is_locked,
          ...cardHours(job),
        }];

    for (const card of cards) {
      for (const key of weekDayKeys) {
        // Anchor the card's bare date-key span at local noon so occupiesWorkingDay
        // doesn't drop a day in negative-offset zones.
        if (occupiesWorkingDay(`${card.startKey}T12:00:00`, `${card.endKey}T12:00:00`, key, config)) {
          (lane.cardsByDay[key] ||= []).push(card);
        }
      }
    }
  }
  return lane;
};
```

> This keeps the legacy card's occupancy behavior (its span is the job's start/end as before) and applies the passed `color` callback in both branches. `shiftCardHours(alloc)` supplies the shift's `{ startTime, endTime }`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run services/monthBoard.test.ts`
Expected: PASS — new per-shift + legacy tests, plus the existing `buildMonthWeekLane` tests (multi-day job, color callback, non-schedulable skip) which use allocation-less jobs and hit the legacy branch unchanged.

- [ ] **Step 5: Commit**

```bash
git add services/monthBoard.ts services/monthBoard.test.ts
git commit -m "feat(scheduling): month lane emits one card per shift

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `MonthBoard` renders + drags per shift

**Files:**
- Modify: `components/views/JobScheduling/MonthBoard.tsx`
- Test: `components/views/JobScheduling/MonthBoard.test.tsx`

**Interfaces:**
- Produces: `MonthBoardProps.onDropJob?: (jobId: string, dayKey: string, shiftId?: string) => void`. Each bar's React `key` is `${card.jobId}::${card.shiftId ?? ''}`; label/`title` = `card.shiftName ?? card.jobName`; internal drags carry `{ jobId, shiftId }` and drop calls `onDropJob(jobId, dayKey, shiftId)`. External (sidebar) drops still pass `shiftId === undefined`.

- [ ] **Step 1: Write the failing tests**

In `components/views/JobScheduling/MonthBoard.test.tsx`, add a two-shift job fixture and two tests (mirror the file's existing render setup):

```tsx
const shiftJob = {
  id: 'sj', jobNumber: 'S-1', name: 'Cascade Test', stage: 'Scheduled', clientId: 'c1',
  startDate: '2026-06-02T08:00:00', endDate: '2026-06-03T17:00:00', dateCreated: '2026-01-01',
  allocations: [
    { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-06-02', endDate: '2026-06-02', startTime: '08:00', endTime: '12:00' },
    { id: 's2', name: 'Finish', memberIds: ['m1'], startDate: '2026-06-03', endDate: '2026-06-03', startTime: '08:00', endTime: '12:00' },
  ],
} as unknown as Job;

it('renders one bar per shift, labelled by shift name', () => {
  render(<MonthBoard {...base} jobs={[shiftJob]} />);
  expect(screen.getByText('Prep')).toBeInTheDocument();
  expect(screen.getByText('Finish')).toBeInTheDocument();
  expect(screen.queryByText('Cascade Test')).toBeNull(); // job name not on the bar
});

it('drops carry the dragged bar’s shift id to onDropJob', () => {
  const onDropJob = vi.fn();
  render(<MonthBoard {...base} jobs={[shiftJob]} onDropJob={onDropJob} />);
  const prep = screen.getByText('Prep');
  fireEvent.dragStart(prep, { dataTransfer: { setData: () => {} } });
  // Drop onto some day cell; the internal drag ref supplies (jobId, shiftId).
  const cell = document.querySelector('[class*="border-l"]') as HTMLElement;
  fireEvent.drop(cell, { dataTransfer: { getData: () => '' } });
  expect(onDropJob).toHaveBeenCalledWith('sj', expect.any(String), 's1');
});
```

> If the existing drop test relies on a specific cell selector, reuse that selector for the drop target instead of the `querySelector` above. The assertion that matters: `onDropJob` receives `('sj', <dayKey>, 's1')`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/views/JobScheduling/MonthBoard.test.tsx -t "per shift"`
Expected: FAIL — bars are labelled by job name (`Cascade Test`) and `onDropJob` gets no shift id.

- [ ] **Step 3: Implement**

In `MonthBoard.tsx`:

1. Widen the prop:
```ts
  onDropJob?: (jobId: string, dayKey: string, shiftId?: string) => void;
```

2. Change the drag ref to carry the shift id:
```ts
  const dragged = useRef<{ jobId: string; shiftId?: string } | null>(null);
```

3. Bar element — key, drag payload, label:
```tsx
                <button
                  key={`${bar.card.jobId}::${bar.card.shiftId ?? ''}`}
                  draggable={!!canReschedule}
                  onDragStart={(e) => { dragged.current = { jobId: bar.card.jobId, shiftId: bar.card.shiftId }; setNativeDragActive(true); e.dataTransfer.setData(JOB_DND_TYPE, bar.card.jobId); }}
                  onClick={() => onSelectJob(bar.card.jobId)}
                  /* ...unchanged className/style... */
                  title={bar.card.shiftName ?? bar.card.jobName}
                >
                  {bar.card.shiftName ?? bar.card.jobName}
                </button>
```

4. Drop handler — prefer the internal ref (has the shift id); fall back to the external payload (job id only):
```tsx
                  onDrop={onDropJob ? ((e) => {
                    e.preventDefault(); setDropHoverCell(null);
                    const ref = dragged.current;
                    const jobId = ref?.jobId ?? e.dataTransfer.getData(JOB_DND_TYPE);
                    if (jobId) onDropJob(jobId, d.key, ref?.shiftId);
                    dragged.current = null;
                  }) : undefined}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/views/JobScheduling/MonthBoard.test.tsx`
Expected: PASS — new per-shift tests + existing tests (multi-day bar, click, external drop with `getData`). Note the external-drop test passes `shiftId === undefined` (ref is null), so `onDropJob.mock.calls[0][0]` is still the job id.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` — clean. (`handleDropJob` in the view already accepts `(jobId, dayKey, shiftId?)`.)
```bash
git add components/views/JobScheduling/MonthBoard.tsx components/views/JobScheduling/MonthBoard.test.tsx
git commit -m "feat(scheduling): month board renders + drags per shift

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Full-suite verification + runtime verify + finish

- [ ] **Step 1: Typecheck + full suite**

Run: `npx tsc --noEmit` then `npx vitest run` — clean + all pass (baseline 575 + ~4 new).

- [ ] **Step 2: Runtime verify (verify skill)**

Announce and use the **verify** skill. Seed a two-shift job in `data/mockData.ts` (Prep + Finish on adjacent days), start `vite`, drive Chromium via Playwright, log in, open Job Scheduling, switch to **Month**. Confirm:
1. The two-shift job shows as **separate "Prep" and "Finish" bars** on their own days (not one job-spanning bar).
2. A legacy job still shows one bar with its job name.
3. Dragging the "Prep" bar to another day opens the **cards drawer** with Prep moved (shift-level).
Then revert: `git checkout -- data/mockData.ts`.

- [ ] **Step 3: Finish the branch**

Announce and use **superpowers:finishing-a-development-branch**.

---

## Self-Review

**Spec coverage:** per-shift cards in `buildMonthWeekLane` (Task 1); shift-name label + per-shift `key` + per-shift drag in `MonthBoard` (Task 2); legacy fallback preserved (both tasks); color = `alloc.color ?? color(job)` (Task 1); reused `layoutLaneBars`/`handleDropJob` unchanged. ✅

**Placeholder scan:** none — code shown for each step; assertions shown; commands + expected output given. The one selector caveat (Task 2 drop target) points at reusing the existing test's selector.

**Type consistency:** `BoardCard.shiftId?/shiftName?` (existing) drive the lane cards (Task 1) and the bar key/label/drag (Task 2). `onDropJob(jobId, dayKey, shiftId?)` (Task 2) matches the view's `handleDropJob` (already 3-arg). `shiftCardHours(alloc)` / `cardHours(job)` return `{startTime,endTime}` as `BoardCard` requires.
