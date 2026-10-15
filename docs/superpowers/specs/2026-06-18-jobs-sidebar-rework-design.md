# Jobs Sidebar Rework — Design

**Date:** 2026-06-18
**Component:** `components/views/JobScheduling/JobsPanel.tsx` (the "Jobs This Week" sidebar)

## Goal

Rework the Jobs sidebar on the Job Scheduling page so it (1) fits more cards on
screen via a denser default card plus an ultra-compact toggle, and (2) becomes an
independent "what's coming up" lens with a Week / Month / Year period selector.

## Scope

- **In scope:** `JobsPanel` layout/density, a compact-mode toggle, a period
  selector (Week/Month/Year), the data plumbing to compute job summaries for an
  arbitrary period independent of the crew grid's week, and a small reusable
  `useLocalStorage` hook to persist the two new preferences.
- **Out of scope:** the crew hours grid itself (its columns stay on the week),
  the existing grid-level day/week/month `scale`, drag-to-assign mechanics,
  and any change to how hours are stored.

## Background (current behavior)

- `JobsPanel` receives `jobs: JobSummary[]` and renders draggable cards. Today's
  card shows: color bar, title, job number, day pills, progress bar,
  `assigned / required h` + "this week" sublabel, a missing/staffed chip, and an
  expandable Line Items row.
- The sidebar shares **one** model with the grid: `buildCrewHoursGrid(... weekDays ...)`
  in `services/crewHoursGrid.ts` returns `{ rows, jobs, dayKeys, dayTotals }`, and
  `CrewHoursGrid` passes `model.jobs` straight into `JobsPanel`. So the sidebar is
  always scoped to the grid's current week.
- `JobSummary` fields: `jobId, jobNumber, jobName, address, color, estimate,
  required, assigned, missing, days[], lineItems[]`. `required` is the work-order
  estimate prorated to the in-scope working days; `assigned` is hours booked across
  crew in scope; `missing = max(0, required - assigned)` (0 when `estimate === 0`).
- No reusable persistence exists. UI toggles (incl. the grid `scale`) are ephemeral
  `useState`; only two unrelated places use raw `localStorage`.

## Design

### 1. Two display modes

**Denser default card** — applied to everyone (the baseline gets tighter, no toggle
required to benefit). Keeps all information:
- Color bar (left), title + job number, thin progress bar, `assigned / required h`
  headline with the period sublabel, missing/staffed chip, expandable Line Items.
- Tighter spacing than today (continues the spacing pass already started: `gap-2`
  between cards, reduced section margins, `text-sm` hours headline, slimmer chips).
- **Day indicator adapts to period** (see §3): Week view shows day pills
  (MON 15, TUE 16…); Month/Year view collapses them to a compact range string
  derived from `JobSummary.days`, e.g. `Mar 3–28 · 8 days` (avoids rendering dozens
  of pills).

**Ultra-compact mode** — the toggle ("single line, no bar"):
- One line per job: `● Name … 51/85h ⚠ 34h` — color dot, truncated name, hours,
  compact status chip. No progress bar, no pills, no line items.
- Row stays **draggable** (assign whole job to crew) and **clickable** (select job).
- Line-item drag is unavailable in compact mode — that is the accepted trade-off for
  density; users switch to the default mode to drag individual line items.

A small icon toggle in the header switches modes. Mode persists per user.

### 2. Header layout

- **Title row:** `Jobs This Week` / `Jobs This Month` / `Jobs This Year` (new i18n
  keys; the existing `jobsThisWeek` key is reused for Week).
- **Controls row (one tight strip):** the Week·Month·Year segmented control, the
  compact-mode icon toggle, and the existing "Hide staffed" toggle. Kept compact so
  it does not eat the vertical space the rework is trying to reclaim.

### 3. Period lens (Week / Month / Year)

- Sidebar-only. The crew grid keeps its own week; this control does not touch it.
- **Calendar-based, anchored to the grid's current date** (`currentDate` in
  `JobSchedulingView`):
  - Week = the working days of the grid's current week (today's behavior).
  - Month = the calendar month containing `currentDate`.
  - Year = the calendar year containing `currentDate`.
  - Navigating the grid moves the lens with it.
- **Hours use full proration** to the period: `assigned / required h` over the
  period's working days, with the same missing/staffed badge logic. Sublabel reads
  "this week" / "this month" / "this year".
- **Jobs shown** = jobs whose working days intersect the period, **sorted by soonest
  start within the period** (chronological "what's coming up"). Week view keeps its
  current ordering.
