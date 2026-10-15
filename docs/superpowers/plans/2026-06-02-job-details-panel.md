# Job Details Side Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a job card on the Production Board opens a right-side slide-over panel with the job's info and actions (Reschedule, View crew assignments, Cancel, View full details), instead of jumping straight to the full job detail page.

**Architecture:** A new presentational `JobDetailsPanel` component renders a slide-over driven by a `selectedJob` state in `JobSchedulingView`. Actions reuse existing machinery: `SingleJobMoveDrawer` for reschedule, `CrewSelectionModal` for crew, `ConfirmationModal` for cancel, and the existing `onViewJob` navigation for full details. Cancel adds a new `'Cancelled'` `JobStage` and clears the job's dates so it leaves the board.

**Tech Stack:** React 19 + TypeScript, Tailwind, lucide-react, Vitest + @testing-library/react.

---

### Task 1: Add `'Cancelled'` stage and exclude it from the board

**Files:**
- Modify: `types.ts:515`
- Modify: `services/productionBoard.ts:50`
- Test: `services/productionBoard.test.ts`

- [ ] **Step 1: Add the failing test**

Add this test inside the existing `describe('buildLanes', ...)` block in `services/productionBoard.test.ts`:

```ts
  it('excludes Cancelled jobs from all lanes', () => {
    const lanes = buildLanes(
      [job({ crewGroupId: 'c1', stage: 'Cancelled' })],
      [crewA], weekDays, cfg,
    );
    const laneA = lanes.find(l => l.crewId === 'c1');
    const cards = laneA?.cardsByDay['2026-06-02'] || [];
    expect(cards).toHaveLength(0);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run services/productionBoard.test.ts`
Expected: FAIL — the Cancelled job is still placed in lane `c1` (1 card instead of 0). (It will also be a type error once Step 3's type is in place; if `'Cancelled'` is not yet a valid `JobStage`, the test file won't compile — that is acceptable as the "red" state. Proceed to Step 3.)

- [ ] **Step 3: Add `'Cancelled'` to the `JobStage` union**

In `types.ts` line 515, change:

```ts
export type JobStage = 'Confirmed' | 'Scheduled' | 'In Production' | 'Touch Up' | 'Ready for Inspection' | 'Completed' | 'Marketing';
```

to:

```ts
export type JobStage = 'Confirmed' | 'Scheduled' | 'In Production' | 'Touch Up' | 'Ready for Inspection' | 'Completed' | 'Marketing' | 'Cancelled';
```

- [ ] **Step 4: Add `'Cancelled'` to the board skip rule**

In `services/productionBoard.ts` line 50, change:

```ts
    if (!job.startDate || job.stage === 'Completed' || job.stage === 'Marketing') continue;
```

to:

```ts
    if (!job.startDate || job.stage === 'Completed' || job.stage === 'Marketing' || job.stage === 'Cancelled') continue;
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npx vitest run services/productionBoard.test.ts`
Expected: PASS (all buildLanes tests green).

- [ ] **Step 6: Typecheck**

Run: `npm run lint`
Expected: no errors. (Adding a union member is backward-compatible; existing `switch`/stage lists already have `default` branches.)

---

### Task 2: Create the `JobDetailsPanel` component

**Files:**
- Create: `components/views/JobScheduling/JobDetailsPanel.tsx`
- Test: `components/views/JobScheduling/JobDetailsPanel.test.tsx`

This component is purely presentational. It exports the panel plus two small pure helpers (`cancelJobPatch`, `crewSummary`) that are unit-tested directly.

- [ ] **Step 1: Write the failing test**

