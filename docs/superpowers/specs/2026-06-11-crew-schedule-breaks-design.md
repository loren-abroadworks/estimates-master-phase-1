# Crew Schedule Breaks — Design Spec

**Date:** 2026-06-11
**Status:** Approved (v1 scope; iteration expected)
**Author:** miggle@abroadworks.com + Claude

---

## Problem

Different companies run crew breaks very differently:

- Some breaks are **paid**, some **unpaid**.
- Durations vary (15 min, 30 min, 1 hour, …).
- Some companies have a **fixed time** for breaks; others are **flexible** ("take 30 min sometime today").
- Some have **multiple** breaks a day; some have none.

The app currently has **no concept of breaks at all**. Crew capacity is a single per-day hours bucket and there is no intra-day break/lunch handling. We need a breaks feature flexible enough to accommodate any company's policy, where the user can **see** each crew member's breaks and **control** them.

This is **not** a labor-law compliance/enforcement feature. It is a scheduling + capacity + payroll-accuracy feature.

---

## Plain-English behavior (the agreed design)

1. **Set the company's normal break once.** In Settings, the user defines the usual break(s) — e.g. "30-minute lunch, unpaid, around noon." Multiple breaks are supported (e.g. two 15-min coffee breaks + a lunch). May be left empty (no standard break).

2. **The normal break auto-applies.** Every scheduled crew member's day automatically shows the company default break(s). No repetitive data entry.

3. **Per-person, per-day overrides.** The user can change a single member's break on a single day — extend it, shorten it, add one, or remove it — without affecting any other member or the company default.

4. **Changing the company default later** re-flows to every member-day that was *never* customized. Hand-adjusted days are preserved and never overwritten.

5. **Two visual modes on the Day Board:**
   - **Fixed-time break** (has a clock time, e.g. "lunch 12:00") → drawn as an **anchored block** at that time on the timeline.
   - **Flexible break** (no required time) → drawn as a **floating chip/tag** on that member's day (not anchored to a position).

6. **Numbers update automatically.** Adding/changing a break adjusts the derived figures (below). The user never calculates anything.

---

## Core principle: store facts, derive numbers, no hardcoded policy

We do **not** bake in a single paid/unpaid rule, because there is no one-size-fits-all rule. Instead each break stores only raw primitives, and all figures are *derived*:

Each break records:
- **duration**
- **paid or unpaid** (a flag)
- **time** — a fixed clock time, or "flexible" (no time)

Two numbers are always derivable from these, with no policy decision baked in:

- **Job-capacity** (hours available to work on jobs) = daily capacity − **all** break time.
  *(A break is time not spent on a job, regardless of pay.)*
- **Paid hours** (per member-day) = hours actually worked on jobs + **paid** break time.
  *(Unpaid breaks are not paid; paid breaks are.)*

The escape hatch that accommodates every company: **the user controls the work window / daily capacity.** A company wanting a full 8 job-hours *plus* lunch sets the window to 08:00–16:30; a company absorbing lunch sets 08:00–16:00 and accepts 7.5. The app never decides — it does the arithmetic and surfaces both numbers.

Example (8.5h on-site, 30-min lunch):
- Job-capacity = 8.0h (both cases)
- Paid hours = 8.5h if the lunch is **paid**, 8.0h if **unpaid**

---

## Decisions locked in

| Decision | Choice |
|---|---|
| Primary purpose | Capacity math + visual timeline blocks + payroll (paid/unpaid). User sees & controls breaks. NOT compliance enforcement. |
| Break scope | **Per crew member, per day** (staggered breaks, part-timers all supported). |
| Configuration model | **Company default + per-instance override.** |
| Flexible break display | **Floating chip**, not anchored to the timeline. |
| Fixed break display | **Anchored block** at its clock time on the timeline. |
| Paid/unpaid math | **No hardcoded rule.** Store primitives; derive both job-capacity and paid hours. Work window is the knob. |
| Defaults ↔ overrides | **Derived defaults** (default lives in Settings; member-day stores an override only when changed; editing the default re-flows to untouched days). |
| Multiple breaks/day | **Supported** (array of breaks per member-day and in the company default). |

