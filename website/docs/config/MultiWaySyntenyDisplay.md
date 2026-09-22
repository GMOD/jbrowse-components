---
id: multiwaysyntenydisplay
title: MultiWaySyntenyDisplay
sidebar_label: Display -> MultiWaySyntenyDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/configSchema.ts).

## Example usage

Selected on a multi-genome `SyntenyTrack` (an `MCScanBlocksAdapter` listing
several assemblies) shown in a plain linear genome view. Draws one lane per
assembly in that assembly's own local coordinate frame — non-anchored, like
the multi-sample variant matrix — with ribbons connecting each gene's
placements between adjacent lanes:

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
  },
  displays: [
    {
      type: 'MultiWaySyntenyDisplay',
      displayId: 'grape_peach_cacao-MultiWaySyntenyDisplay',
    },
  ],
}
```

The same display with a curated lane order, genes colored by ortholog
cluster, and ribbons colored by percent identity:

```js
{
  type: 'SyntenyTrack',
  trackId: 'primate_synteny',
  name: 'Primate synteny',
  assemblyNames: ['hg38', 'panTro6', 'gorGor6', 'ponAbe3'],
  adapter: {
    type: 'MCScanBlocksAdapter',
    uri: 'hg38.blocks',
    blockAssemblies: ['hg38', 'panTro6', 'gorGor6', 'ponAbe3'],
    bedLocations: [
      { uri: 'hg38.bed' },
      { uri: 'panTro6.bed' },
      { uri: 'gorGor6.bed' },
      { uri: 'ponAbe3.bed' },
    ],
  },
  displays: [
    {
      type: 'MultiWaySyntenyDisplay',
      displayId: 'primate_synteny-MultiWaySyntenyDisplay',
      domain: ['panTro6', 'gorGor6', 'ponAbe3'],
      color: { field: 'cluster' },
      ribbonColor: { field: 'identity' },
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Adapter:** [BlastTabularAdapter](../blasttabularadapter)
- **Adapter:** [ChainAdapter](../chainadapter)
- **Adapter:** [DeltaAdapter](../deltaadapter)
- **Adapter:** [MashMapAdapter](../mashmapadapter)
- **Adapter:** [MCScanAnchorsAdapter](../mcscananchorsadapter)
- **Adapter:** [MCScanBlocksAdapter](../mcscanblocksadapter)
- **Adapter:** [MCScanSimpleAnchorsAdapter](../mcscansimpleanchorsadapter)
- **Adapter:** [MultiGenomeIndexedPAFAdapter](../multigenomeindexedpafadapter)
- **Adapter:** [MultiGenomePAFAdapter](../multigenomepafadapter)
- **Adapter:** [MultiPairwiseSyntenyAdapter](../multipairwisesyntenyadapter)
- **Adapter:** [PAFAdapter](../pafadapter)
- **Adapter:** [PairwiseIndexedPAFAdapter](../pairwiseindexedpafadapter)
- **State model:** [runtime API](../../models/multiwaysyntenydisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "MultiWaySyntenyDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[FeatureColor](../featurecolor) | The gene glyphs' fill: a CSS color or `jexl:` callback, goldenrod unset, or `{ field }` to paint each value its own palette color with a key. `{ field: "cluster" }` paints a gene by the ortholog group it carries and a placement box by its own, so a group is one color down the stack; a gene no group claims is the no-value grey. |
| <span id="slot-utrcolor">**utrColor**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#357089'</code> | the fill color of the untranslated parts of a gene glyph, matching the canvas gene track default<br>_callback args:_ `feature` |
| <span id="slot-lodmode">**lodMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, fine, coarse) = <code>'auto'</code> | which stored tier of a tiered file is fetched: 'auto' switches on the adapter's bpPerPx threshold, 'fine' pins the per-row CIGAR tier, and 'coarse' the tier whose CIGAR is folded to its large indels |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | the lanes that stack first below the anchor, in order; the rest follow densest-first, so a ribbon chain through adjacent lanes is cut as late as possible. What the Lanes menu and a header drag write |
| <span id="slot-ribboncolor">**ribbonColor**</span><br>[RibbonColor](../ribboncolor) | `"rgba(130,130,130,0.3)"` paints every ribbon; `{ field: "strand" }` the record's strand, `{ field: "identity" }` a preset ramp and `{ field: "group" }` a declared column. |
| <span id="slot-hideunlabelled">**hideUnlabelled**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | under a text column, draw only the ribbons whose pair carries a label |
| <span id="slot-drawcurves">**drawCurves**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the ribbons as bezier curves rather than straight chords. A plain per-track slot: this display does not share the linear synteny view's view-level `drawCurves` override. Straight is the default in both places: a chord's slant reads directly as the offset between two lanes drawn in different coordinate frames, which is exactly what a curve hides |
| <span id="slot-bridgeskippedlanes">**bridgeSkippedLanes**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | join a group across a lane that places nothing for it, to the next lane down that does. A ribbon otherwise joins adjacent lanes only, so a sparse lane mid-stack cuts every chain running through it |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | show the color key: the anchor lane's drawn gene colors, and what `ribbonColor` paints — the strand colors, the identity ramp, or a column's labels. Derived from what is on screen, so a `color` slot resolving to one color and a ribbon scale painting nothing key nothing. Defaults to on |
| <span id="slot-showlaneticks">**showLaneTicks**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw each lane's own coordinate ticks, at one interval shared by every lane. Equal spacing between two lanes means equal bp-per-pixel; a lane whose ticks crowd together is zoomed out. Turning this off leaves the header's span and multiple as the only scale statement |
| <span id="slot-splitstrands">**splitStrands**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw each lane's genes in two rows either side of its line: the ones reading rightwards on screen above, leftwards below, so a flipped lane's genes turn over with it and a collinear block keeps one row down the stack |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>240</code> | overrides the base schema's 100, which divides into a lane stack at the glyph-height floor with the headers colliding into the glyphs |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">3 slots</span> |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
