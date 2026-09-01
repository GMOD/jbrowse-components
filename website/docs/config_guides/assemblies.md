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

## Shorthand forms

### Flattest: `name` + `uri`

JBrowse infers the adapter from the extension (`.2bit` → `TwoBitAdapter`,
`.fa.gz` → `BgzipFastaAdapter`, `.fa` → `IndexedFastaAdapter`), derives the
`.fai`/`.gzi` siblings, and fills in the `ReferenceSequenceTrack`.
`refNameAliases` and `cytobands` take the same `{ "uri": "..." }` shorthand:

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

`refNameAliases` and `cytobands` take an object with a `uri` key, not a bare
path string, so a relative uri resolves against the config's own location.

### Named adapter: `sequence.adapter`

To name the adapter or set a slot on it, write `sequence.adapter`;
`sequence.type` and `sequence.trackId` can be omitted:

```json addassembly
{
  "name": "hg38",
  "sequence": { "adapter": { "uri": "hg38.fa.gz" } }
}
```

### Full form

Spells out everything the shorthand fills in:

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

Every other field (`displayName`, `refNameColors`, `geneticCodes`, ...) is on
the [BaseAssembly config docs](/docs/config/baseassembly/); the sections below
cover the ones that need more than a slot description.

## Configuring reference name aliasing

A track that turns on without any error but stays empty where you expect data is
usually a reference name mismatch: the file names its chromosomes differently
than the assembly (e.g. `chr1` vs `1`, or `NC_000001.11` vs `chr1`). JBrowse
matches features by exact reference name, so `chr1` data won't show up on a
region the assembly calls `1`.

To check, open the track menu and click "About track" for the reference names
the file actually contains. The other side of the comparison is that same dialog
on the **reference sequence track**: its "Assembly" section lists every name the
assembly knows and the aliases already mapped onto each one, which is where you
see whether an alias file applied.

Aliasing maps chromosomes named differently across files to the same sequence
(e.g. `chr1` ↔ `1`). `refNameAliases` points at a tab-separated file, one row
per sequence, primary name first:

```
1	chr1
2	chr2
M	chrM	MT
```

UCSC
[chromAlias files](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chromAlias.txt)
match this format; for NCBI assemblies, use `NcbiSequenceReportAliasAdapter`
with a `sequence_report.tsv` instead. See
[](/docs/developer_guides/refname_aliasing) for adapter details.

## Configuring alternative genetic codes (translation tables)

JBrowse translates protein-coding sequence with the standard genetic code (NCBI
table 1). Some sequences need another (vertebrate mitochondria use table 2,
plastids/bacteria often use table 11; full list on the
[NCBI genetic codes page](https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi)).

- **CDS features** (gene tracks, the feature-detail protein panel) read the code
  from the GFF's `transl_table` attribute directly; no assembly config needed.
  Start codons and `transl_except` overrides are honored.
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

Unlisted sequences use the standard code; keys are matched through refname
aliasing, so `chrM` still applies if your FASTA calls it `MT`. A sidecar TSV
([`geneticCodesLocation`](/docs/config/baseassembly/#slot-geneticcodeslocation),
`refName<TAB>geneticCodeId`, `#` comment lines allowed) can supply the same map;
an inline entry wins if both are present.

## Loading an assembly without writing the config

`jbrowse add-assembly` generates this entry and copies the data files into place
beside it, which is the part the config itself does not describe. See the
[web quick start](/docs/quickstart_web/) or the
[CLI guide](/docs/cli/#jbrowse-add-assembly). JBrowse Desktop builds the same
entry from a genome's URL and a name, with no config file involved, as the
[desktop quick start](/docs/quickstart_desktop/) shows.

## Sequence adapters

Every adapter takes the
[`uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand), which
resolves sibling index files automatically. Spell out the longhand slots only
when they're named differently.

| Adapter                                | Files                                  | Prepare with            |
| -------------------------------------- | -------------------------------------- | ----------------------- |
| [](/docs/config/bgzipfastaadapter)     | `.fa.gz` + `.fa.gz.fai` + `.fa.gz.gzi` | `bgzip -i` then `faidx` |
| [](/docs/config/indexedfastaadapter)   | `.fa` + `.fa.fai`                      | `samtools faidx`        |
| [](/docs/config/unindexedfastaadapter) | `.fa`                                  | nothing                 |
| [](/docs/config/twobitadapter)         | `.2bit`, optionally `.chrom.sizes`     | UCSC `faToTwoBit`       |
| [](/docs/config/chromsizesadapter)     | `.chrom.sizes`                         | nothing                 |

```bash
bgzip -i sequence.fa           # -> sequence.fa.gz + sequence.fa.gz.gzi
samtools faidx sequence.fa.gz  # -> sequence.fa.gz.fai
```

- `UnindexedFastaAdapter` loads the whole sequence into memory; small genomes
  only.
- `TwoBitAdapter` parses upfront (slower startup); a `chromSizes` file speeds up
  a 2bit with many chromosomes.
- `ChromSizesAdapter` has names/lengths but no sequence; anchors a karyotype,
  synteny, or whole-genome view without loading a FASTA.
- `metadataLocation` attaches free-form metadata to an indexed/bgzipped FASTA.
  [FFRGS](https://github.com/FFRGS/FFRGS-Specification) is one documented
  convention; JBrowse does not enforce a format.

## Configuring cytoband ideograms

`cytobands` supplies chromosome banding data for views that draw ideograms,
fetched via a `CytobandAdapter` pointing at a UCSC-style `cytoBand.txt`:

```json addassembly
{
  "name": "hg38",
  "sequence": { "adapter": { "uri": "hg38.fa.gz" } },
  "cytobands": { "uri": "hg38.cytoBand.txt" }
}
```

## Customizing reference sequence colors

[`refNameColors`](/docs/config/baseassembly/#slot-refnamecolors) cycles a list
of CSS colors across the reference sequences (used in overviews like the
whole-genome ideogram):

```json
{
  "refNameColors": ["red", "green", "blue", "orange", "purple"]
}
```

## See also

- [](/docs/user_guides/sequence_track)
- [](/docs/user_guides/basic_usage)
- [BaseAssembly config docs](/docs/config/baseassembly/)
