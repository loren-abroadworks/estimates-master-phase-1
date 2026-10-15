# Per-Day Start/End Time Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user set start/end times for each day a multi-day job spans, from the Reschedule Preview panel, persisting them on the job.

**Architecture:** A new `Job.dailyHours` map plus two pure engine helpers (`spannedDayKeys`, `applyDailyHours`). The view seeds a `dailyHoursEdits` state from the staged changes, the panel renders per-day time inputs that write back to it, and Apply persists the hours via `onUpdateJob` while committing the start/end-adjusted date move.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react, Tailwind.

---

## File Structure

- **Modify** `types.ts` — add `Job.dailyHours`.
- **Modify** `services/scheduleEngine.ts` — `spannedDayKeys`, `applyDailyHours`.
- **Modify** `services/scheduleEngine.test.ts` — tests for both helpers.
- **Modify** `components/views/JobScheduling/ReschedulePreviewPanel.tsx` — Daily Hours section + props.
- **Modify** `components/views/JobScheduling/ReschedulePreviewPanel.test.tsx` — render/interaction test.
- **Modify** `components/views/JobSchedulingView.tsx` — `dailyHoursEdits` state, seeding, change handler, apply persistence.

Context to mirror:
- `services/scheduleEngine.ts:82` `toLocalDateKey`, `:79` `addHours`; the file's date helpers.
- `services/scheduleEngine.test.ts` — fixed-ISO test style.
- `ReschedulePreviewPanel.tsx` — `staged.changes`, the body section pattern (`SectionLabel`), footer `onApply`.
- `JobSchedulingView.tsx` — `preview.staged`, `onUpdateJob`, `workConfig`, the `<ReschedulePreviewPanel onApply=...>` usage.

---

## Task 1: `Job.dailyHours` field

**Files:**
- Modify: `types.ts`

- [ ] **Step 1: Add the field**

In `types.ts`, inside `export interface Job { ... }`, after the `allocations?` line, add:

```ts
  /** Optional per-day working hours, keyed by local 'YYYY-MM-DD'. */
  dailyHours?: Record<string, { startTime: string; endTime: string }>;
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat: Job.dailyHours per-day working hours"
```

---

## Task 2: `spannedDayKeys` + `applyDailyHours` engine helpers

**Files:**
- Modify: `services/scheduleEngine.ts`
- Test: `services/scheduleEngine.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `services/scheduleEngine.test.ts` (mirror the file's existing import + `describe` style):

```ts
import { spannedDayKeys, applyDailyHours } from './scheduleEngine';
import type { ProposedChange } from './scheduleEngine';

describe('spannedDayKeys', () => {
  it('returns one key for a single-day job', () => {
    expect(spannedDayKeys('2026-06-02T08:00:00', '2026-06-02T17:00:00')).toEqual(['2026-06-02']);
  });
  it('returns each calendar day for a multi-day job (inclusive)', () => {
    expect(spannedDayKeys('2026-06-02T08:00:00', '2026-06-04T17:00:00')).toEqual(['2026-06-02','2026-06-03','2026-06-04']);
  });
  it('falls back to the start day when end is null', () => {
    expect(spannedDayKeys('2026-06-02T08:00:00', null)).toEqual(['2026-06-02']);
  });
});

