---
title: Assemblies
description:
  Setting up reference genomes with sequence adapters and refname aliases
guide_category: Core configuration
---

**TL;DR:** at its flattest an assembly is just
`{ "name": "hg38", "uri": "hg38.fa.gz" }`. JBrowse infers the adapter from the
file extension and fills in the rest. See the
[BaseAssembly config docs](/docs/config/baseassembly/) for the full slot
reference.

## Shorthand and full forms

JBrowse infers the sequence adapter from the extension, derives the
`.fai`/`.gzi` siblings, and fills in the `ReferenceSequenceTrack`.
`refNameAliases` and `cytobands` take the same `{ "uri": "..." }` object, so a
relative uri resolves against the config's own location:

```json addassembly
{
  "name": "hg38",
  "uri": "hg38.fa.gz",
  "refNameAliases": { "uri": "hg38.aliases.txt" },
  "cytobands": { "uri": "hg38.cytoBand.txt" }
}
```

The full form spells out what the shorthand fills in. Write `sequence.adapter`
to name the adapter or set a slot on it; `sequence.type` and `sequence.trackId`
can still be omitted:

```json
{
  "name": "hg38",
  "aliases": ["GRCh38"],
  "sequence": {
    "type": "ReferenceSequenceTrack",
    "trackId": "hg38_config",
    "adapter": {
      "type": "BgzipFastaAdapter",
      "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz"
    }
  },
  "refNameAliases": {
    "adapter": {
      "type": "RefNameAliasAdapter",
      "location": {
        "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"
      }
    }
  }
}
```

Every other field is on the
[BaseAssembly config docs](/docs/config/baseassembly/):
[`displayName`](/docs/config/baseassembly/#slot-displayname),
[`refNameColors`](/docs/config/baseassembly/#slot-refnamecolors) (a list of CSS
colors cycled across the reference sequences in the whole-genome ideogram), and
the ones below that need more than a slot description.

## Configuring reference name aliasing

A track that loads without error but stays empty is usually a reference name
mismatch: the file calls its chromosomes `chr1` or `NC_000001.11` where the
assembly says `1`, and JBrowse matches by exact name. `refNameAliases` points at
a tab-separated file, one row per sequence, primary name first. UCSC
[chromAlias files](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chromAlias.txt)
are that format; an NCBI `sequence_report.tsv` goes through
`NcbiSequenceReportAliasAdapter`. [](/docs/developer_guides/refname_aliasing)
has the adapters and how to see, in the reference track's About dialog, which
names resolved.

## Configuring alternative genetic codes (translation tables)

JBrowse translates with the standard genetic code (NCBI table 1) unless told
otherwise. Vertebrate mitochondria use table 2, plastids and bacteria often
table 11 (the full list is on the
[NCBI genetic codes page](https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi)).

- **CDS features** read the code off the GFF's `transl_table` attribute, with no
  assembly config ([gene track](/docs/user_guides/gene_track)).
- **The reference track's six-frame translation** has no CDS to read, so it uses
  the assembly's [`geneticCodes`](/docs/config/baseassembly/#slot-geneticcodes)
  map, keyed by refName:

```json addassembly
{
  "name": "hg38",
  "sequence": { "adapter": { "uri": "hg38.fa.gz" } },
  "geneticCodes": { "chrM": 2 }
}
```

Keys match through refname aliasing, so `chrM` applies when the FASTA says `MT`.
A sidecar TSV
([`geneticCodesLocation`](/docs/config/baseassembly/#slot-geneticcodeslocation),
`refName<TAB>geneticCodeId`) supplies the same map; the inline entry wins if
both are present.

## Sequence adapters

[Sequence file types](/docs/config_guides/file_types#sequence--assembly) maps
each format to its adapter; all take the
[`uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand). Preparing a
FASTA:

```bash
bgzip -i sequence.fa           # -> sequence.fa.gz + sequence.fa.gz.gzi
samtools faidx sequence.fa.gz  # -> sequence.fa.gz.fai
```

- **`TwoBitAdapter`** parses upfront; a `chromSizes` file speeds up a 2bit with
  many chromosomes (UCSC `faToTwoBit` makes the file).
- **`ChromSizesAdapter`** has names and lengths but no sequence, enough to
  anchor a karyotype, synteny or whole-genome view without a FASTA.
- **[`metadataLocation`](/docs/config/bgzipfastaadapter/#slot-metadatalocation)**
  attaches free-form metadata to a FASTA;
  [FFRGS](https://github.com/FFRGS/FFRGS-Specification) is one convention, and
  JBrowse enforces no format.

## Configuring cytoband ideograms

`cytobands` supplies banding data for the views that draw ideograms, read by a
`CytobandAdapter` from a UCSC-style `cytoBand.txt`, as the first example above
writes it.

## See also

- [](/docs/user_guides/sequence_track)
- [](/docs/user_guides/basic_usage)
- [BaseAssembly config docs](/docs/config/baseassembly/)
