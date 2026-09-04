---
name: the-breakpoint-split-view-connector-snapshots-are-997-commits-stale
description: products/jbrowse-web's BreakpointSplitView.test.tsx has been red since its snapshots were last written on 2026-08-27, 997 commits back. Nothing in plugins/linear-comparative-view/src/BreakpointSplitView changed in that window, so the drift is in where the two feet are placed, not in the connector. The new geometry spans the two views where the old put both feet on one row, which reads like a stale snapshot rather than a regression — but it wants someone to look at the view before running jest -u.
---

# The breakpoint split view's connector snapshots are 997 commits stale

`products/jbrowse-web/src/tests/BreakpointSplitView.test.tsx` fails on both of
its `toMatchSnapshot` calls. The snapshots were last written by `7485636893`
(2026-08-27); 997 commits have landed since, and the suite lives in
`products/jbrowse-web`, which `pnpm test-related` leaves out unless the change
is in it — so nobody's local run has seen it.

## What moved

Not the connector. `git log 7485636893..HEAD -- plugins/linear-comparative-view/src/BreakpointSplitView`
is **empty**, so the renderer that emits these paths is byte-identical to the
one the snapshots were taken from. What changed is where the two feet land:

```
r1  old  M 408.99 72.5  C 411.91 69.57, 400.49 77.57, 403.41 80.5
    new  M 408.99 92.5  C 527.20 92.50, 285.20 486.5, 403.41 486.5

r2  old  M 388.99 18.5 L 408.99 18.5 Q 406.20 -11.5 403.41 18.5 L 423.41 18.5
    new  M 388.99 296.5 L 408.99 296.5 L 403.41 682.5 L 423.41 682.5
```

The `Q` becoming an `L` is downstream of that, not independent: the bezier span
budget (`ac9dba543b`) picks the curve by how far the feet are apart.

## Why it probably wants `-u` and not a bisect

A breakpoint connector joins a feature in the TOP view to its mate in the
BOTTOM one, so the feet belong hundreds of px apart — which is what the new
geometry says and the old one does not. Both old feet sitting within 6px of
`y=18.5` is the shape you get when the snapshot is captured before the displays
have grown to hold their reads.

So the likely answer is that the test now settles later (or the displays are
taller) and the recorded paths are from an under-settled frame. **That is a
guess from the numbers, not a verification** — a snapshot updated without
someone looking at the rendered split view is how a real placement regression
gets recorded as the expectation. Open the view, confirm both connectors land
on their breakends, then update.
