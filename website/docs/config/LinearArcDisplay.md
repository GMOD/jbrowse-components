---
id: lineararcdisplay
title: LinearArcDisplay
sidebar_label: Display -> LinearArcDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `arc` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearArcDisplay/configSchema.ts).

## Example usage

Selected on a `FeatureTrack`; each feature is drawn as one arc from its start
to its end. `displayMode` is `arcs` (bezier) or `semicircles`. The
`thickness` and `label` slots default to expressions over the feature
`score`, so override them (plus `color` / `arcHeight`) for data without a
score. All style slots are jexl-evaluated per feature:

```js
{
  type: 'FeatureTrack',
  trackId: 'interactions',
  name: 'Interactions',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://example.com/interactions.gff3.gz',
  },
  displays: [
    {
      type: 'LinearArcDisplay',
      displayId: 'interactions-LinearArcDisplay',
      displayMode: 'semicircles',
      color: "jexl:feature.strand==-1?'red':'blue'",
      arcHeight: 80,
      label: "jexl:feature.name",
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

## Overview

### LinearArcDisplay - Identifier

Every LinearArcDisplay has a unique `displayId`, a required top-level field that identifies it (not one of the config slots below).

## Related links

- **Adapter:** [BedAdapter](../bedadapter)
- **Adapter:** [BedTabixAdapter](../bedtabixadapter)
- **Adapter:** [BigBedAdapter](../bigbedadapter)
- **Adapter:** [CrisprGuideAdapter](../crisprguideadapter)
- **Adapter:** [FromConfigAdapter](../fromconfigadapter)
- **Adapter:** [Gff3Adapter](../gff3adapter)
- **Adapter:** [Gff3TabixAdapter](../gff3tabixadapter)
- **Adapter:** [GtfAdapter](../gtfadapter)
- **Adapter:** [GtfTabixAdapter](../gtftabixadapter)
- **Adapter:** [NCListAdapter](../nclistadapter)
- **Adapter:** [SequenceSearchAdapter](../sequencesearchadapter)
- **Adapter:** [SPARQLAdapter](../sparqladapter)
- **State model:** [runtime API](../../models/lineararcdisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LinearArcDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'darkblue'</code> | the color of the arcs<br>_callback args:_ `feature` |
| <span id="slot-thickness">**thickness**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>'jexl:logThickness(feature,'score')'</code> | the thickness of the arcs, in pixels; an arc given 0 or less is not drawn at all<br>_callback args:_ `feature` |
| <span id="slot-label">**label**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'jexl:get(feature,'score')'</code> | the label to appear at the apex of the arcs<br>_callback args:_ `feature` |
| <span id="slot-archeight">**arcHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>'jexl:log10(get(feature,'end')-get(feature,'start'))*50'</code> | the height of the arcs<br>_callback args:_ `feature` |
| <span id="slot-caption">**caption**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'jexl:get(feature,'name')'</code> | the caption to appear when hovering over any point on the arcs<br>_callback args:_ `feature` |
| <span id="slot-displaymode">**displayMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (arcs, semicircles) = <code>'arcs'</code> | render semi-circles instead of arcs |
| <span id="slot-minscore">**minScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | hide arcs whose feature score is below this; features with no score are always drawn |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | default height for the track |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
