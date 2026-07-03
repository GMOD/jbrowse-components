---
id: allvsallpafadapter
title: AllVsAllPAFAdapter
sidebar_label: Adapter -> AllVsAllPAFAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/AllVsAllPAFAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/AllVsAllPAFAdapter.md)

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['grape', 'peach'],
  adapter: {
    type: 'AllVsAllPAFAdapter',
    uri: 'all_vs_all.paf.gz',
    assemblyNames: ['grape', 'peach'],
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

Loads a single "all-vs-all" PAF (e.g. `minimap2 all.fa all.fa`, or the PGGB
mapping step) where every sequence name is PanSN-prefixed with its assembly
(`sample#haplotype#contig`). Because such a file contains every pairwise
alignment, one file backs the N-1 synteny bands of a multi-way view: each track
sets `assemblyNames` to the pair it draws and the adapter keeps only the records
whose two sides are exactly that pair, stripping the PanSN prefix to recover
each assembly's own refName.

### Used in

This adapter supplies data to the [SyntenyTrack](../syntenytrack) track type.

### AllVsAllPAFAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "AllVsAllPAFAdapter",
  "uri": "file.paf.gz",
  "assemblyNames": ["grape", "peach"]
}
```

<details open>
<summary>AllVsAllPAFAdapter - Slots</summary>

#### slot: assemblyNames

The pair of assemblies this track draws (query first, target second). Both must
resolve to a PanSN sample prefix present in the file.

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  defaultValue: [],
}
```

#### slot: pafLocation

can be optionally gzipped

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/file.paf',
    locationType: 'UriLocation',
  },
}
```

#### slot: assemblyNameToPanSN

Maps a JBrowse assembly name to its PanSN sample prefix in the PAF, for when
they differ (e.g. assembly `grape` stored as `Vitis_vinifera#1#chr1` would need
`{ grape: 'Vitis_vinifera' }`). Defaults to identity: the assembly name is
assumed to be the PanSN sample name.

**Type:** `frozen`

```js
{
  type: 'frozen',
  defaultValue: {},
}
```

</details>
