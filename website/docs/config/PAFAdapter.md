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

_See the **Config slots** section below for all available configuration fields._

:::caution Gotcha

`assemblyNames` is `[query, target]`, which is the **reverse** of the order
minimap2 and nucmer take their inputs (`minimap2 target.fa query.fa`). Getting
it backwards silently draws every alignment against the wrong assembly rather
than erroring. Set the named `queryAssembly` and `targetAssembly` fields instead
and the ordering can't be misread.

:::

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                   | Type           | Description                                            |
| -------------------------------------- | -------------- | ------------------------------------------------------ |
| [assemblyNames](#slot-assemblynames)   | `stringArray`  | Array of assembly names to use for this file.          |
| [targetAssembly](#slot-targetassembly) | `string`       | Alternative to assemblyNames: the target assembly name |
| [queryAssembly](#slot-queryassembly)   | `string`       | Alternative to assemblyNames: the query assembly name  |
| [pafLocation](#slot-paflocation)       | `fileLocation` |                                                        |

<details>
<summary>PAFAdapter - Slots</summary>

#### slot: assemblyNames

Array of assembly names to use for this file. The query assembly name is the
first value in the array, target assembly name is the second

**Type:** `stringArray` · **Default:** `[]`

#### slot: targetAssembly

Alternative to assemblyNames: the target assembly name

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: queryAssembly

Alternative to assemblyNames: the query assembly name

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: pafLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/file.paf', locationType: 'UriLocation' }`

</details>
