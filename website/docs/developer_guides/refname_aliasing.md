---
id: refname_aliasing
title: RefName aliasing
---

RefName aliasing lets JBrowse map between different naming conventions for the
same chromosome — e.g. `chr1` vs `1` vs `NC_000001.10`. When an alias adapter
is configured on an assembly, JBrowse automatically translates refNames so that
tracks using different conventions all display correctly together.

The resolved refName is passed as `refName` in feature adapter queries; the
original pre-alias name is passed as `originalRefName`.

See also: [configuring reference name aliasing](/docs/config_guides/assemblies/#configuring-reference-name-aliasing).

### When to use each adapter

- **RefNameAliasAdapter** — use when you have a simple tab-separated alias file,
  such as a UCSC `chromAlias.txt` download or a hand-crafted file mapping your
  local chromosome names to standard names. Also useful when only a subset of
  aliases is needed (e.g. just chr-prefixed ↔ numeric names).

- **NcbiSequenceReportAliasAdapter** — use when working with NCBI assemblies.
  The `sequence_report.tsv` file is available from NCBI for any RefSeq assembly
  and provides mappings between GenBank accessions, RefSeq accessions, UCSC
  names, and sequence names all at once. This is the easiest path when your
  FASTA uses RefSeq accession names (e.g. `NC_000001.11`) but you want
  UCSC-style names (`chr1`) shown in the browser.

**Common scenarios:**

| Situation | Recommended adapter |
|---|---|
| UCSC genome, FASTA uses `chr1`-style names, tracks use `1`-style | `RefNameAliasAdapter` with UCSC chromAlias file |
| NCBI/RefSeq genome, mix of accession and sequence names | `NcbiSequenceReportAliasAdapter` |
| Custom organism with hand-maintained aliases | `RefNameAliasAdapter` with a simple TSV you create |
| FASTA uses UCSC names but tracks use RefSeq accessions | `NcbiSequenceReportAliasAdapter` with `useNameOverride: true` (default) |
| FASTA uses RefSeq accessions, want accession-based query | `NcbiSequenceReportAliasAdapter` with `useNameOverride: false` |

### RefNameAliasAdapter

Reads any tab-separated alias file, including the
[UCSC chromAliases](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/chromAlias.txt.gz)
format.

**Example file:**

```
chr1	1	NC_000001.10
chr2	2	NC_000002.11
```

Each row lists a set of names for the same sequence, separated by tabs. One
column is designated as the "primary" refName that must match the names in your
FASTA/sequence adapter — all other columns become aliases.

**Config:**

```json
{
  "type": "RefNameAliasAdapter",
  "location": { "uri": "aliases.txt" }
}
```

Or the shorthand form:

```json
{
  "type": "RefNameAliasAdapter",
  "uri": "aliases.txt"
}
```

**Options:**

- `refNameColumn` (number, default `0`) — zero-based index of the column that
  matches your FASTA. In the example above, `0` means `chr1`/`chr2` must match
  your FASTA.
- `refNameColumnHeaderName` (string) — alternative to `refNameColumn`. If your
  file has a `#`-prefixed header line, you can specify the column by name
  instead of index.

**Header-based example:**

```
#name	alias1	alias2
chr1	1	NC_000001.10
```

```json
{
  "type": "RefNameAliasAdapter",
  "uri": "aliases.txt",
  "refNameColumnHeaderName": "name"
}
```

### NcbiSequenceReportAliasAdapter

Reads NCBI `sequence_report.tsv` files, which contain standardized mappings
between GenBank, RefSeq, UCSC, and sequence names.

**Config:**

```json
{
  "type": "NcbiSequenceReportAliasAdapter",
  "location": { "uri": "sequence_report.tsv" }
}
```

Or shorthand:

```json
{
  "type": "NcbiSequenceReportAliasAdapter",
  "uri": "sequence_report.tsv"
}
```

The file must include these column headers (by name, not position):
`GenBank seq accession`, `RefSeq seq accession`, `UCSC style name`,
`Sequence name`.

The primary refName is taken from `UCSC style name` if present, otherwise
`Sequence name`. All four columns become aliases for that refName.

**Options:**

- `useNameOverride` (boolean, default `true`) — forces UCSC-style names to take
  precedence over NCBI-style names from the FASTA. Set to `false` if your FASTA
  uses NCBI/RefSeq accession names.
