---
status: Accepted
summary: "Every display turns its colour object into what it paints through display-kit's `colorEncodingOf`, the bridge ADR-151 gave the mark and Manhattan displays: the quantitative, alignments, canvas feature and multi-way gene colours and synteny's `paintedField` read the `ColorEncoding` it answers, a display's `colorEncoding` getter, and keep only their own painting. Each display names a default scale per field and nothing else. The quantitative display's `field` is `score | source`, a pairing its two-sided layers cannot paint draws the misconfiguration grey, a threshold parts at its lowest cut, and a colour per source hands out its `range` in its `domain`'s order. The alignments displays' insert-size fields default to `threshold`, so their `domain` is that scale's cuts"
---

# ADR-153: Every display resolves its colour through one function

## Status

Accepted (2026-09-21). Extends
[ADR-151](adr-151-a-channels-scale-is-spelt-as-scales-y-spells-one.md)'s one
bridge from two displays to every display holding a colour object. Narrows the
quantitative display's `field` from
[ADR-144](adr-144-one-colour-object-on-the-quantitative-display.md) and the
alignments insert-size `domain` from
[ADR-148](adr-148-the-alignments-read-fill-is-the-colour-object.md).

## Context

One colour object is shared by the mark, quantitative, alignments, Manhattan,
canvas feature and multi-way displays, and six functions read it. The mark and
Manhattan displays went through `colorEncodingOf`; the quantitative display
(`resolveWiggleColor`), the alignments displays (`bakedColorScale`,
`colorByOf`), the canvas feature display (`featureColorScale`), the multi-way
gene colour (`geneColorScale`) and synteny (`paintedField`) each re-read
`scale`, `field` and `domain` themselves. They disagreed:

- The quantitative display never read `field` as a variable.
  `{ field: 'pvalue', scale: 'threshold' }` painted the score, and
  `{ field: 'score', scale: 'categorical' }` a colour per source.
- Its threshold parted at the first cut as written, where the encoder and the
  alignments bake sort the cuts first.
- Its colour per source ignored `range` and `domain`, which its slot docs said
  it hands out.
- The alignments displays read a categorical `domain` under an insert-size
  field as the two cut points, a threshold's meaning under a categorical scale.

## Decision

**`colorEncodingOf(color, fieldScale)` is the one resolver.** It answers the
object's `value` while no field paints, `undefined` where that `value` is unset
and the display falls back to its own default, and otherwise the field through
the scale that paints it, `fieldScale` beside a field naming none. Each display
holding a colour object exposes the answer as a `colorEncoding` getter, and its
painter reads that: the quantitative display's pos/neg uniforms, the alignments
per-read bake and scheme dispatch, the canvas worker's walk, the multi-way gene
fills and synteny's runtime modes. `categoricalColorField` turns a categorical
encoding into the `categoricalField` the canvas and multi-way walks key with,
the one function the identical `featureColorScale` and `geneColorScale` were.
What stays in a display is how it paints, never which scale it reads.

**Each display names its default scale per field, and nothing else.** The mark
display and the canvas feature, multi-way and synteny colours answer
`categorical`; Manhattan `threshold` over `ld`; the quantitative display
`categorical` over `source` and `threshold` over `score`; the alignments
displays `threshold` over `insertSize` and `insertSizeAndOrientation`, and
`categorical` over any other field.

**The quantitative display's `field` is an enumeration of `score` and
`source`.** A type may be refused where a combination may not
([ADR-133](adr-133-a-channel-objects-slots-are-each-valid-alone.md)), and a
wiggle colours per signal, so no other name has a value to read. Of the pairs
left, `source` paints through `categorical` and `score` through the other
three. The layers part into two sides of one value and a source's row takes one
colour, so a colour per distinct score, or a cut or ramp over subtrack names,
has nothing to paint with: those pairs draw `MISCONFIGURED_COLOR`
(`@jbrowse/core/util/color`), the grey the encoder already paints for a `jexl:`
colour yielding no string and a ramp value that is not finite.

**A threshold parts at its lowest cut** (`declaredCut`), on the plot and in the
key, because `thresholdCuts` sorts the cuts for every threshold scale.

**A colour per source hands out its `range`, then the default palette**, from
the one cursor that serves the subtrack groups first and then the ungrouped
subtracks, those its `domain` lists ahead of the rest (`sourcePalette`,
`buildSources`).

**An insert-size `domain` is a threshold's cuts.** The field's default scale
is `threshold`, so `{ field: 'insertSize', domain: ['150', '600'] }` pins as it
did, cuts written high to low pin too, and a `domain` under an explicit
`categorical` scale is an order and pins nothing.

## Consequences

- The canvas feature display's `colorEncoding` is the resolved
  `ColorEncoding`, and the `categoricalField` it used to answer is `colorField`.
  The variant display's preset legends read
  `colorEncoding === SV_TYPE_COLOR_JEXL`.
- The multi-way `geneColors` takes the encoding rather than the object.
- `bakedColorScale` takes the encoding, so a linear or threshold scale beside a
  mate reference waits unread rather than falling through to the declared
  categorical branch.
- Manhattan's `color` getter still resolves its menus' state through
  `paintedScale`; its painter already read `colorEncodingOf`.
- The mark display's rule list and plot dialog, and the Edit as JSON language,
  read the object as written and stay on `paintedScale`: they judge a
  declaration and paint nothing.

## Rejected alternatives

- **Painting a colour per distinct score.** The quantitative layers carry one
  colour per side of a cut, so it needs a per-instance colour lane on every
  rendering and a per-feature loop to fill it.
- **Refusing a pairing the quantitative display cannot paint.** ADR-133
  refuses no combination of slots, because the config editor writes one slot at
  a time.
