# Crew Transfer Picker — Design

**Date:** 2026-07-10
**Component:** `components/modals/CrewSelectionModal.tsx`

## Problem

Adding crew members today happens through a small absolute-positioned dropdown that
opens below the search bar (full scheduling mode) or an inline checklist roster
(simplified mode). Both mix "who is available" and "who is added" into one flat list
distinguished only by a checkbox. It is hard to see at a glance who is on the crew.

## Goal

When the user clicks the search bar, present a **full-modal, two-panel transfer
picker**: staff not yet added on the **left**, added crew on the **right**. Applies to
**both** modal modes (full scheduling and simplified).

## Solution

### New subcomponent: `CrewTransferPicker`

A reusable, presentational component (in `CrewSelectionModal.tsx` or a sibling file)
that renders the picker UI and delegates all state changes to callbacks. It owns no
persistent state beyond the local search term.

**Props:**
- `allStaff: CrewMember[]` — full roster to choose from.
- `selectedIds: string[]` — currently added member ids.
- `leaderId: string | null` — current leader.
- `onAdd(id: string)` / `onRemove(id: string)` — move a member between panels.
- `onSetLeader(id: string)` — mark a member as leader.
- `onDone()` — close the picker and return to the normal view.
- Capacity inputs: `weekDays: Date[]`, `existingJobs: Job[]`, `excludeJobId?`,
  `weekendDays: number[]`, `standardDay: number` — passed through to
  `computeWeeklyHours` for the capacity badge (same call the simplified roster uses today).

**Layout:**
- **Search bar** across the top; filters the **left** panel only. Cleared each time the
  picker closes.
- **Left panel "Available":** staff whose id is not in `selectedIds`, filtered by search.
  Row = avatar, name, role, capacity badge (`assigned/capacity` + hours-left, red when
  fully booked), and a `+ Add` button calling `onAdd`.
- **Right panel "Added":** staff whose id is in `selectedIds`. Row = avatar, name, role,
  capacity badge, a **crown toggle** (calls `onSetLeader`; active when `id === leaderId`),
  and a `× Remove` button calling `onRemove`. Empty state: "No crew added yet."
- **Footer:** crew-size count + a **Done** button calling `onDone`.

### Integration in `CrewSelectionModal`

- Replace the `isDropdownOpen` state with `showPicker`.
- Clicking the search bar (existing `SearchInput` at lines ~502–511) sets
  `showPicker = true`.
- When `showPicker` is true, the modal body renders `CrewTransferPicker` in place of the
  normal body (stats header + settings + search + scheduling grid). `onDone` sets
  `showPicker = false`.
- The picker wires `onAdd`→`addMember`, `onRemove`→`removeMember`,
  `onSetLeader`→`setLeaderId`. These already exist and are unchanged.
- **Remove** the old absolute dropdown (lines ~512–531) and the simplified inline roster
  block (lines ~534–568). The shared picker replaces both.
- `handleSave` and the persisted `JobCrewAllocation` shape are **unchanged** — the picker
  only edits `selectedIds` / `leaderId`, which already feed `handleSave`.

### Mode behavior

- **Full scheduling mode:** search click → picker takeover → Done → back to the scheduling
  grid, stats, and settings, reflecting the updated crew.
- **Simplified mode:** search click → same picker → Done → back to the crew roster + the
  per-day hours grid (shown when the job is scheduled). The current always-inline roster is
  gone; crew selection now lives in the picker.

## Out of scope

- Drag-and-drop between panels (buttons only).
- Any change to per-day hours assignment, dates, or the scheduling grid itself.
- Any change to data models or `onSave` payloads.

## Testing

- Existing `CrewSelectionModal` behavior (add/remove/leader/save) continues to pass.
- New: clicking the search opens the picker; `+ Add` moves a member left→right and
  `× Remove` moves right→left; the crown sets the leader; Done returns to the prior view
  with the selection intact.
