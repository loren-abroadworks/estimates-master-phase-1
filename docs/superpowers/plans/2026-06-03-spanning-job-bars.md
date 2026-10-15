# Multi-Day Jobs as Spanning Bars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a multi-day job as one continuous bar spanning its day columns (gantt-style) on the scheduling board, with overlapping bars stacked onto sub-rows, clamped to the visible week.

**Architecture:** A pure `layoutLaneBars(lane, dayKeys)` in `services/productionBoard.ts` turns a lane's `cardsByDay` into positioned bars (`startCol`/`span`/`track`) via greedy track packing. `ProductionBoard` renders each lane as a label cell + a relative "day area" with a background day-cell layer (drop targets / rain / availability) and an absolutely-positioned bars layer; the bars layer is `pointer-events-none` during a drag so the drop hit-test still finds the day cells. `JobCard` gains an optional `durationDays` badge.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react, Tailwind, lucide-react.

---

## File Structure

- **Modify** `services/productionBoard.ts` — add `PlacedBar`, `LaneLayout`, `layoutLaneBars`.
- **Modify** `services/productionBoard.test.ts` — tests for `layoutLaneBars`.
- **Modify** `components/views/JobScheduling/JobCard.tsx` — optional `durationDays` badge.
- **Modify** `components/views/JobScheduling/ProductionBoard.tsx` — span-bar lane rendering.
- **Modify** `components/views/JobScheduling/ProductionBoard.test.tsx` — one-bar-per-job render test.

Context to mirror:
- `services/productionBoard.ts:45` `buildLanes` — `BoardLane`/`BoardCard` shapes, `toLocalDateKey`.
- `components/views/JobScheduling/ProductionBoard.tsx` — current grid (`160px repeat(N,1fr)`), the lanes `map`, `data-cell-id`/`data-cell-day`, `ghost` state (non-null while dragging), `hoverCell`, `handleCardPointerDown`, `handleCardClick`, `handleContextMenu`, `renderRowLabel`/`renderCellExtra`/`onCellActivate`.

---

## Task 1: `layoutLaneBars` (pure track-packing layout)

**Files:**
- Modify: `services/productionBoard.ts`
- Test: `services/productionBoard.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `services/productionBoard.test.ts` (reuses the file's module-level `cfg`, `weekDays`, `job`):

```ts
import { layoutLaneBars } from './productionBoard';

