# Consolidate Single-Job Conflict UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant conflict blocks in the single-job edit panel — drop the red "N conflicts" strip + Auto-Fix and the duplicate `double-book` issue rows — leaving one coherent flow: green "No conflicts" only when fully clear, non-overlap advisories (due-date/weekend/capacity) as amber notes, and the existing conflict-resolution card.

**Architecture:** A presentational change confined to `SingleJobEditor.tsx`. Split the edited job's issues by kind: `double-book` overlaps are already represented by the conflict card, so only non-overlap issues remain as advisories. The green confirmation reuses `ConflictStrip`'s green branch, gated on having no problems at all.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + @testing-library/react, project i18n.

## Global Constraints

- Test runner: `npm test` (`vitest run`); type-check: `npm run lint` (`tsc --noEmit`).
- Scope is the single-job edit panel only (`SingleJobEditor`). Do not touch `BulkPreview`, `ConflictStrip`, `resolveSameDayConflicts`, `detectIssues`, or i18n.
- The green confirmation reuses the existing key `views.JobScheduling.reschedule.ConflictStrip.noConflicts` (no new strings).
- `tsconfig` does not set `noUnusedLocals`, so leaving the now-unused `suggestions` / `onAutoFix` props on `SingleJobEditor` is acceptable; do not rewire the panel/bulk props.

---

### Task 1: Consolidate the conflict blocks in `SingleJobEditor`

**Files:**
- Modify: `components/views/JobScheduling/reschedule/SingleJobEditor.tsx`
- Test: `components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx`

**Interfaces:**
- Consumes (existing): `jobIssues` (from `issues.filter(i => i.jobId === c.jobId)`, each a `ScheduleIssue` with `kind`/`message`), `conflictResolutions` (with `isMovableResolution`), and the `ConflictStrip` component's green branch (renders the "No conflicts" box when `issueCount === 0`).
- Produces: no new exports — purely the rendered output of `SingleJobEditor`.

- [ ] **Step 1: Write the failing tests**

Append these four tests to the `describe('SingleJobEditor', ...)` block in `SingleJobEditor.test.tsx`:

```tsx
  it('shows green "No conflicts" only when there are no advisories and no resolutions', () => {
    render(<SingleJobEditor {...base} issues={[]} conflictResolutions={[]} />);
    expect(screen.getByText('No conflicts')).toBeInTheDocument();
  });

  it('shows a non-overlap advisory (due-date) as a note, with no green box', () => {
    render(
      <SingleJobEditor
        {...base}
        issues={[{ jobId: 'a', jobName: 'Exterior Repaint', kind: 'past-due', severity: 'high',
          message: 'Exterior Repaint ends after the customer due date (June 18, 2026)' }]}
        conflictResolutions={[]}
      />,
    );
    expect(screen.getByText('Exterior Repaint ends after the customer due date (June 18, 2026)')).toBeInTheDocument();
    expect(screen.queryByText('No conflicts')).not.toBeInTheDocument();
  });

  it('hides the duplicate double-book row and the Auto-Fix strip when a conflict card is shown', () => {
    render(
      <SingleJobEditor
        {...base}
        issues={[{ jobId: 'a', jobName: 'Exterior Repaint', kind: 'double-book', severity: 'high',
          message: 'Exterior Repaint overlaps Downtown Commercial on the same crew that day' }]}
        suggestions={[{ id: 's1', jobId: 'a', label: 'Move Exterior Repaint to June 25, 2026', change }]}
        conflictResolutions={[
          { jobId: 'dc', jobName: 'Downtown Commercial', jobNumber: '0003', kind: 'unresolved',
            change: { ...change, jobId: 'dc' }, label: "Downtown Commercial can't fit on June 18, 2026 — reschedule manually" },
        ]}
      />,
    );
    // Conflict card content is present...
    expect(screen.getByText("Downtown Commercial can't fit on June 18, 2026 — reschedule manually")).toBeInTheDocument();
    // ...but the duplicate overlap row, the Auto-Fix button, and the green box are gone.
    expect(screen.queryByText('Exterior Repaint overlaps Downtown Commercial on the same crew that day')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /auto-fix/i })).not.toBeInTheDocument();
    expect(screen.queryByText('No conflicts')).not.toBeInTheDocument();
  });

  it('mixed: keeps the non-overlap advisory and the card, drops the overlap row (screenshot case)', () => {
    render(
      <SingleJobEditor
        {...base}
        issues={[
          { jobId: 'a', jobName: 'Exterior Repaint', kind: 'past-due', severity: 'high',
            message: 'Exterior Repaint ends after the customer due date (June 18, 2026)' },
          { jobId: 'a', jobName: 'Exterior Repaint', kind: 'double-book', severity: 'high',
            message: 'Exterior Repaint overlaps Downtown Commercial on the same crew that day' },
        ]}
        conflictResolutions={[
          { jobId: 'dc', jobName: 'Downtown Commercial', jobNumber: '0003', kind: 'unresolved',
            change: { ...change, jobId: 'dc' }, label: "Downtown Commercial can't fit on June 18, 2026 — reschedule manually" },
        ]}
      />,
    );
    expect(screen.getByText('Exterior Repaint ends after the customer due date (June 18, 2026)')).toBeInTheDocument();
    expect(screen.getByText("Downtown Commercial can't fit on June 18, 2026 — reschedule manually")).toBeInTheDocument();
    expect(screen.queryByText('Exterior Repaint overlaps Downtown Commercial on the same crew that day')).not.toBeInTheDocument();
    expect(screen.queryByText('No conflicts')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- SingleJobEditor`
