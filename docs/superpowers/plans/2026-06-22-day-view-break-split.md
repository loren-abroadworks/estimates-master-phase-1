# Day View Break Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the Day view timeline, split a job block into stacked segments with a real gap wherever a fixed break sits, so the break is visible through the job.

**Architecture:** A pure helper in `services/dayBoard.ts` computes the visible job segments (job window minus overlapping fixed-break intervals). `DayBoard.tsx` renders one positioned div per segment instead of one per job; the existing break-band render pass is kept and lifted above the job segments so it shows in the gaps. Display-only — no hours/capacity changes.

**Tech Stack:** TypeScript, React, Vitest + @testing-library/react. Test command: `npx vitest run <path>`.

## Global Constraints

- Display-only change: do NOT touch hours, capacity, or assigned counters (already break-aware via `2026-06-22-break-aware-job-hours-design.md`).
- Only **fixed** breaks (those with a `startTime`) split a job. Floating breaks (no `startTime`) stay as top-of-column chips, unchanged.
- Both paid and unpaid fixed breaks create a gap (the helper is paid-agnostic; the caller passes all fixed breaks).
- Drag-to-reschedule must keep moving the **whole** job day window, from any segment.
- Axis math matches the existing component: `topPct = (h - axisStart)/span*100`, `span = axisEnd - axisStart`, `HOUR_HEIGHT = 56`.

---

### Task 1: `splitBlockAroundBreaks` helper

**Files:**
- Modify: `services/dayBoard.ts` (add `BlockSegment` interface + `splitBlockAroundBreaks`; reuse existing private `toHours` at line 26)
- Test: `services/dayBoard.test.ts` (append a new `describe`)