- Selected period persists per user.

### 4. Architecture

**Extract job-summary building into its own function.** Today the `JobSummary[]`
is produced inside `buildCrewHoursGrid` (lines ~394–405) using only
`jobs`, `workOrders`, `dayKeys`, `weekendDays`, `standardDay` — it does not depend on
the member rows. Pull that block (plus the `jobsScheduledInWeek` filter at line ~348)
into:

```ts
export const buildJobSummaries = (
  jobs: Job[],
  workOrders: WorkOrder[],
  dayKeys: string[],
  weekendDays: number[],
  standardDay: number,
): JobSummary[]
```

`buildCrewHoursGrid` calls `buildJobSummaries(jobs, workOrders, dayKeys, ...)` for its
week (no behavior change — same output). The sidebar calls it independently with its
own period day-key range.

**Period day-keys.** Add a helper that, given `currentDate`, a period, and the work
config, returns the working-day keys for that period:
```ts
periodDayKeys(currentDate: Date, period: 'week' | 'month' | 'year', workConfig): string[]
```
Week reuses the existing `getWeekDays` + `visibleWeekDays`; Month/Year enumerate the
calendar period's days filtered to working days. Year ≈ 365 keys × jobs × members in
the proration loops — acceptable for typical job counts (note for verification).

**Wiring in `JobSchedulingView`.** The sidebar's job list is computed from
`buildJobSummaries(displayJobs, workOrders, periodDayKeys(currentDate, sidebarPeriod, ...))`,
sorted by soonest start in the period, then passed to `CrewHoursGrid` →
`JobsPanel`. The grid model is unchanged.

**`JobsPanel` props.** Add:
- `period: 'week' | 'month' | 'year'` and `onPeriodChange`
- `compact: boolean` and `onCompactChange`
- (`title` continues to be supplied by the parent and now reflects the period.)

Internal `hideStaffed`/`expandedJobs`/`draggingJobId` state is unchanged. In compact
mode, line-item expansion is simply not rendered.

**Persistence.** Add `hooks/useLocalStorage.ts`:
```ts
export function useLocalStorage<T>(key: string, initial: T): readonly [T, (v: T) => void]
```
Lazy-init from `localStorage` (try/catch), write on change. Persist:
- `jobScheduling.sidebar.period` → `'week' | 'month' | 'year'`
- `jobScheduling.sidebar.compact` → `boolean`
These live in `JobSchedulingView` (the owner of `currentDate` and the parent of the
panel).

### 5. i18n

New keys under `views.JobScheduling`:
- `JobsPanel.thisMonth` = "this month", `JobsPanel.thisYear` = "this year"
- `CrewHoursGrid.jobsThisMonth` = "Jobs This Month",
  `CrewHoursGrid.jobsThisYear` = "Jobs This Year"
- Period control labels: `JobsPanel.periodWeek/periodMonth/periodYear`
  = "Week" / "Month" / "Year"
- Compact toggle label/aria: `JobsPanel.compactView` = "Compact view"
- Day-range string for Month/Year (e.g. `JobsPanel.dayRange` = "{range} · {count} days")
Reuse existing `CrewHoursGrid.jobsThisWeek` for Week.

## Testing

- **`buildJobSummaries` unit tests** (`services/crewHoursGrid.test.ts`): extracting
  the function must not change week output — assert parity with prior
  `buildCrewHoursGrid(...).jobs`. Add cases for a multi-week job prorated across a
  month and a year (required scales with in-period working days; jobs outside the
  period are excluded).
- **`periodDayKeys`**: week/month/year key sets, working-day filtering, month/year
  boundaries around `currentDate`.
- **`JobsPanel` tests** (`JobsPanel.test.tsx`): renders period sublabel per period;
  compact mode renders single-line rows with no progress bar / pills / line-items but
  stays draggable; default mode shows the day-range string in Month/Year and pills in
  Week; period + compact controls fire their callbacks.
- **`useLocalStorage`**: reads initial, persists on change, tolerates malformed JSON.

## Trade-offs / decisions

- Sidebar period is **independent** of the grid; the grid stays on the week. (Chosen
  over coupling them into one page-wide scale.)
- Month/Year keep **full hours proration** (chosen over counts-only).
- Compact mode **drops line-item drag** for maximum density; default mode retains it.
- Persistence via a new minimal `useLocalStorage` hook (no store library exists).
