---
id: gtfadapter
title: GtfAdapter
sidebar_label: Adapter -> GtfAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gtf` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gtf/src/GtfAdapter/configSchema.ts).

## Example usage

The `uri` shorthand works for plain or gzipped GTF:

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GtfAdapter',
    uri: 'https://example.com/genes.gtf',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load plain-text GTF files (optionally gzipped). Loads the whole file
into memory, so prefer the GtfTabixAdapter for large files.

### GtfAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "GtfAdapter",
  "uri": "yourfile.gtf"
}
```

| Slot                                   | Type           | Description                                                                    |
| -------------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| [gtfLocation](#slot-gtflocation)       | `fileLocation` | path to gtf file, also allows for gzipped gtf                                  |
| [aggregateField](#slot-aggregatefield) | `string`       | field used to aggregate multiple transcripts into a single parent gene feature |

<details>
<summary>GtfAdapter - Slots</summary>

#### slot: gtfLocation

path to gtf file, also allows for gzipped gtf

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.gtf', locationType: 'UriLocation' }`

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
