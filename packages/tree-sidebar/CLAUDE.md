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
numbered bigWig filenames, numeric VCF sample IDs, or a numeric partition field
— and it fails twice over, because the tree's leaf names then disagree with the
reordered rows and `treeDescribesRows` declines to draw the dendrogram that
would have shown it.

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
`clusterProvenance` records the regions and the settings a run used.
`SvgTreeSidebar` captions the export, which is the copy that ends up under a
figure; `clusterProvenanceMenuItems` puts the locus in the Clustering submenu;
and `ClusterProvenanceHint` draws on screen **only when the view has drifted off
the clustered span**. It used to draw in the quiet state too, and that is text
over the first row of every captured figure stating what a reader already
assumes ("i dont want the tree 'context' text to be displayed", review). Drift
is an overlap fraction (`clusterProvenanceOverlap`), never an equality test —
`contentBlocks` shift a sub-bp amount on any pan, so equality would flag a stale
tree constantly and train the reader to ignore it. That is what makes the quiet
state safe to drop: the chip appearing now always means something.

The invariant is not that it is present but that it is never **wrong**: it may
only describe the tree currently loaded. So `clusterTree` has exactly one
writer, the mixin's private `writeTree(tree, provenance)`, which takes both — a
tree cannot be set without saying what provenance goes with it, and the four
public actions differ only in what they pass. `setLayoutAndClusterTree` passes
the run's; `setLayout`/`clearLayout` pass nothing, dropping it with the tree;
`setClusterTree` (maf's supplied `.nh` phylogeny) passes nothing because a
phylogeny has no locus, and captioning one with the previous run's region is
worse than no caption. A tree with no provenance is therefore also the signal
that it was supplied rather than computed.

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

"Don't escape here as well" is about the **newick** grammar, and does not
generalize: `generateClusterRScript` writes the same names into R single-quoted
literals, which nobody else quotes for, so `o'brien` closed the string and the
whole `rownames(...)` line became a syntax error the user only met in R. That
one escapes here (`quoteRName`), for the same reason the newick half doesn't —
exactly one side of each grammar owns it.

Whitespace is deliberately outside the quoted set on both sides. The tokenizer
reads a bare space as part of the label (variants' phased `NA18536 HP0` rows
depend on it), so quoting it would rewrite the serialized form of nearly every
clustered track to fix nothing.

## `TreeDrawingModel` takes `effectiveRowHeight`, never a raw `rowHeight`

Variants and MAF keep `rowHeight` as a raw getter over the config slot, where
`0` means fit-to-height and is their default — reading it painted zero-height
rects and the hover highlight silently did nothing. Structural typing let that
through, so keep the contract field named for the resolved value.

## …and `computeClusterHierarchy` takes the rows' _content_ height

Same axis, one argument over. `rowsContentHeight` must be
`rows.length × effectiveRowHeight` — the rows' full stacked extent, never the
viewport they scroll inside. `clusterLayout` puts leaf _i_ at
`(i + 0.5) × rowsContentHeight / n`, and everything drawn beside the tree puts
row _i_ at `i × effectiveRowHeight`: the hover highlight, `SvgRowLabels`, the
display's own painting. Pass the viewport and the dendrogram still draws, still
looks plausible, and silently names the wrong rows — `treeDescribesRows`'
failure mode on the pixel axis instead of the name axis, with no guard.

It looks like an alias for `height`, and on two of the four consumers it is one:
the multi-row feature display redefines `height` as exactly
`nrow × effectiveRowHeight` (it grows to its content), and multi-wiggle is
always fit-to-height. It is **not** one on a display that scrolls — maf passes
`rowsContentHeight` and not `rowsHeight`, the variant displays spell the product
out. "Simplify this to the display height" is the edit the parameter is named to
refuse.

## `SvgRowLabels`: a sub-pixel row still draws

Below `MIN_TEXT_ROW_HEIGHT` a row draws as a `labelColor` swatch rather than
stopping — a clustered track can sit far below a pixel a row and the tint is all
that carries row identity. The rect is floored to a pixel (a 0.32px rect
antialiases to nothing) and runs paint **longest-first**, so the rarest group
isn't overdrawn by its neighbours.

Consequence: **the stripe is a marker, not a proportional encoding.** Mark the
group a reader is hunting for, not the majority.

## Anything marking rows draws **runs**, never a rect per row (`rowRuns`)

Two things mark rows — the swatch stripe above and the hovered-subtree highlight
in `treeDrawingAutorun` — and both merge consecutive rows into one rect for the
same two reasons:

- `effectiveRowHeight` is fractional whenever a display fits its rows to a
  height, and is deliberately never floored (`resolveRowHeight`), so a rect per
  row abuts its neighbour mid-pixel. A **translucent** fill then blends over
  that shared pixel twice and draws a seam at every row boundary — the highlight
  grows a grid the data does not have. (That was live in the hover highlight.)
- 2000 rows is otherwise 2000 fill calls per hover frame, or 2000 DOM nodes in a
  scroll-time SVG overlay, for what is visually one block.

The part worth having a shared function for is the gap: a row whose key is
`undefined` **breaks** the run rather than being bridged, or the mark points at
rows it does not describe. Reach for `rowRuns` before writing a
`for (row of rows) fillRect` here.

## On screen: `TreeSidebar` + `RowLabelsOverlay` are the two halves

`TreeSidebar` paints the dendrogram onto its own canvas; `RowLabelsOverlay` is
the labels beside it. Render both — a display that hand-rolls the labels half
re-states the overlay geometry that has to be right for it to work at all
(`pointerEvents: 'none'` or it swallows the display's own hit test, sized to the
**rows viewport** and paired with the same `scrollTop` the rows use). Same
division as the SVG side below.

## Both halves paint through `TrackOverlayPortal`, above the LGV's masks

A display renders inside `TrackRenderingContainer`'s `contain: strict` sandbox,
and the LGV's inter-region masks (`PaddingBlocks` — region separators, elided
and boundary blocks) are a later sibling that paints over the whole of it.
Nothing inside can `z-index` its way out. So in any multi-region or whole-genome
view a grey separator bar landed on the sidebar at every region boundary:
through the opaque dendrogram panel, and through the row-label text, which
floats over the plot and so gets crossed wherever a boundary falls. Both halves
portal out.

