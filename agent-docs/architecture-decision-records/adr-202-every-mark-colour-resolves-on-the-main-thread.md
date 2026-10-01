---
status: Accepted
summary: "The mark display works out every colour but a `jexl:` callback on the main thread, so an edit that changes only how data maps to colour refetches nothing. The worker reads only the raw data a colour needs: a categorical field's keys, as `colorKey`, each instance's index into the categorical table's entries (ADR-167's index, on the encoder); a number field other than `y` as raw `colorValue`, asked for as a threshold with no cuts so the worker builds no ramp table; and nothing for a constant, which the main thread writes whole (ADR-198's scalar). `markColorOf` names where a mark's colour comes from (`ColorSource`: constant, categories, numbers, expression), and `withMarkColors` replaces `withValueColors`. A text mark's ramp moves off the worker onto the scale the display unions, so `unpinned-text-ramp` and `MarkSpec.ramp` go. Multi-way synteny's lane layers colour their bars the same way, a ramp through one scale across their lanes. Extends ADR-185 from a colour over `y` to every colour"
---

# ADR-202: Every mark colour resolves on the main thread

## Status

Accepted (2026-09-30). Extends
[ADR-185](adr-185-a-colour-over-the-plotted-value-reads-the-y-lane.md), which
moved a quantitative colour over the plotted field off the fetch, to every
colour the mark display paints.

## Context

A probe in the grammar-unity review found that on the mark display a constant
colour, a categorical `domain` or `range`, or a ramp over another field
changed `rpcProps()`, so each edit cleared and refetched every loaded region;
only a threshold or ramp over the field `y` plots did not (ADR-185). The canvas
feature display had left that behind in
[ADR-167](adr-167-the-feature-colours-scale-resolves-on-the-main-thread.md),
and the alignments read fill in ADR-148. A text mark's ramp also resolved in
the worker against each region's own extremes, so its colours disagreed across
regions unless both ends were pinned, which `unpinned-text-ramp` warned about.

## Decision

The worker holds the features, so it reads from each one only the raw data a
colour needs; the main thread turns that data into colours through the config.

- **`markColorOf` says where a mark's colour comes from** (`markColor.ts`), a
  `ColorSource`: a `constant`, `categories`, `numbers` (a ramp or threshold,
  `fromY` where they are the values the mark plots) or an `expression`, a
  `jexl:` callback the worker evaluates. `wireColorOf` and `colorLanesOf` build
  the worker request from it, and `withMarkColors` colours each region off
  what came back, before rows are keyed or sections offset.
- **Categories cross as the field alone**, and the encoder fills a `colorKey`
  lane in place of `color`: each instance's index into `scale.entries`, the
  keys the region met, in the order the field's own compare puts them. The main thread paints each key
  through the declared `domain` and `range` with `categoricalField`, the
  function the worker used, and reorders the entries by the declaration.
- **Numbers over another field cross as `{ field, scale: 'threshold' }`**, a
  threshold with no cuts. The worker reads the numbers into `colorValue` and
  flags the missing ones, and builds no ramp table, whose shared lookup table
  cannot be transferred and would be cloned on every fetch. The main thread
  builds the declared table over the values as ADR-185's does over `y`, keeping
  the worker's `missing` and `notNumber`.
- **A constant asks the worker for no colour lane.** The request carries
  `DEFAULT_MARK_COLOR`, which the encoder ignores without a lane to fill, and
  the main thread writes the declared colour's number.
- **A text mark reads the scale the display unions.** It asks for `colorValue`
  like every other mark, and `placeTextMarks` paints each label through
  render-core's `paintColors` against `state.colorScales`, so a label and a bar
  over one field and one declaration take one colour. `MarkSpec.ramp`,
  `rampResolvesPerRegion` and the `unpinned-text-ramp` rule go.
- **A region the worker read for another kind of colour stays drawn while its
  refetch is on the way**: held keys in their field's default colours, held
  numbers through a linear ramp over themselves, and the default colour where
  it holds no colour data (`colorWhileRefetching`). Regions refetch one by one,
  so for a moment one region can hold numbers and another finished colours;
  each picks its own scale (`regionColorScale`): the mark's for numbers, its
  own table's where the mark's is of another kind, and none for finished
  colours, so both backends draw what each region holds.
- **The colour list keeps its identity across reads nothing observes**,
  through display-kit's `sameAsLast`. An unobserved computed hands out a fresh
  list per read, which recoloured every region and allocated a colour lane per
  categorical layer per read.
- **Multi-way synteny's lane layers colour their bars the same way.** They
  build their requests with `markLayerRequest`, so `coloredLaneLayer` colours
  each held payload through `withMarkColor`, and `laneLayerColorScales` gives
  the bars one ramp or threshold per mark, a ramp's domain covering every drawn
  lane, through legend.ts's `paintScalesOver`, the step the mark display's
  `paintScales` takes through `paintScaleOf`. The scale rides the bar layer
  the pass reads per block and the cell keeps only the ramp's cached lookup
  table, so a landing that widens the ramp rebuilds no cell. Before this the
  bars drew a ramp or threshold colour blank or as noise.

## Consequences

- An edit that keeps what the worker reads refetches nothing: a constant, a
  palette, a domain, a threshold's cuts, a ramp's ends or scale type over one
  number field, a key's labels, and a switch between a constant and a colour
  over `y`. An edit that changes what the worker reads refetches: a `jexl:`
  callback, a field named or dropped, or a switch between categories and
  numbers.
- The worker's payload keeps its `colorKey` lane and the coloured copy adds a
  colour lane, 4 bytes an instance each; the wire carries the same 4 bytes it
  did.
- A text mark's ramp domain grows as the user pans, as every other mark's
  does (ADR-124).
- A region read under a constant paints the default colour until a
  categorical's keys arrive, since the constant never reached the worker.
- The multi-sample variant display still sends its colour encoding in
  `rpcProps()`.

## Rejected alternatives

- **`stableIdentityComputed` holding its last value for every reader.** It
  kept the colour list's identity, and it walked canvas's settings payload on
  every unobserved read of its fetch inputs, which `perFrameStoreCost.test.ts`
  forbids on a pan. The colour lists are small, so the keeper is theirs alone.
- **Remapping the worker's colour lane by colour.** Two keys can take one
  palette colour, so a lane of colours cannot be repainted per key.
- **Asking for a number field as `scale: 'linear'`.** The worker then measures
  an extent and attaches the ramp's cached lookup table, which the test-only
  transfer check named on the first GWAS fetch.
- **Baking a text mark's colours per region.** It keeps the per-region
  disagreement the rule warned about, where `paintColors` against the unioned
  scale removes it.