Create `components/views/JobScheduling/JobDetailsPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobDetailsPanel, cancelJobPatch, crewSummary } from './JobDetailsPanel';
import type { Job, Client, CrewMember } from '../../../types';

const job: Job = {
  id: 'j1', jobNumber: 'J-1', name: 'Kitchen Repaint', clientId: 'cl1',
  estimateId: 'e1', address: '482 Oak St', stage: 'Scheduled',
  startDate: '2026-06-08T08:00:00', endDate: '2026-06-10T17:00:00',
  crewMemberIds: ['m1', 'm2'], dateCreated: '2026-06-01T00:00:00',
};
const client: Client = {
  id: 'cl1', name: 'Jane Doe', email: 'j@x.com', phone: '555-1234',
  address: '482 Oak St', properties: [],
};
const staff: CrewMember[] = [
  { id: 'm1', name: 'Mike', role: 'Painter' },
  { id: 'm2', name: 'Sara', role: 'Lead' },
];

describe('cancelJobPatch', () => {
  it('sets stage to Cancelled and clears both dates', () => {
    const patched = cancelJobPatch(job);
    expect(patched.stage).toBe('Cancelled');
    expect(patched.startDate).toBeUndefined();
    expect(patched.endDate).toBeUndefined();
    expect(patched.id).toBe('j1'); // rest preserved
  });
});

describe('crewSummary', () => {
  it('counts and names members from crewMemberIds', () => {
    const s = crewSummary(job, staff);
    expect(s.count).toBe(2);
    expect(s.names).toEqual(['Mike', 'Sara']);
  });
  it('handles no crew', () => {
    const s = crewSummary({ ...job, crewMemberIds: [] }, staff);
    expect(s.count).toBe(0);
    expect(s.names).toEqual([]);
  });
});

describe('JobDetailsPanel', () => {
  const noop = () => {};
  const base = {
    client, allStaff: staff,
    onClose: noop, onReschedule: noop, onViewCrew: noop,
    onCancel: noop, onViewFullDetails: noop,
  };

  it('renders nothing when job is null', () => {
    const { container } = render(<JobDetailsPanel job={null} {...base} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows job name, number, customer and address', () => {
    render(<JobDetailsPanel job={job} {...base} />);
    expect(screen.getByText('Kitchen Repaint')).toBeTruthy();
    expect(screen.getByText(/J-1/)).toBeTruthy();
    expect(screen.getByText(/Jane Doe/)).toBeTruthy();
    expect(screen.getByText(/482 Oak St/)).toBeTruthy();
  });

  it('fires the right callbacks for each action', () => {
    const onReschedule = vi.fn();
    const onViewCrew = vi.fn();
    const onCancel = vi.fn();
    const onViewFullDetails = vi.fn();
    render(
      <JobDetailsPanel
        job={job} {...base}
        onReschedule={onReschedule} onViewCrew={onViewCrew}
        onCancel={onCancel} onViewFullDetails={onViewFullDetails}
      />,
    );
    fireEvent.click(screen.getByText('Reschedule job'));
    fireEvent.click(screen.getByText('View crew assignments'));
    fireEvent.click(screen.getByText('Cancel job'));
    fireEvent.click(screen.getByText(/View full details/));
    expect(onReschedule).toHaveBeenCalledWith('j1');
    expect(onViewCrew).toHaveBeenCalledWith('j1');
    expect(onCancel).toHaveBeenCalledWith('j1');
    expect(onViewFullDetails).toHaveBeenCalledWith('j1');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run components/views/JobScheduling/JobDetailsPanel.test.tsx`
Expected: FAIL — module `./JobDetailsPanel` does not exist.

- [ ] **Step 3: Implement the component**

Create `components/views/JobScheduling/JobDetailsPanel.tsx`:

