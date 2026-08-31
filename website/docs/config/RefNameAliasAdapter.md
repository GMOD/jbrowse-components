---
id: refnamealiasadapter
title: RefNameAliasAdapter
sidebar_label: Adapter -> RefNameAliasAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `config` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/RefNameAliasAdapter/configSchema.ts).

## Example usage

Goes on an ASSEMBLY, under `refNameAliases` — not on a track. Writing
`refNameAliases: { uri: '...' }` is shorthand for exactly this adapter:
```js
{
  name: 'hg38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'hg38-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://example.com/hg38.fa.gz',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://example.com/hg38.chromAlias.txt',
    },
  },
}
```

### Example: named column

When the primary column — the one whose values match your FASTA — is not the
first, name it. `refNameColumnHeaderName` reads the last `#`-prefixed line as
the header; `refNameColumn` takes a zero-based index instead.
```js
{
  name: 'hg38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'hg38-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://example.com/hg38.fa.gz',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://example.com/aliases.txt',
      refNameColumnHeaderName: 'ucsc',
    },
  },
}
```

_See the **Config slots** section below for all available configuration fields._

can read "chromAliases" type files from UCSC or any tab separated file of
refName aliases

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "RefNameAliasAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-location">**location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my/aliases.txt', locationType: 'UriLocation' }</code> | location of the alias table: a UCSC `chromAlias.txt`, or any tab-separated file whose rows each list the alternate names of one reference sequence (`chr1<TAB>1<TAB>NC_000001.11`). It is what lets a `1`-named file load against a `chr1`-named assembly. |
| <span id="slot-refnamecolumn">**refNameColumn**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | by default, the "ref names that match the fasta" are assumed to be in the first column (0), change this variable if needed<br>_advanced_ |
| <span id="slot-refnamecolumnheadername">**refNameColumnHeaderName**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | refNameColumnHeaderName<br>_advanced_ |
