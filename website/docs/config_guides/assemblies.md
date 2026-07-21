---
title: Assemblies
description:
  Setting up reference genomes with sequence adapters and refname aliases
guide_category: Core configuration
---

An assembly configuration has a `name`, optional `aliases` (e.g. GRCh37/hg19),
and a `sequence` containing a reference sequence track config.

At its flattest, an assembly is just a `name` and a sequence-file `uri`:

```json
{
  "assemblies": [{ "name": "hg19", "uri": "hg19.fa.gz" }]
}
```

JBrowse picks the adapter from the file extension (`.2bit` → `TwoBitAdapter`,
`.fa.gz` → `BgzipFastaAdapter`, `.fa` → `IndexedFastaAdapter`), derives the
`.fai`/`.gzi` index siblings, and fills in the `ReferenceSequenceTrack`.
`refNameAliases` and `cytobands` take the same bare `{ "uri": "..." }`
shorthand. Keep the `uri` _key_ (not a bare string) so relative uris resolve
against the config's location.

The full form spells out everything the shorthand fills in. Here is a complete
config.json file containing only the hg19 assembly:

```json
{
  "assemblies": [
    {
      "name": "hg19",
      "aliases": ["GRCh37"],
      "sequence": {
        "type": "ReferenceSequenceTrack",
        "trackId": "hg19_config",
        "adapter": {
          "type": "BgzipFastaAdapter",
          "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz"
        }
      },
      "refNameAliases": {
        "adapter": {
          "type": "RefNameAliasAdapter",
          "location": {
            "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt"
          }
        }
      }
    }
  ]
}
```

Each assembly contains:

- `name` - unique assembly name. Each track references this name. There is no
  separate `id` field. The `name` is the id, usually a short machine-readable
  string like `hg38`
- `displayName` - optional human-readable label shown in the assembly selector
  (e.g. `"Homo sapiens (hg38)"`)
- `aliases` - alternate names for the assembly (e.g. hg19/GRCh37). Aliases are
  most useful when connecting to a UCSC trackHub, which specifies assembly names
  that may differ from your own
- `sequence` - a ReferenceSequenceTrack with an adapter configuration. Supported
  adapters: `IndexedFastaAdapter` (fasta.fa + fasta.fai), `BgzipFastaAdapter`
  (fasta.fa.gz + fasta.fa.gz.fai + fasta.fa.gz.gzi), `TwoBitAdapter` (UCSC
  .2bit), `UnindexedFastaAdapter` (plain .fa, no index), and `ChromSizesAdapter`
  (chromosome names only, no sequence)
- `refNameAliases` - maps differently-named chromosomes to the same sequence
  (see below)
- `cytobands` - optional ideogram banding data, shown by views that draw
  ideograms (see below)
- `refNameColors` - optional list of colors cycled across the reference
  sequences
- `geneticCodes` - optional per-refName translation-table override for codon and
  protein translation (see below)

## Configuring reference name aliasing

Reference name aliasing maps chromosomes named differently across files to the
same sequence (e.g. `chr1` ↔ `1`). The `refNameAliases` field in the config
above enables this using a tab-separated alias file where each row lists all
names for one sequence. By default the first column is treated as the primary
name (matching your FASTA), and the remaining columns are aliases:

```
1	chr1
2	chr2
...
M	chrM	MT
```

UCSC
[chromAlias files](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chromAlias.txt)
match this format. For NCBI assemblies, use `NcbiSequenceReportAliasAdapter`
with an NCBI `sequence_report.tsv` instead.

See [RefName aliasing](/docs/developer_guides/refname_aliasing) for full details
on adapter options and configuration.

## Configuring alternative genetic codes (translation tables)

JBrowse translates protein-coding sequences using the standard genetic code
(NCBI translation table 1) by default. Some sequences use a different code. For
example, vertebrate mitochondria use table 2 (where `TGA` codes for tryptophan
rather than a stop, and `ATA` codes for methionine), and many plastids and
bacteria use table 11. The full list of tables is on the
[NCBI genetic codes page](https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi).

