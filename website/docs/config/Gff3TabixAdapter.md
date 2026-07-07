---
id: gff3tabixadapter
title: Gff3TabixAdapter
sidebar_label: Adapter -> Gff3TabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gff3` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gff3/src/Gff3TabixAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.tbi` index; add `csi: true` for a `.csi`
index instead:

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://example.com/genes.gff3.gz',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load bgzip-compressed, tabix-indexed GFF3 files

### Gff3TabixAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes tbi index at yourfile.gff3.gz.tbi
(or .csi if csi:true):

```json
{
  "type": "Gff3TabixAdapter",
  "uri": "yourfile.gff3.gz",
  "csi": true
}
```

| Slot                                    | Type                    | Description                                                                                                                                                                                                                                  |
| --------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [gffGzLocation](#slot-gffgzlocation)    | `fileLocation`          |                                                                                                                                                                                                                                              |
| [index.indexType](#slot-indexindextype) | `stringEnum` (TBI, CSI) |                                                                                                                                                                                                                                              |
| [index.indexType](#slot-indexindextype) | `fileLocation`          |                                                                                                                                                                                                                                              |
| [dontRedispatch](#slot-dontredispatch)  | `stringArray`           | the Gff3TabixAdapter has to "redispatch" if it fetches a region and features it finds inside that region extend outside the region we requested. you can disable this for certain feature types to avoid fetching e.g. the entire chromosome |

<details>
<summary>Gff3TabixAdapter - Slots</summary>

#### slot: gffGzLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.gff.gz', locationType: 'UriLocation' }`

#### slot: index.indexType

**Type:** `stringEnum` (one of `TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.indexType

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.gff.gz.tbi', locationType: 'UriLocation' }`

#### slot: dontRedispatch

the Gff3TabixAdapter has to "redispatch" if it fetches a region and features it
finds inside that region extend outside the region we requested. you can disable
this for certain feature types to avoid fetching e.g. the entire chromosome

**Type:** `stringArray` · **Default:** `['chromosome', 'region', 'contig']`

</details>

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)
