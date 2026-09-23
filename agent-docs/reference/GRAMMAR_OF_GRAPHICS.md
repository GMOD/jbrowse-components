---
name: grammar-of-graphics
description: The mark layer reviewed against the grammar of graphics — which of its seven stages the tree answers and where, the seams, the gaps, and what the tree does that the grammars do not. Read before proposing a grammar feature.
kind: spec
---

# The mark layer against the grammar of graphics

The grammar of graphics is a pipeline: data, transform, scale, mark, guide,
layer, coordinates. This file reads the tree against those seven stages,
names where each is answered and how far the answer reaches, and lists the
seams and the gaps. It is the map across the decisions that built the layer —
[ADR-095](../architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md)
§"The grammar position", [ADR-106](../architecture-decision-records/adr-106-a-display-declares-its-marks.md),
[ADR-107](../architecture-decision-records/adr-107-the-quantitative-class-is-authored-in-config.md),
[ADR-108](../architecture-decision-records/adr-108-a-display-declares-its-colour-scales.md),
[ADR-109](../architecture-decision-records/adr-109-a-display-declares-its-value-scale.md),
[ADR-110](../architecture-decision-records/adr-110-a-display-declares-what-is-highlighted.md),
[ADR-112](../architecture-decision-records/adr-112-a-layer-owns-its-transform-and-its-zoom-range.md),
[ADR-113](../architecture-decision-records/adr-113-one-scale-rule-in-one-place.md),
[ADR-114](../architecture-decision-records/adr-114-canvas-keeps-its-hand-written-packer.md),
[ADR-115](../architecture-decision-records/adr-115-one-mark-may-read-its-own-axis.md),
[ADR-117](../architecture-decision-records/adr-117-the-density-tier-is-a-mark-layer.md),
[ADR-118](../architecture-decision-records/adr-118-the-packers-share-a-rule-not-a-step.md)
and [ADR-119](../architecture-decision-records/adr-119-the-circular-view-is-a-coordinate-stage-over-the-linear-displays.md)
— and each position below points at the record that holds its measurement.

## Two layers, two distances

"Grammar" in this tree names two different things, and they have travelled
different distances. Read anything below with the distinction in hand.

