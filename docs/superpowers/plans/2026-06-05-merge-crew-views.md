# Collapse Crew / Crew Member Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the Job Scheduling board to two view tabs — `Job` and `Crew` — by removing the team-grouped view and relabeling the per-person "Crew Member" tab to "Crew".

**Architecture:** All UI changes live in `components/views/JobSchedulingView.tsx`. The `view` state narrows from `'crew' | 'member' | 'job'` to `'member' | 'job'`; the internal value `'member'` is kept (the rest of the file is member-named) and only the user-facing label becomes "Crew". The orphaned `CrewLaneLabel` component is deleted. Crew *teams* remain a data concept (month coloring, assignment modal) — only the team *view* is removed.

**Tech Stack:** React + TypeScript, Vitest, lucide-react icons.

---

### Task 1: Remove the team view from JobSchedulingView

**Files:**
- Modify: `components/views/JobSchedulingView.tsx`
- Delete: `components/views/JobScheduling/CrewLaneLabel.tsx`

This is a UI refactor with no unit test of its own (no test asserts the teams view). Verification is the type-check, the existing suite, and a manual board check at the end. Make the edits in order, then verify.

- [ ] **Step 1: Narrow the `view` state type**

In `components/views/JobSchedulingView.tsx`, line ~191, change:

```tsx
  const [view, setView] = useState<'crew' | 'member' | 'job'>('job');
```

to:

```tsx
  const [view, setView] = useState<'member' | 'job'>('job');
```

- [ ] **Step 2: Drop the `buildLanes` branch in `boardLanes`**

Around line ~442, replace:

```tsx
  const boardLanes = useMemo<BoardLane[]>(() => {
    if (view === 'member') return buildMemberLanes(displayJobs, allStaff, weekDays, workConfig);
    if (view === 'job') return buildJobLanes(displayJobs, weekDays, workConfig);
    return buildLanes(displayJobs, crews, weekDays, workConfig);
  }, [view, displayJobs, allStaff, crews, weekDays, workConfig]);
```

with:

```tsx
  const boardLanes = useMemo<BoardLane[]>(() => {
    if (view === 'member') return buildMemberLanes(displayJobs, allStaff, weekDays, workConfig);
    return buildJobLanes(displayJobs, weekDays, workConfig);
  }, [view, displayJobs, allStaff, weekDays, workConfig]);
```

Note: `crews` is removed from this `useMemo`'s dependency array since `buildLanes` is gone.

- [ ] **Step 3: Remove the "Crew" (teams) tab button and relabel "Crew Member" → "Crew"**

In the View Controls block (around lines ~732–749), delete the entire teams "Crew" button:

```tsx
                <button
                    onClick={() => setView('crew')}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${view === 'crew' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                >
                    <Users className="w-4 h-4" /> Crew
                </button>
```

Then change the label of the remaining "Crew Member" button. Replace:

```tsx
                    <User className="w-4 h-4" /> Crew Member
```

with:

```tsx
                    <User className="w-4 h-4" /> Crew
```

After this step the tab row contains exactly two buttons: `Job` (`setView('job')`) and `Crew` (`setView('member')`).

- [ ] **Step 4: Remove the `view === 'crew'` row-label branch**

In the `renderRowLabel` prop on `<ProductionBoard>` (around lines ~850–874), remove the `view === 'crew'` branch so only the member branch and the `undefined` fallback remain. Replace:

```tsx
          renderRowLabel={
            view === 'member'
            ? (lane) => {
                const emp = allStaff.find(s => s.id === lane.crewId);
                return (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border border-white dark:border-gray-600 shrink-0">
                      {emp?.photo ? <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" /> : <User className="w-full h-full p-1.5 text-gray-400" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{lane.crewName}</div>
                      {emp?.role && <div className="text-[11px] text-gray-400 truncate">{emp.role}</div>}
                    </div>
                  </div>
                );
              }
            : view === 'crew'
            ? (lane) => {
                const crew = crews.find(c => c.id === lane.crewId);
                const members = (crew?.memberIds || [])
                  .map(id => allStaff.find(s => s.id === id))
                  .filter((m): m is CrewMember => !!m);
                return <CrewLaneLabel name={lane.crewName} members={members} />;
              }
            : undefined}
```

