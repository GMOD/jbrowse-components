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

_See the **Slots** section below for all available configuration fields._

## Overview

used to load bgzip-compressed, tabix-indexed GTF files

### GtfTabixAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes tbi index at yourfile.gtf.gz.tbi:

```json
{
  "type": "GtfTabixAdapter",
  "uri": "yourfile.gtf.gz"
}
```

| Slot                                    | Type                    | Description                                                                                                                                                                                                                                 |
| --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [gtfGzLocation](#slot-gtfgzlocation)    | `fileLocation`          |                                                                                                                                                                                                                                             |
| [index.indexType](#slot-indexindextype) | `stringEnum` (TBI, CSI) |                                                                                                                                                                                                                                             |
| [index.location](#slot-indexlocation)   | `fileLocation`          |                                                                                                                                                                                                                                             |
| [dontRedispatch](#slot-dontredispatch)  | `stringArray`           | the GtfTabixAdapter has to "redispatch" if it fetches a region and features it finds inside that region extend outside the region we requested. you can disable this for certain feature types to avoid fetching e.g. the entire chromosome |
| [aggregateField](#slot-aggregatefield)  | `string`                | field used to aggregate multiple transcripts into a single parent gene feature                                                                                                                                                              |

<details>
<summary>GtfTabixAdapter - Slots</summary>

#### slot: gtfGzLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.gtf.gz', locationType: 'UriLocation' }`

#### slot: index.indexType

**Type:** `stringEnum` (one of `TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.location

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.gtf.gz.tbi', locationType: 'UriLocation' }`

#### slot: dontRedispatch

the GtfTabixAdapter has to "redispatch" if it fetches a region and features it
finds inside that region extend outside the region we requested. you can disable
this for certain feature types to avoid fetching e.g. the entire chromosome

**Type:** `stringArray` · **Default:** `['chromosome', 'region', 'contig']`

#### slot: aggregateField

field used to aggregate multiple transcripts into a single parent gene feature

**Type:** `string` · **Default:** `'gene_name'`

</details>

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)
