# Manage Shifts in the Reschedule Drawer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manage a job's shifts (add / delete / rename / crew / span / per-day hours) inline in the reschedule drawer via stacked shift cards, staged and committed on Apply; retire the separate "Shifts —" modal and the Job Details "Manage crew" button.

**Architecture:** Staged **draft-job** model (Approach 1). `preview.staged` gains an optional `draftJob: Job` — the working copy of the edited job. The drawer renders the existing `ShiftList` from `draftJob.allocations` with callbacks wired to *staged* draft handlers (they update `draftJob`, never the committed job). The board previews `draftJob` live; schedule edits (span/hours) with cascade ON run the Piece B resolver against the draft world, producing follower changes on *other* jobs in `staged.changes`. **Apply** commits `onUpdateJob(draftJob)` + `applyScheduleChanges(followers)`; **Cancel** discards. This coexists with the existing drag/Piece-A path (which keeps using `staged.changes`); the drag→cards migration is the final, deferrable task.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react. Typecheck `npx tsc --noEmit`; run one test file with `npx vitest run <path>`.

## Global Constraints

- **Staged, never live.** In the drawer, every shift edit updates `draftJob` in the preview; nothing writes to the committed job until Apply. The live handlers (`handleAddShift`, `handleRenameShift`, `handleChangeSpan`, `handleChangeShiftDayWindow`, `handleDeleteShift`, `handleSaveShiftMembers`) are replaced by `draft*` staged versions.
- **Reuse the shift services.** All `draftJob` mutations go through `services/shifts` (`upsertAllocation`, `removeAllocation`, `setAllocSpan`, `setAllocDayWindow`, `newShift`) which already recompute the job envelope.
- **Reuse Piece B for cascade.** Schedule edits build a shift-anchor `ProposedChange` and call `resolveShiftCascade(worldWithDraft, anchor, config, opts)`; no engine changes.
- **Coexistence.** The draft path is additive: when `staged.draftJob` is set the drawer is in management mode; otherwise the existing change-based drawer (job-level / Piece-A drag) renders unchanged.
- **Legacy jobs** materialize via `ensureJobAllocations` on drawer open. **Last shift can't be deleted.**
- **Undo scope (known limitation):** the primary job's shift edits commit via `onUpdateJob` and are NOT added to the reschedule undo stack in this iteration (matching the pre-existing live Shifts-modal behavior, which was also not undoable). Cascade followers remain undoable via the existing stack.
- **TDD.** Failing test first, minimal implementation, green, commit — one commit per task.
- **Commit footer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Out of scope:** per-shift month-view split; changing how Work Orders create shifts; multi-job management; migrating the shift-drag entry to cards (Task 7 is optional/deferrable).

---

## File Structure

- `services/reschedulePreview.ts` — **Modify.** `StagedReschedule.draftJob?: Job`; `SET_DRAFT` action + reducer case.
- `components/views/JobScheduling/useReschedulePreview.ts` — **Modify.** Expose `setDraft(job)`.
- `components/views/JobScheduling/ShiftList.tsx` — **Modify.** `canDelete` prop; disable the delete button when false.
- `components/views/JobScheduling/reschedule/SingleJobEditor.tsx` — **Modify.** A `manage?` prop bundle; when present, render `ShiftList` in place of the WHEN / DAILY HOURS / CREW sections.
- `components/views/JobScheduling/ReschedulePreviewPanel.tsx` — **Modify.** Synthesize `editChange` from `staged.draftJob`; pass a `manage` bundle to `SingleJobEditor`.
- `components/views/JobSchedulingView.tsx` — **Modify.** Draft state (via preview), open management mode from the schedule action, `draft*` handlers + cascade recompute, `displayJobs` draft branch, Apply/Cancel branch, crew-picker wiring; remove the "Manage crew" button, the Shifts modal, `shiftsJobId`, and the live shift handlers.
- Tests: `services/reschedulePreview.test.ts` (**Modify/Create**), `ShiftList.test.tsx` (**Modify**), `SingleJobEditor.test.tsx` (**Modify**).

---

### Task 1: `StagedReschedule.draftJob` + `setDraft`

**Files:**
- Modify: `services/reschedulePreview.ts`
- Modify: `components/views/JobScheduling/useReschedulePreview.ts`
- Test: `services/reschedulePreview.test.ts`

