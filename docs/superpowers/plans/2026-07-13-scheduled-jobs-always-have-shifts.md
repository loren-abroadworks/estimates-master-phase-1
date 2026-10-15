# Every Scheduled Job Has A Shift — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce "a job with a `startDate` always has ≥1 allocation": fix the two latent desync bugs (job-level moves and undo ignore `allocations`), migrate the demo data (every scheduled mock job gets a shift; Exterior Repaint becomes a Prep/Paint showcase), and make the unscheduled-card drop birth the job with a "Crew" shift via the cards drawer.

**Architecture:** Order matters — the engine + undo fixes land first because migrating the mock data exposes them everywhere. `applyChangeToJob`'s job branch moves all allocations by the change's calendar-day delta then recomputes the envelope; `handleApplySchedule`'s inverse snapshots/restores `allocations`. Migration is a one-line map through `ensureJobAllocations` plus a hand-built two-shift `job-2`. The drop path reuses the existing draft-drawer staging.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest. Typecheck `npx tsc --noEmit`; one test file `npx vitest run <path>`.

## Global Constraints

- **Legacy behavior byte-identical.** A job with **no** allocations takes the existing `applyChangeToJob` job branch unchanged; legacy fallbacks in boards/chips/drawer are untouched.
- **Date keys are bare `YYYY-MM-DD`;** all day-delta math anchors at local noon (`` `${key}T12:00:00` ``).
- **Demo occupancy unchanged.** The migration must not alter any mock job's dates, members, or per-day windows — only add allocations that mirror them (the demo calendar is deliberately conflict-free).
- **TDD.** Failing test first, minimal code, green, commit — one commit per task.
- **Commit footer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Out of scope:** deleting legacy fallback branches; job creation (estimate → unscheduled job); the drawer-edit undo-stack limitation.

---

## File Structure

- `services/scheduleEngine.ts` — **Modify.** `applyChangeToJob` job branch moves allocations by the day delta.
- `App.tsx` — **Modify.** Undo inverse gains `allocations` (snapshot + restore).
- `data/mockData.ts` — **Modify.** Map jobs through `ensureJobAllocations`; give `job-2` explicit Prep/Paint shifts.
- `data/mockData.test.ts` — **Create.** Invariant: scheduled mock jobs have allocations.
- `components/views/JobSchedulingView.tsx` — **Modify.** `handleDropJob` no-`shiftId` branch stages a draft.
- Test: `services/scheduleEngine.test.ts` — **Modify.**

---

### Task 1: `applyChangeToJob` job branch moves allocations

**Files:**
- Modify: `services/scheduleEngine.ts`
- Test: `services/scheduleEngine.test.ts`

**Interfaces:**
- Consumes: `toLocalDateKey`, `recomputeJobEnvelope` (module-local).
- Produces: unchanged signature. New behavior: a change **without** `shiftId` on a job **with** dated allocations re-keys every allocation's `startDate`/`endDate`/`dailyHours` keys by `dayDelta(job.startDate → change.newStart)` and returns `recomputeJobEnvelope(...)` (still merging `change.dailyHours` onto `job.dailyHours` as today). No allocations → existing return, byte-identical.

- [ ] **Step 1: Write the failing test**

Add to `services/scheduleEngine.test.ts`:

```ts
describe('applyChangeToJob (job-level move of an allocation job)', () => {
  const job = {
    id: 'j1', name: 'J', jobNumber: '1',
    startDate: '2026-07-06T08:00:00', endDate: '2026-07-08T12:00:00',
    allocations: [
      { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-07-06', endDate: '2026-07-06', startTime: '08:00', endTime: '17:00',
        dailyHours: { '2026-07-06': { startTime: '08:00', endTime: '12:00' } } },
      { id: 's2', name: 'Paint', memberIds: ['m1'], startDate: '2026-07-07', endDate: '2026-07-08', startTime: '08:00', endTime: '12:00' },
    ],
  } as unknown as Job;

  it('moves every allocation by the change day-delta and recomputes the envelope', () => {
    const change: ProposedChange = {
      jobId: 'j1', jobName: 'J', jobNumber: '1',
      oldStart: '2026-07-06T08:00:00', oldEnd: '2026-07-08T12:00:00',
      newStart: '2026-07-08T08:00:00', newEnd: '2026-07-10T12:00:00', // +2 days
    };
    const out = applyChangeToJob(job, change);
    const s1 = out.allocations!.find(a => a.id === 's1')!;
    const s2 = out.allocations!.find(a => a.id === 's2')!;
    expect(s1.startDate).toBe('2026-07-08');
    expect(s1.dailyHours).toEqual({ '2026-07-08': { startTime: '08:00', endTime: '12:00' } });
    expect(s2.startDate).toBe('2026-07-09');
    expect(s2.endDate).toBe('2026-07-10');
    expect(out.startDate).toBe('2026-07-08T08:00:00'); // envelope recomputed from shifts
    expect(out.endDate).toBe('2026-07-10T12:00:00');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run services/scheduleEngine.test.ts -t "job-level move of an allocation job"`
