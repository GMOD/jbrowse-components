---
id: ncbisequencereportaliasadapter
title: NcbiSequenceReportAliasAdapter
sidebar_label: Adapter -> NcbiSequenceReportAliasAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `config` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/NcbiSequenceReportAliasAdapter/configSchema.ts).

## Example usage

Goes on an ASSEMBLY, under `refNameAliases` — not on a track. The file ships
beside any RefSeq assembly on NCBI datasets and aliases the RefSeq, GenBank
and UCSC-style names of every sequence at once, so it replaces a
hand-maintained chromAlias table:

```js
{
  name: 'GCF_000001405.40',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'GCF_000001405.40-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://example.com/GCF_000001405.40.fa.gz',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'NcbiSequenceReportAliasAdapter',
      uri: 'https://example.com/GCF_000001405.40_sequence_report.tsv',
    },
  },
}
```

### Example: keeping the FASTA's own names

With an NCBI FASTA (`NC_000001.11`), the default displays UCSC-style names
(`chr1`) while still fetching bases under the accession. Set
`useNameOverride: false` to display the accessions instead, with `chr1` left
searchable as an alias:

```js
{
  name: 'GCF_000001405.40',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'GCF_000001405.40-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://example.com/GCF_000001405.40.fa.gz',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'NcbiSequenceReportAliasAdapter',
      uri: 'https://example.com/GCF_000001405.40_sequence_report.tsv',
      useNameOverride: false,
    },
  },
}
```

_See the **Config slots** section below for all available configuration fields._

can read "sequence_report.tsv" type files from NCBI

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "NcbiSequenceReportAliasAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-location">**location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/my/sequence_report.tsv', locationType: 'UriLoc…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ uri: '/path/to/my/sequence_report.tsv', locationType: 'UriLocation' }</code></pre></dialog></span> | location of the `sequence_report.tsv` NCBI publishes with an assembly. It carries the RefSeq, GenBank and UCSC-style name of every sequence, so one file aliases them all without hand-writing a chromAlias table. |
| <span id="slot-usenameoverride">**useNameOverride**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | forces usage of the UCSC names over the NCBI style names from a FASTA |