with:

```tsx
          renderRowLabel={
            view === 'member'
            ? (lane) => {
                const emp = allStaff.find(s => s.id === lane.crewId);
                return (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border border-white dark:border-gray-600 shrink-0">
                      {emp?.photo ? <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" /> : <User className="w-full h-full p-1.5 text-gray-400" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{lane.crewName}</div>
                      {emp?.role && <div className="text-[11px] text-gray-400 truncate">{emp.role}</div>}
                    </div>
                  </div>
                );
              }
            : undefined}
```

- [ ] **Step 5: Drop now-unused imports**

In the import block at the top of the file:

1. Remove `buildLanes` from the `productionBoard` import (line ~19). It becomes:

```tsx
import { buildMemberLanes, buildJobLanes, visibleWeekDays, crewColorForJob, BoardLane } from '../../services/productionBoard';
```

2. Remove the `CrewLaneLabel` import line entirely (line ~28):

```tsx
import { CrewLaneLabel } from './JobScheduling/CrewLaneLabel';
```

3. Remove `Users` from the `lucide-react` import (line ~5). Confirm `Users` has no other use first (next step's grep covers it). The other icons on that line (`User`, `Plus`, `Check`, etc.) stay.

Leave `crews` in the component props/usage — it is still used by `crewColorForJob`, `detectIssues`, `buildSuggestions`, `computeImpact`, and `CrewSelectionModal`.

- [ ] **Step 6: Confirm `Users` and `CrewLaneLabel` have no remaining references, then delete the orphaned component**

Run:

```bash
grep -n "Users\b" components/views/JobSchedulingView.tsx
grep -rn "CrewLaneLabel" components services
```

Expected: the first prints nothing (the `Users` icon is gone). The second prints nothing after the import was removed (only the definition file remains). If the `CrewLaneLabel.tsx` file itself still shows, that's expected — delete it:

```bash
git rm components/views/JobScheduling/CrewLaneLabel.tsx
```

- [ ] **Step 7: Type-check and run the test suite**

Run:

```bash
npx tsc --noEmit && npx vitest run
```

Expected: no TypeScript errors (a leftover unused-import or stale `view === 'crew'` reference would surface here), and the existing suite passes — `services/productionBoard.test.ts` (including the `buildLanes` describe block) stays green because `buildLanes` is untouched in the service.

- [ ] **Step 8: Manual board check**

Run the app, open Job Scheduling, and confirm:
- Exactly two view tabs render: `Job` and `Crew`.
- `Crew` shows one row per person (with avatar/role), not per team.
- The `Crew` tab's Board/Hours sub-toggle still works, and per-day availability editing + the Hours grid still function.
- `Job` view is unchanged and is the default on load.
- Month view job colors are unchanged (crew-team coloring still works).

- [ ] **Step 9: Commit**

```bash
git add components/views/JobSchedulingView.tsx
git commit -m "feat: collapse Crew/Crew Member tabs into single Crew view

Remove the team-grouped board view and relabel the per-person view to
'Crew'. Crew teams remain a data concept (month coloring, assignment
modal); only the view is removed. Delete the orphaned CrewLaneLabel.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Log deferred cleanup

**Files:**
- Modify: `/Users/MiggleWork/.claude/projects/-Users-MiggleWork-Downloads-feb-24-estimate-master/memory/production-board-phases.md` (the existing deferred-cleanup backlog memory)

- [ ] **Step 1: Add a backlog note**

Append a line noting that `buildLanes` in `services/productionBoard.ts` is now dead app-code (only referenced by its own tests) after the team view was removed, and can be deleted in a future cleanup pass along with its tests. This is a memory-file edit, not a code commit.
