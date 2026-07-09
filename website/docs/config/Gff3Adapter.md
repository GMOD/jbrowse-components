---
id: gff3adapter
title: Gff3Adapter
sidebar_label: Adapter -> Gff3Adapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gff3` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gff3/src/Gff3Adapter/configSchema.ts).

## Example usage

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3Adapter',
    uri: 'https://example.com/genes.gff3',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to load plain-text GFF3 files. Loads the whole file into memory, so prefer
the Gff3TabixAdapter for large files.

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                             | Type           | Description |
| -------------------------------- | -------------- | ----------- |
| [gffLocation](#slot-gfflocation) | `fileLocation` |             |

<details>
<summary>Gff3Adapter - Slots</summary>

#### slot: gffLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.gff', locationType: 'UriLocation' }`

</details>
