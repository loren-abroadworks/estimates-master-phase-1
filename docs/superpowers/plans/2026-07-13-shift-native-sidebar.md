# Shift-Native Reschedule Sidebar (Piece A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the reschedule drawer (`SingleJobEditor`) edit a *specific shift* when a job has shifts — a shift-selector tab row + per-day hour rows for the active shift, plus shift-aware START/END DATE fields — so a sidebar edit stages a `shiftId` change and flows through the Piece B cascade pipeline. Legacy (allocation-less) jobs are untouched.

**Architecture:** Approach A — the drawer becomes a third *producer* of the `shiftId` `ProposedChange` already flowing through preview → apply (Piece B). Each sidebar edit rebuilds the active shift's complete per-day window map and stages a shift change: cascade ON → `restageShiftMove` → `resolveShiftCascade`; cascade OFF → merge that shift's change into the staged set. Commit reuses `applyChangeToJob`'s window branch + the multi-shift apply-fold. A new presentational `ShiftHoursEditor` owns the tabs + rows; all cascade wiring stays in `JobSchedulingView`. The job-keyed `dailyHoursEdits` accumulate/bake machinery is **not used for shift jobs**.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react. Typecheck `npx tsc --noEmit`; run one test file with `npx vitest run <path>`; a single test with `-t "<name>"`.

## Global Constraints

- **Legacy jobs unchanged.** When the staged primary change has **no** `shiftId`, the drawer renders today's job-level DAILY HOURS block and job-level date handlers verbatim. Shift mode engages only when `change.shiftId` is set and the job has `allocations`.
- **The active shift's windows are the source of truth.** The view materializes the active shift's *complete* per-day window map by applying the staged change to the job (`applyChangeToJob`) and reading the resulting allocation — so the drawer reflects the shift's staged position (a dragged shift shows its new day), and day rows come from `Object.keys(dayHours).sort()`.
- **Date keys are bare `YYYY-MM-DD`.** Any Date math on a key anchors at local noon (`` `${key}T12:00:00` ``) or uses `toLocalDateKey` / `workingDayKeys`.
- **Behavior mirrors the board drag triggers.** Cascade ON → run the resolver (followers + residual clashes). Cascade OFF → stage only the edited shift (merged with any other manually-staged shift changes for the job).
- **Cascade ON supersedes manual multi-shift edits.** With cascade ON, a sidebar edit re-runs `resolveShiftCascade` from committed `jobs` with the edited shift as the anchor and replaces the staged set (the resolver places the other shifts). Manual independent edits of several shifts are a cascade-OFF flow. This is deliberate.
- **TDD.** Failing test first, minimal implementation, green, commit — one commit per task.
- **Commit footer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Out of scope:** per-shift crew editing; add/remove/rename shifts; per-shift month-view split; the nested-`dailyHoursEdits` refactor (Approach B).

---

## File Structure

- `components/views/JobScheduling/reschedule/ShiftHoursEditor.tsx` — **Create.** Presentational: shift-selector tabs (≥2 shifts) + focus-guarded per-day time rows for the active shift. No state beyond input drafts; no cascade logic.
- `components/views/JobScheduling/reschedule/SingleJobEditor.tsx` — **Modify.** Add shift-mode props; render `ShiftHoursEditor` instead of the job-level DAILY HOURS block in shift mode; make the WHEN START/END DATE fields shift-aware in shift mode. Legacy path unchanged.
- `components/views/JobScheduling/ReschedulePreviewPanel.tsx` — **Modify.** Thread the new shift props from the view to `SingleJobEditor`.
- `components/views/JobSchedulingView.tsx` — **Modify.** `activeShiftId` state (seed on shift-move stage, reset on clear); `activeShiftWindows` materializer; `handleSelectShift`, `handleChangeShiftDayHour`, `handleChangeShiftDate`, and a `stageShiftChange` helper; pass shift props into `ReschedulePreviewPanel`.
- Tests: `components/views/JobScheduling/reschedule/ShiftHoursEditor.test.tsx` (**Create**), `components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx` (**Modify**).

---

### Task 1: `ShiftHoursEditor` presentational component

Shift-selector tabs + per-day hour rows for the active shift. Day rows derive from the active shift's window map keys; inputs are focus-guarded so live re-staging (Approach A stages on every edit) doesn't reset a field mid-type.

