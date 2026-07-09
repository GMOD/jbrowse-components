---
id: mashmapadapter
title: MashMapAdapter
sidebar_label: Adapter -> MashMapAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MashMapAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg19', 'hg38'],
  adapter: {
    type: 'MashMapAdapter',
    uri: 'https://example.com/aln.out',
    queryAssembly: 'hg19',
    targetAssembly: 'hg38',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to load MashMap `.out` alignment files (query and target assembly required)

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                   | Type           | Description                                             |
| -------------------------------------- | -------------- | ------------------------------------------------------- |
| [assemblyNames](#slot-assemblynames)   | `stringArray`  | Array of assembly names to use for this file.           |
| [targetAssembly](#slot-targetassembly) | `string`       | Alternative to assemblyNames array: the target assembly |
| [queryAssembly](#slot-queryassembly)   | `string`       | Alternative to assemblyNames array: the query assembly  |
| [outLocation](#slot-outlocation)       | `fileLocation` |                                                         |

<details>
<summary>MashMapAdapter - Slots</summary>

#### slot: assemblyNames

Array of assembly names to use for this file. The query assembly name is the
first value in the array, target assembly name is the second

**Type:** `stringArray` · **Default:** `[]`

#### slot: targetAssembly

Alternative to assemblyNames array: the target assembly

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: queryAssembly

Alternative to assemblyNames array: the query assembly

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: outLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/mashmap.out', locationType: 'UriLocation' }`

</details>