**Interfaces:**
- Consumes: nothing new (uses the file's existing `toHours`).
- Produces:
  - `interface BlockSegment { topPct: number; heightPct: number }`
  - `splitBlockAroundBreaks(startH: number, endH: number, breaks: { startTime: string; durationMinutes: number }[], axisStart: number, axisEnd: number): BlockSegment[]` — visible job segments after removing every fixed-break interval that overlaps `[startH, endH]`, as top/height percentages of `[axisStart, axisEnd]`, ordered top→bottom; a job with no overlapping break returns one segment for the whole clamped block; segments thinner than `0.3%` are dropped.

- [ ] **Step 1: Write the failing tests**

Append to `services/dayBoard.test.ts` (the file already imports from `./dayBoard`; add `splitBlockAroundBreaks` to that import or add a new import line):

```ts
import { splitBlockAroundBreaks } from './dayBoard';

describe('splitBlockAroundBreaks', () => {
  // Axis 0–24, span 24 → each hour = 100/24 ≈ 4.1667%.
  const pct = (h: number) => (h / 24) * 100;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const seg = (s: number, e: number) => ({ topPct: round(pct(s)), heightPct: round(pct(e - s)) });
  const norm = (segs: { topPct: number; heightPct: number }[]) =>
    segs.map(x => ({ topPct: round(x.topPct), heightPct: round(x.heightPct) }));

  it('returns one full segment when no break overlaps', () => {
    expect(norm(splitBlockAroundBreaks(8, 17, [], 0, 24))).toEqual([seg(8, 17)]);
  });

  it('returns one full segment when the break is outside the window', () => {
    const breaks = [{ startTime: '19:00', durationMinutes: 30 }];
    expect(norm(splitBlockAroundBreaks(8, 17, breaks, 0, 24))).toEqual([seg(8, 17)]);
  });

  it('splits into two segments around a mid-window break', () => {
    const breaks = [{ startTime: '12:00', durationMinutes: 30 }];
    expect(norm(splitBlockAroundBreaks(8, 17, breaks, 0, 24))).toEqual([seg(8, 12), seg(12.5, 17)]);
  });

  it('trims the start when a break overlaps the leading edge', () => {
    const breaks = [{ startTime: '08:00', durationMinutes: 30 }];
    expect(norm(splitBlockAroundBreaks(8, 17, breaks, 0, 24))).toEqual([seg(8.5, 17)]);
  });

  it('trims the end when a break overlaps the trailing edge', () => {
    const breaks = [{ startTime: '16:45', durationMinutes: 30 }]; // 16.75–17.25, clamped to 17
    expect(norm(splitBlockAroundBreaks(8, 17, breaks, 0, 24))).toEqual([seg(8, 16.75)]);
  });

  it('produces three segments for two interior breaks', () => {
    const breaks = [
      { startTime: '10:00', durationMinutes: 30 },
      { startTime: '12:00', durationMinutes: 60 },
    ];
    expect(norm(splitBlockAroundBreaks(8, 17, breaks, 0, 24))).toEqual([seg(8, 10), seg(10.5, 12), seg(13, 17)]);
  });

  it('returns no segments when a break covers the whole window', () => {
    const breaks = [{ startTime: '08:00', durationMinutes: 600 }]; // 8–18 covers 8–17
    expect(splitBlockAroundBreaks(8, 17, breaks, 0, 24)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run services/dayBoard.test.ts -t splitBlockAroundBreaks`
Expected: FAIL — `splitBlockAroundBreaks is not a function`.

- [ ] **Step 3: Implement the helper**

In `services/dayBoard.ts`, add the interface next to `DayBlock` (after line 17) and the function after `buildDayBlocks` (after line 91). It reuses the existing module-private `toHours` (line 26):

```ts
export interface BlockSegment {
  topPct: number;    // 0–100, segment top within the hour axis
  heightPct: number; // 0–100, segment height
}

const SEGMENT_EPS_PCT = 0.3; // drop hairline segments left by edge breaks

/** Split a job's [startH, endH] (fractional hours) into the visible segments left
 *  after removing each fixed-break interval that overlaps the window. `breaks` are
 *  fixed breaks ({ startTime: 'HH:mm', durationMinutes }); paid status is irrelevant
 *  here — the caller decides which breaks to pass. Segments are top/height
 *  percentages of [axisStart, axisEnd], clamped to the axis and ordered top→bottom.
 *  No overlapping break → a single full-window segment. */
export const splitBlockAroundBreaks = (
  startH: number,
  endH: number,
  breaks: { startTime: string; durationMinutes: number }[],
  axisStart: number,
  axisEnd: number,
): BlockSegment[] => {
  const span = Math.max(1, axisEnd - axisStart);
  const winStart = Math.min(Math.max(startH, axisStart), axisEnd);
  const winEnd = Math.min(Math.max(endH, axisStart), axisEnd);
  if (winEnd <= winStart) return [];

  // Break intervals clamped to the job window, sorted, only those that overlap.
  const cuts = breaks
    .map(b => {
      const bs = toHours(b.startTime);
      return { s: Math.max(bs, winStart), e: Math.min(bs + b.durationMinutes / 60, winEnd) };
    })
    .filter(c => c.e > c.s)
    .sort((a, b) => a.s - b.s);

  const toSeg = (s: number, e: number): BlockSegment => ({
    topPct: ((s - axisStart) / span) * 100,
    heightPct: ((e - s) / span) * 100,
  });

  const segments: BlockSegment[] = [];
  let cursor = winStart;
  for (const c of cuts) {
    if (c.s > cursor) segments.push(toSeg(cursor, c.s));
    cursor = Math.max(cursor, c.e);
  }
  if (winEnd > cursor) segments.push(toSeg(cursor, winEnd));
  return segments.filter(s => s.heightPct >= SEGMENT_EPS_PCT);
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run services/dayBoard.test.ts`
Expected: PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add services/dayBoard.ts services/dayBoard.test.ts
git commit -m "feat(scheduling): splitBlockAroundBreaks helper for day-view break gaps"
```

---

### Task 2: Render job segments in `DayBoard`

**Files:**
- Modify: `components/views/JobScheduling/DayBoard.tsx` (block render loop ~lines 240–283; break-band z-index ~line 297)
- Test: `components/views/JobScheduling/DayBoard.test.tsx` (append tests)

**Interfaces:**
- Consumes: `splitBlockAroundBreaks`, `BlockSegment` from `../../../services/dayBoard` (Task 1); existing `hhmmToHours` (DayBoard line 17), `laneBreaks` prop.
- Produces: each job renders one wrapper div per segment, all sharing `data-job-id={jobId}`.

- [ ] **Step 1: Write the failing tests**

Append to `components/views/JobScheduling/DayBoard.test.tsx`:

```ts
describe('DayBoard — break splitting', () => {
  const lunch = { id: 'b1', label: 'Lunch', durationMinutes: 30, paid: false, startTime: '12:00' };

  it('splits a job into two segments around a fixed break', () => {
    const j = job({ startDate: '2026-06-10T10:00:00', endDate: '2026-06-10T14:00:00' });
    const { container } = render(
      <DayBoard {...base} lanes={lanesFor([j])} laneBreaks={() => [lunch]} />,
    );
    expect(container.querySelectorAll('[data-job-id="j1"]').length).toBe(2);
  });

  it('renders a single segment when no break overlaps the job', () => {
    const j = job({ startDate: '2026-06-10T10:00:00', endDate: '2026-06-10T11:30:00' }); // ends before lunch
    const { container } = render(
      <DayBoard {...base} lanes={lanesFor([j])} laneBreaks={() => [lunch]} />,
    );
    expect(container.querySelectorAll('[data-job-id="j1"]').length).toBe(1);
  });

  it('still opens the job when a segment is clicked', () => {
    const onViewJob = vi.fn();
    const j = job({ startDate: '2026-06-10T10:00:00', endDate: '2026-06-10T14:00:00' });
    const { container } = render(
      <DayBoard {...base} onViewJob={onViewJob} lanes={lanesFor([j])} laneBreaks={() => [lunch]} />,
    );
    fireEvent.click(container.querySelectorAll('[data-job-id="j1"]')[1] as HTMLElement);
    expect(onViewJob).toHaveBeenCalledWith('j1');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/views/JobScheduling/DayBoard.test.tsx -t "break splitting"`
Expected: FAIL — only 1 element with `data-job-id="j1"` (no splitting yet).

- [ ] **Step 3: Replace the block render with a per-segment render**

In `components/views/JobScheduling/DayBoard.tsx`, add the import (top of file, near the existing `buildDayBlocks` import on line 6):

```ts
import { buildDayBlocks, shiftDayWindow, splitBlockAroundBreaks } from '../../../services/dayBoard';
```

Replace the entire `{row.blocks.map(block => { ... })}` expression (lines 240–283) with:

```tsx
            {row.blocks.map(block => {
              const draggable = canReschedule && !block.card.isLocked && !!onChangeDayWindow;
              const hrs = blockHours?.(row.laneId, block.card.jobId) ?? null;
              const fixedBreaks = (laneBreaks?.(row.laneId) ?? []).filter(b => b.startTime) as { startTime: string; durationMinutes: number }[];
              const startH = hhmmToHours(block.startTime);
              const endH = hhmmToHours(block.endTime);
              const segments = (startH !== null && endH !== null)
                ? splitBlockAroundBreaks(startH, endH, fixedBreaks, axisStart, axisEnd)
                : [{ topPct: block.topPct, heightPct: block.heightPct }];
              const onPointerDown = draggable ? (e: React.PointerEvent) => {
                if (e.button !== 0) return;
                const col = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                dragRef.current = { jobId: block.card.jobId, startY: e.clientY, colHeight: col.height || 1, window: { startTime: block.startTime, endTime: block.endTime }, moved: false };
              } : undefined;
              return segments.map((seg, i) => (
                <div
                  key={`${block.card.jobId}-${i}`}
                  data-job-id={block.card.jobId}
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
                        <span className="truncate">{fmtClock(block.startTime)} – {fmtClock(block.endTime)}</span>
                        {hrs && (
                          hrs.editable && onEditBlockHours ? (
                            <span className="ml-auto flex items-center gap-0.5 shrink-0">
                              <TimelineHoursField
                                hours={hrs.hours}
                                label={t('views.JobScheduling.DayBoard.hoursAriaLabel', { jobName: block.card.jobName })}
                                onCommit={(h) => onEditBlockHours(row.laneId, block.card.jobId, h)}
                                onRemove={() => onRemoveBlockHours?.(row.laneId, block.card.jobId)}
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
            })}
```

- [ ] **Step 4: Lift the fixed-break band above job segments**

In the fixed-break band `<div>` (currently ~line 297), change its z-index class from `z-[4]` to `z-[8]` so it reads over any cascade overlap; keep `pointer-events-none` and the rest unchanged:

```tsx
                        className="pointer-events-none absolute inset-x-1 z-[8] rounded-md border border-dashed border-gray-400/70 bg-gray-200/70 dark:bg-gray-600/60 px-1.5 py-0.5 overflow-hidden"
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run components/views/JobScheduling/DayBoard.test.tsx`
Expected: PASS (existing block/drag/click tests still pass since they use `querySelector` = first segment; new splitting tests pass).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add components/views/JobScheduling/DayBoard.tsx components/views/JobScheduling/DayBoard.test.tsx
git commit -m "feat(scheduling): split day-view job blocks around fixed breaks"
```

---

### Task 3: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 2: Typecheck the project**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "test(scheduling): fixups after day-view break split" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** split helper (Task 1), only fixed breaks split + both paid/unpaid (Task 2 filters on `b.startTime` only, paid-agnostic), multiple breaks → multiple segments (Task 1 test), edge/whole-cover breaks (Task 1 tests), first segment keeps header/hours + continuation shows name only (Task 2 `i === 0` guard), break band visible via gap + raised z-index (Task 2 Step 4), drag moves whole window (shared `onPointerDown` seeded with `block.startTime/endTime`), floating breaks untouched (filter keeps only `b.startTime`; the existing flexible-chip render pass is left as-is). All covered.
- **Display-only:** no `blockHours`/hours/capacity logic changed — the hours readout still renders once (on segment `i === 0`).
- **Backward compatibility:** when `laneBreaks` is absent or no break overlaps, `segments` is a single full-window entry, so existing `DayBoard.test.tsx` (which passes no `laneBreaks`) is unaffected; tests using `querySelector` get the first segment.
- **Type consistency:** `splitBlockAroundBreaks` / `BlockSegment` names and signature match between Task 1 (definition) and Task 2 (use); `hhmmToHours` returns `number | null`, handled with the fallback segment.
