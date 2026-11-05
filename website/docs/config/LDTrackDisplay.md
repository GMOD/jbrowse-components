---
id: ldtrackdisplay
title: LDTrackDisplay
description: "Linkage disequilibrium heatmap read from an LDTrack's pre-computed file — PLINK --r2 output and the formats that follow it."
sidebar_label: Display -> LDTrackDisplay
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/configSchemaLDTrack.ts).

Linkage disequilibrium heatmap read from an `LDTrack`'s pre-computed file —
PLINK `--r2` output and the formats that follow it. JBrowse does not compute
LD from genotypes; run plink (or an equivalent) and point this at the result.

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
      encoding: { color: { field: 'dprime' } },
      legend: { show: true },
    },
  ],
}
```

## Overview

### LDTrackDisplay - Identifier

Every LDTrackDisplay has a unique `displayId`, a required top-level field that identifies it (not one of the config slots below).

## Related links

- **Adapter:** [PlinkLDAdapter](../plinkldadapter)
- **Adapter:** [PlinkLDTabixAdapter](../plinkldtabixadapter)
- **State model:** [runtime API](../../models/ldtrackdisplay)

## Color channels

<!-- prettier-ignore -->
| Setting | Page | `scale.type` | Preset fields |
| --- | --- | --- | --- |
| `encoding.color` | [](/docs/config/ldcolor#preset-fields) | linear, threshold | `r2`, `dprime` |

## Config slots

Display slots go on a display entry: `"displays": [{ "type": "LDTrackDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>20000000</code> | A pair costs about 11 compressed bytes, so 20 MB is some 1.8 million pairs, and the 790k pairs of a 1,258-variant triangle fit with room. The estimate is read from the tabix index, before any pair downloads.<br>_advanced_ |
| <span id="slot-connectors">**connectors**</span><br>[LDConnectors sub-schema](#slot-connectorsshow) | The band above the triangle holding the connector lines that tie each of its columns to a genomic position, and the variant names when they show: `show` and `height`, taken from the display's height. Off, neither the lines nor the names draw. |
| <span id="slot-connectorsshow">**connectors.show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the connector lines and the names above the triangle |
| <span id="slot-connectorsheight">**connectors.height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | height of the connector band in pixels, taken from the triangle's; its seam drag writes it |
| <span id="slot-encoding">**encoding**</span><br>[LDEncoding](../ldencoding) | The cells' channels: `encoding.color`, the statistic the cells show, `field` `r2` or `dprime`, and the linear ramp it paints through over the statistic's 0 to 1. |
| <span id="slot-legend">**legend**</span><br>[HiddenLegend](../hiddenlegend) | The color ramp's key, off until asked for. |
| <span id="slot-labels">**labels**</span><br>[LDLabels sub-schema](#slot-labelsname) | The text drawn at each variant's tick mark. |
| <span id="slot-labelsname">**labels.name**</span><br>[LDNameLabel sub-schema](#slot-labelsnameshow) | Each variant's name, above its tick mark. |
| <span id="slot-labelsnameshow">**labels.name.show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw each variant name above its tick mark<br>_advanced_ |
| <span id="slot-variantlayout">**variantLayout**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (genomic, columns) = <code>'columns'</code> | `'columns'` draws every SNP one uniform square wide; `'genomic'` sizes the cells by the genomic distance between SNPs. `LinearVariantDisplay` takes the same slot for the same choice.<br>_advanced_ |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>400</code> | default height of the display, the band above the triangle included |
| <span id="slot-heightmode">**heightMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) = <code>'fixed'</code> | fixed draws square cells at the triangle's natural half-width height; fit squashes it to fill the display height |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |

## Retired keys

An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.

<!-- prettier-ignore -->
| Key | On load |
| --- | --- |
| `maxFeatureScreenDensity` | ignored |
| `maxDisplayedBpPerPx` | ignored |
| `mouseover` | ignored |
| `jexlFilters` | moved into a current slot |
| `ldMetric` | moved into a current slot |
| `showLegend` | moved into a current slot |
| `showVerticalGuides` | ignored |
| `tickHeight` | ignored |
| `lineZoneHeight` | moved into a current slot |
| `fitToHeight` | moved into a current slot |
| `useGenomicPositions` | moved into a current slot |
| `maxHeight` | ignored |
| `colorScheme` | ignored |
| `signedLD` | ignored |
| `showLDTriangle` | ignored |
| `showRecombination` | ignored |
| `recombinationZoneHeight` | ignored |
| `minorAlleleFrequencyFilter` | ignored |
| `lengthCutoffFilter` | ignored |
| `hweFilterThreshold` | ignored |
| `callRateFilter` | ignored |
| `showLabels` | moved into a current slot |
