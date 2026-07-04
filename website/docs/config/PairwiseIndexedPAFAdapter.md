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

_See the **Slots** section below for all available configuration fields._

## Overview

a tabix-indexed PAF (PIF) for large synteny datasets. The `uri` shorthand
auto-resolves the `.tbi` index (pass `csi: true` for a `.csi` index).

### Used in

Supplies data to the [SyntenyTrack](../syntenytrack) track, rendered by:

- [DotplotDisplay](../dotplotdisplay)
- [LGVSyntenyDisplay](../lgvsyntenydisplay)
- [LinearSyntenyDisplay](../linearsyntenydisplay)

### PairwiseIndexedPAFAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes file.pif.gz.tbi:

```json
{
  "type": "PairwiseIndexedPAFAdapter",
  "uri": "file.pif.gz",
  "queryAssembly": "hg19",
  "targetAssembly": "hg38"
}
```

<details open>
<summary>PairwiseIndexedPAFAdapter - Slots</summary>

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

#### slot: pifGzLocation

location of pairwise tabix indexed PAF (pif)

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/data/file.pif.gz', locationType: 'UriLocation' }`

#### slot: coarseBpPerPxThreshold

bpPerPx threshold at which the reader switches from the per-row CIGAR tier
(lowercase t/q prefix) to the coarse no-CIGAR tier (uppercase T/Q prefix), when
make-pif was run with --coarse. No coarse tier present in the file = always uses
fine tier.

**Type:** `number` · **Default:** `10000` · _advanced_

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

**Type:** `stringEnum` (one of `TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.location

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.paf.gz.tbi', locationType: 'UriLocation' }`

</details>
