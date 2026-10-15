# Draggable Shift Cards in the Jobs Sidebar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the "Jobs This Week" sidebar, multi-shift job cards stop being draggable and instead expand (chevron) into draggable **shift rows**; single-shift cards stay draggable carrying their lone shift's id. Dropping on a member goes straight to Assign Hours for that shift (no `ShiftPickerModal`).

**Architecture:** `JobSummary` gains a `shifts` array (built in `buildJobSummaries` from each job's allocations, days intersected with the sidebar period). A new `SHIFT_DND_TYPE` rides alongside `JOB_DND_TYPE` in the drag payload. The member/lane drop targets read it and widen their callbacks with `shiftId?`; the view's `beginAssign` short-circuits the picker when a shift id arrives.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react. Typecheck `npx tsc --noEmit`; one file `npx vitest run <path>`.

## Global Constraints

- **Every scheduled job has ≥1 allocation** (shipped invariant) — `shifts` is never empty for listed jobs; treat a hypothetical empty array as single-shift-less legacy (card stays draggable with no shift payload).
- **Both payloads always.** Any sidebar drag sets `JOB_DND_TYPE = jobId`; shift-carrying drags additionally set `SHIFT_DND_TYPE = shiftId`, so existing drop targets keep firing.
- **i18n:** new user-facing copy goes through `t('…')`; every `en` key added to `enManual` must also exist in `esManual` (`i18n/translate.test.ts` enforces).
- **Date keys are bare `YYYY-MM-DD`;** allocation-day math uses `workingDayKeys` with noon-anchored spans.
- **TDD.** Failing test first, minimal code, green, commit — one commit per task.
- **Commit footer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Out of scope:** deleting `ShiftPickerModal` (stays as shiftId-less fallback); the unscheduled-jobs panel; board day-drop behavior.

---

## File Structure

- `services/crewHoursGrid.ts` — **Modify.** `JobSummary.shifts` + population in `buildJobSummaries`.
- `components/views/JobScheduling/jobDnd.ts` — **Modify.** `SHIFT_DND_TYPE`.
- `components/views/JobScheduling/JobsPanel.tsx` — **Modify.** Chevron + shift rows; single-shift card carries shift id.
- `components/views/JobScheduling/CrewHoursGrid.tsx`, `DayBoard.tsx` — **Modify.** Drop reads `SHIFT_DND_TYPE`; callbacks widen.
- `components/views/JobSchedulingView.tsx` — **Modify.** `beginAssign(memberId, jobId, shiftId?)`.
- `i18n/catalog.ts` — **Modify.** Chevron aria-label key (en + es).
- Tests: `services/crewHoursGrid.test.ts`, `components/views/JobScheduling/JobsPanel.test.tsx`, `components/views/JobScheduling/CrewHoursGrid.test.tsx` — **Modify.**

---

### Task 1: `JobSummary.shifts` in `buildJobSummaries`

**Files:**
- Modify: `services/crewHoursGrid.ts`
- Test: `services/crewHoursGrid.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface JobShiftSummary { shiftId: string; name: string; startTime: string; endTime: string; days: string[]; }
  // JobSummary gains: shifts: JobShiftSummary[];
  ```
  `days` = the allocation's working days intersected with the passed `dayKeys`, in order.

- [ ] **Step 1: Write the failing test**

Add to `services/crewHoursGrid.test.ts` (reuse the file's existing job/workOrder fixtures; a minimal standalone block):

```ts
describe('buildJobSummaries — per-shift summaries', () => {
  const weekKeys = ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12'];
  const twoShift = {
    id: 'j-2s', jobNumber: 'J-2S', name: 'Two Shift', address: 'x', stage: 'Scheduled',
    startDate: '2026-06-08T08:00:00', endDate: '2026-06-09T17:00:00',
    allocations: [
      { id: 's1', name: 'First Coat', memberIds: ['m1'], startDate: '2026-06-08', endDate: '2026-06-09', startTime: '13:00', endTime: '15:00' },
      { id: 's2', name: 'Second Coat', memberIds: ['m1'], startDate: '2026-06-08', endDate: '2026-06-09', startTime: '15:00', endTime: '17:00' },
    ],
  } as unknown as Job;

  it('emits one shift summary per allocation with period-filtered days', () => {
    const [sum] = buildJobSummaries([twoShift], [], weekKeys, [0, 6]);
    expect(sum.shifts.map(s => s.name)).toEqual(['First Coat', 'Second Coat']);
    expect(sum.shifts[0]).toMatchObject({ shiftId: 's1', startTime: '13:00', endTime: '15:00', days: ['2026-06-08', '2026-06-09'] });
  });

  it('a shift outside the period lists with empty days', () => {
    const j = { ...twoShift, allocations: [{ ...twoShift.allocations![0], startDate: '2026-06-15', endDate: '2026-06-15' }] } as Job;
    const [sum] = buildJobSummaries([{ ...j, startDate: '2026-06-08T08:00:00' } as Job], [], weekKeys, [0, 6]);
    expect(sum.shifts[0].days).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run services/crewHoursGrid.test.ts -t "per-shift summaries"`
Expected: FAIL — `shifts` undefined on `JobSummary`.

- [ ] **Step 3: Implement**

In `services/crewHoursGrid.ts`:

1. Add the type + field:
```ts
export interface JobShiftSummary { shiftId: string; name: string; startTime: string; endTime: string; days: string[]; }
```
and to `JobSummary`:
```ts
  /** One entry per shift (allocation); `days` filtered to the sidebar period. */
  shifts: JobShiftSummary[];
```

2. In `buildJobSummaries`'s returned object, add:
```ts
      shifts: (j.allocations ?? [])
        .filter(a => a.startDate)
        .map(a => {
          const allocKeys = new Set(workingDayKeys(`${a.startDate}T12:00:00`, `${a.endDate || a.startDate}T12:00:00`, weekendDays));
          return { shiftId: a.id, name: a.name, startTime: a.startTime, endTime: a.endTime, days: dayKeys.filter(k => allocKeys.has(k)) };
        }),
```

3. Fix any fixture type errors: `JobsPanel.test.tsx`'s `summary()` helper must gain a default
```ts
  shifts: [{ shiftId: 's1', name: 'Crew', startTime: '08:00', endTime: '17:00', days: [] }],
```
(single shift → existing drag tests stay valid).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run services/crewHoursGrid.test.ts components/views/JobScheduling/JobsPanel.test.tsx` and `npx tsc --noEmit`
Expected: PASS + clean.

- [ ] **Step 5: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts components/views/JobScheduling/JobsPanel.test.tsx
git commit -m "feat(scheduling): JobSummary carries per-shift summaries

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `JobsPanel` — chevron + draggable shift rows

**Files:**
- Modify: `components/views/JobScheduling/jobDnd.ts`, `components/views/JobScheduling/JobsPanel.tsx`, `i18n/catalog.ts`
- Test: `components/views/JobScheduling/JobsPanel.test.tsx`

**Interfaces:**
- Produces: `export const SHIFT_DND_TYPE = 'application/x-shift-id';` in `jobDnd.ts`. Panel behavior: multi-shift card not draggable + chevron (`aria-label` = t(`views.JobScheduling.JobsPanel.toggleShifts`)); shift rows draggable setting both payloads; single-shift card draggable setting both payloads.

- [ ] **Step 1: Write the failing tests**

Add to `JobsPanel.test.tsx` (reuse `summary()`; `render` per existing pattern):

```tsx
const dt = () => { const store: Record<string, string> = {}; return {
  setData: (k: string, v: string) => { store[k] = v; }, getData: (k: string) => store[k] ?? '',
  effectAllowed: '', types: Object.keys(store),
} as unknown as DataTransfer; };

describe('JobsPanel — shift cards', () => {
  const multi = summary({ jobId: 'j6', jobName: 'Downtown Commercial', shifts: [
    { shiftId: 'f', name: 'First Coat', startTime: '13:00', endTime: '15:00', days: ['2026-06-08'] },
    { shiftId: 's', name: 'Second Coat', startTime: '15:00', endTime: '17:00', days: ['2026-06-08'] },
  ]});

  it('multi-shift card is not draggable and expands to shift rows', () => {
    render(<JobsPanel title="T" jobs={[multi]} emptyLabel="e" allStaffedLabel="a" />);
    expect(screen.getByText('Downtown Commercial').closest('li')).not.toHaveAttribute('draggable', 'true');
    fireEvent.click(screen.getByRole('button', { name: /show shifts/i }));
    expect(screen.getByText('First Coat')).toBeInTheDocument();
    expect(screen.getByText('Second Coat')).toBeInTheDocument();
  });

  it('dragging a shift row sets both job and shift payloads', () => {
    render(<JobsPanel title="T" jobs={[multi]} emptyLabel="e" allStaffedLabel="a" />);
    fireEvent.click(screen.getByRole('button', { name: /show shifts/i }));
    const d = dt();
    fireEvent.dragStart(screen.getByText('First Coat').closest('[draggable="true"]')!, { dataTransfer: d });
    expect(d.getData('application/x-job-id')).toBe('j6');
    expect(d.getData('application/x-shift-id')).toBe('f');
  });

  it('a single-shift card stays draggable and carries its shift id', () => {
    const single = summary({ jobId: 'j1' }); // fixture default: one 'Crew' shift s1
    render(<JobsPanel title="T" jobs={[single]} emptyLabel="e" allStaffedLabel="a" />);
    const d = dt();
    fireEvent.dragStart(screen.getByText(single.jobName).closest('li')!, { dataTransfer: d });
    expect(d.getData('application/x-job-id')).toBe('j1');
    expect(d.getData('application/x-shift-id')).toBe('s1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/views/JobScheduling/JobsPanel.test.tsx -t "shift cards"`
Expected: FAIL — no chevron; card draggable; no shift payload.

- [ ] **Step 3: Implement**

1. `jobDnd.ts` — add:
```ts
// MIME type carrying a dragged SHIFT's id alongside JOB_DND_TYPE, so drop targets can
// assign directly into that shift (skipping the shift picker).
export const SHIFT_DND_TYPE = 'application/x-shift-id';
```

2. `i18n/catalog.ts` — `enManual`: `'views.JobScheduling.JobsPanel.toggleShifts': 'Show shifts',` and `esManual`: `'views.JobScheduling.JobsPanel.toggleShifts': 'Mostrar turnos',`.

3. `JobsPanel.tsx`:
   - Import `SHIFT_DND_TYPE`, `ChevronDown` (lucide), add state `const [expanded, setExpanded] = useState<Set<string>>(new Set());`.
   - Per card compute `const multi = j.shifts.length >= 2;` and a shared dragstart helper:
```tsx
  const startDrag = (e: React.DragEvent, jobId: string, shiftId?: string) => {
    e.dataTransfer.setData(JOB_DND_TYPE, jobId);
    if (shiftId) e.dataTransfer.setData(SHIFT_DND_TYPE, shiftId);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggingJobId(jobId);
    onDragJobChange?.(jobId);
  };
```
   - The `<li>` becomes `draggable={!multi}` with `onDragStart={multi ? undefined : (e) => startDrag(e, j.jobId, j.shifts[0]?.shiftId)}` (cursor classes conditional on `!multi`).
   - Next to the grip (full mode) / at the row end (compact), for `multi` render the chevron:
```tsx
  <button aria-label={t('views.JobScheduling.JobsPanel.toggleShifts')} aria-expanded={expanded.has(j.jobId)}
    onClick={(e) => { e.stopPropagation(); setExpanded(prev => { const n = new Set(prev); n.has(j.jobId) ? n.delete(j.jobId) : n.add(j.jobId); return n; }); }}
    className="shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
    <ChevronDown className={`w-4 h-4 transition-transform ${expanded.has(j.jobId) ? 'rotate-180' : ''}`} />
  </button>
```
   - When `multi && expanded.has(j.jobId)`, render under the card body:
```tsx
  <ul className="mt-2 flex flex-col gap-1.5">
    {j.shifts.map(s => (
      <li key={s.shiftId} draggable
        onDragStart={(e) => { e.stopPropagation(); startDrag(e, j.jobId, s.shiftId); }}
        onDragEnd={(e) => { e.stopPropagation(); setDraggingJobId(null); onDragJobChange?.(null); }}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 cursor-grab active:cursor-grabbing hover:border-gray-300 dark:hover:border-gray-600">
        <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-gray-800 dark:text-gray-100">{s.name}</span>
        <span className="text-[10px] font-semibold text-gray-400 tabular-nums shrink-0">{fmtClock(s.startTime)}–{fmtClock(s.endTime)}</span>
        {period === 'week' && s.days.map(k => {
          const { weekday, day } = dayLabel(k);
          return <span key={k} className="px-1 py-0.5 rounded text-[9px] font-bold uppercase bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 shrink-0">{weekday} {day}</span>;
        })}
      </li>
    ))}
  </ul>
```
   with a local formatter:
```ts
const fmtClock = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: m ? '2-digit' : undefined });
};
```
   - Render the shift list in both full and compact bodies (compact: same list under the one-line row).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/views/JobScheduling/JobsPanel.test.tsx i18n/translate.test.ts` and `npx tsc --noEmit`
Expected: PASS (new + existing panel tests) + clean.

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/jobDnd.ts components/views/JobScheduling/JobsPanel.tsx components/views/JobScheduling/JobsPanel.test.tsx i18n/catalog.ts
git commit -m "feat(scheduling): sidebar shift rows drag; multi-shift job cards expand instead

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Drop targets + `beginAssign` pass the shift id

**Files:**
- Modify: `components/views/JobScheduling/CrewHoursGrid.tsx`, `components/views/JobScheduling/DayBoard.tsx`, `components/views/JobSchedulingView.tsx`
- Test: `components/views/JobScheduling/CrewHoursGrid.test.tsx`

**Interfaces:**
- Produces: `onDropJobOnMember: (memberId, jobId, shiftId?) => void` (CrewHoursGrid), `onDropJobOnLane?: (laneId, jobId, shiftId?) => void` (DayBoard); view `beginAssign(memberId, jobId, shiftId?)` — with `shiftId`, sets it and opens Assign Hours (no picker).

- [ ] **Step 1: Write the failing test**

Add to `CrewHoursGrid.test.tsx` (mirror the existing member-drop test's render/fixture):

```tsx
it('passes the dragged shift id through the member drop', () => {
  const onDropJobOnMember = vi.fn();
  render(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={onDropJobOnMember} />);
  const row = screen.getByText(model.rows[0].name).closest('tr')!;
  fireEvent.drop(row, { dataTransfer: { getData: (k: string) => k === 'application/x-shift-id' ? 'sX' : 'j1', types: ['application/x-job-id', 'application/x-shift-id'] } });
  expect(onDropJobOnMember).toHaveBeenCalledWith(model.rows[0].memberId, 'j1', 'sX');
});
```

> Match the existing drop test's target element (the member row/cell it fires `drop` on) — reuse its selector; the new assertion is the 3rd argument.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx -t "shift id through the member drop"`
Expected: FAIL — called with 2 args.

- [ ] **Step 3: Implement**

1. `CrewHoursGrid.tsx`: import `SHIFT_DND_TYPE`; widen the prop type; in `handleMemberDrop`:
```ts
    const jobId = e.dataTransfer.getData(JOB_DND_TYPE);
    const shiftId = e.dataTransfer.getData(SHIFT_DND_TYPE) || undefined;
    if (jobId) onDropJobOnMember(memberId, jobId, shiftId);
```
2. `DayBoard.tsx`: same pattern for `onDropJobOnLane` (import `SHIFT_DND_TYPE`, widen prop, read + pass).
3. `JobSchedulingView.tsx`: widen `beginAssign`:
```ts
  const beginAssign = (memberId: string, jobId: string, shiftId?: string) => {
    const job = jobs.find(j => j.id === jobId);
    const shifts = job?.allocations ?? [];
    setAssignMemberId(memberId);
    setAssignJobId(jobId);
    if (shiftId) { setAssignShiftId(shiftId); return; }   // shift chosen at drag time — no picker
    if (shifts.length >= 2) { setPickerJobId(jobId); return; }
    setAssignShiftId(shifts[0]?.id);
  };
```
   and forward at both call sites: `onDropJobOnMember={(memberId, jobId, shiftId) => beginAssign(memberId, jobId, shiftId)}`, `onDropJobOnLane={(laneId, jobId, shiftId) => beginAssign(laneId, jobId, shiftId)}`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/views/JobScheduling/CrewHoursGrid.test.tsx components/views/JobScheduling/DayBoard.test.tsx` and `npx tsc --noEmit`
Expected: PASS (new + existing; legacy drops pass `undefined` shiftId → old behavior) + clean.

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/CrewHoursGrid.tsx components/views/JobScheduling/DayBoard.tsx components/views/JobSchedulingView.tsx components/views/JobScheduling/CrewHoursGrid.test.tsx
git commit -m "feat(scheduling): member drops carry the dragged shift id past the picker

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Full-suite verification + runtime verify + finish

- [ ] **Step 1: Typecheck + full suite**

Run: `npx tsc --noEmit` then `npx vitest run` — clean + all pass (~+6 tests).

- [ ] **Step 2: Runtime verify (verify skill)**

No seeding — Downtown Commercial ships with First/Second Coat. Start `vite`, drive Chromium, log in, Job Scheduling → **Crew** tab (hours grid + sidebar):
1. Downtown Commercial's sidebar card shows a **chevron** and is **not** draggable; expanding lists **First Coat · 1–3 PM** and **Second Coat · 3–5 PM** rows.
2. Drag **First Coat** onto a member row → **Assign Hours opens directly** (no ShiftPickerModal); submit hours → the member's chip reads `First Coat · 1:00 PM–3:00 PM`.
3. A single-shift card (e.g. Deck Staining) still drags whole and assigns into its Crew shift without a picker.

- [ ] **Step 3: Finish the branch**

Announce and use **superpowers:finishing-a-development-branch**.

---

## Self-Review

**Spec coverage:** §1 data → Task 1; §2 payload → Task 2 (`SHIFT_DND_TYPE`); §3 panel UX (chevron, rows, single-shift drag, compact, click-vs-chevron stopPropagation) → Task 2; §4 drop handling + picker skip → Task 3; edge cases (empty-days shift listed — Task 1 test; hide-staffed untouched; unscheduled panel untouched) covered. ✅

**Placeholder scan:** none — full code/assertions in every step; the one "match existing selector" note (Task 3 test) names the exact fallback.

**Type consistency:** `JobShiftSummary` (T1) consumed by `JobsPanel` rows (T2: `j.shifts`, `s.shiftId/name/startTime/endTime/days`). `SHIFT_DND_TYPE` (T2) read by T3's drop handlers. `beginAssign(memberId, jobId, shiftId?)` (T3) matches both widened callbacks. Fixture default single shift (T1 step 3) keeps T2's single-shift test (`s1`) consistent.
