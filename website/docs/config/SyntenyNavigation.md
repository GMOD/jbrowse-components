---
id: syntenynavigation
title: SyntenyNavigation
description: "The linear synteny view's navigation: how a move on one genome row carries to the others."
sidebar_label: View -> SyntenyNavigation
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyView/navigationConfigSchema.ts).

The linear synteny view's `navigation`: how a move on one genome row
carries to the others. With `follow` on, the rows follow the `anchor` row
through the alignment, each moving to whatever region aligns to its window.

## Example usage

```js
{ type: 'LinearSyntenyView', navigation: { follow: true, anchor: 1 } }
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-follow">**follow**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | the other rows follow the anchor row through the alignment; a drag or zoom on a row makes it the anchor |
| <span id="slot-anchor">**anchor**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | the genome row, counted from the top, the others follow |
