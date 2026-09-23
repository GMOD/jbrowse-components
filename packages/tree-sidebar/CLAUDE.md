# tree-sidebar

Both enforcement halves and the full workflow:
[reference/CLUSTERING_WORKFLOW.md](../../agent-docs/reference/CLUSTERING_WORKFLOW.md).

## Clustering lifecycle lives here, not per plugin

A dialog flavor renders `ClusterDialog`; a `runClustering: true` flag flavor
uses `setupRunClusteringAutorun` (re-entrancy guard, init gate, abort
controller, one-shot clear, status channel). Both plugins used to carry drifting
copies.

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

- **Every action that moves rows routes through `setRowOrder`**, never
  `self.layout =`.
- **Pass `sources` to `computeClusterHierarchy`** — after every reorder, filter
  and decoration, never the pre-layout list.

`StaleTreeHint` (rendered by `TreeSidebar`, so no display wires it up)
distinguishes stale from "no tree" and from "deliberately not positioned"
(multi-wiggle overlay) by testing `root` against the rows.

## A declared row order rotates the tree, it does not reorder against it

The declared row order, `rows.domain`, is a preference wherever the rows are a
tree's leaves: a phylogeny fixes its leaf order only up to a rotation at each
node, so `rotateNewickByDomain` turns each node towards the earliest listed leaf
below it and the dendrogram keeps drawing. It is pure over `NewickNode` — no
jbrowse import, so it lifts into `@gmod/newick` as written — and builds fresh
nodes iteratively. `parsedTree` is cached per newick string, so an in-place sort
compounds across domain changes and an unlisted clade never returns to file
order.

**Where it runs is the design.** Parse time rotates only a tree that was
supplied rather than computed. On `TreeSidebarMixin` provenance alone says so,
because `rows.domain` is the arrangement itself: a run writes its tree's leaf
order there in the same action as the tree. MAF's guide tree never enters
`rows.tree`: MAF's `rowTree` draws the adapter's newick while some rotation of
it lists `rows.domain`, so it carries no provenance and rotates at parse, and
maf reads its row order back off that same computed, so the leaves and the rows
cannot drift. Everything else rotates in the run that produced it:
`rotateClusterRun`, called from `applyClusterRun` and from variants'
`applyClusterOrder`, which is the path `runGenotypeClustering` takes instead.
Rotating an arranged tree on the way out would turn a restored session's
dendrogram away from the order saved beside it and draw nothing at all. The
R-paste `applyOrder` path carries no tree and rotates nothing: a paste is an
explicit order.

`writeNewick` is the only thing here that writes the format rather than reading
it, for that rotated run tree alone. It imports hclust's `quoteName` rather than
restating the escaping rule, and it keeps whichever `length` encoding it was
handed.

## A tree's provenance is written in the same action as the tree, always

`treeDescribesRows` gates on row **names**, which don't change when you pan, so
the tree stays drawn over a different locus looking just as authoritative.
`ClusterProvenanceHint` draws **only on drift off the clustered span**, measured
as an overlap fraction — `contentBlocks` shift a sub-bp amount on any pan, so
equality would flag constantly.

The invariant is not that provenance is present but that it is never **wrong**,
so each mixin writes the tree through one private `writeTree`, which sets the
provenance beside it. `TreeSidebarMixin`'s writes `rows.tree` and
`rows.treeProvenance` together from `setRowOrder`: a run passes its result, and
a reorder that moves a row passes nothing; `resetRowArrangement` returns both to
the config.json's in one action. maf's supplied `.nh` has no provenance because
a phylogeny has no locus, so a tree with no provenance is also the signal it was
supplied rather than computed. `SvgTreeSidebar` draws the same drift-only hint
in the export (`SvgClusterProvenanceHint`), and `clusterProvenanceMenuItems`
puts the locus in the menu.

## Two mixins, and the display-state one has no user

`TreeSidebarMixin` keeps a display's arrangement in its `rows` config object —
the quantitative display's, `MultiSampleVariantBaseModel`'s, the multi-row
feature display's and MAF's (ADR-157). `LayoutTreeSidebarMixin` keeps it in
display state (`layout`, `clusterTree`, `clusterProvenance`, `subtreeFilter`);
MAF was its last user, and it stays until it is retired.

**`rows` comes in two schemas, and the mixin reads either.** display-kit's
`RowArrangement` is the five members alone, for a display whose rows are
intrinsic (a sample, a species), and `Rows` extends it with `field` for one
whose rows are a field's values. The host is typed on `RowArrangement`, so the
mixin never reaches for `field`, which stays the display's own.
`treeSidebarBase` is the half the store does not change — the toggles, the
launch specs, the hover and canvas volatiles — and both mixins put one API over
it: `rowDomain`, `rowTree`, `rowTreeProvenance`, `rowFocus`,
`rowArrangementIsCustom`, `rowOrderWillDropTree`, `setRowOrder`, `setRowFocus`,
`resetRowArrangement`. **Shared code reads that API, never a prop behind it**,
so the sidebar, clustering, the column sort and the menus work over either.

What the config-backed mixin adds:

- **Every writer flushes** through the track's `persistConfigurationNow()`, so
  an arrangement is in the session, and undoable, the moment it lands rather
  than after the track's 400 ms save, in which window a ctrl+z undoes the
  previous change instead.
- **A reset returns to the config.json** through `baseDisplayConfig(self)`, or
  to what a track the session owns was added with, and never touches
  `rows.field`. A reset to empty would write a delta erasing an admin's declared
  order for that reader. `rowArrangementIsCustom` compares against the same base
  and leaves `rows.kept` out, since the focus has a clear of its own; a reset
  still clears it.
