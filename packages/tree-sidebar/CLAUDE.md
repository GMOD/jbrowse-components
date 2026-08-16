# tree-sidebar

Both enforcement halves and the full workflow:
[reference/CLUSTERING_WORKFLOW.md](../../agent-docs/reference/CLUSTERING_WORKFLOW.md).

## Clustering lifecycle lives here, not per plugin

A dialog flavor renders `ClusterDialog`; a `runClustering: true` flag flavor
uses `setupRunClusteringAutorun` (re-entrancy guard, init gate, stop token,
one-shot clear, status channel). Both plugins used to carry drifting copies.

`run` and `applyOrder` should **throw** rather than drop a row silently, so both
land in the dialog's error state. `validateClusterOrder` guards the R-paste
path.

`src/hierarchy.ts` is a hand-written subset of d3-hierarchy, which as a
dependency is pure ESM and breaks Jest.

## `ClusterMatrix` is a `Map` because its key order _is_ the result

A plain object hoists integer-like keys, so rows built as `10, 2, 1` reach
hclust as `1, 2, 10` and the returned indices name the wrong sources — reachable
from numbered bigWig filenames or numeric sample IDs. Build in row order and
keep it a `Map` the whole way, through the RPC return type —
`generateClusterRScript` writes the same order into `rownames` and the user
pastes `resultClusters$order` back against it. `Object.keys`/`values`/`entries`
on a `Map` compiles and silently returns nothing, so that is what to grep for if
rows come back scrambled.

## "Does the tree describe these rows" is derived, not remembered

`clusterLayout` positions leaves **positionally** — leaf _i_ on row _i_ — so a
tree that no longer names the rows on screen draws against the wrong ones,
silently. When writing a display:

- **Every action that moves rows routes through `setLayout`**, never
  `self.layout =`.
- **Pass `sources` to `computeClusterHierarchy`** — after every reorder, filter
  and decoration, never the pre-layout list.

`StaleTreeHint` (rendered by `TreeSidebar`, so no display wires it up)
distinguishes stale from "no tree" and from "deliberately not positioned"
(multi-wiggle overlay) by testing `root` against the rows.

## `clusterProvenance` is written in the same action as the tree, always

`treeDescribesRows` gates on row **names**, which don't change when you pan, so
the tree stays drawn over a different locus looking just as authoritative.
`ClusterProvenanceHint` draws **only on drift off the clustered span**, measured
as an overlap fraction — `contentBlocks` shift a sub-bp amount on any pan, so
equality would flag constantly.

The invariant is not that provenance is present but that it is never **wrong**,
so `clusterTree` has exactly one writer: the mixin's private
`writeTree(tree, provenance)`. The four public actions differ only in what they
pass — `setLayout`/`clearLayout` pass nothing, and `setClusterTree` (maf's
supplied `.nh`) passes nothing because a phylogeny has no locus — so a tree with
no provenance is also the signal it was supplied rather than computed.
`SvgTreeSidebar` captions the export and `clusterProvenanceMenuItems` puts the
locus in the menu.

## "Sort rows by … here" is three shared pieces and one per-display read

Only _which value a row carries at the column_ is the display's (multi-wiggle
the score, multi-row the painted color). `rowSortColumn.ts` owns the rest:

- **`regionCoversColumn` is asked by the gate and by the sort.**
  `setupRowSortAutorun` waits for a region satisfying it and then clears
  `sortRowsBy`, so a sort answering the question differently gets dispatched
  into, declines, and has its trigger cleared anyway.
- **No covering region means leave the rows alone.** Every row reads "no value",
  which ranks them equally and writes back the order they already had — a sort
  that silently did nothing, and a `layout` write that can still clear the tree.
  Filtering the regions on refName alone is the near-miss (multi-row shipped
  it): coordinates repeat across regions by refName, so two loaded windows on
  one contig both answer and the map's iteration order picks.
- **`orderRowsByValueAt` owns missing-last and stability**, and hands `compare`
  only values that exist. A neutral fill-in instead (`0`) ranks a valueless row
  above every negative score and into the middle of every color block.

## `subtreeFilter` goes with the row _names_, not with the tree

Matched without a tree, so a reorder or re-cluster leaves it valid and
`setLayout` keeps it. `clearLayout` clears it; "Clear subtree filter" is gated
on the filter alone.

## Newick

- **Two `length` encodings**: an absolute merge height in hclust's `(A,B)1.5`,
  an incremental branch length in phylo's `(A:0.1,B:0.2)`, needing opposite
  layouts. A post-paren numeric is a length only when the string carries no `:`
  **delimiter** — asked of the tokens, not the raw string, since a quoted label
  may hold a colon.
- **Escaping row names is hclust's job** (`toNewick` quotes from 4.0.3) —
  **don't escape here as well**. `clusterMatrix.test.ts` asserts the
  dependency's half. Bare, a parenthesis makes a leaf parse as an internal node
  and a comma splits one leaf into two.
