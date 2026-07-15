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

_See the **Config slots** section below for all available configuration fields._

used to load plain-text GTF files (optionally gzipped). Loads the whole file
into memory, so prefer the GtfTabixAdapter for large files.

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                   | Type           | Description                                                                    |
| -------------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| [gtfLocation](#slot-gtflocation)       | `fileLocation` | path to gtf file, also allows for gzipped gtf                                  |
| [aggregateField](#slot-aggregatefield) | `string`       | field used to aggregate multiple transcripts into a single parent gene feature |

<details>
<summary>GtfAdapter - Slots</summary>

#### slot: gtfLocation

path to gtf file, also allows for gzipped gtf

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.gtf', locationType: 'UriLocation' }`

#### slot: aggregateField

field used to aggregate multiple transcripts into a single parent gene feature

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'gene_name'`

</details>
