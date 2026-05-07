---
id: assemblies
title: Configuring assemblies
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
        },
        "rendering": {
          "type": "DivSequenceRenderer"
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

- `name` - a name to refer to the assembly by; each track references this name
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

UCSC [chromAlias files](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chromAlias.txt)
match this format. For NCBI assemblies, use `NcbiSequenceReportAliasAdapter`
with an NCBI `sequence_report.tsv` instead.

See [RefName aliasing](/docs/developer_guides/refname_aliasing) for full details
on adapter options and configuration.

### Adding an assembly with the CLI

Generally we add a new assembly with the CLI using something like:

```bash
# use samtools to make a fasta index for your reference genome
samtools faidx myfile.fa

# install the jbrowse CLI
npm install -g @jbrowse/cli

# add the assembly using the jbrowse CLI, this will automatically copy
# myfile.fa and myfile.fa.fai to your data folder at /var/www/html/jbrowse2
jbrowse add-assembly myfile.fa --load copy --out /var/www/html/jbrowse2
```

See our [configure JBrowse using the cli](/docs/quickstart_web/) tutorial for
more in-depth instructions, or more information on the `add-assembly` command
through our [CLI tools guide](/docs/cli/#jbrowse-add-assembly).

:::note

Assemblies can also be added graphically using the assembly manager when you are
using the `admin-server`. See how to
[configure JBrowse using the admin server GUI](/docs/quickstart_adminserver/)
for more details.

:::

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

A reduced form is also accepted; the `.fai` and `.gzi` index files are inferred
as `yourfile.fa.gz.fai` and `yourfile.fa.gz.gzi`:

```json
{
  "type": "BgzipFastaAdapter",
  "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz"
}
```

### IndexedFastaAdapter

An indexed FASTA file is similar to the above, but the sequence is not
compressed

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

A reduced form is also accepted; the index is inferred as `yourfile.fa.fai`:

```json
{
  "type": "IndexedFastaAdapter",
  "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa"
}
```

#### FASTA Header Location

Meta-information on the assembly can be specified by adding the following
section to either the IndexedFastaAdapter or BgzipFastaAdapter configuration.
One option for the contents of this metadata is the FFRGS (Fair Formatted
Reference Genome Standard) header specification for FASTA files can be found
[here](https://github.com/FFRGS/FFRGS-Specification), however, just the raw
plaintext is displayed for this file, so the format is not strict from JBrowse's
perspective.

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

A reduced form is also accepted, with an optional `chromSizes` shorthand:

```json
{
  "type": "TwoBitAdapter",
  "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.2bit",
  "chromSizes": "https://jbrowse.org/genomes/hg19/fasta/hg19.chrom.sizes"
}
```
