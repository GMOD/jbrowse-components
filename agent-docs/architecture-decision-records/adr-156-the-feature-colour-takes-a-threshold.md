---
status: Accepted
summary: "FeatureColor's scales are `none | categorical | threshold`, so a feature's number paints the range colour of the interval between cut points it falls in. `thresholdField` gives a threshold the interface `categoricalField` answers — a value files under its bin's label, a value-less feature under `''` in the no-value grey, text that is no number under its own key in the misconfiguration grey — so the canvas worker's walk, parent inheritance and the derived key take it unchanged. The field's domain is `closed`, and a key lists every bin of a closed domain. `colorFieldOf` answers either field; `categoricalColorField` and the canvas display's `colorField` stay categorical for the facet, Group by and the pin. Not `linear` or `log`: an unpinned ramp needs a domain unioned across regions, which a display packing a colour per box in the worker has no place for"
---

# ADR-156: The feature colour takes a threshold

## Status

Accepted (2026-09-21). Extends
[ADR-153](adr-153-every-display-resolves-its-colour-through-one-function.md)'s
resolver to a second scale on the canvas feature and multi-way gene colours,
and [ADR-136](adr-136-a-legend-follows-its-scale-and-a-colour-slot-is-a-colour.md)'s
derived key to a scale whose domain is every key it can file under.

## Context

The canvas feature colour answered `none | categorical`. A number an analysis
writes into a feature — a p-value, an effect size, a fraction — could be binned
only by a `jexl:` ternary beside a hand-written `legend`. The differential
transcript usage tutorial's seven-bin ΔIF ramp was 400 characters of jexl that
had to `parseFloat` every value and reach `feature.parent` from each exon, and
a seven-row legend that nothing checked against it. Manhattan, the quantitative
display and the alignments displays already paint `threshold`, through
`thresholdCuts`, `thresholdIndex`, `thresholdPalette` and `thresholdLabels`.

## Decision

**FeatureColor's scales are `none | categorical | threshold`.** The canvas
worker packs one colour per box, and a threshold's colour depends only on the
value and the declared cuts, so every region agrees on it without a round trip.

**`thresholdField(field, { domain, range })` is a categorical field over the
bins.** `key` is the label of the bin a value falls in, a value on a cut taking
the bin above it; a feature with no value files under `''` and paints
`NO_CATEGORY_COLOR`; text that is no number files under `NOT_A_NUMBER_LABEL`
and paints `MISCONFIGURED_COLOR`, so a misread column does not pass for
missing data. `compare` orders the bins, then that key, then `''`. Answering
the interface `categoricalField` answers is what lets the canvas worker's
colour walk, its rule that a transcript's parts paint the transcript's value,
and `derivedColorScale` take the scale without a branch.

**A key lists every bin.** The field carries `closed: true`, and
`derivedColorScale` adds each domain value no painted row names. The bins are
the scale, where a categorical domain is only an order, and Manhattan's, the
alignments' and the LD keys already list theirs from the declaration. The
no-value and not-a-number rows appear once something paints them.

**`colorFieldOf` answers either field; `categoricalColorField` stays
categorical.** The canvas display's `paintedColorField` paints and keys, and
its `colorByMode` reads it. `colorField` stays the categorical field, which the
facet reads to share its order, Group by reads as "colour by group", and "Pin
distinct colors" writes the domain of: under a threshold the domain is the
cuts. The multi-way display gates its pin on `geneColorScale`.

**The canvas feature display shows `colorNotices`** in its corner, as the mark,
quantitative, alignments and Manhattan displays do, so unsorted cuts or a range
that is not one colour per interval surface there.

## Consequences

- The multi-way gene colour paints and keys a threshold and has no corner
  notice.
- The Color by menu offers no threshold. Edit as JSON and the config write one,
  and a Solid-and-back round trip returns the field on `categorical`, as
  [ADR-151](adr-151-a-channels-scale-is-spelt-as-scales-y-spells-one.md)
  records.
- The key's title is the field's name, so a config binning a derived number
  names the attribute for the reader.
- The mark encoder still paints a threshold's value-less point
  `MISCONFIGURED_COLOR` with no key row, on the mark and Manhattan displays.

## Rejected alternatives

- **The bin index as the key.** `sectionOf` re-sorts a key's entries by its
  `domain` through `groupKeyComparator`, so with cuts `[1, 2, 5]` the indices
  `'1'` and `'2'` sort ahead of `'0'`. The label is a key no cut spells.
- **`categoricalColorField` answering a threshold too.** It is plugin ABI, and
  its callers in the facet and the pin mean a categorical scale.
- **Keying only the painted bins**, the categorical rule. A locus showing two
  bins keyed two rows of the ramp, and one painted colour dropped the key
  (`legendIsReadable`).
- **`linear` and `log` on this display.** An unpinned ramp needs its domain
  unioned across the loaded regions, which the quantitative displays hold as a
  uniform; this display packs finished colours in the worker and has none.
