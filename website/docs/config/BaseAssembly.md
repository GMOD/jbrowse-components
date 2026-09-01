---
id: baseassembly
title: BaseAssembly
sidebar_label: Assembly Management -> BaseAssembly
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/assemblyManager/assemblyConfigSchema.ts).

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

### Example: shorthand-flat

The flattest form: an assembly is just a `name` and a sequence-file `uri`.
jbrowse-core picks the adapter (`Bgzip`/`Indexed`/`TwoBit`) from the
extension, derives the `.fai`/`.gzi` siblings, and fills in the
`ReferenceSequenceTrack`. `refNameAliases`/`cytobands` take the same bare
`{ uri }` shorthand. (Keep the `uri` *key* rather than a bare string so
relative URIs still resolve against the config's location.)

```js
{
  name: 'hg38',
  uri: 'https://example.com/hg38.fa.gz',
  refNameAliases: { uri: 'https://example.com/hg38.aliases.txt' },
  cytobands: { uri: 'https://example.com/hg38.cytoBand.txt' },
}
```

### Example: shorthand-sequence

`sequence.type`/`sequence.trackId` are boilerplate that can be omitted —
they're always `'ReferenceSequenceTrack'` and a name derived from the
assembly `name` — leaving just the adapter (whose own `uri` shorthand still
infers the adapter type and index siblings):

```js
{
  name: 'hg38',
  sequence: { adapter: { uri: 'https://example.com/hg38.fa.gz' } },
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

Sets a `displayName` for the assembly selector and loads the per-refName
genetic codes from a sidecar TSV (`geneticCodesLocation`) instead of inlining
them — handy when a config generator emits the mapping separately:

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

_See the **Config slots** section below for all available configuration fields._

## Overview

This corresponds to the assemblies section of the config

### BaseAssembly - Identifier

Every BaseAssembly has a unique `name`, a required top-level field that identifies it (not one of the config slots below).

there is no separate "id" field on an assembly: the "name" is the id,
usually a short machine-readable string like hg38. For a longer
human-readable label, set the "displayName" config slot instead

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-aliases">**aliases**</span><br>`stringArray` = <code>[]</code> | aliases are "reference name aliases" e.g. aliases for hg38 might be "GRCh38" |
| <span id="slot-sequence">**sequence**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>pluginManager.getTrackType('ReferenceSequenceTrack') .configSch…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>pluginManager.getTrackType('ReferenceSequenceTrack')&#10;.configSchema</code></pre></dialog></span> | sequence refers to a reference sequence track that has an adapter containing, importantly, a sequence adapter such as IndexedFastaAdapter |
| <span id="slot-refnamecolors">**refNameColors**</span><br>`stringArray` = <code>[]</code> | Define custom colors for each reference sequence. Will cycle through this list if there are not enough colors for every sequence. |
| <span id="slot-geneticcodes">**geneticCodes**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | Maps a reference sequence name to an NCBI genetic-code (translation table) id for sequences that don't use the standard code, e.g. `{ "chrM": 2 }` for the vertebrate mitochondrial code or `{ "chrPltd": 11 }` for a plastid. Drives the reference sequence track's translation rows; unlisted refNames use the standard code (1). CDS-level translation reads the GFF `transl_table` attribute directly and ignores this.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><p>Mitochondrial contig translated with the vertebrate mitochondrial code (NCBI table 2), a plastid contig with table 11; keys are matched through refName aliasing:</p><pre><code>{ chrM: 2, chrPltd: 11 }</code></pre></dialog></span> |
| <span id="slot-geneticcodeslocation">**geneticCodesLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '', locationType: 'UriLocation' }</code> | Optional file (tab-separated `refName<TAB>geneticCodeId`, `#` comments allowed) to load the same refName-to-genetic-code mapping from, instead of inlining it — useful when a config generator emits a sidecar rather than inlining per assembly. Entries in the inline `geneticCodes` slot take precedence over the file.<br><span class="cell-more"><button type="button" class="cell-more-trigger">example</button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><p>The TSV is `refName<TAB>geneticCodeId` with optional `#` comment lines:</p><pre><code>{ uri: 'https://example.com/hg38.genetic_codes.tsv' }</code></pre></dialog></span> |
| <span id="slot-refnamealiasesadapter">**refNameAliases.adapter**</span><br><code>pluginManager.pluggableConfigSchemaType('adapter')</code> | refNameAliases help resolve e.g. chr1 and 1 as the same entity the data for refNameAliases are fetched from an adapter, that is commonly a tsv like chromAliases.txt from UCSC or similar |
| <span id="slot-cytobandsadapter">**cytobands.adapter**</span><br><code>pluginManager.pluggableConfigSchemaType('adapter')</code> | cytoband data is fetched from an adapter, and can be displayed by a view type as ideograms |
| <span id="slot-displayname">**displayName**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | A human readable display name for the assembly e.g. "Homo sapiens (hg38)" while the assembly name may just be "hg38" |
