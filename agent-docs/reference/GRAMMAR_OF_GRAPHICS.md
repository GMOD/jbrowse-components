---
name: grammar-of-graphics
description: The mark layer reviewed against the grammar of graphics — which of its seven stages the tree answers and where, the seams, the gaps, and what the tree does that the grammars do not. Read before proposing a grammar feature.
kind: spec
---

# The mark layer against the grammar of graphics

The grammar of graphics is a pipeline: data, transform, scale, mark, guide,
layer, coordinates. This file reads the tree against those stages, names where
each is answered, and lists the seams and gaps. The decisions that built the
layer are ADR-095 §"The grammar position", ADR-106 through ADR-119, ADR-150,
ADR-153 and ADR-162; each position below points at the record that holds its
measurement.

## Two layers, two distances

**The mark layer is nearly everywhere.** A mark is one `defineMark` declaration
binding a shape (a hand-written shader, its Canvas2D painter, hit test and SVG
export, held to each other by `sweepMarkAgainstHit`) to a display's region
payload and render state. Every display holding a mark list builds its backend
from it through `createMarkBackend`, bar the alignments display. That display
keeps its `GpuXxxRenderer` / `Canvas2DXxxRenderer` pair because it draws three
mark lists in scissored bands per stacked section, with uniforms written once
per section (`benches/pileupUniformWrite.bench.ts`) and an upload memo the
generic backend has no home for. The generic backend grows one when a second
display stacks sections (ADR-040's two-consumer bar). Multi-way synteny declares
no marks of its own: `MULTIWAY_MARKS` spreads synteny's and canvas's.
`grep -rlE "defineMark[(<]"` over `plugins` and `packages` is the census.

**The grammar, a config-declared `encoding` and `transform` run through one
encoder, reaches three consumers.** The mark display (`plugins/marks`) gives a
user all seven stages from JSON over any feature adapter, and `AlignmentsTrack`,
`VariantTrack` and `FeatureTrack` may carry it. Manhattan is the mark display
with a default plot, and wiggle's array-less fallback is the other caller of
`encodeFeatures`. Canvas's glyphs, the alignments pileup and variants' genotype
grid hand-wire features into their arrays; wiggle's main path and Hi-C pack the
parser's typed arrays directly. Canvas's packer
([ADR-114](../architecture-decision-records/adr-114-canvas-keeps-its-hand-written-packer.md))
and the pileup's layout
([ADR-118](../architecture-decision-records/adr-118-the-packers-share-a-rule-not-a-step.md))
are measured refusals: both costs come from materialising the `Feature[]`, not
from the rule. [SESSION_SPEC_FORMAT.md](SESSION_SPEC_FORMAT.md) §"The
assessment" holds the position that format-typed displays hold layout, tiering
and fetch shape, which are not channels.

![The grammar's seven stages, and where the tree answers each](diagrams/grammar-pipeline.svg)

## Four rules for how far to take it

**1. The parser's output is the data.** The grammar reads each record where the
parser left it (bbi's typed arrays, a BAM record's bytes, vcf-js's variant)
through a reader resolved once per region. The GPU instance buffer is the one
new representation, and any other copy needs a reason the drawing gives. ADR-152
found that every measured refusal to move a display onto the encoder blamed the
per-row feature object, never the rule. The remaining copies are
[copies-between-each-parser-and-its-instance-buffer](../ideas/waiting-on-a-number/copies-between-each-parser-and-its-instance-buffer.md).

**2. One object per concept, and every surface reads it.** Colour, the value
scale, the facet and the transform step are one object each (ADR-131, 135, 142,
150, 153): the painter, uniforms, legend, axis, menu, dialog, validator, SVG
export and hit test all derive from it. A display that spells one of those
concepts its own way is the finding. The row axis follows it on the multi-row
feature and mark displays (ADR-165). Text follows it in typography only:
`FloatingText` and `SvgHaloText` are the one emit, and placement stays each
display's (ADR-162). Hi-C, LD and MAF resolve colour outside `colorEncodingOf`.

**3. Generality resolves before the loop.** A shape composes its scale at
`gen:shaders` (ADR-095), a field name becomes a direct read before the walk, a
domain rides a uniform, and a lane nobody asked for is never allocated. A
declared form must land at 1.00x the hand-written path or better.

**4. A track stays its format, and the grammar supplies its parts.** The grammar
converges the parts every display shares, not the displays (ADR-091). A new mark
or channel arrives when it retires a hand-written spelling somewhere. A track
type is not always a format: `MultiQuantitativeTrack`, `GWASTrack` and
`GCContentTrack` are role bundles, each a name the guesser returns carrying which
display leads and its `displayDefaults`. The rule refuses a channel hidden inside
a track type, which a bundle of defaults does not carry.

**Colour stays each mark's.** Scale members on each mark's `encoding.color` are
Vega-Lite's own spelling, and marks declaring one alike already share a scale
and a key. A display-level `scales.color` would be a second spelling. Plasma and
turbo are not among the named ramps (plasma reads as magma's sibling, turbo is
not perceptually uniform). HicColor's `reverse`, left unset, follows
`darkAtLowEnd`, since a ramp dark at its low end paints every sparse bin a dark
speck.

## Where the tree answers each stage

| Stage | Where the tree answers | How far |
| --- | --- | --- |
| data | a feature adapter's `getFeaturesArray`, and past the byte gate its `densityAdapter` sidecar as a mark's layer (ADR-117); an adapter with zoom levels is sent the view's `bpPerPx` ([ADR-123](../architecture-decision-records/adr-123-a-mark-reads-a-bigwig-at-the-rungs-floor.md)) | whole; the grammar has no lazy source of its own |
| transform | a typed step list, each step its own schema ([ADR-150](../architecture-decision-records/adr-150-a-transform-step-is-one-schema-per-type.md)), run by `runTransforms` (`featureTransforms.ts`), shared on `CoreGetEncodedLayers` and then each layer's own; `cells` fans a row into per-column runs (`cellsStep.ts`) | whole, layout included; `pileup` is a read pileup's packing as a step, not the format-typed displays' (ADR-118); `window` and `sample` are absent |
| scale | the colour and shape channels carry their own `{ field, scale, domain, range }`, read by `encodeFeatures` (`markEncoding.ts`) and resolved in the worker (categorical) or on the main thread against a domain uniform (quantitative); the value scale is the display's one `scales.y`, which `ScoreAxisMixin` derives the axis from ([ADR-141](../architecture-decision-records/adr-141-one-y-scale-the-displays.md), [ADR-142](../architecture-decision-records/adr-142-one-value-scale-object.md)) | whole, declared in one place |
| mark | `defineMark` over a `MarkShape`, one declaration for three backends, export and hit test (`packages/render-core/src/marks/`); `text` is a DOM layer over the canvas placed by one rule the SVG export shares ([ADR-162](../architecture-decision-records/adr-162-a-text-mark-is-a-dom-layer-placed-by-one-rule.md)) | whole, for the library's shapes; a label answers no hover |
| guide | `colorScales` to legend (`LegendMixin`), `valueScales` to axis and `scales.y.rules` (`ScoreAxisMixin`), `hoverInk` / `selectionInk` / `pinnedInk` / `soloInk` to the highlight (`highlightHost.ts`); `DisplayChrome` places all three, and `renderDisplaySvg` exports the legend, axis and pinned highlight | whole, for displays that declare |
| layer | `marks[]` is draw order; every drawing mark folds into the display's one y domain (ADR-141); `minBpPerPx`/`maxBpPerPx` is a layer's zoom range; the display's `facet` splits features before every mark's steps | y is the plot's, colour and shape each mark's |
| coordinates | genomic x along a strip, and the circular view's ring pass, which resamples the strip's canvas in polar coordinates ([ADR-119](../architecture-decision-records/adr-119-the-circular-view-is-a-coordinate-stage-over-the-linear-displays.md)); chords are marks placed in their own shader ([ADR-177](../architecture-decision-records/adr-177-a-chord-is-a-mark-under-the-circles-polar-stage.md)) | polar resampling of the finished picture; the dotplot stays a display |

**A step names the channel its output feeds**, as a ggplot2 stat names what its
geom draws (`after_stat`): a mark leaving `y` unwritten plots the depth a
`coverage` wrote or the one summary a single-op `aggregate` wrote, a link
leaving `x2` at `end` reaches the other end a `mate` found, and an empty `row`
takes the rows the last surviving `pileup` packed. `stepChannels`
(`plugins/marks/src/LinearMarkDisplay/stepChannels.ts`) is the one reading; the
model resolves it before the request, and the rule list and `jbrowse validate`
read the same function. A written channel wins, and an aggregate writing two
summaries fills nothing.

**Canvas's `packRenderArrays` is the one hand-written packer that stays**
(ADR-114): most of its typed arrays are a renderer's instance struct rather than
grammar channels, and the same primitives through `flatten` and `encodeFeatures`
cost more than the packer. The multi-row display's worker walk ships typed arrays
and encodes span channels on the main thread (`buildMultiRowChannels`), so a
reorder, recolour or hidden category re-encodes with no RPC; an encode over typed
arrays has nothing for `encodeFeatures` to read. Every other packer (label
overhang widths in canvas's `packRef`, isoform caps, row caps against the
viewport, regions grouped by refName, layout seeded from the previous frame) runs
the step's rule over inputs a step cannot be told (ADR-118).

## Integrity

The tree's claim over the grammars is parity, pinned. `sweepMarkAgainstHit`
(`packages/render-core/src/marks/drawAgainstHit.ts`) holds a shape's painter,
shader and hit test to each other: every inked pixel answers its instance, and
the declared `ink` box is within a pixel of what painted. Each guide has one
source and each source is tested against its consumer: a legend reads the table
the worker packed the colours from, an axis derives ticks from the declaration
the shader's uniforms come from, a highlight reads the `ink` the hit test is
derived from. The cross-backend gate's `Mark Display` suite
(`products/jbrowse-web/browser-tests/suites/mark-display.ts`) holds Canvas2D and
WebGL to each other ([CROSS_BACKEND_GATE.md](CROSS_BACKEND_GATE.md)). A ramp's
ends print through `formatScore`, so an unpinned domain end never shows as a raw
float.

## Seams

- **A colour or shape scale is declared on its channel; the value scale is the
  plot's.** `scales.y` is the one scale every `encoding.y` reads, and
  `ScoreAxisMixin` derives ticks and cross-hatches from it (ADR-141, ADR-142,
  narrowing
  [ADR-113](../architecture-decision-records/adr-113-one-scale-rule-in-one-place.md)).
  Where a scale resolves splits by cardinality, rightly: a categorical colour is
  data and travels packed with the instance, while a domain that moves on every
  autoscale must not touch a buffer
  ([ADR-097](../architecture-decision-records/adr-097-the-y-channel-shares-its-scale-and-not-its-anchor.md)).
- **Two channel vocabularies remain.** The encoding says `x`, `x2`, `y`, `row`,
  `color`, `shape`; variants' cell and canvas's rect say `startEnd`. ADR-106
  §Consequences parked converging them, because that array is the worker payload
  many modules address by `2i`; it waits on a consumer that wants two arrays.
  Canvas's `y`/`height` are pixel geometry, so renaming them converges nothing.
  The alignments pileup keeps its rule codes as data, for a measured reason.
- **The config rung covers one class.** A `marks` entry draws a bar, point or
  span over any feature adapter, which is the quantitative class ADR-107
  reopened
  ([ADR-115](../architecture-decision-records/adr-115-one-mark-may-read-its-own-axis.md)).
  What the format-typed displays hold beyond that (a read's mismatches, a
  callset's genotypes, isoform tiering, synteny's two coordinate systems) is
  layout, tiering and fetch shape, and ADR-118 measured that the position held.
- **A join is a field the adapter writes.** `GWASAdapter` joins each SNP against
  its `ldAdapter` when the fetch's `opts` name the index SNP, and writes r² as
  `ld` and the index as `ld_role`. Manhattan's LD colouring is two point marks
  split by a `filter` on `ld_role`. The index SNP is display state.
- **The colour objects are one shape, and a preset is a field.** FeatureColor,
  RibbonColor, MarkColor, AlignmentsColor, VariantCellColor, WiggleColor and
  MultiWayGeneColor each take `{ value, field, scale }` plus whichever scale
  members they declare, assembled from display-kit's `colorChannelSlots`,
  `colorDomainSlot`, `colorRangeSlot`, `colorRampSlots` and
  `colorDomainEndsSlots`. `scale` is one of `none | categorical | linear | log |
  threshold`, each display declaring the members it paints. `none` is ggplot2's
  set-versus-map distinction, and a field left without a scale takes the kind its
  display declares (`paintedScale`), never one read off the data. That
  declaration is the field's preset and may name members too: unwritten members
  take the preset's (`withPreset`), which is how Manhattan's `ld` takes
  LocusZoom's cuts. `colorEncodingOf` (`@jbrowse/display-kit/colorConfigSchema`)
  turns every display's object into the `ColorEncoding` the encoder takes
  ([ADR-153](../architecture-decision-records/adr-153-every-display-resolves-its-colour-through-one-function.md)).
  `range` is one output word for every kind, and `scheme` a named ramp from one
  table every baker reads. `threshold` is ggplot2's `cut()` into
  `scale_colour_manual`: ascending cut points in `domain`, one more `range`
  colour, each bin painting its literal colour (`thresholdIndex`). It is not
  `scale_colour_steps`, which bins an interpolated gradient and repaints every
  declared colour. FeatureColor alone adds `identity`
  ([ADR-166](../architecture-decision-records/adr-166-an-identity-scale-names-the-colours-a-file-carries.md)).
  The quantitative display paints only the first cut and first two `range`
  colours
  ([ADR-144](../architecture-decision-records/adr-144-one-colour-object-on-the-quantitative-display.md)).
  `paintedField` (`syntenyColorBy.ts`) reads the field out of a colour object, and
  colour functions, legends and menus dispatch on it: no mode vocabulary sits
  beside it. A field under `none` is the menus' switch-back memory, which ggplot2
  has no place for. See
  [ADR-135](../architecture-decision-records/adr-135-the-colour-objects-share-one-shape-and-a-preset-is-a-field.md).
- **The pileup declares two colour channels and keeps its painters.** `color`
  fills the reads (a read dimension under the facet's name, `tags.XX` a SAM tag;
  [ADR-148](../architecture-decision-records/adr-148-the-alignments-read-fill-is-the-colour-object.md))
  and `baseColor` names the per-base variable drawn over them
  ([ADR-149](../architecture-decision-records/adr-149-the-per-base-layer-is-its-own-colour-object.md)).
  A declared scale evaluates where tag colours already bake, once per read after
  layout, so it costs no fetch, layout or per-frame work. A modification layer
  owns hue at base grain: mismatches draw grey under it.
- **A view-level colour is the plot-level `aes()` every layer inherits.** The
  linear synteny, dotplot and circular views' `color` is the same `SyntenyColor`
  the multi-way display holds per layer as `ribbonColor`, with the structural
  variables `strand`, `query`, `target`, `reference`, `track` as fields
  ([ADR-139](../architecture-decision-records/adr-139-the-synteny-views-colorby-is-the-colour-object-every-band-inherits.md)).
  A field with no reader behind it falls through to the surface's own colour.
- **A scale table is per fetched region, and the quantitative ones are unioned.**
  A categorical entry is a function of the value and the declared domain
  (`categoricalScale`), so regions agree without a round trip; a value the
  domain leaves out hashes into a slot no listed value holds. A quantitative ramp
  ships raw values and the region's extent, and the display unions the extents
  into one domain read as a uniform (ADR-113). The canvas feature display ships
  distinct field values and an index per box, and paints every scale in its
  main-thread encode over every loaded region
  ([ADR-167](../architecture-decision-records/adr-167-the-feature-colours-scale-resolves-on-the-main-thread.md)),
  so a recolour refetches nothing. The domain still grows as the user pans: that
  is the design
  ([ADR-124](../architecture-decision-records/adr-124-the-score-axis-autoscales-over-what-is-loaded.md)),
  and a pinned `domain` fixes a legend for a figure ("Use current range" writes
  it). "Pin distinct colors" (`pinColorDomain`) is the categorical counterpart,
  since two unlisted values can hash onto one colour.
- **A categorical key is derived in one place, from the colours themselves.**
  `derivedColorScale` (`packages/core/src/util/legendCandidates.ts`) takes the
  union over the loaded regions, one row per distinct colour naming every value
  painted in it (`CategoricalEntry.values`), ordered by the channel's `domain`,
  dropped where `legendIsReadable` says the rows say nothing. ggplot2 would give
  two levels of one colour two rows; here the hide toggle hides by colour, so
  they are one row with two names
  ([ADR-136](../architecture-decision-records/adr-136-a-legend-follows-its-scale-and-a-colour-slot-is-a-colour.md)).
  Each display hands it the entries its own resolved table holds. **A value-less
  feature files under the empty key `''`**, which the one comparator places after
  every value. It paints `NO_CATEGORY_COLOR`; `#808080` beside it is the
  misconfiguration colour (a `jexl:` colour yielding a non-string, a non-finite
  ramp value, text a threshold reads that is no number).
- **A feature threshold is a categorical field over its bins.** `thresholdField`
  (`@jbrowse/core/util/thresholdScale`) answers the interface `categoricalField`
  does: a value files under its bin's label, so the worker walk, a transcript's
  parts and the derived key take it unchanged. Its domain is `closed`, so
  `derivedColorScale` lists every bin once anything painted. `colorFieldOf`
  answers either field; `categoricalColorField` stays categorical for the facet,
  Group by and "Pin distinct colors", which would write values into the cuts
  ([ADR-156](../architecture-decision-records/adr-156-the-feature-colour-takes-a-threshold.md)).

## The facet stage

A row facet (split features on a field's value, stack one section per value,
name each with a chip) is one `facet` object, `"strand"` or `{ field, domain }`
(`packages/display-kit/src/facetConfigSchema.ts`,
[ADR-131](../architecture-decision-records/adr-131-a-categorical-channel-is-one-config-object.md)),
answered by the feature display's "Group by...", the mark display's facet, the
multi-sample variant displays' row banding and the alignments displays' sections.

**The mark display's facet is the grammar's**
([ADR-130](../architecture-decision-records/adr-130-a-facet-is-the-displays-and-splits-before-each-layers-steps.md)).
The display's `transform` runs, the facet splits, the facet's own `transform`
runs per section, then each mark runs its steps per section (`facetLayers`,
`featureTransforms.ts`), so a faceted display is the unfaceted one drawn once per
section. A `pileup` in the display's `transform` runs before the split and packs
across every section, which the validator reports (`cross-section-packing`). The
main thread folds the section tables into one layout
(`plugins/marks/src/LinearMarkDisplay/facet.ts`).

**A domain orders and never decides which sections exist**, so no worker request
carries one and a reorder refetches nothing: listed values stack first, the rest
follow sorted, and a listed value the data lacks takes no section.
`capGroupKeys` merges the tail past `MAX_GROUPS` by the key set alone. The
multiway `domain` slot, every row display's `rows.domain` (read as `rowDomain`,
ADR-157), every `facet.domain` and the colour and shape channels' legend order
are that one rule (`groupKeyComparator`). Unlisted rows keep arrival order
(`orderRowsByDomain`), since a phylogeny's leaf order and a file's sample order
mean something; where a tree describes the rows, the domain rotates it
(`rotateNewickByDomain`) rather than costing the dendrogram. The runtime half is
`sectionOrderMenuItems` in `groupByMenu.ts` writing the drawn order back through
`mergeDomain`, `carryGroupDomain` keeping the domain on a re-pick, and
`HiddenGroupsMixin.ts` for hidden sections.

**Every categorical channel reads its field through one object**,
`categoricalField(field, { domain, range })`
(`packages/core/src/util/categoricalField.ts`): `key` files a value, `compare`
orders keys, `label` and `sectionLabel` name them, `color` paints them. A field
with a vocabulary of its own carries it there as data: `strand` files a missing
strand as `0`, orders forward, reverse, unstranded, and paints red, blue and
goldenrod, each yielding to a declared `domain` or `range`. Only a facet on
another field has the canvas worker stamp a key on each feature, so a strand
facet never refetches.

**Edit as JSON...** in the feature display's Group by and Color by dialogs edits
`{ facet, color, filter }`. `@jbrowse/display-kit/channelSpec` parses it through
`preProcessConfigSnapshot`, so the box refuses what a config file cannot hold.

Declined: filter shorthands such as `{ field, oneOf }`; jexl is the filter
language, and reading structure back out of jexl is the fragile half. The
multi-row display's `rows` is the same partition with one fixed row per value and
no chip; the mark display takes no per-section collapse, which is the alignments
display's lane budget.

## The row panel, against ggtree and react-msaview

The displays with the dendrogram sidebar (`packages/tree-sidebar`) share
ComplexHeatmap's layout: a body, and beside it annotations that each read a field
of a row table. The row table is the discovered rows arranged by the display's
`rows` object, so a sidebar proposal can be read against both libraries.

| Notion | ggtree | react-msaview | The tree sidebar |
| --- | --- | --- | --- |
| The tree | given | `tree` prop | computed (`runClustering`, `rows.tree`, `rows.treeProvenance`) or given |
| A row's data | `%<+%` table keyed by tip | `rowData` | the adapter's sources |
| Declared row order | `ladderize`, `rotate` | tree order | `rows.domain`; with a tree it rotates so the dendrogram keeps drawing |
| Arranged row order | none | none | `rows.domain`, `rows.labels`, `rowColor`, written by drag, dialog, clustering and sort-at-column; "Reset row order" returns to config |
| Order at one column | none | none | `sortRowsBy`, ComplexHeatmap's `row_order` |
| Focus on a clade | `viewClade`, `tree_subset` | none | `rows.kept` |
| Bands by a field | `groupOTU`, then a facet | none | `facet`, resolved over the arrangement; each band draws the clade of exactly its rows (`row_split` with `cluster_rows`) |
| Row colour by a field | `aes(color = field)` | `scale_row_color` | variant `colorBy` over the row table's `labelColor`; the multi-row `rowColor` pairs and `rowGroups` |
| Row labels, branch lengths | `geom_tiplab`, `branch.length` | tip labels | `showRowLabels`, `colorRowLabels`, `showBranchLength` |
| Collapse, highlight, node labels, further panels | `collapse`, `geom_hilight`, `geom_nodelab`, `gheatmap` | `clades`, `rowPanels` | none |

The empty sidebar cells are each a mark or a guide over the row axis in the
existing vocabulary, and none is a new channel.

## Gaps against the grammar

- **`stack` is declined, and so is the min-to-max range bar `y2`.** The stacked
  histogram (`coverage.groupby`, a `stack` step, a bar `y2` lane) was built and
  declined on its captures; the mirror (two bars, a `formula` negating one) and
  the rows form (`rows` over a `coverage`) draw today. Don't re-propose either.
  `median`, quartiles and a weighted `coverage` are absent and wait on a `marks`
  config that wants them; a weighted depth per bin is declarable with a `bin`
  over `fields` and a weighted `aggregate`
  ([ADR-197](../architecture-decision-records/adr-197-a-bin-cuts-an-interval-at-its-edges.md)).
- **`window` and `sample` are absent.** A BigWig's summary tiers are the
  adapter's (ADR-123), and `bin` takes `step: "auto"`, which follows `bpPerPx` on
  a 1/2/5 ladder keyed into the fetch, so a zoom inside a rung refetches nothing
  (ADR-117).
- **Scale resolution across tracks is a group that unions ranges.**
  `scales.y.autoscaleGroup` names a group, and `ScoreAxisMixin.autoscaledDomain`
  widens its own `autoscaleRange` to every range the view's displays in that group
  hold (`packages/wiggle-core/src/autoscaleGroup.ts`). It unions raw ranges, never
  domains, so a pinned end stays its display's. An axis centred on 0 is a pin no
  group gives.
- **Scale resolution across layers: y never resolves independently.** Every
  drawing mark folds into the display's one y scale, which withdrew
  `resolve: 'independent'` (ADR-141). Two marks colouring or shaping by one field
  through one domain and palette share one key section (`buildMarkLegend` keys a
  section on the declaration, ADR-136), a `title` included. Two marks with open
  ramps over one field union nothing: the domain is a uniform each mark's shader
  reads off its own loaded values, so sharing it is a rendering change to
  measure. A stacked band per mark with a free y (`ValueScale.bandTops`) is the
  unbuilt form for two quantities in one display.
- **A reference line is the scale's.** `scales.y` carries `rules`, `title`,
  `grid` and `minimalTicks` (ADR-142 §"Amended 2026-09-26"). A rule is the
  conflation with ggplot2's `geom_hline`, which is a layer: it has no zoom range
  and no per-row value, and a rule layer carrying `minBpPerPx`/`maxBpPerPx` and a
  row field is unbuilt. A rule trains the scale, so an autoscaled end widens to
  reach it. A title is written, never derived, and holds at every zoom. The
  coverage band's density tier draws a scale of its own that keeps `grid` and
  `minimalTicks` and drops the depth title, rules and pinned ends.
- **No conditional encoding.** Hover and selection are a guide over the painting,
  not a `condition` on a channel
  ([ADR-110](../architecture-decision-records/adr-110-a-display-declares-what-is-highlighted.md)).
  An in-shader predicate would make the Canvas2D fallback repaint the whole
  display per mousemove, which is why the highlight is a div.
- **No per-layer data and no `lookup` join.** No measurement backs it, and each
  source multiplies the refName renaming, byte gate and zoom range a display runs
  once today. It reopens when a named plot needs two files in one display.
- **Text outside the text layer.** Alignments' inline labels, synteny's off-screen
  mate names, MAF's row labels and bases, variant insertion lengths and the
  sequence letters still paint on a canvas (ADR-162).
- **Fewer channels.** `opacity` and `angle` are uniforms, not channels, because
  shapes compile from hand-written Slang (ADR-095); `opacity` also breaks the
  Canvas2D painters' colour batching. `encoding.size` carries a mark's size as
  `color` carries its colour: a number is the constant, and a field maps a width
  through the `size` lane on the link alone
  ([ADR-163](../architecture-decision-records/adr-163-a-link-is-a-mark-and-the-arc-plugin-is-gone.md)).
  A point sized by a field waits on a plot that asks for it. An area mark waits
  on `y2`; the line is a mark
  ([ADR-184](../architecture-decision-records/adr-184-a-line-is-a-mark.md)).
- **The coordinate stage is a resampling.** A ring is the display's strip warped,
  exact in angle, and a display that reads the linear genome view itself rather
  than its `RegionHost`, such as the alignments pileup, has no ring. There is one
  polar transform, and a strip past `maxCanvasCssPx()` scales down rather than
  tiling.
- **In-app authoring stops at the display's own steps.** **Edit plot...** covers
  `facet`, `rows`, the axis and per mark its type, steps and a field per channel;
  **Edit as JSON...** lifts the same settings through the config schema with the
  rule list run as you type (ADR-133). The display's own `transform` and the
  facet's steps are the JSON side's, and the Settings editor cannot add, remove
  or reorder marks, since `marks` is a plain sub-schema array.

### Spelling

- **Inside a mark's `encoding` every bare string is a field**, and a constant is
  `{ value }`; `field-spells-constant` reports a field that spells a colour or
  shape name. Outside `encoding` a bare string fills the object's first member:
  `value` on a display's colour object, `field` where the object has no constant
  (`facet`, `rows`, `rowColor`).
- **`scales.y.type` beside `color.scale`**: a colour object lays its scale's
  members flat on the channel, and since `type` on a channel is the data type,
  its scale is named `scale`.
- **`rows.labels` is a map, a colour's `labels` a list**: a row is renamed
  whether or not `rows.domain` lists it, so it is keyed by name, while a
  threshold colour's labels name intervals, which have no key.
- **Wiggle's `origin` and its threshold cut** are two settings; the cut falls back
  to `origin` only while `color.domain` is empty.
- `rowGroups[].color` is to become `rowColor: { field: 'group' }`, step 4 of
  [one-row-model-for-displays-that-stack-by-a-key](../ideas/ready/one-row-model-for-displays-that-stack-by-a-key.md).

## What the tree does that the grammars do not

- **A lane is filled because a shape reads it.** The encoder allocates and
  transfers only the lanes the caller names and builds a hit index only for a
  caller that hovers.
- **Pan and zoom write one uniform and no buffer.**
- **The row axis rides a texture the vertex stage samples** (ADR-165): a reorder,
  focus or recolour uploads one small texture and no instance bytes. A `facet`,
  whose sections vary in height, still offsets its lanes (`facetRegion`).
- **Guides derive from scales on both surfaces**, screen and export, from one
  declaration.
- **The config rung is visible to the manifest, JSON schema and validator**,
  because `marks` and its encodings are typed sub-schemas and never `frozen`. The
  validator reads the plot, not just the JSON.
- **It scales past the fetch budget.** Past the byte budget a density file draws
  in place of the "region too large" banner.
- **It is a display on the track a user already has**, so the same BAM, VCF or
  BigWig switches between its usual display and a plot, and inherits sessions,
  URLs, the agent API, SVG export and the circular view's ring.
- **Clicking a binned bar opens the features inside it.**
- **A `jexl:` channel is the priced escape**
  ([MARK_ENCODING.md](MARK_ENCODING.md) §"The jexl channel, measured"), so field
  names are the unit and jexl is opt-in per channel.
- **Refusals are recorded with their measurement** in the ADRs' Rejected rows.

GenomeSpy is the comparison that matters. It covers a wider vocabulary (`y2`,
`opacity`, `stroke`, `angle`, more y scale kinds, `window`, `lookup`, `stack`,
shader-compiled selections). What still sets this layer apart is the sweep that
holds each shape's painter, shader and hit test together and the CI gate that
compares backends.

## Where a proposal lands

A new channel or scale kind is the encoder's (`markEncodingTypes.ts`) and needs
a shape, or a layer as the text mark is, that reads it. A new guide is a hook on
the mixin that owns the scale and a placement in the two shells; a guide over the
painting reads the shapes' `ink`. A transform is a `type` on `StepSnapshot` and
on `TransformStep`, an arm in `runTransforms`, a member of the `MarkTransform`
union and an arm in `stepsOf`, which a test and the compiler refuse to let
disagree (ADR-150). It needs a `marks` config that wants it, not a display whose
code it resembles (ADR-118). A new shape clears ADR-040's bar with two
consumers. A display that wants the encoding for a meaning it cannot say hands
the encoder a reader and says so at the call
([MARK_ENCODING.md](MARK_ENCODING.md) §"A reader in a channel's place").
Anything that composes a display stack from a declaration is what ADR-091
measured and refused.

Two Canvas2D painting designs are refused on measurement: one rule-coded walker
painting every box shape ran slower than the hand painter, and one `place` call
per instance writing the box that paint, ink and hit all read lost to a
per-shape copy, because TurboFan inlines no callee past its bytecode budget. A
box shape places each instance through module-level x and y functions over the
generated twins instead; writing the twins' arithmetic into `place` is the hand
transcription ADR-051 rejects. `packages/render-core/benches/placeWalkers.bench.ts`
holds each port to the painter it retired.
