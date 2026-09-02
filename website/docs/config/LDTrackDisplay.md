---
id: ldtrackdisplay
title: LDTrackDisplay
sidebar_label: Display -> LDTrackDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/configSchemaLDTrack.ts).

## Example usage

```js
{
  type: 'LDTrack',
  trackId: 'ld',
  name: 'Linkage disequilibrium',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'PlinkLDTabixAdapter',
    uri: 'https://example.com/plink.ld.gz',
  },
  displays: [
    {
      type: 'LDTrackDisplay',
      displayId: 'ld-LDTrackDisplay',
      showLegend: true,
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

Linkage disequilibrium heatmap read from an `LDTrack`'s pre-computed file —
PLINK `--r2` output and the formats that follow it. JBrowse does not compute
LD from genotypes; run plink (or an equivalent) and point this at the result.

## Related links

- **Adapter:** [PlinkLDAdapter](../plinkldadapter)
- **Adapter:** [PlinkLDTabixAdapter](../plinkldtabixadapter)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LDTrackDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-linezoneheight">**lineZoneHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | Height of the zone for connecting lines at the top<br>_advanced_ |
| <span id="slot-ldmetric">**ldMetric**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (r2, dprime) = <code>'r2'</code> | Which of the file's columns to draw: 'r2' (R², the R2/PHASED_R2 column) or 'dprime' (D', the DP/ABS_DPRIME one). A file that carries only one of the two serves that one whichever is asked for, and reports which through the legend. |
| <span id="slot-showlegend">**showLegend**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>false</code> _promotable_ | Whether to show the legend. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false customizes the track. |
| <span id="slot-showldtriangle">**showLDTriangle**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Whether to show the LD triangle heatmap |
| <span id="slot-squashtoheight">**squashToHeight**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | When true, squash the LD triangle to fit the display height<br>_advanced_ |
| <span id="slot-maxvariantseparation">**maxVariantSeparation**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Maximum separation, in variants, between the two SNPs of a drawn pair. Pairs further apart are dropped, which turns the matrix from n²/2 cells into n·k. This is plink's `--ld-window`, and a file plink wrote is usually already windowed, so it most often drops nothing. Set to 0 to draw every pair the file names.<br>_advanced_ |
| <span id="slot-showverticalguides">**showVerticalGuides**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Whether to show vertical guides at the connected genome positions on hover<br>_advanced_ |
| <span id="slot-showlabels">**showLabels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Whether to show variant labels above the tick marks<br>_advanced_ |
| <span id="slot-tickheight">**tickHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>6</code> | Height of the vertical tick marks at the genomic position<br>_advanced_ |
| <span id="slot-usegenomicpositions">**useGenomicPositions**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | When true, draw cells sized according to genomic distance between SNPs rather than uniform squares<br>_advanced_ |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>400</code> | Starting height in pixels for the LD triangle, excluding the lineZoneHeight band; drag-resizable |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">4 slots</span> |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
