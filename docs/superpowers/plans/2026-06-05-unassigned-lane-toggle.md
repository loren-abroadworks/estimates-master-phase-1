# Unassigned Lane — Naming & Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Crew board, name jobs by their assigned (incl. inactive) person instead of bucketing them, and add a toggle to show/hide the genuinely-unassigned lane.

**Architecture:** Pure-core change in `services/productionBoard.ts` (`buildMemberLanes` + `BoardLane`), driven by unit tests; presentational wiring (toggle state, filter, inactive badge) in `components/views/JobSchedulingView.tsx`.

**Tech Stack:** React + TypeScript, Vitest, Tailwind, lucide-react.

---

### Task 1: `buildMemberLanes` — seed active only, name inactive assignees

**Files:**
- Modify: `services/productionBoard.ts` (`BoardLane` interface ~line 30; `buildMemberLanes` ~lines 146-181)
- Test: `services/productionBoard.test.ts` (`describe('buildMemberLanes')` ~line 141)

- [ ] **Step 1: Write failing tests** — add to the `buildMemberLanes` describe block:

```ts
  it('seeds only active members (inactive with no work gets no lane)', () => {
    const withInactive = [...staff, { id: 'm3', name: 'Cara', status: 'Inactive' }] as CrewMember[];
    const lanes = buildMemberLanes([], withInactive, weekDays, cfg);
    expect(lanes.map(l => l.crewId)).toEqual(['m1', 'm2']);
  });

  it('names an inactive assignee in their own lane, flagged inactive, not Unassigned', () => {
    const withInactive = [...staff, { id: 'm3', name: 'Cara', status: 'Inactive' }] as CrewMember[];
    const j = job({ id: 'jI', crewMemberIds: ['m3'] });
    const lanes = buildMemberLanes([j], withInactive, weekDays, cfg);
    const lane = lanes.find(l => l.crewId === 'm3')!;
    expect(lane.crewName).toBe('Cara');
    expect(lane.inactive).toBe(true);
    expect(lane.cardsByDay['2026-06-02'][0].jobId).toBe('jI');
    expect(lanes.find(l => l.crewId === 'unassigned')).toBeUndefined();
  });
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run services/productionBoard.test.ts -t buildMemberLanes`
Expected: the two new tests FAIL (inactive member currently seeded; no `inactive` flag).

- [ ] **Step 3: Add `inactive?` to `BoardLane`**

```ts
export interface BoardLane {
  crewId: string;          // CrewGroup id, or 'unassigned'
  crewName: string;
  /** day key -> cards present that day */
  cardsByDay: Record<string, BoardCard[]>;
  inactive?: boolean;      // member exists in roster but status === 'Inactive'
}
```

- [ ] **Step 4: Rewrite `buildMemberLanes` body**

```ts
export const buildMemberLanes = (
  jobs: Job[],
  staff: CrewMember[],
  weekDays: Date[],
  config: WorkingTimeConfig,
): BoardLane[] => {
  const dayKeys = weekDays.map(toLocalDateKey);
  const byId = new Map(staff.map(s => [s.id, s]));
  const lanes = new Map<string, BoardLane>();
  const ensure = (id: string, name: string, inactive?: boolean): BoardLane => {
    if (!lanes.has(id)) lanes.set(id, { crewId: id, crewName: name, cardsByDay: {}, ...(inactive ? { inactive: true } : {}) });
    return lanes.get(id)!;
  };

  // Seed a lane for every ACTIVE member so they render even with no work.
  staff.filter(s => s.status !== 'Inactive').forEach(m => ensure(m.id, m.name));

  for (const job of jobs) {
    if (!schedulable(job)) continue;
    const known = memberIdsOf(job).filter(id => byId.has(id));
    const targets = known.length ? known : ['unassigned'];
    const card = cardFor(job);
    for (const target of targets) {
      const member = byId.get(target);
      const lane = target === 'unassigned'
        ? ensure('unassigned', 'Unassigned')
        : ensure(target, member!.name, member!.status === 'Inactive');
      for (const key of dayKeys) {
        if (occupiesWorkingDay(job.startDate!, job.endDate, key, config)) {
          (lane.cardsByDay[key] ||= []).push(card);
        }
      }
    }
  }

  return Array.from(lanes.values()).sort((a, b) => {
    if (a.crewId === 'unassigned') return 1;
    if (b.crewId === 'unassigned') return -1;
    return 0;
  });
};
```

- [ ] **Step 5: Run the full file, verify green**

Run: `npx vitest run services/productionBoard.test.ts`
Expected: PASS (new + existing `buildMemberLanes` tests, no regressions).

- [ ] **Step 6: Commit**

```bash
git add services/productionBoard.ts services/productionBoard.test.ts
git commit -m "feat: name inactive assignees in own crew lane; seed active members only"
```

---

### Task 2: Crew board — Unassigned toggle + inactive badge

**Files:**
- Modify: `components/views/JobSchedulingView.tsx` (view state ~line 190; `boardLanes` useMemo ~line 441; Board/Hours toggle block ~line 779; member `renderRowLabel` ~line 842)

- [ ] **Step 1: Add toggle state** — beside the other `useState` hooks (~line 198):

```tsx
  const [showUnassigned, setShowUnassigned] = useState(true);
```

- [ ] **Step 2: Filter the unassigned lane in `boardLanes`**

Replace the member branch of the `boardLanes` useMemo:

```tsx
  const boardLanes = useMemo<BoardLane[]>(() => {
    if (view === 'member') {
      const lanes = buildMemberLanes(displayJobs, allStaff, weekDays, workConfig);
      return showUnassigned ? lanes : lanes.filter(l => l.crewId !== 'unassigned');
    }
    return buildJobLanes(displayJobs, weekDays, workConfig);
  }, [view, displayJobs, allStaff, weekDays, workConfig, showUnassigned]);
```

- [ ] **Step 3: Add `hasUnassigned` derived flag** (after `boardLanes`):

```tsx
  const hasUnassigned = useMemo(
    () => view === 'member' && buildMemberLanes(displayJobs, allStaff, weekDays, workConfig).some(l => l.crewId === 'unassigned'),
    [view, displayJobs, allStaff, weekDays, workConfig],
  );
```

- [ ] **Step 4: Render the toggle button** — inside the `view === 'member'` Board/Hours block, after the Hours button's closing `</button>`, still inside that flex `<div>` add a sibling control. Place this AFTER the closing `</div>` of the Board/Hours pill group, as its own inline control:

```tsx
        {view === 'member' && boardMode === 'board' && scale === 'week' && hasUnassigned && (
          <label className="mb-6 ml-3 inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showUnassigned}
              onChange={e => setShowUnassigned(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            Show unassigned
          </label>
        )}
```

- [ ] **Step 5: Inactive badge in `renderRowLabel`** — in the member-view label (~line 851), after the `lane.crewName` div, add:

```tsx
                      <div className="font-bold text-sm truncate">{lane.crewName}</div>
                      {lane.inactive
                        ? <div className="text-[11px] text-amber-500 truncate">Inactive</div>
                        : emp?.role && <div className="text-[11px] text-gray-400 truncate">{emp.role}</div>}
```

(Replace the existing `{emp?.role && ...}` line with the conditional above.)

- [ ] **Step 6: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: add Show unassigned toggle and inactive badge to crew board"
```

---

### Task 3: Finish

- [ ] Use superpowers:finishing-a-development-branch to verify tests and merge.