describe('applyDailyHours', () => {
  const change: ProposedChange = {
    jobId: 'a', jobName: 'Job', jobNumber: 'J1',
    oldStart: '2026-06-02T08:00:00', oldEnd: '2026-06-04T17:00:00',
    newStart: '2026-06-02T08:00:00', newEnd: '2026-06-04T17:00:00',
  };
  it('sets newStart/newEnd from the first and last day hours', () => {
    const out = applyDailyHours(change, {
      '2026-06-02': { startTime: '09:30', endTime: '17:00' },
      '2026-06-03': { startTime: '08:00', endTime: '17:00' },
      '2026-06-04': { startTime: '08:00', endTime: '15:45' },
    });
    expect(out.newStart).toBe('2026-06-02T09:30:00');
    expect(out.newEnd).toBe('2026-06-04T15:45:00');
  });
  it('is a no-op when no hours are provided', () => {
    expect(applyDailyHours(change, {})).toEqual(change);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run services/scheduleEngine.test.ts`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Implement**

Append to `services/scheduleEngine.ts` (after `toLocalDateKey`):

```ts
/** Inclusive list of local 'YYYY-MM-DD' keys a job covers from start to end. */
export const spannedDayKeys = (startIso: string, endIso: string | null): string[] => {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : start;
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor.getTime() <= last.getTime()) {
    keys.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys.length ? keys : [toLocalDateKey(start)];
};

/** Adjust a change's overall start/end from the first/last day's edited hours. */
export const applyDailyHours = (
  change: ProposedChange,
  hours: Record<string, { startTime: string; endTime: string }>,
): ProposedChange => {
  const keys = spannedDayKeys(change.newStart, change.newEnd);
  const first = hours[keys[0]];
  const last = hours[keys[keys.length - 1]];
  if (!first && !last) return change;
  return {
    ...change,
    newStart: first ? `${keys[0]}T${first.startTime}:00` : change.newStart,
    newEnd: last ? `${keys[keys.length - 1]}T${last.endTime}:00` : change.newEnd,
  };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run services/scheduleEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "feat: spannedDayKeys + applyDailyHours engine helpers"
```

---

## Task 3: Daily Hours section in `ReschedulePreviewPanel`

**Files:**
- Modify: `components/views/JobScheduling/ReschedulePreviewPanel.tsx`

- [ ] **Step 1: Add imports and props**

At the top of `ReschedulePreviewPanel.tsx`, add `spannedDayKeys` to the scheduleEngine import (add the import line if none exists):

```tsx
import { spannedDayKeys } from '../../../services/scheduleEngine';
```

Extend the props interface with two optional members:

```tsx
  dailyHoursEdits?: Record<string, Record<string, { startTime: string; endTime: string }>>;
  onChangeDailyHour?: (jobId: string, dateKey: string, field: 'startTime' | 'endTime', value: string) => void;
```

Add them to the destructured params:

```tsx
  staged, issues, suggestions, impact, onApply, onCancel, onAutoFix, onChangeDelay, dailyHoursEdits, onChangeDailyHour,
```

- [ ] **Step 2: Render the Daily Hours section**

In the body, immediately AFTER the Schedule Impact `</div>` block and BEFORE the Potential Issues section, add:

```tsx
          {/* Daily Hours */}
          {onChangeDailyHour && changed.length > 0 && (
            <div className="space-y-2">
              <SectionLabel>Daily Hours</SectionLabel>
              {changed.map(c => {
                const keys = spannedDayKeys(c.newStart, c.newEnd);
                const edits = dailyHoursEdits?.[c.jobId] ?? {};
                return (
                  <div key={`dh-${c.jobId}`} className="rounded-xl border border-gray-200 dark:border-gray-700 p-2.5">
                    <div className="text-sm font-bold text-gray-900 dark:text-white mb-1.5 truncate">{c.jobName}</div>
                    <div className="space-y-1.5">
                      {keys.map(dateKey => {
                        const h = edits[dateKey] ?? { startTime: '08:00', endTime: '17:00' };
                        const label = new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                        return (
                          <div key={dateKey} className="flex items-center gap-2 text-sm">
                            <span className="w-24 shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
                            <input
                              type="time"
                              value={h.startTime}
                              onChange={e => onChangeDailyHour(c.jobId, dateKey, 'startTime', e.target.value)}
                              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                            />
                            <span className="text-gray-400">–</span>
                            <input
                              type="time"
                              value={h.endTime}
                              onChange={e => onChangeDailyHour(c.jobId, dateKey, 'endTime', e.target.value)}
                              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run lint`
Expected: PASS (the new props are optional; the view wiring lands in Task 5).

- [ ] **Step 4: Commit**

```bash
git add components/views/JobScheduling/ReschedulePreviewPanel.tsx
git commit -m "feat: Daily Hours per-day time editor in reschedule panel"
```

---

## Task 4: Panel render/interaction test

**Files:**
- Modify: `components/views/JobScheduling/ReschedulePreviewPanel.test.tsx`

- [ ] **Step 1: Add the test**

Append inside the existing `describe('ReschedulePreviewPanel', ...)`:

```tsx
  it('renders a day row per spanned day and fires onChangeDailyHour on edit', () => {
    const multiDay = { ...change, newStart: '2026-06-02T08:00:00', newEnd: '2026-06-04T17:00:00' };
    const staged: StagedReschedule = { changes: [multiDay], label: 'Move', commit: vi.fn() };
    const onChangeDailyHour = vi.fn();
    const edits = { a: {
      '2026-06-02': { startTime: '08:00', endTime: '17:00' },
      '2026-06-03': { startTime: '08:00', endTime: '17:00' },
      '2026-06-04': { startTime: '08:00', endTime: '17:00' },
    } };
    const { container } = render(
      <ReschedulePreviewPanel staged={staged} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop} dailyHoursEdits={edits} onChangeDailyHour={onChangeDailyHour} />,
    );
    const times = container.querySelectorAll('input[type="time"]');
    expect(times).toHaveLength(6); // 3 days × (start + end)
    fireEvent.change(times[0], { target: { value: '09:30' } });
    expect(onChangeDailyHour).toHaveBeenCalledWith('a', '2026-06-02', 'startTime', '09:30');
  });
```

(`change`, `impact`, `noop`, `StagedReschedule`, `render`, `fireEvent`, `vi` are already imported/defined in this file. `change` is the single-day fixture; the test overrides its dates to span 3 days.)

- [ ] **Step 2: Run the test**

Run: `npx vitest run components/views/JobScheduling/ReschedulePreviewPanel.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobScheduling/ReschedulePreviewPanel.test.tsx
git commit -m "test: Daily Hours editor renders day rows and fires changes"
```

---

## Task 5: Wire state + persistence in `JobSchedulingView`

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

- [ ] **Step 1: Import the helpers**

Add `spannedDayKeys` and `applyDailyHours` to the scheduleEngine import (line ~13 alongside `shiftJobsFromPoint`):

```ts
import { ProposedChange, configFromSettings, moveJobToSlot, shiftJobsFromPoint, toLocalDateKey, spannedDayKeys, applyDailyHours } from '../../services/scheduleEngine';
```

(Keep whatever symbols are already imported from that module; just add these two.)

- [ ] **Step 2: Add state + a time-of-day helper**

Near the other view state (after the `pendingMoveId` state line), add:

```ts
  type DayHours = { startTime: string; endTime: string };
  const [dailyHoursEdits, setDailyHoursEdits] = useState<Record<string, Record<string, DayHours>>>({});
  const hhmm = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
```

- [ ] **Step 3: Seed the edits when a preview is staged**

Add an effect after the existing `useEffect(() => { if (!preview.staged) setPendingMoveId(null); }, [preview.staged]);`:

```ts
  useEffect(() => {
    const s = preview.staged;
    if (!s) { setDailyHoursEdits({}); return; }
    const next: Record<string, Record<string, DayHours>> = {};
    for (const c of s.changes) {
      if (c.skipped) continue;
      const job = jobs.find(j => j.id === c.jobId);
      const keys = spannedDayKeys(c.newStart, c.newEnd);
      const defStart = hhmm(c.newStart);
      const defEnd = c.newEnd ? hhmm(c.newEnd) : `${String(workConfig.workDayEndHour).padStart(2, '0')}:00`;
      next[c.jobId] = Object.fromEntries(keys.map(k => [
        k,
        job?.dailyHours?.[k] ?? { startTime: defStart, endTime: defEnd },
      ]));
    }
    setDailyHoursEdits(next);
  }, [preview.staged, jobs, workConfig]);

  const handleChangeDailyHour = (jobId: string, dateKey: string, field: 'startTime' | 'endTime', value: string) => {
    setDailyHoursEdits(prev => ({
      ...prev,
      [jobId]: { ...prev[jobId], [dateKey]: { ...prev[jobId]?.[dateKey], [field]: value } as DayHours },
    }));
  };
```

- [ ] **Step 4: Persist on Apply**

Find the panel's `onApply` (currently `onApply={() => { const s = preview.staged; if (s) { s.commit(s.changes); preview.clear(); } }}`) and replace it with one that persists per-day hours and commits the adjusted changes:

```tsx
            onApply={() => {
              const s = preview.staged;
              if (!s) return;
              const adjusted = s.changes.map(c => {
                const edits = dailyHoursEdits[c.jobId];
                if (c.skipped || !edits) return c;
                const job = jobs.find(j => j.id === c.jobId);
                if (job) onUpdateJob({ ...job, dailyHours: edits });
                return applyDailyHours(c, edits);
              });
              s.commit(adjusted);
              preview.clear();
            }}
```

- [ ] **Step 5: Pass the props to the panel**

In the `<ReschedulePreviewPanel ... />` usage, add:

```tsx
            dailyHoursEdits={dailyHoursEdits}
            onChangeDailyHour={handleChangeDailyHour}
```

- [ ] **Step 6: Verify the whole project typechecks and tests pass**

Run: `npm run lint && npx vitest run`
Expected: PASS — no type errors; all tests green.

- [ ] **Step 7: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: wire per-day hours editing + persistence into reschedule apply"
```

---

## Task 6: Manual verification

**Files:** none (manual).

- [ ] **Step 1:** `npm run dev`, open Job Scheduling; drag a multi-day job to a new day.
- [ ] **Step 2:** In the Reschedule Preview, confirm a "Daily Hours" section lists one row per spanned day with start/end time inputs, seeded from the job's hours (or 08:00–17:00).
- [ ] **Step 3:** Change a day's start/end times; click Apply Changes.
- [ ] **Step 4:** Reopen/move the same job; confirm the edited per-day times are remembered (persisted as `dailyHours`), and the job's overall start/end reflect day-1 start / last-day end.
- [ ] **Step 5:** Confirm a single-day job shows exactly one day row.

---

## Self-Review Notes

- **Spec coverage:** data field (Task 1), engine helpers + tests (Task 2), panel section (Task 3) + test (Task 4), view state/seed/change-handler/apply-persist + props (Task 5), manual checks incl. single-day and persistence (Task 6). All spec sections covered.
- **Type consistency:** `dailyHours: Record<dateKey, {startTime,endTime}>` identical across types.ts, helpers, panel props, and view state (`DayHours` alias = `{startTime,endTime}`); `spannedDayKeys`/`applyDailyHours` signatures match between Task 2 (def) and Tasks 3/5 (use); `onChangeDailyHour(jobId, dateKey, field, value)` matches between panel (Task 3) and view handler (Task 5).
- **Placeholder scan:** all steps contain complete code; no TBD/TODO.
- **Note:** Task 3 leaves the panel section dormant (props optional, unused) until Task 5 wires the view; the tree stays green between commits.
