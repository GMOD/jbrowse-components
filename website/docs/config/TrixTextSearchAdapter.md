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

preprocessor to allow minimal config: `uri` points at the `.ix` file and the
sibling `.ixx` and `_meta.json` are derived from it (the `jbrowse text-index`
naming convention):

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

auto-generated when omitted, so a minimal config need not supply one; an
explicit `textSearchAdapterId` is still honored

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

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

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: 'out.ix', locationType: 'UriLocation' }`

#### slot: ixxFilePath

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: 'out.ixx', locationType: 'UriLocation' }`

#### slot: metaFilePath

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: 'meta.json', locationType: 'UriLocation' }`

#### slot: tracks

List of tracks covered by text search adapter

**Type:** `stringArray` · **Default:** `[]`

#### slot: assemblyNames

List of assemblies covered by text search adapter

**Type:** `stringArray` · **Default:** `[]`

</details>
