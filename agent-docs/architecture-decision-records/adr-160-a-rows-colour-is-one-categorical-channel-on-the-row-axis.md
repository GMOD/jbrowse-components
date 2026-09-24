---
status: Accepted
summary: "A row display's `rowColor` is one categorical colour channel on the row axis, display-kit's `RowColor`: `field | { field, scale, domain, range }` on the quantitative, multi-row feature, multi-sample variant, MAF and mark displays, `field` naming a row attribute and defaulting to `name`, the row itself, and `domain`/`range` pairing that field's values with colours, one keyspace per object. `VariantRowColor` folds into it. One dealer, `dealRowColors`, hands a listed value its `range` colour and every other value the next colour of one cursor over the spare `range` then the palette, which wraps; no hash. `TreeSidebarMixin` deals once per change to the rows (`rowColorDeal`, `rowColorScale`), by default over the base arrangement so no reorder, focus or relabel recolours a row. In this step each display hands in the order and palette it dealt before, so every pixel stays; each display still paints the palette in its own `sources`. A dialog recolour where `rowColor` paints by an attribute turns every row's colour into a `name` pair. A capture can replace the dealt palette through `window.jbrowseRowPalette`"
---

# ADR-160: A row's colour is one categorical channel on the row axis

## Status

Accepted (2026-09-23). The first half of step 4 of
[one-row-model-for-displays-that-stack-by-a-key](../ideas/ready/one-row-model-for-displays-that-stack-by-a-key.md)
("Colour, after the rows"), gated on a zero image diff. Builds on
[ADR-157](adr-157-a-row-displays-arrangement-is-the-rows-config-object.md),
which put the row colours in `rowColor`, and applies
[ADR-131](adr-131-a-categorical-channel-is-one-config-object.md) and
[ADR-135](adr-135-the-colour-objects-share-one-shape-and-a-preset-is-a-field.md)'s
channel object to the row axis. Amends ADR-153's colour-per-source sentence and
ADR-157's "pairs, which the palette still beats".

## Context

After ADR-157 the four row displays kept a reader's row colours as
`rowColor: { domain, range }` pairs by row name, and the variant displays'
`VariantRowColor` added a `field` beside them, so one object held two
keyspaces: sample names in `domain`, and a samplesTsv column whose values the
palette tinted over them. Three displays dealt a palette, each with its own
dealer: wiggle's `buildPaletteColors` (groups first on one cursor over the
colour's `range` then `set1`, then the ungrouped subtracks in the arranged
order), multi-row's `resolveRowColorStrings` (`categoricalPalette` by position
in the declared order) and the variant displays' `colorByPalette` (values
ranked by how many samples carry them, `randomColor` past the palette's end).

## Decision

**`rowColor` is display-kit's `RowColor`**:
`field | { field, scale, domain, range }`, from `colorChannelSlots` over
`none | categorical` with `field` defaulting to `name`, `colorDomainSlot` and
`colorRangeSlot`, `shorthand: 'field'`, `closed`, and the `normalizeChannel`
check. It has no `value` and no `scheme`: a categorical scale takes `range`
alone (ADR-151). `field` names a row attribute: `name` is the row itself, and
on the variant displays a samplesTsv column. `domain` holds that field's values
and `range` their colours, so a colour a reader sets on a row is an entry under
`name`, and `rowColor: 'population'` is the categorical channel on the row
axis.

**One keyspace per object.** A domain cannot outlive its field (ADR-131), so
Color by → an attribute writes the object through `colorForField` and starts
with no entries, and Color by → none is `scale: 'none'` keeping the field for
the way back (ADR-135, ADR-154). Where `rowColor` paints by an attribute, a
dialog recolour wrote `field: 'name'` and every row's current colour as pairs,
so the rows the reader left alone kept theirs: about 60 KB for 2,500 rows,
twice that for phased haplotypes, and 75-160 ms to write the 5,000 phased
pairs into a session. ADR-163 replaced that: the dialog edits a value's colour
under an attribute and reads a row's swatch only under `name`.

**One dealer.** `dealRowColors(order, { domain, range }, palette)`, beside
`pairedColorsOf`: a value `domain` lists takes its `range` entry, and every
other value, first seen in `order`, takes the next colour of one cursor over
the `range` entries past the domain and then `palette`, which wraps. No hash
and no `randomColor`: a hash over discovered rows collides.