---

## Data model (technical)

A single break primitive (a member-day can have several):

```typescript
export interface CrewBreak {
  id: string;
  label?: string;            // 'Lunch', 'Coffee' — optional
  durationMinutes: number;   // 15, 30, 60…
  paid: boolean;
  startTime?: string;        // 'HH:mm' present = fixed/anchored; omitted = flexible (floating chip)
}
```

**Company default** — extends `SchedulingSettings` (in `types.ts`, stored under `GlobalSettings.scheduling`):

```typescript
defaultBreaks?: CrewBreak[];   // applies to every scheduled member-day unless overridden
```

**Per-member-day override** — extends the existing `CrewScheduleEntry`
(`CrewMember.schedule` is already `Record<DateString, CrewScheduleEntry>`):

```typescript
breaksOverride?: CrewBreak[];
```

**One optional field encodes all three states — no separate "removed" flag:**

| `breaksOverride` value | Meaning |
|---|---|
| `undefined` (absent) | Use the company default |
| `[{…}, …]` (non-empty) | Use exactly these custom breaks |
| `[]` (empty array) | User cleared all breaks for this day → no break |

**Resolution** — a single pure function used everywhere breaks are read:

```
resolveBreaks(entry, settings) = entry?.breaksOverride ?? settings.defaultBreaks ?? []
```

This mirrors the existing `hoursAssignments`-with-fallback idiom (e.g. `memberJobDayHours()` falling back to `standardDay`), so it fits the codebase's established patterns.

---

## Integration points (where the code changes)

- **`types.ts`** — add `CrewBreak`; add `defaultBreaks?` to `SchedulingSettings`; add `breaksOverride?` to `CrewScheduleEntry`.
- **New service** (e.g. `services/crewBreaks.ts`) — `resolveBreaks()`, total-break-minutes helper, paid vs unpaid split, hours conversions. Pure + unit-tested.
- **`services/crewWeeklyHours.ts` / `services/crewHoursGrid.ts`** — subtract resolved break time from job-capacity; expose the derived paid-hours figure for display.
- **Settings UI (`components/settings/SchedulingConfigView.tsx`)** — edit company `defaultBreaks` (add/edit/remove, set duration, paid flag, fixed time or flexible).
- **Day Board (`components/views/JobScheduling/DayBoard.tsx`)** — render fixed breaks as anchored blocks; flexible breaks as floating chips per member-day.
- **Crew Hours Grid (`CrewHoursGrid.tsx` + per-day cell components)** — reflect reduced capacity; allow per-member-day break override (add/edit/remove/clear).

---

## Out of scope for v1 (iterate later)

The user explicitly noted "there are a lot more instances" to handle in future iterations. v1 establishes the foundation above. Likely later iterations (not committed here):

- Named/multiple break policies (the "Approach C" route) for multi-shift operations.
- Labor-law compliance warnings / mandatory-break enforcement.
- Payroll export/report formatting that consumes the paid-hours figure.
- Per-crew (team-wide) breaks applied to a whole crew at once.
- Per-job-allocation break attribution (billing breaks differently per job).
- True multi-tenant per-company configuration (the app is currently single global settings object).

---

## Testing approach

- **Unit tests** for the pure break service: `resolveBreaks()` across all three override states; total/paid/unpaid minute math; hours conversion edge cases (e.g. break longer than window, multiple breaks).
- **Capacity tests** in `crewWeeklyHours`/`crewHoursGrid` test suites: capacity correctly reduced by breaks; paid-hours figure correct for paid vs unpaid.
- **Component tests** for the grid override flow (add/edit/remove/clear) and Day Board rendering of fixed vs flexible breaks, following existing `*.test.tsx` patterns in `components/views/JobScheduling/`.
