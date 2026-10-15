# Break time clarity — explicit "At a set time / Anytime" choice

**Date:** 2026-06-15
**Status:** Approved for planning

## Problem

In the break editors, break timing is set with a bare native time input. A blank
time silently means "flexible / anytime," but an empty native time field looks
the same as a filled one — so users can't tell at a glance whether a break has a
fixed time, and the "leave it empty for flexible" convention is non-obvious.

Two adjacent concerns the user raised turned out to need **no changes**:

- *"I have to add the break to each crew member one by one."* — The company
  default break in Settings already applies automatically to every scheduled
  crew day; per-member editing is only for exceptions. This was a discoverability
  gap on the user's side, not a missing feature.
- *"Is it flexible enough for different companies?"* — The data model already
  supports fixed-time breaks, flexible/anytime breaks, no breaks at all, and
  multiple breaks per day. No change required.

So the entire scope of this work is making the **time field's fixed-vs-flexible
state explicit and unambiguous.**

## Goal

Replace the bare time input in both break editors with an explicit two-option
choice: **At a set time** vs **Anytime**. The empty/flexible state becomes a
clearly-selected button rather than a blank-looking field.

## Non-goals

- No changes to the `CrewBreak` data model.
- No changes to break resolution, hours/capacity math, or chip display.
- No bulk "apply to all crew" feature (the company default already covers this).

## Design

### 1. New component: `BreakTimeField`

**Location:** `components/views/JobScheduling/BreakTimeField.tsx` (alongside
`BreakChip` and `BreakEditorModal`).

**Props:**

```ts
interface BreakTimeFieldProps {
  value: string | undefined;            // 'HH:mm' = fixed; undefined/'' = flexible
  onChange: (val: string | undefined) => void;
  step?: number;                        // passed through to TimeInput; default 300
}
```

**Render:** a label ("Time") above a two-option segmented control styled to
match the existing weekday toggle buttons in `SchedulingConfigView.tsx`
(`py-3 rounded-xl text-sm font-bold border`, primary tint when selected, gray
when not):

```
Time
┌─────────────────┬─────────────┐
│  At a set time  │   Anytime   │
└─────────────────┴─────────────┘
   (TimeInput appears below only when "At a set time" is selected)
```

**Behavior:**

- Selected state is derived from `value`, not held in local state: a non-empty
  string → **At a set time**; empty/undefined → **Anytime**.
- Click **Anytime** → `onChange(undefined)`; the `TimeInput` is hidden.
- Click **At a set time** → if `value` is currently empty/undefined, emit a
  sensible default of `'12:00'`; the `TimeInput` is shown.
- When **At a set time** is active, render the existing `TimeInput` (from
  `components/UI.tsx`) wired to `value` and `step`. Its `onChange` value passes
  straight through to the parent's `onChange`. Empty-string normalization to
  `undefined` lives inside `BreakTimeField` so callers never see `''`.

### 2. Integration

Replace the bare `TimeInput` usages with `BreakTimeField`:

- `components/views/JobScheduling/BreakEditorModal.tsx:56`
  ```tsx
  <BreakTimeField value={b.startTime} onChange={(v) => patch(b.id, { startTime: v })} />
  ```
- `components/settings/SchedulingConfigView.tsx:132`
  ```tsx
  <BreakTimeField value={b.startTime} onChange={(v) => updateBreak(b.id, { startTime: v })} />
  ```

The previous inline `v || undefined` normalization moves into `BreakTimeField`,
so callers store whatever it hands back directly.

### 3. Copy / i18n

- Add two translation keys for the segmented-control labels ("At a set time",
  "Anytime") in the namespaces used by both editors
  (`views.JobScheduling.*` and `settings.SchedulingConfigView.*`, or a shared key
  if the project conventions allow it).
- The "Leave Time empty for a flexible break…" hint at
  `SchedulingConfigView.tsx:144` becomes redundant. Simplify it to a short note
  (e.g. "Set a time, or choose Anytime for a flexible break.") or remove it.
- No change to `BreakChip` — it already renders "Flexible" for timeless breaks.

### 4. Data model

`CrewBreak.startTime` stays `string | undefined`. New breaks continue to default
to flexible (no `startTime`), as `add`/`addBreak` already do today.

## Testing

Unit test for `BreakTimeField`:

- Renders with **Anytime** selected when `value` is `undefined`.
- Renders with **At a set time** selected and the `TimeInput` visible when
  `value` is a time string.
- Clicking **At a set time** while empty emits `onChange('12:00')`.
- Clicking **Anytime** emits `onChange(undefined)`.

## Affected files

- `components/views/JobScheduling/BreakTimeField.tsx` (new)
- `components/views/JobScheduling/BreakTimeField.test.tsx` (new)
- `components/views/JobScheduling/BreakEditorModal.tsx` (edit)
- `components/settings/SchedulingConfigView.tsx` (edit)
- i18n translation files (new keys; simplify/remove the flexible-break hint)
