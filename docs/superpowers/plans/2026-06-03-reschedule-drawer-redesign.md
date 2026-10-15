# Reschedule Drawer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-size-fits-all Reschedule Preview drawer with a two-mode (single-job edit vs bulk preview) shell, a consistent stage-then-Apply save model (crew included), and conflict-first ordering.

**Architecture:** A thin shell (`ReschedulePreviewPanel`) owns drawer chrome + Auto-Fix banners and routes to one of two body components (`SingleJobEditor`, `BulkPreview`) based on an explicit `mode` flag on the staged change. Shared `ConflictStrip` and `ImpactTiles` are extracted. Crew edits stage into a new `stagedCrewByJob` map and commit on Apply via a pure `applyStagedCrew` helper.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react (jsdom), Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-03-reschedule-drawer-redesign-design.md`

**Conventions:**
- `npm run lint` runs `tsc --noEmit`. `npx vitest run` runs the full suite. Run both before each commit.
- Commit footer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Work on branch `feat/reschedule-drawer-redesign` (already checked out).

---

## File Structure

**New files:**
- `components/views/JobScheduling/reschedule/ConflictStrip.tsx` — top status strip (red "N conflicts" + Auto-Fix, or green "No conflicts").
- `components/views/JobScheduling/reschedule/ImpactTiles.tsx` — the four-tile RescheduleImpact grid + `StatTile` (moved out of the panel).
- `components/views/JobScheduling/reschedule/SingleJobEditor.tsx` — body for `mode: 'edit'`.
- `components/views/JobScheduling/reschedule/BulkPreview.tsx` — body for `mode: 'bulk'`.
- `services/stagedCrew.ts` — pure `applyStagedCrew(job, staged)` helper + `StagedCrew` type.
- `services/stagedCrew.test.ts` — its unit tests.
- `components/views/JobScheduling/reschedule/ConflictStrip.test.tsx`
- `components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx`
- `components/views/JobScheduling/reschedule/BulkPreview.test.tsx`

**Modified files:**
- `services/reschedulePreview.ts` — add required `mode` to `StagedReschedule`.
- `services/reschedulePreview.test.ts` — assert reducer preserves `mode` (create if absent — see Task 1).
- `components/views/JobScheduling/ReschedulePreviewPanel.tsx` — becomes the shell.
- `components/views/JobScheduling/ReschedulePreviewPanel.test.tsx` — update `baseStaged` + add mode-routing tests.
- `components/views/JobSchedulingView.tsx` — set `mode` at stage sites; staged-crew state + apply wiring; `clientNameByJob`.
- `components/modals/CrewSelectionModal.tsx` — rename the "Rendered" stat label to "Logged".

---

## Task 1: Add `mode` flag to StagedReschedule

**Files:**
- Modify: `services/reschedulePreview.ts:3-14`
- Create/Modify: `services/reschedulePreview.test.ts`
- Modify (compile fixes): `components/views/JobSchedulingView.tsx` stage sites (lines ~232, ~300, ~502, ~524, ~542) and `components/views/JobScheduling/ReschedulePreviewPanel.test.tsx:23-25`

- [ ] **Step 1: Write the failing test**

Check whether `services/reschedulePreview.test.ts` exists. If it does, append the test inside the existing top-level `describe`. If not, create the file with this content:

```ts
import { describe, it, expect } from 'vitest';
import { previewReducer, initialPreviewState, type StagedReschedule } from './reschedulePreview';

const staged: StagedReschedule = {
  changes: [], label: 'X', commit: () => {}, mode: 'edit',
};

