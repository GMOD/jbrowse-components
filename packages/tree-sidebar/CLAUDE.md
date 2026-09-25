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

- **Every action that moves rows routes through `setRowOrder`**, never a bare
  write to `rows.domain`.
- **Pass `sources` to `computeClusterHierarchy`** — after every reorder, filter
  and decoration, never the pre-layout list — and `rowBands` beside it on a
  display that bands.

`StaleTreeHint` (rendered by `TreeSidebar`, so no display wires it up)
distinguishes stale from "no tree" and from "deliberately not positioned"
(multi-wiggle overlay) by testing `root` against the rows, and over bands counts
the bands with no clade (`treelessBandCount`).

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
the tree stays drawn over a different locus. Nothing on the track says so — an
on-track locus chip was removed as distracting — so the Clustering submenu
(`clusterProvenanceMenuItems`) is where the locus shows.

The invariant is not that provenance is present but that it is never **wrong**,
so the mixin writes the tree through one private `writeTree`, which sets
`rows.tree` and `rows.treeProvenance` together from `setRowOrder`: a run passes
its result, and a reorder that moves a row passes nothing; `resetRowArrangement`
returns both to the config.json's in one action. maf's supplied `.nh` has no
provenance because a phylogeny has no locus, so a tree with no provenance is
also the signal it was supplied rather than computed.

## One mixin holds the arrangement and derives the rows

`TreeSidebarMixin` keeps a display's arrangement in its `rows` config object and
its row colours in the `rowColor` object — the quantitative display's,
`MultiSampleVariantBaseModel`'s, the multi-row feature display's, MAF's and the
mark display's (ADR-157) — and derives the rows from them.

**`rows` comes in two schemas, and the mixin reads either.** display-kit's
`RowArrangement` is the five members alone, for a display whose rows are
intrinsic (a sample, a species), and `Rows` extends it with `field` for one
whose rows are a field's values. The host is typed on `RowArrangement`, so the
mixin never reaches for `field`, which stays the display's own. `rowColor` is
display-kit's `RowColor` on every row display, one categorical channel whose
`field` names a row attribute, `name` by default, with `domain`/`range` pairing
that field's values with colours (ADR-160). **Shared code reads the mixin's API,
never a config member behind it**: `rowDomain`, `rowTree`, `rowTreeProvenance`,
`rowFocus`, `rowColorScale`, `rowArrangementIsCustom`, `rowOrderWillDropTree`,
`setRowOrder`, `setRowFocus`, `resetRowArrangement`.

**The rows are derived in stages, each its own computed**, so a change reaches
only the stages downstream of it:

1. `discoveredRows`, the display's: a stable-identity getter over region
   payloads (wiggle, multi-row, marks) or over a volatile a header fetch fills
   (variants, MAF, and marks' listed sources).
2. `expandedRows`, through `expandRows`: variants' phased haplotypes, the rows
   themselves elsewhere. Variants' `sourcesBase`, the focused samples the fetch
   asks for, is a stage of the display's beside this one and never reads it,
   since expansion reads `sampleInfo`, a fetch result.
3. `editableSources`: `arrangeRows` orders by `rowOrder`, relabels by
   `rows.labels` and tints by the `rowColor` pairs on the `identityChannel`. It
   hands back `expandedRows` itself while nothing is arranged, which the `!==`
   caches downstream (`featurePaintInputs`, `createEncodeMemo`) key on.
4. `clusterableSources`: the focus (`keptRows`).
5. `bandedSources`: the bands `rowBanding` names (`bandRows`), each band's rows
   in their arranged order; `clusterableSources` itself while nothing bands.
   `rowBands` is each band's value, label and row span.
6. `sources`, the display's: palette, MAF's reference row.

The hooks are declared by the mixin and overridden by a getter in a later
`.views` block, as `RowHeightMixin`'s `autoRowHeight` is; a `.volatile` of a
hook's name throws at `create`:

- `discoveredRows` — every display.
- `expandRows(rows)` — variants.
- `rowAlias` — variants: the sample a haplotype row answers to, so an order, a
  label, a tint and a focus written against a sample reach its haplotypes, and
  the edit diff falls back to the sample's entry.
- `identityChannel` — `color` by default; wiggle's follows the mode, variants,
  MAF and marks tint the label.
- `unlistedRowsSort` — `source` by default; multi-row's discovered values sort.
- `rowOrder` — `rows.domain` by default; MAF leads with a drawn tree's leaves.
- `rowBanding` — none by default; the variant displays' `facet`, and the
  multi-row display's `facet` with its `rowGroups` groups listed after the
  facet's domain.
- `rowBand(row)` — the row's value of the banding attribute by default;
  multi-row matches `rowGroups` on the name, since its rows are tagged after the
  arrangement.
- `rowColorDealFor(setting)` — what `dealRowColors` deals under a `rowColor`
  object, the config's (`rowColorDeal`, none under `scale: 'none'`, dealt into
  `dealtRowColors`, which `rowColorScale` maps each row onto) or one the dialog
  previews (`rowColorsFor`): by default the field's values over the base
  arrangement, so no reorder, focus or relabel recolours a row. Under `name`
  wiggle, multi-row and variants hand in the order and palette they dealt before
  ADR-160; MAF and the mark display deal none.
