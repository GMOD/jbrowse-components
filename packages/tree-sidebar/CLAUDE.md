# tree-sidebar

## Two ways to start a cluster run — both already have a home here

A clusterable display triggers clustering one of two ways, and neither should
grow a per-plugin copy of the lifecycle (each had two before they were folded in
here):

- **A dialog** ("Cluster rows by ..."): render `ClusterDialog` and pass one
  `ClusterDialogProps`. The whole dialog is here — the auto/manual mode switch,
  the run/progress/stop lifecycle (`useClusterRun` + `ClusterProgress`), the R
  script and TSV downloads, the linkage picker, the paste box, the advanced
  section. A display contributes only what its matrix is (`fetchMatrix`,
  `matrixKey`, `matrixLabel`, `tsvFilename`), how to run it in-app (`run`,
  `canRun`), and how an order applies (`applyOrder`) — plus optional
  `advancedOptions` nodes. Both plugins used to carry a three-file copy of the
  whole thing, and the copies had drifted: only one tracked the view in its
  matrix fetch key, and only one offered the average linkage that `run` actually
  produces.

  Two contracts hold the seams: `run` should **throw** for preconditions
  (uninitialized view, too few rows) so they land in the same error state as an
  RPC failure, and `applyOrder` should **throw** to reject a paste — the dialog
  stays open and reports the message rather than closing over a silently dropped
  row.

- **A `runClustering: true` flag** (track menu or a saved session/config) uses
  `setupRunClusteringAutorun`, which owns the re-entrancy guard, the
  `view.initialized` gate, the stop token, the one-shot flag clear, **and** the
  status channel — it writes `setStatusMessage`, which `DisplayChrome` surfaces
  as a corner `ProgressChip` (that path has no dialog to report into). A flavor
  supplies only `ready` and `run`; don't pass a `() => {}` status sink.

Row filtering shares one helper too: `filterRowsBySubtree(rows, subtreeFilter)`,
keyed on `name` (haplotype rows are `"HG001 HP0"`, and that is what
`subtreeFilter` holds), used by variants, MAF, multi-row features, and wiggle.

`validateClusterOrder` guards the R-paste path in both plugins — wiggle's
`applyOrder` calls it directly, variants' inside `applyClusterOrder` (only that
function knows the _expanded_ haplotype row count an order must cover). An
unvalidated paste silently drops or doubles rows.

`clusterMatrix` is the shared tail of all three clustering RPCs: matrix in,
`{order, tree}` out, hclust progress mapped onto the status channel. It is the
only place `@gmod/hclust` is imported, so the plugins don't depend on it.

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
with `SvgSampleRowLabelGutter`, the component its on-screen overlay renders:
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