**It runs once per change to the deal.** `TreeSidebarMixin.dealtRowColors`, a
colour per value, reads the `rowColorDeal` hook alone, and `rowColorScale` looks
each of `expandedRows` up in it by its value, by row name. A phased variant
display re-expanded its haplotypes on every region arrival, so a deal and a
per-row map computed together, then compared structurally, cost 34-78 ms an
arrival at 2,500 samples under a Color by; the split leaves the lookup, and
the census counts both. The expansion now reads `samplePloidy`, which keeps
its identity across arrivals, so an arrival re-derives no row at all. The default deal is the
design's: the values of `rowColor.field` over the base arrangement
(`orderRowsByDomain(expandedRows, baseRowDomain)`), so no reorder, focus or
relabel recolours a row. Nothing in a display's render state, GPU props,
encode or hit test reads it differently.

**Every pixel stays in this step**, because each display hands in the order
and palette it dealt before:

| display   | order                                                                                                 | palette                               |
| --------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------- |
| wiggle    | groups first as they appear, then for a colour per source the ungrouped subtracks, in the arranged order | the colour's `range`, then `set1`     |
| multi-row | the base arrangement, every row taking a turn, one with an entry included                            | `categoricalPalette`                  |
| variants  | the attribute's values by how many samples carry them                                               | `rowColor`'s entries, then `categoricalPalette` |
| MAF       | none                                                                                                  | none                                  |
| mark      | none                                                                                                  | none                                  |

Each still paints the palette in its own `sources`: wiggle on the plot, or on
the label under a score gradient, after the row's own colour; multi-row on the
blocks only while no `color` slot and no `itemRgb` paint; the variant displays
on the label. The `name` pairs keep going through `arrangeRows`' relabel pass
onto `editableSources`, the arrangement dialog's list.

**One precedence, one deviation.** An explicit entry, then the row's own
colour, then the palette. The variant displays deviate: their attribute palette
beats a samplesTsv `color` column. The flip commit makes them follow the one
precedence, with the palette choice below.

**"Reset row order" counts the colours set row by row.** `rowStylingIsCustom`
compares the `name` pairs of the live object and the base's (an object painting
by an attribute sets none), and `resetRowStyling` writes the base's whole
object back where they differ. So over a config that sets no row colour, a
Color by alone is not a custom arrangement and survives a reset and a
rendering-mode switch, and pairs a recolour materialised from a configured
attribute return to that attribute.

**The target stays a display fact**: `identityChannel`, as ADR-157 landed it.

**A capture can swap the palette.** `dealRowColors` reads
`window.jbrowseRowPalette` once, when its module loads: a palette name
(`set1`, `categoricalPalette`, `tableau10`, `schemeSet2`, `okabeIto`,
`tolBright`, `tolMuted`, `tableau20`, `relit`) or a comma-separated colour list
(`paletteFromSpec`). Every deal then takes that palette. A puppeteer capture
sets it with `evaluateOnNewDocument`, which `generate-screenshots.ts` already
calls for `freezeAnimations`; production pays one property read at load.

## Consequences

- A variant display's config writing `{ field: 'population', domain: [samples],
  range }` now lists population values in `domain`. Only
  `portableSettings.test.ts` wrote one; every config, spec, tutorial and
  `test_data` file writes pairs with no field, or a bare field.
- Color by → an attribute drops the pairs a reader set, and Color by → none
  does not bring them back.
- Over a config that sets row colours, a Color by hides them and so counts as
  custom: a reset or a rendering-mode switch returns the pairs and drops the
  Color by. No shipped config sets pairs on a variant display.
- A dialog tint under a Color by the reader picked left no attribute to
  return to, until ADR-163 made the dialog edit the attribute's values instead.
- Past the palette's end the variant displays wrap rather than draw
  `randomColor`, which only a track with more than 40 distinct values reaches.
- On wiggle, under a colour per source, a subtrack named like a group takes
  that group's colour.

What follows: the flip commit, once the side-by-side capture decides the
palette, deals every display over the base arrangement (so a wiggle drag no
longer recolours) and brings the variant displays to the one precedence. Then
the legend reads the channel, which retires `colorRowLabels` and
`rowGroups[].color`.

## Rejected alternatives

- **The palette in `arrangeRows`' relabel pass.** That pass paints one channel
  at one precedence, and wiggle's gradient label and the variant displays'
  palette each need another. It also puts dealt colours in `editableSources`,
  the dialog's list, which the variant displays' derivation suite pins free of
  them.
- **A dealt-order option on `categoricalScale`.** Its listed rule dedupes the
  fallback against `range` and skips near colours, and wiggle's `range` then
  `set1` repeats; sharing one rule moves one side's pixels.
- **"Reset row order" over the whole object.** A Color by would count as an
  arrangement, and a rendering-mode switch, which resets the arrangement,
  would revert it.
- **`name` pairs beside an attribute field**, `VariantRowColor`'s shape. A
  domain outlives its field.
