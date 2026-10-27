---
id: featurenamelabel
title: FeatureNameLabel
description: "The feature displays' labels.name, the name drawn beside each feature: whether it shows, and the field it reads. A bare string is the field."
sidebar_label: Display setting -> FeatureNameLabel
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `features` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/features/src/LinearBasicDisplay/featureNameLabelConfigSchema.ts).

The feature displays' `labels.name`, the name drawn beside each feature:
whether it `show`s, and the `field` it reads. A bare string is the field.
Shown names still hide where features crowd the screen, except gene names
while the genes alone have room.

## Example usage

```js
{ type: 'LinearBasicDisplay', labels: { name: 'gene_name' } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw a name beside each feature |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>'jexl:get(feature,'name') &#124;&#124; get(feature,'id')'</code> | the field the name reads, such as `gene_name`, or a `jexl:` expression over `feature`; the default reads the name, else the ID, and an empty value draws no name |
