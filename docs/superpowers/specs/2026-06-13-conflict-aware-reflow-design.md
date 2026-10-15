# Conflict-Aware Schedule Reflow — Design

**Date:** 2026-06-13
**Status:** Draft (pending spec review)
**Builds on:** `2026-06-13-job-total-hours-and-smart-time-shift-design.md`
(the "Option A" dense time-shift this design replaces) and
`2026-06-05-cascade-following-jobs-design.md` /
`2026-06-05-cascade-end-date-limit-design.md` (the cascade + "Stop cascade after"
cutoff this design reuses).

## Problem

When a user edits a day's hours in the Edit Schedule panel — e.g. changes a job's
first day to start at 4 PM — the current smart time-shift (`reflowFromStart` /
`timeShiftChange`) **densely repacks** all of the job's hours forward across
consecutive working days, filling each day from the workday start. That rewrites
the *other* days' windows (e.g. Wed/Thu jump to 8 AM–5 PM) and **double-books the
crew**, who already work other shared-crew jobs in those hours.

Observed: original job Jun 9–12, each day 1–5 PM (4 h × 4 = 16 h). Setting Jun 9 to
start at 4 PM repacks the remaining hours into Wed 8 AM–5 PM and Thu 8 AM–11 AM,
clashing with the morning jobs that crew is already on.

The reflow must instead place displaced hours into time the crew is **actually
free**, and resolve any jobs that get in the way — never silently create a
conflict.

## Goals

- **One master toggle** ("Cascade following jobs") gates the whole smart behavior:
  when ON, the edited job is reflowed conflict-free **and** other shared-crew jobs
  are moved out of the way; when OFF, hours are applied **exactly as typed**,
  nothing else moves, and any resulting conflict/under-schedule is shown as a
  warning (today's behavior). Reflow and cascade are the same switch.
- When ON, every edit still schedules the job's **fixed total hours** (today's
  `scheduledWindowHours`, captured when the editor opens). Days the user has set are
  preserved; only the *leftover* hours are re-placed.
- Leftover hours land in **conflict-free clock-time** (same-day + non-overlapping
  for shared crew), within the workday bounds from scheduling settings
  (`workDayStartHour`/`workDayEndHour`).
- A secondary toggle picks the placement mode: **Smart** (default — compact, extend
  existing days' windows into adjacent free time first) vs **Simple** (only ever add
  new days). One block per day per job is a hard model constraint.
- Jobs that block a placement are **re-timed within their day** when both fit, else
  **moved past the project's new end**. This resolution **chains** to downstream
  conflicts, bounded by the existing **"Stop cascade after"** cutoff.
- All resulting moves appear as **additional rows in the same reschedule preview**
  and commit together on Apply. Nothing changes until Apply.

## Non-Goals

- No change to how the job's total hours / `totalProductionHours` is computed
  (carried over from the prior spec).
- No new persistence model — reuse `Job.startDate`/`endDate` + `Job.dailyHours` and
  the existing `ProposedChange` → Apply pipeline.
- No re-balancing of *which* crew member works what; conflict resolution moves whole
  jobs in time, it does not reassign people.
- Locked jobs are never moved (surfaced as blocking conflicts, as today).

---

## Part 1 — Clock-time conflict primitive

Today the only "conflict" notion in movement is day-level (`jobsShareCrew` + days
overlap, via `detectIssues`). This design adds the missing **time-of-day** check.

**New rule:** two jobs *clock-conflict* when they (a) share a crew member or group
(`jobsShareCrew`), (b) fall on the same calendar day, and (c) their clock-time
windows overlap.

A new pure helper in `scheduleEngine.ts` exposes, for a given crew scope and day,
the **occupied clock-time intervals** and the complementary **free intervals**
within `[workDayStartHour, workDayEndHour]`. Everything below is built on this.

## Part 2 — Conflict-aware reflow

New pure engine function (working name `reflowAvoidingConflicts`):

```
reflowAvoidingConflicts(
  job, pinnedDayHours, jobs, crews, config,
  { keepExistingDaysAsIs, untilDate }
) -> { primary: ProposedChange, displaced: ProposedChange[] }
```

Algorithm:

1. **Total to schedule** = `scheduledWindowHours(job)` captured at editor open
   (fixed for the editing session).
2. **Pin** the user-edited day windows (`pinnedDayHours`, i.e. `dailyHoursEdits`).
   These are kept exactly as set.
3. **Leftover** = total − sum(pinned). If ≤ 0, the primary just reflects the pinned
   windows and there is no placement (a surplus over the estimate is the user's
   choice; the existing "over estimate" advisory still applies).
4. **Place the leftover**, earliest-first:
   - **Smart mode (default):** for each existing pinned day in order, **extend that
     day's existing window into conflict-free time directly adjacent to it** (earlier
     or later), capped at the workday bounds. (Each day holds only one block per job,
     so non-adjacent free time cannot be used.) Then, if any hours remain, append new
     working day(s) after the job's span.
   - **Simple mode:** skip existing days entirely; place all leftover on new working
     day(s) after the job's span.
