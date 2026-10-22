---
id: multiwayribbons
title: MultiWayRibbons
description: "The multi-way synteny display's ribbons: the bands joining each gene's placements in adjacent lanes."
sidebar_label: Display -> MultiWayRibbons
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/ribbonsConfigSchema.ts).

The multi-way synteny display's `ribbons`: the bands joining each gene's
placements in adjacent lanes.

## Example usage

```js
{ type: 'MultiWaySyntenyDisplay', ribbons: { encoding: { color: 'identity' } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-encoding">**encoding**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ConfigurationSchema( 'MultiWayRibbonsEncoding', { color: ribbon…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ConfigurationSchema(&#10;&#160;&#160;'MultiWayRibbonsEncoding',&#10;&#160;&#160;{&#10;&#160;&#160;&#160;&#160;color: ribbonColorConfigSchema,&#10;&#160;&#160;},&#10;&#160;&#160;encodingOptions,&#10;)</code></pre></dialog></span> | The channels each ribbon paints through. |
| <span id="slot-color">**color**</span><br>[RibbonColor](../ribboncolor) | `{ value }` paints every ribbon; `"strand"` the record's strand, `"identity"` a preset ramp and `"group"` a declared column. |