```tsx
import React, { useEffect } from 'react';
import { X, MapPin, Calendar, Users, Lock, ChevronRight } from 'lucide-react';
import { Job, Client, CrewMember, JobStage } from '../../../types';
import { Button, Badge } from '../../UI';

interface JobDetailsPanelProps {
  job: Job | null;
  client?: Client | null;
  allStaff: CrewMember[];
  onClose: () => void;
  onReschedule: (jobId: string) => void;
  onViewCrew: (jobId: string) => void;
  onCancel: (jobId: string) => void;
  onViewFullDetails: (jobId: string) => void;
}

// Pure: the patch applied when a job is cancelled.
export const cancelJobPatch = (job: Job): Job => ({
  ...job,
  stage: 'Cancelled',
  startDate: undefined,
  endDate: undefined,
});

// Pure: resolve the assigned crew for display.
export const crewSummary = (job: Job, allStaff: CrewMember[]): { count: number; names: string[] } => {
  const ids = job.crewMemberIds && job.crewMemberIds.length
    ? job.crewMemberIds
    : Array.from(new Set((job.allocations || []).flatMap(a => a.memberIds)));
  const names = ids
    .map(id => allStaff.find(s => s.id === id)?.name)
    .filter((n): n is string => !!n);
  return { count: ids.length, names };
};

const STAGE_COLOR: Record<JobStage, 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple'> = {
  Confirmed: 'gray',
  Scheduled: 'blue',
  'In Production': 'purple',
  'Touch Up': 'amber',
  'Ready for Inspection': 'amber',
  Completed: 'green',
  Marketing: 'gray',
  Cancelled: 'red',
};

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : null;

export const JobDetailsPanel = ({
  job, client, allStaff, onClose, onReschedule, onViewCrew, onCancel, onViewFullDetails,
}: JobDetailsPanelProps) => {
  useEffect(() => {
    if (!job) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [job, onClose]);

  if (!job) return null;

  const crew = crewSummary(job, allStaff);
  const start = fmtDate(job.startDate);
  const end = fmtDate(job.endDate);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-black text-gray-900 dark:text-white">{job.name}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-sm font-medium text-gray-400">#{job.jobNumber}</span>
            <Badge color={STAGE_COLOR[job.stage]}>{job.stage}</Badge>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <section>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Customer</h3>
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              {client?.name || 'Unknown customer'}
              {client?.phone && <span className="font-medium text-gray-500"> · {client.phone}</span>}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" /> {job.address}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Schedule</h3>
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
              <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              {start ? <span>{start}{end && end !== start ? `  →  ${end}` : ''}</span> : <span className="text-gray-400">Not scheduled</span>}
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
              {job.category && <span>{job.category}</span>}
              {job.is_locked && <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Locked</span>}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Crew</h3>
            <div className="flex items-center gap-1.5 text-sm text-gray-900 dark:text-white">
              <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              {crew.count > 0
                ? <span><span className="font-bold">{crew.count} assigned</span> · {crew.names.join(', ')}</span>
                : <span className="text-gray-400">No crew assigned</span>}
            </div>
          </section>
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <Button onClick={() => onReschedule(job.id)} className="w-full justify-center">Reschedule job</Button>
          <Button variant="secondary" onClick={() => onViewCrew(job.id)} className="w-full justify-center">View crew assignments</Button>
          <Button variant="danger" onClick={() => onCancel(job.id)} className="w-full justify-center">Cancel job</Button>
          <button
            onClick={() => onViewFullDetails(job.id)}
            className="w-full flex items-center justify-center gap-1 pt-2 text-sm font-bold text-primary-600 dark:text-primary-400 hover:underline"
          >
            View full details <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run components/views/JobScheduling/JobDetailsPanel.test.tsx`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Typecheck**

Run: `npm run lint`
Expected: no errors.

---

### Task 3: Thread `clients` into `JobSchedulingView` from `App`

**Files:**
- Modify: `App.tsx:292-303`
- Modify: `components/views/JobSchedulingView.tsx:23-38` (props interface + destructure)

- [ ] **Step 1: Pass `clients` from App**

In `App.tsx`, in the `<JobSchedulingView ... />` block (around line 292), add the `clients` prop:

```tsx
                            return <JobSchedulingView
                                jobs={jobs}
                                clients={clients}
                                workOrders={workOrders}
                                allStaff={employees}
                                crews={crews}
```

(Leave the remaining props unchanged.)

- [ ] **Step 2: Accept the prop in `JobSchedulingView`**

In `components/views/JobSchedulingView.tsx`, add `Client` to the type import from `../../types` and add `clients` to the props interface:

```tsx
import { Job, WorkOrder, CrewMember, CrewGroup, CrewScheduleEntry, GlobalSettings, Client } from '../../types';
```

In `interface JobSchedulingViewProps` add:

```tsx
  jobs: Job[];
  clients: Client[];
  workOrders: WorkOrder[];
```

And in the component's destructured params add `clients`:

