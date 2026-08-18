---
title: RefName aliasing
description:
  Map between chromosome naming conventions across tracks and assemblies
guide_category: Advanced topics
---

RefName aliasing lets JBrowse treat different naming conventions for the same
chromosome (e.g. `chr1` vs `1` vs `NC_000001.11`) as a single sequence. With an
alias adapter configured on an assembly, JBrowse translates refNames so tracks
using different conventions all line up.

**TL;DR:** Configure an alias adapter on the assembly. Use `RefNameAliasAdapter`
for a UCSC-style tab file, `NcbiSequenceReportAliasAdapter` for an NCBI
`sequence_report.tsv`. The primary refName must match your FASTA exactly.

## How resolution works

Keep three distinct names in mind:

- canonical name - what JBrowse displays and navigates by. Every alias resolves
  to it. Defaults to the name in your FASTA / sequence adapter.
- sequence-adapter (FASTA) name - the name your reference file uses. Usually the
  same as the canonical name, but can differ (see `useNameOverride` below).
- track refName - the name a track's data file uses. Each track's regions are
  translated from the canonical name into that track's naming scheme before
  querying, so a BAM using `1` and a VCF using `chr1` both work against a `chr1`
  canonical assembly.

When queried, a track adapter gets the resolved track refName as `refName` and
the sequence-adapter name as `originalRefName` (used by CRAM/BAM to fetch the
correct reference bases). See also
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
FASTA/sequence adapter; the other columns become aliases. The primary column is
the first by default; use `refNameColumn` (below) to pick a different one.

```json addassembly
{
  "name": "hg38",
  "uri": "hg38.fa.gz",
  "refNameAliases": { "uri": "aliases.txt" }
}
```

That bare `{ "uri": ... }` is the shorthand for the default
`RefNameAliasAdapter`. Spell the adapter out when you need one of its options,
or a different alias adapter entirely:

```json addassembly
{
  "name": "hg38",
  "uri": "hg38.fa.gz",
  "refNameAliases": {
    "adapter": {
      "type": "RefNameAliasAdapter",
      "uri": "aliases.txt"
    }
  }
}
```

(`"uri": "..."` is shorthand for `"location": { "uri": "..." }`.)

**Options:**

- [`refNameColumn`](/docs/config/refnamealiasadapter/#slot-refnamecolumn) -
  zero-based index of the column matching your FASTA. Above, that's the first
  column (`chr1`/`chr2`).
- `refNameColumnHeaderName` (string) - alternative to `refNameColumn`. Selects
  the primary column by its header name instead of by index, read from the
  **last** `#`-prefixed line in the file (the one immediately above the data, so
  a file with a comment block still resolves against the real header). The
  adapter throws if the named column is not in that header, rather than silently
  producing no aliases — but note it only looks when a `#` line exists at all: a
  file with no header row falls back to `refNameColumn` without complaint.

```
#name	alias1	alias2
chr1	1	NC_000001.11
```

```json addassembly
{
  "name": "hg38",
  "uri": "hg38.fa.gz",
  "refNameAliases": {
    "adapter": {
      "type": "RefNameAliasAdapter",
      "uri": "aliases.txt",
      "refNameColumnHeaderName": "name"
    }
  }
}
```

## NcbiSequenceReportAliasAdapter

Reads NCBI `sequence_report.tsv` files, which map GenBank accessions, RefSeq
accessions, UCSC-style names, and sequence names all at once. Get them from the
[NCBI datasets](https://www.ncbi.nlm.nih.gov/datasets/) page for any RefSeq
assembly, or the `datasets` CLI.

```json
{
  "name": "GCF_000001405.40",
  "uri": "GCF_000001405.40.fa.gz",
  "refNameAliases": {
    "adapter": {
      "type": "NcbiSequenceReportAliasAdapter",
      "uri": "sequence_report.tsv"
    }
  }
}
```

Three column headers are required, matched by name rather than position:
`GenBank seq accession`, `RefSeq seq accession` and `UCSC style name`. A fourth,
`Sequence name`, is optional. The primary refName is taken from
`UCSC style name`, falling back to `Sequence name` where that column exists and
the UCSC one is blank — so a row with neither is skipped rather than mapping an
empty name. Whichever of the four columns a row does fill become aliases for it.

**Options:**

- [`useNameOverride`](/docs/config/ncbisequencereportaliasadapter/#slot-usenameoverride)
  controls which name is canonical (displayed) when your FASTA does **not** use
  UCSC names:
  - `true` - show UCSC-style names (`chr1`) even though your FASTA uses RefSeq
    accessions (`NC_000001.11`); JBrowse still fetches reference bases from the
    FASTA under `NC_000001.11`. The common case for NCBI FASTAs.
  - `false` - keep your FASTA's own names canonical. JBrowse displays
    `NC_000001.11`, and `chr1` resolves to it as a searchable alias.

## Troubleshooting

- **Aliases don't resolve / tracks appear empty.** The primary refName must
  match your FASTA exactly. For `RefNameAliasAdapter`, confirm `refNameColumn`
  points at the column whose values equal your FASTA's sequence names.
- **`Encountered invalid refName` error.** A name in the alias file contains
  characters outside the
  [SAM-spec refName](https://samtools.github.io/hts-specs/SAMv1.pdf) set (e.g.
  stray whitespace or quoting). Clean the offending row.
- **NCBI adapter throws about the header line.** The error names the missing
  column. The first line must carry the three required headers spelled exactly
  as above; a renamed column reads as an absent one. `Sequence name` is not
  required, so a file without it parses.

## See also

- [Configuring reference name aliasing](/docs/config_guides/assemblies/#configuring-reference-name-aliasing)
- Adapter config reference: [](/docs/config/refnamealiasadapter) and
  [](/docs/config/ncbisequencereportaliasadapter)
- [](/docs/developer_guides/creating_adapter)
- [](/docs/developer_guides/rpc_workers)
- [REFNAME_NAMESPACES.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/REFNAME_NAMESPACES.md)
  — why `refName` means two different things either side of the RPC boundary,
  and the rule for when canonicalizing an answer is safe