Expected: FAIL — allocations untouched (`s1.startDate` still `2026-07-06`).

- [ ] **Step 3: Implement**

In `applyChangeToJob`, replace the final job-level return:

```ts
  // Job-level change on an allocation-based job: move every shift by the change's
  // calendar-day delta so the envelope and the shifts stay in sync (bulk reschedule,
  // rain-day, cascade followers, Auto-Fix). Legacy jobs keep the plain date write.
  const allocs = (job.allocations ?? []).filter(a => a.startDate);
  if (allocs.length && job.startDate) {
    const delta = Math.round(
      (new Date(`${toLocalDateKey(new Date(change.newStart))}T12:00:00`).getTime()
        - new Date(`${toLocalDateKey(new Date(job.startDate))}T12:00:00`).getTime()) / 86_400_000,
    );
    const rekey = (k: string): string => {
      const d = new Date(`${k}T12:00:00`);
      d.setDate(d.getDate() + delta);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const moved = (job.allocations ?? []).map(a => !a.startDate ? a : ({
      ...a,
      startDate: rekey(a.startDate),
      endDate: a.endDate ? rekey(a.endDate) : rekey(a.startDate),
      ...(a.dailyHours ? { dailyHours: Object.fromEntries(Object.entries(a.dailyHours).map(([k, w]) => [rekey(k), w])) } : {}),
    }));
    return recomputeJobEnvelope({
      ...job,
      allocations: moved,
      ...(change.dailyHours ? { dailyHours: { ...job.dailyHours, ...change.dailyHours } } : {}),
    });
  }
  return {
    ...job,
    startDate: change.newStart,
    endDate: change.newEnd,
    ...(change.dailyHours ? { dailyHours: { ...job.dailyHours, ...change.dailyHours } } : {}),
  };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run services/scheduleEngine.test.ts`
Expected: PASS — new test + all existing `applyChangeToJob` tests (the legacy/job-branch tests use allocation-less jobs and hit the unchanged return).

- [ ] **Step 5: Commit**

```bash
git add services/scheduleEngine.ts services/scheduleEngine.test.ts
git commit -m "fix(scheduling): job-level moves shift a job's allocations by the day delta

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Undo snapshots and restores allocations

**Files:**
- Modify: `App.tsx`
- Test: no unit harness for App; typecheck + full suite here, behavior in Task 5 runtime verify.

- [ ] **Step 1: Extend the inverse type**

In `App.tsx` (line ~65), change:
```ts
  inverse: { jobId: string; startDate?: string; endDate?: string; dailyHours?: Job['dailyHours'] }[];
```
to:
```ts
  inverse: { jobId: string; startDate?: string; endDate?: string; dailyHours?: Job['dailyHours']; allocations?: Job['allocations'] }[];
```

- [ ] **Step 2: Snapshot in `handleApplySchedule`**

In the deduped `inverse` map, extend the entry (the `jobs.find` result is used twice — hoist it):
```ts
      .map(c => {
        const pre = jobs.find(j => j.id === c.jobId);
        return {
          jobId: c.jobId,
          startDate: c.oldStart ?? undefined,
          endDate: c.oldEnd ?? undefined,
          // Snapshot the pre-commit per-day windows AND allocations so undo restores
          // the true pre-move state — the commit may rewrite both.
          dailyHours: pre?.dailyHours,
          allocations: pre?.allocations,
        };
      });
```

- [ ] **Step 3: Restore in `undoReschedule`**

Change the restore map (line ~179):
```ts
            return inv ? { ...j, startDate: inv.startDate, endDate: inv.endDate, dailyHours: inv.dailyHours, allocations: inv.allocations } : j;
