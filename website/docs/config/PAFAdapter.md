---
id: pafadapter
title: PAFAdapter
sidebar_label: Adapter -> PAFAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/PAFAdapter/configSchema.ts).

## Example usage

A PAF has no index, but it needs the query and target assembly names (query
first):

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg19', 'hg38'],
  adapter: {
    type: 'PAFAdapter',
    uri: 'https://example.com/aln.paf',
    queryAssembly: 'hg19',
    targetAssembly: 'hg38',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

### Used in

Supplies data to the [SyntenyTrack](../syntenytrack) track, rendered by:

- [DotplotDisplay](../dotplotdisplay)
- [LGVSyntenyDisplay](../lgvsyntenydisplay)
- [LinearSyntenyDisplay](../linearsyntenydisplay)

### PAFAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "PAFAdapter",
  "uri": "file.paf.gz",
  "queryAssembly": "hg19",
  "targetAssembly": "hg38"
}
```

<details open>
<summary>PAFAdapter - Slots</summary>

#### slot: assemblyNames

Array of assembly names to use for this file. The query assembly name is the
first value in the array, target assembly name is the second

**Type:** `stringArray` · **Default:** `[]`

#### slot: targetAssembly

Alternative to assemblyNames: the target assembly name

**Type:** `string` · **Default:** `''`

#### slot: queryAssembly

Alternative to assemblyNames: the query assembly name

**Type:** `string` · **Default:** `''`

#### slot: pafLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/file.paf', locationType: 'UriLocation' }`

</details>
