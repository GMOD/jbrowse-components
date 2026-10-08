---
id: chordcolor
title: ChordColor
description: "A variant chord's color: a CSS colour or jexl: callback in value for every chord, or a field of the record whose values each take a range colour, with a key on the circle. svType paints the…"
sidebar_label: Display -> ChordColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordVariantDisplay/models/chordColorConfigSchema.ts).

## Example usage

```js
{ type: 'ChordVariantDisplay', color: { field: 'svType' }, opacity: 0.45 }
```

_See the **Config slots** section below for all available configuration fields._

A variant chord's `color`: a CSS colour or `jexl:` callback in `value` for
every chord, or a `field` of the record whose values each take a range
colour, with a key on the circle. `svType` paints the structural-variant
classes the variant displays paint. A string is the constant.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'rgba(255,133,0,0.32)'</code> | A CSS colour, or a jexl callback over `feature` returning one, for every chord.<br>_callback args:_ `feature` |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | a record field, svType say, or a jexl expression over feature, whose values each paint one range colour with a key |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) | none paints value and keeps the field for a switch back; categorical a range colour per value of field; threshold a range colour per interval between the cut points in domain; unset follows field |
| <span id="slot-domain">**domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the values that take the range first, in order; under threshold, the ascending cut points, a value on a cut taking the interval above it |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colours the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts |
| <span id="slot-labels">**labels**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | what the key names each domain value, one each in order, or under threshold each interval from the lowest; one past the list keeps its own name |
| <span id="slot-title">**title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
