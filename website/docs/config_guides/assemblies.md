---
title: Configuring assemblies
description:
  Setting up reference genomes with sequence adapters and refname aliases
guide_category: Core configuration
---

An assembly configuration has a `name`, optional `aliases` (e.g. GRCh37/hg19),
and a `sequence` containing a reference sequence track config.

Here is a complete config.json file containing only the hg19 assembly:

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
          "fastaLocation": {
            "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz",
            "locationType": "UriLocation"
          },
          "faiLocation": {
            "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.fai",
            "locationType": "UriLocation"
          },
          "gziLocation": {
            "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.gzi",
            "locationType": "UriLocation"
          }
        }
      },
      "refNameAliases": {
        "adapter": {
          "type": "RefNameAliasAdapter",
          "location": {
            "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt",
            "locationType": "UriLocation"
          }
        }
      }
    }
  ]
}
```

Each assembly contains:

- `name` - unique assembly name; each track references this name
- `aliases` - alternate names for the assembly (e.g. hg19/GRCh37). Aliases are
  most useful when connecting to a UCSC trackHub, which specifies assembly names
  that may differ from your own
- `sequence` - a ReferenceSequenceTrack with an adapter configuration. Supported
  adapters: `IndexedFastaAdapter` (fasta.fa + fasta.fai), `BgzipFastaAdapter`
  (fasta.fa.gz + fasta.fa.gz.fai + fasta.fa.gz.gzi), `ChromSizesAdapter`
  (chromosome names only, no sequence)

### Configuring reference name aliasing

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

### Configuring alternative genetic codes (translation tables)

JBrowse translates protein-coding sequences using the standard genetic code
(NCBI translation table 1) by default. Some sequences use a different code — for
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
  feature details. No assembly config is needed — the per-CDS attribute is
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
`geneticCodesLocation` — useful when a config generator emits the mapping
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
    "uri": "https://example.com/grch38.genetic_codes.tsv",
    "locationType": "UriLocation"
  }
}
```

If both are present, entries in the inline `geneticCodes` map take precedence
over the file. See the [BaseAssembly config docs](/docs/config/baseassembly/)
for the slot reference.

### Adding an assembly with the CLI

Rather than writing this config by hand, the `jbrowse add-assembly` command
generates it for you (and copies the files into place). See the
[web quick start](/docs/quickstart_web/) for the full walkthrough, the
[CLI guide](/docs/cli/#jbrowse-add-assembly) for the `add-assembly` options, or
the [admin server quick start](/docs/quickstart_adminserver/) to add assemblies
graphically through the assembly manager.

### BgzipFastaAdapter

A bgzip FASTA is generated with:

```bash
bgzip -i sequence.fa
samtools faidx sequence.fa.gz

## above commands generate the following three files
sequence.fa.gz
sequence.fa.gz.gzi
sequence.fa.gz.fai
```

The adapter config uses `fastaLocation`, `faiLocation`, and `gziLocation` as
shown in the complete config example above.

A reduced form is also accepted: when only `uri` is given, the adapter assumes
the index files sit next to the data file with the standard suffixes appended
(here `yourfile.fa.gz.fai` and `yourfile.fa.gz.gzi`). The other sequence
adapters below accept the same `uri` shorthand. See the
[BgzipFastaAdapter config docs](/docs/config/bgzipfastaadapter) for all options.

```json
{
  "type": "BgzipFastaAdapter",
  "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz"
}
```

### IndexedFastaAdapter

An indexed FASTA uses an uncompressed `.fa` plus a `.fai` index.

```bash
samtools faidx sequence.fa

## above command generates the .fai index file
sequence.fa
sequence.fa.fai
```

These are loaded into an IndexedFastaAdapter as follows

```json
{
  "type": "IndexedFastaAdapter",
  "fastaLocation": {
    "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa",
    "locationType": "UriLocation"
  },
  "faiLocation": {
    "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.fai",
    "locationType": "UriLocation"
  }
}
```

The same `uri` shorthand applies (here the index is assumed at
`yourfile.fa.fai`); see the
[IndexedFastaAdapter config docs](/docs/config/indexedfastaadapter) for all
options.

```json
{
  "type": "IndexedFastaAdapter",
  "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa"
}
```

#### FASTA metadata

Meta-information on the assembly can be specified by adding the following
section to either the IndexedFastaAdapter or BgzipFastaAdapter configuration.
One option for the contents of this metadata is the FFRGS (Fair Formatted
Reference Genome Standard) header specification for FASTA files, found
[here](https://github.com/FFRGS/FFRGS-Specification). The raw plaintext is
displayed as-is, so the format is not strict from JBrowse's perspective.

```json
  "metadataLocation": {
    "uri": "https://raw.githubusercontent.com/FFRGS/FFRGS-Specification/main/examples/example.yaml",
    "locationType": "UriLocation"
  }
```

### TwoBitAdapter

The UCSC twoBit adapter is also supported. Note however that the 2bit format has
a longer startup time than other adapters because there is a larger upfront
parsing time.

```json
{
  "type": "TwoBitAdapter",
  "twoBitLocation": {
    "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.2bit",
    "locationType": "UriLocation"
  }
}
```

Optionally you can specify a .chrom.sizes file which will speed up loading the
2bit especially if it has many chromosomes in it

```json
{
  "type": "TwoBitAdapter",
  "twoBitLocation": {
    "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.2bit",
    "locationType": "UriLocation"
  },
  "chromSizesLocation": {
    "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.chrom.sizes",
    "locationType": "UriLocation"
  }
}
```

The `uri` shorthand applies here too, with an optional `chromSizes` field (see
the [TwoBitAdapter config docs](/docs/config/twobitadapter) for all options):

```json
{
  "type": "TwoBitAdapter",
  "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.2bit",
  "chromSizes": "https://jbrowse.org/genomes/hg19/fasta/hg19.chrom.sizes"
}
```