There are two places a genetic code can come from, and they are resolved
independently:

- **CDS features (gene tracks and the feature-detail protein panel)** read the
  genetic code straight from the GFF. Put a `transl_table` attribute on the CDS
  (the NCBI convention), e.g. `transl_table=2`, and that code is used when
  drawing the peptide letters and when computing the protein sequence in the
  feature details. No assembly config is needed. The per-CDS attribute is
  authoritative. Start codons and `transl_except` overrides (such as
  selenocysteine) are honored.

- **The reference sequence track's six-frame translation rows** have no CDS
  feature to read from (they translate the raw reference), so the code is taken
  from the assembly config. Add a `geneticCodes` map to the assembly that maps a
  reference sequence name to its NCBI table id:

```json
{
  "name": "GRCh38",
  "sequence": {
    "type": "ReferenceSequenceTrack",
    "trackId": "GRCh38-ReferenceSequenceTrack",
    "adapter": {
      "type": "BgzipFastaAdapter",
      "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz"
    }
  },
  "geneticCodes": {
    "chrM": 2
  }
}
```

Reference sequences not listed in the map use the standard code (1). The keys
are matched through reference-name aliasing, so a key of `chrM` still applies if
the sequence is named `MT` in your FASTA.

Instead of inlining the map you can load it from a sidecar TSV file with
`geneticCodesLocation`, useful when a config generator emits the mapping
separately. The file is tab-separated `refName<TAB>geneticCodeId`, and `#`
comment lines are allowed:

```
# refName	geneticCodeId
chrM	2
chrPltd	11
```

```json
{
  "geneticCodesLocation": {
    "uri": "https://example.com/grch38.genetic_codes.tsv"
  }
}
```

If both are present, entries in the inline `geneticCodes` map take precedence
over the file. See the [BaseAssembly config docs](/docs/config/baseassembly/)
for the slot reference.

## Adding an assembly with the CLI

