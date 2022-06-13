---
id: config_guide
title: Config guide
toplevel: true
---

import Figure from './figure'

## Intro to the config.json

A JBrowse 2 configuration file, a config.json, is structured as follows

```json
{
  "configuration": {
    /* global configs here */
  },
  "assemblies": [
    /* list of assembly configurations, e.g. the genomes being viewed */
  ],
  "tracks": [
    /* array of tracks being loaded, contain reference to which assembl(y/ies)
    they belong to */
  ],
  "aggregateTextSearchAdapters": [
    /* optional array of text search adapters */
  ],
  "defaultSession": {
    /* optional default session */
  }
}
```

The most important thing to configure are your assemblies and your tracks

### Configuring assemblies

An assembly configuration includes the "name" of your assembly, any "aliases"
that might be associated with that assembly e.g. GRCh37 is sometimes seen as an
alias for hg19, and then a "sequence" configuration containing a reference
sequence track config. This is provides a special "track" that is outside the
normal track config

Here is a complete config.json file containing only a hg19

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

## Configuring reference name aliasing

Reference name aliasing is a process to make chromosomes that are named slightly
differently but which refer to the same thing render properly

The refNameAliases in the above config provides this functionality

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

The hg19_aliases then is a tab delimited file that looks like this

The first column should be the names that are in your FASTA sequence, and the
rest of the columns are aliases

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

Note that "chromAliases" files from UCSC match this format

https://hgdownload.soe.ucsc.edu/goldenPath/canFam6/bigZips/canFam6.chromAlias.txt

## Adding an assembly with the CLI

Generally we add a new assembly with the CLI using something like

```sh
# use samtools to make a fasta index for your reference genome
samtools faidx myfile.fa

# install the jbrowse CLI
npm install -g @jbrowse/cli

# add the assembly using the jbrowse CLI, this will automatically copy the
myfile.fa and myfile.fa.fai to your data folder at /var/www/html/jbrowse2
jbrowse add-assembly myfile.fa --load copy --out /var/www/html/jbrowse2
```

