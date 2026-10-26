---
id: coverageinterbase
title: CoverageInterbase
description: "The coverage band's interbase layer: the insertion and clip count bars and their indicator triangles, drawn between the bases they sit between. Its filter picks the positions that earn a triangle."
sidebar_label: Display setting -> CoverageInterbase
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/alignments-core/src/coverageInterbaseConfigSchema.ts).

The coverage band's `interbase` layer: the insertion and clip count bars
and their indicator triangles, drawn between the bases they sit between.
Its `filter` picks the positions that earn a triangle.

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', coverage: { interbase: { show: false } } }
```

```js
{
  type: 'LinearAlignmentsDisplay',
  coverage: { interbase: { filter: [{ field: 'fraction', gt: 0.1 }] } },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the insertion and clip count bars and their indicator triangles |
| <span id="slot-filter">**filter**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>fieldPredicateList({ defaults: Object.entries(DEFAULT_INTERBASE…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>fieldPredicateList({&#10;&#160;&#160;defaults: Object.entries(DEFAULT_INTERBASE_INDICATOR_RULE).map(&#10;&#160;&#160;&#160;&#160;([field, { min, strict }]) =&gt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;strict ? { field, gt: min } : { field, gte: min },&#10;&#160;&#160;),&#10;})</code></pre></dialog></span> | Which positions get an indicator triangle, by `depth`, the reads covering the position, and `fraction`, its insertions and clips as a share of that depth, each a floor written `gte` or `gt`. Unwritten, a field keeps its default, `depth` at least 8 and `fraction` above 0.3; an entry naming a field with no test, `{ field: 'depth' }`, drops that field's default. |