```

- [ ] **Step 4: Typecheck + full suite**

Run: `npx tsc --noEmit` and `npx vitest run` — clean + green.

- [ ] **Step 5: Commit**

```bash
git add App.tsx
git commit -m "fix(scheduling): undo restores a job's allocations alongside its dates

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Mock-data migration + Prep/Paint showcase + invariant test

**Files:**
- Modify: `data/mockData.ts`
- Create: `data/mockData.test.ts`

**Interfaces:**
- Consumes: `ensureJobAllocations` from `../services/shifts` (no import cycle — services never import `data/`).
- Produces: every `MOCK_JOBS` entry with a `startDate` has ≥1 allocation; `job-2` has shifts `Prep` (day 1, 08:00–17:00) and `Paint` (days 2–3, 08:00–12:00), members `cm-6, cm-3, cm-4`.

- [ ] **Step 1: Write the failing invariant test**

Create `data/mockData.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MOCK_JOBS } from './mockData';

describe('MOCK_JOBS shift invariant', () => {
  it('every scheduled job has at least one allocation', () => {
    const shiftless = MOCK_JOBS.filter(j => j.startDate && !(j.allocations?.length));
    expect(shiftless.map(j => j.id)).toEqual([]);
  });

  it('unscheduled jobs have none', () => {
    for (const j of MOCK_JOBS.filter(j => !j.startDate)) {
      expect(j.allocations ?? []).toHaveLength(0);
    }
  });

  it('Exterior Repaint is the two-shift showcase', () => {
    const j = MOCK_JOBS.find(x => x.id === 'job-2')!;
    expect(j.allocations?.map(a => a.name)).toEqual(['Prep', 'Paint']);
    expect(j.allocations?.[0].memberIds).toEqual(['cm-6', 'cm-3', 'cm-4']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run data/mockData.test.ts`
Expected: FAIL — every scheduled job is currently shiftless.

- [ ] **Step 3: Implement the migration**

In `data/mockData.ts`:

1. Add to the imports (top of file):
```ts
import { ensureJobAllocations } from '../services/shifts';
```

2. Rename the jobs literal and export the mapped version. Change:
```ts
export const MOCK_JOBS: Job[] = [
```
to:
```ts
const RAW_JOBS: Job[] = [
```
and immediately after the array's closing `];` add:
```ts
// Every scheduled job carries at least one shift: materialize a "Crew" allocation
// mirroring each job's dates + per-day windows (no-op for unscheduled jobs and for
// jobs that already define allocations explicitly).
export const MOCK_JOBS: Job[] = RAW_JOBS.map(ensureJobAllocations);
```

3. Give `job-2` (Exterior Repaint) explicit shifts. Its literal currently has
`startDate: jobDay(0, 8), endDate: jobDay(2, 17), crewMemberIds: ['cm-6','cm-3','cm-4'], dailyHours: dayWindows([1, AM], [2, AM])`.
Add after `dailyHours`:
```ts
    // Two-shift showcase: Prep day 1 (full day), Paint days 2–3 (mornings) — same
    // members and windows as the single-job version, so occupancy is unchanged.
    allocations: [
      { id: 'shift-job-2-prep', name: 'Prep', memberIds: ['cm-6', 'cm-3', 'cm-4'],
        startDate: dayKey(0), endDate: dayKey(0), startTime: '08:00', endTime: '17:00' },
      { id: 'shift-job-2-paint', name: 'Paint', memberIds: ['cm-6', 'cm-3', 'cm-4'],
        startDate: dayKey(1), endDate: dayKey(2), startTime: '08:00', endTime: '12:00' },
    ],
```
(`ensureJobAllocations` no-ops on it since allocations exist.)

- [ ] **Step 4: Run to verify it passes + full suite**

Run: `npx vitest run data/mockData.test.ts` then `npx vitest run`
Expected: PASS + all green. If any board/App test asserted allocation-less mock jobs, inspect the failure — the fix is expected to be in the test's assumption only if it hardcoded "no shifts"; report otherwise.

- [ ] **Step 5: Commit**

```bash
git add data/mockData.ts data/mockData.test.ts
git commit -m "feat(scheduling): every scheduled mock job ships with shifts (Prep/Paint showcase)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Unscheduled-card drop births a Crew shift (draft drawer)

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`

