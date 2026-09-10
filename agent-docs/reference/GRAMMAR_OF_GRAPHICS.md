---
name: grammar-of-graphics
description: The mark layer reviewed against the grammar of graphics — which of its seven stages the tree answers and where, the seams, the gaps, and what the tree does that the grammars do not. Read before proposing a grammar feature.
kind: spec
---

# The mark layer against the grammar of graphics

**TL;DR:** the grammar is a pipeline — data, transform, scale, mark, guide,
layer, coordinates — and as of 2026-09-09 the tree has a declared answer at
five of the seven stages, with guides derived from declared scales on both
surfaces and parity between backends pinned by tests. The seams are that the
scale lives in two places (colour on the encoding, y on the display), that
two channel vocabularies remain, that the config rung covers one class of
track, and that a scale table is per fetched region. The gaps are the
transform stage, scale resolution across layers, conditional encoding and the
channels a runtime shader generator would give. The positions behind each are
in [ADR-095](../architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md)
§"The grammar position", [ADR-106](../architecture-decision-records/adr-106-a-display-declares-its-marks.md),
[ADR-107](../architecture-decision-records/adr-107-the-quantitative-class-is-authored-in-config.md),
[ADR-108](../architecture-decision-records/adr-108-a-display-declares-its-colour-scales.md),
[ADR-109](../architecture-decision-records/adr-109-a-display-declares-its-value-scale.md)
and [ADR-110](../architecture-decision-records/adr-110-a-display-declares-what-is-highlighted.md);
this file is the map across them.

