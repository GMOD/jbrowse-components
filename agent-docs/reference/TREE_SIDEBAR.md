---
name: tree-sidebar
description: How does tree-sidebar own clustering, row arrangement, Newick trees, row labels and their SVG export? Read before touching a tree, a row order or RowSource.
kind: spec
---

# tree-sidebar

Bare paths below are relative to `packages/tree-sidebar/`. Config vocabulary
(`rows`, `facet`, color objects) is in [GRAMMAR_OF_GRAPHICS](GRAMMAR_OF_GRAPHICS.md)
and [CONFIG_SPELLINGS](CONFIG_SPELLINGS.md). The clustering workflow is
[CLUSTERING_WORKFLOW](CLUSTERING_WORKFLOW.md).

## Clustering lifecycle lives here, not per plugin

A dialog flavor renders `ClusterDialog`; a `runClustering: true` flag flavor
uses `setupRunClusteringAutorun` (re-entrancy guard, init gate, abort
controller, one-shot clear, status channel).

The flag flavor starts once the display's `autoClusterReady` holds. Until the
run clears the flag, the mixin answers `awaitingDependentData`, so the loading
scrim, a capture and an SVG export all wait for the rows it orders. A failed run
reports through `notifyError`, which jb2export treats as fatal.

`run` and `applyOrder` should **throw** rather than drop a row silently, so both
land in the dialog's error state. `validateClusterOrder` guards the R-paste path.

`src/hierarchy.ts` wraps `@gmod/newick`'s hierarchy helpers for the tree
canvas and SVG.

## `ClusterMatrix` is a `Map` because its key order _is_ the result

A plain object hoists integer-like keys, so rows built as `10, 2, 1` reach hclust
as `1, 2, 10` and the returned indices name the wrong sources (numbered bigWig
filenames, numeric sample IDs). Build in row order and keep a `Map` the whole
way, through the RPC return type: `generateClusterRScript` writes the same order
into `rownames` and the user pastes `resultClusters$order` back against it.
`Object.keys`/`values`/`entries` on a `Map` compiles and silently returns
nothing; grep for those if rows come back scrambled.

## "Does the tree describe these rows" is derived, not remembered

`clusterLayout` positions leaves **positionally** (leaf _i_ on row _i_), so a
tree that no longer names the rows on screen draws against the wrong ones,
silently. When writing a display:

- **Every action that moves rows routes through `setRowOrder`**, never a bare
  write to `rows.sort`.
- **Pass `sources` to `computeClusterHierarchy`** after every reorder, filter
  and decoration, never the pre-layout list, and `rowBands` beside it on a
  display that bands.

`StaleTreeHint` (rendered by `TreeSidebar`, so no display wires it up)
distinguishes stale from "no tree" and from "deliberately not positioned"
(multi-wiggle overlay) by testing `root` against the rows, and over bands counts
the bands with no clade (`treelessBandCount`).

## A declared row order rotates the tree, it does not reorder against it

`rows.sort` is a preference wherever the rows are a tree's leaves: a phylogeny
fixes its leaf order only up to a rotation at each node, so `rotateNewickByDomain`
turns each node towards the earliest listed leaf below it and the dendrogram
keeps drawing. It is pure over `NewickNode` (no jbrowse import, so it lifts into
`@gmod/newick` as written) and builds fresh nodes iteratively. `parsedTree` is
cached per newick string, so an in-place sort compounds across `rows.sort`
changes and an unlisted clade never returns to file order.

**Where it runs is the design.** Parse time rotates only a tree that was
supplied rather than computed. On `TreeSidebarMixin` provenance alone says so,
because `rows.sort` is the arrangement itself: a run writes its tree's leaf
order there in the same action as the tree.

