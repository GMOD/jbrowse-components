---
id: syntenycolor
title: SyntenyColor
description: "The linear synteny, dotplot and circular views' encoding.color, which every track in the view paints with: one color for every alignment, or a field of each alignment — its strand, the sequence at…"
sidebar_label: View -> SyntenyColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyColorConfigSchema.ts).

The linear synteny, dotplot and circular views' `encoding.color`, which
every track in the view paints with: one color for every alignment, or a
field of each alignment — its strand, the sequence at either end, the
anchor assembly's, the track it came from, a measurement through its preset
(`identity` and `dnds` on a ramp, `mapq` in the alignments display's bins,
`syntenicDepth` grey for a one-to-one ortholog and orange where genes share
one),
or a column the tracks declare in `attributeColumns`. A string is the
field.

## Example usage

```js
{ type: 'LinearSyntenyView', encoding: { color: 'strand' } }
```

```js
{ type: 'DotplotView', encoding: { color: { field: 'query' } } }
```

```js
{
  type: 'LinearSyntenyView',
  encoding: {
    color: { field: 'identity', scale: { scheme: 'magma', domainMin: 0.9 } },
  },
}
```

```js
{
  type: 'LinearSyntenyView',
  encoding: {
    color: {
      field: 'identity',
      scale: { type: 'threshold', domain: [0.95, 0.99] },
    },
  },
}
```

```js
{
  type: 'LinearSyntenyView',
  encoding: {
    color: {
      field: 'gene_group',
      scale: {
        domain: ['A1a', 'B1'],
        range: ['#1b9e77', '#d95f02'],
        names: ['Subgenome A', 'Subgenome B'],
      },
      legend: { title: 'Gene group' },
    },
  },
}
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | The color of every alignment while no field paints, in place of the view's default scheme: the match block of a synteny ribbon, whose insertions and deletions keep their colors, or a dotplot point. Unset, the default scheme paints. |
| <span id="slot-scale">**scale**</span><br>SyntenyColorScale sub-schema | How the field's values map to colors, Vega-Lite's scale object. |
| <span id="slot-legend">**legend**</span><br>SyntenyColorLegend sub-schema | The key this channel draws. |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | field to color each alignment by: strand paints forward and reverse; query and target one color per sequence on that side, reference one per chromosome of the anchor assembly across a stack, track one per overlaid track (pinned under Track colors); identity and dnds paint their preset ramps, mapq its bins and syntenicDepth grey for a one-to-one MCScan .anchors or .blocks link and orange where genes share an ortholog; any other name is a column the tracks declare in attributeColumns, a ramp over the values seen for numbers and one color per label for text (or the color a color column put beside it) |
