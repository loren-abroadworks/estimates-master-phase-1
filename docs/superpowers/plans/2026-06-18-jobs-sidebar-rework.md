# Jobs Sidebar Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Job Scheduling "Jobs This Week" sidebar denser (with an ultra-compact toggle) and turn it into an independent Week / Month / Year lens.

**Architecture:** Extract job-summary building from `buildCrewHoursGrid` into a standalone `buildJobSummaries(dayKeys)` so the sidebar can be computed for any period independent of the crew grid's week. Add a `periodDayKeys` helper for month/year calendar ranges. `JobsPanel` gains `period` + `compact` props (segmented control + icon toggle); the two preferences persist via a new `useLocalStorage` hook owned by `JobSchedulingView`.

**Tech Stack:** React + TypeScript, Tailwind CSS, lucide-react icons, i18n via `useTranslation`, Vitest + @testing-library/react (jsdom).

## Global Constraints

- **i18n:** Every user-facing string uses a translation key via `useTranslation()`. Add new keys to BOTH `enManual` and `esManual` in `i18n/catalog.ts` — the catalog-integrity test enforces en/es parity. Key convention: `<area>.<component>.<descriptor>`.
- **Styling:** Tailwind utility classes only; inline styles only for dynamic values (color, width %). Support `dark:` variants, matching existing card classes.
- **Tests:** Vitest. Run a single file with `npx vitest run <path>`. Test environment is jsdom (configured in `vite.config.ts`).
- **No new dependencies.** Use existing libraries only.
- **Sidebar period is independent of the crew grid.** The grid columns stay on the week; only the sidebar's `period` changes which jobs/hours it shows.

---

### Task 1: `useLocalStorage` hook

A minimal persistence hook (none exists today). Used in Task 4 to persist the period and compact preferences.

**Files:**
- Create: `hooks/useLocalStorage.ts`
- Test: `hooks/useLocalStorage.test.ts`

**Interfaces:**
- Produces: `useLocalStorage<T>(key: string, initial: T): readonly [T, (value: T) => void]`

- [ ] **Step 1: Write the failing test**

Create `hooks/useLocalStorage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => localStorage.clear());

  it('returns the initial value when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorage('k.missing', 'week'));
    expect(result.current[0]).toBe('week');
  });

  it('reads a previously stored value on mount', () => {
    localStorage.setItem('k.stored', JSON.stringify('month'));
    const { result } = renderHook(() => useLocalStorage('k.stored', 'week'));
    expect(result.current[0]).toBe('month');
  });

  it('persists updates to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('k.write', false));
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(JSON.parse(localStorage.getItem('k.write')!)).toBe(true);
  });

  it('falls back to the initial value when stored JSON is malformed', () => {
    localStorage.setItem('k.bad', '{not json');
    const { result } = renderHook(() => useLocalStorage('k.bad', 'week'));
    expect(result.current[0]).toBe('week');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run hooks/useLocalStorage.test.ts`
Expected: FAIL — cannot resolve `./useLocalStorage`.

- [ ] **Step 3: Write minimal implementation**

Create `hooks/useLocalStorage.ts`:

```typescript
import { useCallback, useState } from 'react';

/** Persist a small UI preference under `key`. Reads once on mount (tolerating
 *  malformed JSON), writes through on every set. Not reactive across tabs — the
 *  app has a single window. */
export function useLocalStorage<T>(key: string, initial: T): readonly [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  const set = useCallback((next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode / quota) — keep the in-memory value.
    }
  }, [key]);

  return [value, set] as const;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run hooks/useLocalStorage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add hooks/useLocalStorage.ts hooks/useLocalStorage.test.ts
git commit -m "feat(hooks): add useLocalStorage for persisting UI preferences"
```

---

### Task 2: Extract `buildJobSummaries` and add `periodDayKeys`

Pull the job-summary block out of `buildCrewHoursGrid` so the sidebar can compute summaries for any day range, and add a helper that turns a date + period into working-day keys.

**Files:**
- Modify: `services/crewHoursGrid.ts` (refactor `buildCrewHoursGrid` lines ~394–405; add two exports)
- Test: `services/crewHoursGrid.test.ts` (append)

