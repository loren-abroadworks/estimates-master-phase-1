# Rich Reschedule Preview Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the thin reschedule bottom bar with a rich, bottom-docked multi-column preview panel — Schedule Impact, an interactive Delay-by control, a before/after Preview Timeline, and a Smart Suggestions card (auto-fix, weather, customer updates) — all wired to real data.

**Architecture:** A new pure service `rescheduleImpact.ts` derives all summary data from the existing `ProposedChange[]` plus jobs/crews/clients/weather. `StagedReschedule` gains optional `delayDays`/`recompute` so cascade reschedules can be re-run live via the existing `shiftJobsFromPoint` engine. `JobSchedulingView` computes impact and supplies the recompute closure; the rewritten `ReschedulePreviewPanel` (plus `PreviewTimeline` and `SmartSuggestionsCard` subcomponents) renders the layout and holds local UI state.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react, Tailwind utility classes, lucide-react icons.

---

## File Structure

- **Create** `services/rescheduleImpact.ts` — pure impact computation + customer-message builder.
- **Create** `services/rescheduleImpact.test.ts` — unit tests for the above.
- **Modify** `services/reschedulePreview.ts` — add optional `delayDays` / `recompute` to `StagedReschedule`.
- **Create** `components/views/JobScheduling/PreviewTimeline.tsx` — before/after mini-gantt.
- **Create** `components/views/JobScheduling/SmartSuggestionsCard.tsx` — auto-fix / weather / customer sub-cards.
- **Rewrite** `components/views/JobScheduling/ReschedulePreviewPanel.tsx` — multi-column layout container.
- **Create** `components/views/JobScheduling/ReschedulePreviewPanel.test.tsx` — render tests.
- **Modify** `components/views/JobSchedulingView.tsx` — compute impact, wire delay recompute, pass props.

A note on conventions to mirror (read before starting):
- `services/rescheduleIssues.test.ts` and `services/productionBoard.test.ts` show the project's Vitest style (fixed ISO date strings, `describe`/`it`, plain `expect`).
- `components/views/JobScheduling/JobDetailsPanel.test.tsx` shows the React render-test style (`render`, `screen`, `fireEvent`/`userEvent`).
- `services/scheduleEngine.ts` exports `shiftJobsFromPoint`, `toLocalDateKey`, `configFromSettings`, and the `ProposedChange` type.

---

## Task 1: `computeImpact` core counts

**Files:**
- Create: `services/rescheduleImpact.ts`
- Test: `services/rescheduleImpact.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { computeImpact } from './rescheduleImpact';
import type { ProposedChange } from './scheduleEngine';
import type { Job, CrewGroup, Client, WeatherKind } from '../types';

const change = (over: Partial<ProposedChange>): ProposedChange => ({
  jobId: 'j1', jobName: 'Job 1', jobNumber: '0001',
  oldStart: '2026-06-02T08:00:00.000Z', oldEnd: '2026-06-02T16:00:00.000Z',
  newStart: '2026-06-04T08:00:00.000Z', newEnd: '2026-06-04T16:00:00.000Z',
  ...over,
});

describe('computeImpact', () => {
  it('counts non-skipped changes and locked rows, and finds the latest new end date', () => {
    const changes: ProposedChange[] = [
      change({ jobId: 'a', newEnd: '2026-06-04T16:00:00.000Z' }),
      change({ jobId: 'b', newEnd: '2026-06-09T16:00:00.000Z' }),
      change({ jobId: 'c', skipped: 'locked', newStart: '', newEnd: '' }),
    ];
    const impact = computeImpact(changes, [], [], [], {});
    expect(impact.jobsAffected).toBe(2);
    expect(impact.lockedCount).toBe(1);
    expect(impact.newEndDate).toBe('2026-06-09T16:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/rescheduleImpact.test.ts`
Expected: FAIL — `computeImpact` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Job, CrewGroup, Client, WeatherKind } from '../types';
import type { ProposedChange } from './scheduleEngine';
import { toLocalDateKey } from './scheduleEngine';

const MS_PER_DAY = 86_400_000;

export interface WeatherHit { dateKey: string; kind: WeatherKind; jobCount: number; }
export interface CustomerUpdate {
  clientId: string; clientName: string; jobName: string;
  oldStart: string | null; newStart: string;
}
export interface RescheduleImpact {
  jobsAffected: number;
  crewsAffected: number;
  totalDelayDays: number;
  newEndDate: string | null;
  lockedCount: number;
  weatherHits: WeatherHit[];
  customerUpdates: CustomerUpdate[];
}

