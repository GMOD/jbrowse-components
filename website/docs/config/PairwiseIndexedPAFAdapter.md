---
id: pairwiseindexedpafadapter
title: PairwiseIndexedPAFAdapter
sidebar_label: Adapter -> PairwiseIndexedPAFAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/PairwiseIndexedPAFAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg19', 'hg38'],
  adapter: {
    type: 'PairwiseIndexedPAFAdapter',
    uri: 'https://example.com/aln.pif.gz',
    queryAssembly: 'hg19',
    targetAssembly: 'hg38',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

a tabix-indexed PAF (PIF) for large synteny datasets. The `uri` shorthand
auto-resolves the `.tbi` index (pass `csi: true` for a `.csi` index).

## Related links

- **Track:** [SyntenyTrack](../syntenytrack)
- **Display:** [DotplotDisplay](../dotplotdisplay)
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                    | Type                    | Description                                            |
| --------------------------------------- | ----------------------- | ------------------------------------------------------ |
| [assemblyNames](#slot-assemblynames)    | `stringArray`           | Array of assembly names to use for this file.          |
| [targetAssembly](#slot-targetassembly)  | `string`                | Alternative to assemblyNames: the target assembly name |
| [queryAssembly](#slot-queryassembly)    | `string`                | Alternative to assemblyNames: the query assembly name  |
| [pifGzLocation](#slot-pifgzlocation)    | `fileLocation`          | location of pairwise tabix indexed PAF (pif)           |
| [index](#slot-index)                    |                         |                                                        |
| [index.indexType](#slot-indexindextype) | `stringEnum` (TBI, CSI) |                                                        |
| [index.location](#slot-indexlocation)   | `fileLocation`          |                                                        |

<details>
<summary>Advanced slots (1)</summary>

| Slot                                                   | Type     | Description                                                                                                                                                                                |
| ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [coarseBpPerPxThreshold](#slot-coarsebpperpxthreshold) | `number` | bpPerPx threshold at which the reader switches from the per-row CIGAR tier (lowercase t/q prefix) to the coarse no-CIGAR tier (uppercase T/Q prefix), when make-pif was run with --coarse. |

</details>

<details>
<summary>PairwiseIndexedPAFAdapter - Slots</summary>

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

#### slot: pifGzLocation

location of pairwise tabix indexed PAF (pif)

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/data/file.pif.gz', locationType: 'UriLocation' }`

#### slot: coarseBpPerPxThreshold

bpPerPx threshold at which the reader switches from the per-row CIGAR tier
(lowercase t/q prefix) to the coarse no-CIGAR tier (uppercase T/Q prefix), when
make-pif was run with --coarse. No coarse tier present in the file = always uses
fine tier.

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`10000` · _advanced_

#### slot: index

```js
ConfigurationSchema('TabixIndex', {
  indexType: {
    model: types.enumeration('IndexType', ['TBI', 'CSI']),
    type: 'stringEnum',
    defaultValue: 'TBI',
  },

  location: {
    type: 'fileLocation',
    defaultValue: {
      uri: '/path/to/my.paf.gz.tbi',
      locationType: 'UriLocation',
    },
  },
})
```

#### slot: index.indexType

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.location

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.paf.gz.tbi', locationType: 'UriLocation' }`

</details>
