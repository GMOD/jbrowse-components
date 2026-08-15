# tree-sidebar

## Clustering lifecycle lives here, not per plugin

A dialog flavor renders `ClusterDialog` with one props object; a
`runClustering: true` flag flavor uses `setupRunClusteringAutorun` (which owns
the re-entrancy guard, init gate, stop token, one-shot clear and status
channel). Both plugins used to carry drifting copies.

`run` should **throw** for preconditions and `applyOrder` should **throw** to
reject a paste, so both land in the dialog's error state rather than silently
dropping a row. `validateClusterOrder` guards the R-paste path.

`src/hierarchy.ts` is a hand-written subset of d3-hierarchy, which is pure ESM
and breaks Jest. Don't reintroduce it as a dependency.

## `ClusterMatrix` is a `Map` because its key order _is_ the result

`order` comes back as indices into the matrix's keys and every caller maps those
into its own source list. A plain object hoists integer-like keys, so rows built
as `10, 2, 1` reach hclust as `1, 2, 10` and the returned indices name the wrong
sources — reachable from numbered bigWig filenames or numeric sample IDs, and it
fails twice over, since the leaf names then disagree and `treeDescribesRows`
declines to draw the dendrogram that would have shown it.

Build the matrix in row order and keep it a `Map` the whole way, through the RPC
return type too — `generateClusterRScript` writes the same order into `rownames`
and the user pastes `resultClusters$order` back against it.
`Object.keys`/`values`/`entries` on a `Map` compiles and silently returns
nothing, so that is what to grep for if rows come back scrambled.

## "Does the tree describe these rows" is derived, not remembered

`clusterLayout` positions leaves _positionally_ — leaf _i_ on row _i_ — so a
tree that no longer names the rows on screen draws against the wrong ones,
silently. Both enforcement halves are in
[reference/CLUSTERING_WORKFLOW.md](../../agent-docs/reference/CLUSTERING_WORKFLOW.md).
When writing a display:

- **Every action that moves rows routes through `setLayout`**, never a direct
  `self.layout =`.
- **Pass `sources` to `computeClusterHierarchy`** — after every reorder, filter
  and decoration, never the pre-layout list. It is the backstop and can only
  work on the rows actually drawn.

`StaleTreeHint` (rendered by `TreeSidebar`, so no display wires it up) says so
on screen. It distinguishes "stale" from "no tree" and from "deliberately not
positioned" (multi-wiggle overlay) by testing `root` against the rows —
`hierarchy` being undefined does not tell those apart.

## `clusterProvenance` is written in the same action as the tree, always

`treeDescribesRows` gates on row **names**, which don't change when you pan — so
the tree stays drawn over a different locus looking just as authoritative.
`clusterProvenance` records the regions and settings a run used.
`SvgTreeSidebar` captions the export, `clusterProvenanceMenuItems` puts the
locus in the menu, and `ClusterProvenanceHint` draws **only when the view has
drifted off the clustered span**. Drift is an overlap fraction, never equality:
`contentBlocks` shift a sub-bp amount on any pan, so equality would flag
constantly and train the reader to ignore it.

