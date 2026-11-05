---
name: a-displays-render-inputs-run-on-a-plain-host
description: "@jbrowse/img (jb2export) as a deterministic export rather than a headless app boot: frame, fetch, resolve, paint, with each display's resolve views installed on a minimal MST model holding only its config and fetched results. Built: wiggle's whole resolve chain and the tree-sidebar rows as views functions, each display's row hooks written once, and one wiggle static host the wiggle tables and staticWiggleSvg both run, its parity test comparing the display's whole SVG node with jb2export's. Built too: the sidebar and the key, alignments' coverage scale and palette, variants' cell and record colors, the byte gate as views, staticFeaturesSvg, and the LGV chrome over a static frame, so a one-wiggle jb2export image is byte-identical statically. Left: the CLI switch, every other display, and the non-linear view frames."
---

# A display's render inputs run on a plain host

Colin (2026-11-02) wants `@jbrowse/img` (`jb2export`) to be a predictable
static export rather than a headless boot of the interactive app. Today
`products/jbrowse-img/src/renderRegion.ts` builds a session
(`createViewStateAsync`), launches views and tracks, waits on
`whenViewSettled`, then calls `renderToSvg`. The target is four plain steps:

- **Frame**: what the view supplies for a region list and a width — `bpPerPx`,
  the visible and buffered regions, the settled blocks.
- **Fetch**: the display's RPC run in-process over the frame's buffered
  regions, as `@jbrowse/tables` already does.
- **Resolve**: the display's own getters, from settings and fetched results to
  its painter's inputs.
- **Paint**: the display's export body, the Canvas2D draws the SVG export
  already reuses, inside the display shell.

Drawing it from `@jbrowse/tables` was considered and declined: tables stop at
data plus the display's decisions, so jb2export would need a second drawer per
display, and the tables already disagree with the view in places
([a-tables-export-calls-the-models-decisions](a-tables-export-calls-the-models-decisions.md)).

## The shape

The resolve chain is written as functions from a duck-typed host to an object
of getters, as `wiggleDisplayViews` already was:

- **The display model** installs each with `.views(self => xViews(self))`, so
  every getter is its own computed and memoizes exactly as before.
- **A static consumer** builds a minimal MST model, declared at module scope:
  the display's config schema as a child, the frame and fetched results as
  volatiles set by one action, the config mixins the display composes
  (`YFieldConfigMixin`, `TrackHeightMixin`), and the same views functions in
  the same order, the config-read ones included. No session, no view, no
  autoruns (`afterAttach` never fires on a root).
- **A display's hook overrides** are a views function too, installed by the
  display after the mixin that declares the hooks and by the static model
  after the same layers.
- **Inside a views function** every member is read through `self`. A getter
  reading a sibling goes in a later function, so the layers are as many as the
  dependency chain is deep (`wiggleConfigViews` then `wiggleModeViews`).
- **The static model's reads** happen in one `runInAction` per phase (the
  fetch inputs, then everything drawn), since MobX caches a computed read
  outside a reaction only inside a batch. A per-row method such as
  `rowBand(row)` then reads `rowBanding` once.

Not a second plain-object host: an MST model reuses the mixins whole and gives
the views the screen's `self` and override semantics with no casts. A plain
object with getters installed by hand was built first and replaced: it needed
a cast for the views' own hooks and lazy forwarding between the host and the
views, and its inputs were re-read from the config beside the views.

One pure function per display, `resolveX({ conf, results, … })` called by the
model, was the first proposal and is not the shape: a model getter calling it
recomputes the whole chain whenever any input moves, so a row-color edit would
re-walk the autoscale stats. Nor is this display-as-spec (ADR-089/091): the
display keeps its model, and the static path runs that model's views.

## Built

- **Wiggle's color and mark sources** (`wiggleResolveViews`): `effectiveExtent`,
  the color chain, `markSources`, `scoreRuleValues`, `autoscaleSourceNames`,
  `gpuProps`, and the `rowColorPaintsMarks` hook.
- **The rest of wiggle's chain as views functions**, installed by
  `LinearWiggleDisplay` in place of its inline getters, in
  `plugins/wiggle/src/shared/`: `wiggleConfigViews` (the config leaves) and
  `wiggleModeViews` (`isDensityMode`, `colorKeyTitle`, `isOverlay`);
  `wiggleDomainViews` (`domain`, `defaultScoreDomain`); `wiggleStatsViews`
  (`statsInView`) and `wiggleAutoscaleViews` (`autoscaleRange`,
  `valuesInView`); `wiggleRowsBoxViews`, `wiggleRowHeightViews` and
  `wigglePlotViews` (`rowsHeight`, `effectiveRowHeight`, `numRows`,
  `plotGeometry`); and, in `wiggleAxisViews.ts`, `wiggleRowLabelViews`,
  `wiggleSidebarViews` and `wiggleAxisViews` (`sidebarPanel`, `valueScales`,
  `svgSidebar`). `ScoreAxisMixin.axes` is `valueScaleAxes(valueScales)`, a pure
  step in the same file.