**The mark layer is nearly everywhere.** A mark is one `defineMark`
declaration binding a shape — a hand-written shader, its Canvas2D painter,
its hit test and its SVG export, held to each other by
`sweepMarkAgainstHit` — to a display's region payload and render state. Every
rendering plugin declares them (`grep -rlE "defineMark[(<]" --include='*.ts'
plugins packages`, less the `esm/` build output, is the census — the bracket
class because circular-view passes a type argument): alignments three lists
across its pileup, its arcs and its coverage band, the last of them in
`packages/alignments-core` rather than in the plugin; canvas two; variants
three; and circular-view's rings, dotplot, gwas, hic, synteny, maf, wiggle and
the mark display one list each. Multi-way synteny declares none of its own —
`MULTIWAY_MARKS` spreads synteny's and canvas's. Every display holding a list
builds its rendering backend from it through `createMarkBackend` bar one, and
the `GpuXxxRenderer` / `Canvas2DXxxRenderer` pair that used to sit around a
mark list is gone from hic, wiggle, dotplot, synteny, multi-way, LD, GWAS and
MAF. The pair that remains is the alignments
display's, and it remains on a measurement: three mark lists over two region
payloads, drawn in three
scissored bands per stacked section, up to 120 section blocks a frame, with
uniforms written once per section rather than once per mark
(`benches/pileupUniformWrite.bench.ts` has the table) and an upload memo that
re-packs only the read pass on a colour change and only the arc passes on an
arc change. The generic backend draws one region per block through one list
and has no home for any of that; it grows one the day a second display stacks
sections, and not before (ADR-040's two-consumer bar). The reference sequence
display keeps a Canvas2D-only renderer, having no GPU path to pair it with.

**The grammar — a config-declared `encoding` and `transform`, run through
one encoder — reaches three consumers.** The mark display (`plugins/marks`) is
where a user gets all seven stages from JSON over any feature adapter, and
`AlignmentsTrack`, `VariantTrack` and `FeatureTrack` may all carry it.
Manhattan and wiggle's array-less fallback are the other two callers of
`encodeFeatures`. Canvas's feature glyphs, the alignments pileup and variants'
genotype grid still hand-wire features into their arrays; wiggle's main path and
Hi-C build no `Feature` and pack the parser's typed arrays directly. Two of
those refusals are measured and stand: canvas's packer at 3.11x the encoder's cost
([ADR-114](../architecture-decision-records/adr-114-canvas-keeps-its-hand-written-packer.md))
and the pileup's layout at 4.23x
([ADR-118](../architecture-decision-records/adr-118-the-packers-share-a-rule-not-a-step.md)),
both dominated by materialising the `Feature[]` a step then re-reads rather
than by the rule itself. So a reader gets a real grammar through `marks`, and
a menu everywhere else; [SESSION_SPEC_FORMAT.md](SESSION_SPEC_FORMAT.md)
§"The assessment" is the position that this is the right shape for a genome
browser, because what the format-typed displays hold is layout, tiering and
fetch shape, and those are not channels.

What follows is the stage-by-stage reading, which is true of the mark display
in full and of the format-typed displays only where it says so.

![The grammar's seven stages, and where the tree answers each](diagrams/grammar-pipeline.svg)

## Where the tree answers each stage

| Stage | What the grammar means | Where the tree answers | How far |
| --- | --- | --- | --- |
| data | rows in memory | a feature adapter's `getFeaturesArray`, any format, and past the byte gate the adapter's `densityAdapter` sidecar as a mark's layer (ADR-117) | whole; the adapter is the format's, and the grammar has no lazy source of its own. An adapter with zoom levels is sent the view's `bpPerPx` ([ADR-123](../architecture-decision-records/adr-123-a-mark-reads-a-bigwig-at-the-rungs-floor.md)), so a BigWig answers from the summary tier the wiggle display reads |
| transform | a declared step over rows before encoding | a typed step list — `filter`, `formula`, `flatten`, `bin`, `aggregate`, `coverage`, `pileup` — each step its own schema taking only its own slots ([ADR-150](../architecture-decision-records/adr-150-a-transform-step-is-one-schema-per-type.md)), run by `runTransforms` (`packages/core/src/util/featureTransforms.ts`), shared on the `CoreEncodeFeatures` request and then each layer's own | whole, layout included — `pileup` is a read pileup's packing as a step, and not the format-typed displays' ([ADR-118](../architecture-decision-records/adr-118-the-packers-share-a-rule-not-a-step.md)); a `bin`'s width may follow the zoom; `window` and `sample` are absent |
| scale | domain → range, separate from the encoding | the colour and glyph channels carry their own, `{ field, scale, domain, range }` and on a ramp `domainMin`, `domainMax` and `scheme`, read by `encodeFeatures` (`packages/core/src/util/markEncoding.ts`) and resolved either in the worker (categorical) or on the main thread against a domain uniform (a quantitative ramp); the value scale is the display's one `scales.y`, which every mark's `encoding.y` field is read through and `ScoreAxisMixin` derives the axis from ([ADR-141](../architecture-decision-records/adr-141-one-y-scale-the-displays.md), generalised to every quantitative display by [ADR-142](../architecture-decision-records/adr-142-one-value-scale-object.md)) | whole, declared in one place |
| mark | a shape bound to channels | `defineMark` over a `MarkShape`, one declaration for three backends, export and hit test (`packages/render-core/src/marks/`) | whole, for the shapes the library has |
| guide | axis and legend derived from a scale; a highlight derived from a selection | `colorScales` → legend (`packages/display-kit/src/LegendMixin.ts`), `valueScales` → axis, its title, hatches, and the reference lines `scales.y.rules` declares (`packages/wiggle-core/src/ScoreAxisMixin.ts`), `hoverInk` / `selectionInk` / `pinnedInk` / `soloInk` → the highlight (`packages/display-kit/src/highlightHost.ts`), each instance's box read off its shape's `ink`; `DisplayChrome` places all three guides, and `renderDisplaySvg` exports the legend, the axis and the pinned highlight — a hover, a selection and a solo are live-session UI, a pin is what the figure is about | whole, for the displays that declare |
| layer | marks composed in z-order over shared scales | `marks[]` in config is draw order; every drawing mark folds into the display's one y domain, ggplot2's one-scale-per-aesthetic rule ([ADR-141](../architecture-decision-records/adr-141-one-y-scale-the-displays.md)); a mark's `minBpPerPx`/`maxBpPerPx` is the zoom range it draws in, and the domain, legend and row count fold only the marks drawing | y is the plot's, colour and glyph are each mark's; semantic zoom per layer; the display's `facet` splits the features before every mark's steps and stacks one section of rows per value, with a chip |
| coordinates | a transform of the plane | genomic x along a strip, and the circular view's ring pass over it: the view is a `RegionHost` whose axis is the circumference, a display renders its strip as into a linear track, and one pass per ring resamples the strip's canvas in polar coordinates (`plugins/circular-view/src/rings/`, [ADR-119](../architecture-decision-records/adr-119-the-circular-view-is-a-coordinate-stage-over-the-linear-displays.md)) | polar, as a resampling of the finished picture rather than a twin per shape — measured at 4.3 ms a ring against 5.4–6.8 ms for the twin, exact at every bin width; the dotplot stays a display |

The encoding — field to channel, evaluated once — is the grammar's central
idea and the tree has it as one loop. Four packers that were hand-written
spellings of it call it now: the mark display, Manhattan, the example plugin
and wiggle's array-less fallback ([MARK_ENCODING.md](MARK_ENCODING.md) §"A
reader in a channel's place"). Canvas's `packRenderArrays`
(`plugins/canvas/src/RenderFeatureDataRPC/packRenderArrays.ts`) is the one
hand-written packer left and stays that way, measured
([ADR-114](../architecture-decision-records/adr-114-canvas-keeps-its-hand-written-packer.md)).
It fans one feature out into three primitive families over 29 typed arrays,
and the encoder has a channel for 12 of them: the other 17 are a renderer's
instance struct — heights, strands, chevron directions, deferred colour
classes, label rows, child ordinals — not channels of a grammar. The same
primitives through `flatten` and `encodeFeatures` measured 3.11x the packer
with five lanes filled, and the packer is 11% of the worker's per-region
compute against the glyph emitters' 58%. The fan-out did land as a transform:
`flatten` is a step kind, and the packer is not its consumer. The multi-row
display's worker walk
(`plugins/canvas/src/MultiRowGetFeaturesRPC/packMultiRowFeatures.ts`) is not
a packer in this sense: it ships each feature's start, end, colour and
partition value, and the display encodes its span channels on the main thread
over those arrays (`buildMultiRowChannels`), so a reorder, a recolour or a
hidden category re-encodes with no RPC. An encode over typed arrays has
nothing for `encodeFeatures` to read.

**The layout steps went the same way, and the audit is the record.** Every
place a format-typed display assigns a row to an interval, bins a position or
measures depth was classified against `pileup`, `bin` and `coverage`
([ADR-118](../architecture-decision-records/adr-118-the-packers-share-a-rule-not-a-step.md)
has the table with file and line ranges). One entry runs a rule a step
reproduces — a plain uncapped single-region pileup is `pileup` with
`padding: 2`, row for row, which
`packages/core/src/util/featureTransforms.test.ts` now pins against
`placeRect` — and porting it measured 4.23x, all of which is the `Feature[]`
the step reads and answers rather than the packing. Every other
packer runs the same rule over inputs a step has no way to be told: label
overhang widths and strand-arrow padding in canvas's `packRef`, isoform caps,
row caps resolved against the viewport, regions grouped by refName before
packing, a layout seeded from the previous frame's rows. So `pileup` is what
makes a read pileup declarable over any adapter the mark display attaches to,
and that is a different sentence from making the alignments pileup declarable.

## Integrity: what holds the implementation to itself

The claim the tree can make that the grammars cannot is **parity, pinned**.
A shape's painter, its shader and its hit test are held to each other by
`sweepMarkAgainstHit` (`packages/render-core/src/marks/drawAgainstHit.ts`):
every pixel the painter inks answers the instance it belongs to, in both
orientations, and the box a shape declares as its `ink` is within a pixel of
what it painted. A legend cannot list a colour nothing painted, because it
reads the table the worker packed the colours from. An axis cannot label a
value the renderer places elsewhere, because the mixin derives the ticks from
the declaration the shader's uniforms are written from. A highlight cannot
box a place nothing painted, because it reads the same `ink` the hit test is
derived from. Each guide has one source, and each source is tested against
its consumer. The two backends are held to each other in a browser as well:
the cross-backend gate's `Mark Display` suite
(`products/jbrowse-web/browser-tests/suites/mark-display.ts`) renders nine
`marks` configs — a categorical bar chart with its key and axis, a glyph
scale, a stacked pileup over a BAM, two axes, a multiscale pair, a
quantitative ramp, a variant strip and a pileup faceted by mismatch count — on
Canvas2D and WebGL and blocks CI past 1.5% drift. Its first run found two
fractional-pixel drifts nothing on jsdom could see, a span row height of
`canvasHeight / rowCount` and the
Canvas2D seam between abutting bars, at 1.93% and 4.07%; closed, the ramp is
the CI scope's worst pair at 0.91%, against a 1.5% threshold
([CROSS_BACKEND_GATE.md](CROSS_BACKEND_GATE.md) §"What made a blocking gate
possible" has the 2026-09-12 distribution, which predates the ninth scene).
The same pass looked at the chrome-placed key and axis in a real browser for
the first time and found the ramp key printing an unpinned domain end as the
float it was measured as —
Hi-C's `24.429380416870117` against a `0` with no gap — which is why a ramp's
ends now print through `formatScore`, the rule the score caption already used.

The seams, named honestly:

- **A colour or glyph scale is declared on its channel; the value scale is the
  plot's.** `encoding.color` and `encoding.glyph` carry
  `{ field, scale, domain, ... }`, and a positional channel is a bare field:
  `scales.y` is the one scale every `encoding.y` is read through, the score
  menu writes into it, and `ScoreAxisMixin` derives the ticks and the
  cross-hatches from it
  ([ADR-141](../architecture-decision-records/adr-141-one-y-scale-the-displays.md) for the mark display, [ADR-142](../architecture-decision-records/adr-142-one-value-scale-object.md) for the
  wiggle family, Manhattan and the coverage band, narrowing
  [ADR-113](../architecture-decision-records/adr-113-one-scale-rule-in-one-place.md)).
  Where a scale resolves still splits by cardinality, and rightly: a
  categorical colour is data and travels packed with the instance, while a
  domain that moves on every autoscale must not touch a buffer
  ([ADR-097](../architecture-decision-records/adr-097-the-y-channel-shares-its-scale-and-not-its-anchor.md)).
  The four score-axis displays that are not the mark display keep their axis
  in those slots, which is what the hook's default answers.
- **Two channel vocabularies remain.** The encoder and the three shared
  shapes say `x`, `x2`, `y`, `row`, `color`, `glyph`. Variants' cell
  (`plugins/variants/src/LinearMultiSampleVariantDisplay/components/cellMark.ts`)
  says `startEnd` and `row`; canvas's rect
  (`plugins/canvas/src/LinearBasicDisplay/marks/featureGlyphShapes.ts`) says
  `startEnd`, `y`, `height`; the variant matrix's cell
  (`plugins/variants/src/LinearMultiSampleVariantMatrixDisplay/components/matrixCellMark.ts`)
  says `featureIndex`, `row`, `color`, its x a column index over equal
  columns rather than a bp. Converging the first two is not the small move it
  looks: ADR-106 §Consequences measured the `startEnd` split and parked it,
  because that array IS the worker payload — 18 modules and some 35 tests
  address it by `2i` — so it is a payload and instance-struct change across
  two pipelines, waiting on a consumer that wants two arrays; and canvas's
  `y`/`height` are pixel geometry rather than the value `y` names elsewhere,
  so renaming them converges nothing. The third is a different x. The
  alignments pileup
  (`plugins/alignments/src/features/pileupShape.ts`) is on the mark list but
  keeps its rule codes as data, for a measured reason.
- **The config rung covers one class, less the two it reaches now.** A `marks`
  entry draws a bar, point or span over any feature adapter, which is the
  quantitative class ADR-107 reopened, and the display attaches to
  `AlignmentsTrack` and `VariantTrack` beside `FeatureTrack`, so a declared
  pileup over a BAM and a stacked strip over a VCF are config
  ([ADR-115](../architecture-decision-records/adr-115-one-mark-may-read-its-own-axis.md)).
  What those tracks' own displays hold that this one cannot say is still the
  gap: a read's mismatches, a callset's genotypes, a gene's isoform tiering,
  synteny's two coordinate systems. That is a position
  ([SESSION_SPEC_FORMAT.md](SESSION_SPEC_FORMAT.md) §"The assessment": what
  those displays hold is layout, tiering and fetch shape, not channels), and
  it is still the widest gap between what the tree calls a grammar and what
  one is. ADR-118 measured the layout half of it and the position held: the
  rule those displays pack by is the step's rule, and everything they pack
  *with* is the display's own.
- **A reader channel is where "declared" ends.** Manhattan's LD colouring
  joins each feature against a second adapter through a function
  (`plugins/gwas/src/ManhattanRPC/makeLdEvaluator.ts`) the encoder takes in a
  channel's place. The config spells it as a field, `color: { field: 'ld' }`
  ([ADR-135](../architecture-decision-records/adr-135-the-colour-objects-share-one-shape-and-a-preset-is-a-field.md)),
  which is what it is in the grammar — a variable prepared before the plot —
  but the reader behind the name is a join, not a declaration, and the
  grammar has no equivalent. Every display with a meaning the encoding cannot
  say will look like this.
- **The colour objects are one shape, and a preset is a field.** FeatureColor,
  ManhattanColor, RibbonColor, MarkColor and AlignmentsColor are each
  `{ value, field, scale, domain, domainMin, domainMax, domainMid, range,
  scheme, reverse }`, spelt as Vega-Lite spells a scale and as `scales.y`
  already did, from display-kit's pieces (`colorChannelSlots`,
  `colorDomainSlot`, `colorRangeSlot`, `colorRampSlots`,
  `colorDomainEndsSlots`), `scale` drawn from
  `none | categorical | linear | log | threshold`
  with each display declaring the members it paints; `none` is ggplot2's
  set-versus-map distinction (a parameter beside `aes()` creates no scale),
  and a field left without a scale takes the kind its display declares for the
  field (`paintedScale`), never one read off the data or off which other
  member is written. One function turns every display's object into what it
  paints, `colorEncodingOf` (`@jbrowse/display-kit/colorConfigSchema`),
  answering the `ColorEncoding` the encoder takes, so a painter reads the
  scale that was resolved rather than the object's slots
  ([ADR-153](../architecture-decision-records/adr-153-every-display-resolves-its-colour-through-one-function.md)):
  the mark display and the canvas feature, multi-way and synteny colours answer
  `categorical`, Manhattan `threshold` over `field: 'ld'`, the quantitative
  display `categorical` over `source` and `threshold` over `score`, and the
  alignments displays `threshold` over the two insert-size fields.
  `range` is one output word for every kind, a palette, a threshold's colours
  or a ramp's stops, and `scheme` a named ramp from one table every baker
  reads. `threshold` is ggplot2's `scale_colour_steps`: ascending cut points in
  `domain` and one `range` colour more, so a value takes the bin it falls in
  (`thresholdIndex`, `@jbrowse/core/util/thresholdScale`). The quantitative
  display is the exception: its layers part into two sides of one value, so it
  paints the first cut and the first two `range` colours, and neither paints
  nor keys a second cut
  ([ADR-144](../architecture-decision-records/adr-144-one-colour-object-on-the-quantitative-display.md)
  §"Rejected alternatives").
  The ribbon's `strand`, `identity`,
  `mappingQual` and `dnds` are fields with a vocabulary or ramp of their own,
  as synteny-core's `continuousRampConfig` keys them
  ([ADR-135](../architecture-decision-records/adr-135-the-colour-objects-share-one-shape-and-a-preset-is-a-field.md)).
  `paintedField` (`packages/synteny-core/src/syntenyColorBy.ts`) reads the
  field out of a colour object, and the field is what the colour functions,
  legends and menus dispatch on — there is no mode vocabulary beside it.
  What stays local: a field under `none` is the menus' switch-back memory,
  which ggplot2 has no place for since a plot specification is a value.
- **The pileup declares two colour channels and keeps its painters.** `color`
  fills the reads — a read dimension under the facet's own name, `tags.XX` a SAM
  tag
  ([ADR-148](../architecture-decision-records/adr-148-the-alignments-read-fill-is-the-colour-object.md))
  — and `baseColor` names the per-base variable drawn over them
  (`modifications`, `bisulfite`, `baseQuality`, `base`), the layer stage's two
  marks with a channel apiece
  ([ADR-149](../architecture-decision-records/adr-149-the-per-base-layer-is-its-own-colour-object.md)).
  A modification layer still owns hue at base grain: mismatches draw grey
  under it, whatever fills the reads.
  The painter was already the grammar's: `readColorCategory` derives one
  categorical variable per read — `insertSizeAndOrientation` a `case_when` with
  the mate and split overrides as further levels — and both backends index one
  table by its level, which is how GenomeSpy resolves a categorical colour. A
  declared `domain`, `range`, `linear` ramp or `threshold` evaluates where the
  tag colours already bake, once per read after layout, so it costs no fetch,
  no layout and no per-frame work. The mismatch and modification marks stay
  tables too: a key into a colour table (the base byte; the modification's type
  index) with an opacity lane beside it (base quality; call probability), which
  is GenomeSpy's `color: { field: 'base' }, opacity: { field: 'baseQuality' }`
  spelled as `Paint` and `Fade` codes over typed arrays.
- **A view-level colour is the plot-level `aes()` every layer inherits.** The
  linear synteny and dotplot views' `colorBy` is the same `SyntenyColor`
  object the multi-way display holds per layer as `ribbonColor`, with the
  structural variables as fields — `strand`, `query`, `target`, `reference`,
  `track` — beside the presets and the declared columns
  ([ADR-139](../architecture-decision-records/adr-139-the-synteny-views-colorby-is-the-colour-object-every-band-inherits.md)).
  ggplot2 has `inherit.aes`; here every band reads the view's object through
  `TrackColorsMixin`. Which fields a surface offers is its menu's list; a
  field with no reader behind it falls through to the surface's own colour.
- **A scale table is per fetched region, and the quantitative ones are
  unioned.** The grammar resolves a scale over the whole dataset; the worker
  sees one region. A categorical entry is a function of the value and the
  declared domain (`categoricalScale`, `packages/core/src/ui/colors.ts`), so
  regions agree without a round trip; a value the domain leaves out hashes
  into a slot no listed value holds, where resolving it by the region's own
  sorted rank had one value painting two colours across a pan. A quantitative ramp ships its raw values and the
  region's extent instead, and the display unions the extents into one domain
  the shapes read as a uniform (ADR-113), so an unpinned ramp agrees across
  the loaded regions and a pan that widens it uploads no instance bytes. What
  remains is the dataset beyond the view: a value in no loaded region has
  never been seen, so the domain still grows as the user pans. That is the
  design and not a seam
  ([ADR-124](../architecture-decision-records/adr-124-the-score-axis-autoscales-over-what-is-loaded.md)):
  a pinned `domain` is what fixes a legend for a figure, and the Score menu's
  "Pin current min/max" writes it from what is drawn. The feature display's
  categorical counterpart is "Pin distinct colors" (`pinColorDomain`), which
  appends every value its key's rows list to `color.domain`, since two
  unlisted values can hash onto one colour — and a row sharing a colour
  between two values pins both, which is what makes them distinct.
- **A categorical key is derived in one place, from the colours themselves.**
  `derivedColorScale` (`packages/core/src/util/legendCandidates.ts`) is the
  derivation every channel-backed key runs: the union over the loaded regions,
  one row per distinct colour naming every value painted in it
  (`CategoricalEntry.values`, the label joining their names in the field's
  order, `value` the first as the row's id), rows ordered by the channel's
  `domain`, and dropped where `legendIsReadable` says the rows would say
  nothing. ggplot2 derives the same rows from a scale's breaks, so two levels
  mapped to one colour are two rows with one swatch; here the hide toggle
  hides by colour, so they are one row with two names
  ([ADR-136](../architecture-decision-records/adr-136-a-legend-follows-its-scale-and-a-colour-slot-is-a-colour.md)).
  The canvas feature display hands it the candidates its
  worker walk recorded with a section stamp apiece, so a hidden section's
  colours leave the key; Manhattan hands it the entries of the scale table
  `encodeFeatures` resolved; synteny and the mark display map their own
  resolved tables — already in their channel's order, and the mark's rows
  carrying a glyph swatch — but place the rows through the same
  `legendSpecOf`. The multiway lane glyphs' `color` is the `FeatureColor`
  object, so a field there hands the union the values its packer filed each
  mark under (`laneFieldKey`), `cluster` among them. Two keys stay outside
  it and both are the same exception: the multi-row feature display's, which
  reads colours off `itemRgb` and per-feature `jexl:`, and the multiway lane
  glyphs' under a `jexl:` `value` (`laneColorKey`), so there is no channel
  behind them to carry a field name or a domain. They still run the union's
  rule — a row IS a colour, named by every feature value carrying it. **A value-less feature files under the empty key `''`**, which
  the one comparator already places after every value, so the worker tables
  and the candidates carry no flag for it; the key's `missing` row is derived
  from that key where the row is made. What a value-less feature paints
  is `NO_CATEGORY_COLOR`, one grey across the encoder, the feature display and
  synteny's unlabelled rows; `#808080` beside it is the misconfiguration
  colour — a `jexl:` colour that yielded a non-string, a ramp value that is
  not finite, text a feature threshold reads that is no number — and means
  something else.
- **A feature threshold is a categorical field over its bins.** The canvas
  feature and multi-way gene colours take `threshold` beside `categorical`,
  and `thresholdField` (`@jbrowse/core/util/thresholdScale`) reads it through
  the same interface `categoricalField` answers: a value files under its bin's
  label, so the worker's walk, a transcript's parts inheriting its value and
  the derived key take it unchanged. Its domain is `closed`, and once anything
  painted, `derivedColorScale` lists every bin of a closed domain, as
  Manhattan's, the alignments' and the LD keys list theirs; the no-value and
  not-a-number rows still appear only once painted.
  `colorFieldOf` answers either field, while `categoricalColorField` and the
  canvas display's `colorField` stay categorical, for the facet, Group by and
  "Pin distinct colors", which would write values into the cuts
  ([ADR-156](../architecture-decision-records/adr-156-the-feature-colour-takes-a-threshold.md)).
  The mark encoder files the same two keys beside its interval lookup: a
  value-less feature paints the no-value grey and text that is no number the
  misconfiguration grey, each a row of the key once painted.

## The facet stage

A row facet — split the features on a field's value, stack one section per
value, name each with a chip — is answered four times, all from one `facet`
object, `"strand"` or `{ field, domain }`
(`packages/display-kit/src/facetConfigSchema.ts`,
[ADR-131](../architecture-decision-records/adr-131-a-categorical-channel-is-one-config-object.md)):
the feature display's "Group by..." (`plugins/canvas/src/LinearBasicDisplay/facet.ts`),
the mark display's facet, the multi-sample variant displays' row banding and
the alignments displays' sections, where a read dimension (`pairOrientation`,
`splitRead`, ...) and a tag (`tags.HP`) are fields too
(`plugins/alignments/src/shared/groupFeatures.ts`).

**The mark display's facet is the grammar's**
([ADR-130](../architecture-decision-records/adr-130-a-facet-is-the-displays-and-splits-before-each-layers-steps.md)).
The display's own `transform` runs, the facet splits what it answers, the
facet's own `transform` runs over each section alone, and each mark then runs
its own steps over each section (`facetLayers`,
`packages/core/src/util/featureTransforms.ts`), so a faceted display is the
unfaceted one drawn once per section — a `pileup` packs each section on its
own, a `coverage` counts each section's depth, and a rowless mark stands in
the rows the last `pileup` before its encode wrote, the facet's shared by
every mark or its own, and on each section's first row where none did. That
is Vega-Lite's facet spec `transform`, the shared per-panel stat ggplot2
computes per layer. A `pileup` in the display's `transform` runs before the
split and packs across every section, leaving each section the rows the
others fill, which the validator says (`cross-section-packing`).
`featureTransforms.test.ts` pins the per-section equivalence. The
main thread folds the regions' section tables into one layout
(`plugins/marks/src/LinearMarkDisplay/facet.ts`): the cap over every region's
keys, the domain's order, the hidden sections gone from the drawn layers and
their hit index, and the key and the value axis read off what is drawn.

The shared rules are the key, the order and the cap. Every channel keys,
orders and names a value through `categoricalField` (below), and
`capGroupKeys` (`packages/core/src/util/groupKeys.ts`) merges the tail past
`MAX_GROUPS` by the key set alone, in natural order. **A domain orders and
never decides which sections exist**, so no worker request carries one and a
reorder refetches nothing: the listed values stack first, the rest follow
sorted, and a listed value the data lacks takes no section. The multi-row and
multiway synteny displays' `domain` slots, every display's `facet.domain`
and the colour and glyph channels' legend order are that one word and rule
(`groupKeyComparator`); a key over the facet's own field lists its rows in the
sections' order. Three of the four tree-sidebar displays (MAF and the two
multi-sample variant ones) share the word as a `domain` row-order slot, read as
`rowDomain` and applied under `layout`; the quantitative display takes its row
order off `rows.domain` instead, the object that also holds its labels, tree
and focus, because its own `domain` is the score axis (ADR-157). Their unlisted
rows keep the order they arrived in (`orderRowsByDomain`), since a phylogeny's
leaf order and a file's sample order mean something, and where a tree describes
the rows the domain rotates it as far as the topology allows
(`rotateNewickByDomain`, ggtree's `rotate`) rather than costing the dendrogram. The runtime half is one menu,
`sectionOrderMenuItems` in `groupByMenu.ts`, whose move writes the whole drawn
order back as the domain (`mergeDomain`); a re-pick of the same grouping keeps
the domain (`carryGroupDomain`); the chips are `GroupLabelChips.tsx`, and the
hidden sections with their key-space reset `HiddenGroupsMixin.ts`.

**Edit as JSON...** in the feature display's Group by and Color by attribute
dialogs is an editor over the display's two settings and the filter override:
`{ facet: "strand" | { field, domain }, color: "css" | { field, domain, range }, filter }`.
`@jbrowse/display-kit/channelSpec` parses the text through
`preProcessConfigSnapshot`, the two objects' own lift and checks, so the box
refuses what a config file cannot hold, and a spec naming no field or colour
besides; a `color` whose `scale` is `none` beside a field reads as its
constant, since the dialog has no dormant-field spelling; the dialog hands `facet` and
`color` to `applyDisplaySettings` and `filter` to `setJexlFilters`. The Group by dialog writes the same two settings
through `setFacet` and `setColorScale` (`groupByChannelSpec`).

**Every categorical channel reads its field through one object**,
`categoricalField(field, { domain, range })`
(`packages/core/src/util/categoricalField.ts`): `key` files a value, `compare`
orders keys, `label` and `sectionLabel` name them in a key and on a chip, and
`color` paints them. The facets, the encoder, the canvas worker's colour walk
and every derived key construct one, so a value keys, orders, names and paints
the same way wherever it is read. A field with a vocabulary of its own carries
it there as data: `strand` files a missing strand as `0`, orders forward,
reverse, unstranded, names each and paints red, blue and goldenrod, each
yielding to a declared `domain` or `range`. Only a facet on another field has
the canvas worker stamp a key on each feature, so a strand facet never
refetches. The canvas worker paints a part in its transcript's value (the
emitter passes the level) and records each key it painted with the section its
record files under, which `derivedColorKey` hands `derivedColorScale` as the key
less the hidden sections.

The facet replaced a `frozen` `groupBy` slot,
`{ type: 'strand' | 'attribute', attribute, domain }`, that the spec translated
to and from, and the alignments displays' `groupBy` of the same shape. Why the facet and the colour are one config object each rather than flat
slots, and the flat spelling's one-day life, is
[ADR-131](../architecture-decision-records/adr-131-a-categorical-channel-is-one-config-object.md).
One proposal was declined in review: filter shorthands such as
`{ field, oneOf }` (jexl is the filter language, and reading structure back out
of jexl is the fragile half).

The multi-row display's `rows` is the same partition with one fixed row per
value and no chip. What the mark display does not take is the
alignments display's per-section collapse, which is that display's lane budget
rather than a facet's.

## The row panel, against ggtree and react-msaview

The four displays with the dendrogram sidebar (`packages/tree-sidebar`) share
a layout ComplexHeatmap states outright: a body, and beside it marginal
annotations that each read a field of a row table. ggtree draws the same
picture with the tree as the body and `gheatmap`, `msaplot` and `facet_plot`
as the panels; react-msaview (`~/src/react-msaview`, whose panels-and-marks
idea works the same correspondence from its side) names it the other way
round, the alignment as the body and the tree as
the first row panel, and its `rowData` table is what every row panel reads.
Here the rows are samples, species or subtracks, the tree is the sidebar, and
the row table is the discovered rows arranged by the display's `rows` object.
The table is the correspondence, so a proposal on
the sidebar can be read against both libraries before it is spelled.

| Notion                             | ggtree                                             | react-msaview                                          | The tree sidebar                                                                                                                                                                                    |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The tree                           | data, given                                        | the `tree` prop, given                                 | computed (`runClustering`, `rows.tree`, `rows.treeProvenance` naming the locus and settings), or given (MAF's guide `.nh`)                                                                          |
| A row's data                       | `%<+%` attaches a table keyed by tip               | `rowData`                                              | the adapter's sources: a samples TSV's columns, a subtrack's metadata                                                                                                                               |
| Declared row order                 | `ladderize`, then `rotate` / `flip` on a clade     | tree order                                             | `rows.domain` (`rowDomain` on the model, since the wiggle score axis owns `domain`): the rows listed first, the rest in the file's or adapter's order, or sorted on the multi-row display; with a tree it rotates instead — `[B,C,D]` on `((A,B),(C,D))` gives `B,A,C,D` — so the dendrogram keeps drawing |
| Arranged row order                 | —                                                  | —                                                      | `rows.domain`, `rows.labels` and `rowColor`, written by drag, the arrangement dialog, a clustering run and sort-at-column; "Reset row order" returns them to the config's                                    |
| Order at one column                | —                                                  | —                                                      | `sortRowsBy` and the right-click "Sort rows by … here", ComplexHeatmap's `row_order` from one column                                                                                                |
| Focus on a clade                   | `viewClade`, `tree_subset`                         | —                                                      | `rows.kept`, a row-name set                                                                                                                                                                     |
| Bands by a field                   | `groupOTU`, then a facet                           | —                                                      | the variant displays' `facet`, resolved over `layout` when the rows are read — so a cross-band drag snaps back, and the band yields while a cluster tree describes the rows, as the multi-row display's `rowGroups` partition does |
| Row colour by a field              | `aes(color = field)` over the attached table       | `scale_row_color(field, channel)`                      | the variant displays' `colorBy` (a metadata column), resolved on the read and winning over a `labelColor` the row table holds; the multi-row display's `rowColor` pairs are the explicit map and `rowGroups` the match-to-group form |
| Row labels                         | `geom_tiplab`                                      | tip labels                                             | `showRowLabels`, `colorRowLabels`                                                                                                                                                                   |
| Branch lengths                     | `branch.length = "none"` for a cladogram           | —                                                      | `showBranchLength`                                                                                                                                                                                  |
| Collapse a clade                   | `collapse` / `expand`                              | `clades` with `mark: "collapse"`                       | —                                                                                                                                                                                                   |
| Highlight or bracket a clade       | `geom_hilight`, `geom_cladelab`, `geom_strip`      | `clades` with `mark: "highlight"` / `"bracket"`        | —                                                                                                                                                                                                   |
| Node labels, support values        | `geom_nodelab`                                     | parsed, not drawn                                      | —                                                                                                                                                                                                   |
| Further row panels                 | `gheatmap`, `facet_plot`                           | `rowPanels` with `strip`                               | —                                                                                                                                                                                                   |

The four empty cells on the sidebar's side are each a mark or a guide over
the row axis in the vocabulary above, and none is a new channel.

## Gaps against the grammar

- **`window` and `sample` are absent**, and a BigWig's summary tiers are the
  adapter's: the mark display reads them at the view's zoom and a config
  names `score`, `minScore` or `maxScore` off what comes back
  ([ADR-123](../architecture-decision-records/adr-123-a-mark-reads-a-bigwig-at-the-rungs-floor.md)).
  The bin-width gap closed:
  [ADR-117](../architecture-decision-records/adr-117-the-density-tier-is-a-mark-layer.md)
  gives `bin` a `step: "auto"` that follows the view's `bpPerPx`, resolved
  before the RPC and keyed into the fetch on a 1/2/5 ladder — four pixels of
  bp per bin, snapped up — so a zoom inside a rung refetches nothing and a
  1,600x sweep in 64 steps costs 11 refetches. GenomeSpy's `multiscale`
  spells the same idea with `stops`.
- **Scale resolution across layers: y never resolves independently, a
  categorical colour shares by construction, a ramp does not share.** The
  display owns one y scale and every drawing mark folds into it, which is
  ggplot2's rule and which withdrew the `resolve: 'independent'` second axis
  ([ADR-141](../architecture-decision-records/adr-141-one-y-scale-the-displays.md)).
  The form for a config that does want two quantities in one display is a
  stacked band per mark with a free y, drawn through `ValueScale.bandTops`,
  and nothing is built for it. Two marks colouring or glyphing by one field through one domain
  and palette share one key section — `buildMarkLegend` keys a section on the
  declaration rather than the mark, the way ggplot2's `ScalesList$add_defaults`
  keeps one scale per aesthetic across layers and `Guides$merge` folds
  matching guides — and any difference in the declaration keeps them apart
  ([ADR-136](../architecture-decision-records/adr-136-a-legend-follows-its-scale-and-a-colour-slot-is-a-colour.md)),
  a colour's `title` included, since ggplot2 merges only guides titled alike.
  A ramp pinned at both ends is its declaration too, and marks declaring one
  alike share its key. Two marks with two open ramps over one field still
  union nothing and each key is its own: the domain is a uniform each mark's
  shaders read off its own loaded values, so sharing it is a rendering change
  to measure, not a legend change.
- **A reference line is the scale's, so it has no zoom range.**
  `scales.y.rules` and `scales.y.title` are members of the one value scale
  ([ADR-142](../architecture-decision-records/adr-142-one-value-scale-object.md)
  §Consequences). A multiscale pair shares that scale, so a rule written for
  the raw mark's quantity draws over the binned mark's too; ggplot2's
  `geom_hline` is a layer, which here would carry `minBpPerPx`/`maxBpPerPx`,
  and nothing is built for it. A title is opt-in and holds at every zoom
  (ADR-142 §"Amended 2026-09-21"), and a faceted plot's axis is titled once
  beside its bands, as ggplot2's is beside the panel stack.
- **No conditional encoding.** Hover and selection are a guide over the
  painting, not a `condition` on a channel: a display names the lit
  instances and the chrome boxes their ink
  ([ADR-110](../architecture-decision-records/adr-110-a-display-declares-what-is-highlighted.md)).
  GenomeSpy does it in-shader with a selection predicate; here that would be
  a uniform the shape reads, and the Canvas2D fallback would repaint the
  whole display per mousemove for it, which is the measurement that keeps
  the highlight a div.
- **Fewer channels.** `size`, `opacity` and `angle` are uniforms, not
  channels, because shapes are compiled from hand-written Slang rather than
  generated from the encoding. That is ADR-095's trade, and it holds until a
  second in-tree consumer wants one; `opacity` also breaks the Canvas2D
  painters' colour batching.
- **The coordinate stage is a resampling, and it reaches the displays that
  read the `RegionHost` contract.** A ring is the display's strip warped,
  which is exact in angle and minifies an inner ring by `inner / ruler`, and
  a display that reads the linear genome view itself rather than its host —
  the alignments pileup — has no ring; its coverage on the circle is the mark
  display's `coverage` step. There is one polar transform and no other, and
  the strip past `maxCanvasCssPx()` scales down rather than tiling.

## Against GenomeSpy and Gosling

Compared on 2026-09-21 with GenomeSpy v0.88.1 (2026-09-16) and Gosling 1.0.5
(2025-07). On features the mark display covers roughly half of GenomeSpy's
vocabulary; its lead is the browser around it and scaling past the fetch budget.

| | JBrowse marks | GenomeSpy v0.88 | Gosling 1.0.5 |
| --- | --- | --- | --- |
| Marks | bar, point, span | rect, point, rule, tick, text, link, arrow | point, line, area, bar, rect, text, links, rule, triangles |
| Channels | x, x2, y, row, color, glyph | adds y2, size, opacity, stroke, angle, text, tooltip | adds ye, size, opacity, stroke, text |
| y scales | linear, log | 13 kinds, incl. symlog and sqrt | none on y |
| Named colour ramps | viridis only | the d3 set | — |
| Transforms | 7 | ~27, incl. window, lookup, stack, regexExtract | ~10 |
| y shared across tracks | no | yes, `resolve.scale.y: "shared"` | same `domain` pinned by hand |
| Selections, conditional colour | no | yes, compiled to shaders | hover/select styles only |
| Legend title / axis title | yes / yes | yes / yes | yes / no |

GenomeSpy is the comparison that matters; Gosling's main branch has been quiet
since 2025-12. GenomeSpy has added SVG export (v0.84), a Canvas2D fallback
(v0.85), a WebGPU renderer in development (v0.86) and Python bindings
(`genome-spy-python` 0.4.0, 2026-09-18), so three backends and SVG export no
longer set this layer apart on their own. What still does is the sweep that
holds each shape's painter, shader and hit test to each other
(`sweepMarkAgainstHit`) and the CI gate that compares the backends.

The gaps a user meets first, in order:

1. **No shared y across tracks.** `dtu`, `hic_structural_variants` and
   `sv_multisamples` fake one by pinning the same ends by hand, and withdrawing
   the second axis (ADR-141) sends two-quantity plots to two tracks. The fix sits
   above the display: tracks naming one scale group autoscale together, which
   wiggle and coverage would use too.
2. **No `y2` channel**, so no error bars, intervals or a BigWig's min/max
   envelope; a mark reads `minScore`/`maxScore` (ADR-123) but draws them as two
   point sets. A range bar is the smallest channel with the widest reach.
3. **No text mark**, for labelling a peak, an SV or a gene on a plot.
4. **A thin colour and scale vocabulary.** One named ramp
   (`COLOR_SCHEMES = ['viridis']` in `packages/core/src/util/colorSchemes.ts`),
   and symlog, which the shared scale object and wiggle already have, is not a
   mark type.
5. **In-app authoring stops at one mark.** **Plot field...** writes one mark and
   an optional count per bin, the config editor edits transform steps but not
   marks (`db4ef2f82a`), and the track menu has no facet or colour picker.

A point's `size` is the mark's own, as Vega-Lite's `mark.size` is, and a
constant rather than a channel (ADR-095); `origin` is the display's rather
than a mark's, and no mark declares its own tooltip fields. Line and area marks stay
out ([ADR-127](../architecture-decision-records/adr-127-line-stays-wiggles.md)),
and so do format-specific displays rebuilt on the grammar (ADR-114, ADR-118).

## What the tree does that the grammars do not

- **Every channel evaluation is measured**, and the escape is priced: a
  `jexl:` channel costs 1.5–2.0x a native field read
  ([MARK_ENCODING.md](MARK_ENCODING.md) §"The jexl channel, measured"), so
  field names are the unit and jexl is opt-in per channel.
- **A lane is filled because a shape reads it.** The encoder allocates and
  transfers only the lanes the caller names, and builds a hit index only for
  a caller that hovers; wiggle's fallback runs at 0.33x the full encode for
  that reason.
- **Pan and zoom write one uniform and no buffer.** GenomeSpy achieves the
  same through scale uniforms; the tree does it with shapes a person can read.
- **Guides derive from scales on both surfaces**, screen and export, from one
  declaration, and a display places neither.
- **The config rung is visible two levels down** to the manifest, the JSON
  schema and the validator, because `marks` and its encodings are typed
  sub-schemas and never `frozen`.
- **Refusals are recorded with the measurement** that produced them, in the
  ADRs' Rejected rows, so a closed question is not reopened by accident.
- **It scales past the fetch budget.** Bins follow the zoom on the 1/2/5 ladder
  in the fetch key, and past the byte budget a density file draws in place of
  the "region too large" banner, which is how chromosome 1's 1.3 million Alus
  draw end to end; GenomeSpy's multiscale switches at fixed zooms and has no
  byte budget.
- **It is a display on the track a user already has**, so the same BAM, VCF or
  BigWig switches between its usual display and a plot, and inherits sessions,
  URLs, the agent API, SVG export and the circular view's ring.
- **The validator reads the plot, not just the JSON**: "reads "mean_score",
  which its steps do not write" and "never draws: minBpPerPx 100 is not below
  maxBpPerPx 10" are beyond a JSON Schema.
- **Clicking a binned bar opens the features inside it.**

## Where a proposal lands

A new channel or scale kind is the encoder's (`markEncodingTypes.ts`) and
needs a shape that reads it. A new guide is a hook on the mixin that owns the
scale and a placement in the two shells; a guide over the painting reads the
shapes' `ink`. A transform is a `type` on `StepSnapshot` and on
`TransformStep`, an arm in `runTransforms`, a member of the `MarkTransform`
union with its own slots and an arm in `stepsOf`, which a test and the compiler
refuse to let disagree
([ADR-150](../architecture-decision-records/adr-150-a-transform-step-is-one-schema-per-type.md)),
measured in `featureTransforms.bench.ts` beside the others — and it needs a `marks` config
that wants it, not a display whose code it resembles (ADR-118). A new shape clears ADR-040's bar with two consumers. A
display that wants the encoding for a meaning it cannot say hands the encoder
a reader and says so at the call. Anything that composes a display stack from
a declaration is what ADR-091 measured and refused. One rule-coded walker
painting every box shape's Canvas2D output is refused too: at 1M instances it
ran 1.09-1.13x the hand painter on span and 1.34-1.46x on variant cells, where
a per-shape copy of the same source ran 0.69-0.94x on all five shapes it
painted.

A box shape places each instance through module-level functions over the
generated twins instead, which, split into an x and a y function, ran
0.93-0.95x the hand painter on span, 0.86-0.89x on canvas rects and 0.98-1.00x
on variant cells at 1M. One `place` call per instance, writing the box that
paint, ink and hit would all read, missed the per-shape copy by 6-10% on rects
and 15-19% on cells, because TurboFan inlines no callee past 460 bytes of
bytecode counting what it has already inlined. Writing the twins' arithmetic
into `place` beat the copy, at 0.87-0.90x on cells and 0.94-0.96x on rects
split in two, and is the hand transcription ADR-051 rejects. Out-parameter
copies of the pair twins read 0.83-0.84x on rects and 1.01-1.06x on cells, and
were not pursued. Every one of those arms is in
`git show 89f3a8ce8b:plugins/alignments/benches/rectWalker.bench.ts`, and
`packages/render-core/benches/placeWalkers.bench.ts` holds each port to the
painter it retired.