**`TreeSidebar` therefore has two layers, and the line between them is
paint-vs-hit-test.** The panel, the tree canvas, the hover canvas and the hints
portal above the masks. The transparent node-picking box and the resize handle
stay inline, because they draw nothing — being under the masks costs them
nothing, and leaving them in the display keeps every pointer path they already
had. That matters concretely: the portal node is `pointer-events: none` (or it
would eat canvas events), and maf binds its wheel-to-scroll listener to the
**DOM** element these sit in, so a portaled hit box would have sent a wheel over
the species names to the view instead of scrolling the rows. The two layers
share an origin and their z-indexes are still read against each other, so
ordering within the gutter is unchanged.

The portal lands on the **display's own box**. A display that draws its sidebar
somewhere other than its own top-left passes that down as `top` — maf does, for
the coverage/conservation bands stacked above its rows — because nothing in the
portal can measure an offset the sidebar used to inherit from its container.
Outside a `TrackContainer` the portal renders in place, so a standalone display
and the component tests are unchanged.

### maf's `top`, and why it is not `lineZoneHeight`

`lineZoneHeight` is the same idea — px reserved above the rows — and maf's
`rowsTopOffset` is exactly that number, so setting it looks like the obvious
tidy-up. **It would be applied twice**: maf's sidebar sits inside its rows
container, which is _already_ translated by `rowsTopOffset`. Only the portaled
half escapes that container and needs to be told, which is what `top` is.

Nor can the sidebar simply move to the display root the way every other
display's does: maf binds its wheel-to-scroll listener to that rows element by
DOM node, deliberately, so a wheel over the species names scrolls the rows it
labels rather than falling through to the view. Moving the inline layer out
takes the hit box with it. The cost of leaving it — the panel, canvas and hit
box running `rowsTopOffset` px past the last row — is clipped away by
`TrackRenderingContainer`'s `contain: strict`, and buying it back means growing
this component an API for maf to re-bind its wheel through.

## Install the autoruns statically; don't `import()` this barrel

`setupTreeDrawingAutorun`, `setupRowSortAutorun` and `setupRunClusteringAutorun`
are installed with a plain call from the display's `afterAttach`. The heavy work
is code-split _inside_ them — `setupRunClusteringAutorun`'s `run` imports the
clustering module when a run actually starts — so the installers themselves are
mobx-only glue.

All three displays reached `setupTreeDrawingAutorun` through
`await import('@jbrowse/tree-sidebar')` instead, on the grounds that it split
heavy drawing code. It split nothing, and it cost:

- **It deferred one module.** `treeDrawingAutorun.ts`'s whole dependency closure
  — `hierarchy.ts` (already pulled by `computeClusterHierarchy` /
  `buildSpatialIndex`), `treeSidebarGeometry.ts`, mobx, `canvas2dUtils` — is in
  the eager graph already, via static imports in the same file. Only its own
  ~4KB was deferrable.
- **Dynamically importing a barrel you also statically import is a net loss.**
  The static named imports tree-shake to the leaf modules they name; the
  namespace request pulls the _rest_ of the barrel — the cluster dialogs, the
  MUI grid — into an async chunk the static-only graph drops entirely. Measured
  with esbuild against one display's import list: **608KB vs 539KB**, +69KB for
  the dynamic form.
- It bought an `async afterAttach`, a `try`/`catch` and an `isAlive` guard for a
  call that cannot fail.

So: a dynamic import of `@jbrowse/tree-sidebar` is always wrong from a file that
already imports it statically, which is every consumer. Split inside a function,
or from a module nobody imports eagerly — never the barrel.

## SVG export: use `SvgTreeSidebar`, never `SvgRowLabels` alone

Labels are offset right by `treeAreaWidth`, so rendering them without the tree
leaves a blank gutter. `SvgTreeSidebar` owns the single gate driving both. A
sidebar that draws more than a label box passes its own renderer as the `labels`
prop rather than teaching `SvgRowLabels` a second drawing — that would change
the MAF, multirow-feature, and wiggle sidebars too.

## …and that gate is `treeIsShowing`, not `showTree && hierarchy`

The gutter is reserved for the **positioned** tree, never `clusterTree` — a tree
that no longer describes the rows on screen is deliberately not positioned
(`computeClusterHierarchy`), and reserving off the newick string puts the labels
`treeAreaWidth` right of an empty gutter. Three places decide it:
`TreeSidebar`'s early return, `SvgTreeSidebar`, and `treeSidebarOffset` (which
is the same predicate times `treeAreaWidth`), and all three spelled it out
separately — including one directly under a comment claiming to be their single
source of truth. Call `treeIsShowing`; `SvgTreeSidebar` goes further and binds
`drawnTree`, the tree-if-showing, so nothing carries a boolean beside the
hierarchy it is about.