- **The view's frame steps**: the LGV's `visibleRegions` and
  `bufferedVisibleRegions` call two pure functions,
  `LinearGenomeView/visibleRegions.ts`, which a static frame runs too.
- **The rows**: `packages/tree-sidebar/src/treeSidebarRowViews.ts` holds the
  chain `TreeSidebarMixin` installs: the `rows` reads, the hook defaults, one
  views function per stage from `expandedRows` through `rowOrder`, the row
  colors and their key to `sources`, and `rowNarrowingShows` →
  `rowFocusLineHeight` → `rowsTopOffset`.
- **Each display's row hooks once**: `wiggleRowHookViews` (`discoveredRows`
  over `rpcDataMap`, `sharesPanel`, `rowNoun`) and, in
  `LinearVariantDisplay/variantRowViews.ts`, `variantRowConfigViews`
  (`rowsField`, `facet`) and `variantRowHookViews` (`expandRows`, `rowParent`,
  `finerRows`, `rowBanding`, `rowColorPaintsMarks`).
- **The tables run them**: `plugins/variants/src/tables.ts` declares
  `VariantTablesHost` (config, the listed samples and the fetched ploidies, the
  row views, `variantRowHookViews`); `plugins/wiggle/src/tables.ts` declares
  one wiggle static host per track type's schema (`wiggleStaticHost`):
  `TrackHeightMixin`, `YFieldConfigMixin`, the config child, the fetched
  scores and the blocks they span as volatiles, `wiggleConfigViews` and
  `wiggleModeViews`, the row views, `wiggleRowHookViews`, `wiggleDomainViews`,
  `wiggleResolveViews`, the stats and autoscale views and the plot views. The
  wiggle export reads its extent, origin, rendering, layout, color, summary,
  y scale, domain, rules and height off it. Running them closed a drift: the
  exports ordered by `rows.sort` alone, so a supplied `rows.tree` drew its leaf
  order on screen and the file's order in the export (the parity harness's
  `rows.tree` cases, and `variants.test.ts` and `wiggle.test.ts`).
- **The sidebar and the key on the static host**: the tree beside the rows is
  tree-sidebar stages too (`treeSidebarAxisConfigViews`, `rowTreeRootViews`,
  `treeSidebarTreeHookDefaults`, `rowsContentHeightViews`, `hierarchyViews`),
  so the wiggle host runs `wiggleRowLabelViews`, `wiggleSidebarViews` and
  `wiggleAxisViews` and lists the rules `scoreRulesDrawn` says the axis
  draws, and `wiggleScoreKeyViews` and `wiggleColorScaleViews`, so its
  `ramps`, `legend` and `legendTitle` are `colorKeyTables(colorScales)`. The
  variants host runs whether the rows draw (`variantGenotypesShowViews`,
  `variantGenotypeRowViews`, `variantDrawnRowViews`), the cell coloring
  (`variantColorSettingViews`) and the records band's key (`recordsKeyViews`,
  `recordsColorScaleViews`), and keys through `variantDataColorScales`, the
  display's `colorScales` less the row key.
