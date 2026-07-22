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

```json
{
  "assemblies": [
    {
      "name": "hg38",
      "uri": "hg38.fa.gz",
      "refNameAliases": { "uri": "hg38.aliases.txt" },
      "cytobands": { "uri": "hg38.cytoBand.txt" }
    }
  ]
}
```

To keep the shorthand adapter inference but name the adapter or set slots on it,
write only `sequence.adapter`. `sequence.type` and `sequence.trackId` are always
boilerplate and can stay omitted:

```json
{
  "name": "hg38",
  "sequence": { "adapter": { "uri": "hg38.fa.gz" } }
}
```

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

## Sequence adapters

Every sequence adapter takes the
[`uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand), which
resolves the index files sitting beside the data file. Spell out the longhand
slots only when they are named differently; each adapter's config page lists
them.

| Adapter                                                     | Files                                  | Prepare with            |
| ----------------------------------------------------------- | -------------------------------------- | ----------------------- |
| [BgzipFastaAdapter](/docs/config/bgzipfastaadapter)         | `.fa.gz` + `.fa.gz.fai` + `.fa.gz.gzi` | `bgzip -i` then `faidx` |
| [IndexedFastaAdapter](/docs/config/indexedfastaadapter)     | `.fa` + `.fa.fai`                      | `samtools faidx`        |
| [UnindexedFastaAdapter](/docs/config/unindexedfastaadapter) | `.fa`                                  | nothing                 |
| [TwoBitAdapter](/docs/config/twobitadapter)                 | `.2bit`, optionally `.chrom.sizes`     | UCSC `faToTwoBit`       |
| [ChromSizesAdapter](/docs/config/chromsizesadapter)         | `.chrom.sizes`                         | nothing                 |

```bash
bgzip -i sequence.fa           # -> sequence.fa.gz + sequence.fa.gz.gzi
samtools faidx sequence.fa.gz  # -> sequence.fa.gz.fai
```

A few things worth knowing when choosing:

- `UnindexedFastaAdapter` reads the whole sequence into memory. It is for small
  genomes where you don't want to run `samtools faidx`.
- `TwoBitAdapter` parses upfront, so it has a longer startup time. Adding a
  `chromSizes` file speeds up a 2bit with many chromosomes.
- `ChromSizesAdapter` has names and lengths but no sequence, so the reference
  sequence track shows no bases. Use it to anchor a karyotype or a synteny or
  whole-genome view without loading a FASTA.
- `metadataLocation` on an indexed or bgzipped FASTA attaches free-form
  metadata, displayed as-is. The
  [FFRGS specification](https://github.com/FFRGS/FFRGS-Specification) is one
  documented option, but JBrowse does not enforce a format.

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