- **Row styling stays the display's.** `applyRowEdits` is the display's own, and
  `rowStylingIsCustom` / `resetRowStyling` are the hooks that bring its colours
  (wiggle's and multi-row's `rowColor`) into "custom" and into a reset. What a
  submit writes, `rowEdits` computes: the config's labels and colour pairs with
  the rows the dialog showed written over them, so a row no loaded region holds
  keeps its entry; the display supplies what a shown row says beyond the
  adapter's and writes the result.
- **A reorder keeps the names it did not show.** `setRowOrder` writes the rows
  it was handed ahead of every name the current order carries beyond them, so on
  the multi-row display, whose rows are discovered per region, a declared order
  keeps its unseen rows. `rowOrderWillDropTree` compares the same merged order,
  so a submit that moves no shown row keeps the tree.
- **A focus naming no current row shows every row** (`keptRows`), where
  `subtreeFilter` matching none hides every row (`filterRowsBySubtree`).

## "Sort rows by … here" is three shared pieces and one per-display read

Only _which value a row carries at the column_ is the display's (multi-wiggle
the score, multi-row the painted color). `rowSortColumn.ts` owns the rest:

- **`regionCoversColumn` is asked by the gate and by the sort.**
  `setupRowSortAutorun` waits for a region satisfying it and then clears
  `sortRowsBy`, so a sort answering the question differently gets dispatched
  into, declines, and has its trigger cleared anyway.
- **No covering region means leave the rows alone.** Every row reads "no value",
  which ranks them equally and writes back the order they already had — a sort
  that silently did nothing, and an order write that can still clear the tree.
  Filtering the regions on refName alone is the near-miss (multi-row shipped
  it): coordinates repeat across regions by refName, so two loaded windows on
  one contig both answer and the map's iteration order picks.
- **`orderRowsByValueAt` owns missing-last and stability**, and hands `compare`
  only values that exist. A neutral fill-in instead (`0`) ranks a valueless row
  above every negative score and into the middle of every color block.

## The row focus goes with the row _names_, not with the tree

Matched without a tree, so a reorder or re-cluster leaves it valid and
`setRowOrder` keeps it. `resetRowArrangement` clears it; "Clear subtree filter"
is gated on the filter alone.

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

`TreeSidebarMixin<S extends RowSource>`, and `LayoutTreeSidebarMixin` the same.
Every field this package draws with is on `RowSource`, and `TreeSource` /
`RowLabelSource` are picks of it rather than separate declarations — the bound
used to be `{ name: string }`, the weakest possible, and the four displays
composing the mixin each wrote their own row type against it.

**The tint is `labelColor`, always.** `SvgRowLabels` drops to a `labelColor`
swatch below `MIN_TEXT_ROW_HEIGHT`, and because `RowLabelSource` is satisfied
structurally, a row type carrying the color under any other name type-checks and
paints nothing. MAF called it `color` and bridged with a `labelSources`
computed; that is why three adapter schemas advertised a slot reaching no
renderer at all. The multi-sample variant displays called it `color` too and
bridged with a label gutter of their own, ~350 lines that existed because the
shared one read the other name.

`treeSidebarConfigSchemaFields` is the matching slot set (`showTree` /
`showBranchLength` / `showRowLabels` / `treeAreaWidth`), taking only the
per-display descriptions, so a display cannot ship three of the four. The
declared row order is not in it. Every row display declares a `rows` object and
composes `TreeSidebarMixin`, which reads the order as `rows.domain`;
`rowDomainConfigSchemaFields`, the `domain` slot `LayoutTreeSidebarMixin` reads
and throws without, has no display spreading it. Either way the getter is
`rowDomain`, never `domain`, which is the score axis on the wiggle display.
**The mixins declare the accessors over those slots**, so a display composes
both halves or neither. Hand-written `getConf` / `setConf` one-liners beside
slots this package's own code reads are how the labels toggle came to be spelled
`showSidebarLabels` on one display and silently ignore its config.
`showRowLabelsMenuItem` is the row, and `treeSidebarShowMenuItems` the two tree
toggles beside it — all three under "Show..." on every display, with
`RowLabelsOverlay` mounted whether or not a tree is showing.

## Two row-height arguments, and neither is the display height

`rowHeightConfigSchemaFields` + `RowHeightMixin` (in `src/rowHeight/`, beside
the menu and dialog) are the slot and the three members over it: the raw
`rowHeight` getter, `setRowHeight`, and the resolved `effectiveRowHeight`. Three
displays hand-wrote all four. What a display still owes is a **value** for
`autoRowHeight` — the rows viewport is a different quantity in each — and
`setFitToHeight`, which is required to seed the `height` slot exactly where the
`height` getter is content-derived. Canvas overrides `effectiveRowHeight` to cap
the stack at the canvas limit.

`autoRowHeight` is **declared** by the mixin and overridden by each display, so
`effectiveRowHeight` reads a member of its own type. Override it with a getter:
mobx refuses to write a volatile over a computed, so a `.volatile` of that name
throws at `create`. The mixin's other host member, `configuration`, cannot be
declared the same way — a prop would collide with the one BaseDisplay already
supplies — so it stays a cast, narrowed to `RowHeightHost`. **Narrow is the
point**: a mixin reaching its host through `AnyConfigurationModel` gets no
slot-name check at all, and a misspelled read is the half with no runtime
diagnostic anywhere. `RowHeightMixin.test.ts` pins that with `@ts-expect-error`,
against the host type rather than against a test display — a test display's own
schema is concrete and checks the name itself, so asking it passes either way.

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
reserved for the **positioned** tree, never `rowTree` — a stale tree is
deliberately not positioned, and reserving off the newick string puts the labels
right of an empty gutter. Three places decide it: `TreeSidebar`'s early return,
`SvgTreeSidebar`, and `treeSidebarOffset`.
