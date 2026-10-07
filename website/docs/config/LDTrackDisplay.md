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
      color: { field: 'dprime' },
      showLegend: true,
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

## Overview

Linkage disequilibrium heatmap read from an `LDTrack`'s pre-computed file —
PLINK `--r2` output and the formats that follow it. JBrowse does not compute
LD from genotypes; run plink (or an equivalent) and point this at the result.

### LDTrackDisplay - Identifier

Every LDTrackDisplay has a unique `displayId`, a required top-level field that identifies it (not one of the config slots below).

## Related links

- **Adapter:** [PlinkLDAdapter](../plinkldadapter)
- **Adapter:** [PlinkLDTabixAdapter](../plinkldtabixadapter)
- **State model:** [runtime API](../../models/ldtrackdisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LDTrackDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-linezoneheight">**lineZoneHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | height of the band above the triangle holding the connector lines and labels<br>_advanced_ |
| <span id="slot-color">**color**</span><br>[LDColor](../ldcolor) | Which statistic the cells are, `field` `r2` or `dprime`, and the linear ramp it paints through over the statistic's 0 to 1. |
| <span id="slot-maxvariantseparation">**maxVariantSeparation**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Maximum separation, in variants, between the two SNPs of a drawn pair. Pairs further apart are dropped, which turns the matrix from n²/2 cells into n·k. This is plink's `--ld-window`, and a file plink wrote is usually already windowed, so it most often drops nothing. Set to 0 to draw every pair the file names.<br>_advanced_ |
| <span id="slot-showverticalguides">**showVerticalGuides**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | on hover, draw guides across the view at the pair's genomic positions<br>_advanced_ |
| <span id="slot-showlabels">**showLabels**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (none, name) = <code>'none'</code> | `name` draws each variant name above its tick mark and `none` draws no labels, two of the modes the feature display gives its own `showLabels`<br>_advanced_ |
| <span id="slot-tickheight">**tickHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>6</code> | height of the tick marks at the genomic positions<br>_advanced_ |
| <span id="slot-variantlayout">**variantLayout**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (genomic, columns) = <code>'columns'</code> | `'columns'` draws every SNP one uniform square wide; `'genomic'` sizes the cells by the genomic distance between SNPs. The multi-sample variant display takes the same slot for the same choice.<br>_advanced_ |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>400</code> | default height of the display, the band above the triangle included |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | show the color scale legend |
| <span id="slot-squashtoheight">**squashToHeight**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | squash the triangle vertically to fill the display height instead of drawing square cells |
