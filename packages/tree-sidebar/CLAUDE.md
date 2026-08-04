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

## `ClusterMatrix` is a `Map` because its key order _is_ the result

`order` comes back as indices into the matrix's keys, and every caller maps
those straight into its own source list (`buildClusteredLayout`,
`applyClusterOrder`). A plain object cannot carry that: it hoists integer-like
keys ahead of the rest, so rows a caller built as `10, 2, 1` reached hclust as
`1, 2, 10` and the indices it returned named the wrong sources. Reachable from
numbered bigWig filenames, numeric VCF sample IDs, or a numeric partition
field — and it fails twice over, because the tree's leaf names then disagree
with the reordered rows and `treeDescribesRows` declines to draw the dendrogram
that would have shown it.

So build the matrix in row order and keep it in a `Map` the whole way — through
the RPC return type too, since `generateClusterRScript` writes the same order
into the R script's `rownames` and the user pastes `resultClusters$order` back
against it. `Object.keys`/`values`/`entries` on a `Map` compiles and silently
returns nothing, so that is what to grep for if rows ever come back scrambled.

## "Does the tree describe these rows" is derived, not remembered

`clusterLayout` spaces the tree's own leaves evenly along the row axis — leaf
_i_ lands on row _i_, positionally, with nothing reconciling leaf name to row
name at draw time. So a tree that no longer names the rows on screen draws the
whole dendrogram against the wrong ones, silently.

`setLayout` → `willClearTree` catches the writes that go through it, and it
stays for the color dialog's pre-submit warning (which has to answer _before_
the write). It cannot catch the rest, because rows move without any layout
write:

- a display decorating `sources` downstream of `layout` (multi-row features'
  `rowGroups` partition regroups them; the tree then correctly stops drawing —
  clustering and `rowGroups` are two orders for one axis)
- a discovered row set growing as regions load (multi-row features,
  multi-wiggle) or unioning in a newly seen genome (maf)
- multi-sample variants' phased expansion switching on when ploidy arrives

So the backstop is `computeClusterHierarchy`, which every display already routes
through and which now takes the **drawn rows** and declines to position a tree
whose leaves aren't them. Pass `sources` — after every reorder, filter and
decoration — never the pre-layout list.

`StaleTreeHint` (rendered by `TreeSidebar`, so no display wires it up) says so
on screen, since the alternative is a dendrogram that vanishes with no
explanation. It distinguishes "stale" from "no tree" and from "deliberately not
positioned" (multi-wiggle overlay) by testing `root` against the rows itself —
`hierarchy` being undefined does not tell those apart.

## `clusterProvenance` is written in the same action as the tree, always

`treeDescribesRows` gates the dendrogram on row **names**, and names don't
change when you pan — so the tree stays drawn over a different locus, or a
different chromosome, looking exactly as authoritative as where it was computed.
`clusterProvenance` records the regions and the settings a run used;
`ClusterProvenanceHint` shows the locus on screen and `SvgTreeSidebar` captions
the export, which is the copy that ends up under a figure.

The invariant is not that it is present but that it is never **wrong**: it may
only describe the tree currently loaded. So every write touching `clusterTree`
sets or clears it in the same action — `setLayoutAndClusterTree` takes it,
`setLayout`/`clearLayout` drop it with the tree, and `setClusterTree` (maf's
supplied `.nh` phylogeny) clears it, since captioning a phylogeny with the
previous run's region is worse than no caption. A tree with no provenance is
therefore also the signal that it was supplied rather than computed.

Drift is an **overlap fraction, not an equality test**: `contentBlocks` shift a
sub-bp amount on any pan or zoom, so equality would flag a stale tree constantly
and train the reader to ignore it. `clusterProvenanceOverlap` asks how much of
the clustered span is still on screen.

## `subtreeFilter` goes with the row _names_, not with the tree

It is a set of names; `filterRowsBySubtree` matches on `name` with no tree
involved. So a reorder or a re-cluster leaves it valid and `setLayout`
deliberately keeps it — dropping a focused clade on every reorder discards the
user's focus, and for maf (where `subtreeFilter` is a fetch argument) refetches
every loaded region. `clearLayout` clears it because that is a full reset.

What does invalidate it is a change to what rows are _called_: the multi-sample
variant displays' rendering mode renames rows between sample and haplotype
(`HG001` ↔ `HG001 HP0`), and `setPhasedMode` clears it for exactly that reason.
Because it outlives the tree, "Clear subtree filter"
(`clearSubtreeFilterMenuItems`) is gated on the filter alone and never on a
tree.

## The two `length` encodings

Newick's `length` is an absolute merge height in hclust's `(A,B)1.5` form and an
incremental branch length in phylo's `(A:0.1,B:0.2)` form, needing opposite
layouts. A post-paren numeric is a length only when the string carries no `:`
**delimiter** — in a phylo tree that number is a bootstrap value, and reading it
as a length dwarfs the real branch lengths. Asked of the tokens and not of the
raw string, because a quoted label may hold a colon of its own.

## Escaping row names is hclust's job, and `parseNewick` is the other half

A row name is an arbitrary string from somebody's data file. Three of the
Roadmap 127-epigenome names carry parentheses
(`... peripheral blood (BLD.CD4.NPC)`), and written into a newick string bare
that is grammar rather than a label: the leaf parsed back as an internal node
wrapping a leaf named `BLD.CD4.NPC`, `treeDescribesRows` saw leaves that weren't
the rows, and the dendrogram silently vanished behind `StaleTreeHint`. A comma
is worse — it splits one leaf into two, so the tree is the wrong _shape_ and
`clusterLayout` labels every row below it with its neighbour's name.

`@gmod/hclust`'s `toNewick` quotes from 4.0.3 (we quoted in `clusterMatrix`
until it did). **Don't escape here as well** — quoting on both sides is worse
than on neither, since `''BLD.CD4.NPC''` matches no row either.
`clusterMatrix.test.ts` asserts the dependency's half rather than trusting it,
so an hclust that stopped quoting would fail there instead of losing the
dendrogram quietly.

`parseNewick` is the reading half and has to agree exactly. It stays ours
regardless: maf's supplied `.nh` guide trees are hand-written files that may
quote. Quoting also carries meaning the bare form can't — a **quoted**
post-paren token is a name whatever it looks like, the only way to call a node
`1.5`.

Whitespace is deliberately outside the quoted set on both sides. The tokenizer
reads a bare space as part of the label (variants' phased `NA18536 HP0` rows
depend on it), so quoting it would rewrite the serialized form of nearly every
clustered track to fix nothing.

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

## On screen: `TreeSidebar` + `RowLabelsOverlay` are the two halves

`TreeSidebar` paints the dendrogram onto its own canvas; `RowLabelsOverlay` is
the labels beside it. Render both — a display that hand-rolls the labels half
re-states the overlay geometry that has to be right for it to work at all
(`pointerEvents: 'none'` or it swallows the display's own hit test, `zIndex: 2`
so it sits above the rendering canvas and below the crosshair, sized to the
**rows viewport** and paired with the same `scrollTop` the rows use). Same
division as the SVG side below.

## SVG export: use `SvgTreeSidebar`, never `SvgRowLabels` alone

Labels are offset right by `treeAreaWidth`, so rendering them without the tree
leaves a blank gutter. `SvgTreeSidebar` owns the single gate driving both. A
sidebar that draws more than a label box passes its own renderer as the `labels`
prop rather than teaching `SvgRowLabels` a second drawing — that would change
the MAF, multirow-feature, and wiggle sidebars too.