**Interfaces:**
- Consumes: `ensureJobAllocations` (already imported), the draft-staging pattern from the shift branch above it.
- Produces: `handleDropJob`'s no-`shiftId` branch stages `draftJob` instead of a `moveJobToSlot` change.

- [ ] **Step 1: Replace the legacy drop branch**

In `handleDropJob`, replace the block after the `if (shiftId) { ... return; }` branch:

```ts
    // No shift id: an unscheduled card (or a shiftless job) dropped on a day. Build the
    // dated job at the drop day, materialize its Crew shift, and open the cards drawer —
    // the job is born with a shift; Apply commits the draft, Cancel discards it.
    const startISO = `${dayKey}T${String(workConfig.workDayStartHour).padStart(2, '0')}:00:00`;
    const durMs = job.startDate && job.endDate
      ? new Date(job.endDate).getTime() - new Date(job.startDate).getTime()
      : (workConfig.workDayEndHour - workConfig.workDayStartHour) * 3_600_000;
    const endISO = new Date(new Date(startISO).getTime() + durMs).toISOString();
    const draft = ensureJobAllocations({ ...job, startDate: startISO, endDate: endISO });
    const label = job.startDate ? `Move ${job.name}` : `Schedule ${job.name}`;
    setCascade(false);
    setDraftMovedShiftId(draft.allocations?.[0]?.id ?? null);
    preview.stage({
      changes: [], label, mode: 'edit', primaryJobId: jobId, draftJob: draft,
      commit: (eff) => onApplySchedule(eff, label),
    });
    setPendingMoveId(jobId);
```

Remove the now-dead `moveJobToSlot` call from this branch; drop `moveJobToSlot` from the scheduleEngine import **only if** nothing else in the view uses it (grep first).

- [ ] **Step 2: Typecheck + full suite**

Run: `npx tsc --noEmit` and `npx vitest run` — clean + green.

- [ ] **Step 3: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat(scheduling): dropping an unscheduled card births a Crew shift via the cards drawer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Full-suite verification + runtime verify + finish

- [ ] **Step 1: Typecheck + full suite**

Run: `npx tsc --noEmit` then `npx vitest run` — clean + all pass (~+4 tests).

- [ ] **Step 2: Runtime verify (verify skill)**

No seeding needed — the migrated demo data IS the fixture. Start `vite`, drive Chromium:
1. **Week board:** Exterior Repaint renders as **Prep** and **Paint** bars; other jobs render one "Crew"-shift bar each (labelled by job name on the week board's job bars — confirm bars render, not blank).
2. **Crew grid (Crew tab):** chips show the shift on the time line (e.g. `Prep · 8:00–5:00`) with **no manual setup**.
3. **Drop an unscheduled card** (e.g. Johnson Hallway Refresh) onto a day → cards drawer opens with one "Crew" shift at the drop day; Apply → the job appears on the board with a shift.
4. **Rain-day (right-click a day → mark rain)** or Bulk Reschedule +1 day → allocation jobs' bars **move**; then **Undo** from the toast → bars move **back** (exercises Tasks 1+2).

- [ ] **Step 3: Finish the branch**

Announce and use **superpowers:finishing-a-development-branch**.

---

## Self-Review

**Spec coverage:** §1 engine fix → Task 1; §2 undo → Task 2; §3 migration + showcase → Task 3; §4 drop path → Task 4; invariant + runtime checks → Tasks 3/5. Edge cases: unscheduled stay allocation-less (test in Task 3; `ensureJobAllocations` no-ops), legacy branch byte-identical (Task 1 keeps the final return verbatim), undo-of-first-materialization restores `undefined` allocations (Task 2 snapshot is pre-commit). ✅

**Placeholder scan:** none — code and assertions shown; the one conditional (Task 3 Step 4 "if any test assumed shiftless mocks") names the expected resolution path.

**Type consistency:** `inverse.allocations?: Job['allocations']` (Task 2) matches the snapshot/restore; Task 1's re-key math mirrors the existing shift branch; Task 4 reuses the `draftJob` staging shape (`changes: [], primaryJobId, draftJob`) already consumed by the panel/Apply; `dayKey(n)` and `jobDay(n,h)` are existing mockData helpers used by `job-2` today.