**Interfaces:**
- Consumes (already exist in the file): `requiredHoursForWeek`, `assignedHoursForJobInWeek`, `buildLineItemRows`, `jobsScheduledInWeek`, `jobColor`, `workingDayKeys` (imported from `./scheduleEngine`), `toLocalDateKey` (imported from `./scheduleEngine`).
- Produces:
  - `buildJobSummaries(jobs: Job[], workOrders: WorkOrder[], dayKeys: string[], weekendDays: number[]): JobSummary[]`
  - `periodDayKeys(currentDate: Date, period: 'week' | 'month' | 'year', weekendDays: number[], weekDayKeys: string[]): string[]`

- [ ] **Step 1: Write the failing tests**

Append to `services/crewHoursGrid.test.ts`:

```typescript
import { buildJobSummaries, periodDayKeys } from './crewHoursGrid';

describe('buildJobSummaries', () => {
  const twoWeekJob = job({
    workOrderId: 'wo1', startDate: '2026-06-08', endDate: '2026-06-19', // Mon..Fri across 2 weeks = 10 working days
  });
  const orders = [wo({ id: 'wo1', totalProductionHours: 80 })];

  it('matches the job summaries buildCrewHoursGrid produces for the same week', () => {
    const weekDays = weekKeys.map(k => new Date(`${k}T12:00:00`));
    const fromGrid = buildCrewHoursGrid([member()], [twoWeekJob], orders, weekDays, WEEKEND, 8).jobs;
    const direct = buildJobSummaries([twoWeekJob], orders, weekKeys, WEEKEND);
    expect(direct).toEqual(fromGrid);
  });

  it('prorates required hours to the wider month range (80h over 10 days, all 10 in month = 80h)', () => {
    const monthKeys = periodDayKeys(new Date('2026-06-15T12:00:00'), 'month', WEEKEND, weekKeys);
    const [summary] = buildJobSummaries([twoWeekJob], orders, monthKeys, WEEKEND);
    expect(summary.required).toBe(80);
    expect(summary.days.length).toBe(10);
  });

  it('excludes jobs whose working days do not intersect the range', () => {
    const future = job({ workOrderId: 'wo1', startDate: '2026-09-01', endDate: '2026-09-04' });
    expect(buildJobSummaries([future], orders, weekKeys, WEEKEND)).toEqual([]);
  });
});

describe('periodDayKeys', () => {
  it('returns the given week keys unchanged for the week period', () => {
    expect(periodDayKeys(new Date('2026-06-10T12:00:00'), 'week', WEEKEND, weekKeys)).toEqual(weekKeys);
  });

  it('returns every working day of the calendar month for the month period', () => {
    const keys = periodDayKeys(new Date('2026-06-15T12:00:00'), 'month', WEEKEND, weekKeys);
    expect(keys[0]).toBe('2026-06-01'); // Mon
    expect(keys[keys.length - 1]).toBe('2026-06-30'); // Tue
    expect(keys.every(k => k.startsWith('2026-06-'))).toBe(true);
    expect(keys).not.toContain('2026-06-06'); // Saturday excluded
  });

  it('spans the whole calendar year for the year period', () => {
    const keys = periodDayKeys(new Date('2026-06-15T12:00:00'), 'year', WEEKEND, weekKeys);
    expect(keys[0]).toBe('2026-01-01');
    expect(keys[keys.length - 1]).toBe('2026-12-31');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: FAIL — `buildJobSummaries` / `periodDayKeys` are not exported.

- [ ] **Step 3: Extract `buildJobSummaries`**

In `services/crewHoursGrid.ts`, add this exported function just above `buildCrewHoursGrid` (after `jobsScheduledInWeek`, near line 195):

```typescript
/** Job summaries for the sidebar over an arbitrary set of working-day keys.
 *  Independent of crew rows — used by the grid (one week) and the Jobs sidebar
 *  (week / month / year). */