- `rowColorFields` — the row attributes offered to colour by: by default every
  attribute the rows carry but their name, label and colours; variants' are its
  samplesTsv columns; MAF, the mark display and multi-row, whose groups are
  tagged after the arrangement, offer none.

MAF also overrides `clusterableSources`, since on a track that discovers its
species a focus applies as given, as the worker's does. `focusLegendEntry` stays
each display's: each key names rows by a different predicate.

What else the mixin owns:

- **Every writer flushes** through the track's `persistConfigurationNow()`, so
  an arrangement is in the session, and undoable, the moment it lands rather
  than after the track's 400 ms save, in which window a ctrl+z undoes the
  previous change instead.
- **A reset returns to the config.json** through `baseDisplayConfig(self)`, or
  to what a track the session owns was added with, and never touches
  `rows.field`. A reset to empty would write a delta erasing an admin's declared
  order for that reader. `rowArrangementIsCustom` compares against the same
  base, with `rowStylingIsCustom` for the `name` pairs, and leaves `rows.kept`
  out, since the focus has a clear of its own; a reset still clears it.
  `resetRowStyling` writes the base's whole `rowColor` back where the `name`
  pairs differ, and otherwise returns an attribute's value colours to the
  base's, keeping the attribute, so over a config setting no row colour a Color
  by alone survives a reset and a mode switch.
- **The dialog shows the `rowColor` object and submits it**
  (`applyRowEdits(rows, rowColor)`, ADR-164): "Color rows by" None, Each row or
  an attribute; under an attribute a table of its values, each with its colour
  and row count, and read-only row swatches; under Each row editable swatches,
  with "Start from" copying an attribute's colours onto them once. A row's
  swatch is read only under Each row, over `dialogSources`, the rows with the
  pairs a None keeps on them, where `rowEdits` is the rule: an entry the config
  holds stands unless the reader changed that row, so an entry repeating the
  adapter's value survives an unchanged submit; a value changed back to what the
  row shows with no entry of its own removes the entry; a row the dialog never
  showed keeps its entry. Any other object is written as the dialog shows it, so
  a colour set on one row never stands for its value, and nothing is
  materialised. An order that moves no row is not written. The pairs are written
  with two `setConf`s, never `setSubschema`, which would drop `field` and
  `scale`.
- **A reorder keeps the names it did not show.** `setRowOrder` writes the rows
  it was handed ahead of every name the current order carries beyond them, so on
  the multi-row display, whose rows are discovered per region, a declared order
  keeps its unseen rows. `rowOrderWillDropTree` compares the same merged order,
  so a submit that moves no shown row keeps the tree.
