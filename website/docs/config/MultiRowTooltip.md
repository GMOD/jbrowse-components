---
id: multirowtooltip
title: MultiRowTooltip
description: "The multi-row display's tooltip: the  part whose field defaults to name, else the ID."
sidebar_label: Display setting -> MultiRowTooltip
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMultiRowFeatureDisplay/multiRowTooltipConfigSchema.ts).

The multi-row display's `tooltip`: the [](/docs/config/marktooltip) part
whose `field` defaults to `name`, else the ID. A field holding a block of
markup, such as ClinVar's `_mouseOver`, ships that block with every feature
in view, so the default stays the short name and a config opts in.

## Example usage

```js
{ type: 'LinearMultiRowFeatureDisplay', tooltip: '_mouseOver' }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Off, hovering a feature opens no box. |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>'name'</code> | The field the box's first line reads off the hovered feature, or a `jexl:` expression over `feature`; one that reads nothing names the feature by its ID. Empty names nothing. |
