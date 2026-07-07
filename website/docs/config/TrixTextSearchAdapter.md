---
id: trixtextsearchadapter
title: TrixTextSearchAdapter
sidebar_label: Adapter -> TrixTextSearchAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `trix` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/trix/src/TrixTextSearchAdapter/configSchema.ts).

## Overview

### TrixTextSearchAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes file.ixx also exists:

```json
{
  "type": "TrixTextSearchAdapter",
  "uri": "file.ix",
  "assemblyNames": ["hg19"],
  "textSearchAdapterId": "hg19SearchIndex"
}
```

### TrixTextSearchAdapter - Identifier

Every TrixTextSearchAdapter has a unique `textSearchAdapterId`, a required
top-level field that identifies it (not one of the config slots below).

| Slot                                 | Type           | Description                                       |
| ------------------------------------ | -------------- | ------------------------------------------------- |
| [ixFilePath](#slot-ixfilepath)       | `fileLocation` |                                                   |
| [ixxFilePath](#slot-ixxfilepath)     | `fileLocation` |                                                   |
| [metaFilePath](#slot-metafilepath)   | `fileLocation` |                                                   |
| [tracks](#slot-tracks)               | `stringArray`  | List of tracks covered by text search adapter     |
| [assemblyNames](#slot-assemblynames) | `stringArray`  | List of assemblies covered by text search adapter |

<details>
<summary>TrixTextSearchAdapter - Slots</summary>

#### slot: ixFilePath

**Type:** `fileLocation` · **Default:**
`{ uri: 'out.ix', locationType: 'UriLocation' }`

#### slot: ixxFilePath

**Type:** `fileLocation` · **Default:**
`{ uri: 'out.ixx', locationType: 'UriLocation' }`

#### slot: metaFilePath

**Type:** `fileLocation` · **Default:**
`{ uri: 'meta.json', locationType: 'UriLocation' }`

#### slot: tracks

List of tracks covered by text search adapter

**Type:** `stringArray` · **Default:** `[]`

#### slot: assemblyNames

List of assemblies covered by text search adapter

**Type:** `stringArray` · **Default:** `[]`

</details>
