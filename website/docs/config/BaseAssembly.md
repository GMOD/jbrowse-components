---
id: baseassembly
title: BaseAssembly
sidebar_label: Assembly Management -> BaseAssembly
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/assemblyManager/assemblyConfigSchema.ts).

## Example usage

### Example: minimal

A hand-authored human assembly. `sequence` is a `ReferenceSequenceTrack` whose
adapter points at a bgzipped+indexed FASTA — the `uri` shorthand auto-resolves
the companion `.fai`/`.gzi` index files. `geneticCodes` translates the
mitochondrial contig with the vertebrate mitochondrial code (NCBI table 2):

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
  geneticCodes: { chrM: 2 },
}
```

### Example: shorthand-sequence

`sequence.type` and `sequence.trackId` are boilerplate that can be omitted —
they're always `'ReferenceSequenceTrack'` and a name derived from the assembly's
`name`, respectively — leaving just the adapter:

```js
{
  name: 'hg38',
  sequence: {
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://example.com/hg38.fa.gz',
    },
  },
}
```

### Example: with-refname-aliases-and-cytobands

Adds `refNameAliases` (so `chr1` and `1` resolve to the same sequence) and
`cytobands` (ideogram banding), each fetched from its own adapter:

```js
{
  name: 'hg38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'hg38-ref',
    adapter: { type: 'BgzipFastaAdapter', uri: 'https://example.com/hg38.fa.gz' },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      location: { uri: 'https://example.com/hg38.aliases.txt' },
    },
  },
  cytobands: {
    adapter: {
      type: 'CytobandAdapter',
      cytobandLocation: { uri: 'https://example.com/hg38.cytoBand.txt' },
    },
  },
}
```

### Example: custom-display-name-and-genetic-codes-sidecar

Sets a `displayName` for the assembly selector and loads the per-refName genetic
codes from a sidecar TSV (`geneticCodesLocation`) instead of inlining them —
handy when a config generator emits the mapping separately:

```js
{
  name: 'hg38',
  displayName: 'Homo sapiens (hg38)',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'hg38-ref',
    adapter: { type: 'BgzipFastaAdapter', uri: 'https://example.com/hg38.fa.gz' },
  },
  geneticCodesLocation: { uri: 'https://example.com/hg38.genetic_codes.tsv' },
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

| Slot                                                  | Type           | Description                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [aliases](#slot-aliases)                              | `stringArray`  | aliases are "reference name aliases" e.g. aliases for hg38 might be "GRCh38"                                                                                                                                                                                                                                                                                                                                                |
| [sequence](#slot-sequence)                            |                | sequence refers to a reference sequence track that has an adapter containing, importantly, a sequence adapter such as IndexedFastaAdapter                                                                                                                                                                                                                                                                                   |
| [refNameColors](#slot-refnamecolors)                  | `stringArray`  | Define custom colors for each reference sequence. Will cycle through this list if there are not enough colors for every sequence.                                                                                                                                                                                                                                                                                           |
| [geneticCodes](#slot-geneticcodes)                    | `frozen`       | Maps a reference sequence name to an NCBI genetic-code (translation table) id for sequences that don't use the standard code, e.g. `{ "chrM": 2 }` for the vertebrate mitochondrial code or `{ "chrPltd": 11 }` for a plastid. Drives the reference sequence track's translation rows; unlisted refNames use the standard code (1). CDS-level translation reads the GFF `transl_table` attribute directly and ignores this. |
| [geneticCodesLocation](#slot-geneticcodeslocation)    | `fileLocation` | Optional file (tab-separated `refName<TAB>geneticCodeId`, `#` comments allowed) to load the same refName-to-genetic-code mapping from, instead of inlining it — useful when a config generator emits a sidecar rather than inlining per assembly. Entries in the inline `geneticCodes` slot take precedence over the file.                                                                                                  |
| [refNameAliases.adapter](#slot-refnamealiasesadapter) |                | refNameAliases help resolve e.g. chr1 and 1 as the same entity the data for refNameAliases are fetched from an adapter, that is commonly a tsv like chromAliases.txt from UCSC or similar                                                                                                                                                                                                                                   |
| [cytobands.adapter](#slot-cytobandsadapter)           |                | cytoband data is fetched from an adapter, and can be displayed by a view type as ideograms                                                                                                                                                                                                                                                                                                                                  |
| [displayName](#slot-displayname)                      | `string`       | A human readable display name for the assembly e.g. "Homo sapiens (hg38)" while the assembly name may just be "hg38"                                                                                                                                                                                                                                                                                                        |

<details>
<summary>BaseAssembly - Slots</summary>

#### slot: aliases

aliases are "reference name aliases" e.g. aliases for hg38 might be "GRCh38"

**Type:** `stringArray` · **Default:** `[]`

#### slot: sequence

sequence refers to a reference sequence track that has an adapter containing,
importantly, a sequence adapter such as IndexedFastaAdapter

```js
pluginManager.getTrackType('ReferenceSequenceTrack').configSchema
```

#### slot: refNameColors

Define custom colors for each reference sequence. Will cycle through this list
if there are not enough colors for every sequence.

**Type:** `stringArray` · **Default:** `[]`

#### slot: geneticCodes

Maps a reference sequence name to an NCBI genetic-code (translation table) id
for sequences that don't use the standard code, e.g. `{ "chrM": 2 }` for the
vertebrate mitochondrial code or `{ "chrPltd": 11 }` for a plastid. Drives the
reference sequence track's translation rows; unlisted refNames use the standard
code (1). CDS-level translation reads the GFF `transl_table` attribute directly
and ignores this.

**Type:** `frozen` · **Default:** `{}`

**Example:**

Mitochondrial contig translated with the vertebrate mitochondrial code (NCBI
table 2), a plastid contig with table 11; keys are matched through refName
aliasing:

```js
{ chrM: 2, chrPltd: 11 }
```

#### slot: geneticCodesLocation

Optional file (tab-separated `refName<TAB>geneticCodeId`, `#` comments allowed)
to load the same refName-to-genetic-code mapping from, instead of inlining it —
useful when a config generator emits a sidecar rather than inlining per
assembly. Entries in the inline `geneticCodes` slot take precedence over the
file.

**Type:** `fileLocation` · **Default:**
`{ uri: '', locationType: 'UriLocation' }`

**Example:**

The TSV is `refName<TAB>geneticCodeId` with optional `#` comment lines:

```js
{
  uri: 'https://example.com/hg38.genetic_codes.tsv'
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

A human readable display name for the assembly e.g. "Homo sapiens (hg38)" while
the assembly name may just be "hg38"

**Type:** `string` · **Default:** `''`

</details>
