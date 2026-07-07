---
id: cytobandadapter
title: CytobandAdapter
sidebar_label: Adapter -> CytobandAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/data_adapters/CytobandAdapter/configSchema.ts).

## Overview

### CytobandAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "CytobandAdapter",
  "uri": "yourfile.bed"
}
```

| Slot                                       | Type           | Description |
| ------------------------------------------ | -------------- | ----------- |
| [cytobandLocation](#slot-cytobandlocation) | `fileLocation` |             |

<details>
<summary>CytobandAdapter - Slots</summary>

#### slot: cytobandLocation

**Type:** `fileLocation` · **Default:** `{ uri: '/path/to/cytoband.txt.gz' }`

</details>
