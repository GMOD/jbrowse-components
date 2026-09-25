---
status: Accepted
summary: "The canvas feature display's worker ships what a colour scale reads — the colour field's distinct values per region as text, and each box's one-based index into them (`rectColorValues`) — and the main-thread encode paints them through the colour object, as it already paints theme classes. Only `color.value` and `color.field` reach the worker, so a recolour of a named field (its scale, domain, range, a pin, a switch to Default and back) re-encodes what is loaded instead of refetching it, as the alignments read fill has since ADR-148. With the domain the main thread's, FeatureColor takes `linear` and `log`: an open end follows the loaded values, the ramp is core's `continuousColorScale` the mark encoder paints through, `score` paints a ramp while `scale` is unset, and the key is a gradient. FeatureColor also takes `labels` and `title`, so the key names what the colour means and the display's hand-typed `legend` slot goes. The multi-way gene colour, which paints on its own path, becomes `MultiWayGeneColor` with the discrete scales. Amends ADR-156's refusal of `linear` and `log`"
---

# ADR-163: The feature colour's scale resolves on the main thread

## Status

Accepted (2026-09-24). Amends
[ADR-156](adr-156-the-feature-colour-takes-a-threshold.md), whose last
Rejected row refused `linear` and `log` because this display packed finished
colours in the worker. Brings the canvas feature colour level with
[ADR-148](adr-148-the-alignments-read-fill-is-the-colour-object.md), where a
declared scale on the alignments read fill recolours with no refetch.

## Context

The canvas worker resolved a colour field through its scale and packed the
colour, so the whole colour object sat in `rpcProps()`: Color by → Strand,
"Pin distinct colors", a reordered `domain` or an edited `range` each cleared
every loaded region, refetched it and laid it out again. The worker also had no
place for a ramp's domain, which a grammar resolves over the dataset: an
unpinned ramp resolved per region paints one value two colours across a pan.
The theme colours had already met the same problem and moved: the worker ships
a class and the main-thread encode fills the lane from the session palette.

## Decision

**The worker ships what the scale reads, not what it paints.** Where the track
names `color.field`, each region carries `colorValues` — the field's distinct
values as `valueText`, and `painted`, each value a box carried with the section
its record files under — and `rectColorValues`, each rect's one-based index into
`values`, 0 where no field value paints it. The colour lane keeps the colour the
box paints while no field does (`value`, a BED's own colour, a glyph's palette),
so a switch to Default is a re-encode too. A reading frame still paints over a
field and records nothing.

**The main thread owns the scale.** `paintColorValue` is the colour a value
paints, off the colour object, and `fieldPalette` holds each value's packed
colour and its two codon tints for as long as the scale stands, so a pan's
re-encode of a region is a table lookup per distinct value rather than a parse
of each. `resolveColorLane` fills a field-painted rect from that table. A codon stripe over a field-painted box carries the box's value and a
field tint class (`FIELD_LIGHT_TINT`, `FIELD_MID_TINT`), lightened here as a
literal stripe is lightened in the worker. The key derives from the values each
region shipped, painted through the same function (`derivedColorKey`), so it
cannot name a colour the encode did not use.

**A region's values name their field.** `colorValues.field` is stamped in the
worker, and a region whose field is not the one painting — held under the scrim
while a new field's refetch is pending — paints its literal colours and leaves
the key and a ramp's extent alone, rather than its old values going through the
new scale. The worker keeps at most `MAX_LEGEND_CANDIDATES` painted pairs a
region, as the candidates it shipped before, so a field valued per feature
costs the key nothing past the bound.

**Only `color.value` and `color.field` reach the worker** (`WorkerColor`, picked
in `pickDisplayConfig`), so they are the colour's whole share of the cache key.

**FeatureColor takes `linear` and `log`**, with `scheme`, `reverse`,
`domainMid`, `domainMin` and `domainMax` from display-kit's ramp slots. An open
end follows the values the loaded regions carry (`colorValueExtent`), the ramp
is core's `continuousColorScale`, which the mark encoder now paints through as
well, and the key is one gradient row titled with the field. The extent and the
encoding compare by value, so a region committing inside the extent, a pinned
pair of ends or a key-only edit hands the encode the same palette. A feature with no
value paints the no-value grey and text that is no number the misconfiguration
grey, as under a threshold.

**`score` paints a ramp while `scale` is unset** (`FEATURE_FIELD_SCALES`,
through `featureColorEncoding`), since a score is a number on every format that
carries one, and any other field stays categorical.

**The key is the colour object's to name.** FeatureColor takes `labels`,
naming each `domain` value in the key, one each in order, as ggplot2's
`labels` name a scale's breaks; `categoricalField` carries them, so the key and
anything else reading the field agree, and MarkColor takes them too, through
the categorical scale table. A `labels` longer than the domain, or under
another scale, is a corner notice (`labels-domain`). It takes the `title`
MarkColor already had, display-kit's `colorTitleSlot`, unset heading the key
with the field and `""` heading it with nothing. A value written for a reader is then the scale's,
and a hand-typed list of labels and colours beside a `jexl:` colour has no
case left on this display, so its `legend` slot goes.

**The multi-row feature display takes the same object.** Its `color` was a
bare `maybeColor` with a flat `colorDomain` beside it, and the field a picture
was about could be read back only by a regex over the `jexl:` string. It is
FeatureColor now, composed through the same `featureColorViews`: its worker
ships each feature's field value and the partition row it lands in, its encode
paints values through `fieldPalette`, its key derives from them, and clustering
under `auto` takes the field the colour names. `colorDomain` is `color.domain`.
Its `legend` slot stays for the case no field names — a file's own `itemRgb`
relabelled — which in grammar terms is an identity scale with labels.

**The multi-way gene colour is its own object, `MultiWayGeneColor`**, over
`DISCRETE_COLOR_SCALES`. It paints genes through `geneColors` on its own path,
which has no extent to follow, and a display declares the scales it paints.

## Consequences

- A recolour of a named field refetches nothing; naming a new field still
  refetches, for the values it reads.
- An unpinned ramp re-encodes every loaded region when a new region widens the
  extent, which is a pass over a colour lane per region, and the domain still
  grows as the user pans (ADR-124).
- The worker reads the named field for every box even while `scale` is `none`,
  which is the cost of Default and back being instant.
- The ramp key carries no row for the no-value grey.
- The multi-way gene colour paints no ramp.

## Rejected alternatives

- **Values in the class lane.** A per-region value index there needs a
  per-region class table beside the shared theme table and runs out at 255
  classes; a lane of its own is empty (length 0) wherever no field is named.
- **A numeric lane for ramps beside an index lane for categories.** The index
  over distinct value texts serves every scale: a threshold and a ramp read the
  number off the text once per distinct value rather than once per box.
- **Keeping the worker's resolution and sending a recolour's scale as a
  zoom-style argument.** It still re-walks every feature to repaint what the
  main thread can repaint from a table, and it leaves the ramp's domain per
  region.
