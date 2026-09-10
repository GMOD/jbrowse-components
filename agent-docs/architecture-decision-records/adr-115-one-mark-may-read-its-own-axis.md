---
status: Accepted
summary: "Three moves at the layer stage. Layout becomes a transform — `stack` is the seventh TransformStep kind, a greedy first-fit row per feature, measured at 5.07x the bare encode, so a `span` reading the row it writes is a declared pileup. One mark's `encoding.y` may declare `resolve: 'independent'`, folding its own domain and taking a second axis on the right through the `side` member `ValueScale` already had; a second such mark is refused where the config is read. And the mark display attaches to `AlignmentsTrack` and `VariantTrack` beside `FeatureTrack`, so both of those are config over a BAM or a VCF. An independent colour scale and a layout the main thread can re-pack are declined"
---

# ADR-115: One mark may read its own axis, and layout is a transform

## Status

Accepted (2026-09-10). Closes
[GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md)'s "no scale
resolution across layers" gap for y, narrows its "the config rung covers one
class" seam, and extends
[ADR-112](adr-112-a-layer-owns-its-transform-and-its-zoom-range.md)'s step list
with a seventh kind, as
[ADR-114](adr-114-canvas-keeps-its-hand-written-packer.md) did with the sixth.
Answers the per-mark scale
[ADR-113](adr-113-one-scale-rule-in-one-place.md) parked in its Rejected rows.
[MARK_ENCODING.md](../reference/MARK_ENCODING.md) is the operational doc and
`website/docs/config_guides/mark_display.md` the public one.

## Context

GenomeSpy's position is that layout is a transform: a row is a field a step
computes, not a thing a display does before it draws. The tree's biggest
hand-written code is exactly what that position is about — canvas's packer
(`plugins/canvas/src/LinearBasicDisplay/packRef.ts`) and alignments'
`sortLayout.ts` — and the mark display's `row` channel was a field a config
had to already have. `{ shape: 'span', encoding: { row: 'sampleIndex' } }`
drew a strip per sample and nothing drew a pileup, because nothing computed
the packing.

Two other things were declared open at the same seam. Every mark on a display
shared one y domain, so a coverage run in the hundreds and a per-read mapping
quality in the tens could not be read off one plot; ADR-113 refused the
per-mark scale on the ground that it needs a second axis in the chrome, and
left it there. And the display attached to `FeatureTrack` alone, so the
declared pileup a `stack` would make had nowhere to draw over a BAM —
`DisplayType.trackType` has taken an array since
[ADR-107](adr-107-the-quantitative-class-is-authored-in-config.md) and the
mark display was not using it.

## Decision

### `stack` is a transform step

`{ type: 'stack' }` writes each feature the lowest row on which it overlaps
nothing already there — greedy first fit in start order, the rule canvas's
packer follows — into the field `as` names (`row`). `fields` names the
interval it reads (`start`, `end`), `padding` is bp of clearance kept between
two features sharing a row, and `groupby` packs each distinct value set on
rows of its own, each numbered from 0. The answer is a `DerivedFeature` over
the input, in start order, so nothing is copied per feature and a later step
still reads the original fields.

`row` was already a channel and `span` already stacked on it into `rowCount`
bands, so the step needed no renderer change: the pileup is the packing plus
the shape the display had.

**Measured** (`packages/core/benches/featureTransforms.bench.ts`, one million
synthetic features, min of 11, on AC power), in
[MARK_ENCODING.md](../reference/MARK_ENCODING.md) §"The transform stage":
374ms against the bare encode's 74ms, **5.07x**, where `coverage` over the
same spans is 5.76x and `bin`-and-count 3.41x. It costs what the neighbour
answering the same shape of question costs. The whole table was re-taken with
the arm in it, ADR-114's rule that a fixture beside an arm is part of the arm
applying to an arm beside an arm as well.

### `encoding.y.resolve: 'independent'`

A mark's `y` object form takes `resolve`, `shared` by default. The
independent one folds its domain from **its own layers alone**, the way the
shared one is folded from the shared marks, keeps its own `scale` and
`domain`, and its shapes read it as their scale uniform.

`markValueScale(state, i)` is the one reader: the mark list's `params(s)` and
the hit test's `valueWindow` both go through it, so a shape and the box that
answers for it cannot disagree about which domain the instance was placed in.
`MarkRenderState.independentY` is `{ markIndex, domain, scaleType }` or
absent, so a display with no independent mark carries the state it always
carried.

**The second axis costs no chrome.** `ValueScale` has had `side: 'left' |
'right'` since [ADR-109](adr-109-a-display-declares-its-value-scale.md), and
`axisGutterLeft` places a right-side gutter on both surfaces already — the
display declares a second scale and `DisplayChrome` and `renderDisplaySvg`
draw it without knowing whose it is. With two axes both carry the field they
measure as a `caption`, the member the coverage band's `TLEN` already used, so
the reader can tell them apart; with one, the caption stays off and nothing
about a single-axis display moves.

