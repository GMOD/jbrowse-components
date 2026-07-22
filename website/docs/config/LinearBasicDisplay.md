---
id: linearbasicdisplay
title: LinearBasicDisplay
sidebar_label: Display -> LinearBasicDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `canvas`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/configSchema.ts).

## Example usage

A complete `FeatureTrack` config (e.g. genes from a GFF3) to paste into
`tracks`. `displayMode` sets the feature height preset (`normal`, `compact`, or
`superCompact`), or `collapsed` for a single-row overview:

```js
{
  type: 'FeatureTrack',
  trackId: 'genes',
  name: 'Genes',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://example.com/genes.gff3.gz',
  },
  displays: [
    {
      type: 'LinearBasicDisplay',
      displayId: 'genes-LinearBasicDisplay',
      height: 200,
      displayMode: 'compact',
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

configuration for the basic linear feature display (genes, BED, GFF, etc.)

Color slots are display-level: set them inside a track's `displays` array.
`color` is the main feature fill; use a plain CSS color, or a `jexl:` expression
to color per-feature. (`connectorColor` and `utrColor` set the intron lines and
UTR fill. The legacy `color1`/`color2`/`color3` names still work and map onto
these.)

```json
{
  "type": "FeatureTrack",
  "trackId": "my_genes",
  "name": "Genes",
  "assemblyNames": ["hg19"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "genes.gff.gz" },
  "displays": [
    {
      "type": "LinearBasicDisplay",
      "color": "blue",
      "utrColor": "lightblue"
    }
  ]
}
```

Color by an attribute with a jexl expression:

```json
{
  "type": "LinearBasicDisplay",
  "color": "jexl:get(feature,'type')=='gene'?'blue':'gray'"
}
```

## Related links

- **Adapter:** [BedAdapter](../bedadapter)
- **Adapter:** [BedTabixAdapter](../bedtabixadapter)
- **Adapter:** [BigBedAdapter](../bigbedadapter)
- **Adapter:** [FromConfigAdapter](../fromconfigadapter)
- **Adapter:** [Gff3Adapter](../gff3adapter)
- **Adapter:** [Gff3TabixAdapter](../gff3tabixadapter)
- **Adapter:** [GtfAdapter](../gtfadapter)
- **Adapter:** [GtfTabixAdapter](../gtftabixadapter)
- **State model:** [runtime API](../../models/linearbasicdisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

<details>
<summary>Advanced slots (1)</summary>

| Slot                                   | Type     | Description                                                                                                                                                                      |
| -------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [fetchSizeLimit](#slot-fetchsizelimit) | `number` | Feature (GFF/BED) tracks are light text, and the tabix byte estimate is block-granular (a small region still pulls whole BGZF blocks), so a single gene can trip a tighter gate. |

</details>

<details>
<summary>LinearBasicDisplay - Slots</summary>

#### slot: fetchSizeLimit

Feature (GFF/BED) tracks are light text, and the tabix byte estimate is
block-granular (a small region still pulls whole BGZF blocks), so a single gene
can trip a tighter gate. A few Mb of feature text downloads fast; the
feature-density gate remains the backstop for genuinely over-dense views.
VcfTabixAdapter matches this 5 Mb for the same reason; the binary alignment
adapters (CRAM 3 Mb) keep their own tighter limit.

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`5_000_000` · _advanced_

</details>
