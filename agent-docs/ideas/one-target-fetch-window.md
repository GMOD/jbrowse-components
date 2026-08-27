---
name: one-target-fetch-window
description: LinearSyntenyDisplay computes the target axis's snapped fetch window twice, in targetFetchRegions and again inside fetchRegionsKey. They cannot disagree today, so the trap is the obvious cleanup — pointing the key at targetFetchRegions, which answers [] unless the bidirectional fetch is on while the worker culls on both axes — and nothing in the tree tests that a target-axis pan moves the key.
---

# One target fetch window, and the test that keeps the dedupe dead

`LinearSyntenyDisplay` computes the target axis's snapped window twice, in
`targetFetchRegions` and again inside `fetchRegionsKey`
(`plugins/linear-comparative-view/src/LinearSyntenyDisplay/model.ts`). The two
cannot disagree today — one pure function, the same observables, one reactive
pass — so this is a trap rather than a live bug, and the trap is the obvious
cleanup: `targetFetchRegions` answers `[]` unless the view asked for the
bidirectional fetch, which is off by default, while the worker culls geometry on
**both** axes (`executeSyntenyFeaturesAndPositions.ts`). Point the key at
`targetFetchRegions` and a target-axis pan stops invalidating, so ribbons
anchored off the top view but visible on the bottom vanish while `dataCurrent`
still reads true.

One shared getter for the window, consumed by both, is the fix. **The getter is
not what makes it stay fixed** — nothing in the tree tests that a target-axis
pan with the bidirectional fetch off moves `fetchRegionsKey`, so write that test
in the same change.