- **A focus naming no current row shows every row** (`keptRows`).

**A change reaches only the stages downstream of it, and a census gates that**:
each display's `workCensus.test.ts`, beside its `rowDerivation.test.ts`,
snapshots per step the arranger's runs and rows, the `rowAlias` calls, each
stage's recomputes and the display's named reaction runs.

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
  and a comma splits one leaf into two. The one gap is the empty name, the
  multi-row display's no-value row: hclust writes it bare, which reads back as
  an unnamed leaf, so `clusterMatrix` names that leaf and `writeNewick` quotes
  it as `''`. Once hclust's `quoteName` quotes `''`, the fix-up goes.
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
renderer at all. The multi-sample variant displays called it `color` too and
bridged with a label gutter of their own, ~350 lines that existed because the
shared one read the other name.

`treeSidebarConfigSchemaFields` is the matching slot set (`showTree` /
`showBranchLength` / `showRowLabels` / `treeAreaWidth`), taking only the
per-display descriptions, so a display cannot ship three of the four. The
declared row order is not in it: every row display declares a `rows` object, and
the getter is `rowDomain`, never `domain`, which is the score axis on the wiggle
display. **The mixin declares the accessors over those slots**, so a display
composes both halves or neither. Hand-written `getConf` / `setConf` one-liners
beside slots this package's own code reads are how the labels toggle came to be
spelled `showSidebarLabels` on one display and silently ignore its config.
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

## A tree per band

ComplexHeatmap's `row_split` with `cluster_rows`: bands stack the rows and each
band draws its own dendrogram. **The bands win over a tree**, so nothing yields:
a band draws the clade of `rows.tree` whose leaves are exactly its rows in
order, and a band with none draws nothing, which the stale-tree hint counts
(`treelessBandCount`). A whole-cohort tree under a facet set afterwards draws in
the bands that happen to be its clades, and a band a row joined loses its own
tree alone.

- **`rows.tree` holds one forest**: a run under two or more bands sends
  `clusterPartition`, `clusterMatrix` clusters each band apart, and the root
  joins the band trees at the tallest one's height, so every leaf sits at one
  depth and the forest drawn unbanded is a dendrogram. A one-row band is a bare
  leaf. `rows.domain` is the leaves in turn, written by the one `setRowOrder`,
  and the forest root's child order places nothing, since `rowBanding` places
  the bands.
- **`matchBandClades` is one post-order walk** labelling each node with the band
  its leaves share and their count, and `computeClusterHierarchy` calls it once,
  never per band.
- **`bandForestLayout` puts every clade on one depth scale**, as ComplexHeatmap
  draws slice dendrograms, so a band's farthest leaf meets the right edge and
  its root sits as far in as its height. The root joining them is `forestRoot`:
  `treeLinks` (canvas and SVG) skips its links and the spatial index leaves it
  out. No clade with a branch, no hierarchy.
- **The band strip is the band's label**, never a chip over the data:
  `SvgBandLabels`, a `BAND_LABEL_WIDTH` column beside the tree with each band's
  name written up its rows where it fits, culled where it does not, and a
  hairline between bands. `RowLabelsOverlay` and `SvgTreeSidebar` both take
  `bands` and shift the row labels past the strip, so the screen and the export
  draw one strip; it draws whatever `showRowLabels` says, and nothing hides it.

## SVG export: `SvgTreeSidebar`, never `SvgRowLabels` alone

Labels are offset right by `treeAreaWidth`, so rendering them without the tree
leaves a blank gutter; `SvgTreeSidebar` owns the single gate driving both.

**That gate is `treeIsShowing`, not `showTree && hierarchy`.** The gutter is
reserved for the **positioned** tree, never `rowTree` — a stale tree is
deliberately not positioned, and reserving off the newick string puts the labels
right of an empty gutter. Three places decide it: `TreeSidebar`'s early return,
`SvgTreeSidebar`, and `treeSidebarOffset`.