- **The variant cells' and records' colors**:
  `LinearVariantDisplay/cellColorViews.ts` holds `cellHueInputViews`
  (`cellHueInput`, compared by value, and `cellHueRead`),
  `cellHueValuesReadViews`, `cellHueViews` (`cellHue`, `cellPaintOptions`)
  and `regionCellColorViews`, and the key over them, `cellKeyViews`
  (`hasSecondaryAlt` … `paintedDomain`) and `variantDataKeyViews`
  (`dataColorScales`, the display's `colorScales` less the row key). The
  records' colors are `recordColorViews` (`regionRecordColors`) in
  `recordsBandViews.ts`. `VariantTablesHost` installs them over a
  `ParkedColorMixin`, the fetched `cellData` as a volatile and a no-fade
  `regionRecordAlpha`; the fade ships apart as `variantDensityAlpha`. The
  parity harness compares each drawn cell's color (`cellColors`) and each
  record's (`recordColors`). Running them closed a drift: `variants.color`
  still painted ADR-203's full-dose lane hue under the default and
  `phaseSet`, where the records band paints the SV class or
  `featureDefaultColor`.

## Built: the static wiggle SVG

`staticWiggleSvg` (`@jbrowse/plugin-wiggle/staticSvg`) runs on the one wiggle
static host the tables run, `plugins/wiggle/src/shared/wiggleStaticHost.ts`:
its frame carries `trackWidthPx`, read through `trackCanvasWidthPx` as a
display does, and it installs `wiggleScoreKeyViews` and `wiggleDisplayViews`
(`renderState`) where the display does. The export reads the fetch inputs in
one `runInAction` and everything the body draws in a second, into a plain
`WiggleSvgBodyModel`, and hands it to `renderDisplaySvgInFrame`
(`renderDisplaySvg` past its `awaitSvgReady`) over a `staticLgvFrame`.

`products/jbrowse-img/src/staticWiggle.test.ts` parses both exports and
compares every node the display draws, from its clip's `<defs>` to the end of
its group, less the view's region separators (3px rects, the view's chrome),
for xyplot in a window and over a whole contig, line, density, and a
four-source multi-wiggle drawn a row per source. Dropping the y axis from the
static body fails every case that draws an axis. The one difference found was
chrome: the LGV export passes its `fontSize: 13` default to every display, so
a static caller states the view's text style itself.

## Built: alignments' read colors and read key

`plugins/alignments/src/LinearAlignmentsDisplay/alignmentsColorViews.ts` holds
the bake chain (`readColorOpts`, `bakedColorExtent`, `linearFieldExtent`,
`bakedColorScale`, `readColorContext`, `laidOutByGroupColored`) and the read
key over it (`baseQualitySpan`, the `*InWindows` presence scans,
`declaredReadLabels`, `keyReadLabels`, `overlapLegendRows`, `keySectionOrder`,
`colorRamps`, `legendItems`), over a host of the display's resolved settings
and its framed layout (`laidOutByGroupFramed`). The model installs it between
its layout block and `laidOutByGroup`. `tables.ts` runs it on a static MST
host (`AlignmentsTablesHost`): the display's config schema as a child, the
fetched and laid-out reads as volatiles, `coverageBandSlotViews` and
`configSlotViews` for every setting the export reads, then the same color
views. The export reads the host in two `runInAction` batches, the fetch args
before the fetch and everything after it, since MobX caches an unobserved
computed only inside a batch: unbatched, a review counted
`laidOutByGroupColored` twice and `bakedColorExtent` three times per call. Running it found no drift; the
tables' hand copy was equivalent. The scans that read no baked
color now read the framed layout rather than `laidOutByGroup`, so a recolor or
a connector toggle no longer re-runs them.

The coverage band's scale runs there too: `coverageScaleViews.ts` holds
`bandPlotViews`, `coverageStatsViews`, `coverageAutoscaleViews`,
`coverageDomainViews` and `coverageTicksViews`, over
`ScoreScaleMixin(COVERAGE_Y_PATHS)` with the regions as a `view` frame, and
the read palette is `readPaletteViews` (`colorsIn`) over a `theme` volatile.
Running them found no drift; a hidden coverage band (`coverage.show: false`)
now exports no axis, as the display draws none.

The tables still lay out every row where the view lays out under row caps
(`layoutGroupsToViewport`). That is an export difference, not a drift: a cap
is a viewport policy, and the bake and the read rows of the key read no row,
since a read past the cap stays in the laid-out map on the overflow row
(`sortLayout.ts`, the `maxRows` sentinel). Only the overlap rows read layout
output, and each side keys the overlaps it draws.

## Built: features on a static MST host

A static consumer builds its host as a minimal MST model with no session, view
or autoruns: the display's config node, the fetched inputs as volatiles, and
the same views functions the display installs. A plain object spread-merged
with a views object (`{...host, ...views(host)}`) evaluates every getter
eagerly against the bare host, so `labelVisibility` and its scan recomputed
about five times and a later layer's override never applied.

`FeatureTablesHost` in `plugins/features/src/tables.ts` is that model. Its
one prop is the display's config schema; the window and then the fetched
regions are volatiles, each set by one action, as the alignments host's
`setInputs` does. It installs, in the display's order: `heightModeViews`
(`HeightModeMixin`), `featureDisplayConfigViews` (`facet`, `displayMode`,
`groupKeySpace`, `labelFontSize`, `showNames`, `showDescriptions`),
`hiddenGroupsViews` (`HiddenGroupsMixin`), `hiddenSectionViews`,
`featureColorViews`, `basicDisplayGlyphViews` (now with the
`subfeatureLabels`, `showChevrons` and `geneGlyphMode` config reads),
`basicDisplayLayoutViews` (now with `labelDensityPerPx`), `featureBandViews`
and `featureColorScaleViews` (`derivedColorScales`). Its own views answer only
what a view supplies the display: the window (`host`, `onScreenWidthPx`, the
on-screen ids through `featureIdsTouchingBlocks` over the regions),
`layoutReady`, `fitTargetHeight` off the `height` slot and the `hidesOverflow`
hook. The reads before the fetch (the worker's subfeature-label and gene-glyph
modes) are one `runInAction`, everything after it another.
`packages/tables/src/parity/features.parity.test.ts` runs the display beside
it.