See our CLI docs for the add-assembly for more details here --
[add-assembly](../cli#jbrowse-add-assembly-sequence)

Note: assemblies can also be added graphically using the assembly manager when
you are using the admin-server. See the [quickstart
guide](../quickstart_gui#adding-an-assembly) for more details.

## Assembly config

Because JBrowse 2 can potentially have multiple assemblies loaded at once, it
needs to make sure each track is associated with an assembly.

To do this, we make assemblies a special part of the config, and make sure each
track refers to which genome assembly it uses

### Example config with hg19 genome assembly loaded

Here is a complete config.json that has the hg19 genome loaded

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

The top level config is an array of assemblies

Each assembly contains

- `name` - a name to refer to the assembly by. each track that is related to
  this assembly references this name
- `aliases` - sometimes genome assemblies have aliases like hg19, GRCh37,
  b37p5, etc. while there may be small differences between these different
  sequences, they often largely have the same coordinates, so you might want to
  be able to associate tracks from these different assemblies together. The
  assembly aliases are most helpful when loading from a UCSC trackHub which
  specifies the genome assembly names it uses, so you can connect to a UCSC
  trackHub if your assembly name or aliases match.
- `sequence` - this is a complete "track" definition for your genome assembly.
  we specify that it is a track of type ReferenceSequenceTrack, give it a
  trackId, and an adapter configuration. an adapter configuration can specify
  IndexedFastaAdapter (fasta.fa and fasta.fai), BgzipFastaAdapter (fasta.fa.gz,
  fasta.fa.gz.fai, fasta.gz.gzi), ChromSizesAdapter (which fetches no
  sequences, just chromosome names)

### ReferenceSequenceTrack

Example ReferenceSequenceTrack config, which as above, is specified as the
child of the assembly section of the config

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

```sh
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

An indexed FASTA file is similar to the above, but the sequence is not compressed

```sh
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

The UCSC twoBit adapter is also supported. Note however that the 2bit format
has a longer startup time than other adapters because there is a larger upfront
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

Optionally you can specify a .chrom.sizes file which will speed up loading the 2bit especially if it has many chromosomes in it

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

## Track configurations

All tracks can contain

- trackId - internal track ID, must be unique
- name - displayed track name
- assemblyNames - an array of assembly names a track is associated with, often
  just a single assemblyName
- category - (optional) array of categories to display in a hierarchical track
  selector

Example config.json containing a track config

```json
{
  "assemblies": [
    {
      "name": "hg19",
      "aliases": ["GRCh37"],
      "sequence": {
        "type": "ReferenceSequenceTrack",
        "trackId": "Pd8Wh30ei9R",
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
      }
    }
  ],
  "tracks": [
    {
      "type": "FeatureTrack",
      "trackId": "repeats_hg19",
      "name": "Repeats",
      "assemblyNames": ["hg19"],
      "category": ["Annotation"],
      "adapter": {
        "type": "BigBedAdapter",
        "bigBedLocation": {
          "uri": "https://jbrowse.org/genomes/hg19/repeats.bb",
          "locationType": "UriLocation"
        }
      }
    }
  ]
}
```

### AlignmentsTrack config

Example AlignmentsTrack config

```json
{
  "trackId": "my_alignments_track",
  "name": "My Alignments",
  "assemblyNames": ["hg19"],
  "type": "AlignmentsTrack",
  "adapter": {
    "type": "BamAdapter",
    "bamLocation": {
      "uri": "http://yourhost/file.bam",
      "locationType": "UriLocation"
    },
    "index": {
      "location": {
        "uri": "http://yourhost/file.bam.bai",
        "locationType": "UriLocation"
      }
    }
  }
}
```

#### BamAdapter configuration options

- bamLocation - a 'file location' for the BAM
- index: a subconfiguration schema containing
  - indexType: options BAI or CSI. default: BAI
  - location: a 'file location' of the index

Example BamAdapter config

```json
{
  "type": "BamAdapter",
  "bamLocation": {
    "uri": "http://yourhost/file.bam",
    "locationType": "UriLocation"
  },
  "index": {
    "location": {
      "uri": "http://yourhost/file.bam.bai",
      "locationType": "UriLocation"
    }
  }
}
```

#### CramAdapter configuration options

- cramLocation - a 'file location' for the CRAM
- craiLocation - a 'file location' for the CRAI

Example CramAdapter config

```json
{
  "type": "CramAdapter",
  "cramLocation": {
    "uri": "http://yourhost/file.cram",
    "locationType": "UriLocation"
  },
  "craiLocation": {
    "uri": "http://yourhost/file.cram.crai",
    "locationType": "UriLocation"
  }
}
```

### HicTrack config

Example Hi-C track config

```json
{
  "type": "HicTrack",
  "trackId": "hic",
  "name": "Hic Track",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "HicAdapter",
    "hicLocation": {
      "uri": "https://s3.amazonaws.com/igv.broadinstitute.org/data/hic/intra_nofrag_30.hic",
      "locationType": "UriLocation"
    }
  }
}
```

#### HicAdapter config

We just simply supply a hicLocation currently for the HicAdapter

```json
{
  "type": "HicAdapter",
  "hicLocation": {
    "uri": "https://s3.amazonaws.com/igv.broadinstitute.org/data/hic/intra_nofrag_30.hic",
    "locationType": "UriLocation"
  }
}
```

#### HicRenderer config

- `baseColor` - the default baseColor of the Hi-C plot is red #f00, you can
  change it to blue so then the shading will be done in blue with #00f
- `color` - this is a color callback that adapts the current Hi-C contact
  feature with the baseColor to generate a shaded block. The default color
  callback function is
  `jexl:baseColor.alpha(Math.min(1,count/(maxScore/20))).hsl().string()` where
  it receives the count for a particular block, the maxScore over the region,
  and the baseColor from the baseColor config

### VariantTrack config

- defaultRendering - options: 'pileup' or 'svg'. default 'svg'
- adapter - a variant type adapter config e.g. a VcfTabixAdapter

Example config

```json
{
  "type": "VariantTrack",
  "trackId": "my track",
  "name": "My Variants",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": {
      "uri": "http://yourhost/file.vcf.gz",
      "locationType": "UriLocation"
    },
    "index": {
      "location": {
        "uri": "http://yourhost/file.vcf.gz.tbi",
        "locationType": "UriLocation"
      }
    }
  }
}
```

#### VcfTabixAdapter configuration options

- vcfGzLocation - a 'file location' for the BigWig
- index: a subconfiguration schema containing
  - indexType: options TBI or CSI. default TBI
  - location: the location of the index

Example VcfTabixAdapter adapter config

```json
{
  "type": "VcfTabixAdapter",
  "vcfGzLocation": {
    "uri": "http://yourhost/file.vcf.gz",
    "locationType": "UriLocation"
  },
  "index": {
    "location": {
      "uri": "http://yourhost/file.vcf.gz.tbi",
      "locationType": "UriLocation"
    }
  }
}
```

### QuantitativeTrack config

Example QuantitativeTrack config

```json
{
  "trackId": "my_wiggle_track",
  "name": "My Wiggle Track",
  "assemblyNames": ["hg19"],
  "type": "QuantitativeTrack",
  "adapter": {
    "type": "BigWig",
    "bigWigLocation": {
      "uri": "http://yourhost/file.bw",
      "locationType": "UriLocation"
    }
  }
}
```

#### General QuantitativeTrack options

- scaleType - options: linear, log, to display the coverage data. default: linear
- adapter - an adapter that returns numeric signal data, e.g. feature.get('score')

#### Autoscale options for QuantitativeTrack

Options for autoscale

- local - min/max values of what is visible on the screen
- global - min/max values in the entire dataset
- localsd - mean value +- N stddevs of what is visible on screen
- globalsd - mean value +/- N stddevs of everything in the dataset

#### Score min/max for QuantitativeTrack

These options overrides the autoscale options and provides a minimum or maximum
value for the autoscale bar

- minScore
- maxScore

#### QuantitativeTrack drawing options

- inverted - draws upside down
- defaultRendering - can be density, xyplot, or line
- summaryScoreMode - options: min, max, whiskers

#### QuantitativeTrack renderer options

- filled - fills in the XYPlot histogram
- bicolorPivot - options: numeric, mean, none. default: numeric
- bicolorPivotValue - number at which the color switches from posColor to
  negColor. default: 0
- color - color or color callback for drawing the values. overrides
  posColor/negColor. default: none
- posColor - color to draw "positive" values. default: red
- negColor - color to draw "negative" values. default: blue
- clipColor - color to draw "clip" indicator. default: red

#### BigWigAdapter options

- bigWigLocation - a 'file location' for the bigwig

Example BigWig adapter config

```json
{
  "type": "BigWig",
  "bigWigLocation": {
    "uri": "http://yourhost/file.bw",
    "locationType": "UriLocation"
  }
}
```

### SyntenyTrack config

Example SyntenyTrack config

```json
{
  "type": "SyntenyTrack",
  "trackId": "dotplot_track",
  "assemblyNames": ["YJM1447", "R64"],
  "name": "dotplot",
  "adapter": {
    "type": "PAFAdapter",
    "pafLocation": {
      "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/yeast/YJM1447_vs_R64.paf"
    },
    "assemblyNames": ["YJM1447", "R64"]
  }
}
```

We can load a SyntenyTrack from PAF with the CLI e.g. with

```sh
jbrowse add-track myfile.paf --type SyntenyTrack --assemblyNames \
    grape,peach --load copy --out /var/www/html/jbrowse2
```

The first assembly is the "target" and the second assembly is the "query"

See the [super quickstart guide](../superquickstart_web) for more recipes on
loading synteny tracks with the CLI.

### PAFAdapter config

The PAF adapter reflects a pairwise alignment, and is outputted by tools like
minimap2. It can be used for SyntenyTracks

```json
{
  "type": "PAFAdapter",
  "pafLocation": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/yeast/YJM1447_vs_R64.paf"
  },
  "assemblyNames": ["YJM1447", "R64"]
}
```

Slots

- pafLocation - the location of the PAF file. The pafLocation can refer to a
  gzipped or unzipped delta file. It will be read into memory entirely as it is
  not an indexed file format.
- assemblyNames - list of assembly names, typically two (first in list is
  target, second is query)
- queryAssembly - alternative to assemblyNames: just the assemblyName of the
  query
- targetAssembly - alternative to assemblyNames: just the assemblyName of the
  query

### DeltaAdapter config

The DeltaAdapter is used to load .delta files from MUMmer/nucmer. It can be
used for SyntenyTracks

```json
{
  "type": "DeltaAdapter",
  "deltaLocation": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/yeast/YJM1447_vs_R64.paf"
  },
  "assemblyNames": ["YJM1447", "R64"]
}
```

Slots

- deltaLocation - the location of the delta file. The deltaLocation can refer to a
  gzipped or unzipped delta file. It will be read into memory entirely as it is
  not an indexed file format.
- assemblyNames - list of assembly names, typically two (first in list is
  target, second is query)
- queryAssembly - alternative to assemblyNames: just the assemblyName of the
  query
- targetAssembly - alternative to assemblyNames: just the assemblyName of the
  query

### ChainAdapter config

The ChainAdapter is used to load .chain files from MUMmer/nucmer. It can be
used for SyntenyTracks

```json
{
  "type": "DeltaAdapter",
  "deltaLocation": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/yeast/YJM1447_vs_R64.paf"
  },
  "assemblyNames": ["YJM1447", "R64"]
}
```

Slots

- chainLocation - the location of the UCSC chain file. The chainLocation can
  refer to a gzipped or unzipped delta file. It will be read into memory
  entirely as it is not an indexed file format.
- assemblyNames - list of assembly names, typically two (first in list is
  target, second is query)
- queryAssembly - alternative to assemblyNames: just the assemblyName of the
  query
- targetAssembly - alternative to assemblyNames: just the assemblyName of the
  query

### MCScanAnchorsAdapter

The .anchors file from MCScan refers to pairs of homologous genes and can be loaded into synteny tracks in jbrowse 2

```json
{
  "type": "MCScanAnchorsAdapter",
  "mcscanAnchorsLocation": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/synteny/grape.peach.anchors.gz"
  },
  "bed1Location": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/synteny/grape_vs_peach/grape.bed.gz"
  },
  "bed2Location": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/synteny/grape_vs_peach/peach.bed.gz"
  },
  "assemblyNames": ["grape", "peach"]
}
```

The guide at https://github.com/tanghaibao/jcvi/wiki/MCscan-(Python-version)
shows a demonstration of how to create the anchors and bed files (the .bed
files are intermediate steps in creating the anchors files and are required by
the MCScanAnchorsAdapter)

Slots

- mcscanAnchorsLocation - the location of the .anchors file from the MCScan
  workflow. The .anchors file has three columns. It can be gzipped or
  ungzipped, and is read into memory whole
- bed1Location - the location of the first assemblies .bed file from the MCScan
  workflow. It can be gzipped or ungzipped, and is read into memory whole. This
  would refer to the gene names on the "left" side of the .anchors file.
- bed2Location - the location of the second assemblies .bed file from the
  MCScan workflow. It can be gzipped or ungzipped, and is read into memory
  whole. This would refer to the gene names on the "right" side of the .anchors
  file.

### MCScanSimpleAnchorsAdapter

The "simple" .anchors.simple file from MCScan refers to pairs of homologous
genes and can be loaded into synteny tracks in jbrowse 2

```json
{
  "type": "MCScanSimpleAnchorsAdapter",
  "mcscanSimpleAnchorsLocation": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/synteny/grape.peach.anchors.simple.gz"
  },
  "bed1Location": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/synteny/grape_vs_peach/grape.bed.gz"
  },
  "bed2Location": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/synteny/grape_vs_peach/peach.bed.gz"
  },
  "assemblyNames": ["grape", "peach"]
}
```

The guide at https://github.com/tanghaibao/jcvi/wiki/MCscan-(Python-version)
shows a demonstration of how to create the anchors and bed files (the .bed
files are intermediate steps in creating the anchors.simple files and are
required by the MCScanSimpleAnchorsAdapter)

Slots

- `mcscanSimpleAnchorsLocation` - the location of the .anchors.simple file from
  the MCScan workflow (this file has 5 columns, start and end gene from bed1,
  start and end genes from bed2, and score). It can be gzipped or ungzipped,
  and is read into memory whole
- `bed1Location` - the location of the first assemblies .bed file from the MCScan
  workflow. It can be gzipped or ungzipped, and is read into memory whole. This
  would refer to the gene names on the "left" side of the .anchors file.
- `bed2Location` - the location of the second assemblies .bed file from the
  MCScan workflow. It can be gzipped or ungzipped, and is read into memory
  whole. This would refer to the gene names on the "right" side of the .anchors
  file.

### Advanced adapters

There are two useful adapter types that can be used for more advanced use
cases, such as generating configuration for data returned by an API. These are
the `FromConfigAdapter` and `FromConfigSequenceAdapter`. They can be used as the
`adapter` value for any track type.

#### FromConfigAdapter

This adapter can be used to generate features directly from values stored in
the configuration.

Example `FromConfigAdapter`

```json
{
  "type": "FromConfigAdapter",
  "features": [
    {
      "refName": "ctgA",
      "uniqueId": "alias1",
      "aliases": ["A", "contigA"]
    },
    {
      "refName": "ctgB",
      "uniqueId": "alias2",
      "aliases": ["B", "contigB"]
    }
  ]
}
```

#### FromConfigSequenceAdapter

Similar behavior to `FromConfigAdapter`, with a specific emphasis on performance
when the features are sequences.

Example `FromConfigSequenceAdapter`

```json
{
  "type": "FromConfigSequenceAdapter",
  "features": [
    {
      "refName": "SEQUENCE_1",
      "uniqueId": "firstId",
      "start": 0,
      "end": 33,
      "seq": "CCAAGATCTAAGATGTCAACACCTATCTGCTCA"
    },
    {
      "refName": "SEQUENCE_2",
      "uniqueId": "secondId",
      "start": 0,
      "end": 44,
      "seq": "CCGAACCACAGGCCTATGTTACCATTGGAAAGCTCACCTTCCCG"
    }
  ]
}
```

## Text searching

Text searching is now available on JBrowse 2.

Text searching appears in two forms: per-track indexes and aggregate indexes
which search across multiple tracks

Aggregate indexes may look like this

```json
{
"aggregateTextSearchAdapters": [
    {
      "type": "TrixTextSearchAdapter",
      "textSearchAdapterId": "hg19-index",
      "ixFilePath": {
        "uri": "https://jbrowse.org/genomes/hg19/trix/hg19.ix",
        "locationType": "UriLocation"
      },
      "ixxFilePath": {
        "uri": "https://jbrowse.org/genomes/hg19/trix/hg19.ixx",
        "locationType": "UriLocation"
      },
      "metaFilePath": {
        "uri": "https://jbrowse.org/genomes/hg19/trix/meta.json",
        "locationType": "UriLocation"
      },
      "assemblyNames": ["hg19"]
    }
}
```

An example per-track config may look like this

```json
{
  "trackId":"yourtrack",
  "name":"Track name",
  "adapter":{
    "type": "Gff3TabixAdapter",
    "gffGzLocation": { "uri":"yourfile.gff.gz",
        "locationType": "UriLocation" }
    "index":{ "location": { "uri":"yourfile.gff.gz.tbi",
        "locationType": "UriLocation" } }
  },
  "textSearching": {
    "textSearchAdapter": {
      "type": "TrixTextSearchAdapter",
      "textSearchAdapterId": "hg19-index",
      "ixFilePath": {
        "uri": "https://jbrowse.org/genomes/hg19/trix/hg19.ix",
        "locationType": "UriLocation"
      },
      "ixxFilePath": {
        "uri": "https://jbrowse.org/genomes/hg19/trix/hg19.ixx",
        "locationType": "UriLocation"
      },
      "metaFilePath": {
        "uri": "https://jbrowse.org/genomes/hg19/trix/meta.json",
        "locationType": "UriLocation"
      },
      "assemblyNames": ["hg19"]
    },
    "indexingAttributes": ["Name","ID"],
    "indexingFeatureTypesToExclude": ["CDS","exon"]
  }
}
```

Information on generating trix indexes via the cli can be found
[here](../cli#jbrowse-text-index)

### TrixTextSearchAdapter config

The trix search index is the current file format for name searching

It is based on the UCSC trix file format described here
https://genome.ucsc.edu/goldenPath/help/trix.html

To create trix indexes you can use our command line tools. More info found at
our [jbrowse text-index guide](../cli#jbrowse-text-index). This tool will
automatically generate a config like this. The config slots are described below
for details

```json
{
  "textSearchAdapter": {
    "type": "TrixTextSearchAdapter",
    "textSearchAdapterId": "gff3tabix_genes-index",
    "ixFilePath": {
      "uri": "trix/gff3tabix_genes.ix",
      "locationType": "UriLocation"
    },
    "ixxFilePath": {
      "uri": "trix/gff3tabix_genes.ixx",
      "locationType": "UriLocation"
    },
    "metaFilePath": {
      "uri": "trix/gff3tabix_genes_meta.json",
      "locationType": "UriLocation"
    }
  }
}
```

- ixFilePath - the location of the trix ix file
- ixxFilePath - the location of the trix ixx file
- metaFilePath - the location of the metadata json file for the trix index

### JBrowse1TextSearchAdapter config

This is more uncommon, but allows back compatibility with a jbrowse 1 names
index created by generate-names.pl

```json
{
  "textSearchAdapter": {
    "type": "JBrowse1TextSearchAdapter",
    "textSearchAdapterId": "generate-names-index",
    "namesIndexLocation": {
      "uri": "/names",
      "locationType": "UriLocation"
    }
  }
}
```

- namesIndexLocation - the location of the JBrowse1 names index data directory

## DotplotView config

It is recommended to use the DotplotView's importform or a session spec to
initialize a dotplot view.

## LinearSyntenyView config

It is recommended to use the LinearSyntenyView's importform or a session spec
to initialize a dotplot view.

## Configuring the theme

### Color

The color scheme as well as some sizing options can be configured via the theme.
This is done via a top-level configuration in the config file. For example:

```json
{
  "configuration": {
    "theme": {
      "palette": {
        "primary": {
          "main": "#4400a6"
        }
      }
    }
  }
}
```

JBrowse uses 4 colors that can be changed. For example, this is the default
theme:

<Figure src="/img/default_theme.png" caption="Example screenshot showing the default theme"/>

<Figure src="/img/customized_theme.png" caption="Example screenshot showing the customized theme"/>

The customized theme screenshot uses the below configuration

|            | Color code | Color       |
| ---------- | ---------- | ----------- |
| Primary    | #311b92    | Deep purple |
| Secondary  | #0097a7    | Cyan        |
| Tertiary   | #f57c00    | Orange      |
| Quaternary | #d50000    | Red         |

```json
{
  "configuration": {
    "theme" :{
      "palette": {
        "primary": {
          "main": "#311b92"
        },
        "secondary": {
          "main": "#0097a7"
        },
        "tertiary": {
          "main": "#f57c00"
        },
        "quaternary": {
          "main": "#d50000"
        }
      }
    }
  }
```

### Logo

It is also possible to supply a custom logo to be displayed in the top right
corner of the app instead of the JBrowse 2 logo. To do this, store a SVG file
containing your logo on your server, and specify the path in your configuration:

```json
{
  "configuration": {
    "logoPath": {
      "uri": "path/to/my/custom-logo.svg"
    }
  }
}
```

The dimensions of the logo should be `150x48px`.

### Sizing

You can also change some sizing options by specifying the "typography" (to
change font size) and "spacing" (to change the amount of space between elements)
options:

```json
{
  "theme": {
    "typography": { "fontSize": 10 },
    "spacing": 2
  }
}
```

### Advanced

JBrowse uses Material-UI for its theming. You can read more about Material-UI
themes [here](https://material-ui.com/customization/theming/). Generally, most
options you could pass to Material-UI's
[`createMuiTheme`](https://material-ui.com/customization/theming/#createmuitheme-options-args-theme)
should work in the theme configuration.

## Disabling analytics

This is done via adding a field in the global configuration in the config file.
For example:

```json
{
  "configuration": {
    "disableAnalytics": true
  }
}
```

### Configuration callbacks

We use Jexl (see https://github.com/TomFrost/Jexl) for defining configuration
callbacks.

An example of a Jexl configuration callback might look like this

    "color": "jexl:get(feature,'strand')==-1?'red':'blue'"

The notation get(feature,'strand') is the same as feature.get('strand') in
javascript code.

We have a number of other functions such as

Feature operations - get

```

jexl:get(feature,'start') // start coordinate, 0-based half open
jexl:get(feature,'end') // end coordinate, 0-based half open
jexl:get(feature,'refName') // chromosome or reference sequence name
jexl:get(feature,'CIGAR') // BAM or CRAM feature CIGAR string
jexl:get(feature,'seq') // BAM or CRAM feature sequence
jexl:get(feature,'type') // feature type e.g. mRNA or gene

```

Feature operations - getTag

The getTag function smooths over slight differences in BAM and CRAM features to access their tags

```
jexl:getTag(feature, 'MD') // fetches MD string from BAM or CRAM feature
jexl:getTag(feature, 'HP') // fetches haplotype tag from BAM or CRAM feature

```

String functions

```
jexl:charAt('abc',2) // c
jexl:charCodeAt(' ',0) // 32
jexl:codePointAt(' ',0) // 32
jexl:startsWith('kittycat','kit') // true
jexl:endsWith('kittycat','cat') // true
jexl:padStart('cat', 8, 'kitty') // kittycat
jexl:padEnd('kitty', 8, 'cat') // kittycat
jexl:replace('kittycat','cat','') // kitty
jexl:replaceAll('kittycatcat','cat','') // kitty
jexl:slice('kittycat',5) // cat
jexl:substring('kittycat',0,5) // kitty
jexl:trim('  kitty ') // kitty, whitespace trimmed
jexl:trimStart('  kitty ') // kitty, starting whitespace trimmed
jexl:trimEnd('  kitty ') // kitty, ending whitespace trimmed
jexl:toUpperCase('kitty') // KITTY
jexl:toLowerCase('KITTY') // kitty
jexl:split('KITTY KITTY', ' ') // ['KITTY', 'KITTY']
```

Math functions

```

jexl:max(0,2)
jexl:min(0,2)
jexl:sqrt(4)
jexl:ceil(0.5)
jexl:floor(0.5)
jexl:round(0.5)
jexl:abs(-0.5)
jexl:log10(50000)
jexl:parseInt('2')
jexl:parseFloat('2.054')

```

Console logging

```

jexl:log(feature) // console.logs output and returns value
jexl:cast({'mRNA':'green','pseudogene':'purple'})[get(feature,'type')] // returns either green or purple depending on feature type

```

Binary operators

```
jexl:get(feature,'flags')&2 // bitwise and to check if BAM or CRAM feature flags has 2 set
```

## Customizing feature details panels

Every track has a configuration called `formatDetails`

Here is an example track with a formatter

```json
{
  "type": "FeatureTrack",
  "trackId": "genes",
  "assemblyNames": ["hg19"],
  "name": "Genes",
  "formatDetails": {
    "feature": "jexl:{name:'<a href=https://google.com/?q='+feature.name+'>'+feature.name+'</a>',newfield:'Custom contents here: '+feature.name,type:undefined }"
  },
  "adapter": {
    "type": "Gff3TabixAdapter",
    "gffGzLocation": {
      "uri": "volvox.sort.gff3.gz"
    },
    "index": {
      "location": {
        "uri": "volvox.sort.gff3.gz.tbi"
      }
    }
  }
}
```

This feature formatter changes the `"name"` field in the feature detail panel
to have a link to a google search for that feature's name. This can be used to
link to gene pages for example as well.

In addition, this example also adds a custom field called `"newfield"` and
removes e.g. `"type"` from being displayed.

The schema for `formatDetails` is

- `feature` - customizes the top-level feature
- `subfeatures` - customizes the subfeatures, recursively up to `depth`
- `depth` - depth to customize the subfeatures to, default 1

The general way this is done is by making a jexl callback either or both of
`feature` and `subfeatures` (if you want both feature and subfeatures, you can copy the same thing to both config slots).

The callback returns an object where the keys of the object are what you want to replace

In the example above we return an object with:

- `name` - customizes the name field with a link in the feature details
- `type` - we make this undefined, which removes it from the feature details
- `newfield` - this generates a new field in the feature details

### Making sophisticated customizations to feature detail panels

If your feature detail panel customization is complex, you can create a custom javascript function in a plugin that is registered with the jexl system e.g.

```js
class MyPlugin {
  install() {}
  configure(pluginManager: PluginManager) {
    pluginManager.jexl.addFunction('formatName', feature => {
      return `<a href="${feature.name}">${feature.name}</a>`
    })
  }
}
```

Then you can use the custom jexl function in your config callbacks as follows:

```json
{
  "type": "FeatureTrack",
  "trackId": "genes",
  "assemblyNames": ["hg19"],
  "name": "Genes",
  "formatDetails": {
    "feature": "jexl:{name:formatName(feature)}"
  },
   ...
}
```