Rather than writing this config by hand, the `jbrowse add-assembly` command
generates it for you (and copies the files into place). See the
[web quick start](/docs/quickstart_web/) for the full walkthrough, or the
[CLI guide](/docs/cli/#jbrowse-add-assembly) for the `add-assembly` options.

## BgzipFastaAdapter

A bgzip FASTA is generated with:

```bash
bgzip -i sequence.fa
samtools faidx sequence.fa.gz

## above commands generate the following three files
sequence.fa.gz
sequence.fa.gz.gzi
sequence.fa.gz.fai
```

With the `uri` shorthand (as in the assembly above) the adapter assumes the two
index files sit next to the data file with the standard suffixes appended (here
`hg19.fa.gz.fai` and `hg19.fa.gz.gzi`). The other sequence adapters below accept
the same shorthand.

```json
{
  "type": "BgzipFastaAdapter",
  "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz"
}
```

Spell out the `fastaLocation`, `faiLocation`, and `gziLocation` slots only when
the index files are named differently (see the
[BgzipFastaAdapter config docs](/docs/config/bgzipfastaadapter) for all
options):

```json
{
  "type": "BgzipFastaAdapter",
  "fastaLocation": { "uri": "https://example.com/genome.fa.gz" },
  "faiLocation": { "uri": "https://example.com/genome.index.fai" },
  "gziLocation": { "uri": "https://example.com/genome.index.gzi" }
}
```

## IndexedFastaAdapter

An indexed FASTA uses an uncompressed `.fa` plus a `.fai` index.

```bash
samtools faidx sequence.fa

## above command generates the .fai index file
sequence.fa
sequence.fa.fai
```

Load it with the `uri` shorthand (the index is assumed at `<uri>.fai`):

```json
{
  "type": "IndexedFastaAdapter",
  "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa"
}
```

Spell out the `fastaLocation` and `faiLocation` slots only when the `.fai` is
named differently (see the
[IndexedFastaAdapter config docs](/docs/config/indexedfastaadapter) for all
options):

```json
{
  "type": "IndexedFastaAdapter",
  "fastaLocation": { "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa" },
  "faiLocation": { "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.fai" }
}
```

## UnindexedFastaAdapter

A plain (non-bgzipped) FASTA with no separate index. The adapter reads the whole
sequence into memory, so prefer `IndexedFastaAdapter` or `BgzipFastaAdapter` for
large genomes. This is mainly convenient for small genomes where you don't want
to run `samtools faidx`.

```json
{
  "type": "UnindexedFastaAdapter",
  "uri": "https://example.com/genome.fa"
}
```

The full form uses `fastaLocation` (see the
[UnindexedFastaAdapter config docs](/docs/config/unindexedfastaadapter) for all
options).

### FASTA metadata

Attach free-form metadata via `metadataLocation` on an IndexedFastaAdapter or
BgzipFastaAdapter. One documented option is the
[FFRGS (Fair Formatted Reference Genome Standard) specification](https://github.com/FFRGS/FFRGS-Specification).
The raw plaintext is displayed as-is, so the format is not strict from JBrowse's
perspective.

```json
{
  "type": "IndexedFastaAdapter",
  "uri": "https://example.com/genome.fa",
  "metadataLocation": {
    "uri": "https://raw.githubusercontent.com/FFRGS/FFRGS-Specification/main/examples/example.yaml"
  }
}
```

## TwoBitAdapter

The UCSC twoBit format has a longer startup time than other adapters due to
upfront parsing.

```json
{
  "type": "TwoBitAdapter",
  "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.2bit"
}
```

Optionally add a `.chrom.sizes` file, which speeds up loading a 2bit that has
many chromosomes:

```json
{
  "type": "TwoBitAdapter",
  "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.2bit",
  "chromSizes": "https://jbrowse.org/genomes/hg19/fasta/hg19.chrom.sizes"
}
```

The longhand form uses the `twoBitLocation` and `chromSizesLocation` slots. See
the [TwoBitAdapter config docs](/docs/config/twobitadapter) for all options.

## ChromSizesAdapter

When you only have chromosome names and lengths but no actual sequence (for
example to set up a karyotype or to anchor synteny/whole-genome views without
loading a FASTA), use a `.chrom.sizes` file (tab-separated `name<TAB>length`).

```json
{
  "type": "ChromSizesAdapter",
  "uri": "https://jbrowse.org/genomes/hg19/hg19.chrom.sizes"
}
```

The longhand form uses a `chromSizesLocation` slot. See the
[ChromSizesAdapter config docs](/docs/config/chromsizesadapter) for all options.

The reference sequence track displays no base-level sequence with this adapter.

## Configuring cytoband ideograms

The optional `cytobands` field supplies chromosome banding data, which views can
draw as an ideogram (the chromosome overview with stained bands). The data is
fetched from a `CytobandAdapter` pointing at a UCSC-style `cytoBand.txt` file:

```json
{
  "name": "hg19",
  "sequence": {
    "type": "ReferenceSequenceTrack",
    "trackId": "hg19_config",
    "adapter": {
      "type": "BgzipFastaAdapter",
      "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz"
    }
  },
  "cytobands": {
    "adapter": {
      "type": "CytobandAdapter",
      "cytobandLocation": {
        "uri": "https://jbrowse.org/genomes/hg19/hg19_cytoband.txt"
      }
    }
  }
}
```

## Customizing reference sequence colors

The optional `refNameColors` field assigns colors to the reference sequences
(used in overviews such as the whole-genome ideogram). It is a list of CSS
colors cycled across the sequences in order, so it does not need an entry per
chromosome:

```json
{
  "refNameColors": ["red", "green", "blue", "orange", "purple"]
}
```

## See also

- [Sequence track](/docs/user_guides/sequence_track)
- [Basic usage](/docs/user_guides/basic_usage)
- [BaseAssembly config docs](/docs/config/baseassembly/)
