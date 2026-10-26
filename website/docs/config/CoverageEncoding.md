---
id: coverageencoding
title: CoverageEncoding
description: "The coverage band's encoding: y, its depth axis, a YChannel. scale.constant starts at 1, which makes symlog exactly log(depth+1) with the knee at one read. scale.fenceQuantile stays at 1, the deepest…"
sidebar_label: Display setting -> CoverageEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/alignments-core/src/coverageEncodingConfigSchema.ts).

The coverage band's `encoding`: `y`, its depth axis, a
[YChannel](../ychannel). `scale.constant` starts at 1, which makes symlog
exactly `log(depth+1)` with the knee at one read. `scale.fenceQuantile`
stays at 1, the deepest base in view; the Coverage axis panel's Clip
extreme outliers writes 0.99, which stops the axis at twice the 99th
percentile of the covered bins' peaks.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  coverage: { encoding: { y: { scale: { type: 'log' } } } },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-y">**y**</span><br>[YChannel](../ychannel) | The depth axis: `scale`, `axis` and `rules`. |
