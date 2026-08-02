# tree-sidebar

## Clustering lifecycle lives here, not per plugin

A dialog flavor renders `ClusterDialog` with one props object; a
`runClustering: true` flag flavor uses `setupRunClusteringAutorun` (which owns
the re-entrancy guard, init gate, stop token, one-shot clear, and status
channel). Both plugins used to carry a copy, and the copies had drifted.

`run` should **throw** for preconditions and `applyOrder` should **throw** to
reject a paste, so both land in the dialog's error state rather than closing
over a silently dropped row. `validateClusterOrder` guards the R-paste path — an
unvalidated paste silently drops or doubles rows.

`src/hierarchy.ts` is a hand-written subset of d3-hierarchy, which is pure ESM
and breaks Jest. Don't reintroduce it as a dependency.

## The two `length` encodings

Newick's `length` is an absolute merge height in hclust's `(A,B)1.5` form and an
incremental branch length in phylo's `(A:0.1,B:0.2)` form, needing opposite
layouts. A post-paren numeric is a length only when the string has no `:` at all
— in a phylo tree that number is a bootstrap value, and reading it as a length
dwarfs the real branch lengths.

## `TreeDrawingModel` takes `effectiveRowHeight`, never a raw `rowHeight`

Variants and MAF keep `rowHeight` as the raw prop where `0` means fit-to-height,
and `0` is their default — reading it painted zero-height rects and the hover
highlight silently did nothing. Structural typing let that through, so keep the
contract field named for the resolved value.

## `SvgRowLabels`: a sub-pixel row still draws

Below `MIN_TEXT_ROW_HEIGHT` a row draws as a `labelColor` swatch rather than
stopping — a clustered track can sit far below a pixel a row and the tint is all
that carries row identity. The rect is floored to a pixel (a 0.32px rect
antialiases to nothing) and runs paint **longest-first**, so the rarest group
isn't overdrawn by its neighbours. Consecutive same-color rows merge into one
rect, keeping a 2000-row track from putting a DOM node per row into a
scroll-time overlay.

Consequence: **the stripe is a marker, not a proportional encoding.** Mark the
group a reader is hunting for, not the majority.

## SVG export: use `SvgTreeSidebar`, never `SvgRowLabels` alone

Labels are offset right by `treeAreaWidth`, so rendering them without the tree
leaves a blank gutter. `SvgTreeSidebar` owns the single gate driving both. A
sidebar that draws more than a label box passes its own renderer as the `labels`
prop rather than teaching `SvgRowLabels` a second drawing — that would change
the MAF, multirow-feature, and wiggle sidebars too.
