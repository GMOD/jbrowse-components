---
id: linearhicdisplay
title: LinearHicDisplay
sidebar_label: Display -> LinearHicDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `hic` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/configSchema.ts).

## Example usage

A log colour scale, one step coarser than the zoom picks, through the
`displayDefaults` shorthand. See the
[Hi-C track guide](/docs/config_guides/hic_track) for the rest:

```js
{
  type: 'HicTrack',
  trackId: 'hic',
  name: 'Hi-C',
  assemblyNames: ['hg38'],
  adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
  displayDefaults: { color: { scale: 'log' }, resolutionBias: 1 },
}
```

_See the **Config slots** section below for all available configuration fields._

## Overview

### LinearHicDisplay - Identifier

Every LinearHicDisplay has a unique `displayId`, a required top-level field that identifies it (not one of the config slots below).

## Related links

- **Adapter:** [HicAdapter](../hicadapter)
- **State model:** [runtime API](../../models/linearhicdisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LinearHicDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[HicColor](../hiccolor) | How a count becomes a colour: a `linear` or `log` scale onto a named `scheme`, over a domain whose unset ends follow the loaded counts. |
| <span id="slot-resolutionbias">**resolutionBias**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | steps from the zoom-picked binsize: -1 one finer, +1 one coarser, 0 follows the zoom |
| <span id="slot-showresolutioncontrols">**showResolutionControls**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | show the on-figure resolution dropdown in the overlay |
| <span id="slot-selectednormalization">**selectedNormalization**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'KR'</code> | preferred matrix normalization (KR, SCALE, VC, VC_SQRT, NONE); a scheme the file lacks falls back to one it has |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>300</code> | default height for the Hi-C track |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | show the color scale legend |
| <span id="slot-squashtoheight">**squashToHeight**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | squash the triangle vertically to fill the display height instead of drawing square cells |
