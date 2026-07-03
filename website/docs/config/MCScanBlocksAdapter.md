---
id: mcscanblocksadapter
title: MCScanBlocksAdapter
sidebar_label: Adapter -> MCScanBlocksAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MCScanBlocksAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/MCScanBlocksAdapter.md)

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['grape', 'peach'],
  adapter: {
    type: 'MCScanBlocksAdapter',
    mcscanBlocksLocation: { uri: 'grape.blocks' },
    blockAssemblies: ['grape', 'peach', 'cacao'],
    bedLocations: [
      { uri: 'grape.bed' },
      { uri: 'peach.bed' },
      { uri: 'cacao.bed' },
    ],
    assemblyNames: ['grape', 'peach'],
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

Loads a multi-genome MCScan (jcvi) `.blocks` file: a reference-anchored,
tab-delimited table where column 0 is a reference gene and each further column
is that gene's ortholog in another genome (`.` = no ortholog), produced by
`jcvi.compara.synteny mcscan` + `jcvi.formats.base join`.

A `.blocks` file describes N genomes at once, but a synteny track draws one
pair, so the same file backs the N-1 tracks of a multi-way view: each track sets
`assemblyNames` to the pair it renders and the adapter derives that pair's gene
links from the two matching columns. When neither column is the reference the
link is transitive (both orthologous to the same reference gene) rather than a
direct alignment.

### Used in

This adapter supplies data to the [SyntenyTrack](../syntenytrack) track type.

<details open>
<summary>MCScanBlocksAdapter - Slots</summary>

#### slot: mcscanBlocksLocation

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/mcscan.blocks',
    locationType: 'UriLocation',
  },
}
```

#### slot: blockAssemblies

one assembly name per column of the blocks file, in column order (column 0 is
the reference)

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  defaultValue: [],
}
```

#### slot: bedLocations

one BED fileLocation per column of the blocks file, parallel to blockAssemblies,
resolving that column's gene ids to coordinates

**Type:** `frozen`

```js
{
  type: 'frozen',
  defaultValue: [],
}
```

#### slot: assemblyNames

the pair of assemblies this track renders; both must appear in blockAssemblies

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  defaultValue: [],
}
```

</details>
