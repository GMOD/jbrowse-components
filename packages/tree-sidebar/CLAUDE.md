# tree-sidebar

## Hand-written hierarchy layout (`src/hierarchy.ts`)

`src/hierarchy.ts` is a small hand-written subset of what d3-hierarchy used to
provide (`hierarchy`, `leaves`, `descendants`, `links`, `sum`, `sort`, and a
`clusterLayout`/`assign*Y` dendrogram layout). d3-hierarchy is pure ESM and
breaks Jest, so it isn't used as an npm dependency — don't reintroduce it.

## SVG export: render the sidebar via `SvgTreeSidebar`, never `SvgRowLabels` alone

A clusterable display's `renderSvg` must paint its left sidebar through
`SvgTreeSidebar` (tree + row labels together), not by dropping in `SvgRowLabels`
by itself. The two are coupled: the labels are offset right by `treeAreaWidth`
to clear the dendrogram, so rendering labels without also rendering
`SvgTreePath` leaves a blank reserved gutter where the on-screen tree is (the
bug that hit `LinearMultiRowFeatureDisplay`). `SvgTreeSidebar` owns the single
`showTree && hierarchy` gate that drives both the label offset and whether the
tree draws, so they can't disagree. Adopted by
`LinearMultiRowFeatureDisplay/renderSvg`, variants' `SvgVariantOverlay`, and
`LinearMafDisplay/renderSvg`. `MultiLinearWiggleDisplay` is the one exception:
its row labels live in `MultiWiggleSvgScales` (shared with the on-screen path,
alongside the scalebars + overlay color legend), so it can't wrap both in
`SvgTreeSidebar` — it keeps the split but derives the label offset and the tree
from a single `treeShowing` local for the same guarantee.
