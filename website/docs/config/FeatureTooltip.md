---
id: featuretooltip
title: FeatureTooltip
description: "The canvas feature displays' tooltip, the box hovering a feature opens: whether it shows, and the field its text reads. A bare string is the field."
sidebar_label: Display setting -> FeatureTooltip
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `features` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/features/src/LinearBasicDisplay/featureTooltipConfigSchema.ts).

The canvas feature displays' `tooltip`, the box hovering a feature opens:
whether it `show`s, and the `field` its text reads. A bare string is the
field.

## Example usage

```js
{
  type: 'LinearBasicDisplay',
  tooltip: "jexl:get(feature,'name') + ' ' + get(feature,'biotype')",
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Off, hovering still highlights the feature and "Copy tooltip text" still copies it. |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | Left at the default, the tooltip adds the description line (`labels.description`) as a second row. |