**Files:**
- Create: `components/views/JobScheduling/reschedule/ShiftHoursEditor.tsx`
- Test: `components/views/JobScheduling/reschedule/ShiftHoursEditor.test.tsx`

**Interfaces:**
- Consumes: `JobCrewAllocation` from `../../../../types`; `TimeInput` from `../../../UI`.
- Produces:
  ```ts
  interface ShiftHoursEditorProps {
    shifts: JobCrewAllocation[];              // the job's allocations (for tab names)
    activeShiftId: string;                    // which shift's rows show
    onSelectShift: (shiftId: string) => void; // tab click
    dayHours: Record<string, { startTime: string; endTime: string }>; // active shift's COMPLETE per-day windows
    onChangeDayHour: (dateKey: string, field: 'startTime' | 'endTime', value: string) => void;
  }
  export const ShiftHoursEditor: React.FC<ShiftHoursEditorProps>;
  ```
  Accessible names relied on by tests: a `button` per shift named by the shift's `name`, the active one with `aria-pressed="true"`; per-day rows each with a start and end time input.

- [ ] **Step 1: Write the failing test**

Create `components/views/JobScheduling/reschedule/ShiftHoursEditor.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShiftHoursEditor } from './ShiftHoursEditor';
import type { JobCrewAllocation } from '../../../../types';

const shifts: JobCrewAllocation[] = [
  { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-07-14', endDate: '2026-07-14', startTime: '08:00', endTime: '12:00' },
  { id: 's2', name: 'Finish', memberIds: ['m1'], startDate: '2026-07-15', endDate: '2026-07-15', startTime: '08:00', endTime: '12:00' },
];
const base = {
  shifts, activeShiftId: 's1', onSelectShift: vi.fn(),
  dayHours: { '2026-07-14': { startTime: '08:00', endTime: '12:00' } },
  onChangeDayHour: vi.fn(),
};

describe('ShiftHoursEditor', () => {
  it('renders a tab per shift when there are 2+, marking the active one', () => {
    render(<ShiftHoursEditor {...base} />);
    const prep = screen.getByRole('button', { name: 'Prep' });
    const finish = screen.getByRole('button', { name: 'Finish' });
    expect(prep).toHaveAttribute('aria-pressed', 'true');
    expect(finish).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders no tabs for a single-shift job', () => {
    render(<ShiftHoursEditor {...base} shifts={[shifts[0]]} />);
    expect(screen.queryByRole('button', { name: 'Prep' })).toBeNull();
  });

  it('calls onSelectShift when another tab is clicked', () => {
    const onSelectShift = vi.fn();
    render(<ShiftHoursEditor {...base} onSelectShift={onSelectShift} />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(onSelectShift).toHaveBeenCalledWith('s2');
  });

  it('renders one row per day in the active shift window map', () => {
    render(<ShiftHoursEditor {...base} dayHours={{
      '2026-07-14': { startTime: '08:00', endTime: '12:00' },
      '2026-07-15': { startTime: '08:00', endTime: '12:00' },
    }} />);
    expect(screen.getAllByDisplayValue('08:00')).toHaveLength(2); // one start input per day
  });

  it('fires onChangeDayHour when a start time is edited', () => {
    const onChangeDayHour = vi.fn();
    render(<ShiftHoursEditor {...base} onChangeDayHour={onChangeDayHour} />);
    const start = screen.getAllByDisplayValue('08:00')[0];
    fireEvent.change(start, { target: { value: '09:00' } });
    fireEvent.blur(start);
    expect(onChangeDayHour).toHaveBeenCalledWith('2026-07-14', 'startTime', '09:00');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/views/JobScheduling/reschedule/ShiftHoursEditor.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `components/views/JobScheduling/reschedule/ShiftHoursEditor.tsx`:

```tsx
import React from 'react';
import { JobCrewAllocation } from '../../../../types';
import { TimeInput } from '../../../UI';

interface ShiftHoursEditorProps {
  shifts: JobCrewAllocation[];
  activeShiftId: string;
  onSelectShift: (shiftId: string) => void;
  dayHours: Record<string, { startTime: string; endTime: string }>;
  onChangeDayHour: (dateKey: string, field: 'startTime' | 'endTime', value: string) => void;
}

