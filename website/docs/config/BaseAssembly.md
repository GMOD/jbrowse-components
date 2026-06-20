---
id: baseassembly
title: BaseAssembly
sidebar_label: Assembly Management -> BaseAssembly
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/assemblyManager/assemblyConfigSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BaseAssembly.md)

## Example usage

A hand-authored assembly. `sequence` is a `ReferenceSequenceTrack` whose adapter
points at an indexed FASTA — the `uri` shorthand auto-resolves the companion
`.fai`/`.gzi` index files:

```js
{
  name: 'hg38',
  aliases: ['GRCh38'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'hg38-ref',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://example.com/hg38.fa.gz',
    },
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

This corresponds to the assemblies section of the config

### BaseAssembly - Identifier

Every BaseAssembly has a unique `name`, a required top-level field that
identifies it (not one of the config slots below).

there is no separate "id" field on an assembly: the "name" is the id, usually a
short machine-readable string like hg38. For a longer human-readable label, set
the "displayName" config slot instead

<details open>
<summary>BaseAssembly - Slots</summary>

#### slot: aliases

aliases are "reference name aliases" e.g. aliases for hg38 might be "GRCh38"

```js
{
  type: 'stringArray',
  defaultValue: [],
  description: 'Other possible names for the assembly',
}
```

#### slot: sequence

sequence refers to a reference sequence track that has an adapter containing,
importantly, a sequence adapter such as IndexedFastaAdapter

```js
pluginManager.getTrackType('ReferenceSequenceTrack').configSchema
```

#### slot: refNameColors

```js
{
  type: 'stringArray',
  defaultValue: [],
  description:
    'Define custom colors for each reference sequence. Will cycle through this list if there are not enough colors for every sequence.',
}
```

#### slot: geneticCodes

Maps a reference sequence name to an NCBI genetic-code (translation table) id
for sequences that don't use the standard code, e.g. `{ "chrM": 2 }` for the
vertebrate mitochondrial code or `{ "chrPltd": 11 }` for a plastid. Drives the
reference sequence track's translation rows; unlisted refNames use the standard
code (1). CDS-level translation reads the GFF `transl_table` attribute directly
and ignores this.

```js
{
  type: 'frozen',
  defaultValue: {},
  description:
    'Map of reference sequence name to NCBI genetic-code (translation table) id for sequences not using the standard code, e.g. { "chrM": 2 }',
}
```

#### slot: geneticCodesLocation

Optional file (tab-separated `refName<TAB>geneticCodeId`, `#` comments allowed)
to load the same refName-to-genetic-code mapping from, instead of inlining it —
useful when a config generator emits a sidecar rather than inlining per
assembly. Entries in the inline `geneticCodes` slot take precedence over the
file.

```js
{
  type: 'fileLocation',
  defaultValue: { uri: '', locationType: 'UriLocation' },
  description:
    'Optional TSV file of refName<TAB>geneticCodeId, an alternative to inlining the geneticCodes map',
}
```

#### slot: refNameAliases.adapter

refNameAliases help resolve e.g. chr1 and 1 as the same entity the data for
refNameAliases are fetched from an adapter, that is commonly a tsv like
chromAliases.txt from UCSC or similar

```js
pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: cytobands.adapter

cytoband data is fetched from an adapter, and can be displayed by a view type as
ideograms

```js
pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: displayName

```js
{
  type: 'string',
  defaultValue: '',
  description:
    'A human readable display name for the assembly e.g. "Homo sapiens (hg38)" while the assembly name may just be "hg38"',
}
```

</details>
