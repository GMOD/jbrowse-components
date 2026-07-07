---
id: chainadapter
title: ChainAdapter
sidebar_label: Adapter -> ChainAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/ChainAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg19', 'hg38'],
  adapter: {
    type: 'ChainAdapter',
    uri: 'https://example.com/aln.chain',
    queryAssembly: 'hg19',
    targetAssembly: 'hg38',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load UCSC chain alignment files (query and target assembly required)

### ChainAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "ChainAdapter",
  "uri": "yourfile.chain.gz",
  "queryAssembly": "hg19",
  "targetAssembly": "hg38"
}
```

| Slot                                   | Type           | Description                                                                                                                               |
| -------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [assemblyNames](#slot-assemblynames)   | `stringArray`  | Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second |
| [targetAssembly](#slot-targetassembly) | `string`       | can be specified as alternative to assemblyNames                                                                                          |
| [queryAssembly](#slot-queryassembly)   | `string`       | can be specified as alternative to assemblyNames                                                                                          |
| [chainLocation](#slot-chainlocation)   | `fileLocation` |                                                                                                                                           |

<details>
<summary>ChainAdapter - Slots</summary>

#### slot: assemblyNames

Array of assembly names to use for this file. The query assembly name is the
first value in the array, target assembly name is the second

**Type:** `stringArray` · **Default:** `[]`

#### slot: targetAssembly

can be specified as alternative to assemblyNames

**Type:** `string` · **Default:** `''`

#### slot: queryAssembly

can be specified as alternative to assemblyNames

**Type:** `string` · **Default:** `''`

#### slot: chainLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/file.chain', locationType: 'UriLocation' }`

</details>

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)