5. **Blocked placement (new days):** when the earliest placement day already holds a
   shared-crew job that occupies the needed slot:
   - Try to **re-time the blocker within that workday** so the blocker and the
     leftover both fit without overlap (leftover takes the earliest slot, blocker
     shuffles to remaining free time).
   - If they **cannot both fit** in the workday, add the blocker to `displaced`,
     **moved to the earliest working slot after the project's new end**.
6. **Chain & cutoff:** each `displaced` job is itself resolved the same way
   (it may displace further shared-crew jobs). The chain is bounded by `untilDate`
   (the "Stop cascade after" date): a job whose original start is **after** the
   cutoff is left in place and surfaced as a warning (reusing the existing
   `after-limit` protected-row + leapfrog warning mechanism) rather than moved.

The function is deterministic and pure (no `Date.now()`), consistent with the rest
of `scheduleEngine.ts`.

## Part 3 — UI

One master toggle, two dependent controls shown only when it is ON:

- **"Cascade following jobs"** (master) — the existing toggle, now gating the full
  smart behavior (conflict-aware reflow of the edited job + movement of other
  shared-crew jobs). Unchanged open/reset behavior: resets to off on editor open and
  defaults ON when a time-shift creates a shared-crew conflict.
  - **OFF:** hours applied exactly as typed; no reflow of leftover, no other job
    moves. Any conflict or under-scheduled total is shown as a warning only.
- **"Keep existing days as-is"** (secondary, shown when master ON) — off = Smart
  (fill free time on existing days), on = Simple (new days only). **Persists across
  editor opens** within the session (unlike the master toggle).
- **"Stop cascade after [date]"** (shown when master ON) — already drives the
  cascade cutoff; now also bounds the conflict-displacement chain. Always available
  whenever the master toggle is ON.
- Jobs that are re-timed or moved show as **additional rows** in the same reschedule
  preview, with the existing impact tiles / conflict strip, and commit together on
  Apply.

## Part 4 — Data flow

- `handleShiftStartTime` and `handleChangeDailyHour` in `JobSchedulingView.tsx`:
  - **Master toggle OFF:** apply the typed hours literally (no `reflowAvoidingConflicts`,
    no follower movement) — the leftover stays unscheduled and surfaces as a warning.
  - **Master toggle ON:** route through `reflowAvoidingConflicts` and stage
    `[primary, ...displaced]`, merged with the day-shift cascade followers.
- New persisted-for-session state `keepExistingDaysAsIs`, passed down to
  `SingleJobEditor` as the secondary toggle and into `reflowAvoidingConflicts` as an
  option. The master toggle reuses the existing `cascade` state.

## Edge cases

- **No leftover** (pinned == total): primary reflects pinned windows; no placement,
  no displacement.
- **No free time anywhere in Smart mode:** behaves like Simple — appends new days.
- **Blocker is locked:** never moved; surfaced as a blocking conflict; leftover
  skips its occupied interval (and may need a further day).
- **Displaced job past the cutoff:** left in place, shown as a protected/warning row.
- **Weekend/holiday spill:** new days skip non-working days (uses existing
  `advanceWorkingDays`).
- **Pulling start earlier / surplus hours:** total is fixed; surplus over the
  estimate is allowed and flagged by the existing advisory, not auto-trimmed.

## Testing

- Clock-time primitive: occupied/free intervals for shared-crew jobs on a day;
  member-vs-group sharing; non-shared crew ignored.
- `reflowAvoidingConflicts`: the worked example (Jun 9 → 4 PM ⇒ 3 h to a new day);
  Smart fills a genuinely-free morning on an existing day; Simple always adds a new
  day; blocker re-timed same-day when it fits; blocker moved past project end when
  it doesn't; chained displacement; cutoff protects later jobs; locked blocker.
- Component: master OFF applies hours literally and moves nothing; master ON runs
  the reflow + cascade; "Keep existing days as-is" renders only when master is ON,
  persists across opens, and switches Smart↔Simple; displaced jobs appear as preview
  rows and commit on Apply.

## Affected files (anticipated)

- `services/scheduleEngine.ts` — clock-time conflict/free-interval primitive;
  `reflowAvoidingConflicts`; reuse of `advanceWorkingDays` / `after-limit` logic.
- `components/views/JobSchedulingView.tsx` — route `handleShiftStartTime` /
  `handleChangeDailyHour`; `keepExistingDaysAsIs` session state; stage displaced.
- `components/views/JobScheduling/reschedule/SingleJobEditor.tsx` — "Keep existing
  days as-is" secondary toggle (shown when the master toggle is ON).

## Resolved decisions

- **Reflow and cascade share one master toggle** ("Cascade following jobs"). There
  is no independent reflow path: with the master OFF, hours are literal and nothing
  moves. This removes the earlier open questions about cutoff visibility and
  cascade/reflow interaction — both only ever run together under the one toggle,
  bounded by "Stop cascade after."
