---
id: linearhicdisplay
title: LinearHicDisplay
description: "Draws a HicTrack's contact matrix as a triangular heatmap in the linear genome view, at a bin size that follows the zoom."
sidebar_label: Display -> LinearHicDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `hic` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/configSchema.ts).

Draws a `HicTrack`'s contact matrix as a triangular heatmap in the linear
genome view, at a bin size that follows the zoom.

## Example usage

A log color scale, one binsize coarser than the zoom picks, through the
`displayDefaults` shorthand. See the
[Hi-C track guide](/docs/config_guides/hic_track) for the rest:

```js
{
  type: 'HicTrack',
  trackId: 'hic',
  name: 'Hi-C',
  assemblyNames: ['hg38'],
  adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
  displayDefaults: {
    encoding: { color: { scale: { type: 'symlog' } } },
    data: { resolution: -1 },
  },
}
```

## Overview

### LinearHicDisplay - Identifier

Every LinearHicDisplay has a unique `displayId`, a required top-level field that identifies it (not one of the config slots below).

## Related links

- **Adapter:** [HicAdapter](../hicadapter)
- **State model:** [runtime API](../../models/linearhicdisplay)

## Config slots

Display slots go on a display entry: `"displays": [{ "type": "LinearHicDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-encoding">**encoding**</span><br>[HicEncoding](../hicencoding) | The channels the bins paint through: `encoding.color`, the scale from count to color. |
| <span id="slot-legend">**legend**</span><br>[HiddenLegend](../hiddenlegend) | The color ramp's key, off until asked for. |
| <span id="slot-data">**data**</span><br>[HicData](../hicdata) | What the fetch reads, a [](/docs/config/hicdata) object: `resolution` steps the binsize from the zoom's pick, `normalization` names the matrix normalization. |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>300</code> | default height for the Hi-C track |
| <span id="slot-heightmode">**heightMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) = <code>'fixed'</code> | fixed draws square cells at the triangle's natural half-width height; fit squashes it to fill the display height |

## Retired keys

An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.

<!-- prettier-ignore -->
| Key | On load |
| --- | --- |
| `maxFeatureScreenDensity` | ignored |
| `maxDisplayedBpPerPx` | ignored |
| `fetchSizeLimit` | ignored |
| `mouseover` | ignored |
| `jexlFilters` | moved into a current slot |
| `renderer` | ignored |
| `showResolutionControls` | ignored |
| `resolutionBias` | moved into a current slot |
| `selectedNormalization` | moved into a current slot |