Expected: FAIL — current code renders the `double-book` row and (with `suggestions` set) the Auto-Fix strip, and shows the green box via `issueCount === 0` logic that ignores `conflictResolutions`.

- [ ] **Step 3: Compute `advisories` / `hasProblems` and drop `canAutoFix`**

In `SingleJobEditor.tsx`, replace this block (currently at lines 98-100):

```ts
  const jobIssues = issues.filter(i => i.jobId === c.jobId);
  const jobHoursWarnings = hoursWarnings.filter(w => w.jobId === c.jobId);
  const canAutoFix = suggestions.some(s => s.jobId === c.jobId);
```

with:

```ts
  const jobIssues = issues.filter(i => i.jobId === c.jobId);
  const jobHoursWarnings = hoursWarnings.filter(w => w.jobId === c.jobId);
  // Overlaps are shown once, in the conflict-resolution card below; only the
  // non-overlap problems (due-date, weekend, capacity) remain as advisories.
  const advisories = jobIssues.filter(i => i.kind !== 'double-book');
  const hasProblems = conflictResolutions.length > 0 || advisories.length > 0;
```

- [ ] **Step 4: Replace the strip + issue-row block**

In `SingleJobEditor.tsx`, replace this block (currently at lines 127-134):

```tsx
      {!autoFixPreviewActive && <ConflictStrip issueCount={jobIssues.length} canAutoFix={canAutoFix} onAutoFix={onAutoFix} />}
      {jobIssues.length > 0 && (
        <div className="space-y-1.5">
          {jobIssues.map((iss, i) => (
            <div key={i} className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">{iss.message}</div>
          ))}
        </div>
      )}
```

with:

```tsx
      {!hasProblems && <ConflictStrip issueCount={0} canAutoFix={false} onAutoFix={() => {}} />}
      {advisories.length > 0 && (
        <div className="space-y-1.5">
          {advisories.map((iss, i) => (
            <div key={i} className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">{iss.message}</div>
          ))}
        </div>
      )}
```

(The `double-book` rows are now excluded via `advisories`; the red strip + Auto-Fix is gone; the green box shows only when `!hasProblems`. The `suggestions`, `onAutoFix`, and `autoFixPreviewActive` props remain on the component but are no longer used by the single-job render — that is fine, `noUnusedLocals` is off.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- SingleJobEditor`
Expected: PASS (existing + 4 new).

- [ ] **Step 6: Full suite + type-check**

Run: `npm test`
Expected: all suites pass.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/views/JobScheduling/reschedule/SingleJobEditor.tsx components/views/JobScheduling/reschedule/SingleJobEditor.test.tsx
git commit -m "feat(scheduling): consolidate single-job conflict UI (drop Auto-Fix strip + duplicate overlap rows)"
```

---

## Self-Review

**Spec coverage:**
- Drop Auto-Fix + red strip from single-job editor → Step 4 removes `ConflictStrip` red/Auto-Fix usage; test asserts no Auto-Fix button → ✅
- Drop duplicate `double-book` rows → `advisories` filter + test asserts overlap row absent → ✅
- Keep non-overlap advisories (due-date/weekend/capacity) → `advisories` retains `kind !== 'double-book'`; test asserts past-due note shown → ✅
- Conflict card unchanged → not modified; test asserts card content present → ✅
- Green "No conflicts" only when fully clear → `{!hasProblems && <ConflictStrip ... />}`; tests assert green present when clear, absent otherwise → ✅
- Scope confined to `SingleJobEditor` (+ test); no logic/i18n/bulk changes → ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete before/after code; commands have expected output.

**Type consistency:** `advisories` and `hasProblems` are local consts used only within `SingleJobEditor`. Test issue objects use the `ScheduleIssue` fields (`jobId`, `jobName`, `kind`, `severity`, `message`) and valid `IssueKind` values (`past-due`, `double-book`). The green-branch `ConflictStrip` call passes its required props (`issueCount`, `canAutoFix`, `onAutoFix`).
