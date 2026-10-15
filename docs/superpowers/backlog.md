# Deferred Fixes Backlog

Items deferred until **after Phase 3** of the Production Board work (per user direction 2026-06-02).

## Resolved (2026-06-02, post-Phase-3)

- ✅ **Board crew-linkage mismatch.** Seeded `MOCK_CREWS` in `data/mockData.ts` + initialized `crews` from it in `App.tsx`; `laneIdForJob` now resolves `crewGroupId` → `crewGroupIds[0]` → member-match → `unassigned`. Jobs now appear in their crew swimlanes.
- ✅ **double-book + capacity co-fire under default capacity.** `services/rescheduleIssues.ts` now only raises a `capacity` issue when the same job/day is NOT already flagged as a `double-book` (test asserts the suppression).
- ✅ **`reviewing` panel state persists across previews.** `ReschedulePreviewPanel.tsx` resets `reviewing` via a `useEffect` when `staged` clears.
- ✅ **"Review Manually" button always visible.** Now gated behind `issues.length > 0` (`canReview`); the manual-review expansion is gated the same way.
- ✅ **Rain-day undo-toast label stale after Auto-Fix.** `JobSchedulingView.tsx` `handleMarkRainDay` recomputes the committed label from the effective changes (`N jobs rescheduled`) instead of the staged-time label.

## User's list (to be filled in)

_Paste the running list of changes here._