`hostFeatureBand` (`observable(featureBandViews(host))`) stays for the variant
display's records band, which is a live display's own band rather than an
export.

## Built: the byte gate as views

`packages/display-kit/src/regionTooLargeViews.ts` holds the gate's budget and
verdict over `RegionTooLargeGateHost`: the display's `gateEnabled` and
`densityTooLarge` hooks, its `fetchSizeLimit` and `forceLoad` slots, the
adapter's `fetchSizeLimit`, the button's approval, the frame's span and the
fetch's `byteEstimate`. `RegionTooLargeMixin` installs them and keeps only the
view and track reads and the re-measure machinery. `gateTruthTable.test.ts`
runs them on a static MST host over every truth-table row against the live
mixin. No static consumer gates yet: one reads `resolvedByteLimit()` before
its fetch, sets `byteEstimate` after it, and reads `regionTooLarge`; for
features, `FeatureGateMixin`'s density chain (it reads the view's
`coarseBpPerPx`) moves to views functions first.

## Built: the mark request chain, spelled once

`markStepListsOf`, `markChannelsOf`, `layerRequestsOf` and `markColorsOf`
(plugin-marks) take a mark list with its shared steps and inherited color.
The mark display's getters each make one call, and multi-way synteny's lane
layers make the same calls with neither: a lane layer's closed schema
declares no `transform`, `facet` or `encoding`, and the multi-way display's
`encoding.color` is its gene glyphs' color, which ADR-248 keeps off lane
marks. They are pure calls rather than a views function because multi-way
runs the chain per lane layer, which has no host; a static mark host wraps
them in views over `conf`, `bpPerPx` and `hiddenCategories`.

## Built: the static features SVG

`staticFeaturesSvg` (`@jbrowse/plugin-features/staticSvg`) runs on the one
feature static host the tables run, `plugins/features/src/shared/featureStaticHost.ts`
(`FeatureStaticHost`), built over a frame (`bpPerPx`, `coarseBpPerPx`,
`trackWidthPx`, `settledDynamicBlocks`); the tables build theirs from their
regions. It composes `TrackHeightMixin` and installs, in the display's order,
the height chain lifted off `HeightModeMixin` (`fitTargetHeightViews`, the
display's `heightViews`, then `grownHeightViews`, whose view check reads a
`hostInitialized` the static host answers true) and two layers lifted off the
base model, `featureRenderStateViews` (`renderState`) and `groupLabelViews`
(`showsGroupLabels`). The export fetches over the frame's buffered regions
(`fetchFeatureRegions`), reads everything drawn in one `runInAction` into a
plain `FeaturesSvgBodyModel`, and mounts the display's `FeaturesSvgBody` in
`renderDisplaySvgInFrame`.

`products/jbrowse-img/src/staticFeatures.test.ts` compares the display's whole
node with jb2export's over volvox's GFF3: normal mode with labels, collapsed, a
whole contig where labels thin out, features crossing the window edge, color by
`type`, grow, and a strand facet's chips. No drift. Both paths fetch the same
buffered regions and fit to the frame's on-screen blocks, so the layout is
deterministic. Left for features: the key (the view draws it in a sibling
group from the display's legend settings), the byte gate (over the limit
throws, as the tables do), and a zoomed-in CDS, which needs the caller to pass
the sequence adapter and genetic code.

## Built: the LGV chrome and refNames

The LGV's `renderToSvg` draws through `lgvSvgDocument`
(`svgcomponents/lgvSvgDocument.tsx`): header, scalebar, ruler, gridlines,
region separators, track boxes and labels, both gutters and the highlight
clip, read only through an `LgvSvgChromeView`. That is the view, or a
`staticLgvFrame`, which carries the chrome's blocks, ticks, labels and
orientation through `lgvChromeOf` (`staticChrome.ts`). Track rows name
themselves, the track geometry is the pure `layoutSvgTracks`, and cytobands
and highlights are slots only a session fills. `staticLgvSvg` lays out a
static export's tracks through the same two.

