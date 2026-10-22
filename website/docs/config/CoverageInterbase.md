---
id: coverageinterbase
title: CoverageInterbase
description: "The coverage band's interbase layer: the insertion and clip count bars and their indicator triangles, drawn between the bases they sit between."
sidebar_label: Display -> CoverageInterbase
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/alignments-core/src/coverageInterbaseConfigSchema.ts).

The coverage band's `interbase` layer: the insertion and clip count bars
and their indicator triangles, drawn between the bases they sit between.

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', coverage: { interbase: { show: false } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the insertion and clip count bars and their indicator triangles |
