# tree-sidebar

Enforcement halves and the full workflow:
[reference/CLUSTERING_WORKFLOW.md](../../agent-docs/reference/CLUSTERING_WORKFLOW.md).

## Clustering lifecycle lives here, not per plugin

A dialog flavor renders `ClusterDialog` with one props object; a
`runClustering: true` flag flavor uses `setupRunClusteringAutorun` (which owns
the re-entrancy guard, init gate, stop token, one-shot clear and status
channel). Both plugins used to carry drifting copies.

`run` should **throw** for preconditions and `applyOrder` should **throw** to
reject a paste, so both land in the dialog's error state rather than silently
dropping a row. `validateClusterOrder` guards the R-paste path.

`src/hierarchy.ts` is a hand-written subset of d3-hierarchy, which as a
dependency is pure ESM and breaks Jest.

## `ClusterMatrix` is a `Map` because its key order _is_ the result

`order` comes back as indices into the matrix's keys. A plain object hoists
integer-like keys, so rows built as `10, 2, 1` reach hclust as `1, 2, 10` and
the returned indices name the wrong sources — reachable from numbered bigWig
filenames or numeric sample IDs.

Build the matrix in row order and keep it a `Map` the whole way, through the RPC
return type too. `Object.keys`/`values`/`entries` on a `Map` compiles and
silently returns nothing — grep for that if rows come back scrambled.

## "Does the tree describe these rows" is derived, not remembered

`clusterLayout` positions leaves **positionally** — leaf _i_ on row _i_ — so a
tree that no longer names the rows on screen draws against the wrong ones,
silently. When writing a display:

- **Every action that moves rows routes through `setLayout`**, never
  `self.layout =`.
- **Pass `sources` to `computeClusterHierarchy`** — after every reorder, filter
  and decoration, never the pre-layout list.

`StaleTreeHint` (rendered by `TreeSidebar`, so no display wires it up) says so
on screen, distinguishing stale from "no tree" and from "deliberately not
positioned" (multi-wiggle overlay) by testing `root` against the rows.

## `clusterProvenance` is written in the same action as the tree, always

`treeDescribesRows` gates on row **names**, which don't change when you pan, so
the tree stays drawn over a different locus looking just as authoritative.
`clusterProvenance` records the regions and settings a run used;
`ClusterProvenanceHint` draws **only when the view has drifted off the clustered
span**, by overlap fraction rather than equality (`contentBlocks` shift a sub-bp
amount on any pan).

The invariant is not that it is present but that it is never **wrong**, so
`clusterTree` has exactly one writer — the mixin's private
`writeTree(tree, provenance)`. The four public actions differ only in what they
pass, and a tree with no provenance is the signal it was supplied rather than
computed.

## `subtreeFilter` goes with the row _names_, not with the tree

A set of names matched without a tree, so a reorder or re-cluster leaves it
valid and `setLayout` keeps it. `clearLayout` clears it; "Clear subtree filter"
is gated on the filter alone, never a tree.

## Newick

- **Two `length` encodings**: an absolute merge height in hclust's `(A,B)1.5`
  form, an incremental branch length in phylo's `(A:0.1,B:0.2)` form, needing
  opposite layouts. A post-paren numeric is a length only when the string
  carries no `:` **delimiter** — asked of the tokens, not the raw string, since
  a quoted label may hold a colon.
- **Escaping row names is hclust's job**; `@gmod/hclust`'s `toNewick` quotes
  from 4.0.3, so **don't escape here as well**. `clusterMatrix.test.ts` asserts
  the dependency's half. Bare, a parenthesis makes a leaf parse as an internal
  node and a comma splits one leaf into two.