![The grammar's seven stages, and where the tree answers each](diagrams/grammar-pipeline.svg)

## Where the tree answers each stage

| Stage | What the grammar means | Where the tree answers | How far |
| --- | --- | --- | --- |
| data | rows in memory | a feature adapter's `getFeaturesArray`, any format | whole; the adapter is the format's, and the grammar has no lazy source of its own |
| transform | a declared step over rows before encoding | `transform: [{ type: 'filter', expr }]` on `CoreEncodeFeatures` (`packages/core/src/rpc/methods/CoreEncodeFeatures.ts`), `filters: jexl[]` as sugar | one step kind; bin, aggregate, window and sample are absent |
| scale | domain → range, separate from the encoding | colour and glyph: `{ field, scale, domain, palette \| range }` on the encoding, resolved by `encodeFeatures` (`packages/core/src/util/markEncoding.ts`); y: `valueScale` on `ScoreScaleMixin` (`packages/wiggle-core/src/ScoreScaleMixin.ts`), placed by `valueScale.slang` | whole, in two places |
| mark | a shape bound to channels | `defineMark` over a `MarkShape`, one declaration for three backends, export and hit test (`packages/render-core/src/marks/`) | whole, for the shapes the library has |
| guide | axis and legend derived from a scale; a highlight derived from a selection | `colorScales` → legend (`packages/display-kit/src/legendHost.ts`), `valueScale` → axis, hatches and rules (`packages/display-kit/src/axisHost.ts`), `hoverInk` / `selectionInk` → the highlight (`packages/display-kit/src/highlightHost.ts`), each instance's box read off its shape's `ink`; `DisplayChrome` places all three and `renderDisplaySvg` the first two | whole, for the displays that declare |
| layer | marks composed in z-order over shared scales | `marks[]` in config is draw order; every mark shares one y domain (`plugins/marks/src/LinearMarkDisplay/markList.ts`) | shared only |
| coordinates | a transform of the plane | genomic x, fixed; circular and dotplot are displays, not coordinate systems | fixed, by position |

The encoding — field to channel, evaluated once — is the grammar's central
idea and the tree has it as one loop. Four packers that were hand-written
spellings of it call it now: the mark display, Manhattan, the example plugin
and wiggle's array-less fallback ([MARK_ENCODING.md](MARK_ENCODING.md) §"A
reader in a channel's place"). Canvas's `packRenderArrays`
(`plugins/canvas/src/RenderFeatureDataRPC/packRenderArrays.ts`) is the one
hand-written packer left, and it fans one feature out into several
primitive families, which is a transform the encoder does not have rather
than a spelling of it.

## Integrity: what holds the implementation to itself

The claim the tree can make that the grammars cannot is **parity, pinned**.
A shape's painter, its shader and its hit test are held to each other by
`sweepDrawAgainstHit` (`packages/render-core/src/marks/drawAgainstHit.ts`):
every pixel the painter inks answers the instance it belongs to, in both
orientations, and the box a shape declares as its `ink` is within a pixel of
what it painted. A legend cannot list a colour nothing painted, because it
reads the table the worker packed the colours from. An axis cannot label a
value the renderer places elsewhere, because the mixin derives the ticks from
the declaration the shader's uniforms are written from. A highlight cannot
box a place nothing painted, because it reads the same `ink` the hit test is
derived from. Each guide has one source, and each source is tested against
its consumer.

The seams, named honestly:

- **The scale lives in two places.** A colour or glyph scale is on the
  encoding and resolves in the worker, per instance, into a packed value. The
  y scale is on the display and resolves on the GPU, per frame, from a domain
  uniform. Both are right for their cost: a colour is data and travels with
  the instance, a domain moves on every autoscale and must not touch a
  buffer ([ADR-097](../architecture-decision-records/adr-097-the-y-channel-shares-its-scale-and-not-its-anchor.md)).
  But a config reader sees a scale under `encoding.color` and none under
  `encoding.y`, and has to learn that `minScore` and `maxScore` on the
  display are that scale. The grammar puts them beside each other.
- **Two channel vocabularies remain.** The encoder and the three shared
  shapes say `x`, `x2`, `y`, `row`, `color`, `glyph`. Variants' cell
  (`plugins/variants/src/LinearMultiSampleVariantDisplay/components/cellMark.ts`)
  says `startEnd` and `rowIndex`; canvas's rect
  (`plugins/canvas/src/LinearBasicDisplay/marks/featureGlyphShapes.ts`) says
  `startEnd`, `y`, `height`. ADR-106 §Consequences books converging them as a
  lens change per display, still open. The alignments pileup
  (`plugins/alignments/src/features/pileupShape.ts`) is on the mark list but
  keeps its rule codes as data, for a measured reason.
- **The config rung covers one class.** A `marks` entry draws a bar, point or
  span over any feature adapter, which is the quantitative class ADR-107
  reopened. Alignments, variants, genes and synteny stay format-typed
  displays a reader cannot re-encode. That is a position
  ([SESSION_SPEC_FORMAT.md](SESSION_SPEC_FORMAT.md) §"The assessment": what
  those displays hold is layout, tiering and fetch shape, not channels), and
  it is still the widest gap between what the tree calls a grammar and what
  one is.
- **A reader channel is where "declared" ends.** Manhattan's LD colouring
  joins each feature against a second adapter through a function
  (`plugins/gwas/src/ManhattanRPC/makeLdEvaluator.ts`) the encoder takes in a
  channel's place. It runs in the one loop, but nothing about it is a
  declaration, and the grammar has no equivalent. Every display with a
  meaning the encoding cannot say will look like this.
- **A scale table is per fetched region.** The grammar resolves a scale over
  the whole dataset; the worker sees one region. Value-derived categorical
  resolution makes regions agree without a round trip, and a pinned `domain`
  pins a ramp; an unpinned ramp still disagrees across regions, and no
  display can declare "one domain across the view" without a refetch. This is
  the cost of resolving colour in one place, and it is the honest limit of
  that rule.

## Gaps against the grammar

- **One transform kind.** The list is typed — `[{ type: 'filter', expr }]`,
  the spelling GenomeSpy chose over Vega-Lite's inferred one — and `filter`
  is its only member. `bin`, `aggregate`, `window` and `sample` are what a
  "count features per 10 kb" config needs, and nothing in the tree can say
  them today. Wiggle's binning is the adapter's and stays so.
- **No scale resolution across layers.** Every mark on a display shares one
  y. `resolve: { y: 'independent' }` with a second axis is absent, and so is
  faceting beyond stacking on `row`. Declined on review until a figure needs
  two axes.
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
- **A fixed coordinate system.** Genomic x, always. A circular view is a
  display with its own shapes, not a coordinate transform over the same
  marks.

## What the tree does that the grammars do not

- **Every channel evaluation is measured**, and the escape is priced: a
  `jexl:` channel costs 1.5–1.8x a native field read
  ([MARK_ENCODING.md](MARK_ENCODING.md) §"The jexl channel, measured"), so
  field names are the unit and jexl is opt-in per channel.
- **A lane is filled because a shape reads it.** The encoder allocates and
  transfers only the lanes the caller names, and builds a hit index only for
  a caller that hovers; wiggle's fallback runs at 0.31x the full encode for
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

## Where a proposal lands

A new channel or scale kind is the encoder's (`markEncodingTypes.ts`) and
needs a shape that reads it. A new guide is a hook on the mixin that owns the
scale and a placement in the two shells; a guide over the painting reads the
shapes' `ink`. A transform is a `type` on
`TransformStep`, run by `CoreEncodeFeatures` before the layers encode. A new shape clears ADR-040's bar with two consumers. A
display that wants the encoding for a meaning it cannot say hands the encoder
a reader and says so at the call. Anything that composes a display stack from
a declaration is what ADR-091 measured and refused.
