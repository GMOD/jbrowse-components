---
id: gtftabixadapter
title: GtfTabixAdapter
sidebar_label: Adapter -> GtfTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gtf` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gtf/src/GtfTabixAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.tbi` index:

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GtfTabixAdapter',
    uri: 'https://example.com/genes.gtf.gz',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to load bgzip-compressed, tabix-indexed GTF files

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearScoreDisplay](../linearscoredisplay)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                    | Type                    | Description                                                                                                                                     |
| --------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [gtfGzLocation](#slot-gtfgzlocation)    | `fileLocation`          |                                                                                                                                                 |
| [index.indexType](#slot-indexindextype) | `stringEnum` (TBI, CSI) |                                                                                                                                                 |
| [index.location](#slot-indexlocation)   | `fileLocation`          |                                                                                                                                                 |
| [dontRedispatch](#slot-dontredispatch)  | `stringArray`           | the GtfTabixAdapter has to "redispatch" if it fetches a region and features it finds inside that region extend outside the region we requested. |
| [aggregateField](#slot-aggregatefield)  | `string`                | field used to aggregate multiple transcripts into a single parent gene feature                                                                  |

<details>
<summary>GtfTabixAdapter - Slots</summary>

#### slot: gtfGzLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.gtf.gz', locationType: 'UriLocation' }`

#### slot: index.indexType

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.location

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.gtf.gz.tbi', locationType: 'UriLocation' }`

#### slot: dontRedispatch

the GtfTabixAdapter has to "redispatch" if it fetches a region and features it
finds inside that region extend outside the region we requested. you can disable
this for certain feature types to avoid fetching e.g. the entire chromosome

**Type:** `stringArray` · **Default:** `['chromosome', 'region', 'contig']`

#### slot: aggregateField

field used to aggregate multiple transcripts into a single parent gene feature

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'gene_name'`

</details>
