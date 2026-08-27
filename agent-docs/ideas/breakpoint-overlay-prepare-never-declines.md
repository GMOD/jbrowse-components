---
name: breakpoint-overlay-prepare-never-declines
description: BreakpointSplitView's overlay fetch returns empty lists rather than undefined when no track is matched, so every run spins the rotation, commits an empty record and consumes an outstanding retry in the ledger. The empty commit is load-bearing — it clears leftover features when a track crosses its byte limit — so decline only on the zero-matched case the view already answers as fetchInert.
---

# The breakpoint overlay's `prepare` never declines

`BreakpointSplitView`'s overlay fetch
(`plugins/breakpoint-split-view/src/BreakpointSplitView/model.ts`) returns empty
lists rather than `undefined` when no track is matched, so the run spins the
rotation, commits an empty record, and consumes an outstanding retry in the
ledger each time.

**The empty commit is load-bearing** and must survive: it clears leftover
features when a track crosses its byte limit. Decline only on the zero-matched
case, which the view already answers as `fetchInert` — so the dev-only retry
check stays quiet for free.
