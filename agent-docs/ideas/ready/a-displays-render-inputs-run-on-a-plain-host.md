---
name: a-displays-render-inputs-run-on-a-plain-host
description: "@jbrowse/img (jb2export) as a deterministic export rather than a headless app boot: frame, fetch, resolve, paint, with each display's resolve views installed on a minimal MST model holding only its config and fetched results. Built: wiggle's whole resolve chain and the tree-sidebar rows as views functions, each display's row hooks written once, and one wiggle static host the wiggle tables run. Parked on static-wiggle-render: staticWiggleSvg, staticLgvFrame and renderDisplaySvgInFrame, whose parity test must compare the whole display node. Built too: the sidebar and the key on the static host. Left: every other display, the non-linear view frames, the chrome, and the CLI switch."
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
  one wiggle static host per track type's schema (`wiggleTablesHost`):
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

## Parked on `static-wiggle-render`

`staticWiggleSvg` (`@jbrowse/plugin-wiggle/staticSvg`), `staticLgvFrame`,
`renderDisplaySvgInFrame` (`renderDisplaySvg` past its `awaitSvgReady`, with
the view handed in as an `SvgViewFrame`), `WiggleSvgBody` exported over a
`WiggleSvgBodyModel`, and `products/jbrowse-img/src/staticWiggle.test.ts`.
They come back over the wiggle tables' host, with the sidebar below.

Its parity test compares only a prefix of jb2export's output,
`svg.slice(start, start + body.length)` from where the static body starts, so
a static body missing a trailing element, the y axis, passes. It must find the
display's whole node in both outputs, from its opening tag to its matching
close, and compare the two nodes whole.

## Built: alignments' read colors and read key

`plugins/alignments/src/LinearAlignmentsDisplay/alignmentsColorViews.ts` holds
the bake chain (`readColorOpts`, `bakedColorExtent`, `linearFieldExtent`,
`bakedColorScale`, `readColorContext`, `laidOutByGroupColored`) and the read
key over it (`baseQualitySpan`, the `*InWindows` presence scans,
`declaredReadLabels`, `keyReadLabels`, `overlapLegendRows`, `keySectionOrder`,
`colorRamps`, `legendItems`), over a host of the display's resolved settings
and its framed layout (`laidOutByGroupFramed`). The model installs it between
its layout block and `laidOutByGroup`; `tables.ts` runs it over a plain host,
memoizing each getter once (`memoizedViews`) since a plain getter recomputes
on every read and the scans would re-bake every read. Running it found no
drift; the tables' hand copy was equivalent. The scans that read no baked
color now read the framed layout rather than `laidOutByGroup`, so a recolor or
a connector toggle no longer re-runs them.

The tables still lay out every row where the view lays out under row caps
(`layoutGroupsToViewport`). That is an export difference, not a drift: a cap
is a viewport policy, and the bake and the read rows of the key read no row,
since a read past the cap stays in the laid-out map on the overflow row
(`sortLayout.ts`, the `maxRows` sentinel). Only the overlap rows read layout
output, and each side keys the overlaps it draws.

## Left

- **`renderState`** (`wiggleDisplayViews`) on the static host, then the body.
- **RefNames**: the frame must carry the adapter's refNames; the static path
  has no assembly manager. `packages/tables`' `assemblyResolver` is the piece to
  run before the frame.
- **Autoscale groups** across tracks: the static host answers no group, so a
  figure whose tracks share one needs the union across their static hosts.
- **What the session did around the body**: the byte gate (`regionTooLarge` is
  never set), rasterized layers (the parity test is vector), and the chrome —
  ruler, track labels, region separators, the legend gutter.
- **The CLI**: `jb2export` still renders through the session.

## The long tail

Seventeen displays export through a `renderSvg`. Each needs its resolve chain
moved into views functions, a static model composing its config mixins, and a
parity test against `renderRegion`. By family, cheapest first:

- **Score plots** (wiggle multi-source, `LinearMarkDisplay` and Manhattan,
  the sequence display): the wiggle pieces carry over.
- **Features** (`LinearBasicDisplay`): the layout is main-thread but pure, so
  it moves as a views function too; the features-layout work is that move.
- **Matrices** (Hi-C, `LDDisplay`, the variant matrix): `TriangleMatrixMixin`
  and `MatrixRampMixin` move as wiggle's axis did; variants' rows are built.
- **Alignments** and **MAF**: the longest chains (`renderState`,
  `sourceSections`, `renderSections` in `LinearAlignmentsDisplay/model.ts`),
  alignments' pileup layout pure on the main thread, MAF on the rows as well.
  Alignments' read colors and key already run on the tables' static host; the
  read palette (`colorsIn`) is still built by hand there from the default
  theme.
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