export const buildJobSummaries = (
  jobs: Job[],
  workOrders: WorkOrder[],
  dayKeys: string[],
  weekendDays: number[],
): JobSummary[] =>
  jobsScheduledInWeek(jobs, dayKeys, weekendDays).map(j => {
    const { estimate, required } = requiredHoursForWeek(j, workOrders, dayKeys, weekendDays);
    const assigned = assignedHoursForJobInWeek(j, dayKeys, /* standardDay */ 8);
    const jobKeys = new Set(workingDayKeys(j.startDate!, j.endDate ?? j.startDate!, weekendDays));
    return {
      jobId: j.id, jobNumber: j.jobNumber, jobName: j.name, address: j.address, color: jobColor(j.id),
      estimate, required, assigned,
      missing: estimate > 0 ? Math.max(0, round1(required - assigned)) : 0,
      days: dayKeys.filter(k => jobKeys.has(k)),
      lineItems: buildLineItemRows(j, workOrders, dayKeys, weekendDays),
    };
  });
```

Note: `assignedHoursForJobInWeek`'s `standardDay` only affects window-fallback hours; the grid passes its `standardDay` through. To preserve exact grid parity, change the signature to thread it (see Step 4) rather than hard-coding `8`.

- [ ] **Step 4: Thread `standardDay` and call the extraction from `buildCrewHoursGrid`**

Replace the hard-coded `8` by adding `standardDay` as the final parameter of `buildJobSummaries`:

```typescript
export const buildJobSummaries = (
  jobs: Job[],
  workOrders: WorkOrder[],
  dayKeys: string[],
  weekendDays: number[],
  standardDay: number = 8,
): JobSummary[] =>
  jobsScheduledInWeek(jobs, dayKeys, weekendDays).map(j => {
    const { estimate, required } = requiredHoursForWeek(j, workOrders, dayKeys, weekendDays);
    const assigned = assignedHoursForJobInWeek(j, dayKeys, standardDay);
    const jobKeys = new Set(workingDayKeys(j.startDate!, j.endDate ?? j.startDate!, weekendDays));
    return {
      jobId: j.id, jobNumber: j.jobNumber, jobName: j.name, address: j.address, color: jobColor(j.id),
      estimate, required, assigned,
      missing: estimate > 0 ? Math.max(0, round1(required - assigned)) : 0,
      days: dayKeys.filter(k => jobKeys.has(k)),
      lineItems: buildLineItemRows(j, workOrders, dayKeys, weekendDays),
    };
  });
```

Then in `buildCrewHoursGrid`, replace the inline `const jobSummaries: JobSummary[] = weekJobs.map(j => { ... });` block (lines ~394–405) with:

```typescript
  const jobSummaries = buildJobSummaries(jobs, workOrders, dayKeys, weekendDays, standardDay);
```

(`weekJobs` is still used by the member-row loop above, so leave its declaration in place.)

- [ ] **Step 5: Add `periodDayKeys`**

Add below `buildJobSummaries`:

```typescript
/** Working-day keys for the sidebar's period, anchored to the grid's current date.
 *  Week reuses the grid's already-computed `weekDayKeys` (identical scope); month and
 *  year enumerate the calendar period and drop non-working weekdays. */