**Interfaces:**
- Produces: `StagedReschedule.draftJob?: Job`; `PreviewAction` gains `{ type: 'SET_DRAFT'; payload: Job }`; the hook returns `setDraft: (job: Job) => void`.

- [ ] **Step 1: Write the failing reducer test**

Add to `services/reschedulePreview.test.ts` (create if absent, mirroring existing reducer tests):

```ts
import { describe, it, expect } from 'vitest';
import { previewReducer, initialPreviewState } from './reschedulePreview';
import type { Job } from '../types';

const staged = { changes: [], label: 'Edit', commit: () => {}, mode: 'edit' as const, primaryJobId: 'j1' };
const job = { id: 'j1', name: 'J' } as unknown as Job;

describe('previewReducer SET_DRAFT', () => {
  it('sets draftJob on the staged reschedule', () => {
    const state = previewReducer({ staged }, { type: 'SET_DRAFT', payload: job });
    expect(state.staged!.draftJob).toBe(job);
  });
  it('is a no-op when nothing is staged', () => {
    expect(previewReducer(initialPreviewState, { type: 'SET_DRAFT', payload: job })).toEqual(initialPreviewState);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run services/reschedulePreview.test.ts -t SET_DRAFT`
Expected: FAIL — `SET_DRAFT` not handled / `draftJob` missing on the type.

- [ ] **Step 3: Implement**

In `services/reschedulePreview.ts`: add to `StagedReschedule` (import `Job` from `../types`):
```ts
  /** Management mode: the working copy of the primary job whose shifts are being edited.
   *  When set, the drawer renders shift cards from it and Apply commits it. */
  draftJob?: Job;
```
Add to `PreviewAction`:
```ts
  | { type: 'SET_DRAFT'; payload: Job }
```
Add the reducer case:
```ts
    case 'SET_DRAFT':
      return state.staged ? { staged: { ...state.staged, draftJob: action.payload } } : state;
```