describe('previewReducer', () => {
  it('STAGE stores the payload including its mode', () => {
    const s = previewReducer(initialPreviewState, { type: 'STAGE', payload: staged });
    expect(s.staged?.mode).toBe('edit');
  });

  it('SET_CHANGES preserves the existing mode', () => {
    const stagedState = previewReducer(initialPreviewState, { type: 'STAGE', payload: staged });
    const next = previewReducer(stagedState, { type: 'SET_CHANGES', payload: [] });
    expect(next.staged?.mode).toBe('edit');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/reschedulePreview.test.ts`
Expected: FAIL — `mode` is not a known property of `StagedReschedule` (tsc error) / property missing.

- [ ] **Step 3: Add `mode` to the interface**

In `services/reschedulePreview.ts`, add the field to `StagedReschedule` (after `recompute`):

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
  /** Which drawer experience to render: single-job editor vs bulk preview. */
  mode: 'edit' | 'bulk';
}
```

(The reducer already spreads `...state.staged` in `SET_CHANGES`, so mode is preserved with no reducer change.)

- [ ] **Step 4: Set `mode` at every stage site in `JobSchedulingView.tsx`**

Add `mode: 'bulk'` to the rain-day stage (≈line 232) and cascade-modal stage (≈line 542). Add `mode: 'edit'` to the drag-move stage (≈line 300) and the reschedule-job stage (≈line 502). The delay recompute (≈line 524) does `preview.stage({ ...s, changes: ... })`, which already carries `s.mode` — leave it.

Rain-day (≈232):
```ts
    preview.stage({
      changes,
      label,
      mode: 'bulk',
```

Drag-move (≈300):
```ts
    preview.stage({
      changes: [change],
      label: `Move ${job.name}`,
      mode: 'edit',
      commit: (eff) => onApplySchedule(eff, `Move ${job.name}`),
    });
```

Reschedule-job (≈502):
```ts
    preview.stage({ changes: [change], label, mode: 'edit', commit: (eff) => onApplySchedule(eff, label), recompute, delayDays: 0 });
```

Cascade-modal (≈542):
```ts
                preview.stage({ changes, label, mode: 'bulk', commit: (eff) => onApplySchedule(eff, label) });
```

- [ ] **Step 5: Update `baseStaged` in the panel test**

In `components/views/JobScheduling/ReschedulePreviewPanel.test.tsx`, give the existing helper a default mode so existing bulk-oriented assertions keep working:

```ts
const baseStaged = (over: Partial<StagedReschedule> = {}): StagedReschedule => ({
  changes: [change], label: 'Move Exterior Repaint', commit: vi.fn(), mode: 'bulk', ...over,
});
```

- [ ] **Step 6: Run lint + tests**

Run: `npm run lint && npx vitest run`
Expected: PASS (all stage sites compile; new reducer tests pass).

- [ ] **Step 7: Commit**

```bash
git add services/reschedulePreview.ts services/reschedulePreview.test.ts components/views/JobSchedulingView.tsx components/views/JobScheduling/ReschedulePreviewPanel.test.tsx
git commit -m "feat: add mode flag to StagedReschedule

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: ConflictStrip component

**Files:**
- Create: `components/views/JobScheduling/reschedule/ConflictStrip.tsx`
- Create: `components/views/JobScheduling/reschedule/ConflictStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConflictStrip } from './ConflictStrip';

describe('ConflictStrip', () => {
  it('shows a green all-clear when there are no issues', () => {
    render(<ConflictStrip issueCount={0} lockedCount={0} canAutoFix={false} onAutoFix={() => {}} />);
    expect(screen.getByText('No conflicts')).toBeInTheDocument();
  });

  it('shows the conflict count and an Auto-Fix button when fixable', () => {
    const onAutoFix = vi.fn();
    render(<ConflictStrip issueCount={2} lockedCount={0} canAutoFix onAutoFix={onAutoFix} />);
    expect(screen.getByText('2 conflicts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /auto-fix/i }));
    expect(onAutoFix).toHaveBeenCalled();
  });

  it('singularizes one conflict and hides Auto-Fix when not fixable', () => {
    render(<ConflictStrip issueCount={1} lockedCount={0} canAutoFix={false} onAutoFix={() => {}} />);
    expect(screen.getByText('1 conflict')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /auto-fix/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/reschedule/ConflictStrip.test.tsx`
Expected: FAIL — cannot find module `./ConflictStrip`.

- [ ] **Step 3: Implement ConflictStrip**

```tsx
import React from 'react';
import { AlertTriangle, CheckCircle2, Wand2 } from 'lucide-react';

interface ConflictStripProps {
  /** Number of detected scheduling issues. */
  issueCount: number;
  /** Locked jobs that can't move (informational). */
  lockedCount?: number;
  /** A suggestion set exists, so Auto-Fix can run. */
  canAutoFix: boolean;
  /** Trigger the Auto-Fix preview. */
  onAutoFix: () => void;
  /** Optional "View"/"Hide" toggle for per-job detail (bulk mode). */
  onViewDetails?: () => void;
  reviewing?: boolean;
}

export const ConflictStrip = ({ issueCount, lockedCount = 0, canAutoFix, onAutoFix, onViewDetails, reviewing }: ConflictStripProps) => {
  const hasProblems = issueCount > 0 || lockedCount > 0;

  if (!hasProblems) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-green-200 dark:border-green-800 bg-green-50/70 dark:bg-green-900/20 px-3 py-2.5 text-sm font-medium text-green-700 dark:text-green-400">
        <CheckCircle2 className="w-4 h-4 shrink-0" /> No conflicts
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-900/20 px-3 py-2.5">
      <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
      <span className="text-sm font-bold text-red-700 dark:text-red-300">
        {issueCount > 0 ? `${issueCount} conflict${issueCount === 1 ? '' : 's'}` : `${lockedCount} locked`}
      </span>
      {onViewDetails && (
        <button onClick={onViewDetails} className="text-[11px] font-bold text-red-600 dark:text-red-300 underline">
          {reviewing ? 'Hide' : 'View'}
        </button>
      )}
      {canAutoFix && (
        <button
          onClick={onAutoFix}
          className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-primary-700"
        >
          <Wand2 className="w-3.5 h-3.5" /> Auto-Fix
        </button>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/reschedule/ConflictStrip.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/reschedule/ConflictStrip.tsx components/views/JobScheduling/reschedule/ConflictStrip.test.tsx
git commit -m "feat: ConflictStrip shared component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2.5: ImpactTiles component (+ "Logged" rename)

**Files:**
- Create: `components/views/JobScheduling/reschedule/ImpactTiles.tsx`
- Modify: `components/modals/CrewSelectionModal.tsx` (rename the "Rendered" label, ≈line 440)

- [ ] **Step 1: Implement ImpactTiles (moves `StatTile` out of the panel)**

```tsx
import React from 'react';
import { RescheduleImpact } from '../../../../services/rescheduleImpact';

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '—';

const StatTile = ({ label, value, accent, details }: { label: string; value: React.ReactNode; accent?: boolean; details?: string[] }) => {
  const hasDetails = !!details && details.length > 0;
  return (
    <div className={`group relative rounded-xl border px-3 py-2.5 ${hasDetails ? 'cursor-help' : ''} ${
      accent
        ? 'border-primary-200 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-900/20'
        : 'border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/60'
    }`}>
      <div className={`font-heading font-black leading-none tracking-tight ${accent ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'} text-2xl`}>{value}</div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</div>
      {hasDetails && (
        <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-max max-w-[220px] -translate-x-1/2 group-hover:block animate-in fade-in zoom-in-95 duration-150">
          <div className="rounded-lg bg-gray-900 dark:bg-gray-700 px-3 py-2 text-left shadow-xl">
            <ul className="space-y-0.5">
              {details.map((d, i) => (
                <li key={i} className="text-xs font-medium text-white truncate">{d}</li>
              ))}
            </ul>
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-gray-900 dark:bg-gray-700" />
          </div>
        </div>
      )}
    </div>
  );
};

export const ImpactTiles = ({ impact }: { impact: RescheduleImpact }) => (
  <div className="grid grid-cols-2 gap-2">
    <StatTile label="Jobs Affected" value={impact.jobsAffected} accent details={impact.affectedJobNames} />
    <StatTile label="Crews Affected" value={impact.crewsAffected} details={impact.affectedCrewNames} />
    <StatTile label="Total Delay" value={`${impact.totalDelayDays}d`} />
    <StatTile label="New End Date" value={<span className="text-base">{fmtDate(impact.newEndDate)}</span>} />
  </div>
);
```

- [ ] **Step 2: Rename "Rendered" → "Logged" in CrewSelectionModal**

In `components/modals/CrewSelectionModal.tsx`, find the stats header block (≈line 440) and change the label text only:

```tsx
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">Logged</span>
```

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: PASS (ImpactTiles compiles; modal still typechecks).

- [ ] **Step 4: Commit**

```bash
git add components/views/JobScheduling/reschedule/ImpactTiles.tsx components/modals/CrewSelectionModal.tsx
git commit -m "feat: ImpactTiles component; rename Rendered to Logged

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: SingleJobEditor (edit-mode body)

**Files:**
- Create: `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`
- Create: `components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SingleJobEditor } from './SingleJobEditor';
import type { ProposedChange } from '../../../../services/scheduleEngine';

const change: ProposedChange = {
  jobId: 'a', jobName: 'Exterior Repaint', jobNumber: '0001',
  oldStart: '2026-06-02T08:00:00', oldEnd: '2026-06-02T17:00:00',
  newStart: '2026-06-02T08:00:00', newEnd: '2026-06-04T17:00:00',
};

const base = {
  change, clientName: 'Acme Co', issues: [], suggestions: [], onAutoFix: vi.fn(),
  stats: { workOrderNumber: 'WO-100', estHours: 40, assignedHours: 24, renderedHours: 0 },
  crew: [{ id: 'm1', name: 'Mike Smith', role: 'Owner' }],
  onReassignCrew: vi.fn(),
  dayHours: { '2026-06-02': { startTime: '08:00', endTime: '17:00' } },
  onChangeDailyHour: vi.fn(), onChangeJobDate: vi.fn(),
};

describe('SingleJobEditor', () => {
  it('shows the When start/end date fields and the crew', () => {
    render(<SingleJobEditor {...base} />);
    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.getByText('End Date')).toBeInTheDocument();
    expect(screen.getByText('Mike Smith')).toBeInTheDocument();
  });

  it('uses single-job framing — no "Jobs Affected" bulk tile', () => {
    render(<SingleJobEditor {...base} />);
    expect(screen.queryByText('Jobs Affected')).not.toBeInTheDocument();
  });

  it('fires onReassignCrew from the Edit crew button', () => {
    render(<SingleJobEditor {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /edit crew/i }));
    expect(base.onReassignCrew).toHaveBeenCalledWith('a');
  });

  it('labels actual hours as "Logged", not "Rendered"', () => {
    render(<SingleJobEditor {...base} />);
    expect(screen.getByText('Logged')).toBeInTheDocument();
    expect(screen.queryByText('Rendered')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx`
Expected: FAIL — cannot find module `./SingleJobEditor`.

- [ ] **Step 3: Implement SingleJobEditor**

```tsx
import React from 'react';
import { Briefcase, CalendarClock, Users, UserCog } from 'lucide-react';
import { ProposedChange, spannedDayKeys } from '../../../../services/scheduleEngine';
import { ScheduleIssue } from '../../../../services/rescheduleIssues';
import { Suggestion } from '../../../../services/rescheduleSuggestions';
import { JobStats } from '../../../../services/jobStats';
import { ConflictStrip } from './ConflictStrip';
import { CrewAvatar } from '../CrewAvatar';
import type { CrewMemberLite } from '../ReschedulePreviewPanel';

interface SingleJobEditorProps {
  change: ProposedChange;
  clientName?: string;
  issues: ScheduleIssue[];
  suggestions: Suggestion[];
  onAutoFix: () => void;
  stats?: JobStats;
  crew: CrewMemberLite[];
  onReassignCrew?: (jobId: string) => void;
  dayHours: Record<string, { startTime: string; endTime: string }>;
  onChangeDailyHour?: (jobId: string, dateKey: string, field: 'startTime' | 'endTime', value: string) => void;
  onChangeJobDate?: (jobId: string, field: 'start' | 'end', value: string) => void;
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">{children}</div>
);

const HoursStat = ({ label, value, accent }: { label: string; value: number; accent?: string }) => (
  <div>
    <div className={`font-heading font-black leading-none text-lg ${accent ?? 'text-gray-900 dark:text-white'}`}>{value.toFixed(1)}</div>
    <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</div>
  </div>
);

const fmtRange = (start: string | null, end: string | null) => {
  const f = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
  const a = f(start), b = f(end ?? start);
  return a === b ? a : `${a} – ${b}`;
};

export const SingleJobEditor = ({
  change: c, clientName, issues, suggestions, onAutoFix, stats, crew, onReassignCrew, dayHours, onChangeDailyHour, onChangeJobDate,
}: SingleJobEditorProps) => {
  const keys = spannedDayKeys(c.newStart, c.newEnd);
  const jobIssues = issues.filter(i => i.jobId === c.jobId);
  const canAutoFix = suggestions.some(s => s.jobId === c.jobId);

  return (
    <div className="space-y-6">
      <ConflictStrip issueCount={jobIssues.length} canAutoFix={canAutoFix} onAutoFix={onAutoFix} />
      {jobIssues.length > 0 && (
        <div className="space-y-1.5">
          {jobIssues.map((iss, i) => (
            <div key={i} className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">{iss.message}</div>
          ))}
        </div>
      )}

      {/* When */}
      {onChangeJobDate && (
        <div className="space-y-1.5">
          <SectionLabel>When</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Start Date</label>
              <input type="date" value={keys[0]} onChange={e => onChangeJobDate(c.jobId, 'start', e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm font-medium" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">End Date</label>
              <input type="date" value={keys[keys.length - 1]} onChange={e => onChangeJobDate(c.jobId, 'end', e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm font-medium" />
            </div>
          </div>
        </div>
      )}

      {/* Daily hours */}
      {onChangeDailyHour && (
        <div className="space-y-1.5">
          <SectionLabel>Daily Hours</SectionLabel>
          <div className="space-y-1.5">
            {keys.map(dateKey => {
              const h = dayHours[dateKey] ?? { startTime: '08:00', endTime: '17:00' };
              const label = new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
              return (
                <div key={dateKey} className="flex items-center gap-2 text-sm">
                  <span className="w-24 shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
                  <input type="time" value={h.startTime} onChange={e => onChangeDailyHour(c.jobId, dateKey, 'startTime', e.target.value)}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm" />
                  <span className="text-gray-400">–</span>
                  <input type="time" value={h.endTime} onChange={e => onChangeDailyHour(c.jobId, dateKey, 'endTime', e.target.value)}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Crew */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <SectionLabel>Crew</SectionLabel>
          {onReassignCrew && (
            <button onClick={() => onReassignCrew(c.jobId)} className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:underline">
              <UserCog className="w-3.5 h-3.5" /> Edit crew
            </button>
          )}
        </div>
        {crew.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {crew.map(m => (
              <div key={m.id} className="flex items-center gap-2 min-w-0">
                <CrewAvatar m={m} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{m.name}</div>
                  {m.role && <div className="text-[11px] text-gray-400 truncate">{m.role}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-400"><Users className="w-4 h-4 shrink-0" /> Unassigned</div>
        )}
      </div>

      {/* Compact impact */}
      {stats && (
        <div className="space-y-2">
          <SectionLabel>Impact</SectionLabel>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 shrink-0 text-gray-400" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Work Order</span>
              <span className="ml-auto text-sm font-black text-gray-900 dark:text-white">#{stats.workOrderNumber}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <HoursStat label="Est." value={stats.estHours} />
              <HoursStat label="Assigned" value={stats.assignedHours} accent="text-primary-600 dark:text-primary-400" />
              <HoursStat label="Logged" value={stats.renderedHours} accent="text-green-600 dark:text-green-400" />
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 shrink-0 text-gray-400" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Job Schedule</span>
              <span className="ml-auto text-sm font-bold text-gray-900 dark:text-white">{fmtRange(c.newStart, c.newEnd)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/reschedule/SingleJobEditor.tsx components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx
git commit -m "feat: SingleJobEditor edit-mode body

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: BulkPreview (bulk-mode body)

**Files:**
- Create: `components/views/JobScheduling/reschedule/BulkPreview.tsx`
- Create: `components/views/JobScheduling/reschedule/BulkPreview.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkPreview } from './BulkPreview';
import type { ProposedChange } from '../../../../services/scheduleEngine';
import type { RescheduleImpact } from '../../../../services/rescheduleImpact';

const mk = (id: string, name: string): ProposedChange => ({
  jobId: id, jobName: name, jobNumber: id,
  oldStart: '2026-06-02T08:00:00', oldEnd: '2026-06-02T17:00:00',
  newStart: '2026-06-04T08:00:00', newEnd: '2026-06-04T17:00:00',
});

const impact: RescheduleImpact = {
  jobsAffected: 2, crewsAffected: 1, totalDelayDays: 2, affectedJobNames: ['A', 'B'],
  affectedCrewNames: ['Crew 1'], newEndDate: '2026-06-06T17:00:00', lockedCount: 0,
  weatherHits: [], customerUpdates: [],
};

const base = {
  changes: [mk('a', 'Repaint Deck'), mk('b', 'Trim Work')],
  issues: [], suggestions: [], impact, onAutoFix: vi.fn(),
};

describe('BulkPreview', () => {
  it('renders the four impact tiles', () => {
    render(<BulkPreview {...base} />);
    expect(screen.getByText('Jobs Affected')).toBeInTheDocument();
    expect(screen.getByText('Crews Affected')).toBeInTheDocument();
  });

  it('lists each affected job', () => {
    render(<BulkPreview {...base} />);
    expect(screen.getByText('Repaint Deck')).toBeInTheDocument();
    expect(screen.getByText('Trim Work')).toBeInTheDocument();
  });

  it('shows the Delay-by control and fires onChangeDelay when recompute is given', () => {
    const onChangeDelay = vi.fn();
    render(<BulkPreview {...base} delayDays={2} onChangeDelay={onChangeDelay} />);
    expect(screen.getByText('Delay by')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } });
    expect(onChangeDelay).toHaveBeenCalledWith(5);
  });

  it('hides the Delay-by control when onChangeDelay is absent', () => {
    render(<BulkPreview {...base} />);
    expect(screen.queryByText('Delay by')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/views/JobScheduling/reschedule/BulkPreview.test.tsx`
Expected: FAIL — cannot find module `./BulkPreview`.

- [ ] **Step 3: Implement BulkPreview**

```tsx
import React from 'react';
import { ArrowRight, AlertTriangle, CalendarClock } from 'lucide-react';
import { ProposedChange } from '../../../../services/scheduleEngine';
import { ScheduleIssue } from '../../../../services/rescheduleIssues';
import { Suggestion } from '../../../../services/rescheduleSuggestions';
import { RescheduleImpact } from '../../../../services/rescheduleImpact';
import { ConflictStrip } from './ConflictStrip';
import { ImpactTiles } from './ImpactTiles';
import { PreviewTimeline } from '../PreviewTimeline';

interface BulkPreviewProps {
  changes: ProposedChange[];
  issues: ScheduleIssue[];
  suggestions: Suggestion[];
  impact: RescheduleImpact;
  onAutoFix: () => void;
  delayDays?: number;
  onChangeDelay?: (days: number) => void;
}

const DELAY_OPTIONS = [1, 2, 3, 5, 7];
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">{children}</div>
);
const fmtShort = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

export const BulkPreview = ({ changes, issues, suggestions, impact, onAutoFix, delayDays, onChangeDelay }: BulkPreviewProps) => {
  const changed = changes.filter(c => !c.skipped);
  const issuesByJob = new Set(issues.map(i => i.jobId));

  return (
    <div className="space-y-6">
      <ConflictStrip issueCount={issues.length} lockedCount={impact.lockedCount} canAutoFix={suggestions.length > 0} onAutoFix={onAutoFix} />

      {onChangeDelay && (
        <div className="space-y-1.5">
          <SectionLabel>Delay by</SectionLabel>
          <div className="relative">
            <select value={delayDays ?? impact.totalDelayDays} onChange={e => onChangeDelay(Number(e.target.value))}
              className="w-full appearance-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-3 pr-9 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none cursor-pointer">
              {DELAY_OPTIONS.map(d => <option key={d} value={d}>{d} Day{d === 1 ? '' : 's'}</option>)}
            </select>
            <CalendarClock className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <SectionLabel>Schedule Impact</SectionLabel>
        <ImpactTiles impact={impact} />
      </div>

      <div className="space-y-2">
        <SectionLabel>Affected Jobs</SectionLabel>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
          {changed.map(c => (
            <div key={c.jobId} className="flex items-center gap-2 px-3 py-2.5 text-sm">
              <span className="font-bold truncate max-w-[150px] text-gray-900 dark:text-white">{c.jobName}</span>
              {issuesByJob.has(c.jobId) && <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />}
              <span className="ml-auto flex items-center gap-1.5 text-xs">
                <span className="text-gray-400">{fmtShort(c.oldStart)}</span>
                <ArrowRight className="w-3 h-3 text-gray-400" />
                <span className="text-primary-600 dark:text-primary-400 font-semibold">{fmtShort(c.newStart)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <PreviewTimeline changes={changes} />
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/views/JobScheduling/reschedule/BulkPreview.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/views/JobScheduling/reschedule/BulkPreview.tsx components/views/JobScheduling/reschedule/BulkPreview.test.tsx
git commit -m "feat: BulkPreview bulk-mode body

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Convert ReschedulePreviewPanel into the routing shell

**Files:**
- Modify: `components/views/JobScheduling/ReschedulePreviewPanel.tsx`
- Modify: `components/views/JobScheduling/ReschedulePreviewPanel.test.tsx`

The shell keeps: imports of `StagedReschedule`/`summarizeStaged`, the `CrewMemberLite` export (bodies import it), the Auto-Fix preview/confirm banner state + effects, header, footer, and `onCancel`/`onApply`. It removes the inline Job Details / Assigned Crew / Daily Hours / Potential Issues / per-job review / Smart Suggestions sections (their roles now live in the bodies) and renders `<SingleJobEditor>` or `<BulkPreview>` based on `staged.mode`. It adds two props: `clientNameByJob?` (for the edit subtitle) and passes `previewAutoFix` down as the bodies' `onAutoFix`.

- [ ] **Step 1: Write the failing tests (add to existing describe)**

Add these to `components/views/JobScheduling/ReschedulePreviewPanel.test.tsx`:

```tsx
  it('edit mode shows "Edit Schedule" header and the When fields, not bulk tiles', () => {
    render(<ReschedulePreviewPanel staged={baseStaged({ mode: 'edit' })} issues={[]} suggestions={[]} impact={impact}
      onApply={noop} onCancel={noop} onAutoFix={noop}
      onChangeJobDate={() => {}} onChangeDailyHour={() => {}}
      dailyHoursEdits={{ a: { '2026-06-04': { startTime: '08:00', endTime: '17:00' } } }}
      crewByJob={{ a: [{ id: 'm1', name: 'Mike Smith', role: 'Owner' }] }}
      statsByJob={{ a: { workOrderNumber: 'WO-100', estHours: 40, assignedHours: 24, renderedHours: 0 } }} />);
    expect(screen.getByText('Edit Schedule')).toBeInTheDocument();
    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.queryByText('Jobs Affected')).not.toBeInTheDocument();
  });

  it('bulk mode shows "Reschedule Preview" header and impact tiles', () => {
    render(<ReschedulePreviewPanel staged={baseStaged({ mode: 'bulk' })} issues={[]} suggestions={[]} impact={impact}
      onApply={noop} onCancel={noop} onAutoFix={noop} />);
    expect(screen.getByText('Reschedule Preview')).toBeInTheDocument();
    expect(screen.getByText('Jobs Affected')).toBeInTheDocument();
  });
```

Then update the two pre-existing assertions that relied on the old always-bulk layout: the "renders schedule impact stats" and "Delay by" tests already pass `baseStaged()` which now defaults to `mode: 'bulk'`, so they keep working. The old "1 locked job will not move" string no longer renders (locked detail moved into the ConflictStrip count); change that assertion to:

```tsx
    expect(screen.getByText('No conflicts')).toBeInTheDocument();
```

(That test passes `issues={[]}` and `impact.lockedCount` is 1; update the impact fixture's `lockedCount` to `0` in that single test by cloning impact, OR keep lockedCount and assert the ConflictStrip shows "1 locked". Simpler: in that test render with `impact={{ ...impact, lockedCount: 0 }}` and assert `No conflicts`.)

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run components/views/JobScheduling/ReschedulePreviewPanel.test.tsx`
Expected: FAIL — "Edit Schedule"/"Reschedule Preview" headers not found yet.

- [ ] **Step 3: Rewrite the shell**

Replace the file body (keep the top imports, add the two new body imports + `ProposedChange`, drop now-unused helpers). The full new file:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { CalendarClock, X, CheckCircle2, Wand2 } from 'lucide-react';
import { Button, Badge } from '../../UI';
import { StagedReschedule, summarizeStaged } from '../../../services/reschedulePreview';
import { ScheduleIssue } from '../../../services/rescheduleIssues';
import { Suggestion } from '../../../services/rescheduleSuggestions';
import { RescheduleImpact } from '../../../services/rescheduleImpact';
import { JobStats } from '../../../services/jobStats';
import { SingleJobEditor } from './reschedule/SingleJobEditor';
import { BulkPreview } from './reschedule/BulkPreview';

export interface CrewMemberLite { id: string; name: string; role?: string; photo?: string; color?: string; }

interface ReschedulePreviewPanelProps {
  staged: StagedReschedule | null;
  issues: ScheduleIssue[];
  suggestions: Suggestion[];
  impact: RescheduleImpact;
  onApply: () => void;
  onCancel: () => void;
  onAutoFix: () => void;
  onChangeDelay?: (days: number) => void;
  dailyHoursEdits?: Record<string, Record<string, { startTime: string; endTime: string }>>;
  onChangeDailyHour?: (jobId: string, dateKey: string, field: 'startTime' | 'endTime', value: string) => void;
  onChangeJobDate?: (jobId: string, field: 'start' | 'end', value: string) => void;
  crewByJob?: Record<string, CrewMemberLite[]>;
  onReassignCrew?: (jobId: string) => void;
  statsByJob?: Record<string, JobStats>;
  /** jobId -> client name, for the single-job header subtitle. */
  clientNameByJob?: Record<string, string>;
}

export const ReschedulePreviewPanel = ({
  staged, issues, suggestions, impact, onApply, onCancel, onAutoFix, onChangeDelay,
  dailyHoursEdits, onChangeDailyHour, onChangeJobDate, crewByJob, onReassignCrew, statsByJob, clientNameByJob,
}: ReschedulePreviewPanelProps) => {
  const [autoFixPreview, setAutoFixPreview] = useState<string[] | null>(null);
  const [autoFixApplied, setAutoFixApplied] = useState<string[] | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((autoFixPreview || autoFixApplied) && bodyRef.current) bodyRef.current.scrollTo?.({ top: 0, behavior: 'smooth' });
  }, [autoFixPreview, autoFixApplied]);

  useEffect(() => { if (!staged) { setAutoFixApplied(null); setAutoFixPreview(null); } }, [staged]);

  if (!staged) return null;

  const { changedCount, skippedCount } = summarizeStaged(staged.changes);
  const changed = staged.changes.filter(c => !c.skipped);
  const isEdit = staged.mode === 'edit';
  const editChange = changed[0];
  const highCount = issues.filter(i => i.severity === 'high').length;

  const previewAutoFix = () => { setAutoFixApplied(null); setAutoFixPreview(suggestions.map(s => s.label)); };
  const confirmAutoFix = () => { setAutoFixApplied(autoFixPreview ?? suggestions.map(s => s.label)); setAutoFixPreview(null); onAutoFix(); };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden animate-in fade-in duration-200" onClick={onCancel} />
      <div className="fixed top-0 right-0 h-full w-full sm:w-[440px] z-50 flex flex-col bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-800 animate-in slide-in-from-right duration-300">
        <div className="h-1 w-full bg-gradient-to-r from-primary-500 via-primary-600 to-primary-500" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-3 min-w-0">
            <div className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              {isEdit ? (
                <>
                  <h3 className="font-heading font-black text-lg text-gray-900 dark:text-white leading-tight">Edit Schedule</h3>
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                    {editChange?.jobName}
                    {clientNameByJob?.[editChange?.jobId ?? ''] ? ` · ${clientNameByJob[editChange.jobId]}` : ''}
                    {statsByJob?.[editChange?.jobId ?? '']?.workOrderNumber ? ` · #${statsByJob[editChange.jobId].workOrderNumber}` : ''}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-heading font-black text-lg text-gray-900 dark:text-white leading-tight">Reschedule Preview</h3>
                  <div className="mt-1 flex items-center gap-2 flex-wrap"><Badge color="primary">{staged.label}</Badge></div>
                  <div className="mt-1.5 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                    <span><span className="font-semibold text-gray-700 dark:text-gray-200">{changedCount}</span> changing</span>
                    {skippedCount > 0 && <span className="text-gray-400">· {skippedCount} skipped</span>}
                    {highCount > 0 && <Badge color="red">{highCount} to resolve</Badge>}
                  </div>
                </>
              )}
            </div>
          </div>
          <button onClick={onCancel} aria-label="Close" className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-5">
          {autoFixPreview && (
            <div className="mb-6 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/30 shadow-md p-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-start gap-2">
                <Wand2 className="w-4 h-4 mt-0.5 shrink-0 text-primary-600 dark:text-primary-300" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-primary-800 dark:text-primary-200">
                    {autoFixPreview.length > 0 ? `Auto-Fix will make ${autoFixPreview.length} change${autoFixPreview.length === 1 ? '' : 's'}` : 'Auto-Fix has nothing to change'}
                  </div>
                  {autoFixPreview.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs text-primary-700 dark:text-primary-300">{autoFixPreview.map((l, i) => <li key={i}>• {l}</li>)}</ul>
                  )}
                  <div className="mt-2.5 flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setAutoFixPreview(null)}>Cancel</Button>
                    <Button size="sm" onClick={confirmAutoFix} disabled={autoFixPreview.length === 0}>Apply Auto-Fix</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {autoFixApplied && (
            <div className="mb-6 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 shadow-md p-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-green-800 dark:text-green-300">
                      {autoFixApplied.length > 0 ? `Auto-Fix applied ${autoFixApplied.length} change${autoFixApplied.length === 1 ? '' : 's'}` : 'Auto-Fix ran — nothing to change'}
                    </div>
                    {autoFixApplied.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-green-700 dark:text-green-400">{autoFixApplied.map((l, i) => <li key={i}>• {l}</li>)}</ul>
                    )}
                  </div>
                </div>
                <button onClick={() => setAutoFixApplied(null)} aria-label="Dismiss" className="shrink-0 text-green-600/70 hover:text-green-800 dark:hover:text-green-300"><X className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {isEdit && editChange ? (
            <SingleJobEditor
              change={editChange}
              clientName={clientNameByJob?.[editChange.jobId]}
              issues={issues}
              suggestions={suggestions}
              onAutoFix={previewAutoFix}
              stats={statsByJob?.[editChange.jobId]}
              crew={crewByJob?.[editChange.jobId] ?? []}
              onReassignCrew={onReassignCrew}
              dayHours={dailyHoursEdits?.[editChange.jobId] ?? {}}
              onChangeDailyHour={onChangeDailyHour}
              onChangeJobDate={onChangeJobDate}
            />
          ) : (
            <BulkPreview
              changes={staged.changes}
              issues={issues}
              suggestions={suggestions}
              impact={impact}
              onAutoFix={previewAutoFix}
              delayDays={staged.delayDays}
              onChangeDelay={staged.recompute && onChangeDelay ? onChangeDelay : undefined}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2.5">
          {isEdit ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Saves schedule, hours, and crew on Apply.</p>
          ) : changedCount > 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Applying will reschedule {changedCount} job{changedCount === 1 ? '' : 's'}.</p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={onCancel}>Cancel</Button>
            <Button size="sm" className="flex-[2]" onClick={onApply} disabled={!isEdit && changedCount === 0}>
              {isEdit ? 'Apply' : `Apply${changedCount > 0 ? ` · ${changedCount} job${changedCount === 1 ? '' : 's'}` : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/views/JobScheduling/ReschedulePreviewPanel.test.tsx`
Expected: PASS (both new mode tests + the updated existing ones).

- [ ] **Step 5: Run full lint + suite**

Run: `npm run lint && npx vitest run`
Expected: PASS. (`JobSchedulingView.tsx` still compiles — it passes the same props; `clientNameByJob` is optional and wired in Task 7.)

- [ ] **Step 6: Commit**

```bash
git add components/views/JobScheduling/ReschedulePreviewPanel.tsx components/views/JobScheduling/ReschedulePreviewPanel.test.tsx
git commit -m "feat: ReschedulePreviewPanel routes to edit/bulk bodies

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: stagedCrew service (pure apply helper)

**Files:**
- Create: `services/stagedCrew.ts`
- Create: `services/stagedCrew.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { applyStagedCrew, type StagedCrew } from './stagedCrew';
import type { Job, JobCrewAllocation } from '../types';

const job = (over: Partial<Job> = {}): Job =>
  ({ id: 'j1', jobNumber: 'J-1', name: 'Job', stage: 'Scheduled', startDate: '2026-06-02', endDate: '2026-06-04', ...over } as Job);

const alloc: JobCrewAllocation = {
  id: 'a1', name: 'Crew', startDate: '2026-06-02', endDate: '2026-06-04',
  startTime: '08:00', endTime: '17:00', memberIds: ['m1', 'm2'],
};

describe('applyStagedCrew', () => {
  it('writes the staged members and allocation onto the job', () => {
    const staged: StagedCrew = { memberIds: ['m1', 'm2'], allocation: alloc };
    const result = applyStagedCrew(job(), staged);
    expect(result.crewMemberIds).toEqual(['m1', 'm2']);
    expect(result.allocations).toEqual([alloc]);
  });

  it('clears allocations when no members are staged', () => {
    const staged: StagedCrew = { memberIds: [], allocation: { ...alloc, memberIds: [] } };
    const result = applyStagedCrew(job(), staged);
    expect(result.crewMemberIds).toEqual([]);
    expect(result.allocations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/stagedCrew.test.ts`
Expected: FAIL — cannot find module `./stagedCrew`.

- [ ] **Step 3: Implement the helper**

```ts
import type { Job, JobCrewAllocation } from '../types';

/** A pending crew change held in the preview until Apply commits it. */
export interface StagedCrew {
  memberIds: string[];
  allocation: JobCrewAllocation;
}

/** Returns a copy of `job` with the staged crew applied. Empty members clears
 *  the allocation so member board lanes recompute to "unassigned". */
export const applyStagedCrew = (job: Job, staged: StagedCrew): Job => ({
  ...job,
  crewMemberIds: staged.memberIds,
  allocations: staged.memberIds.length ? [staged.allocation] : [],
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/stagedCrew.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/stagedCrew.ts services/stagedCrew.test.ts
git commit -m "feat: applyStagedCrew pure helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Stage crew edits in JobSchedulingView (fix the dual-save trap)

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

Changes: add `stagedCrewByJob` state; rewrite `handleSaveCrewModal` to record into it (no immediate `onUpdateJob`); make `crewByJob` reflect staged crew; commit staged crew in `onApply`; clear it when the preview clears; add `clientNameByJob`.

- [ ] **Step 1: Add state + reset, near the existing `dailyHoursEdits` state (≈line 196)**

```ts
  const [stagedCrewByJob, setStagedCrewByJob] = useState<Record<string, import('../../services/stagedCrew').StagedCrew>>({});
```

Add an import at the top with the other service imports:

```ts
import { applyStagedCrew, type StagedCrew } from '../../services/stagedCrew';
```

and change the state line to use the named type:

```ts
  const [stagedCrewByJob, setStagedCrewByJob] = useState<Record<string, StagedCrew>>({});
```

In the existing reset effect that clears `dailyHoursEdits` when nothing is staged (≈line 325, `if (!s) { setDailyHoursEdits({}); return; }`), also clear staged crew:

```ts
    if (!s) { setDailyHoursEdits({}); setStagedCrewByJob({}); return; }
```

- [ ] **Step 2: Rewrite `handleSaveCrewModal` (≈line 465) to stage instead of commit**

```ts
  const handleSaveCrewModal = (newCrew: CrewMember[], allocation?: Partial<JobCrewAllocation>) => {
    if (jobToAssign) {
      const memberIds = newCrew.map(c => c.id);
      const job = jobs.find(j => j.id === jobToAssign.id);
      const existing = job?.allocations?.[0];
      const full: JobCrewAllocation = {
        id: allocation?.id || existing?.id || `alloc-${Date.now()}`,
        name: allocation?.name || existing?.name || 'Crew',
        startDate: allocation?.startDate || existing?.startDate || (job?.startDate || '').split('T')[0],
        endDate: allocation?.endDate || existing?.endDate || (job?.endDate || job?.startDate || '').split('T')[0],
        startTime: allocation?.startTime || existing?.startTime || '08:00',
        endTime: allocation?.endTime || existing?.endTime || '17:00',
        memberIds,
        hoursAssignments: allocation?.hoursAssignments,
      };
      setStagedCrewByJob(prev => ({ ...prev, [jobToAssign.id]: { memberIds, allocation: full } }));
    }
    setIsCrewModalOpen(false);
    setJobToAssign(null);
  };
```

`handleChangeCrew` is now unused; delete it (≈lines 439-453).

- [ ] **Step 3: Make `crewByJob` reflect staged crew (the `crewByJob` useMemo, ≈line 415)**

The memo currently maps each changing job to `assignedMembers(job)`. Prefer staged members when present:

```ts
  const crewByJob = useMemo<Record<string, CrewMember[]>>(() => {
    if (!preview.staged) return {};
    const map: Record<string, CrewMember[]> = {};
    for (const c of preview.staged.changes) {
      if (c.skipped) continue;
      const job = jobs.find(j => j.id === c.jobId);
      if (!job) continue;
      const stagedCrew = stagedCrewByJob[c.jobId];
      map[c.jobId] = stagedCrew
        ? stagedCrew.memberIds.map(id => allStaff.find(s => s.id === id)).filter((m): m is CrewMember => !!m)
        : assignedMembers(job);
    }
    return map;
  }, [preview.staged, jobs, assignedMembers, stagedCrewByJob, allStaff]);
```

(Match the exact existing memo shape if it differs; the only behavioral change is the `stagedCrew ? … : …` branch and adding `stagedCrewByJob`, `allStaff` to deps.)

- [ ] **Step 4: Commit staged crew in `onApply` (≈line 719)**

Update the `onApply` handler so each changed job also applies staged crew:

```tsx
            onApply={() => {
              const s = preview.staged;
              if (!s) return;
              const adjusted = s.changes.map(c => {
                if (c.skipped) return c;
                const edits = dailyHoursEdits[c.jobId];
                const stagedCrew = stagedCrewByJob[c.jobId];
                let job = jobs.find(j => j.id === c.jobId);
                if (job && (edits || stagedCrew)) {
                  if (stagedCrew) job = applyStagedCrew(job, stagedCrew);
                  if (edits) job = { ...job, dailyHours: edits };
                  onUpdateJob(job);
                }
                return edits ? applyDailyHours(c, edits) : c;
              });
              s.commit(adjusted);
              preview.clear();
            }}
```

- [ ] **Step 5: Add `clientNameByJob` and pass it to the panel**

Add a memo near `statsByJob` (≈line 426):

```ts
  const clientNameByJob = useMemo<Record<string, string>>(() => {
    if (!preview.staged) return {};
    const map: Record<string, string> = {};
    for (const c of preview.staged.changes) {
      if (c.skipped) continue;
      const job = jobs.find(j => j.id === c.jobId);
      const client = job ? clients.find(cl => cl.id === job.clientId) : undefined;
      if (client) map[c.jobId] = client.name;
    }
    return map;
  }, [preview.staged, jobs, clients]);
```

Add the prop to the `<ReschedulePreviewPanel … />` usage (≈line 740):

```tsx
            statsByJob={statsByJob}
            clientNameByJob={clientNameByJob}
```

- [ ] **Step 6: Run lint + full suite**

Run: `npm run lint && npx vitest run`
Expected: PASS (85 prior + new tests). If `handleChangeCrew` removal leaves an unused-symbol/`JobCrewAllocation` issue, confirm `JobCrewAllocation` is still imported (it is used in `handleSaveCrewModal`).

- [ ] **Step 7: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: stage crew edits, commit on Apply

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Manual verification + finish

**Files:** none (verification only)

- [ ] **Step 1: Full green check**

Run: `npm run lint && npx vitest run`
Expected: lint clean; all tests pass.

- [ ] **Step 2: Run the app and drive both modes**

Run: `npm run dev`, open the Job Scheduling view.
- Click **Reschedule job** on one job → header reads **"Edit Schedule"**, shows When/Daily Hours/Crew/Impact, conflicts at top, footer **Apply**.
- Reassign crew, then click **Cancel** → confirm the crew change did **not** persist (reopen the job; old crew intact).
- Reassign crew, then **Apply** → confirm crew + hours persisted together.
- Trigger a bulk/cascade or rain-day reschedule → header reads **"Reschedule Preview"**, shows Delay/Impact tiles/Affected jobs/Timeline, footer **Apply · N jobs**.

- [ ] **Step 3: Finish the branch**

REQUIRED SUB-SKILL: Use superpowers:finishing-a-development-branch to verify tests, present merge/PR options, and complete.

---

## Self-Review

**Spec coverage:**
- Mode flag (explicit, 5 sites) → Task 1 ✓
- Component split (shell + SingleJobEditor + BulkPreview + ConflictStrip + ImpactTiles) → Tasks 2, 2.5, 3, 4, 5 ✓
- Single-job layout (When → Daily hours → Crew → compact Impact) → Task 3 ✓
- Bulk layout (Delay → Impact → Affected jobs → Timeline) → Task 4 ✓
- Conflicts surfaced first in both → ConflictStrip rendered at top of each body (Tasks 3, 4) ✓
- Save model: crew staged, Apply commits all, Cancel reverts → Tasks 6, 7 ✓
- Apply enablement (edit mode always enabled) → Task 5 footer (`disabled={!isEdit && changedCount === 0}`) ✓
- Terminology "Rendered" → "Logged" (panel compact stats + modal) → Tasks 2.5, 3 ✓
- Dedupe schedule range (dates editable only in "When"; bulk shows per-job old→new) → Tasks 3, 4 ✓
- Auto-Fix at top, no scroll-jump-from-bottom → Auto-Fix now triggered from ConflictStrip at top; banners stay in shell (Task 5) ✓
- Testing plan items → reducer (T1), ConflictStrip (T2), bodies (T3, T4), shell routing (T5), staged crew (T6) ✓

**Placeholder scan:** No TBD/TODO; all code steps include complete code. ✓

**Type consistency:** `StagedCrew` (T6) used in T7 with matching shape `{ memberIds, allocation }`. `CrewMemberLite` exported from `ReschedulePreviewPanel` and imported by `SingleJobEditor` (T3). `JobStats` shape `{ workOrderNumber, estHours, assignedHours, renderedHours }` consistent across T3/T5 fixtures and usage. `mode: 'edit' | 'bulk'` consistent T1/T5. ✓

**Note on import-of-staged-crew:** Task 7 Step 1 shows two forms of the same import; use the named `import { applyStagedCrew, type StagedCrew }` form and the plain `Record<string, StagedCrew>` state type (drop the inline `import('...')` variant).
