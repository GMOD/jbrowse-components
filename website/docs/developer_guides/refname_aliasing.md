---
title: RefName aliasing
description:
  Map between chromosome naming conventions across tracks and assemblies
guide_category: Advanced topics
---

RefName aliasing lets JBrowse treat different naming conventions for the same
chromosome — e.g. `chr1` vs `1` vs `NC_000001.11` — as a single sequence. When
an alias adapter is configured on an assembly, JBrowse automatically translates
refNames so that tracks using different conventions all line up and display
together.

## How resolution works

It helps to keep three distinct names in mind:

- **canonical name** — the name JBrowse displays and uses for navigation. Every
  alias of a sequence resolves to its canonical name. By default this is the
  name in your FASTA / sequence adapter.
- **sequence-adapter (FASTA) name** — the name your reference sequence file
  actually uses. Usually the same as the canonical name, but it can differ (see
  `useNameOverride` below).
- **track refName** — the name an individual track's data file uses. Each
  track's regions are translated from the canonical name into that track's own
  naming scheme before querying it, so a BAM that uses `1` and a VCF that uses
  `chr1` both work against a `chr1` canonical assembly.

When a track adapter is queried, the resolved track refName is passed as
`refName`, and the sequence-adapter name is passed as `originalRefName` (used by
CRAM/BAM to fetch the correct reference bases). See also
[configuring reference name aliasing](/docs/config_guides/assemblies/#configuring-reference-name-aliasing).

## Choosing an adapter

| Situation                                              | Recommended adapter                                       |
| ------------------------------------------------------ | --------------------------------------------------------- |
| UCSC genome, or any hand-maintained tab-separated file | `RefNameAliasAdapter`                                     |
| NCBI/RefSeq genome with a `sequence_report.tsv`        | `NcbiSequenceReportAliasAdapter`                          |
| FASTA uses RefSeq accessions but you want `chr1` shown | `NcbiSequenceReportAliasAdapter` (default)                |
| FASTA uses RefSeq accessions and you want them shown   | `NcbiSequenceReportAliasAdapter`, `useNameOverride:false` |

## RefNameAliasAdapter

Reads any tab-separated alias file, including the UCSC
[chromAlias](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chromAlias.txt)
format. Each row lists every name for one sequence:

```
chr1	1	NC_000001.11
chr2	2	NC_000002.12
```

One column is the "primary" refName that must match the names in your
FASTA/sequence adapter; the other columns become aliases. By default the primary
column is the first one; use `refNameColumn` (below) to pick a different column.

```json
{
  "type": "RefNameAliasAdapter",
  "uri": "aliases.txt"
}
```

(`"uri": "..."` is shorthand for `"location": { "uri": "..." }`.)

**Options:**

- [`refNameColumn`](/docs/config/refnamealiasadapter/#slot-refnamecolumn) —
  zero-based index of the column that matches your FASTA. In the example above,
  the first column (`chr1`/`chr2`) is the one that must match your FASTA.
- `refNameColumnHeaderName` (string) — alternative to `refNameColumn`. If your
  file has a `#`-prefixed header line, select the primary column by its header
  name instead of by index. If the named column is not found, the adapter throws
  rather than silently producing no aliases.

```
#name	alias1	alias2
chr1	1	NC_000001.11
```

```json
{
  "type": "RefNameAliasAdapter",
  "uri": "aliases.txt",
  "refNameColumnHeaderName": "name"
}
```

## NcbiSequenceReportAliasAdapter

Reads NCBI `sequence_report.tsv` files, which map GenBank accessions, RefSeq
accessions, UCSC-style names, and sequence names all at once. These are
available from the [NCBI datasets](https://www.ncbi.nlm.nih.gov/datasets/) page
for any RefSeq assembly (also downloadable with the `datasets` CLI).

```json
{
  "type": "NcbiSequenceReportAliasAdapter",
  "uri": "sequence_report.tsv"
}
```

The file must include these column headers (matched by name, not position):
`GenBank seq accession`, `RefSeq seq accession`, `UCSC style name`, and
`Sequence name`. The primary refName is taken from `UCSC style name`, falling
back to `Sequence name`; all four columns become aliases for it.

**Options:**

- [`useNameOverride`](/docs/config/ncbisequencereportaliasadapter/#slot-usenameoverride)
  — controls which name is canonical (displayed) when your FASTA does **not**
  use UCSC names:
  - **`true`** — show UCSC-style names (`chr1`) even though your FASTA uses
    RefSeq accessions (`NC_000001.11`). JBrowse displays `chr1` and still
    fetches reference bases from the FASTA under `NC_000001.11` behind the
    scenes. This is the common case for NCBI FASTAs.
  - **`false`** — keep your FASTA's own names canonical. JBrowse displays
    `NC_000001.11`, and `chr1` resolves to it as a searchable alias.

## Troubleshooting

- **Aliases don't resolve / tracks appear empty.** The primary refName must
  match your FASTA exactly. For `RefNameAliasAdapter`, confirm `refNameColumn`
  points at the column whose values equal your FASTA's sequence names.
- **`Encountered invalid refName` error.** A name in the alias file contains
  characters outside the
  [SAM-spec refName](https://samtools.github.io/hts-specs/SAMv1.pdf) set (e.g.
  stray whitespace or quoting). Clean the offending row.
- **NCBI adapter throws about the header line.** The first line must contain the
  required column headers spelled exactly as above; a file missing them (or with
  renamed columns) will not parse.

## See also

- [Configuring reference name aliasing](/docs/config_guides/assemblies/#configuring-reference-name-aliasing)
- Adapter config reference:
  [RefNameAliasAdapter](/docs/config/refnamealiasadapter) and
  [NcbiSequenceReportAliasAdapter](/docs/config/ncbisequencereportaliasadapter)
- [Creating custom adapters](/docs/developer_guides/creating_adapter)
- [RPC and worker system](/docs/developer_guides/rpc_workers) — documents
  `renameRegions`, the resolution mechanism described above
