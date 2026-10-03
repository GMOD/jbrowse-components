---
id: multiwaygenecolor
title: MultiWayGeneColor
sidebar_label: Display -> MultiWayGeneColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/geneColorConfigSchema.ts).

## Example usage

```js
{ type: 'MultiWaySyntenyDisplay', color: { field: 'cluster' } }
```

_See the **Config slots** section below for all available configuration fields._

The multi-way synteny display's gene `color`: a CSS colour or `jexl:`
callback in `value`, or a field whose values each take a range colour, or
whose numbers each take the colour of the interval between cut points they
fall in, with a key. A string is the constant; the object binds the field.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "MultiWayGeneColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>`maybeColor` | A CSS colour, or a jexl callback over `feature` returning one; unset, goldenrod.<br>_callback args:_ `feature` |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | a feature field, or a jexl expression over feature, whose values each paint one range colour with a key; cluster paints a gene by the ortholog group it carries and a placement box by its own |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) | none paints value and keeps the field for a switch back; categorical a range colour per value of field; threshold a range colour per interval between the cut points in domain; unset follows field |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | the values that take the range first, in order; a value left out takes a colour no listed value or value met before it paints, the first time the track shows it, and keeps it. Under threshold, the ascending cut points, a value on a cut taking the interval above it |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colours the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts |
| <span id="slot-labels">**labels**</span><br>`stringArray` = <code>[]</code> | what the key names each domain value, one each in order, or under threshold each interval from the lowest; one past the list keeps its own name |
| <span id="slot-title">**title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
