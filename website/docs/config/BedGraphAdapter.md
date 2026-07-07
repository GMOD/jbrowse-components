---
id: bedgraphadapter
title: BedGraphAdapter
sidebar_label: Adapter -> BedGraphAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedGraphAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'QuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedGraphAdapter',
    uri: 'https://example.com/signal.bedGraph',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load plain-text bedGraph signal files. Loads the whole file into memory,
so prefer the BedGraphTabixAdapter for large files.

### BedGraphAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "BedGraphAdapter",
  "uri": "yourfile.bed"
}
```

| Slot                                       | Type           | Description          |
| ------------------------------------------ | -------------- | -------------------- |
| [bedGraphLocation](#slot-bedgraphlocation) | `fileLocation` |                      |
| [columnNames](#slot-columnnames)           | `stringArray`  | List of column names |

<details>
<summary>BedGraphAdapter - Slots</summary>

#### slot: bedGraphLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.bedgraph', locationType: 'UriLocation' }`

#### slot: columnNames

List of column names

**Type:** `stringArray` · **Default:** `[]`

</details>

## Related links

- **Track:** [QuantitativeTrack](../quantitativetrack)
- **Display:** [LinearWiggleDisplay](../linearwiggledisplay)
