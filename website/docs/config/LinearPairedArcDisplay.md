---
id: linearpairedarcdisplay
title: LinearPairedArcDisplay
sidebar_label: Display -> LinearPairedArcDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `arc` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearPairedArcDisplay/configSchema.ts).

## Example usage

Selected on a `VariantTrack` of structural variants: each feature draws an arc
from its position to its mate breakend (parsed from the VCF `ALT`), connecting
the two loci even when the mate is on another chromosome / displayed region.
Short ticks mark each breakend's mate direction; clicking an arc opens the
variant details. `color` is jexl-evaluated per `(feature, alt)`:

```js
{
  type: 'VariantTrack',
  trackId: 'sv',
  name: 'Structural variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/sv.vcf.gz',
  },
  displays: [
    {
      type: 'LinearPairedArcDisplay',
      displayId: 'sv-LinearPairedArcDisplay',
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

## Overview

### LinearPairedArcDisplay - Identifier

Every LinearPairedArcDisplay has a unique `displayId`, a required top-level field that identifies it (not one of the config slots below).

## Related links

- **Adapter:** [BedpeAdapter](../bedpeadapter)
- **Adapter:** [SplitVcfTabixAdapter](../splitvcftabixadapter)
- **Adapter:** [StarFusionAdapter](../starfusionadapter)
- **Adapter:** [VcfAdapter](../vcfadapter)
- **Adapter:** [VcfTabixAdapter](../vcftabixadapter)
- **State model:** [runtime API](../../models/linearpairedarcdisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LinearPairedArcDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'jexl:defaultPairedArcColor(feature,alt)'</code> | the color of the arcs<br>_callback args:_ `feature`, `alt` |
| <span id="slot-linewidth">**lineWidth**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) = <code>3</code> _promotable_ | the stroke width of the arcs, in pixels. Unset (the default) follows the session-wide default for this display type |
| <span id="slot-minscore">**minScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | hide arcs whose feature score is below this; features with no score are always drawn |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