In `useReschedulePreview.ts`, add and return:
```ts
  const setDraft = useCallback((job: Job) => dispatch({ type: 'SET_DRAFT', payload: job }), []);
```
(import `Job` from `../../../types`; add `setDraft` to the returned object.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run services/reschedulePreview.test.ts` — PASS.

- [ ] **Step 5: Commit**

```bash
git add services/reschedulePreview.ts components/views/JobScheduling/useReschedulePreview.ts services/reschedulePreview.test.ts
git commit -m "feat(scheduling): StagedReschedule.draftJob + setDraft

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `ShiftList` `canDelete` guard

**Files:**
- Modify: `components/views/JobScheduling/ShiftList.tsx`
- Test: `components/views/JobScheduling/ShiftList.test.tsx`

**Interfaces:**
- Produces: `ShiftListProps.canDelete?: boolean` (default `true`). When `false`, each card's delete button is disabled (`disabled` + no `onDeleteShift` call).

- [ ] **Step 1: Write the failing test**

Add to `ShiftList.test.tsx`:

```ts
it('disables delete when canDelete is false (only one shift)', () => {
  const onDeleteShift = vi.fn();
  render(<ShiftList {...props} canDelete={false} onDeleteShift={onDeleteShift} />);
  const btn = screen.getByRole('button', { name: /delete shift/i });
  expect(btn).toBeDisabled();
  fireEvent.click(btn);
  expect(onDeleteShift).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/views/JobScheduling/ShiftList.test.tsx -t canDelete`
Expected: FAIL — delete button not disabled.

- [ ] **Step 3: Implement**

In `ShiftList.tsx`: add `canDelete = true` to props (destructure + interface), and on the delete `<button>`:
```tsx
              <button aria-label="Delete shift" disabled={!canDelete} onClick={() => canDelete && onDeleteShift(alloc.id)}
                className={`p-1.5 rounded-lg ${canDelete ? 'text-gray-400 hover:text-red-600' : 'text-gray-200 dark:text-gray-700 cursor-not-allowed'}`}>
                <Trash2 className="w-4 h-4" />
              </button>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/views/JobScheduling/ShiftList.test.tsx` — PASS (new + existing).

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/ShiftList.tsx components/views/JobScheduling/ShiftList.test.tsx
git commit -m "feat(scheduling): ShiftList canDelete guard for the last shift

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `SingleJobEditor` management mode

Render `ShiftList` in place of the WHEN / DAILY HOURS / CREW sections when a `manage` bundle is supplied.

**Files:**
- Modify: `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`
- Test: `components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx`

**Interfaces:**
- Consumes: `ShiftList`, `CrewMember`, `JobCrewAllocation`.
- Produces: `SingleJobEditorProps.manage?`:
  ```ts
  manage?: {
    shifts: JobCrewAllocation[];
    allStaff: CrewMember[];
    weekendDays: number[];
    canDelete: boolean;
    onAddShift: () => void;
    onRenameShift: (shiftId: string, name: string) => void;
    onDeleteShift: (shiftId: string) => void;
    onChangeSpan: (shiftId: string, startDate: string, endDate: string) => void;
    onChangeDayWindow: (shiftId: string, dateKey: string, window: { startTime: string; endTime: string }) => void;
    onEditMembers: (shiftId: string) => void;
  };
  ```
  When `manage` is present, the WHEN / DAILY HOURS / CREW sections are replaced by a `SHIFTS` section wrapping `<ShiftList/>`.

- [ ] **Step 1: Write the failing test**

Add to `SingleJobEditor.test.tsx`:

```tsx
describe('SingleJobEditor — manage shifts mode', () => {
  const manage = {
    shifts: [
      { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-07-14', endDate: '2026-07-14', startTime: '08:00', endTime: '12:00' },
      { id: 's2', name: 'Finish', memberIds: ['m1'], startDate: '2026-07-15', endDate: '2026-07-15', startTime: '08:00', endTime: '12:00' },
    ],
    allStaff: [{ id: 'm1', name: 'Mike Smith' }],
    weekendDays: [0, 6], canDelete: true,
    onAddShift: vi.fn(), onRenameShift: vi.fn(), onDeleteShift: vi.fn(),
    onChangeSpan: vi.fn(), onChangeDayWindow: vi.fn(), onEditMembers: vi.fn(),
  };

  it('renders the shift cards + Add shift, not the job-level daily-hours block', () => {
    render(<SingleJobEditor {...base} manage={manage} />);
    expect(screen.getByDisplayValue('Prep')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Finish')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add shift/i })).toBeInTheDocument();
  });

  it('calls onAddShift from the drawer', () => {
    const onAddShift = vi.fn();
    render(<SingleJobEditor {...base} manage={{ ...manage, onAddShift }} />);
    fireEvent.click(screen.getByRole('button', { name: /add shift/i }));
    expect(onAddShift).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx -t "manage shifts"`
Expected: FAIL — no "Add shift" button.

- [ ] **Step 3: Implement**

In `SingleJobEditor.tsx`: import `ShiftList` (`../ShiftList`) and `CrewMember` (`../../../../types`); add `manage` to the props interface + destructure. Then wrap the three sections. Around the WHEN block start, gate:
```tsx
      {manage ? (
        <div className="space-y-1.5">
          <SectionLabel>{t('views.JobScheduling.reschedule.SingleJobEditor.shifts') /* add key: "Shifts" */}</SectionLabel>
          <ShiftList
            job={{ ...({} as any), allocations: manage.shifts } as any}
            allStaff={manage.allStaff}
            weekendDays={manage.weekendDays}
            canDelete={manage.canDelete}
            onEditMembers={manage.onEditMembers}
            onAddShift={manage.onAddShift}
            onRenameShift={manage.onRenameShift}
            onChangeSpan={manage.onChangeSpan}
            onChangeDayWindow={manage.onChangeDayWindow}
            onDeleteShift={manage.onDeleteShift}
          />
        </div>
      ) : (
        <>
          {/* existing WHEN block */}
          {/* existing shift-mode/daily-hours block */}
          {/* existing CREW block */}
        </>
      )}
```
> `ShiftList` only reads `job.allocations`, so pass a minimal object `{ allocations: manage.shifts }`. To avoid the `as any`, prefer changing `ShiftList` to accept `allocations: JobCrewAllocation[]` directly instead of `job` — a small, clean refactor: update `ShiftListProps` to `{ allocations: JobCrewAllocation[]; ... }`, replace `job.allocations ?? []` with `allocations`, and update its two call sites (the retired modal in Task 6 is removed anyway, and this drawer). Do that refactor here and pass `allocations={manage.shifts}`.
>
> Add the i18n key `views.JobScheduling.reschedule.SingleJobEditor.shifts = "Shifts"` to `enManual` **and** `esManual` in `i18n/catalog.ts` (es: "Turnos").

Wrap the existing WHEN + daily-hours + CREW JSX in the `: ( <> ... </> )` branch. Keep them byte-for-byte; only the wrapping changes.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx` and `npx vitest run components/views/JobScheduling/ShiftList.test.tsx`
Expected: PASS (manage-mode tests + existing editor tests + ShiftList tests with the `allocations` prop refactor). Update `ShiftList.test.tsx` props from `job` to `allocations={job.allocations}` if the refactor is done.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` — clean.
```bash
git add components/views/JobScheduling/reschedule/SingleJobEditor.tsx components/views/JobScheduling/ShiftList.tsx components/views/JobScheduling/ShiftList.test.tsx components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx i18n/catalog.ts
git commit -m "feat(scheduling): SingleJobEditor manage-shifts mode (embed ShiftList)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Open management mode + draft state + board preview

Wire the schedule action to open the drawer in management mode, hold the draft in the preview, and render it on the board.

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`
- Test: covered by Task 3 unit tests + Task 8 runtime verify (view glue).

**Interfaces:**
- Consumes: `ensureJobAllocations` (already imported), `preview.setDraft` (Task 1), `recomputeJobEnvelope`.

- [ ] **Step 1: Open management mode from `handleRescheduleJob`**

Replace `handleRescheduleJob` (view ~line 1226) so it seeds a draft and stages an empty-follower management preview:
```tsx
  const handleRescheduleJob = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const draft = ensureJobAllocations(job);
    const label = job.startDate ? `Edit ${job.name}` : `Schedule ${job.name}`;
    setCascade(false);
    preview.stage({ changes: [], label, mode: 'edit', primaryJobId: job.id, draftJob: draft, commit: (eff) => onApplySchedule(eff, label) });
    setSelectedJob(null);
  };
```

- [ ] **Step 2: Board previews the draft**

In `displayJobs` (view ~line 672), add a branch at the top of the `jobs.map` callback so the primary job renders as the draft:
```tsx
    return jobs.map(j => {
      if (s.draftJob && j.id === s.draftJob.id) return s.draftJob;   // management-mode live preview
      // ...existing autoFixDest / pendingMoveId / stagedById logic unchanged...
```
(`s.draftJob` already carries a recomputed envelope from the shift services.)

- [ ] **Step 3: Reset draft on clear**

The draft lives on `preview.staged`, so it clears automatically when the preview clears — no extra reset needed. Confirm `activeShiftId`/`pendingMoveId` resets still run (unchanged).

- [ ] **Step 4: Typecheck + suite**

Run: `npx tsc --noEmit` and `npx vitest run` — clean + green (no behavior change until the panel renders management mode in Task 5; `changes: []` staged preview renders an empty edit shell for now).

- [ ] **Step 5: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat(scheduling): open reschedule drawer in shift-management mode (draft job)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Draft edit handlers + cascade + panel wiring

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`, `components/views/JobScheduling/ReschedulePreviewPanel.tsx`

**Interfaces:**
- Produces: view `draft*` handlers; panel synthesizes `editChange` from `staged.draftJob` and forwards a `manage` bundle to `SingleJobEditor`.

- [ ] **Step 1: Panel renders management mode**

In `ReschedulePreviewPanel.tsx`, make `editChange` fall back to a synthetic change from the draft, and add `manage` passthrough props. Change the `editChange` derivation (line ~89):
```tsx
  const draft = staged.draftJob;
  const editChange = draft
    ? { jobId: draft.id, jobName: draft.name, jobNumber: draft.jobNumber,
        oldStart: draft.startDate ?? null, oldEnd: draft.endDate ?? null,
        newStart: draft.startDate ?? '', newEnd: draft.endDate ?? draft.startDate ?? '' } as ProposedChange
    : staged.primaryJobId ? (changed.find(c => c.jobId === staged.primaryJobId) ?? changed[0]) : changed[0];
```
Add a `manage?` prop to `ReschedulePreviewPanelProps` (same shape as `SingleJobEditor.manage`, Task 3) and destructure it; pass `manage={manage}` to `<SingleJobEditor/>`. (Import `ProposedChange` type if not already.)

- [ ] **Step 2: Build the `manage` bundle in the view + pass to the panel**

In `JobSchedulingView.tsx`, near the other derived values:
```tsx
  const draftJob = preview.staged?.draftJob;
  const manageBundle = draftJob ? {
    shifts: draftJob.allocations ?? [],
    allStaff,
    weekendDays: workConfig.weekendDays,
    canDelete: (draftJob.allocations?.length ?? 0) > 1,
    onAddShift: () => draftAddShift(),
    onRenameShift: (id: string, name: string) => draftEdit(a => upsertAllocation(a, { ...findAlloc(a, id)!, name })),
    onDeleteShift: (id: string) => draftEdit(a => removeAllocation(a, id)),
    onChangeSpan: (id: string, s: string, e: string) => draftScheduleEdit(a => setAllocSpan(a, id, s, e), id),
    onChangeDayWindow: (id: string, dateKey: string, w: DayHours) => draftScheduleEdit(a => setAllocDayWindow(a, id, dateKey, w), id),
    onEditMembers: (id: string) => setEditingShiftId(id),
  } : undefined;
```
Pass `manage={manageBundle}` on `<ReschedulePreviewPanel/>`.

- [ ] **Step 2b: The draft edit helpers**

```tsx
  const findAlloc = (job: Job, id: string) => job.allocations?.find(a => a.id === id);

  // Structural edit: update the draft, no cascade.
  const draftEdit = (fn: (job: Job) => Job) => {
    const d = preview.staged?.draftJob; if (!d) return;
    preview.setDraft(recomputeJobEnvelope(fn(d)));
  };

  const draftAddShift = () => {
    const d = preview.staged?.draftJob; if (!d) return;
    const id = `shift-${shiftSeq}`; setShiftSeq(n => n + 1);
    preview.setDraft(recomputeJobEnvelope(upsertAllocation(d, newShift(id, d))));
    setEditingShiftId(id); // choose members immediately
  };

  // Schedule edit: update the draft AND recompute cascade followers for the edited shift.
  const draftScheduleEdit = (fn: (job: Job) => Job, shiftId: string) => {
    const d = preview.staged?.draftJob; if (!d) return;
    const next = recomputeJobEnvelope(fn(d));
    preview.setDraft(next);
    const alloc = findAlloc(next, shiftId);
    const world = jobs.map(j => (j.id === next.id ? next : j));
    if (cascade && alloc?.startDate && alloc.endDate) {
      const dayKeys = workingDayKeys(`${alloc.startDate}T12:00:00`, `${alloc.endDate}T12:00:00`, workConfig.weekendDays);
      const dh = Object.fromEntries(dayKeys.map(k => [k, allocDayWindow(alloc, k)]));
      const keys = Object.keys(dh).sort();
      const anchor: ProposedChange = {
        jobId: next.id, jobName: next.name, jobNumber: next.jobNumber, shiftId,
        oldStart: null, oldEnd: null,
        newStart: `${keys[0]}T${dh[keys[0]].startTime}:00`,
        newEnd: `${keys[keys.length - 1]}T${dh[keys[keys.length - 1]].endTime}:00`,
        dailyHours: dh,
      };
      const { changes, residual } = resolveShiftCascade(world, anchor, workConfig, { keepExistingDaysAsIs, untilDate: cascadeUntil || undefined });
      preview.setChanges(changes);           // followers only (other jobs); primary is the draft
      setResidualClashes(residual);
    } else {
      preview.setChanges([]);
      setResidualClashes([]);
      const clashes = detectShiftClashes(world, workConfig);
      if (clashes.length) onToast?.(`Heads up: ${clashes[0].message} on ${clashes[0].dateKey}`);
    }
  };
```
> `setAllocSpan`, `removeAllocation` are already imported (Task 6 keeps the imports even after removing the live handlers). `shiftSeq`/`setShiftSeq` already exist (used by the old `handleAddShift`).

- [ ] **Step 3: Wire the crew picker to the draft**

The shift member-picker (`CrewSelectionModal` at view ~line 1346) currently reads `shiftsJob` and calls `handleSaveShiftMembers`. Repoint it at the draft:
```tsx
        {draftJob && editingShiftId && (
            <CrewSelectionModal
                isOpen={!!editingShiftId}
                onClose={() => setEditingShiftId(null)}
                currentCrew={allStaff.filter(m => findAlloc(draftJob, editingShiftId)?.memberIds.includes(m.id))}
                onSave={(newCrew, allocation) => {
                  const a = findAlloc(draftJob, editingShiftId);
                  if (a) draftEdit(j => upsertAllocation(j, { ...a, name: allocation?.name || a.name, memberIds: newCrew.map(c => c.id) }));
                  setEditingShiftId(null);
                }}
                allStaff={allStaff}
                jobStartDate={draftJob.startDate}
                jobEndDate={draftJob.endDate}
                existingJobs={jobs}
                allocationToEdit={findAlloc(draftJob, editingShiftId)}
                simplified
                excludeJobId={draftJob.id}
                weekendDays={workConfig.weekendDays}
            />
        )}
```

- [ ] **Step 4: Typecheck + suite + commit**

Run: `npx tsc --noEmit` and `npx vitest run` — clean + green.
```bash
git add components/views/JobSchedulingView.tsx components/views/JobScheduling/ReschedulePreviewPanel.tsx
git commit -m "feat(scheduling): staged draft shift edits + cascade in the drawer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Apply/Cancel commit + retire the modal, button, and live handlers

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`, `components/views/JobScheduling/JobDetailsPanel.tsx`

- [ ] **Step 1: Apply commits the draft**

In the view's `<ReschedulePreviewPanel onApply=...>` handler (~line 1711), branch on the draft before the existing change-fold:
```tsx
            onApply={() => {
              const s = preview.staged;
              if (!s) return;
              if (s.draftJob) {
                onUpdateJob(s.draftJob);                                  // commit the primary job's shifts
                const followers = s.changes.filter(c => !c.skipped);
                if (followers.length) onApplySchedule(followers, s.label); // cascade-moved other jobs
                preview.clear();
                return;
              }
              // ...existing non-draft adjusted-changes commit unchanged...
            }}
```

- [ ] **Step 2: Remove the "Manage crew" button**

In `JobDetailsPanel.tsx`, remove the `onViewCrew` button (the `manageCrew` `Button` ~line 297) and the `onViewCrew` prop from its interface + destructure. In the view's `<JobDetailsPanel/>`, remove the `onViewCrew={...}` prop.

- [ ] **Step 3: Remove the Shifts modal + live handlers**

In `JobSchedulingView.tsx`, delete:
- the Shifts `Modal` + `ShiftList` render block (~lines 1327–1342),
- `shiftsJobId` / `setShiftsJobId` state (~line 318) and `shiftsJob` (~line 933),
- the live handlers `handleAddShift`, `handleRenameShift`, `handleChangeSpan`, `handleChangeShiftDayWindow`, `handleDeleteShift`, `handleSaveShiftMembers` (~lines 934–964),
- the `ensureJobAllocations` call in the old `onViewCrew` (gone with the button).

Keep imports still used by the draft handlers: `upsertAllocation`, `removeAllocation`, `setAllocSpan`, `setAllocDayWindow`, `newShift`, `ensureJobAllocations`.

> The board's own shift-drag path (`handleDropJob` shift branch, Piece A) is left intact in this task — it still stages a `shiftId` change and opens the Piece-A drawer. Task 7 migrates it.

- [ ] **Step 4: Typecheck + suite**

Run: `npx tsc --noEmit` and `npx vitest run` — clean + green. Fix any now-unused-symbol errors from the removals (e.g. drop `Modal` import if it becomes unused — check first).

- [ ] **Step 5: Commit**

```bash
git add components/views/JobSchedulingView.tsx components/views/JobScheduling/JobDetailsPanel.tsx
git commit -m "feat(scheduling): commit drawer shift draft on Apply; retire Manage crew + Shifts modal

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7 (optional / deferrable): migrate the shift-drag entry to management mode

Make a week/day-board shift drag also open the stacked-cards management drawer (seeding `draftJob` with the dragged shift already moved) instead of the Piece-A tabs, so both entries share one drawer. **Defer if the coexisting Piece-A drag drawer is acceptable for now.**

**Files:** `components/views/JobSchedulingView.tsx`

- [ ] **Step 1:** In `handleDropJob`'s shift branch, replace the `preview.stage({ changes: [change], ... })` with: seed `draftJob = moveAllocation(ensureJobAllocations(job), shiftId, dayKey)`, stage `{ changes: [], draftJob, mode:'edit', primaryJobId }`, then `draftScheduleEdit`-style cascade recompute for the moved shift. Set `pendingMoveId` for the board placeholder.
- [ ] **Step 2:** Remove the now-unused Piece-A drawer wiring that reads the primary from `staged.changes` (`activeShiftId`, `stageShiftChange`, `handleChangeShiftDayHour`, `handleChangeShiftDate`, `handleSelectShift`, `restageShiftMove`'s primary-in-changes assumptions) **only if** nothing else uses them; otherwise leave them. Re-verify the cascade-toggle path reads the draft.
- [ ] **Step 3:** Typecheck + full suite + runtime re-verify the drag flow. Commit.

> This task is intentionally lighter on prescribed code because it depends on how much of the Piece-A wiring is retired; treat it as its own mini-design at execution time. It is NOT required to ship the user's core ask (inline management + no "Manage crew").

---

### Task 8: Full-suite verification + runtime verify + finish

- [ ] **Step 1: Typecheck + full suite**

Run: `npx tsc --noEmit` then `npx vitest run` — clean + all pass.

- [ ] **Step 2: Runtime verify (verify skill)**

Announce and use the **verify** skill. Start `vite`, drive Chromium via Playwright, log in, open Job Scheduling → Week board. With the existing (allocation-less) demo jobs:
1. **Click a job card → Reschedule/Edit** → the drawer opens with a **SHIFTS** section showing one shift card (materialized from the legacy crew), dates/crew/hours, and **"+ Add shift."**
2. **Add shift** → a second card appears; the crew picker opens; assign a member.
3. Edit a shift's hours/dates → the board preview updates live.
4. With **cascade ON**, make an edit that double-books a shared member on another shift/job → the other shift re-places (follower); residual warning if unresolvable.
5. **Apply** → the job commits with its new shifts (reopen to confirm); **Cancel** on a fresh edit discards.
6. Confirm the **"Manage crew" button is gone** and there is no separate Shifts modal.
Seed/revert `data/mockData.ts` only if needed for a multi-shift cascade case.

- [ ] **Step 3: Finish the branch**

Announce and use **superpowers:finishing-a-development-branch**.

---

## Self-Review

**Spec coverage:**
- Staged draft-job model (§Approach) → Tasks 1, 4, 5, 6. ✅
- Stacked shift cards in the drawer (§Design 2) → Task 3 (embed `ShiftList`) + Task 2 (`canDelete`). ✅
- Draft handlers incl. structural + schedule + crew, cascade recompute (§Design 1, 3) → Task 5. ✅
- Entry points: schedule action → Task 4; drag → Task 7 (deferrable). ✅ (drag coexists until migrated)
- Retire Manage crew + Shifts modal + live handlers (§Design 4) → Task 6. ✅
- Edge cases: legacy materialize (Task 4), last-shift delete blocked (Task 2 + `canDelete` in Task 5 bundle), envelope recompute (Task 5 via `recomputeJobEnvelope`/shift services), cascade anchor = edited shift (Task 5). ✅
- Undo limitation documented (Global Constraints). ✅
- Testing (§Testing) → reducer (T1), canDelete (T2), manage-mode render (T3), runtime (T8). ✅

**Placeholder scan:** none — code shown for each logic step; removals cite exact locations; the one i18n key addition is spelled out. Task 7 is intentionally a mini-design (flagged, optional).

**Type consistency:** `StagedReschedule.draftJob: Job` (T1) read by `displayJobs` (T4), the panel's synthetic `editChange` (T5), and Apply (T6). `manage` bundle shape identical in `SingleJobEditor` (T3), `ReschedulePreviewPanel` (T5), and the view's `manageBundle` (T5). `ShiftList` `allocations` prop (T3 refactor) + `canDelete` (T2) consumed by the drawer (T3). Draft edits go through `services/shifts` fns returning `Job` (T5); cascade anchor is a `ProposedChange` with `shiftId` + `dailyHours` consumed by `resolveShiftCascade` (Piece B).
