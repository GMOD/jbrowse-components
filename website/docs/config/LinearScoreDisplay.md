---
id: linearscoredisplay
title: LinearScoreDisplay
sidebar_label: Display -> LinearScoreDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/example-plugins/score-example/src/LinearScoreDisplay/configSchema.ts).

Config for the worked-example score display. Attaches to any `FeatureTrack`.

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
- **State model:** [runtime API](../../models/linearscoredisplay)

## Config slots

These slots go on a display entry:
`"displays": [{ "type": "LinearScoreDisplay", ... }]`, or in the track's
[`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this
is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained
in the [config slot types reference](/docs/config_guides/slot_types). Slots a
base configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>100</code> | height of the display in pixels |
| <span id="slot-color">**color**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#0068d1'</code> | fill color for every score box |
| <span id="slot-scorecolumn">**scoreColumn**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'score'</code> | feature attribute read as the score (box height); normalized per region |
