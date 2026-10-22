---
id: pileupbases
title: PileupBases
description: "The pileup's bases layer, a cell per base over the reads: show turns it on and encoding.color names what it paints. It draws while show is on and a field is named."
sidebar_label: Display -> PileupBases
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/pileupBasesConfigSchema.ts).

The pileup's `bases` layer, a cell per base over the reads: `show` turns it
on and `encoding.color` names what it paints. It draws while `show` is on
and a field is named.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  pileup: { bases: { show: true, encoding: { color: 'baseQuality' } } },
  encoding: { color: 'tags.HP' },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the per-base layer over the reads |
| <span id="slot-encoding">**encoding**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ConfigurationSchema( 'PileupBasesEncoding', { color: alignments…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ConfigurationSchema(&#10;&#160;&#160;'PileupBasesEncoding',&#10;&#160;&#160;{&#10;&#160;&#160;&#160;&#160;color: alignmentsBaseColorConfigSchema,&#10;&#160;&#160;},&#10;&#160;&#160;encodingOptions,&#10;)</code></pre></dialog></span> | The layer's channels: `encoding.color`, the per-base variable. |
| <span id="slot-encodingcolor">**encoding.color**</span><br>[AlignmentsBaseColor](../alignmentsbasecolor) | The per-base variable the layer paints. |