export const periodDayKeys = (
  currentDate: Date,
  period: 'week' | 'month' | 'year',
  weekendDays: number[],
  weekDayKeys: string[],
): string[] => {
  if (period === 'week') return weekDayKeys;
  const y = currentDate.getFullYear();
  const [first, last] = period === 'month'
    ? [new Date(y, currentDate.getMonth(), 1), new Date(y, currentDate.getMonth() + 1, 0)]
    : [new Date(y, 0, 1), new Date(y, 11, 31)];
  return workingDayKeys(toLocalDateKey(first), toLocalDateKey(last), weekendDays);
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run services/crewHoursGrid.test.ts`
Expected: PASS — the new tests plus all pre-existing tests in the file (parity test confirms the refactor changed nothing).

- [ ] **Step 7: Commit**

```bash
git add services/crewHoursGrid.ts services/crewHoursGrid.test.ts
git commit -m "refactor(scheduling): extract buildJobSummaries + add periodDayKeys"
```

---

### Task 3: JobsPanel — period control, compact mode, period-aware labels

Add the Week/Month/Year segmented control, the compact single-line mode, the period sublabel, and the month/year day-range string. Continues the density pass already applied to the default card.

**Files:**
- Modify: `components/views/JobScheduling/JobsPanel.tsx`
- Modify: `i18n/catalog.ts` (add keys to `enManual` and `esManual`)
- Test: `components/views/JobScheduling/JobsPanel.test.tsx` (append)

**Interfaces:**
- Consumes: `JobSummary` (from `services/crewHoursGrid`).
- Produces (new optional props on `JobsPanel`):
  - `period?: 'week' | 'month' | 'year'` (default `'week'`)
  - `onPeriodChange?: (p: 'week' | 'month' | 'year') => void` — when present, renders the segmented control
  - `compact?: boolean` (default `false`)
  - `onCompactChange?: (v: boolean) => void` — when present, renders the compact toggle

- [ ] **Step 1: Add i18n keys**

In `i18n/catalog.ts`, inside `enManual` (near the other `views.JobScheduling.JobsPanel.*` / `BreakTimeField` keys), add:

```typescript
  'views.JobScheduling.JobsPanel.thisMonth': 'this month',
  'views.JobScheduling.JobsPanel.thisYear': 'this year',
  'views.JobScheduling.JobsPanel.periodWeek': 'Week',
  'views.JobScheduling.JobsPanel.periodMonth': 'Month',
  'views.JobScheduling.JobsPanel.periodYear': 'Year',
  'views.JobScheduling.JobsPanel.compactView': 'Compact view',
  'views.JobScheduling.JobsPanel.dayRange': '{range} · {count} days',
  'views.JobScheduling.CrewHoursGrid.jobsThisMonth': 'Jobs This Month',
  'views.JobScheduling.CrewHoursGrid.jobsThisYear': 'Jobs This Year',
```

And the Spanish equivalents inside `esManual`:

```typescript
  'views.JobScheduling.JobsPanel.thisMonth': 'este mes',
  'views.JobScheduling.JobsPanel.thisYear': 'este año',
  'views.JobScheduling.JobsPanel.periodWeek': 'Semana',
  'views.JobScheduling.JobsPanel.periodMonth': 'Mes',
  'views.JobScheduling.JobsPanel.periodYear': 'Año',
  'views.JobScheduling.JobsPanel.compactView': 'Vista compacta',
  'views.JobScheduling.JobsPanel.dayRange': '{range} · {count} días',
  'views.JobScheduling.CrewHoursGrid.jobsThisMonth': 'Trabajos Este Mes',
  'views.JobScheduling.CrewHoursGrid.jobsThisYear': 'Trabajos Este Año',
```

- [ ] **Step 2: Write the failing tests**

Append to `components/views/JobScheduling/JobsPanel.test.tsx` (extend the import on line 3 to include `fireEvent`):

```typescript
// at top: import { render, screen, fireEvent } from '@testing-library/react';

describe('JobsPanel period lens', () => {
  it('shows the month sublabel when period is month', () => {
    render(<JobsPanel title="Jobs This Month" period="month" jobs={[summary()]} emptyLabel="none" allStaffedLabel="all" />);
    expect(screen.getByText('this month')).toBeInTheDocument();
    expect(screen.queryByText('this week')).not.toBeInTheDocument();
  });

  it('renders the Week/Month/Year control and fires onPeriodChange', () => {
    const onPeriodChange = vi.fn();
    render(<JobsPanel title="Jobs This Week" period="week" onPeriodChange={onPeriodChange} jobs={[summary()]} emptyLabel="none" allStaffedLabel="all" />);
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(onPeriodChange).toHaveBeenCalledWith('month');
  });

  it('shows a collapsed day-range instead of day pills in month view', () => {
    render(<JobsPanel title="Jobs This Month" period="month" jobs={[summary({ days: ['2026-06-08','2026-06-09','2026-06-10'] })]} emptyLabel="none" allStaffedLabel="all" />);
    expect(screen.getByText(/3 days/)).toBeInTheDocument();
  });
});

describe('JobsPanel compact mode', () => {
  it('hides line items and shows hours in compact mode', () => {
    render(<JobsPanel title="Jobs This Week" compact onCompactChange={() => {}} jobs={[summary({ lineItems: [{ taskId: 't1', name: 'Prep', estimated: 4, assigned: 2 }] })]} emptyLabel="none" allStaffedLabel="all" />);
    expect(screen.getByText('10 / 20h')).toBeInTheDocument();
    expect(screen.queryByText('Line Items')).not.toBeInTheDocument();
  });

  it('fires onCompactChange when the toggle is clicked', () => {
    const onCompactChange = vi.fn();
    render(<JobsPanel title="Jobs This Week" compact={false} onCompactChange={onCompactChange} jobs={[summary()]} emptyLabel="none" allStaffedLabel="all" />);
    fireEvent.click(screen.getByRole('button', { name: 'Compact view' }));
    expect(onCompactChange).toHaveBeenCalledWith(true);
  });
});
```

Add `import { vi } from 'vitest';` to the existing `vitest` import line (`import { describe, it, expect, vi } from 'vitest';`).

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run components/views/JobScheduling/JobsPanel.test.tsx`
Expected: FAIL — props not supported; controls/sublabels not rendered.

- [ ] **Step 4: Extend the props and header**

In `JobsPanel.tsx`, update the props interface (after line 20) and destructure (line 34):

```typescript
interface JobsPanelProps {
  title: string;
  jobs: JobSummary[];
  emptyLabel: string;
  allStaffedLabel: string;
  onSelectJob?: (jobId: string) => void;
  onDragJobChange?: (jobId: string | null) => void;
  /** Sidebar period lens. When onPeriodChange is provided, the Week/Month/Year
   *  control is shown. */
  period?: 'week' | 'month' | 'year';
  onPeriodChange?: (p: 'week' | 'month' | 'year') => void;
  /** Ultra-compact single-line rows. When onCompactChange is provided, the toggle
   *  is shown. */
  compact?: boolean;
  onCompactChange?: (v: boolean) => void;
}
```

```typescript
export const JobsPanel = ({
  title, jobs, emptyLabel, allStaffedLabel, onSelectJob, onDragJobChange,
  period = 'week', onPeriodChange, compact = false, onCompactChange,
}: JobsPanelProps) => {
```

Add the import for the compact-toggle icon (line 2): include `Rows3` from `lucide-react`:

```typescript
import { AlertTriangle, CheckCircle2, GripVertical, ChevronDown, Rows3 } from 'lucide-react';
```

Add these helpers after the existing `dayLabel` function (line 29):

```typescript
const PERIODS: Array<'week' | 'month' | 'year'> = ['week', 'month', 'year'];
const sublabelKey = (p: 'week' | 'month' | 'year') =>
  p === 'month' ? 'views.JobScheduling.JobsPanel.thisMonth'
  : p === 'year' ? 'views.JobScheduling.JobsPanel.thisYear'
  : 'views.JobScheduling.JobsPanel.thisWeek';

const rangeLabel = (days: string[]) => {
  if (!days.length) return '';
  const fmt = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const first = fmt(days[0]);
  const last = fmt(days[days.length - 1]);
  return first === last ? first : `${first} – ${last}`;
};
```

Then add a controls row inside the header `<div>` block (after the title row, before the `<ul>` on line 62). Replace lines 53–61 (`<div className="flex items-center justify-between gap-4 mb-4 shrink-0"> ... </div>`) with:

```tsx
      <div className="flex items-center justify-between gap-3 mb-2 shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">{title}</h3>
        {onCompactChange && (
          <button
            type="button"
            onClick={() => onCompactChange(!compact)}
            aria-label={t('views.JobScheduling.JobsPanel.compactView')}
            aria-pressed={compact}
            className={`p-1.5 rounded-lg border transition-colors ${
              compact
                ? 'border-primary-400 text-primary-600 bg-primary-50 dark:bg-primary-900/30'
                : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
            }`}
          >
            <Rows3 className="w-4 h-4" />
          </button>
        )}
      </div>
      {(onPeriodChange || staffedCount > 0) && (
        <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
          {onPeriodChange ? (
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700/60 p-0.5">
              {PERIODS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPeriodChange(p)}
                  aria-pressed={period === p}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                    period === p
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {t(`views.JobScheduling.JobsPanel.period${p[0].toUpperCase()}${p.slice(1)}`)}
                </button>
              ))}
            </div>
          ) : <span />}
          {staffedCount > 0 && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('views.JobScheduling.JobsPanel.hideStaffed')}</span>
              <Toggle checked={hideStaffed} onChange={setHideStaffed} />
            </label>
          )}
        </div>
      )}
```

(`staffedCount` and `hideStaffed` are declared above the `return`, lines 37 & 48, so they are in scope here.)

- [ ] **Step 5: Render the period sublabel and the month/year day-range**

Change the "this week" sublabel (line 123) to use the period:

```tsx
                  <span className="text-[11px] font-semibold tabular-nums text-gray-400">{t(sublabelKey(period))}</span>
```

Replace the day-pills block (lines 99–110) so month/year collapse to a range string:

```tsx
              {j.days.length > 0 && (
                period === 'week' ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {j.days.map(k => {
                      const { weekday, day } = dayLabel(k);
                      return (
                        <span key={k} className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-gray-200/70 dark:bg-gray-700/70 text-gray-600 dark:text-gray-300">
                          {weekday} {day}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    {t('views.JobScheduling.JobsPanel.dayRange', { range: rangeLabel(j.days), count: j.days.length })}
                  </div>
                )
              )}
```

- [ ] **Step 6: Render compact rows**

Wrap the card body so compact mode renders a single line. Inside the `<li>` (after the colored bar `<span>` on line 91), branch on `compact`. Replace the card body (lines 92–173, everything between the colored-bar span and the closing `</li>`) with:

```tsx
              {compact ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: j.color }} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-sm text-gray-900 dark:text-white">{j.jobName}</span>
                  <span className="text-xs font-extrabold tabular-nums text-gray-900 dark:text-white shrink-0">
                    {j.estimate > 0 ? `${Math.min(j.assigned, j.required)} / ${j.required}h` : `${j.assigned} / ${j.assigned}h`}
                  </span>
                  {j.missing > 0 ? (
                    <span className="flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[11px] font-extrabold text-amber-700 dark:text-amber-300 shrink-0">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> {j.missing}h
                    </span>
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}
                </div>
              ) : (
                <>
                  {/* existing default-card body: title row, day indicator, progress bar,
                      hours + status, line items — lines 92–173 verbatim */}
                </>
              )}
```

Move the existing default-card markup (the `<div className="flex items-start gap-2">` title row through the line-items `{j.lineItems.length > 0 && (...)}` block) inside the `<>...</>` fragment in the `else` branch, applying the §Step 5 sublabel and day-range edits there.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run components/views/JobScheduling/JobsPanel.test.tsx`
Expected: PASS — new period + compact tests, and all pre-existing JobsPanel tests (default mode unchanged).

- [ ] **Step 8: Verify i18n parity**

Run: `npx vitest run i18n`
Expected: PASS — the catalog-integrity test confirms en/es keys match.

- [ ] **Step 9: Commit**

```bash
git add components/views/JobScheduling/JobsPanel.tsx components/views/JobScheduling/JobsPanel.test.tsx i18n/catalog.ts
git commit -m "feat(scheduling): JobsPanel period lens + compact mode"
```

---

### Task 4: Wire the period lens + compact toggle through to JobSchedulingView

Compute the sidebar's job list independently of the grid week, persist the two preferences, and pass everything down through `CrewHoursGrid`.

**Files:**
- Modify: `components/views/JobScheduling/CrewHoursGrid.tsx` (props + forwarding)
- Modify: `components/views/JobSchedulingView.tsx` (state, derived sidebar jobs, title, render props)

**Interfaces:**
- Consumes: `buildJobSummaries`, `periodDayKeys` (Task 2); `useLocalStorage` (Task 1); `JobsPanel` props `period`/`onPeriodChange`/`compact`/`onCompactChange` (Task 3).
- Produces: new optional `CrewHoursGrid` props `sidebarJobs?: JobSummary[]`, `sidebarPeriod?`, `onSidebarPeriodChange?`, `sidebarCompact?`, `onSidebarCompactChange?`.

- [ ] **Step 1: Add forwarding props to CrewHoursGrid**

In `components/views/JobScheduling/CrewHoursGrid.tsx`, import the type (line 2 already imports from the service — add `JobSummary`):

```typescript
import type { CrewHoursGridModel, MemberRow, MemberDayCell, JobSummary } from '../../../services/crewHoursGrid';
```

Add to `CrewHoursGridProps` (after `hideSidebar`, line 35):

```typescript
  /** Job list for the sidebar. When omitted, the grid's week jobs are used. Lets the
   *  sidebar show a different period (month/year) than the week grid. */
  sidebarJobs?: JobSummary[];
  sidebarPeriod?: 'week' | 'month' | 'year';
  onSidebarPeriodChange?: (p: 'week' | 'month' | 'year') => void;
  sidebarCompact?: boolean;
  onSidebarCompactChange?: (v: boolean) => void;
```

Destructure them in the component signature (after `hideSidebar = false,`, line 59):

```typescript
  sidebarJobs,
  sidebarPeriod,
  onSidebarPeriodChange,
  sidebarCompact,
  onSidebarCompactChange,
```

- [ ] **Step 2: Use the sidebar job list for the panel and the drag highlight**

Replace the `highlightDays` declaration (lines 70–72) with a shared list:

```typescript
  const sidebarJobList = sidebarJobs ?? model.jobs;
  const highlightDays = new Set(
    draggingJobId ? sidebarJobList.find(j => j.jobId === draggingJobId)?.days ?? [] : []
  );
```

Update the `<JobsPanel>` render (lines 233–240) to pass the list + new props:

```tsx
        <JobsPanel
          title={resolvedSidebarTitle}
          jobs={sidebarJobList}
          emptyLabel={resolvedSidebarEmptyLabel}
          allStaffedLabel={resolvedSidebarAllStaffedLabel}
          onSelectJob={onSelectJob}
          onDragJobChange={setDraggingJobId}
          period={sidebarPeriod}
          onPeriodChange={onSidebarPeriodChange}
          compact={sidebarCompact}
          onCompactChange={onSidebarCompactChange}
        />
```

- [ ] **Step 3: Add persisted state + derived sidebar jobs in JobSchedulingView**

In `components/views/JobSchedulingView.tsx`, add the import (near the other service imports for `buildCrewHoursGrid`):

```typescript
import { buildCrewHoursGrid, buildJobSummaries, periodDayKeys } from '../../services/crewHoursGrid';
import { useLocalStorage } from '../../hooks/useLocalStorage';
```

(If `buildCrewHoursGrid` is already imported, just add `buildJobSummaries, periodDayKeys` to that import and add the `useLocalStorage` line. Adjust the relative path to match the existing `buildCrewHoursGrid` import.)

Add state next to the other view toggles (after `scale`, line 198):

```typescript
  const [sidebarPeriod, setSidebarPeriod] = useLocalStorage<'week' | 'month' | 'year'>('jobScheduling.sidebar.period', 'week');
  const [sidebarCompact, setSidebarCompact] = useLocalStorage<boolean>('jobScheduling.sidebar.compact', false);
```

Add the derived sidebar job list after `hoursModel` (after line 597):

```typescript
  // Sidebar runs on its own period lens, independent of the week grid. Week reuses
  // the grid's weekDays; month/year span the calendar period and re-prorate hours.
  const sidebarDayKeys = useMemo(
    () => periodDayKeys(currentDate, sidebarPeriod, workConfig.weekendDays, weekDays.map(toLocalDateKey)),
    [currentDate, sidebarPeriod, workConfig.weekendDays, weekDays],
  );
  const sidebarJobs = useMemo(() => {
    const list = buildJobSummaries(displayJobs, workOrders, sidebarDayKeys, workConfig.weekendDays, capacityHours);
    if (sidebarPeriod === 'week') return list;
    // "What's coming up": chronological by earliest working day in the period.
    return [...list].sort((a, b) => (a.days[0] ?? '').localeCompare(b.days[0] ?? ''));
  }, [displayJobs, workOrders, sidebarDayKeys, workConfig.weekendDays, capacityHours, sidebarPeriod]);

  const sidebarTitle = useMemo(() => (
    sidebarPeriod === 'month' ? t('views.JobScheduling.CrewHoursGrid.jobsThisMonth')
    : sidebarPeriod === 'year' ? t('views.JobScheduling.CrewHoursGrid.jobsThisYear')
    : t('views.JobScheduling.CrewHoursGrid.jobsThisWeek')
  ), [sidebarPeriod, t]);
```

(`toLocalDateKey` is already imported in this file — it is used by `selectedDayKey`. `capacityHours` is the same value passed to `buildCrewHoursGrid` on line 595.)

- [ ] **Step 4: Pass the new props to the weekly CrewHoursGrid**

In the weekly-grid render (lines 1162–1173), add:

```tsx
          <CrewHoursGrid
            model={hoursModel}
            canEdit={canReschedule}
            weather={settings.scheduling?.mockWeather}
            onAssignWeek={(memberId) => { setAssignJobId(null); setAssignTaskId(null); setAssignLineItemName(null); setAssignMemberId(memberId); }}
            onEditDay={handleHoursEditDay}
            onRemoveDay={handleHoursRemoveDay}
            onDropJobOnMember={(memberId, jobId, taskId, lineItemName) => { setAssignJobId(jobId); setAssignTaskId(taskId ?? null); setAssignLineItemName(lineItemName ?? null); setAssignMemberId(memberId); }}
            onSelectJob={(id) => { const j = jobs.find(x => x.id === id); if (j) setSelectedJob(j); }}
            showAvailability={showAvailability}
            hideSidebar={panelOpen}
            sidebarTitle={sidebarTitle}
            sidebarJobs={sidebarJobs}
            sidebarPeriod={sidebarPeriod}
            onSidebarPeriodChange={setSidebarPeriod}
            sidebarCompact={sidebarCompact}
            onSidebarCompactChange={setSidebarCompact}
          />
```

(Leave the Day-view branch at line 1174+ and its `<JobsPanel>` at line 1243 unchanged — the period lens applies to the weekly grid only; the Day sidebar keeps its current behavior and still benefits from the denser default card.)

- [ ] **Step 5: Typecheck and run the full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS — no type errors; all suites green (hooks, crewHoursGrid, JobsPanel, i18n, plus existing).

- [ ] **Step 6: Manual smoke test**

Run the app (`npm run dev`), open Job Scheduling → Crew Member view → Hours mode. Verify:
- Sidebar shows the Week/Month/Year control and the compact icon.
- Switching to Month/Year changes the title, the sublabel ("this month"/"this year"), reprorated hours, the collapsed day-range, and the job list (sorted by start). The crew grid columns stay on the week.
- Toggling compact gives single-line rows; the choice survives a page reload (localStorage). Period choice also survives reload.
- Dragging a sidebar job onto a crew member still opens the Assign Hours modal.

- [ ] **Step 7: Commit**

```bash
git add components/views/JobScheduling/CrewHoursGrid.tsx components/views/JobSchedulingView.tsx
git commit -m "feat(scheduling): wire Jobs sidebar period lens + compact toggle"
```

---

## Self-Review

**Spec coverage:**
- Denser default card → already applied + preserved (Task 3 default branch). ✓
- Ultra-compact "single line, no bar" toggle, persisted → Task 3 compact branch + Task 1/4 persistence. ✓
- Week/Month/Year period selector, sidebar-only, calendar-based, anchored to grid's current date → Task 2 `periodDayKeys` + Task 4 derivation. ✓
- Full proration over the period, period sublabel → Task 2 `buildJobSummaries` + Task 3 sublabel. ✓
- Jobs sorted by soonest start in period → Task 4 sort. ✓
- Month/year day-range display instead of pills → Task 3 `rangeLabel`. ✓
- Header: title + segmented control + compact toggle + Hide staffed → Task 3 header. ✓
- Architecture: extract `buildJobSummaries`, `JobsPanel` gains props, grid unchanged → Tasks 2–4. ✓
- `useLocalStorage` persistence → Task 1. ✓
- i18n new keys → Task 3. ✓
- Tests for each unit → Tasks 1–3 (Task 4 covered by tsc + full suite + manual). ✓

**Placeholder scan:** Only intentional reference is "lines 92–173 verbatim" in Task 3 Step 6 — the surrounding steps specify exactly which markup moves and the edits to apply; acceptable since the source is the current file the implementer is editing.

**Type consistency:** `buildJobSummaries(jobs, workOrders, dayKeys, weekendDays, standardDay?)` and `periodDayKeys(currentDate, period, weekendDays, weekDayKeys)` are referenced identically in Tasks 2 and 4. `JobSummary` shape unchanged. Period union `'week' | 'month' | 'year'` consistent across JobsPanel, CrewHoursGrid, and JobSchedulingView. Setter names `setSidebarPeriod` / `setSidebarCompact` match the `useLocalStorage` tuple from Task 1.