- `parseNewick` is the reading half and must agree exactly. It stays ours
  regardless (maf's supplied `.nh` guide trees are hand-written and may quote),
  and quoting carries meaning the bare form can't — a quoted post-paren token is
  a name whatever it looks like.
- **`generateClusterRScript` escapes on its own side** (`quoteRName`), since
  nobody else quotes for R single-quoted literals and `o'brien` made the whole
  `rownames(...)` line a syntax error. Exactly one side of each grammar owns it.
- Whitespace is deliberately outside the quoted set on both sides — the
  tokenizer reads a bare space as part of the label (variants' `NA18536 HP0`
  rows).

## Two row-height arguments, and neither is the display height

`TreeDrawingModel` takes **`effectiveRowHeight`**, never a raw `rowHeight` —
variants and MAF keep `rowHeight` as a raw getter where `0` means fit-to-height,
so reading it painted zero-height rects. Structural typing let that through, so
keep the contract field named for the resolved value.

`computeClusterHierarchy` takes `rowsContentHeight` =
`rows.length × effectiveRowHeight`, **never the viewport they scroll inside**.
`clusterLayout` puts leaf _i_ at `(i + 0.5) × rowsContentHeight / n` while
everything beside the tree puts row _i_ at `i × effectiveRowHeight`; pass the
viewport and the dendrogram still draws, still looks plausible, and names the
wrong rows. "Simplify this to the display height" is the edit the parameter is
named to refuse.

## Drawing rows

- **`SvgRowLabels`: a sub-pixel row still draws.** Below `MIN_TEXT_ROW_HEIGHT` a
  row draws as a `labelColor` swatch, floored to a pixel, painted
  **longest-first** so the rarest group isn't overdrawn. Consequence: **the
  stripe is a marker, not a proportional encoding.**
- **Anything marking rows draws runs, never a rect per row (`rowRuns`).**
  `effectiveRowHeight` is fractional and deliberately never floored, so a rect
  per row blends twice at every boundary under a translucent fill — and 2000
  rows is 2000 fill calls per hover frame. The part worth sharing is the gap: a
  row whose key is `undefined` **breaks** the run rather than being bridged.

## On screen: `TreeSidebar` + `RowLabelsOverlay`

Render both. A display that hand-rolls the labels half re-states overlay
geometry that has to be right for it to work at all (`pointerEvents: 'none'`,
sized to the rows viewport, paired with the same `scrollTop` the rows use).

**Both halves paint through `TrackOverlayPortal`, above the LGV's masks** — a
display renders inside `TrackRenderingContainer`'s `contain: strict` sandbox and
`PaddingBlocks` is a later sibling painting over all of it, so nothing inside
can `z-index` out. `TreeSidebar` therefore has two layers, split
paint-vs-hit-test: panel, tree canvas, hover canvas and hints portal above the
masks; the transparent picking box and resize handle stay inline because they
draw nothing and maf binds its wheel listener to that DOM element. The two
layers share an origin.

The portal lands on the **display's own box**; a display drawing its sidebar
elsewhere passes that down as `top`. **maf's `top` is not the model's
`rowsTopOffset`** — its sidebar sits inside a rows container already translated
by that offset. Outside a `TrackContainer` the portal renders in place.

## Install the autoruns statically; don't `import()` this barrel

`setupTreeDrawingAutorun`, `setupRowSortAutorun` and `setupRunClusteringAutorun`
are installed with a plain call from `afterAttach`; the heavy work is code-split
_inside_ them.

**Dynamically importing a barrel you also statically import is a net loss** —
the static named imports tree-shake to leaf modules, while the namespace request
pulls the rest of the barrel into an async chunk the static-only graph drops
entirely. Measured with esbuild: **608KB vs 539KB**, for ~4KB actually
deferrable. Split inside a function, or from a module nobody imports eagerly.

## SVG export: `SvgTreeSidebar`, never `SvgRowLabels` alone

Labels are offset right by `treeAreaWidth`, so rendering them without the tree
leaves a blank gutter; `SvgTreeSidebar` owns the single gate driving both. A
sidebar drawing more than a label box passes its own renderer as the `labels`
prop.

**That gate is `treeIsShowing`, not `showTree && hierarchy`.** The gutter is
reserved for the **positioned** tree, never `clusterTree` — a stale tree is
deliberately not positioned, and reserving off the newick string puts the labels
right of an empty gutter. Three places decide it: `TreeSidebar`'s early return,
`SvgTreeSidebar`, and `treeSidebarOffset`.