```tsx
export const JobSchedulingView = ({
    jobs,
    clients,
    workOrders,
    allStaff,
    crews,
```

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: no errors (`clients` now provided and consumed).

---

### Task 4: Wire the panel into `JobSchedulingView`

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

- [ ] **Step 1: Import the panel, confirmation modal, and helper**

Add imports near the other view imports in `JobSchedulingView.tsx`:

```tsx
import { JobDetailsPanel, cancelJobPatch } from './JobScheduling/JobDetailsPanel';
import { ConfirmationModal } from '../modals/ConfirmationModal';
```

- [ ] **Step 2: Add panel + cancel state**

Below the existing `const [moveJob, setMoveJob] = useState<Job | null>(null);` line, add:

```tsx
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobToCancel, setJobToCancel] = useState<Job | null>(null);
```

- [ ] **Step 3: Add the cancel handler**

Add this handler alongside the other handlers (e.g. just after `handleDropJob`):

```tsx
  const handleConfirmCancel = () => {
    if (!jobToCancel) return;
    onUpdateJob(cancelJobPatch(jobToCancel));
    setJobToCancel(null);
    setSelectedJob(null);
  };
```

- [ ] **Step 4: Open the panel on card click instead of navigating**

In the `<ProductionBoard ... />` JSX, change the `onViewJob` prop from navigating to opening the panel:

```tsx
                onViewJob={(id) => { const j = jobs.find(x => x.id === id); if (j) setSelectedJob(j); }}
```

(Leave `onMoveJob` as-is.)

- [ ] **Step 5: Render the panel and confirmation modal**

Just before the closing `</div>` of the component (after the existing `<ReschedulePreviewPanel ... />`), add:

```tsx
        <JobDetailsPanel
            job={selectedJob}
            client={selectedJob ? (clients.find(c => c.id === selectedJob.clientId) ?? null) : null}
            allStaff={allStaff}
            onClose={() => setSelectedJob(null)}
            onReschedule={(id) => { const j = jobs.find(x => x.id === id); if (j) setMoveJob(j); setSelectedJob(null); }}
            onViewCrew={(id) => { const j = jobs.find(x => x.id === id); if (j) { setJobToAssign(j); setIsCrewModalOpen(true); } setSelectedJob(null); }}
            onCancel={(id) => { const j = jobs.find(x => x.id === id); if (j) setJobToCancel(j); }}
            onViewFullDetails={(id) => { setSelectedJob(null); onViewJob?.(id); }}
        />

        <ConfirmationModal
            isOpen={!!jobToCancel}
            onClose={() => setJobToCancel(null)}
            onConfirm={handleConfirmCancel}
            title="Cancel this job?"
            message="The job will be marked Cancelled and removed from the board. You can still find it from the customer or jobs list."
            confirmLabel="Cancel job"
            cancelLabel="Keep job"
            variant="danger"
        />
```

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npm run lint`
Expected: no errors.

Run: `npm test`
Expected: all tests pass (existing 27 + Task 1 buildLanes test + Task 2 panel/helper tests).

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Manual smoke check**

Start the dev server (`npm run dev`) and verify on the Production Board:
1. Clicking a job card opens the right-side panel (no full-page navigation).
2. Panel shows name, number, stage badge, customer, address, schedule, crew.
3. "Reschedule job" closes the panel and opens the single-job move drawer.
4. "View crew assignments" opens the crew modal for that job.
5. "Cancel job" prompts for confirmation; confirming removes the card from the board.
6. "View full details →" navigates to the full job detail page.
7. Esc / backdrop / X all close the panel.

---

## Notes for the implementer

- Do not add new dependencies. `@testing-library/react`, `vitest`, and `jsdom` are already configured (Phase 1).
- The `animate-[slideIn_...]` utility is cosmetic; if no `slideIn` keyframe exists in the Tailwind config, the panel still renders correctly (it just appears without the slide). Do not add global CSS for this — leave it as a progressive enhancement.
- Reuse the existing `setJobToAssign` / `setIsCrewModalOpen` state already present in `JobSchedulingView`; do not create a second crew modal.