A static frame is in the assembly's names, as a view's is. jb2export's
`staticLinearSvg` (`products/jbrowse-img/src/staticLinear.ts`) resolves the
assembly with the tables' `assemblyResolver` before the frame, resolves the
locString through its aliases, and fetches each wiggle track under the file's
names (`renameRegions`, the hook `staticWiggleDisplay` takes).
`staticLinear.test.ts` compares the whole document with `renderRegion`'s byte
for byte over six wiggle command lines, an aliased contig among them.

## Built: the static mark SVG

`staticMarkSvg` (`@jbrowse/plugin-marks/staticSvg`) runs `MarkStaticHost`
(`LinearMarkDisplay/markStaticHost.ts`): the display's config and
`hiddenCategories`, the frame, fetched layers and row listing as volatiles,
the config mixins the display composes (`TrackHeightMixin`, `RowHeightMixin`,
`ScoreScaleMixin`, `LegendMixin`), the tree-sidebar row views, and the mark
chain `LinearMarkDisplay` installs in the same order: `markConfigViews.ts`
from `markConfigViews` to `markRequestViews`, and `markResolveViews.ts` from
`markRowListingViews` to `markSvgSidebarViews`. It fetches through
`executeGetEncodedLayers` over `binnedFetchRegions`, and `executeGetRowSources`
where the display draws rows, and returns `{ svg, legend }`: the key is an
`SvgLegend` model the view's chrome places, since its placement and height
are chrome. `products/jbrowse-img/src/staticMark.test.ts` compares the
display's whole node and the key's whole group with jb2export's for a bar, a
line and rule on a log axis, categorical points with their key, an aggregate
over a shared bin, a hidden key category and a row per value. No drift. The
one session read, the assembly manager's canonical refName for a link mark's
far end, is the display's `canonicalRefName`; the static host answers the
refName unchanged, which holds only while its frame is in the adapter's names.

## Left

- **Marks under `staticLinearSvg`**: its frame is in the assembly's names, so
  `MarkStaticHost.canonicalRefName` must canonicalize through the resolved
  assembly's aliases before a link mark's far end is matched.
- **The CLI switch for wiggle-only sessions**: modifiers into display config
  (`buildDisplaySnapshot`), multi-region, reversed and gene-name locs, the
  theme from the config, cytobands, `reportConfigProblems`, the config's
  `plugins`, and display ids that assume track *i* sits at index *i*.
- **Autoscale groups** across tracks: a static host answers no group
  (`ungroupedAutoscaleViews`, on the wiggle and alignments hosts), so a figure
  whose tracks share one needs the union across their static hosts.
- **What the session did around the body**: a static consumer of the byte
  gate (above), and rasterized layers (the parity tests are vector).

## The long tail

Seventeen displays export through a `renderSvg`. Each needs its resolve chain
moved into views functions, a static model composing its config mixins, and a
parity test against `renderRegion`. By family, cheapest first:

- **Score plots** (Manhattan, the sequence display): the wiggle and mark
  pieces carry over; wiggle and `LinearMarkDisplay` are built.
- **Features** (`LinearBasicDisplay`): built (above), less its key.
- **Matrices** (Hi-C, `LDDisplay`, the variant matrix): `TriangleMatrixMixin`
  and `MatrixRampMixin` move as wiggle's axis did; variants' rows are built.
- **Alignments** and **MAF**: the longest chains (`renderState`,
  `sourceSections`, `renderSections` in `LinearAlignmentsDisplay/model.ts`),
  alignments' pileup layout pure on the main thread, MAF on the rows as well.
  Alignments' read colors, key, palette and coverage scale already run on the
  tables' static host.
- **Comparative and circular displays** (`MultiWaySyntenyDisplay`,
  `LinearSyntenyDisplay`, the dotplot display, `ChordSyntenyDisplay`,
  `ChordVariantDisplay`): each needs its own view's frame first.

jb2export's other four modes need their frames before any display in them
renders: dotplot (two `Base1DView` axes), synteny (a stack of LGV frames and
the levels between them), circular (the strip the view publishes as
`regionHost`), breakpoint (two LGV frames and the reads joining them).

## The transition

Two pipelines for a while: a display ported to the static path renders
statically, the rest keep the session path, and the mode picks per track. Each
port lands with its figure parity test, so the two cannot disagree silently;
the session path goes when the last display in a mode is ported.

## Not this

- jb2export drawing from tables: a second drawer.
- One resolve function per display called by the model's getters: it loses the
  per-getter memo (above).
- Making `launchTrack` throw so a caller sees failures: click handlers rely on
  its toast-and-undefined contract. Failures reach a headless caller as
  `view.problems` instead (`BaseViewModel`, filled by `getNotificationSink`).
