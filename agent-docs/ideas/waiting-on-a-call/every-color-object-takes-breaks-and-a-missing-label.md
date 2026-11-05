---
name: every-color-object-takes-breaks-and-a-missing-label
description: Only the mark display's color object takes `legend.values` and `legend.missingLabel`. Adding them to the other color objects is additive and can follow 5.0.0, once someone says which keys want them.
---

# Every color object takes `legend.values` and a missing label

The mark display's `color` declares `legend.values`, the values its
categorical key lists and their order, and `legend.missingLabel`, the key's
name for a feature with nothing in `field` (`markColorConfigSchema.ts`). The
source's rule is that the two join another color object only where its key would read them; the
alignments, canvas, variant and MAF color objects declare neither, so a config
spelling them there is refused as an undeclared key.

Adding them is additive: no slot path moves, so it can land after the 5.0.0
freeze (ADR-120). The call is which displays' keys want them.

`unknown`, d3's color for every value a `domain` leaves out, follows the same
rule: FeatureColor, MarkColor, VariantCellColor, ChordColor and
MultiWayGeneColor declare it, since their keys name its row Other through
`derivedColorScale`, and RowColor had it already. AlignmentsColor declares it
on a tag, attribute or mate-reference field, where `bakedColorScale` paints it
and `bakedValueLegend` keys it as Other. The synteny and MAF color objects
paint their categories through code of their own and join when that code reads
it.
