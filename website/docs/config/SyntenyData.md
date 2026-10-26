---
id: syntenydata
title: SyntenyData
description: "What a comparative fetch reads of a tiered file (a PIF built with a coarse tier), on the linear synteny, dotplot and circular views and the LGVSynteny and multi-way displays: resolution is the stored…"
sidebar_label: Display setting -> SyntenyData
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyDataConfigSchema.ts).

What a comparative fetch reads of a tiered file (a PIF built with a coarse
tier), on the linear synteny, dotplot and circular views and the
LGVSynteny and multi-way displays: `resolution` is the stored tier.

## Example usage

```js
{ type: 'LinearSyntenyView', data: { resolution: 'coarse' } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-resolution">**resolution**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, fine, coarse) = <code>'auto'</code> | the stored tier to fetch: 'auto' switches at the adapter's bpPerPx threshold, 'fine' pins the per-row CIGAR tier, 'coarse' the tier whose CIGAR is folded to its large indels |
