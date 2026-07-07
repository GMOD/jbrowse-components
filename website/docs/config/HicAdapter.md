---
id: hicadapter
title: HicAdapter
sidebar_label: Adapter -> HicAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `hic` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/HicAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'HicTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'HicAdapter',
    uri: 'https://example.com/map.hic',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load Hi-C contact matrix data from a `.hic` file

### HicAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "HicAdapter",
  "uri": "file.hic"
}
```

| Slot                             | Type           | Description |
| -------------------------------- | -------------- | ----------- |
| [hicLocation](#slot-hiclocation) | `fileLocation` |             |

<details>
<summary>HicAdapter - Slots</summary>

#### slot: hicLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.hic', locationType: 'UriLocation' }`

</details>

## Related links

- **Track:** [HicTrack](../hictrack)
- **Display:** [LinearHicDisplay](../linearhicdisplay)
