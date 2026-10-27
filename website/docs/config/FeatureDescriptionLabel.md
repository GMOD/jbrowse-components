---
id: featuredescriptionlabel
title: FeatureDescriptionLabel
description: "The feature displays' labels.description, the line drawn under each feature's name: whether it shows, and the field it reads. A bare string is the field."
sidebar_label: Display setting -> FeatureDescriptionLabel
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/featureDescriptionLabelConfigSchema.ts).

The feature displays' `labels.description`, the line drawn under each
feature's name: whether it `show`s, and the `field` it reads. A bare string
is the field. Shown descriptions still hide where features crowd the
screen, a zoom step before names do, whether or not names draw.

## Example usage

```js
{ type: 'LinearBasicDisplay', labels: { description: { show: false } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw a description line under each feature |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'note') &#124;&#124; get(feature,'description') &#124;&#124; get(…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'note') &#124;&#124; get(feature,'description') &#124;&#124; get(feature,'function')'</code></pre></dialog></span> | the field the description reads, such as `note`, or a `jexl:` expression over `feature`; the default reads `note`, else `description`, else `function`, and an empty value draws no description |
