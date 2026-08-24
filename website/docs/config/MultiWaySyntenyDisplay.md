---
id: multiwaysyntenydisplay
title: MultiWaySyntenyDisplay
sidebar_label: Display -> MultiWaySyntenyDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`linear-comparative-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/configSchema.ts).

## Example usage

Selected on a multi-genome `SyntenyTrack` (an `MCScanBlocksAdapter` listing
several assemblies) shown in a plain linear genome view. Draws one lane per
assembly in that assembly's own local coordinate frame — non-anchored, like the
multi-sample variant matrix — with ribbons connecting each gene's placements
between adjacent lanes:

```js
{
  type: 'SyntenyTrack',
  trackId: 'grape_peach_cacao',
  name: 'grape/peach/cacao orthologs',
  assemblyNames: ['grape', 'peach', 'cacao'],
  adapter: {
    type: 'MCScanBlocksAdapter',
    uri: 'grape.blocks',
    blockAssemblies: ['grape', 'peach', 'cacao'],
    bedLocations: [
      { uri: 'grape.bed' },
      { uri: 'peach.bed' },
      { uri: 'cacao.bed' },
    ],
    assemblyNames: ['grape', 'peach', 'cacao'],
  },
  displays: [
    {
      type: 'MultiWaySyntenyDisplay',
      displayId: 'grape_peach_cacao-MultiWaySyntenyDisplay',
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Adapter:** [AllVsAllIndexedPAFAdapter](../allvsallindexedpafadapter)
- **Adapter:** [AllVsAllPAFAdapter](../allvsallpafadapter)
- **Adapter:** [BlastTabularAdapter](../blasttabularadapter)
- **Adapter:** [ChainAdapter](../chainadapter)
- **Adapter:** [DeltaAdapter](../deltaadapter)
- **Adapter:** [MashMapAdapter](../mashmapadapter)
- **Adapter:** [MCScanAnchorsAdapter](../mcscananchorsadapter)
- **Adapter:** [MCScanBlocksAdapter](../mcscanblocksadapter)
- **Adapter:** [MCScanSimpleAnchorsAdapter](../mcscansimpleanchorsadapter)
- **Adapter:** [PAFAdapter](../pafadapter)
- **Adapter:** [PairwiseIndexedPAFAdapter](../pairwiseindexedpafadapter)
- **State model:** [runtime API](../../models/multiwaysyntenydisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

These slots go on a display entry:
`"displays": [{ "type": "MultiWaySyntenyDisplay", ... }]`, or in the track's
[`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this
is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained
in the [config slot types reference](/docs/config_guides/slot_types). Slots a
base configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'goldenrod'</code> | the fill color of the gene glyphs, matching the canvas gene track default<br>_callback args:_ `feature` |
| <span id="slot-utrcolor">**utrColor**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#357089'</code> | the fill color of the untranslated parts of a gene glyph, matching the canvas gene track default<br>_callback args:_ `feature` |
| <span id="slot-ribboncolor">**ribbonColor**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'rgba(130,130,130,0.3)'</code> | the color of the ribbons connecting adjacent lanes |
| <span id="slot-drawcurves">**drawCurves**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the ribbons as bezier curves rather than straight chords, the same setting the linear synteny view spells `drawCurves`. Straight is the default there and here: a chord's slant reads directly as the offset between two lanes drawn in different coordinate frames, which is exactly what a curve hides |
| <span id="slot-showlaneticks">**showLaneTicks**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw each lane's own coordinate ticks, at one interval shared by every lane. Equal spacing between two lanes means equal bp-per-pixel; a lane whose ticks crowd together is zoomed out. Turning this off leaves the header's span and multiple as the only scale statement |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>240</code> | overrides the base schema's 100, which divides into a lane stack at the glyph-height floor with the headers colliding into the glyphs |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">5 slots</span> |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message<br>_advanced_ |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config |
