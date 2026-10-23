---
id: featureencoding
title: FeatureEncoding
description: "The canvas feature displays' encoding, the channels the features paint through."
sidebar_label: Display -> FeatureEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/featureEncodingConfigSchema.ts).

The canvas feature displays' `encoding`, the channels the features paint
through.

## Example usage

```js
{ type: 'LinearBasicDisplay', encoding: { color: 'gene_biotype' } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[FeatureColor](../featurecolor) | The main fill of each feature: `{ value }`, a CSS color or a jexl expression, or a field and the `scale` its values map through, with a key. |