export const computeImpact = (
  changes: ProposedChange[],
  jobs: Job[],
  crews: CrewGroup[],
  clients: Client[],
  mockWeather: Record<string, WeatherKind>,
): RescheduleImpact => {
  const changed = changes.filter(c => !c.skipped);
  const lockedCount = changes.filter(c => c.skipped === 'locked').length;

  let newEndDate: string | null = null;
  for (const c of changed) {
    if (c.newEnd && (!newEndDate || c.newEnd > newEndDate)) newEndDate = c.newEnd;
  }

  return {
    jobsAffected: changed.length,
    crewsAffected: 0,
    totalDelayDays: 0,
    newEndDate,
    lockedCount,
    weatherHits: [],
    customerUpdates: [],
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/rescheduleImpact.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/rescheduleImpact.ts services/rescheduleImpact.test.ts
git commit -m "feat: computeImpact core counts (jobs affected, locked, new end date)"
```

---

## Task 2: `totalDelayDays` (max calendar-day delta)

**Files:**
- Modify: `services/rescheduleImpact.ts`
- Test: `services/rescheduleImpact.test.ts`

- [ ] **Step 1: Write the failing test**

Append to the `describe('computeImpact', ...)` block:

```ts
it('reports the largest calendar-day delay across changed jobs', () => {
  const changes: ProposedChange[] = [
    change({ jobId: 'a', oldStart: '2026-06-02T08:00:00.000Z', newStart: '2026-06-04T08:00:00.000Z' }), // +2
    change({ jobId: 'b', oldStart: '2026-06-02T08:00:00.000Z', newStart: '2026-06-07T08:00:00.000Z' }), // +5
  ];
  expect(computeImpact(changes, [], [], [], {}).totalDelayDays).toBe(5);
});

it('treats a missing oldStart as zero delay', () => {
  const changes: ProposedChange[] = [change({ jobId: 'a', oldStart: null })];
  expect(computeImpact(changes, [], [], [], {}).totalDelayDays).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/rescheduleImpact.test.ts`
Expected: FAIL — `totalDelayDays` is `0`, expected `5`.

- [ ] **Step 3: Write minimal implementation**

In `computeImpact`, replace `totalDelayDays: 0,` with a computed value. Add before the `return`:

```ts
  let totalDelayDays = 0;
  for (const c of changed) {
    if (!c.oldStart || !c.newStart) continue;
    const deltaDays = Math.round(
      (new Date(c.newStart).getTime() - new Date(c.oldStart).getTime()) / MS_PER_DAY,
    );
    if (deltaDays > totalDelayDays) totalDelayDays = deltaDays;
  }
```

And use it: `totalDelayDays,` in the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/rescheduleImpact.test.ts`
Expected: PASS (all three tests).

- [ ] **Step 5: Commit**

```bash
git add services/rescheduleImpact.ts services/rescheduleImpact.test.ts
git commit -m "feat: computeImpact totalDelayDays"
```

---

## Task 3: `crewsAffected` (distinct crew groups)

**Files:**
- Modify: `services/rescheduleImpact.ts`
- Test: `services/rescheduleImpact.test.ts`

Note: jobs reference crews inconsistently (`crewGroupId`, `crewGroupIds`, or none). Coalesce all forms.

- [ ] **Step 1: Write the failing test**

```ts
it('counts distinct crew groups among changed jobs', () => {
  const jobs = [
    { id: 'a', crewGroupId: 'crew1' },
    { id: 'b', crewGroupIds: ['crew1', 'crew2'] },
    { id: 'c', crewGroupId: 'crew3' },
  ] as unknown as Job[];
  const changes: ProposedChange[] = [
    change({ jobId: 'a' }), change({ jobId: 'b' }), change({ jobId: 'c' }),
  ];
  expect(computeImpact(changes, jobs, [], [], {}).crewsAffected).toBe(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/rescheduleImpact.test.ts`
Expected: FAIL — `crewsAffected` is `0`, expected `3`.

- [ ] **Step 3: Write minimal implementation**

Add a helper near the top of the file:

```ts
const crewIdsOf = (job: Job | undefined): string[] => {
  if (!job) return [];
  if (job.crewGroupIds?.length) return job.crewGroupIds;
  if (job.crewGroupId) return [job.crewGroupId];
  return [];
};
```

In `computeImpact`, build a job lookup and accumulate crew ids. Add before the `return`:

```ts
  const jobById = new Map(jobs.map(j => [j.id, j]));
  const crewSet = new Set<string>();
  for (const c of changed) crewIdsOf(jobById.get(c.jobId)).forEach(id => crewSet.add(id));
```

Use it: `crewsAffected: crewSet.size,`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/rescheduleImpact.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/rescheduleImpact.ts services/rescheduleImpact.test.ts
git commit -m "feat: computeImpact crewsAffected"
```

---

## Task 4: `weatherHits` (changed jobs on rain/storm days)

**Files:**
- Modify: `services/rescheduleImpact.ts`
- Test: `services/rescheduleImpact.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('reports rain/storm/snow days that changed jobs land on, with job counts', () => {
  // newStart for the default change() is 2026-06-04 (local). Use toLocalDateKey to match.
  const changes: ProposedChange[] = [
    change({ jobId: 'a', newStart: '2026-06-04T08:00:00.000Z' }),
    change({ jobId: 'b', newStart: '2026-06-04T08:00:00.000Z' }),
    change({ jobId: 'c', newStart: '2026-06-05T08:00:00.000Z' }),
  ];
  const keyA = toLocalDateKeyExport(changes[0].newStart); // see helper note below
  const keyC = toLocalDateKeyExport(changes[2].newStart);
  const weather = { [keyA]: 'rain' as WeatherKind, [keyC]: 'clear' as WeatherKind };
  const hits = computeImpact(changes, [], [], [], weather).weatherHits;
  expect(hits).toHaveLength(1);
  expect(hits[0]).toMatchObject({ dateKey: keyA, kind: 'rain', jobCount: 2 });
});
```

Add this import helper line at the top of the test file (so the test computes keys the same way the impl does):

```ts
import { toLocalDateKey } from './scheduleEngine';
const toLocalDateKeyExport = (iso: string) => toLocalDateKey(new Date(iso));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/rescheduleImpact.test.ts`
Expected: FAIL — `weatherHits` is empty.

- [ ] **Step 3: Write minimal implementation**

Add before the `return` in `computeImpact`:

```ts
  const badWeather = new Set<WeatherKind>(['rain', 'storm', 'snow']);
  const hitCounts = new Map<string, { kind: WeatherKind; jobCount: number }>();
  for (const c of changed) {
    if (!c.newStart) continue;
    const key = toLocalDateKey(new Date(c.newStart));
    const kind = mockWeather[key];
    if (!kind || !badWeather.has(kind)) continue;
    const prev = hitCounts.get(key);
    hitCounts.set(key, { kind, jobCount: (prev?.jobCount ?? 0) + 1 });
  }
  const weatherHits: WeatherHit[] = [...hitCounts.entries()]
    .map(([dateKey, v]) => ({ dateKey, kind: v.kind, jobCount: v.jobCount }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
```

Use it: `weatherHits,`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/rescheduleImpact.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/rescheduleImpact.ts services/rescheduleImpact.test.ts
git commit -m "feat: computeImpact weatherHits"
```

---

## Task 5: `customerUpdates` + `buildCustomerMessages`

**Files:**
- Modify: `services/rescheduleImpact.ts`
- Test: `services/rescheduleImpact.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildCustomerMessages } from './rescheduleImpact';

it('builds one customer update per changed job, resolving client names', () => {
  const jobs = [
    { id: 'a', name: 'Exterior Repaint', clientId: 'cl1' },
    { id: 'b', name: 'Deck Stain', clientId: 'cl2' },
  ] as unknown as Job[];
  const clients = [
    { id: 'cl1', name: 'Acme Co' }, { id: 'cl2', name: 'Beta LLC' },
  ] as unknown as Client[];
  const changes: ProposedChange[] = [
    change({ jobId: 'a', jobName: 'Exterior Repaint' }),
    change({ jobId: 'b', jobName: 'Deck Stain' }),
  ];
  const updates = computeImpact(changes, jobs, [], clients, {}).customerUpdates;
  expect(updates).toHaveLength(2);
  expect(updates[0]).toMatchObject({ clientId: 'cl1', clientName: 'Acme Co', jobName: 'Exterior Repaint' });
});

it('buildCustomerMessages renders a message string per update', () => {
  const messages = buildCustomerMessages([
    { clientId: 'cl1', clientName: 'Acme Co', jobName: 'Exterior Repaint',
      oldStart: '2026-06-02T08:00:00.000Z', newStart: '2026-06-04T08:00:00.000Z' },
  ]);
  expect(messages).toHaveLength(1);
  expect(messages[0].clientName).toBe('Acme Co');
  expect(messages[0].message).toContain('Exterior Repaint');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/rescheduleImpact.test.ts`
Expected: FAIL — `customerUpdates` empty / `buildCustomerMessages` not exported.

- [ ] **Step 3: Write minimal implementation**

Add before the `return` in `computeImpact`:

```ts
  const clientById = new Map(clients.map(cl => [cl.id, cl]));
  const customerUpdates: CustomerUpdate[] = changed.map(c => {
    const job = jobById.get(c.jobId);
    const client = job ? clientById.get(job.clientId) : undefined;
    return {
      clientId: job?.clientId ?? '',
      clientName: client?.name ?? 'Customer',
      jobName: c.jobName,
      oldStart: c.oldStart,
      newStart: c.newStart,
    };
  });
```

Use it: `customerUpdates,`. Then append the exported builder at the end of the file:

```ts
const fmtDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'TBD';

export const buildCustomerMessages = (
  updates: CustomerUpdate[],
): { clientName: string; message: string }[] =>
  updates.map(u => ({
    clientName: u.clientName,
    message: `Hi ${u.clientName}, your job "${u.jobName}" has been rescheduled from ${fmtDay(u.oldStart)} to ${fmtDay(u.newStart)}.`,
  }));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/rescheduleImpact.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add services/rescheduleImpact.ts services/rescheduleImpact.test.ts
git commit -m "feat: computeImpact customerUpdates + buildCustomerMessages"
```

---

## Task 6: Extend `StagedReschedule` with delay re-run hooks

**Files:**
- Modify: `services/reschedulePreview.ts`

- [ ] **Step 1: Add the optional fields**

In `services/reschedulePreview.ts`, extend the `StagedReschedule` interface:

```ts
export interface StagedReschedule {
  /** Proposed changes to preview (includes skipped/informational rows). */
  changes: ProposedChange[];
  /** Human label, reused as the undo/toast label on commit. */
  label: string;
  /** Performs the actual commit + side effects (calls App.handleApplySchedule). */
  commit: (effective: ProposedChange[]) => void;
  /** Current delay (days) for cascade reschedules; seeds the Delay-by control. */
  delayDays?: number;
  /** Re-runs the reschedule at a new delay; absent for non-cascade moves. */
  recompute?: (delayDays: number) => ProposedChange[];
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run lint`
Expected: PASS (no errors). Existing `preview.stage({...})` calls remain valid because both new fields are optional.

- [ ] **Step 3: Commit**

```bash
git add services/reschedulePreview.ts
git commit -m "feat: StagedReschedule delayDays + recompute hooks"
```

---

## Task 7: `PreviewTimeline` subcomponent

**Files:**
- Create: `components/views/JobScheduling/PreviewTimeline.tsx`

- [ ] **Step 1: Implement the component**

```tsx
import React from 'react';
import type { ProposedChange } from '../../../services/scheduleEngine';

interface PreviewTimelineProps {
  changes: ProposedChange[];
}

const MS_PER_DAY = 86_400_000;

const dayIndex = (iso: string, min: number) =>
  Math.round((new Date(iso).getTime() - min) / MS_PER_DAY);

export const PreviewTimeline = ({ changes }: PreviewTimelineProps) => {
  const changed = changes.filter(c => !c.skipped && c.newStart);
  if (changed.length === 0) return null;

  // Compute the min/max day across all old + new starts to scale the lanes.
  const stamps: number[] = [];
  changed.forEach(c => {
    if (c.oldStart) stamps.push(new Date(c.oldStart).getTime());
    stamps.push(new Date(c.newStart).getTime());
  });
  const min = Math.min(...stamps);
  const max = Math.max(...stamps);
  const span = Math.max(1, Math.round((max - min) / MS_PER_DAY)) + 1;

  const Bar = ({ start, label }: { start: string | null; label: string }) => (
    <div className="relative h-6 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
      {changed.map((c, i) => {
        const iso = label === 'Before' ? c.oldStart : c.newStart;
        if (!iso) return null;
        const idx = dayIndex(iso, min);
        return (
          <div
            key={c.jobId}
            className="absolute top-0.5 h-5 rounded"
            style={{
              left: `${(idx / span) * 100}%`,
              width: `${(1 / span) * 100}%`,
              backgroundColor: ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b'][i % 4],
            }}
            title={`${c.jobName}`}
          />
        );
      })}
    </div>
  );

  return (
    <div className="space-y-2 min-w-[180px]">
      <div className="text-xs font-black uppercase tracking-widest text-gray-400">Preview Timeline</div>
      <div className="flex items-center gap-2">
        <span className="w-14 text-[11px] font-semibold text-gray-500">Before</span>
        <div className="flex-1"><Bar start={null} label="Before" /></div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-14 text-[11px] font-semibold text-gray-500">After</span>
        <div className="flex-1"><Bar start={null} label="After" /></div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobScheduling/PreviewTimeline.tsx
git commit -m "feat: PreviewTimeline before/after mini-gantt"
```

---

## Task 8: `SmartSuggestionsCard` subcomponent

**Files:**
- Create: `components/views/JobScheduling/SmartSuggestionsCard.tsx`

- [ ] **Step 1: Implement the component**

```tsx
import React, { useState } from 'react';
import { Sparkles, CloudRain, Mail, Wand2 } from 'lucide-react';
import type { RescheduleImpact } from '../../../services/rescheduleImpact';
import { buildCustomerMessages } from '../../../services/rescheduleImpact';

interface SmartSuggestionsCardProps {
  impact: RescheduleImpact;
  hasSuggestions: boolean;
  onAutoFix: () => void;
}

export const SmartSuggestionsCard = ({ impact, hasSuggestions, onAutoFix }: SmartSuggestionsCardProps) => {
  const [showWeather, setShowWeather] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  const hasWeather = impact.weatherHits.length > 0;
  const hasCustomers = impact.customerUpdates.length > 0;
  if (!hasSuggestions && !hasWeather && !hasCustomers) return null;

  const messages = buildCustomerMessages(impact.customerUpdates);
  const fmtDay = (key: string) =>
    new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });

  return (
    <div className="w-full lg:w-72 shrink-0 space-y-3 rounded-2xl border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white">
        <Sparkles className="w-4 h-4 text-primary-500" /> Smart Suggestions
      </div>

      {hasSuggestions && (
        <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/50 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Auto-Fix Recommended</div>
              <div className="text-xs text-gray-500">Let us automatically resolve conflicts and optimize the schedule.</div>
            </div>
            <button onClick={onAutoFix} className="shrink-0 inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30">
              <Wand2 className="w-3 h-3" /> Fix For Me
            </button>
          </div>
        </div>
      )}

      {hasWeather && (
        <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <CloudRain className="w-4 h-4 text-blue-500 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">Weather Alert</div>
                <div className="text-xs text-gray-500">
                  Bad weather on {impact.weatherHits.map(h => fmtDay(h.dateKey)).join(' & ')} — {impact.weatherHits.reduce((n, h) => n + h.jobCount, 0)} job(s) affected.
                </div>
              </div>
            </div>
            <button onClick={() => setShowWeather(s => !s)} className="shrink-0 text-xs font-bold px-2 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30">
              View Weather
            </button>
          </div>
          {showWeather && (
            <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
              {impact.weatherHits.map(h => (
                <li key={h.dateKey} className="flex justify-between">
                  <span>{fmtDay(h.dateKey)} ({h.dateKey})</span>
                  <span className="capitalize font-semibold">{h.kind}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasCustomers && (
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <Mail className="w-4 h-4 text-gray-500 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">Customer Updates</div>
                <div className="text-xs text-gray-500">{impact.customerUpdates.length} customer(s) will be notified of schedule changes.</div>
              </div>
            </div>
            <button onClick={() => setShowMessages(s => !s)} className="shrink-0 text-xs font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
              Preview Messages
            </button>
          </div>
          {showMessages && (
            <ul className="mt-2 space-y-2 text-xs text-gray-600 dark:text-gray-300">
              {messages.map((m, i) => (
                <li key={i} className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
                  <div className="font-semibold">{m.clientName}</div>
                  <div>{m.message}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobScheduling/SmartSuggestionsCard.tsx
git commit -m "feat: SmartSuggestionsCard (auto-fix, weather, customer updates)"
```

---

## Task 9: Rewrite `ReschedulePreviewPanel` layout

**Files:**
- Modify (rewrite): `components/views/JobScheduling/ReschedulePreviewPanel.tsx`

- [ ] **Step 1: Replace the component**

```tsx
import React, { useEffect, useState } from 'react';
import { ArrowRight, AlertCircle, Lock, Calendar, X } from 'lucide-react';
import { Button, Badge } from '../../UI';
import { StagedReschedule, summarizeStaged } from '../../../services/reschedulePreview';
import { ScheduleIssue } from '../../../services/rescheduleIssues';
import { Suggestion } from '../../../services/rescheduleSuggestions';
import { RescheduleImpact } from '../../../services/rescheduleImpact';
import { PreviewTimeline } from './PreviewTimeline';
import { SmartSuggestionsCard } from './SmartSuggestionsCard';

interface ReschedulePreviewPanelProps {
  staged: StagedReschedule | null;
  issues: ScheduleIssue[];
  suggestions: Suggestion[];
  impact: RescheduleImpact;
  onApply: () => void;
  onCancel: () => void;
  onAutoFix: () => void;
  onChangeDelay?: (days: number) => void;
}

const DELAY_OPTIONS = [1, 2, 3, 5, 7];

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export const ReschedulePreviewPanel = ({
  staged, issues, suggestions, impact, onApply, onCancel, onAutoFix, onChangeDelay,
}: ReschedulePreviewPanelProps) => {
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => { if (!staged) setReviewing(false); }, [staged]);

  if (!staged) return null;
  const canReview = issues.length > 0;
  const { changedCount, skippedCount } = summarizeStaged(staged.changes);
  const changed = staged.changes.filter(c => !c.skipped);
  const canDelay = !!staged.recompute && !!onChangeDelay;
  const delayDays = staged.delayDays ?? impact.totalDelayDays;

  const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-6 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-black text-gray-900 dark:text-white">{value}</span>
    </div>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:left-[104px] z-40 bg-white dark:bg-gray-900 border-t-2 border-primary-500 shadow-2xl max-h-[55vh] overflow-y-auto">
      <div className="max-w-[1400px] mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-500" />
            <h3 className="font-black text-gray-900 dark:text-white">Reschedule Preview</h3>
            <Badge>{staged.label}</Badge>
            <span className="text-xs text-gray-500">{changedCount} changing{skippedCount ? ` · ${skippedCount} skipped` : ''}</span>
          </div>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        {/* Columns */}
        <div className="flex flex-wrap gap-6 mt-3 mb-4">
          {/* Column 1: Delay + Impact */}
          <div className="space-y-3 min-w-[180px]">
            {canDelay && (
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Delay by</div>
                <select
                  value={delayDays}
                  onChange={e => onChangeDelay!(Number(e.target.value))}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-bold"
                >
                  {DELAY_OPTIONS.map(d => <option key={d} value={d}>{d} Day{d === 1 ? '' : 's'}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Schedule Impact</div>
              <Stat label="Jobs Affected" value={impact.jobsAffected} />
              <Stat label="Crews Affected" value={impact.crewsAffected} />
              <Stat label="Total Delay" value={`${impact.totalDelayDays} Day${impact.totalDelayDays === 1 ? '' : 's'}`} />
              <Stat label="New End Date" value={fmtDate(impact.newEndDate)} />
            </div>
          </div>

          {/* Column 2: Potential Issues */}
          <div className="space-y-1 min-w-[220px] flex-1">
            <div className="text-xs font-black uppercase tracking-widest text-gray-400">Potential Issues</div>
            {issues.length === 0 && impact.lockedCount === 0 && (
              <div className="text-sm text-gray-400">No issues detected.</div>
            )}
            {issues.map((iss, i) => (
              <div key={`${iss.jobId}-${iss.kind}-${i}`} className="flex items-center gap-2 text-sm">
                <span className={iss.severity === 'high' ? 'text-red-500' : iss.severity === 'medium' ? 'text-amber-500' : 'text-gray-400'}>
                  <AlertCircle className="w-4 h-4" />
                </span>
                <span className="text-gray-700 dark:text-gray-200">{iss.message}</span>
              </div>
            ))}
            {impact.lockedCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Lock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700 dark:text-gray-200">{impact.lockedCount} locked job{impact.lockedCount === 1 ? '' : 's'} will not move</span>
              </div>
            )}
            {canReview && (
              <button onClick={() => setReviewing(r => !r)} className="text-xs font-bold text-primary-600 hover:underline mt-1">
                {reviewing ? 'Hide Details' : 'View Details'}
              </button>
            )}
          </div>

          {/* Column 3: Timeline */}
          <PreviewTimeline changes={staged.changes} />

          {/* Column 4: Smart Suggestions */}
          <SmartSuggestionsCard impact={impact} hasSuggestions={suggestions.length > 0} onAutoFix={onAutoFix} />
        </div>

        {/* Manual review detail */}
        {reviewing && canReview && (
          <div className="mb-4 border rounded-lg border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
            {changed.map(c => {
              const jobIssues = issues.filter(i => i.jobId === c.jobId);
              return (
                <div key={`rev-${c.jobId}`} className="p-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-bold w-40 truncate">{c.jobName}</span>
                    <span className="text-gray-400">{fmt(c.oldStart)}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <span className="text-primary-600 dark:text-primary-400">{fmt(c.newStart)}</span>
                  </div>
                  {jobIssues.map((iss, i) => (
                    <div key={i} className="ml-1 mt-1 text-xs text-amber-600 dark:text-amber-400">• {iss.message}</div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2">
          {canReview && (
            <Button variant="ghost" onClick={() => setReviewing(r => !r)}>{reviewing ? 'Hide details' : 'Review Manually'}</Button>
          )}
          {suggestions.length > 0 && (
            <Button variant="secondary" onClick={onAutoFix}>Auto-Fix Issues</Button>
          )}
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={onApply} disabled={changedCount === 0}>Apply Changes</Button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run lint`
Expected: FAIL — `JobSchedulingView` does not yet pass `impact`. That is fixed in Task 11. (If you want a green checkpoint now, proceed to Task 11 before committing.)

- [ ] **Step 3: Commit (after Task 11 makes lint pass)**

```bash
git add components/views/JobScheduling/ReschedulePreviewPanel.tsx
git commit -m "feat: rich multi-column ReschedulePreviewPanel layout"
```

---

## Task 10: Render tests for the panel

**Files:**
- Create: `components/views/JobScheduling/ReschedulePreviewPanel.test.tsx`

- [ ] **Step 1: Write the tests**

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReschedulePreviewPanel } from './ReschedulePreviewPanel';
import type { StagedReschedule } from '../../../services/reschedulePreview';
import type { RescheduleImpact } from '../../../services/rescheduleImpact';
import type { ProposedChange } from '../../../services/scheduleEngine';

const change: ProposedChange = {
  jobId: 'a', jobName: 'Exterior Repaint', jobNumber: '0001',
  oldStart: '2026-06-02T08:00:00.000Z', oldEnd: '2026-06-02T16:00:00.000Z',
  newStart: '2026-06-04T08:00:00.000Z', newEnd: '2026-06-04T16:00:00.000Z',
};

const impact: RescheduleImpact = {
  jobsAffected: 1, crewsAffected: 2, totalDelayDays: 2,
  newEndDate: '2026-06-04T16:00:00.000Z', lockedCount: 1,
  weatherHits: [{ dateKey: '2026-06-04', kind: 'rain', jobCount: 1 }],
  customerUpdates: [{ clientId: 'cl1', clientName: 'Acme Co', jobName: 'Exterior Repaint', oldStart: change.oldStart, newStart: change.newStart }],
};

const baseStaged = (over: Partial<StagedReschedule> = {}): StagedReschedule => ({
  changes: [change], label: 'Move Exterior Repaint', commit: vi.fn(), ...over,
});

const noop = () => {};

describe('ReschedulePreviewPanel', () => {
  it('renders schedule impact stats from impact', () => {
    render(<ReschedulePreviewPanel staged={baseStaged()} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop} />);
    expect(screen.getByText('Jobs Affected')).toBeInTheDocument();
    expect(screen.getByText('Crews Affected')).toBeInTheDocument();
    expect(screen.getByText('1 locked job will not move')).toBeInTheDocument();
  });

  it('hides the Delay-by control when recompute is absent', () => {
    render(<ReschedulePreviewPanel staged={baseStaged()} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop} />);
    expect(screen.queryByText('Delay by')).not.toBeInTheDocument();
  });

  it('shows the Delay-by control and fires onChangeDelay when recompute is present', () => {
    const onChangeDelay = vi.fn();
    render(<ReschedulePreviewPanel staged={baseStaged({ recompute: () => [change], delayDays: 2 })} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop} onChangeDelay={onChangeDelay} />);
    expect(screen.getByText('Delay by')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } });
    expect(onChangeDelay).toHaveBeenCalledWith(5);
  });

  it('expands customer messages on Preview Messages click', () => {
    render(<ReschedulePreviewPanel staged={baseStaged()} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop} />);
    fireEvent.click(screen.getByText('Preview Messages'));
    expect(screen.getByText(/has been rescheduled/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run components/views/JobScheduling/ReschedulePreviewPanel.test.tsx`
Expected: PASS (all four). Requires Tasks 1–9 complete.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobScheduling/ReschedulePreviewPanel.test.tsx
git commit -m "test: ReschedulePreviewPanel render + interaction tests"
```

---

## Task 11: Wire impact + delay recompute in `JobSchedulingView`

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

- [ ] **Step 1: Import the impact service**

Near the other service imports (around line 13-15), add:

```ts
import { computeImpact } from '../../services/rescheduleImpact';
```

- [ ] **Step 2: Compute impact via useMemo**

After the `suggestions` `useMemo` (around line 355), add:

```ts
  const impact = useMemo(() => computeImpact(
    preview.staged?.changes ?? [],
    jobs,
    crews,
    clients,
    settings.scheduling?.mockWeather || {},
  ), [preview.staged, jobs, crews, clients, settings.scheduling?.mockWeather]);
```

- [ ] **Step 3: Add the delay-change handler**

Below `handleAutoFix` (around line 362), add:

```ts
  const handleChangeDelay = (days: number) => {
    const s = preview.staged;
    if (!s?.recompute) return;
    preview.setChanges(s.recompute(days));
    // Persist the selected delay so the control stays in sync.
    preview.stage({ ...s, changes: s.recompute(days), delayDays: days });
  };
```

- [ ] **Step 4: Attach recompute when staging the cascade move (move-job drawer)**

Find the `SingleJobMoveDrawer` `onApply` (around line 569):

```tsx
            onApply={(changes, label) => {
                preview.stage({ changes, label, commit: (eff) => onApplySchedule(eff, label) });
                setMoveJob(null);
            }}
```

Replace with a version that derives the cascade anchor and supplies `recompute`:

```tsx
            onApply={(changes, label) => {
                const anchorIso = changes
                  .filter(c => !c.skipped && c.oldStart)
                  .map(c => c.oldStart!)
                  .sort()[0];
                const recompute = anchorIso
                  ? (days: number) => shiftJobsFromPoint(jobs, anchorIso, days, 'days', workConfig)
                  : undefined;
                const firstDelay = changes.find(c => !c.skipped && c.oldStart && c.newStart);
                const delayDays = firstDelay
                  ? Math.max(0, Math.round((new Date(firstDelay.newStart).getTime() - new Date(firstDelay.oldStart!).getTime()) / 86_400_000))
                  : undefined;
                preview.stage({ changes, label, commit: (eff) => onApplySchedule(eff, label), recompute, delayDays });
                setMoveJob(null);
            }}
```

(`shiftJobsFromPoint` is already imported at line 13.)

- [ ] **Step 5: Pass impact + onChangeDelay to the panel**

Find the `ReschedulePreviewPanel` usage (around line 578-580):

```tsx
            onApply={() => { const s = preview.staged; if (s) { s.commit(s.changes); preview.clear(); } }}
```

Locate the full element and ensure it passes the new props. The element should read:

```tsx
        <ReschedulePreviewPanel
            staged={preview.staged}
            issues={issues}
            suggestions={suggestions}
            impact={impact}
            onApply={() => { const s = preview.staged; if (s) { s.commit(s.changes); preview.clear(); } }}
            onCancel={() => preview.clear()}
            onAutoFix={handleAutoFix}
            onChangeDelay={handleChangeDelay}
        />
```

(Match `onCancel`/`onAutoFix` to whatever names already exist in the current usage — only add `impact` and `onChangeDelay`, and keep existing handlers.)

- [ ] **Step 6: Verify the whole project typechecks and tests pass**

Run: `npm run lint && npx vitest run`
Expected: PASS — no type errors; all tests green.

- [ ] **Step 7: Commit**

```bash
git add components/views/JobSchedulingView.tsx components/views/JobScheduling/ReschedulePreviewPanel.tsx
git commit -m "feat: wire reschedule impact + interactive delay into JobSchedulingView"
```

---

## Task 12: Manual verification

**Files:** none (manual).

- [ ] **Step 1: Run the app**

Run: `npm run dev` and open the Job Scheduling page.

- [ ] **Step 2: Trigger a cascade reschedule**

Right-click a job → Move → choose a cascade move. Confirm the panel shows: Schedule Impact stats, a working **Delay by** dropdown (changing it re-runs the preview), Potential Issues with the locked row, the Before/After timeline, and the Smart Suggestions card.

- [ ] **Step 3: Exercise the wired actions**

Click **Fix For Me** (auto-fix), **View Weather** (inline forecast expands), **Preview Messages** (inline customer messages expand). Confirm **Apply Changes** commits and the panel closes.

- [ ] **Step 4: Confirm single drag-drop has no Delay-by**

Drag a job to a new cell; confirm the panel appears without the Delay-by control (no `recompute`) but still shows impact stats.

---

## Self-Review Notes

- **Spec coverage:** computeImpact fields (Tasks 1–5), StagedReschedule hooks (Task 6), Timeline (Task 7), Smart Suggestions card with all three sub-cards + wired actions (Task 8), panel layout + delay control hidden without recompute (Task 9–10), view wiring + live recompute (Task 11), manual verification incl. single-drop case (Task 12). All spec sections covered.
- **Type consistency:** `RescheduleImpact`, `WeatherHit`, `CustomerUpdate`, `computeImpact`, `buildCustomerMessages` names are identical across service, subcomponents, panel, tests, and view. `recompute`/`delayDays` names match between `reschedulePreview.ts`, the view, and the panel.
- **Placeholder scan:** every code step includes complete code; `fmtDay`'s `'TBD'` string is intentional fallback content, not a plan placeholder.