**A second independent mark is refused where the config is read.** The
display schema's `preProcessSnapshot` throws naming the marks that asked, so
the message arrives with the track rather than as a picture with one axis
missing. The chrome has one place to put a second axis, and a display
declaring two has no reading.

### The display attaches to three track types

`trackType` is `['FeatureTrack', 'AlignmentsTrack', 'VariantTrack']`. Every
adapter behind those answers `getFeaturesArray` through
`BaseFeatureDataAdapter`, and both `BamAdapter` and `VcfTabixAdapter`
implement `getRegionByteSize`, so `CoreEncodeFeatures`' byte gate measures
them before it downloads exactly as it does a BED.

What differs is which fields answer, and the docs say so rather than papering
over it: a read's `score` is its MAPQ (`undefined` at 255, which the encoder
counts as skipped), its `name` the QNAME; a variant's `name` is its ID where
the row has one and its quality is `QUAL`, `score` being absent. That
asymmetry is the adapters' and not this display's to fix.

## Consequences

- A pileup is config: `{ shape: 'span', transform: [{ type: 'stack' }],
  encoding: { row: 'row' } }` over a BAM, coloured by any field a read
  answers. It is not the alignments display — no mismatches, no soft clips, no
  sort — and the config guide says which question each is for.
- A coverage run and the raw features share a plot with two axes and one
  fetch, which is the figure ADR-113 said would be needed before this was
  built.
- `hasBarMark` and the shared domain now fold `sharedMarkIndices` rather than
  every visible mark, so a display whose only valued mark is independent has
  no shared axis and draws the right-hand one alone.
- The score menu still edits the shared declaration: `valueMarkIndex` skips
  an independent mark, so "Set min/max" cannot silently pin the wrong axis.
  An independent mark's bounds are config-only.
- Cross-hatches follow every declared scale, so a display with two axes and
  hatches on rules two ladders across the plot. Left as it is: the hatch
  toggle is off by default and a reader who turns it on with two axes is
  asking about both.
- Three jbrowse-web tests drive the real worker over the volvox BAM and VCF —
  a `stack` whose rows are checked not to overlap, the two-domain pair, and a
  variant strip — because the registration is the kind of thing a unit test
  cannot see: a config that names its display explicitly bypasses
  `pickDisplayForView` entirely, so the attach is pinned by reading
  `pluginManager.getTrackType(…).displayTypes` and not by a track that draws.

## Rejected alternatives

- **`resolve` as a display-level object, Vega-Lite's `resolve: { scale: { y:
  'independent' } }`.** It reads as a policy over all layers when what the
  tree can honour is one exception, and it would put the declaration
  somewhere other than the channel it scales, which is the whole of ADR-113's
  rule.
- **More than one independent axis.** Two right-hand gutters overlap in
  `axisGutterLeft`, and a third has nowhere at all; the honest form would be
  a gutter stack the chrome lays out, which is a chrome feature and not a
  grammar one. Refused with a message rather than drawn wrong.
- **An independent colour scale.** The same `resolve` on `color` is one line
  in the schema and nothing else: a ramp already resolves per mark
  (`colorRamps[i]`) and a categorical table already keys by mark, so two marks
  with two colour scales already have two keys. There is nothing to resolve
  independently *of*, so the member would declare a difference that does not
  exist. GRAMMAR_OF_GRAPHICS.md keeps colour on the gap list for the opposite
  reason — nothing unions two marks' ramps into one — which is a feature no
  config has asked for.
- **`stack` as a main-thread layout the display re-packs on pan.** The rows a
  region packs are that region's, so a feature spanning a block boundary can
  take two rows in two regions, which canvas solves by grouping regions by
  refName before packing (`layoutRefGroups`). A transform runs in the worker
  per region and cannot; the honest fix is a display-side re-pack over the
  loaded regions, which is the layout machinery this ADR is trying not to
  rebuild. Accepted as a limit: `stack` packs a region, and a read at a block
  seam may sit on a different row either side of it.
- **A `pileup` step fusing `stack` with a sort.** Sort order is a display
  question — alignments' `sortLayout.ts` re-sorts on a menu pick without
  refetching — and baking one into a worker step keys the fetch on it.
  `stack` packs what the list gives it, and a `filter` or a `formula` in front
  is what shapes that list.
- **A second instance lane for the row.** `row` is a lane already; the step
  writes a field the existing lane reads.
- **Registering the display for `QuantitativeTrack` too.** ADR-107's line
  stands: a BigWig's summary levels are the adapter's and a `bin` over them
  would re-summarise what is already summarised.
