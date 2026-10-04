---
id: syntenycolor
title: SyntenyColor
sidebar_label: View -> SyntenyColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyColorConfigSchema.ts).

## Example usage

```js
{ type: 'LinearSyntenyView', color: { field: 'strand' } }
```

```js
{ type: 'DotplotView', color: { field: 'query' } }
```

```js
{ type: 'LinearSyntenyView', color: { field: 'identity', scheme: 'magma', domainMin: 0.9 } }
```

```js
{
  type: 'LinearSyntenyView',
  color: {
    field: 'gene_group',
    domain: ['A1a', 'B1'],
    range: ['#1b9e77', '#d95f02'],
    labels: ['Subgenome A', 'Subgenome B'],
    title: 'Gene group',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

The linear synteny and dotplot views' `color` setting, which every track
in the view paints with: one colour for every alignment, or a field each
alignment carries — its strand, the sequence at either end, the anchor
assembly's, the track it came from, a measurement on its preset ramp
(`identity`, `mapq`, `dnds`), or a column the tracks declare in
`attributeColumns`. A string is the constant.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>`maybeColor` | The colour of every alignment under the `none` scale, in place of the view's default scheme: the match block of a synteny ribbon, whose insertions and deletions keep their colours, or a dotplot point. Writing `color: "grey"` lands here. Unset, the default scheme paints. |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | what colours an alignment: strand paints forward and reverse; query and target one colour per sequence on that side, reference one per chromosome of the anchor assembly across a stack, track one per overlaid track (pinned under Track colors); identity, mapq and dnds paint the preset ramps; any other name is a column the tracks declare in attributeColumns, a ramp over the values seen for numbers and one colour per label for text (or the colour a color column put beside it) |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none) | none paints value and keeps the field for a switch back; unset, a field paints |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | a text column's labels that take the palette first, in order, and lead the key, the rest following sorted; a label left out takes a colour no listed label or label met before it paints, the first time the view meets it, and keeps it |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colours a text column's labels take, in domain order, continuing into the default palette past its end; with no domain, each label takes one of them by its name; on a ramp (identity, mapq, dnds or a numeric column), its stops, evenly spaced, in place of the field's own |
| <span id="slot-scheme">**scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue) | a named ramp for a linear or log scale; range's colours, where it lists any, win over it |
| <span id="slot-reverse">**reverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | turns a linear or log scale's ramp round, so its last colour paints the bottom of the domain |
| <span id="slot-domainmid">**domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end colour and equal distances from the middle take equal colours; unset, the stops are evenly spaced across it |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of a linear or log scale's domain; unset follows the loaded values |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of a linear or log scale's domain; unset follows the loaded values |
| <span id="slot-labels">**labels**</span><br>`stringArray` = <code>[]</code> | what the key names each domain value, one each in order, or under threshold each interval from the lowest; one past the list keeps its own name |
| <span id="slot-title">**title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