describe('layoutLaneBars', () => {
  // weekDays keys: 2026-06-01..05 (Mon..Fri)
  const keys = ['2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05'];
  const lane = (cards: Record<string, { jobId: string; jobName?: string }[]>) =>
    ({ crewId: 'L', crewName: 'L', cardsByDay: Object.fromEntries(
      Object.entries(cards).map(([k, cs]) => [k, cs.map(c => ({
        jobId: c.jobId, jobName: c.jobName ?? c.jobId, jobNumber: 'n', color: '#000',
        startKey: k, endKey: k, isLocked: false,
      }))]),
    ) } as any);

  it('spans a job from its first to last occupied day', () => {
    const l = lane({ '2026-06-02': [{ jobId: 'a' }], '2026-06-03': [{ jobId: 'a' }], '2026-06-04': [{ jobId: 'a' }] });
    const { bars, trackCount } = layoutLaneBars(l, keys);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ startCol: 1, span: 3, track: 0 });
    expect(trackCount).toBe(1);
  });

  it('places two non-overlapping jobs on the same track', () => {
    const l = lane({ '2026-06-01': [{ jobId: 'a' }], '2026-06-03': [{ jobId: 'b' }] });
    const { bars, trackCount } = layoutLaneBars(l, keys);
    expect(trackCount).toBe(1);
    expect(bars.every(b => b.track === 0)).toBe(true);
  });

  it('stacks overlapping jobs on separate tracks', () => {
    const l = lane({
      '2026-06-01': [{ jobId: 'a' }], '2026-06-02': [{ jobId: 'a' }, { jobId: 'b' }], '2026-06-03': [{ jobId: 'b' }],
    });
    const { bars, trackCount } = layoutLaneBars(l, keys);
    expect(trackCount).toBe(2);
    const byId = Object.fromEntries(bars.map(b => [b.card.jobId, b]));
    expect(byId.a.track).toBe(0);
    expect(byId.b.track).toBe(1);
  });

  it('clamps a job to the days it occupies within the week', () => {
    const l = lane({ '2026-06-03': [{ jobId: 'a' }], '2026-06-04': [{ jobId: 'a' }] });
    expect(layoutLaneBars(l, keys).bars[0]).toMatchObject({ startCol: 2, span: 2 });
  });

  it('reports trackCount 0 for an empty lane', () => {
    expect(layoutLaneBars(lane({}), keys).trackCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run services/productionBoard.test.ts`
Expected: FAIL — `layoutLaneBars` is not exported.

- [ ] **Step 3: Implement**

Append to `services/productionBoard.ts`:

```ts
export interface PlacedBar { card: BoardCard; startCol: number; span: number; track: number; }
export interface LaneLayout { bars: PlacedBar[]; trackCount: number; }

/** Turn a lane's per-day cards into spanning bars, stacking overlaps onto tracks. */
export const layoutLaneBars = (lane: BoardLane, dayKeys: string[]): LaneLayout => {
  // Collect, per job, the column indices it occupies in the visible week.
  const cols = new Map<string, { card: BoardCard; idxs: number[] }>();
  dayKeys.forEach((key, i) => {
    for (const card of lane.cardsByDay[key] || []) {
      const entry = cols.get(card.jobId) ?? { card, idxs: [] };
      entry.idxs.push(i);
      cols.set(card.jobId, entry);
    }
  });

  const bars: PlacedBar[] = [...cols.values()].map(({ card, idxs }) => {
    const startCol = Math.min(...idxs);
    const span = Math.max(...idxs) - startCol + 1;
    return { card, startCol, span, track: 0 };
  });

  // Greedy track packing: sort by start, then name; place each bar on the first
  // track whose previous bar ended before this one starts.
  bars.sort((a, b) => a.startCol - b.startCol || a.card.jobName.localeCompare(b.card.jobName));
  const trackEnds: number[] = []; // last occupied col per track
  for (const bar of bars) {
    let t = trackEnds.findIndex(end => end < bar.startCol);
    if (t === -1) { t = trackEnds.length; trackEnds.push(-1); }
    trackEnds[t] = bar.startCol + bar.span - 1;
    bar.track = t;
  }

  return { bars, trackCount: trackEnds.length };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run services/productionBoard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/productionBoard.ts services/productionBoard.test.ts
git commit -m "feat: layoutLaneBars — span multi-day jobs with track packing"
```

---

## Task 2: `JobCard` duration badge

**Files:**
- Modify: `components/views/JobScheduling/JobCard.tsx`

- [ ] **Step 1: Add the optional prop and badge**

In `components/views/JobScheduling/JobCard.tsx`, add `durationDays` to the props interface:

```tsx
interface JobCardProps {
  card: BoardCard;
  draggable: boolean;
  onPointerDownDrag: (card: BoardCard, e: React.PointerEvent) => void;
  onClick?: (jobId: string) => void;
  onMoveJob?: (jobId: string) => void;
  durationDays?: number;
}
```

Destructure it and render a badge. The card's inner content currently is:

```tsx
      {card.isLocked && <Lock className="w-3 h-3 shrink-0" />}
      <span className="truncate">{card.jobName}</span>
```

Change the component signature to include `durationDays`, and append the badge after the name span:

```tsx
export const JobCard = ({ card, draggable, onPointerDownDrag, onClick, onMoveJob, durationDays }: JobCardProps) => {
```

```tsx
      {card.isLocked && <Lock className="w-3 h-3 shrink-0" />}
      <span className="truncate">{card.jobName}</span>
      {durationDays != null && (
        <span className="ml-auto shrink-0 text-[10px] font-black opacity-90">{durationDays}d</span>
      )}
```

(Add `min-w-0` is already implied by the existing flex; the `ml-auto` pushes the badge to the right edge.)

- [ ] **Step 2: Verify typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobScheduling/JobCard.tsx
git commit -m "feat: JobCard optional duration badge"
```

---

## Task 3: Span-bar lane rendering in `ProductionBoard`

**Files:**
- Modify: `components/views/JobScheduling/ProductionBoard.tsx`

- [ ] **Step 1: Import the layout helper and add a constant**

Update the productionBoard import to include the layout function:

```tsx
import { BoardCard, BoardLane, layoutLaneBars } from '../../../services/productionBoard';
```

Add a row-height constant near the top of the file (after `DRAG_THRESHOLD`):

```tsx
const BAR_ROW = 56; // px per stacked bar track within a lane
```

- [ ] **Step 2: Replace the lane rendering block**

Find the lanes block — the `{lanes.map(lane => ( <React.Fragment key={lane.crewId}> <div ...label...> ... </div> {dayKeys.map(dayKey => { ... })} </React.Fragment> ))}` — and replace the entire `lanes.map(...)` with this version. It keeps the label cell, replaces the per-day card cells with a background layer + an absolute spanning-bars layer:

```tsx
        {lanes.map(lane => {
          const { bars, trackCount } = layoutLaneBars(lane, dayKeys);
          const laneHeight = Math.max(1, trackCount) * BAR_ROW;
          return (
            <React.Fragment key={lane.crewId}>
              <div className="p-3 font-bold text-sm text-gray-700 dark:text-gray-200 border-b border-r border-gray-100 dark:border-gray-700 sticky left-0 bg-white dark:bg-gray-800 z-10 flex items-center">
                {renderRowLabel ? renderRowLabel(lane) : lane.crewName}
              </div>
              <div className="relative border-b border-gray-100 dark:border-gray-800" style={{ gridColumn: '2 / -1', minHeight: laneHeight }}>
                {/* Background day cells: drop targets, rain, availability */}
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${dayKeys.length}, 1fr)` }}>
                  {dayKeys.map(dayKey => {
                    const cellId = `${lane.crewId}:${dayKey}`;
                    const isRain = rainDaySet.has(dayKey);
                    return (
                      <div
                        key={cellId}
                        data-cell-id={cellId}
                        data-cell-day={dayKey}
                        onContextMenu={(e) => handleContextMenu(e, dayKey)}
                        onClick={onCellActivate ? () => onCellActivate(lane.crewId, dayKey) : undefined}
                        className={`relative border-l border-gray-100 dark:border-gray-800 ${onCellActivate ? 'cursor-pointer' : ''} ${hoverCell === cellId ? 'bg-primary-50 dark:bg-primary-900/30' : ''}`}
                      >
                        {isRain && (
                          <div
                            className="pointer-events-none absolute inset-0 opacity-70"
                            style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(59,130,246,0.14) 6px, rgba(59,130,246,0.14) 12px)' }}
                          />
                        )}
                        {renderCellExtra && (
                          <div className="pointer-events-none absolute inset-0">{renderCellExtra(lane.crewId, dayKey)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Spanning bars layer (non-interactive while dragging so drops hit the cells) */}
                <div className={`absolute inset-0 ${ghost ? 'pointer-events-none' : ''}`}>
                  {bars.map(bar => (
                    <div
                      key={bar.card.jobId}
                      className="absolute px-1.5"
                      style={{
                        left: `${(bar.startCol / dayKeys.length) * 100}%`,
                        width: `${(bar.span / dayKeys.length) * 100}%`,
                        top: bar.track * BAR_ROW + 6,
                        height: BAR_ROW - 12,
                      }}
                    >
                      <div className="h-full">
                        <JobCard
                          card={bar.card}
                          draggable={canReschedule}
                          onPointerDownDrag={handleCardPointerDown}
                          onClick={handleCardClick}
                          onMoveJob={onMoveJob}
                          durationDays={bar.span}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </React.Fragment>
          );
        })}
```

- [ ] **Step 3: Make `JobCard` fill the bar height**

The bar box sets the height; ensure the card stretches to fill it. In `JobCard.tsx`, the root card `div` className currently starts with `text-white text-xs font-bold px-2 py-1.5 rounded-lg ...`. Add `h-full` so it fills the bar box:

```tsx
      className={`h-full text-white text-xs font-bold px-2 py-1.5 rounded-lg shadow-sm truncate flex items-center gap-1 select-none ${
        canDrag ? 'cursor-grab active:cursor-grabbing touch-none' : 'cursor-pointer'
      }`}
```

- [ ] **Step 4: Verify typecheck and tests**

Run: `npm run lint && npx vitest run`
Expected: PASS — no type errors; existing tests still green. (`useMemo` import is still used by `rainDaySet`; `BoardCard` still imported.)

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/ProductionBoard.tsx components/views/JobScheduling/JobCard.tsx
git commit -m "feat: render multi-day jobs as spanning bars with track stacking"
```

---

## Task 4: One-bar-per-job render test

**Files:**
- Modify: `components/views/JobScheduling/ProductionBoard.test.tsx`

- [ ] **Step 1: Add the test**

Append a test to the existing `describe('ProductionBoard hooks', ...)` (or a new describe) in `components/views/JobScheduling/ProductionBoard.test.tsx`. It builds a lane with a 3-day job and asserts a single rendered card:

```ts
import type { BoardLane } from '../../../services/productionBoard';

it('renders a multi-day job as a single spanning bar', () => {
  const card = { jobId: 'a', jobName: 'Johnson Exterior', jobNumber: 'J1', color: '#3b82f6', startKey: '2026-06-01', endKey: '2026-06-03', isLocked: false };
  const span3: BoardLane[] = [{ crewId: 'c', crewName: 'Crew A', cardsByDay: {
    '2026-06-01': [card], '2026-06-02': [card], '2026-06-03': [card],
  } }];
  const days = ['2026-06-01','2026-06-02','2026-06-03'].map(k => new Date(`${k}T12:00:00`));
  render(<ProductionBoard lanes={span3} weekDays={days} config={config} canReschedule={false} onDropJob={vi.fn()} />);
  expect(screen.getAllByText('Johnson Exterior')).toHaveLength(1);
  expect(screen.getByText('3d')).toBeInTheDocument();
});
```

(The existing test file already imports `render`, `screen`, `vi`, `ProductionBoard`, and defines `config`. Add the `BoardLane` type import if not already present.)

- [ ] **Step 2: Run the test**

Run: `npx vitest run components/views/JobScheduling/ProductionBoard.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobScheduling/ProductionBoard.test.tsx
git commit -m "test: multi-day job renders as one spanning bar"
```

---

## Task 5: Manual verification

**Files:** none (manual).

- [ ] **Step 1: Run the app** — `npm run dev`, open Job Scheduling.
- [ ] **Step 2:** Confirm a multi-day job shows as one continuous bar spanning its days with a `Nd` badge, in all three views (Crew / Crew Member / Job).
- [ ] **Step 3:** Confirm overlapping jobs in one row stack into sub-rows (the row grows taller) and no bar is hidden.
- [ ] **Step 4:** Confirm a job whose start is before the visible week is clipped to the week's left edge.
- [ ] **Step 5:** Confirm drag-to-reschedule still works (drag a bar to another day → reschedule preview opens), rain-day right-click still works, and in Crew Member view the availability overlay + click-to-edit still work behind the bars.

---

## Self-Review Notes

- **Spec coverage:** one bar per job spanning first→last day (Task 1, 3), overlap track-stacking (Task 1, 3), week-edge clamping (Task 1 — only occupied visible indices are used), drag/rain/availability preserved (Task 3 keeps cells + `pointer-events-none` bars during drag), duration badge (Task 2, 3), tests (Tasks 1, 4). All covered.
- **Type consistency:** `PlacedBar`/`LaneLayout`/`layoutLaneBars` names match between Task 1 (definition) and Task 3 (usage); `durationDays` prop matches between Task 2 (JobCard) and Task 3 (board passes `bar.span`); `ghost` is the existing drag-active state used for `pointer-events-none`.
- **Placeholder scan:** all steps contain complete code; no TBD/TODO.
- **Note:** Tasks 2–3 land together (Task 3 depends on the `durationDays` prop and `h-full` from Task 2); commit order keeps the tree green at each commit boundary.
