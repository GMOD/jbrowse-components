---
id: sharedgccontentdisplay
title: SharedGCContentDisplay
sidebar_label: Display -> SharedGCContentDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gccontent`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/LinearGCContentDisplay/sharedConfigSchema.ts).

## Example usage

On a `ReferenceSequenceTrack` — no extra adapter needed, GC is derived from the
track's sequence adapter. `gcMode` is `content` or `skew`:

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'refseq',
  name: 'Reference sequence',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'IndexedFastaAdapter',
    uri: 'https://example.com/genome.fa',
  },
  displays: [
    {
      type: 'LinearGCContentDisplay',
      displayId: 'refseq-LinearGCContentDisplay',
      windowSize: 100,
      windowDelta: 100,
      gcMode: 'content',
    },
  ],
}
```

On a standalone `GCContentTrack` whose `GCContentAdapter` wraps a sequence
adapter (use this instead of the `ReferenceSequenceTrack` display when you want
GC as its own track):

```js
{
  type: 'GCContentTrack',
  trackId: 'gc',
  name: 'GC content',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GCContentAdapter',
    sequenceAdapter: {
      type: 'IndexedFastaAdapter',
      fastaLocation: { uri: 'https://example.com/genome.fa' },
      faiLocation: { uri: 'https://example.com/genome.fa.fai' },
    },
  },
  displayDefaults: { gcMode: 'skew', windowSize: 50, windowDelta: 10 },
}
```

_See the **Config slots** section below for all available configuration fields._

Shared config for the two GC content displays: `LinearGCContentDisplay` (on a
`ReferenceSequenceTrack`, deriving GC from the track's own sequence adapter) and
`LinearGCContentTrackDisplay` (on a standalone `GCContentTrack`). Both register
the same slots against different track types, so the slots live here once.

## Related links

- **Base config:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

These slots go on a display entry:
`"displays": [{ "type": "SharedGCContentDisplay", ... }]`, or in the track's
[`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this
is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained
in the [config slot types reference](/docs/config_guides/slot_types). Slots a
base configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-windowsize">**windowSize**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | Number of bases per GC measurement window. |
| <span id="slot-windowdelta">**windowDelta**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | Step between successive windows; smaller than `windowSize` means overlapping windows (a smoother signal). |
| <span id="slot-gcmode">**gcMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (content, skew) = <code>'content'</code> | `content` for GC percentage, `skew` for (G-C)/(G+C) strand skew. |
| <span id="slot-summaryscoremode">**summaryScoreMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (max, min, avg, whiskers) = <code>'avg'</code> | GCContentAdapter never emits real per-bin min/max, so the inherited 'whiskers' default has no summary to draw — it just forces posColor-only rendering (buildSourceRenderData skips the bicolor pos/neg split for whiskers) and hides negative GC-skew as if it were positive. |
| <span class="slot-group">Inherited from [LinearWiggleDisplay](../linearwiggledisplay)</span> | <span class="slot-group-count">5 slots</span> |
| <span id="slot-defaultrendering">**defaultRendering**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (xyplot, density, line, linecenter, scatter) = <code>'xyplot'</code> | Default rendering type: `xyplot`, `density`, `line`, `linecenter`, or `scatter`.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;"type": "LinearWiggleDisplay",&#10;&#160;&#160;"defaultRendering": "density"&#10;}</code></pre></dialog></span> |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | Default height of the track |
| <span id="slot-usebicolor">**useBicolor**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | When true (the default), positive scores use posColor and negative use negColor; when false, all bars use the single color slot. Setting color alone, with no posColor/negColor/useBicolor, turns this off for you. |
| <span id="slot-color">**color**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#0068d1'</code> | Single fill CSS color for the wiggle bars; a wiggle colors per signal, not per feature, so jexl callbacks do not apply. Set alone it implies useBicolor false; alongside posColor/negColor it goes unused. Density rendering always draws from posColor. |
| <span id="slot-minimalticks">**minimalTicks**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw only the min/max Y-axis ticks<br>_advanced_ |
