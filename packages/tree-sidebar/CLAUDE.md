# tree-sidebar

## Hand-written hierarchy layout (`src/hierarchy.ts`)

`src/hierarchy.ts` is a small hand-written subset of what d3-hierarchy used to
provide (`hierarchy`, `leaves`, `descendants`, `links`, and a
`clusterLayout`/`assign*Y` dendrogram layout). d3-hierarchy is pure ESM and
breaks Jest, so it isn't used as an npm dependency — don't reintroduce it. Keep
it to what the sidebar actually draws: `sum`/`sort` (and the `value` field they
filled) were carried for years without a single reader.

## The two `length` encodings

Newick's `length` means an absolute merge height in hclust's `(A,B)1.5` form and
an incremental branch length in phylo's `(A:0.1,B:0.2)` form, and the two need
opposite layouts (`assignMergeHeightY` vs `assignCumulativeLengthY`). Anything
that writes `length` must know which form it holds:

- `parseNewick` treats a post-paren numeric as a length only when the string
  contains no `:` at all (hclust's `toNewick` never emits one). In a phylo tree
  that number is a bootstrap value, and reading it as a length dwarfs the real
  branch lengths.
- `pruneNewickToLeaves` only sums lengths when collapsing a unary node in the
  incremental form. Summing merge heights invents a depth, and giving a bare
  hclust leaf a `length` flips the whole tree onto the cumulative layout.

## `TreeDrawingModel` takes `effectiveRowHeight`, never a raw `rowHeight`

The subtree-hover highlight sizes its row rects off `effectiveRowHeight`, which
must be a resolved px value. Variants and MAF keep `rowHeight` as the raw
property where `0` means fit-to-height — and `0` is their default, so reading it
painted zero-height rects and the hover highlight silently did nothing on a
fresh track. Canvas and wiggle resolve the sentinel inside their own `rowHeight`
getter and alias `effectiveRowHeight` to it purely to satisfy this contract.
Structural typing is what let the raw property through unnoticed, so keep the
contract field named for the resolved value.

## SVG export: render the sidebar via `SvgTreeSidebar`, never `SvgRowLabels` alone

A clusterable display's `renderSvg` must paint its left sidebar through
`SvgTreeSidebar` (tree + row labels together), not by dropping in `SvgRowLabels`
by itself. The two are coupled: the labels are offset right by `treeAreaWidth`
to clear the dendrogram, so rendering labels without also rendering
`SvgTreePath` leaves a blank reserved gutter where the on-screen tree is (the
bug that hit `LinearMultiRowFeatureDisplay`). `SvgTreeSidebar` owns the single
`showTree && hierarchy` gate that drives both the label offset and whether the
tree draws, so they can't disagree.

A display whose sidebar draws more than a label box passes its own renderer as
the `labels` prop instead of falling back to `SvgRowLabels` — it lands at the
same tree-aware offset, so the gate still can't be bypassed. Variants does this
with `MultiSampleVariantRowColors`, the component its on-screen overlay renders:
`SvgRowLabels` knows only `labelColor`, so a "Color by → population" track
exported without the `color` swatch column its rows are read through. Reach for
`labels` rather than teaching `SvgRowLabels` a second drawing — a swatch column
there would change the MAF, multirow-feature, and wiggle sidebars too, since
their sources also carry `color`.

Adopted by `LinearMultiRowFeatureDisplay/renderSvg`, variants'
`SvgVariantOverlay`, and `LinearMafDisplay/renderSvg`.
`MultiLinearWiggleDisplay` is the one exception: its row labels live in
`MultiWiggleSvgScales` (shared with the on-screen path, alongside the
scalebars + overlay color legend), so it can't wrap both in `SvgTreeSidebar` —
it keeps the split but derives the label offset and the tree from a single
`treeShowing` local for the same guarantee.
