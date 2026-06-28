---
id: pairwiseindexedpafadapter
title: PairwiseIndexedPAFAdapter
sidebar_label: Adapter -> PairwiseIndexedPAFAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/PairwiseIndexedPAFAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/PairwiseIndexedPAFAdapter.md)

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

This adapter supplies data to the [SyntenyTrack](../syntenytrack) track type.

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

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  defaultValue: [],
  description:
    'Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second',
}
```

#### slot: targetAssembly

Alternative to assemblyNames: the target assembly name

**Type:** `string` · **Default:** `''`

```js
{
  type: 'string',
  defaultValue: '',
  description: 'Alternative to assemblyNames: the target assembly name',
}
```

#### slot: queryAssembly

Alternative to assemblyNames: the query assembly name

**Type:** `string` · **Default:** `''`

```js
{
  type: 'string',
  defaultValue: '',
  description: 'Alternative to assemblyNames: the query assembly name',
}
```

#### slot: pifGzLocation

location of pairwise tabix indexed PAF (pif)

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  description: 'location of pairwise tabix indexed PAF (pif)',
  defaultValue: {
    uri: '/path/to/data/file.pif.gz',
    locationType: 'UriLocation',
  },
}
```

#### slot: coarseBpPerPxThreshold

bpPerPx threshold at which the reader switches from the per-row CIGAR tier
(lowercase t/q prefix) to the coarse no-CIGAR tier (uppercase T/Q prefix), when
make-pif was run with --coarse. No coarse tier present in the file = always uses
fine tier.

**Type:** `number` · **Default:** `10000`

```js
{
  type: 'number',
  defaultValue: 10000,
  advanced: true,
}
```

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

**Type:** `stringEnum` · **Default:** `'TBI'`

```js
{
  model: types.enumeration('IndexType', ['TBI', 'CSI']),
  type: 'stringEnum',
  defaultValue: 'TBI',
}
```

#### slot: index.location

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.paf.gz.tbi',
    locationType: 'UriLocation',
  },
}
```

</details>