- `parseNewick` is the reading half and must agree exactly. It stays ours
  regardless (maf's `.nh` guide trees are hand-written and may quote), and a
  quoted post-paren token is a name whatever it looks like.
- **`generateClusterRScript` escapes on its own side** (`quoteRName`) —
  `o'brien` made the whole `rownames(...)` line a syntax error. Exactly one side
  of each grammar owns it.
- Whitespace is deliberately outside the quoted set on both sides (variants'
  `NA18536 HP0` rows).

## `RowSource` is the row vocabulary, and the mixin's bound

`TreeSidebarMixin<S extends RowSource>`. Every field this package draws with is
on `RowSource`, and `TreeSource` / `RowLabelSource` are picks of it rather than
separate declarations — the bound used to be `{ name: string }`, the weakest
possible, and the four displays composing the mixin each wrote their own row
type against it.

**The tint is `labelColor`, always.** `SvgRowLabels` drops to a `labelColor`
swatch below `MIN_TEXT_ROW_HEIGHT`, and because `RowLabelSource` is satisfied
structurally, a row type carrying the color under any other name type-checks and
paints nothing. MAF called it `color` and bridged with a `labelSources`
computed; that is why three adapter schemas advertised a slot reaching no
renderer at all.

`treeSidebarConfigSchemaFields` is the matching slot set (`showTree` /
`showBranchLength` / `showRowLabels`), taking only the per-display descriptions,
so a display cannot ship two of the three. `showRowLabelsMenuItem` is the row;
`requiresTree` is its one real per-display difference (MAF mounts its label
overlay only under `showTree`).

## Two row-height arguments, and neither is the display height

`TreeDrawingModel` takes **`effectiveRowHeight`**, never a raw `rowHeight` —
variants and MAF keep `rowHeight` raw, where `0` means fit-to-height, so reading
it painted zero-height rects. Structural typing let that through, so keep the
contract field named for the resolved value.

`computeClusterHierarchy` takes `rowsContentHeight` =
`rows.length × effectiveRowHeight`, **never the viewport they scroll inside**.
Pass the viewport and the dendrogram still draws, still looks plausible, and
names the wrong rows. "Simplify this to the display height" is the edit the
parameter is named to refuse.

## Drawing rows

- **A sub-pixel row still draws.** Below `MIN_TEXT_ROW_HEIGHT` `SvgRowLabels`
  draws a `labelColor` swatch, floored to a pixel, **longest-first** so the
  rarest group isn't overdrawn. So **the stripe is a marker, not a proportional
  encoding.**
- **Anything marking rows draws runs, never a rect per row (`rowRuns`).**
  `effectiveRowHeight` is fractional and deliberately never floored, so a rect
  per row blends twice at every boundary under a translucent fill. The part
  worth sharing is the gap: a row whose key is `undefined` **breaks** the run
  rather than being bridged.

## On screen: `TreeSidebar` + `RowLabelsOverlay`, both portalled

Render both — a display that hand-rolls the labels half re-states overlay
geometry that has to be right for it to work at all.

**Both paint through `TrackOverlayPortal`, above the LGV's masks**: a display
renders inside `TrackRenderingContainer`'s `contain: strict` sandbox and
`PaddingBlocks` is a later sibling painting over all of it, so nothing inside
can `z-index` out. `TreeSidebar` therefore splits paint from hit-test — panel,
tree canvas, hover canvas and hints go through the portal; the transparent
picking box and resize handle stay inline because they draw nothing and maf
binds its wheel listener to that DOM element. The two layers share an origin.

The portal lands on the **display's own box**; a display drawing its sidebar
elsewhere passes that down as `top`. **maf's `top` is not the model's
`rowsTopOffset`** — its sidebar already sits inside a container translated by
it.

## Install the autoruns statically; don't `import()` this barrel

`setupTreeDrawingAutorun`, `setupRowSortAutorun` and `setupRunClusteringAutorun`
are plain calls from `afterAttach`; the heavy work is code-split _inside_ them.

**Dynamically importing a barrel you also statically import is a net loss** —
the static named imports tree-shake to leaf modules, while the namespace request
pulls the rest of the barrel into an async chunk. Measured 608KB vs 539KB for
~4KB actually deferrable. Split inside a function, or from a module nobody
imports eagerly.

## SVG export: `SvgTreeSidebar`, never `SvgRowLabels` alone

Labels are offset right by `treeAreaWidth`, so rendering them without the tree
leaves a blank gutter; `SvgTreeSidebar` owns the single gate driving both.

**That gate is `treeIsShowing`, not `showTree && hierarchy`.** The gutter is
reserved for the **positioned** tree, never `clusterTree` — a stale tree is
deliberately not positioned, and reserving off the newick string puts the labels
right of an empty gutter. Three places decide it: `TreeSidebar`'s early return,
`SvgTreeSidebar`, and `treeSidebarOffset`.
