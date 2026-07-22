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
- **Adapter:** [FromConfigAdapter](../fromconfigadapter)
- **Adapter:** [Gff3Adapter](../gff3adapter)
- **Adapter:** [Gff3TabixAdapter](../gff3tabixadapter)
- **Adapter:** [GtfAdapter](../gtfadapter)
- **Adapter:** [GtfTabixAdapter](../gtftabixadapter)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                             | Type     | Description                                                             |
| -------------------------------- | -------- | ----------------------------------------------------------------------- |
| [height](#slot-height)           | `number` | height of the display in pixels                                         |
| [color](#slot-color)             | `color`  | fill color for every score box                                          |
| [scoreColumn](#slot-scorecolumn) | `string` | feature attribute read as the score (box height); normalized per region |

<details>
<summary>LinearScoreDisplay - Slots</summary>

#### slot: height

height of the display in pixels

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `100`

#### slot: color

fill color for every score box

**Type:** [`color`](/docs/config_guides/slot_types#color) · **Default:**
`'#0068d1'`

#### slot: scoreColumn

feature attribute read as the score (box height); normalized per region

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'score'`

</details>
