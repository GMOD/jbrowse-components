---
status: Accepted
summary: "The mark display resolves every colour but a `jexl:` callback on the main thread, so no colour edit refetches. The worker reads only what a colour needs from each feature: a categorical field's keys, as `colorKey`, each instance's index into the categorical table's entries (ADR-167's index, on the encoder); a quantitative field other than `y` as raw `colorValue`, crossing as a threshold with no cuts so the worker builds no ramp table; and nothing for a constant, which crosses as the default and is stamped as the number every instance paints (ADR-198's scalar). `withMarkColors` replaces `withValueColors`. A text mark's ramp moves off the worker onto the scale the display unions, so `unpinned-text-ramp` and `MarkSpec.ramp` go. `stableIdentityComputed` holds its last value across unobserved reads. Extends ADR-185 from a colour over `y` to every colour"
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

- **`markColorOf` names how each mark's colour resolves** (`markColor.ts`):
  `constant`, `categorical`, `value` (a ramp or threshold, `readsY` where it
  reads the plotted field) or `worker` for a `jexl:` callback. `wireColorOf`
  and `colorLanesOf` derive the request from it, and `withMarkColors` stamps
  each region off what came back, before rows are keyed or sections offset.
- **A categorical colour crosses as its field**, and the encoder fills a
  `colorKey` lane in place of `color`: each instance's index into
  `scale.entries`, the keys the region met in the field's own order. The stamp
  paints each key through the declared `domain` and `range` with
  `categoricalField`, the function the worker used, and reorders the entries by
  the declaration. A region whose table names another field, held while a new
  field's refetch is pending, paints its keys through that field's defaults.
- **A quantitative colour over another field crosses as
  `{ field, scale: 'threshold' }`**, a threshold with no cuts. The worker reads
  the numbers into `colorValue` and flags the keyless ones, and builds no ramp
  table, whose shared lookup table cannot be transferred and would be cloned
  on every fetch. The stamp builds the declared table over the values as
  ADR-185's does over `y`, keeping the worker's `missing` and `notNumber`.
- **A constant crosses as `DEFAULT_MARK_COLOR`**, which the worker answers as a
  scalar, and the stamp writes the declared colour's number in its place.
- **A text mark reads the scale the display unions.** It asks for `colorValue`
  like every other mark, and `placeTextMarks` paints each label through
  render-core's `paintColors` against `state.colorScales`, so a label and a bar
  over one field and one declaration take one colour. `MarkSpec.ramp`,
  `rampResolvesPerRegion` and the `unpinned-text-ramp` rule go.
- **`stableIdentityComputed` holds its last value**, so its identity survives
  an unobserved read as it survives an observed recomputation. The stamp's
  input is the colour list, and an unobserved read of a fresh list re-stamped
  every region, allocating a colour lane per categorical layer per read.

## Consequences

- No colour edit refetches but a change to a `jexl:` callback, a change of
  field, or a switch between reading `y` and another field.
- A categorical layer holds a colour lane on the main thread beside the
  `colorKey` lane it came with, 4 bytes an instance each; the wire carries the
  same 4 bytes it did.
- A text mark's ramp domain grows as the user pans, as every other mark's
  does (ADR-124).
- While a refetch for a new form of colour is pending, a region paints what it
  holds: categorical keys in the field's own colours, a constant at once. One
  fetched under a constant paints the default colour until a categorical's
  keys arrive, since the constant never reached the worker.
- The encoder's `colorKey` lane has the mark display as its one caller; the
  multi-sample variant display, the second half of the handoff's step 2,
  still sends its colour encoding in `rpcProps()`.

## Rejected alternatives

- **Remapping the worker's colour lane by colour.** Two keys can take one
  palette colour, so a lane of colours cannot be repainted per key.
- **Crossing as `scale: 'linear'` for a quantitative field.** The worker then
  measures an extent and attaches the ramp's cached lookup table, which the
  test-only transfer check named on the first GWAS fetch.
- **Baking a text mark's colours in the stamp, per region.** It keeps the
  per-region disagreement the rule warned about, where `paintColors` against
  the unioned scale removes it.