// Focus-guarded time input: staging happens live on every edit and re-seeds the
// authoritative value, so ignore external value changes while focused (adopt on blur)
// to avoid resetting a half-typed value. Mirrors FirstDayStartInput in SingleJobEditor.
const DraftTimeInput = ({ value, onCommit }: { value: string; onCommit: (v: string) => void }) => {
  const [draft, setDraft] = React.useState(value);
  const focused = React.useRef(false);
  React.useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  return (
    <TimeInput
      value={draft}
      onChange={(v) => setDraft(v)}
      onFocus={() => { focused.current = true; }}
      onBlur={(v) => { focused.current = false; onCommit(v); }}
    />
  );
};

export const ShiftHoursEditor: React.FC<ShiftHoursEditorProps> = ({
  shifts, activeShiftId, onSelectShift, dayHours, onChangeDayHour,
}) => {
  const keys = Object.keys(dayHours).sort();
  return (
    <div className="space-y-2">
      {shifts.length >= 2 && (
        <div className="flex flex-wrap gap-1.5">
          {shifts.map((s) => {
            const active = s.id === activeShiftId;
            return (
              <button
                key={s.id}
                aria-pressed={active}
                onClick={() => onSelectShift(s.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  active
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      )}
      <div className="space-y-3">
        {keys.map((dateKey) => {
          const h = dayHours[dateKey];
          const label = new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
          return (
            <div key={dateKey} className="space-y-1 text-sm">
              <span className="block font-medium text-gray-500 dark:text-gray-400">{label}</span>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <DraftTimeInput value={h.startTime} onCommit={(v) => onChangeDayHour(dateKey, 'startTime', v)} />
                </div>
                <span className="text-gray-400">–</span>
                <div className="flex-1 min-w-0">
                  <DraftTimeInput value={h.endTime} onCommit={(v) => onChangeDayHour(dateKey, 'endTime', v)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

> Confirm `TimeInput`'s `onBlur` passes the current value as its argument (as `FirstDayStartInput` in `SingleJobEditor.tsx` relies on: `onBlur={(v) => ...}`). It does — reuse that contract.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/views/JobScheduling/reschedule/ShiftHoursEditor.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/reschedule/ShiftHoursEditor.tsx components/views/JobScheduling/reschedule/ShiftHoursEditor.test.tsx
git commit -m "feat(scheduling): ShiftHoursEditor — shift tabs + per-day rows

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `SingleJobEditor` shift mode

Render `ShiftHoursEditor` and shift-aware date fields when the staged change is a shift change; keep the job-level block for legacy jobs.

**Files:**
- Modify: `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`
- Test: `components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx`

**Interfaces:**
- Consumes: `ShiftHoursEditor` (Task 1); `JobCrewAllocation` from `../../../../types`.
- Produces: `SingleJobEditorProps` gains (all optional):
  ```ts
  shifts?: JobCrewAllocation[];
  activeShiftId?: string;
  activeShiftDayHours?: Record<string, { startTime: string; endTime: string }>;
  onSelectShift?: (shiftId: string) => void;
  onChangeShiftDayHour?: (dateKey: string, field: 'startTime' | 'endTime', value: string) => void;
  onChangeShiftDate?: (field: 'start' | 'end', value: string) => void;
  ```
  Shift mode is active when `change.shiftId && shifts?.length && activeShiftId && onChangeShiftDayHour`.

- [ ] **Step 1: Write the failing tests**

Add to `components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx` (reuse the file's existing render helper / imports; add `within` if not present). Two cases — shift mode renders the editor and tabs; legacy mode still renders the job-level rows:

```tsx
describe('SingleJobEditor — shift mode', () => {
  const shiftProps = {
    shifts: [
      { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-07-14', endDate: '2026-07-14', startTime: '08:00', endTime: '12:00' },
      { id: 's2', name: 'Finish', memberIds: ['m1'], startDate: '2026-07-14', endDate: '2026-07-14', startTime: '13:00', endTime: '17:00' },
    ],
    activeShiftId: 's1',
    activeShiftDayHours: { '2026-07-14': { startTime: '08:00', endTime: '12:00' } },
    onSelectShift: vi.fn(),
    onChangeShiftDayHour: vi.fn(),
    onChangeShiftDate: vi.fn(),
  };

  it('renders the shift tabs when the change carries a shiftId', () => {
    // `renderEditor` = the test file's existing helper; pass a change with shiftId.
    renderEditor({ change: makeChange({ shiftId: 's1' }), ...shiftProps });
    expect(screen.getByRole('button', { name: 'Prep' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();
  });

  it('edits go through the shift handler, not the job-level one', () => {
    const onChangeShiftDayHour = vi.fn();
    renderEditor({ change: makeChange({ shiftId: 's1' }), ...shiftProps, onChangeShiftDayHour });
    const start = screen.getAllByDisplayValue('08:00')[0];
    fireEvent.change(start, { target: { value: '09:00' } });
    fireEvent.blur(start);
    expect(onChangeShiftDayHour).toHaveBeenCalledWith('2026-07-14', 'startTime', '09:00');
  });

  it('falls back to the job-level rows when the change has no shiftId', () => {
    renderEditor({ change: makeChange({}) /* no shiftId */, ...shiftProps });
    expect(screen.queryByRole('button', { name: 'Prep' })).toBeNull();
  });
});
```

> Match `renderEditor` / `makeChange` to the helpers the existing `SingleJobEditor.test.tsx` already uses (read the top of that file). If it renders `<SingleJobEditor {...props} />` inline, mirror that. The three assertions are what matter.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx -t "shift mode"`
Expected: FAIL — no "Prep" tab (shift mode not implemented).

- [ ] **Step 3: Add props + shift-mode render**

In `SingleJobEditor.tsx`:

1. Import the component and type:
```tsx
import { ShiftHoursEditor } from './ShiftHoursEditor';
import { JobCrewAllocation } from '../../../../types';
```

2. Add the new optional props to `SingleJobEditorProps` (after `onShiftStartTime`):
```tsx
  shifts?: JobCrewAllocation[];
  activeShiftId?: string;
  activeShiftDayHours?: Record<string, { startTime: string; endTime: string }>;
  onSelectShift?: (shiftId: string) => void;
  onChangeShiftDayHour?: (dateKey: string, field: 'startTime' | 'endTime', value: string) => void;
  onChangeShiftDate?: (field: 'start' | 'end', value: string) => void;
```

3. Destructure them in the component params (add to the existing destructure list):
```tsx
  shifts, activeShiftId, activeShiftDayHours, onSelectShift, onChangeShiftDayHour, onChangeShiftDate,
```

4. Just after `keys` is computed (`const keys = spanned.filter(...)`), add:
```tsx
  const shiftMode = !!c.shiftId && !!shifts && shifts.length > 0 && !!activeShiftId && !!onChangeShiftDayHour;
  const shiftKeys = Object.keys(activeShiftDayHours ?? {}).sort();
```

5. Replace the DAILY HOURS block (`{onChangeDailyHour && ( ... )}`) so shift mode renders `ShiftHoursEditor`:
```tsx
      {/* Daily hours */}
      {shiftMode ? (
        <div className="space-y-1.5">
          <SectionLabel>{t('views.JobScheduling.reschedule.SingleJobEditor.dailyHours')}</SectionLabel>
          <ShiftHoursEditor
            shifts={shifts!}
            activeShiftId={activeShiftId!}
            onSelectShift={onSelectShift ?? (() => {})}
            dayHours={activeShiftDayHours ?? {}}
            onChangeDayHour={onChangeShiftDayHour!}
          />
        </div>
      ) : onChangeDailyHour && (
        <div className="space-y-1.5">
          {/* ...existing job-level DAILY HOURS block UNCHANGED... */}
        </div>
      )}
```

6. Make the WHEN date fields shift-aware. In the WHEN block, the two `DatePicker`s currently use `keys[0]` / `keys[keys.length-1]` and `onChangeJobDate`. Change them to use the shift's keys + handler in shift mode:
```tsx
              <DatePicker
                value={(shiftMode ? shiftKeys : keys)[0]}
                onChange={v => shiftMode ? onChangeShiftDate!('start', v) : onChangeJobDate!(c.jobId, 'start', v)}
                isDateDisabled={isNonWorkingDay}
              />
```
and the end picker:
```tsx
              <DatePicker
                value={(shiftMode ? shiftKeys : keys)[(shiftMode ? shiftKeys : keys).length - 1]}
                onChange={v => shiftMode ? onChangeShiftDate!('end', v) : onChangeJobDate!(c.jobId, 'end', v)}
                align="right" isDateDisabled={isNonWorkingDay}
              />
```
> The WHEN block currently renders under `{onChangeJobDate && (...)}`. Keep that guard (the view always passes `onChangeJobDate`); shift mode just redirects the `onChange`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx`
Expected: PASS — new shift-mode tests plus all existing `SingleJobEditor` tests (legacy job-level rendering unchanged).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add components/views/JobScheduling/reschedule/SingleJobEditor.tsx components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx
git commit -m "feat(scheduling): SingleJobEditor shift mode (tabs + shift-aware dates)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: View wiring + panel threading

Add the `activeShiftId` state and the shift-edit handlers in `JobSchedulingView`, materialize the active shift's windows, and thread everything through `ReschedulePreviewPanel` to `SingleJobEditor`.

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`, `components/views/JobScheduling/ReschedulePreviewPanel.tsx`
- Test: covered by Task 1/2 unit tests + Task 4 runtime verify (view wiring is dispatch glue; the existing view/panel suites must stay green).

**Interfaces:**
- Consumes: `resolveShiftCascade` / `restageShiftMove` (Piece B), `applyChangeToJob`, `allocDayWindow`, `workingDayKeys`, `toLocalDateKey` (scheduleEngine), `clampDayWindow`.
- Produces: `ReschedulePreviewPanelProps` gains `shiftsForEdit?`, `activeShiftId?`, `activeShiftDayHours?`, `onSelectShift?`, `onChangeShiftDayHour?`, `onChangeShiftDate?`, forwarded to `SingleJobEditor`.

- [ ] **Step 1: Add `activeShiftId` state + imports**

In `JobSchedulingView.tsx`, ensure `applyChangeToJob` is imported from `../../services/scheduleEngine` (add it to the existing import list if missing). Add state near `residualClashes`:
```tsx
  const [activeShiftId, setActiveShiftId] = useState<string | undefined>(undefined);
```
Reset it in the preview-clear effect (extend the existing one):
```tsx
  useEffect(() => { if (!preview.staged) { setPendingMoveId(null); setAutoFixDest(null); setResidualClashes([]); setActiveShiftId(undefined); } }, [preview.staged]);
```
Seed it wherever a shift move is first staged — in `handleDropJob`'s shift branch (after `preview.stage(...)`, before `setPendingMoveId(jobId)`), and in `handleChangeDayWindow`'s cascade-on shift branch (same place):
```tsx
      setActiveShiftId(shiftId);
```

- [ ] **Step 2: Materialize the active shift's windows**

Add a helper (near `scopeForJob`):
```tsx
  // The active shift's COMPLETE per-day windows, reflecting its staged position:
  // apply the staged shift change (if any) to the job, then read the allocation.
  const activeShiftWindows = useCallback((jobId: string, shiftId: string): Record<string, DayHours> => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return {};
    const staged = preview.staged?.changes.find(c => c.jobId === jobId && c.shiftId === shiftId && !c.skipped);
    const eff = staged ? applyChangeToJob(job, staged) : job;
    const a = eff.allocations?.find(x => x.id === shiftId);
    if (!a?.startDate || !a.endDate) return {};
    const keys = workingDayKeys(`${a.startDate}T12:00:00`, `${a.endDate}T12:00:00`, workConfig.weekendDays);
    return Object.fromEntries(keys.map(k => [k, allocDayWindow(a, k)]));
  }, [jobs, preview.staged, workConfig]);

  const editJobId = preview.staged?.primaryJobId;
  const shiftsForEdit = editJobId ? (jobs.find(j => j.id === editJobId)?.allocations ?? []) : [];
  const activeShiftDayHours = editJobId && activeShiftId ? activeShiftWindows(editJobId, activeShiftId) : {};
```

- [ ] **Step 3: Add `stageShiftChange` + the three handlers**

```tsx
  // Build a shiftId ProposedChange from a complete per-day window map and stage it.
  // Cascade ON → run the resolver (anchor = this shift). OFF → merge into the staged set.
  const stageShiftChange = (jobId: string, shiftId: string, dailyHours: Record<string, DayHours>) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const keys = Object.keys(dailyHours).sort();
    if (keys.length === 0) return;
    const start = keys[0], end = keys[keys.length - 1];
    const change: ProposedChange = {
      jobId, jobName: job.name, jobNumber: job.jobNumber, shiftId,
      oldStart: job.startDate ?? null, oldEnd: job.endDate ?? null,
      newStart: `${start}T${dailyHours[start].startTime}:00`,
      newEnd: `${end}T${dailyHours[end].endTime}:00`,
      dailyHours,
    };
    if (cascade) { restageShiftMove(change, cascadeUntil); return; }
    const others = (preview.staged?.changes ?? []).filter(c => !(c.jobId === jobId && c.shiftId === shiftId));
    preview.setChanges([...others, change]);
    setResidualClashes([]);
  };

  const handleSelectShift = (shiftId: string) => setActiveShiftId(shiftId);

  const handleChangeShiftDayHour = (dateKey: string, field: 'startTime' | 'endTime', value: string) => {
    if (!editJobId || !activeShiftId) return;
    const current = activeShiftWindows(editJobId, activeShiftId);
    const prevWin = current[dateKey] ?? availWindow;
    const win = clampDayWindow({ ...prevWin, [field]: value }, prevWin, field, workConfig);
    stageShiftChange(editJobId, activeShiftId, { ...current, [dateKey]: win });
  };

  const handleChangeShiftDate = (field: 'start' | 'end', value: string) => {
    if (!editJobId || !activeShiftId || !value) return;
    const current = activeShiftWindows(editJobId, activeShiftId);
    const keys = Object.keys(current).sort();
    if (!keys.length) return;
    // Shift the whole span by the day-delta implied by moving the chosen boundary.
    const anchorKey = field === 'start' ? keys[0] : keys[keys.length - 1];
    const delta = Math.round(
      (new Date(`${value}T12:00:00`).getTime() - new Date(`${anchorKey}T12:00:00`).getTime()) / 86_400_000,
    );
    if (delta === 0) return;
    const addKey = (k: string) => { const d = new Date(`${k}T12:00:00`); d.setDate(d.getDate() + delta); return toLocalDateKey(d); };
    const moved: Record<string, DayHours> = {};
    for (const k of keys) moved[addKey(k)] = current[k];
    stageShiftChange(editJobId, activeShiftId, moved);
  };
```

> `availWindow`, `cascade`, `cascadeUntil`, `restageShiftMove`, `clampDayWindow`, `DayHours` are all already in scope in the view. `handleChangeShiftDate` moves the whole shift span by the boundary's delta (matching the week-board drag's span semantics); resizing a single boundary independently is out of scope for this minimal piece.

- [ ] **Step 4: Thread props through `ReschedulePreviewPanel`**

In `ReschedulePreviewPanel.tsx`, add to `ReschedulePreviewPanelProps`:
```tsx
  shiftsForEdit?: import('../../../types').JobCrewAllocation[];
  activeShiftId?: string;
  activeShiftDayHours?: Record<string, { startTime: string; endTime: string }>;
  onSelectShift?: (shiftId: string) => void;
  onChangeShiftDayHour?: (dateKey: string, field: 'startTime' | 'endTime', value: string) => void;
  onChangeShiftDate?: (field: 'start' | 'end', value: string) => void;
```
Destructure them in the component params, and pass them to `<SingleJobEditor .../>` (the edit-mode render):
```tsx
              shifts={shiftsForEdit}
              activeShiftId={activeShiftId}
              activeShiftDayHours={activeShiftDayHours}
              onSelectShift={onSelectShift}
              onChangeShiftDayHour={onChangeShiftDayHour}
              onChangeShiftDate={onChangeShiftDate}
```

- [ ] **Step 5: Pass from the view into `ReschedulePreviewPanel`**

In `JobSchedulingView.tsx`, on the `<ReschedulePreviewPanel .../>` element, add:
```tsx
            shiftsForEdit={shiftsForEdit}
            activeShiftId={activeShiftId}
            activeShiftDayHours={activeShiftDayHours}
            onSelectShift={handleSelectShift}
            onChangeShiftDayHour={handleChangeShiftDayHour}
            onChangeShiftDate={handleChangeShiftDate}
```

- [ ] **Step 6: Typecheck + full suite**

Run: `npx tsc --noEmit` then `npx vitest run`
Expected: clean + all pass (existing view/panel/editor tests unaffected; shift props are optional and legacy paths untouched).

- [ ] **Step 7: Commit**

```bash
git add components/views/JobSchedulingView.tsx components/views/JobScheduling/ReschedulePreviewPanel.tsx
git commit -m "feat(scheduling): wire shift-native drawer edits through the cascade path

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Full-suite verification + runtime verify + finish

**Files:** none (verification only).

- [ ] **Step 1: Typecheck + full suite**

Run: `npx tsc --noEmit` then `npx vitest run`
Expected: clean + all pass (baseline 570 + ~8 new tests).

- [ ] **Step 2: Runtime verify (verify skill)**

Announce and use the **verify** skill. Seed a two-shift job in `data/mockData.ts` (Prep + Finish, same member, non-overlapping — as in the Piece B verification). Start `vite`, drive Chromium via Playwright, log in (mock), open Job Scheduling → Week board. Drive:
1. Drag a shift to open the drawer → the DAILY HOURS section shows **shift tabs** (Prep | Finish) with the dragged shift active.
2. Click the other tab → its per-day rows appear (its own days/windows).
3. Edit the active shift's end time so it overlaps the other shift on the shared member, **cascade ON** → the other shift re-places; Apply commits **per-shift** windows (Prep keeps its window, the blocker moved) — confirm via the committed bar times, not just the day.
4. Repeat with **cascade OFF** → only the edited shift changes; the other stays (overlap left in place).
5. Edit the START/END DATE field in shift mode → the shift's span moves; cascade ON re-places any new overlap.
6. Open a **legacy** job (no allocations) → the job-level DAILY HOURS rows render unchanged (no tabs).
Then revert: `git checkout -- data/mockData.ts`.

- [ ] **Step 3: Finish the branch**

Announce and use **superpowers:finishing-a-development-branch** — verify tests, present the options, execute the user's choice.

---

## Self-Review

**Spec coverage (design §1–§4, edge cases, testing):**
- §1 `ShiftHoursEditor` (tabs ≥2 shifts, active shift rows, focus-guarded inputs) → **Task 1**. ✅
- §2 `SingleJobEditor` shift mode (render editor + shift-aware WHEN dates; legacy unchanged) → **Task 2**. ✅
- §3 view state & data flow (activeShiftId, `activeShiftWindows` via `applyChangeToJob`, `stageShiftChange` ON→resolver / OFF→merge, three handlers) + panel threading → **Task 3**. ✅
- §4 cascade/preview/apply reuse (restageShiftMove, multi-shift fold) → **Task 3** (reuses Piece B; no engine change). ✅
- Edge cases: immediate-staging/no-lost-edits (stage-per-edit + OFF-merge), single-shift no tabs (Task 1), active-shift days from staged position (`activeShiftWindows`), date-edit overlap → resolver, cascade-ON-supersedes-manual (Global Constraints) → covered. ✅
- Testing: component (Task 1), editor mode (Task 2), runtime end-to-end (Task 4). ✅

**Placeholder scan:** none — every code step shows the code; test steps show assertions; run steps show commands + expected output. The one "match the existing helper" note (Task 2 `renderEditor`/`makeChange`) points at reading the current test file, with the exact assertions spelled out.

**Type consistency:** `ShiftHoursEditorProps` (Task 1) matches the props `SingleJobEditor` passes (Task 2). `SingleJobEditor`'s new props (`shifts`, `activeShiftId`, `activeShiftDayHours`, `onSelectShift`, `onChangeShiftDayHour`, `onChangeShiftDate`) match what `ReschedulePreviewPanel` forwards (Task 3 step 4) and what the view supplies (Task 3 step 5). `stageShiftChange` emits a `ProposedChange` with `shiftId` + complete `dailyHours` — the shape `applyChangeToJob`'s window branch and `resolveShiftCascade` consume (Piece B). `onChangeShiftDayHour(dateKey, field, value)` and `onChangeShiftDate(field, value)` are consistent editor→panel→view.
