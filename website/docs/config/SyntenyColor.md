---
id: syntenycolor
title: SyntenyColor
sidebar_label: View -> SyntenyColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyColorConfigSchema.ts).

## Example usage

```js
{ type: 'LinearSyntenyView', colorBy: { field: 'strand' } }
```

```js
{ type: 'DotplotView', colorBy: { field: 'query' } }
```

```js
{
  type: 'LinearSyntenyView',
  colorBy: { field: 'gene_group', domain: ['A1a', 'B1'] },
}
```

_See the **Config slots** section below for all available configuration fields._

The linear synteny and dotplot views' `colorBy` setting, which every track
in the view paints with: one colour for every alignment, or a field each
alignment carries — its strand, the sequence at either end, the anchor
assembly's, the track it came from, a measurement on its preset ramp
(`identity`, `mappingQual`, `dnds`), or a column the tracks declare in
`attributeColumns`. A string is the constant.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>`maybeColor` | The colour of every alignment under the `none` scale, in place of the view's default scheme: the match block of a synteny ribbon, whose insertions and deletions keep their colours, or a dotplot point. Writing `colorBy: "grey"` lands here. Unset, the default scheme paints. |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | what colours an alignment: strand paints forward and reverse; query and target one colour per sequence on that side, reference one per chromosome of the anchor assembly across a stack, track one per overlaid track (pinned under Track colors); identity, mappingQual and dnds paint the preset ramps; any other name is a column the tracks declare in attributeColumns, a ramp over the values seen for numbers and one colour per label for text (or the colour a color column put beside it) |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none) | none paints value and keeps the field for a switch back; unset, a field paints |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | a text column's labels that take the palette first, in order, and lead the key, the rest following sorted; a label left out keeps a colour derived from itself that no listed label paints, so every window and session agrees on it |