- A guide tree, the newick a display's adapter supplies through
  `guideTreeNewick` (MAF's `.nh`), never enters `rows.tree`. The mixin's
  `rowTree` draws it while some rotation of it lists `rows.sort`; it carries no
  provenance and rotates at parse. Every display's `rowOrder` reads a supplied
  or guide tree's rows back off that same `parsedTree`'s leaves, then
  `rows.sort`, so such a tree orders the rows it draws and leaves and rows
  cannot drift.
- Everything else rotates in the run that produced it: `rotateClusterRun`,
  called from `applyClusterRun`, which every display's run goes through.
  Rotating an arranged tree on the way out would turn a restored session's
  dendrogram away from the order saved beside it and draw nothing at all.
- The R-paste `applyOrder` path carries no tree and rotates nothing: a paste is
  an explicit order.

**A reorder rotates a supplied tree and drops a computed one.**
`rotatableRowTree` is a `rows.tree` with no provenance, else the guide tree while
it draws. A reorder some rotation of it lists keeps it, rotated at parse; any
other reorder drops it (`orderDropsRowTree`). A computed tree drops on any move,
since its run already rotated it.

`writeNewick` is the only thing here that writes the format rather than reading
it, for the rotated run tree alone. It imports hclust's `quoteName` rather than
restating the escaping rule, and keeps whichever `length` encoding it was handed.

## A tree's provenance is written in the same action as the tree, always

`treeDescribesRows` gates on row **names**, which don't change when you pan, so
the tree stays drawn over a different locus. Nothing on the track says so (an
on-track locus chip was removed as distracting); the Clustering submenu
(`clusterProvenanceMenuItems`) is where the locus shows.

The invariant is that provenance is never **wrong**. The mixin writes the tree
through one private `writeTree`, which sets `rows.tree` whole, `{ newick,
provenance }`, from `setRowOrder`: a run passes its result, and a reorder that
moves a row passes nothing; `resetRowArrangement` returns it to the config.json's.
MAF's supplied `.nh` has no provenance because a phylogeny has no locus, so a
tree with no provenance is also the signal it was supplied rather than computed.

## One mixin holds the arrangement and derives the rows

`TreeSidebarMixin` keeps a display's arrangement and its row colors in its `rows`
config object (the quantitative, variant, multi-row feature, MAF and mark
displays; ADR-157) and derives the rows from it.

**`rows` is one object on every display, and the mixin reads its
arrangement.** display-kit's `RowArrangement` is the five arrangement members
(`sort`, `labels`, `colors`, `tree`, `kept`) with `color` and `axis`, MAF's
`rows` whole. `Rows` extends it with `field`, `filter` and the axis `grid`: a
feature field where the rows are a field's values, `source` alone on the
quantitative display (`QuantitativeRows`), and `sample` or `haplotype` on the
variant display (`VariantRows`). The host is typed on `RowArrangement`, so the
mixin reads `field` and `filter` only through the schema's declared keyed
writes and `Reflect`, where a display has them.

`rows.color` is display-kit's `RowColor` on every row display, one categorical
channel whose `field` names a row attribute, `name` by default, with
`scale.domain`/`scale.range` pairing that field's values with colors (ADR-160).
Under `name` it refuses `scale.domain`: `rows.colors`, a `{ row: css }` map
beside `labels`, pins a color on a row by name (ADR-257). `rowColorSetting` folds
the pins into `rows.color` under `name` as its pairs (`withPinnedColors`), the one
shape the deal, the choice and the key read.

**Shared code reads the mixin's API, never a config member behind it**:
`rowSort`, `rowTree`, `rowTreeProvenance`, `rowFocus`, `resolvedRowColors`,
`rowArrangementIsCustom`, `rowOrderWillDropTree`, `setRowOrder`, `setRowFocus`,
`resetRowArrangement`.

**The rows are derived in stages, each its own computed**, so a change reaches
only the stages downstream of it:

- `discoveredRows`, the display's: a stable-identity getter over region payloads
  (wiggle, multi-row, marks) or over a volatile a header fetch fills (variants,
  MAF, and marks' listed sources).
- `expandedRows`, through `expandRows`: variants' phased haplotypes, the rows
  themselves elsewhere. Variants' `sourcesBase`, the focused samples the fetch
  asks for, is a stage of the display's beside this one and never reads it, since
  expansion reads `samplePloidy`, a fetch result.
- `editableSources`: `arrangeRows` orders by `rowOrder` and relabels by
  `rows.labels`, and `withRowColors` stamps each row's `resolvedRowColors` color
  as `rowColor`. It hands back `expandedRows` itself while nothing is arranged or
  colored, which the `!==` caches downstream (`encodeInputs`, `createEncodeMemo`)
  key on.
- `clusterableSources`: `rowNarrowing` (`narrowRows`: `rows.filter` over row
  attributes, then `rows.kept` by name).
- `bandedSources`: the bands `rowBanding` names (`bandRows`), each band's rows in
  their arranged order; `clusterableSources` itself while nothing bands.
  `rowBands` is each band's value, label and row span.
- `sources`, the display's: palette, MAF's reference row.

The stages, the hook defaults, the `rows` reads they start from and the row
colors and key are written once, in `treeSidebarRowViews.ts`, as one views
function per stage, each reading only through `self` what an earlier stage or a
hook gives. The mixin installs them as `.views()` layers, so each getter stays
its own computed and a display's override answers wherever a stage reads a
hook. The wiggle and variants tables exports build `treeSidebarRowsModel`: an
MST model of the same layers over the display's config node, which the export
extends with the hooks its display overrides (in a later `.views`, as the
display does) and creates, with no session or view. So an export orders,
narrows, bands and colors the rows as the view does.

The hooks are declared by the mixin and overridden by a getter in a later
`.views` block, as `RowHeightMixin`'s `autoRowHeight` is; a `.volatile` of a
hook's name throws at `create`:

- `discoveredRows`: every display.
- `guideTreeNewick`: none by default; MAF's adapter newick.
- `expandRows(rows)`: variants.
- `rowParent(row)`: variants and MAF. The row a row refines, read off the row (a
  haplotype row's `sampleName`, a MAF copy row's species), plus what its label
  adds (` HP1`, ` copy 2`), so an order, a label, a color, a tree and a focus
  written against the parent reach its rows, a label composing as `Mother HP1`,
  and the edit diff falls back to that composed label.
- `finerRows`: variants. The haplotype rows phased mode draws or would, so an
  entry naming one reaches the sample row standing for it (a sample ranks at its
  first haplotype entry). The mixin's `rowAlias` is derived from these two and
  `expandedRows`; MAF overrides it to read copy names no block here aligns.
- `finerTreeHint`: what the stale-tree chip says where the tree's leaves are
  `finerRows` (`treeOnFinerRows`), a per-haplotype tree in sample mode.
- `sharesPanel`: false by default; a wiggle overlay of several subtracks.
- `rowColorPaintsMarks`: true by default; false where something else colors the
  marks (multi-row's `encoding.color` setting or itemRgb, wiggle's gradient or
  declared `encoding.color`, variants' genotypes).
- `unlistedRowsSort`: `source` by default; multi-row's discovered values sort.
- `rowOrder`: a tree that arrived as data (supplied, or a guide tree) leads with
  its leaves, then `rows.sort` for the rows it lacks; `rows.sort` alone
  otherwise, since a computed tree's run wrote its leaf order there.
- `rowBanding`: none by default; the variant displays' `facet`, and the multi-row
  display's `facet` with its `rows.groups` groups listed after the facet's
  `sort`.
- `rowBand(row)`: the row's value of the banding field by default; multi-row
  matches `rows.groups` on the name, since its rows are tagged after the
  arrangement.
- `rowColorFields`: the row fields offered to color by. By default every field the
  rows carry but their name, label and colors (on multi-row the `group` its
  `rows.groups` tag); variants' are its samplesTsv columns; MAF and the mark
  display offer none.

MAF also overrides `clusterableSources`, since on a track that discovers its
species a focus applies as given, as the worker's does.

**A row's color is one getter, `resolvedRowColors`**: its `rows.colors` pin, else
its `rows.color` entry (the color its field's value is dealt), else its own
`color`, else the palette's by name where `rowPaletteDeals`
(`sharesPanel && rowColorPaintsMarks`). `dealtValueColors` is the
value-to-color map behind it and `dealtValueColorsFor` the dialog's preview of
another setting.

- `dealRowColors` deals d3's ordinal way over the rows in source order
  (`rowColorDealRows`), so no reorder, focus or relabel recolors a row and a
  tables export deals the same (ADR-239).
- Values the config declares for the field (`rowColorDeclaredValues`, the
  multi-row display's `rows.groups` groups) take their turns first, loaded or
  not, so a later region moves no color.
- Listed values take their `scale.range` color, the rest first seen first from
  tableau10 less its grey and then re-lit laps of it (`rowPaletteColorAt`); a set
  `scale.unknown` stands in for the palette.
- A name deal skips a row carrying its own color. A field deal skips the empty
  value, so a row with none takes a color only from a `''` pair (ggplot's
  `na.value`, not a category); a field no row carries deals nothing.
- A multi-row `rows.groups` entry only tags a row's `group`; the group's color is
  `rows.color: { field: 'group' }`.
- Every row carries its color as `rowColor`: the sidebar always draws it as the
  row's label bar, and a display paints its marks in it only where
  `rowColorPaintsMarks`. A row's own `color` stays the file's attribute.

**A row color has one key, `rowColorScales`**, which every display spreads last
into its `colorScales`: one scale titled by the `rows.color` field, capitalised,
or none where it would have no entries. It keys wherever the labels cannot name
the colors: by a field on any display at any row height, and by `name` only in a
shared panel (on stacked rows the labels are the key).

- `rowColorKeyEntries` lists one entry per value some row carries with a color,
  in deal order (pairs first, then first seen over the rows in source order, so a
  focus never re-ranks or drops one), then under an attribute one entry by label
  for each row `rows.colors` pins, its value left to the other rows. The empty
  value has none, even under a `''` pair.
- The key is unconditional and never summarizes; `FloatingLegend`'s "Show N
  more" toggle shortens a long one.
- A set `scale.unknown` adds one trailing "Other" in that color for the rows that
  took it; a `scale.unknown` of `''` adds nothing.
- The scale declares `focusesRows`, and the mixin's `focusLegendEntry` answers
  it: a click focuses the rows `rowColorKeyValue` lists under the entry, out of
  `editableSources`, so a second click reaches the rows the first hid. Every
  other scale's entries name colors and stay inert.
- Wiggle drops the key in an overlay painting a score gradient, where no row
  color shows.

What else the mixin owns:

- **Every writer flushes** through the track's `persistConfigurationNow()`, so an
  arrangement is in the session, and undoable, the moment it lands rather than
  after the track's 400 ms save, in which window a ctrl+z undoes the previous
  change instead.
- **A reset returns to the config.json** through `baseDisplayConfig(self)`, or to
  what a track the session owns was added with, and never touches `rows.field`. A
  reset to empty would write a delta erasing an admin's declared order for that
  reader.
  - `rowArrangementIsCustom` and `rowColorIsCustom` compare against the same base
    and leave `rows.kept` and `rows.filter` out, since they have a clear of their
    own (the chip's "Show all"); a reset still returns both to the base's.
  - The pins, `rows.colors`, are an arrangement member keyed by the row field like
    `rows.sort` and `rows.labels`, so a reset returns them and a write that
    changes `rows.field` clears them; `rows.color` names an attribute and stays.
  - `rowColorResetTarget` (`rowColorChoice.ts`) is the one rule for what a reset
    writes to `rows.color`: the object the live choice starts from in the base
    (`startingRowColor`), nothing under None, nothing while the live object is not
    custom. A reset never changes the choice, and its target is never itself
    custom, so one reset is the whole way back (ADR-209).
- **The dialog shows `rows.color` and the pins and submits them**
  (`applyRowEdits(rows, { color, colors })`, `RowColorEdits`; ADR-209 has the
  choices and their picks).
  - The choice is read off `rows.color` alone, so a pin never changes it; None
    colors no row but the pins, which it keeps. A choice opens on the mixin's
    `rowColorFor`, and the dialog keeps a draft per choice for the sitting.
  - The row list's swatches pin under any choice, writing `rows.colors`. The bulk
    editor sets `label` and `rowColor` alone (`BULK_EDIT_FIELDS`) and warns on a
    pasted column that would change anything else; its `rowColor` column edits the
    pins of the rows it names, so a pin for a row the dialog does not show stands.
  - The rows carry order and labels only, written by `labelEdits`: an entry the
    config holds stands unless the reader relabelled that row, and a row the
    dialog never showed keeps its entry. An order that moves no row is not
    written, and a submit that leaves the color panel alone passes no colors.
- **A display's own color rides above the rows, and is written on Submit.**
  `plotColor` (`PlotColorRow`) is held in the dialog's local state and written in
  `submit()` **after** `applyRowEdits`, because a plot color can change whether the
  palette deals, which the written row color was chosen under. `showRows` drops the
  row choice, the grid and the bulk editor where the display has nothing to
  arrange, and `onEditAsJson` is the channel-spec escape as a button. A ReactNode
  cannot be held for a Submit, so the dialog takes no live-writing display
  controls.
- **A reorder keeps the names it did not show.** `setRowOrder` writes the rows it
  was handed ahead of every name the current order carries beyond them, so on the
  multi-row display, whose rows are discovered per region, a declared order keeps
  its unseen rows. `rowOrderWillDropTree` compares the same merged order, so a
  submit that moves no shown row keeps the tree.
- **A `rows.kept` naming no current row shows no row**, and `rowNarrowingNotices`
  says so (ADR-257); empty shows every row.

**A change reaches only the stages downstream of it, and a census gates that**:
each display's `workCensus.test.ts`, beside its `rowDerivation.test.ts`,
snapshots per step the arranger's runs and rows, the `rowAlias` calls, each
stage's recomputes and the display's named reaction runs.

## "Sort rows by … here" is three shared pieces and one per-display read

Only _which value a row carries at the column_ is the display's (multi-wiggle the
score, multi-row its clustering attribute). `rowSortColumn.ts` owns the rest:

- **`regionCoversColumn` is asked by the gate and by the sort.**
  `setupRowSortAutorun` waits for a region satisfying it and then clears
  `sortRowsBy`, so a sort answering the question differently gets dispatched into,
  declines, and has its trigger cleared anyway.
- **No covering region means leave the rows alone.** Every row reads "no value",
  which ranks them equally and writes back the order they already had: a sort that
  silently did nothing, and an order write that can still clear the tree.
  Filtering the regions on refName alone is the near-miss (multi-row shipped it):
  coordinates repeat across regions by refName, so two loaded windows on one
  contig both answer and the map's iteration order picks.
- **A read can be async.** Multi-row's values come from a worker RPC, so its
  `sortRows` returns a promise, and `setupRowSortAutorun` clears `sortRowsBy` only
  once it resolves `true`.
- **`orderRowsByValueAt` owns missing-last and stability**, and hands `compare`
  only values that exist. A neutral fill-in instead (`0`) ranks a valueless row
  above every negative score and into the middle of every color block.

## The shown rows go with the row _names_ and attributes, not with the tree

`rowNarrowing` is the one narrowing every reader goes through: the rows a run
clusters, the pruned tree, the variant fetch's samples (`sourcesBase`), the chip
and the tables export. `rows.filter` (predicates over row attributes, not keyed)
runs first, then `rows.kept` (names, keyed, through `rowAlias`). Matched without a
tree, so a reorder or re-cluster leaves them valid and `setRowOrder` keeps them.

- `resetRowArrangement` returns both to the base's.
- The chip's "Show all" (`showAllRows`) clears `kept` and returns `filter` to the
  base's, so a filter the config states shows through; "Show all rows" clears
  `kept` alone and is gated on it.
- The tree narrows by the rule the rows do: `root` runs `narrowRows` over the
  tree's leaves, a leaf reading its row's attributes, so a focus naming a sample
  keeps its haplotypes' clade.

**The chip takes its own line above the rows.** The mixin's `rowsTopOffset` is the
display's `rowsHeaderHeight` hook (bands, an axis inset) plus `rowFocusLineHeight`,
the `SIDEBAR_HINT_LINE_PX` the "Showing N of M rows" chip sits in while something
narrows the rows and the rows are known (`rowNarrowingShows`), so no "0 of 0"
flashes before the first region lands. A display overrides `rowsHeaderHeight`,
never `rowsTopOffset` (MST shadows a redefined getter silently), and places every
row painter, hit test, label and export from `rowsTopOffset`.

## Newick

- **Two `length` encodings**: an absolute merge height in hclust's `(A,B)1.5`, an
  incremental branch length in phylo's `(A:0.1,B:0.2)`, needing opposite layouts.
  A post-paren numeric is a length only when the string carries no `:`
  **delimiter**, asked of the tokens, not the raw string, since a quoted label may
  hold a colon.
- **Escaping row names is hclust's job** (`toNewick` quotes from 4.0.3), so
  **don't escape here as well**. `clusterMatrix.test.ts` asserts the dependency's
  half. Bare, a parenthesis makes a leaf parse as an internal node and a comma
  splits one leaf into two. The one gap is the empty name, the multi-row display's
  no-value row: hclust writes it bare, which reads back as an unnamed leaf, so
  `clusterMatrix` names that leaf and `writeNewick` quotes it as `''`. Once
  hclust's `quoteName` quotes `''`, the fix-up goes.
- `parseNewick` is the reading half and must agree exactly. It stays ours
  regardless (MAF's `.nh` guide trees are hand-written and may quote), and a quoted
  post-paren token is a name whatever it looks like.
- **`generateClusterRScript` escapes on its own side** (`quoteRName`): an unescaped
  `o'brien` makes the whole `rownames(...)` line a syntax error. Exactly one side
  of each grammar owns escaping.
- Whitespace is deliberately outside the quoted set on both sides (variants'
  `NA18536 HP1` rows).

## `RowSource` is the row vocabulary, and the mixin's bound

`TreeSidebarMixin<S extends RowSource>`. Every field this package draws with is on
`RowSource`; `TreeSource` / `RowLabelSource` are picks of it rather than separate
declarations.

**A row has two colors, never more.** `color` is the row's own, an attribute the
file gave it (MAF's `samples[].color`, a samplesTsv `color` column, a multi-wiggle
subtrack's color). `rowColor` is the resolved one the mixin stamps, which
`SvgRowLabels` draws and the dialog edits. A display needing a third color for its
marks derives it (wiggle's `markSources`) rather than storing it on the row.
`RowLabelSource` is satisfied structurally, so a row type carrying the color under
any other name type-checks and paints nothing.

`rowAxisConfigSchema` (display-kit) is the matching `rows.axis` object (`tree` /
`branchLength` / `labels` / `width`), one sub-schema every row display's `rows`
declares, so a display cannot ship three of the four. `rowAxisWithGridConfigSchema`
adds `grid`, the row separators, on every row display but MAF.

- The declared row order is `rows.sort`, beside the axis, which the mixin reads as
  `rowSort`.
- **The mixin declares the accessors over those slots**, so a display composes both
  halves or neither. A hand-written `getConf` / `setConf` one-liner beside a slot
  this package's own code reads is how a labels toggle can silently ignore its
  config. `showRowLabelsMenuItem` is the row, and `treeSidebarShowMenuItems` the
  two tree toggles beside it, all three under "Show..." on every display, with
  `RowLabelsOverlay` mounted whether or not a tree is showing.

## Two row-height arguments, and neither is the display height

`rows.step` and `RowHeightMixin` (in `src/rowHeight/`) are specified in
[ROW_HEIGHT_AND_FIT](ROW_HEIGHT_AND_FIT.md). The rules that bind this package:

- **`autoRowHeight` is declared and overridden by a getter.** A `.volatile` of that
  name throws at `create`, since mobx refuses to write a volatile over a computed.
  A display owes the mixin a **value** for it (the rows viewport is a different
  quantity in each).
- **The mixin's `configuration` host member stays a cast**, narrowed to
  `RowHeightHost`: a declared prop would collide with the one BaseDisplay supplies.
  **Narrow is the point**: reaching the host through `AnyConfigurationModel` gets no
  slot-name check at all, and a misspelled read has no runtime diagnostic.
  `RowHeightMixin.test.ts` pins that with `@ts-expect-error` against the host type,
  not a test display, whose concrete schema checks the name itself.
- **`TreeDrawingModel` takes `effectiveRowHeight`**, never `rowStep`, which
  is `"fit"` in fit mode and no height at all. Keep the contract field named
  for the resolved value.
- **`computeClusterHierarchy` takes `rowsContentHeight`** =
  `rows.length × effectiveRowHeight`, which `TreeSidebarMixin` computes once from
  `sources`, **never the viewport they scroll inside**. Pass the viewport and the
  dendrogram still draws, still looks plausible, and names the wrong rows.

## Drawing rows

- **A row's color is a bar, not a tinted box.** Above `MIN_TEXT_ROW_HEIGHT`
  `SvgRowLabels` draws `rowColor` as a `ROW_COLOR_BAR_WIDTH` (4 px) bar at the
  label's left, and every name in the column starts past the bars once any row has
  one; the text keeps the theme's color. There is no toggle. The label box and the
  bar span their whole row, so the strip reads as the rows beside it, with a
  hairline between rows and consecutive same-colored rows forming one block.
- **A sub-pixel row still draws.** Below `MIN_TEXT_ROW_HEIGHT`, where no text
  draws, `SvgRowLabels` fills the label run with `rowColor`, floored to a pixel,
  **longest-first** so the rarest group isn't overdrawn. The stripe is a marker,
  not a proportional encoding.
- **Anything marking rows draws runs, never a rect per row (`rowRuns`).**
  `effectiveRowHeight` is fractional and deliberately never floored, so a rect per
  row blends twice at every boundary under a translucent fill. A row whose key is
  `undefined` **breaks** the run rather than being bridged.

## On screen: `TreeSidebar` + `RowLabelsOverlay`, both portalled

Render both; a display that hand-rolls the labels half re-states overlay geometry
that has to be right for it to work at all. A display whose rows scroll mounts
`RowsPanel` instead, which places both, the scrollbar and the wheel-bound panel
from `rowsTopOffset` and `scrollViewportHeight`; the variant layouts, MAF and the
mark display do. Multi-row and wiggle fit their rows to the display height and
mount the two directly.

**Both paint through `TrackOverlayPortal`, above the LGV's masks**: a display
renders inside `TrackRenderingContainer`'s `contain: strict` sandbox and
`PaddingBlocks` is a later sibling painting over all of it, so nothing inside can
`z-index` out. `TreeSidebar` therefore splits paint from hit-test: panel, tree
canvas, hover canvas and hints go through the portal; the transparent picking box
and resize handle stay inline because they draw nothing and `RowsPanel` binds its
wheel listener to the DOM element they sit in. The two layers share an origin.

The portal lands on the **display's own box**; a display drawing its sidebar
elsewhere passes that down as `top`. Inside `RowsPanel` that `top` is
`rowsTopOffset`, and the inline half takes none, since the panel already sits
there.

## Install the autoruns statically; don't `import()` this barrel

`setupTreeDrawingAutorun`, `setupRowSortAutorun` and `setupRunClusteringAutorun`
are plain calls from `afterAttach`; the heavy work is code-split _inside_ them.

**Dynamically importing a barrel you also statically import is a net loss**: the
static named imports tree-shake to leaf modules, while the namespace request pulls
the rest of the barrel into an async chunk. Measured 608KB vs 539KB for ~4KB
actually deferrable. Split inside a function, or from a module nobody imports
eagerly.

## A tree per band

ComplexHeatmap's `row_split` with `cluster_rows`: bands stack the rows and each
band draws its own dendrogram. **The bands win over a tree**, so nothing yields: a
band draws the clade of `rows.tree` whose leaves are exactly its rows in order, and
a band with none draws nothing, which the stale-tree hint counts
(`treelessBandCount`). A whole-cohort tree under a facet set afterwards draws in
the bands that happen to be its clades, and a band a row joined loses its own tree
alone (ADR-169).

- **`rows.tree` holds one forest**: a run under two or more bands sends
  `clusterPartition`, `clusterMatrix` clusters each band apart, and the root joins
  the band trees at the tallest one's height, so every leaf sits at one depth and
  the forest drawn unbanded is a dendrogram. A one-row band is a bare leaf.
  `rows.sort` is the leaves in turn, written by the one `setRowOrder`, and the
  forest root's child order places nothing, since `rowBanding` places the bands.
- **`matchBandClades` is one post-order walk** labelling each node with the band
  its leaves share and their count, and `computeClusterHierarchy` calls it once,
  never per band.
- **`bandForestLayout` puts every clade on one depth scale**, as ComplexHeatmap
  draws slice dendrograms, so a band's farthest leaf meets the right edge and its
  root sits as far in as its height. The root joining them is `forestRoot`:
  `treeLinks` (canvas and SVG) skips its links and the spatial index leaves it out.
  No clade with a branch, no hierarchy.
- **The band strip is the band's label**, never a chip over the data:
  `SvgBandLabels`, a column beside the tree, `bandLabelWidth(text)` wide so it
  scales with the export's font size, with each band's name written up its rows,
  cut short with an ellipsis where it does not fit and whole on hover.
  `RowLabelsOverlay` and `SvgTreeSidebar` both take `bands` and shift the row
  labels past the strip, so the screen and the export draw one strip; it draws
  whatever `rows.axis.labels` says, and nothing hides it.

## SVG export: `SvgTreeSidebar`, never `SvgRowLabels` alone

Labels are offset right by `rows.axis.width`, so rendering them without the tree
leaves a blank gutter; `SvgTreeSidebar` owns the single gate driving both.

**That gate is `treeIsShowing`, not `showTree && hierarchy`.** The gutter is
reserved for the **positioned** tree, never `rowTree`: a stale tree is deliberately
not positioned, and reserving off the newick string puts the labels right of an
empty gutter. Three places decide it: `TreeSidebar`'s early return,
`SvgTreeSidebar`, and `treeSidebarOffset`.

**A display states its export sidebar once, in the mixin's `svgSidebar` getter.**
`renderSvg` hands that getter to `SvgTreeSidebar`, and the mixin's
`svgSidebarWidth(text)` sizes the view's gutter from the same props, so the width
reserved and the sidebar drawn cannot drift. Both measure in the export's
`ExportTextStyle`: labels measured in one font and drawn in another run into the
plot.
