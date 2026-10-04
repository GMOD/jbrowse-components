---
name: grammar-of-graphics
description: Which rules govern how far the mark layer takes the grammar of graphics, and which grammar features were declined? Read before proposing a grammar feature, channel, scale kind or transform step.
kind: spec
---

# The mark layer against the grammar of graphics

The grammar of graphics is a pipeline: data, transform, scale, mark, guide,
layer, facet, coordinates. The decisions that built the layer are ADR-095
§"The grammar position", ADR-106 through ADR-119, ADR-150, ADR-153 and ADR-162;
each position below points at the record that holds its measurement.

![The grammar's eight stages, and where the tree answers each](diagrams/grammar-pipeline.svg)

## Four rules for how far to take it

**1. The parser's output is the data.** The grammar reads each record where the
parser left it (bbi's typed arrays, a BAM record's bytes, vcf-js's variant)
through a reader resolved once per region. The GPU instance buffer is the one new
representation, and any other copy needs a reason the drawing gives. ADR-152
found that every measured refusal to move a display onto the encoder blamed the
per-row feature object, never the rule. The remaining copies are
[copies-between-each-parser-and-its-instance-buffer](../ideas/waiting-on-a-number/copies-between-each-parser-and-its-instance-buffer.md).

**2. One object per concept, and every surface reads it.** Colour, the value
scale, the facet and the transform step are one object each (ADR-131, 135, 142,
150, 153): painter, uniforms, legend, axis, menu, dialog, validator, SVG export
and hit test all derive from it. A display that spells one of those concepts its
own way is the finding. The row axis follows it (ADR-165). Text follows it in
typography only: `FloatingText` and `SvgHaloText` are the one emit, and placement
stays each display's (ADR-162). MAF resolves colour outside
`colorEncodingOf`; Hi-C reads it through `count`'s linear preset, and LD
through `r2`'s and `dprime`'s, the field being the statistic the file serves.

**Unity is that rule held over every surface, not fewer display types**
(Colin, 2026-09-30). The menu builders (`colorByMenu.ts` and `groupByMenu.ts`
in display-kit, `rowArrangementMenuItem.ts`, `scoreMenuItems.ts`), Edit plot
(ADR-204), the validator, the legend, the axis, the agent API and SVG export
each read the one object. A display becomes a mark-display subtype only when
its whole picture is a plot, as Manhattan is (ADR-178); alignments, canvas,
Hi-C, MAF (ADR-199) and the comparative displays hold fetch policy, layout
memory and domain actions a plot does not. Their domain actions stay theirs.

**3. Generality resolves before the loop.** A shape composes its scale at
`gen:shaders` (ADR-095), a field name becomes a direct read before the walk, a
domain rides a uniform, and a lane nobody asked for is never allocated. A
declared form must land at 1.00x the hand-written path or better.

**4. A track stays its format, and the grammar supplies its parts.** The grammar
converges the parts every display shares, not the displays (ADR-091). A new mark
or channel arrives when it retires a hand-written spelling somewhere.
`MultiQuantitativeTrack`, `GWASTrack` and `GCContentTrack` are role bundles (a
guesser name carrying which display leads and its `displayDefaults`); the rule
refuses a channel hidden inside a track type, which a bundle of defaults does not
carry.

**Colour stays each mark's.** Scale members on each mark's `encoding.color` are
Vega-Lite's own spelling, and a display-level `scales.color` would be a second
spelling. Plasma and turbo are not among the named ramps (plasma reads as
magma's sibling, turbo is not perceptually uniform). On HicColor and LDColor
an unset `reverse` follows `darkAtLowEnd` (`matrixColorEncodingOf`), since a
ramp dark at its low end paints every sparse cell a dark speck.

## Seams

- **A colour or shape scale is declared on its channel; the value scale is the
  plot's** (ADR-141, ADR-142, narrowing
  [ADR-113](../architecture-decision-records/adr-113-one-scale-rule-in-one-place.md)).
  A categorical colour is data and travels packed with the instance, while a
  domain that moves on every autoscale must not touch a buffer
  ([ADR-097](../architecture-decision-records/adr-097-the-y-channel-shares-its-scale-and-not-its-anchor.md)).
- **Two channel vocabularies remain.** The encoding says `x`, `x2`, `y`, `row`,
  `color`, `shape`; variants' cell and canvas's rect say `startEnd`. ADR-106
  §Consequences parked converging them, because that array is the worker payload
  many modules address by `2i`. Canvas's `y`/`height` are pixel geometry, so
  renaming them converges nothing.

## The facet stage

**A domain orders and never decides which sections exist**, so no worker request
carries one and a reorder refetches nothing. The multiway `domain` slot, every
`rows.domain` (`rowDomain`, ADR-157), every `facet.domain` and the legend order
are that one rule (`groupKeyComparator`). Unlisted rows keep arrival order
(`orderRowsByDomain`), since a phylogeny's leaf order and a file's sample order
mean something; where a tree describes the rows, the domain rotates it
(`rotateNewickByDomain`).

Declined: filter shorthands such as `{ field, oneOf }`; jexl is the filter
language, and reading structure back out of jexl is the fragile half.

Declined on 2026-09-30: track- or view-level facets, and a free y per section.

## Gaps against the grammar

- **`stack` is declined, and so is the min-to-max range bar `y2`.** The stacked
  histogram was built and declined on its captures; the mirror (two bars, a
  `formula` negating one) and the rows form draw today. Don't re-propose either.
  A genotype share band over the multi-sample variant display's rows was built
  and removed too
  ([ADR-206](../architecture-decision-records/adr-206-a-row-display-summarizes-its-rows-in-a-frequency-band.md)).
  A weighted depth per bin is declarable with a `bin` over `fields` and a
  weighted `aggregate`
  ([ADR-197](../architecture-decision-records/adr-197-a-bin-cuts-an-interval-at-its-edges.md)).
- **`fold` is absent.** A frequency per population stored as one INFO field
  per group goes through bcftools to a bigWig per group, drawn as multi-wiggle
  rows (ADR-206).
- **`window` and `sample` are absent.** A BigWig's summary tiers are the
  adapter's (ADR-123), and `bin` takes `step: "auto"` (ADR-117).
- **Scale resolution across layers: y never resolves independently.** Every
  drawing mark folds into the display's one y scale, which withdrew
  `resolve: 'independent'` (ADR-141). Two marks with open ramps over one field
  union nothing: the domain is a uniform each mark's shader reads off its own
  loaded values, so sharing it is a rendering change to measure.
- **No conditional encoding.** Hover and selection are a guide over the painting,
  not a `condition` on a channel
  ([ADR-110](../architecture-decision-records/adr-110-a-display-declares-what-is-highlighted.md)):
  an in-shader predicate would make the Canvas2D fallback repaint the whole
  display per mousemove.
- **No per-layer data and no `lookup` join.** No measurement backs it, and each
  source multiplies the refName renaming, byte gate and zoom range a display runs
  once today. It reopens when a named plot needs two files in one display.
- **Fewer channels.** `opacity` and `angle` are uniforms, not channels, because
  shapes compile from hand-written Slang (ADR-095); `opacity` also breaks the
  Canvas2D painters' colour batching. `encoding.size` maps a width through the
  `size` lane on the link alone
  ([ADR-163](../architecture-decision-records/adr-163-a-link-is-a-mark-and-the-arc-plugin-is-gone.md)).
  An area mark waits on `y2`; the line is a mark
  ([ADR-184](../architecture-decision-records/adr-184-a-line-is-a-mark.md)).
  No `tooltip` channel either: each display's hover prints its own fields,
  and a plot naming them waits on one whose hover prints the wrong ones.
- **`scales.y.rules` draws fixed lines.** A `rule` layer with a constant `y`,
  taking a zoom range and a per-row value, waits on a plot that needs either;
  the CNV figures carry no reference line, since their keys name the level.
- **`plotProblems` judges a draft's colour objects and `scales.y` on every
  display** through the schema's own `fieldPresets` (`schemaPlotProblems`),
  the rule `jbrowse validate` runs offline; the mark display adds its rule
  list and canvas its jexl checks. A display-side notice with no schema
  behind it (a row banding over a field no row carries, alignments' level
  notices) stays a live notice only.
- **No ordinal x**, until a declared plot wants equal-width columns. LD and the
  multi-sample matrix draw one column per variant under one `variantLayout`
  slot;
  [a-distribution-plot-needs-x-to-be-a-value](../ideas/waiting-on-a-call/a-distribution-plot-needs-x-to-be-a-value.md)
  is its value-x sibling.
- **Typed tables cover MAF and BigWig alone** (`getFeatureTable`). BAM/CRAM,
  VCF and bigBed wait on a declared plot over one being slow on real data.
  ADR-114's 3.11x and ADR-118's 4.23x blamed the per-row `Feature` that
  ADR-191 removed for typed sources, so re-measure both before citing them.

## Where a proposal lands

A new channel or scale kind is the encoder's (`markEncodingTypes.ts`) and needs a
shape, or a layer as the text mark is, that reads it. A new guide is a hook on the
mixin that owns the scale and a placement in the two shells. A transform is a
`type` on `StepSnapshot` and on `TransformStep`, an arm in `runTransforms`, a
member of the `MarkTransform` union and an arm in `stepsOf`, which a test and the
compiler refuse to let disagree (ADR-150). It needs a `marks` config that wants
it, not a display whose code it resembles (ADR-118). A new shape clears ADR-040's
bar with two consumers. A display that wants the encoding for a meaning it cannot
say hands the encoder a reader and says so at the call.
Anything that composes a display stack from a declaration is what ADR-091
measured and refused.

Two Canvas2D painting designs are refused on measurement: one rule-coded walker
painting every box shape ran slower than the hand painter, and one `place` call
per instance writing the box that paint, ink and hit all read lost to a per-shape
copy, because TurboFan inlines no callee past its bytecode budget. A box shape
places each instance through module-level x and y functions over the generated
twins; writing the twins' arithmetic into `place` is the hand transcription
ADR-051 rejects. `packages/render-core/benches/placeWalkers.bench.ts` holds each
port to the painter it retired.
