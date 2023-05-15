---
id: assemblies
title: Configuring assemblies
---

An assembly configuration includes the "name" of your assembly, any "aliases"
that might be associated with that assembly e.g. GRCh37 is sometimes seen as an
alias for hg19, and then a "sequence" configuration containing a reference
sequence track config. This is provides a special "track" that is outside the
normal track config.

Here is a complete config.json file containing only an hg19 assembly:

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

### Configuring reference name aliasing

Reference name aliasing is a process to make chromosomes that are named slightly
differently but which refer to the same thing render properly.

The refNameAliases in the above config provides this functionality:

```json
"refNameAliases": {
  "adapter": {
    "type": "RefNameAliasAdapter",
    "location": {
      "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt",
      "locationType": "UriLocation"
    }
  }
}
```

The hg19_aliases then is a tab delimited file that looks like the following; the
first column should be the names that are in your FASTA sequence, and the rest
of the columns are aliases:

```
1	chr1
2	chr2
3	chr3
4	chr4
5	chr5
6	chr6
7	chr7
8	chr8
9	chr9
10	chr10
11	chr11
12	chr12
13	chr13
14	chr14
15	chr15
16	chr16
17	chr17
18	chr18
19	chr19
20	chr20
21	chr21
22	chr22
X	chrX
Y	chrY
M	chrM	MT
```

:::note

"chromAliases" files
[from UCSC](https://hgdownload.soe.ucsc.edu/goldenPath/canFam6/bigZips/canFam6.chromAlias.txt)
match this format.

:::

### Adding an assembly with the CLI

Generally we add a new assembly with the CLI using something like:

```bash
# use samtools to make a fasta index for your reference genome
samtools faidx myfile.fa

# install the jbrowse CLI
npm install -g @jbrowse/cli

# add the assembly using the jbrowse CLI, this will automatically copy the
myfile.fa and myfile.fa.fai to your data folder at /var/www/html/jbrowse2
jbrowse add-assembly myfile.fa --load copy --out /var/www/html/jbrowse2
```

See our
[configure JBrowse using the cli](/docs/quickstart_web/#adding-a-genome-assembly-in-fasta-format)
tutorial for more in-depth instructions, or more information on the
`add-assembly` command through our
[CLI tools guide](/docs/cli/#jbrowse-add-assembly-sequence).

:::note

Assemblies can also be added graphically using the assembly manager when you are
using the `admin-server`. See how to
[configure JBrowse using the GUI](/docs/tutorials/config_gui/#adding-a-genome-assembly)
for more details.

:::

Because JBrowse 2 can potentially have multiple assemblies loaded at once, it
needs to make sure each track is associated with an assembly.

To do this, we make assemblies a special part of the config, and make sure each
track refers to which genome assembly it uses.

### Example config with hg19 genome assembly loaded

Here is a complete config.json that has the hg19 genome loaded:

```json
{
  "assemblies": [
    {
      "name": "hg19",
      "aliases": ["GRCh37"],
      "sequence": {
        "type": "ReferenceSequenceTrack",
        "trackId": "refseq_track",
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

The top level config is an array of assemblies; each assembly contains:

- `name` - a name to refer to the assembly by. each track that is related to
  this assembly references this name
- `aliases` - sometimes genome assemblies have aliases like hg19, GRCh37, b37p5,
  etc. while there may be small differences between these different sequences,
  they often largely have the same coordinates, so you might want to be able to
  associate tracks from these different assemblies together. The assembly
  aliases are most helpful when loading from a UCSC trackHub which specifies the
  genome assembly names it uses, so you can connect to a UCSC trackHub if your
  assembly name or aliases match.
- `sequence` - this is a complete "track" definition for your genome assembly.
  we specify that it is a track of type ReferenceSequenceTrack, give it a
  trackId, and an adapter configuration. an adapter configuration can specify
  IndexedFastaAdapter (fasta.fa and fasta.fai), BgzipFastaAdapter (fasta.fa.gz,
  fasta.fa.gz.fai, fasta.gz.gzi), ChromSizesAdapter (which fetches no sequences,
  just chromosome names)

### ReferenceSequenceTrack

Example ReferenceSequenceTrack config, which as above, is specified as the child
of the assembly section of the config:

```json
{
  "type": "ReferenceSequenceTrack",
  "trackId": "refseq_track",
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
}
```

### BgzipFastaAdapter

A bgzip FASTA format file is generated by

```bash
bgzip -i sequence.fa
samtools faidx sequence.fa.gz

## above commands generates the following three files
sequence.fa.gz
sequence.fa.gz.gzi
sequence.fa.gz.fai
```

These are loaded into a BgzipFastaAdapter as follows

```json
{
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
```

### IndexedFastaAdapter

An indexed FASTA file is similar to the above, but the sequence is not
compressed

```bash
samtools faidx sequence.fa

## above commands generate the .fa and .fai files
sequence.fa
sequence.fa.fai
```

These are loaded into a IndexedFastaAdapter as follows

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

#### FASTA Header Location

Meta-information on the assembly can be specified by adding the following
section to either the IndexedFastaAdapter or BgzipFastaAdapter configuration.
One option for the contents of this metadata is the FFRGS (Fair Formatted
Reference Genome Standard) header specification for FASTA files can be found
[here](https://github.com/FFRGS/FFRGS-Specification), however, just the raw
plaintext is displayed for this file so the format is not strict.

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
