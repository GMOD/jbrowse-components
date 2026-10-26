---
id: featuresubfeaturelabels
title: FeatureSubfeatureLabels
description: "The feature display's labels.subfeatures, the names of a feature's parts: a gene's transcripts, a container's children, a polyprotein's cleavage products. collapsed draws none."
sidebar_label: Display -> FeatureSubfeatureLabels
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/featureSubfeatureLabelsConfigSchema.ts).

The feature display's `labels.subfeatures`, the names of a feature's parts:
a gene's transcripts, a container's children, a polyprotein's cleavage
products. `collapsed` draws none.

## Example usage

```js
{ type: 'LinearBasicDisplay', labels: { subfeatures: { placement: 'below' } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the names of a feature's parts |
| <span id="slot-placement">**placement**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, below, overlay) = <code>'auto'</code> | `auto` names a polyprotein's cleavage products on their rows and no other part; `below` and `overlay` name every part, under its row or over it |