The invariant is not that it is present but that it is never **wrong**. So
`clusterTree` has exactly one writer, the mixin's private
`writeTree(tree, provenance)`, and the four public actions differ only in what
they pass: `setLayoutAndClusterTree` passes the run's, `setLayout`/`clearLayout`
pass nothing, and `setClusterTree` (maf's supplied `.nh`) passes nothing because
a phylogeny has no locus. A tree with no provenance is therefore also the signal
that it was supplied rather than computed.

## `subtreeFilter` goes with the row _names_, not with the tree

It is a set of names matched without a tree, so a reorder or re-cluster leaves
it valid and `setLayout` keeps it; only a change to what rows are _called_
invalidates it. `clearLayout` clears it (full reset), and "Clear subtree filter"
is gated on the filter alone, never a tree, because it outlives one.

## The two `length` encodings

Newick's `length` is an absolute merge height in hclust's `(A,B)1.5` form and an
incremental branch length in phylo's `(A:0.1,B:0.2)` form, needing opposite
layouts. A post-paren numeric is a length only when the string carries no `:`
**delimiter** — in a phylo tree that number is a bootstrap value. Asked of the
tokens, not the raw string, because a quoted label may hold a colon.

## Escaping row names is hclust's job, and `parseNewick` is the other half

A row name written into newick bare becomes grammar rather than a label: a
parenthesis makes the leaf parse as an internal node and the dendrogram vanishes
behind `StaleTreeHint`; a comma splits one leaf into two, so `clusterLayout`
labels every row below it with its neighbour's name.

`@gmod/hclust`'s `toNewick` quotes from 4.0.3. **Don't escape here as well** —
`''BLD.CD4.NPC''` matches no row either. `clusterMatrix.test.ts` asserts the
dependency's half so an hclust that stopped quoting fails there.

`parseNewick` is the reading half and must agree exactly. It stays ours
regardless: maf's supplied `.nh` guide trees are hand-written and may quote.
Quoting also carries meaning the bare form can't — a **quoted** post-paren token
is a name whatever it looks like, the only way to call a node `1.5`.

That rule is about the **newick** grammar only. `generateClusterRScript` writes
the same names into R single-quoted literals, which nobody else quotes for, so
`o'brien` made the whole `rownames(...)` line a syntax error. That one escapes
here (`quoteRName`) — exactly one side of each grammar owns it.

Whitespace is deliberately outside the quoted set on both sides: the tokenizer
reads a bare space as part of the label (variants' phased `NA18536 HP0` rows
depend on it).

## The two row-height arguments, and neither is the display height

`TreeDrawingModel` takes **`effectiveRowHeight`**, never a raw `rowHeight` —
variants and MAF keep `rowHeight` as a raw getter over the config slot, where
`0` means fit-to-height and is their default, so reading it painted zero-height
rects. Structural typing let that through, so keep the contract field named for
the resolved value.

`computeClusterHierarchy` takes `rowsContentHeight` =
`rows.length × effectiveRowHeight`, the rows' full stacked extent, **never the
viewport they scroll inside**. `clusterLayout` puts leaf _i_ at
`(i + 0.5) × rowsContentHeight / n` while everything beside the tree puts row
_i_ at `i × effectiveRowHeight`; pass the viewport and the dendrogram still
draws, still looks plausible, and names the wrong rows. It is an alias for
`height` on two of the four consumers and **not** on a display that scrolls —
"simplify this to the display height" is the edit the parameter is named to
refuse.

## `SvgRowLabels`: a sub-pixel row still draws

Below `MIN_TEXT_ROW_HEIGHT` a row draws as a `labelColor` swatch rather than
stopping — a clustered track can sit far below a pixel a row. The rect is
floored to a pixel (a 0.32px rect antialiases to nothing) and runs paint
**longest-first**, so the rarest group isn't overdrawn. Consequence: **the
stripe is a marker, not a proportional encoding** — mark the group a reader is
hunting for, not the majority.

## Anything marking rows draws **runs**, never a rect per row (`rowRuns`)

`effectiveRowHeight` is fractional whenever a display fits rows to a height and
is deliberately never floored, so a rect per row abuts its neighbour mid-pixel
and a **translucent** fill blends twice, drawing a seam at every row boundary.
2000 rows is also 2000 fill calls per hover frame for what is visually one
block.

The part worth sharing is the gap: a row whose key is `undefined` **breaks** the
run rather than being bridged, or the mark points at rows it does not describe.

## On screen: `TreeSidebar` + `RowLabelsOverlay` are the two halves

Render both. A display that hand-rolls the labels half re-states overlay
geometry that has to be right for it to work at all (`pointerEvents: 'none'` or
it swallows the display's hit test, sized to the **rows viewport**, paired with
the same `scrollTop` the rows use).

## Both halves paint through `TrackOverlayPortal`, above the LGV's masks

A display renders inside `TrackRenderingContainer`'s `contain: strict` sandbox
and the LGV's `PaddingBlocks` are a later sibling painting over all of it, so
nothing inside can `z-index` its way out — a grey separator bar landed on the
sidebar at every region boundary.

**`TreeSidebar` therefore has two layers, split paint-vs-hit-test.** Panel, tree
canvas, hover canvas and hints portal above the masks. The transparent node
picking box and resize handle stay inline because they draw nothing: the portal
node is `pointer-events: none`, and maf binds its wheel-to-scroll listener to
the **DOM** element these sit in. The two layers share an origin, so z-ordering
within the gutter is unchanged.

The portal lands on the **display's own box**; a display drawing its sidebar
elsewhere passes that down as `top` (maf does, for its stacked bands). **maf's
`top` is not the model's `rowsTopOffset`** — its sidebar sits inside a rows
container already translated by that offset, so declaring it applies it twice.
Nor can maf's sidebar move to the display root, since the wheel listener is
bound to that rows element by DOM node. Outside a `TrackContainer` the portal
renders in place.

## Install the autoruns statically; don't `import()` this barrel

`setupTreeDrawingAutorun`, `setupRowSortAutorun` and `setupRunClusteringAutorun`
are installed with a plain call from `afterAttach`. The heavy work is code-split
_inside_ them.

**Dynamically importing a barrel you also statically import is a net loss** —
the static named imports tree-shake to leaf modules, while the namespace request
pulls the rest of the barrel into an async chunk the static-only graph drops
entirely. Measured with esbuild against one display's import list: **608KB vs
539KB**, for ~4KB actually deferrable. It also bought an `async afterAttach`, a
`try`/`catch` and an `isAlive` guard for a call that cannot fail. Split inside a
function, or from a module nobody imports eagerly — never the barrel.

## SVG export: use `SvgTreeSidebar`, never `SvgRowLabels` alone

Labels are offset right by `treeAreaWidth`, so rendering them without the tree
leaves a blank gutter; `SvgTreeSidebar` owns the single gate driving both. A
sidebar that draws more than a label box passes its own renderer as the `labels`
prop rather than teaching `SvgRowLabels` a second drawing.

**And that gate is `treeIsShowing`, not `showTree && hierarchy`.** The gutter is
reserved for the **positioned** tree, never `clusterTree` — a stale tree is
deliberately not positioned, and reserving off the newick string puts the labels
right of an empty gutter. Three places decide it: `TreeSidebar`'s early return,
`SvgTreeSidebar`, and `treeSidebarOffset`. `SvgTreeSidebar` goes further and
binds `drawnTree`, so nothing carries a boolean beside the hierarchy it is
about.
