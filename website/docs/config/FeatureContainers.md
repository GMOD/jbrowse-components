---
id: featurecontainers
title: FeatureContainers
description: "The feature display's containers: the top-level types whose children always stack on rows of their own, as a proteoform's ORFs do."
sidebar_label: Display setting -> FeatureContainers
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/featureContainersConfigSchema.ts).

The feature display's `containers`: the top-level types whose children
always stack on rows of their own, as a proteoform's ORFs do.

## Example usage

```js
{ type: 'LinearBasicDisplay', containers: { types: ['proteoform_orf'] } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-types">**types**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>['proteoform_orf']</code> | The container types; each also counts as `geneLike`. |
