---
id: config_guide
title: Config guide
toplevel: true
---

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
            "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz"
          },
          "faiLocation": {
            "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.fai"
          },
          "gziLocation": {
            "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.gzi"
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
            "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt"
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
      "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt"
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
[add-assembly](cli#jbrowse-add-assembly-sequence)

Note: assemblies can also be added graphically using the assembly manager when
you are using the admin-server. See the [quickstart
guide](quickstart_gui#adding-an-assembly) for more details.

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
            "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz"
          },
          "faiLocation": {
            "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.fai"
          },
          "gziLocation": {
            "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.gzi"
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
            "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt"
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
      "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz"
    },
    "faiLocation": {
      "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.fai"
    },
    "gziLocation": {
      "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.gzi"
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
    "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz"
  },
  "faiLocation": {
    "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.fai"
  },
  "gziLocation": {
    "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.gzi"
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
    "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa"
  },
  "faiLocation": {
    "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.fai"
  }
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
    "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.2bit"
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
            "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz"
          },
          "faiLocation": {
            "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.fai"
          },
          "gziLocation": {
            "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.gzi"
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
          "uri": "https://jbrowse.org/genomes/hg19/repeats.bb"
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
    "bamLocation": { "uri": "http://yourhost/file.bam" },
    "index": { "location": { "uri": "http://yourhost/file.bam.bai" } }
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
  "bamLocation": { "uri": "http://yourhost/file.bam" },
  "index": { "location": { "uri": "http://yourhost/file.bam.bai" } }
}
```

#### CramAdapter configuration options

- cramLocation - a 'file location' for the CRAM
- craiLocation - a 'file location' for the CRAI

Example CramAdapter config

```json
{
  "type": "CramAdapter",
  "cramLocation": { "uri": "http://yourhost/file.cram" },
  "craiLocation": { "uri": "http://yourhost/file.cram.crai" }
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
      "uri": "https://s3.amazonaws.com/igv.broadinstitute.org/data/hic/intra_nofrag_30.hic"
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
    "uri": "https://s3.amazonaws.com/igv.broadinstitute.org/data/hic/intra_nofrag_30.hic"
  }
}
```

#### HicRenderer config

- `baseColor` - the default baseColor of the Hi-C plot is red #f00, you can
  change it to blue so then the shading will be done in blue with #00f
- `color` - this is a color callback that adapts the current Hi-C contact
  feature with the baseColor to generate a shaded block. The default color
  callback function is `jexl:baseColor.alpha(Math.min(1,count/(maxScore/20))).hsl().string()` where it receives the count for a particular block, the maxScore over the region, and the baseColor from the baseColor config

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
    "vcfGzLocation": { "uri": "http://yourhost/file.vcf.gz" },
    "index": { "location": { "uri": "http://yourhost/file.vcf.gz.tbi" } }
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
  "vcfGzLocation": { "uri": "http://yourhost/file.vcf.gz" },
  "index": { "location": { "uri": "http://yourhost/file.vcf.gz.tbi" } }
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
    "bigWigLocation": { "uri": "http://yourhost/file.bw" }
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
  "bigWigLocation": { "uri": "http://yourhost/file.bw" }
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

We can add a SyntenyTrack from PAF with the CLI e.g. with

```sh
jbrowse add-track myfile.paf --type SyntenyTrack --assemblyNames \
    grape,peach --load copy --out /var/www/html/jbrowse2
```

### Advanced adapters

There are two useful adapter types that can be used for more advanced use cases, such as generating configuration for data returned by an API. These are the FromConfigAdapter and FromConfigSequenceAdapter. They can be used as the `adapter` value for any track type.

#### FromConfigAdapter

This adapter can be used to generate features directly from values stored in the configuration.

Example FromConfigAdapter

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

Similar behavior to FromConfigAdapter, with a specific emphasis on performance when the features are sequences.

Example FromConfigSequenceAdapter

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

## DotplotView config

The configuration of a view is technically a configuration of the "state of the
view" but it can be added to the `defaultSession`

An example of a dotplot config can help explain. This is relatively advanced so
let's look at an example

```json
{
  "assemblies": [
    {
      "name": "grape",
      "sequence": {
        "trackId": "grape_seq",
        "type": "ReferenceSequenceTrack",
        "adapter": {
          "type": "ChromSizesAdapter",
          "chromSizesLocation": {
            "uri": "grape.chrom.sizes"
          }
        }
      }
    },
    {
      "name": "peach",
      "sequence": {
        "trackId": "peach_seq",
        "type": "ReferenceSequenceTrack",
        "adapter": {
          "type": "ChromSizesAdapter",
          "chromSizesLocation": {
            "uri": "peach.chrom.sizes"
          }
        }
      }
    }
  ],
  "tracks": [
    {
      "trackId": "grape_peach_synteny_mcscan",
      "type": "SyntenyTrack",
      "assemblyNames": ["peach", "grape"],
      "trackIds": [],
      "renderDelay": 100,
      "adapter": {
        "mcscanAnchorsLocation": {
          "uri": "grape.peach.anchors"
        },
        "subadapters": [
          {
            "type": "NCListAdapter",
            "rootUrlTemplate": {
              "uri": "https://jbrowse.org/genomes/synteny/peach_gene/{refseq}/trackData.json"
            }
          },
          {
            "type": "NCListAdapter",
            "rootUrlTemplate": {
              "uri": "https://jbrowse.org/genomes/synteny/grape_gene/{refseq}/trackData.json"
            }
          }
        ],
        "assemblyNames": ["peach", "grape"],
        "type": "MCScanAnchorsAdapter"
      },
      "name": "Grape peach synteny (MCScan)",
      "category": ["Annotation"]
    },
    {
      "trackId": "grape_peach_paf",
      "type": "SyntenyTrack",
      "name": "Grape vs Peach (PAF)",
      "assemblyNames": ["peach", "grape"],
      "adapter": {
        "type": "PAFAdapter",
        "pafLocation": {
          "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/synteny/peach_grape.paf"
        },
        "assemblyNames": ["peach", "grape"]
      }
    },
    {
      "type": "SyntenyTrack",
      "trackId": "dotplot_track_small",
      "name": "Grape vs peach small (PAF)",
      "assemblyNames": ["grape", "peach"],
      "adapter": {
        "type": "PAFAdapter",
        "pafLocation": {
          "uri": "peach_grape_small.paf"
        },
        "assemblyNames": ["peach", "grape"]
      }
    }
  ],
  "defaultSession": {
    "name": "Grape vs Peach (small)",
    "views": [
      {
        "id": "MiDMyyWpp",
        "type": "DotplotView",
        "assemblyNames": ["peach", "grape"],
        "hview": {
          "displayedRegions": [],
          "bpPerPx": 100000,
          "offsetPx": 0
        },
        "vview": {
          "displayedRegions": [],
          "bpPerPx": 100000,
          "offsetPx": 0
        },
        "tracks": [
          {
            "type": "SyntenyTrack",
            "configuration": "dotplot_track_small",
            "displays": [
              {
                "type": "DotplotDisplay",
                "configuration": "dotplot_track_small-DotplotDisplay"
              }
            ]
          }
        ],
        "displayName": "Grape vs Peach dotplot"
      }
    ]
  }
}
```

Note that configuring the dotplot involves creating a "defaultSession"

Users can also open synteny views using the File->Add->Dotplot view workflow,
and create their own synteny view outside of the default configuration

## LinearSyntenyView config

Currently, configuring synteny is made by pre-configuring a session in the view
and adding synteny tracks

```json
{
  "defaultSession": {
    "name": "Grape vs Peach Demo",
    "drawerWidth": 384,
    "views": [
      {
        "type": "LinearSyntenyView",
        "id": "test1",
        "headerHeight": 44,
        "datasetName": "grape_vs_peach_dataset",
        "tracks": [
          {
            "type": "SyntenyTrack",
            "configuration": "grape_peach_synteny_mcscan",
            "displays": [
              {
                "configuration": "grape_peach_synteny_mcscan-LinearSyntenyDisplay",
                "height": 100,
                "type": "LinearSyntenyDisplay"
              }
            ]
          }
        ],
        "height": 400,
        "displayName": "Grape vs Peach",
        "trackSelectorType": "hierarchical",
        "views": [
          {
            "type": "LinearGenomeView",
            "id": "test1_1",
            "offsetPx": 28249,
            "bpPerPx": 1000,
            "displayedRegions": [
              {
                "refName": "Pp01",
                "assemblyName": "peach",
                "start": 0,
                "end": 100000000
              }
            ],
            "tracks": [
              {
                "type": "FeatureTrack",
                "configuration": "peach_genes",
                "displays": [
                  {
                    "configuration": "peach_genes_linear",
                    "height": 100,
                    "type": "LinearBasicDisplay"
                  }
                ]
              }
            ],
            "hideControls": false,
            "hideHeader": true,
            "hideCloseButton": true,
            "trackSelectorType": "hierarchical"
          },
          {
            "type": "LinearGenomeView",
            "id": "test1_2",
            "offsetPx": 0,
            "bpPerPx": 1000,
            "displayedRegions": [
              {
                "refName": "chr1",
                "assemblyName": "grape",
                "start": 0,
                "end": 100000000
              }
            ],
            "tracks": [
              {
                "type": "FeatureTrack",
                "configuration": "grape_genes",
                "displays": [
                  {
                    "configuration": "grape_genes_linear",
                    "height": 100,
                    "type": "LinearBasicDisplay"
                  }
                ]
              }
            ],
            "hideControls": false,
            "hideHeader": true,
            "hideCloseButton": true,
            "trackSelectorType": "hierarchical"
          }
        ]
      }
    ],
    "widgets": {},
    "activeWidgets": {},
    "connections": {}
  },
  "assemblies": [
    {
      "name": "grape",
      "sequence": {
        "trackId": "grape_seq",
        "type": "ReferenceSequenceTrack",
        "adapter": {
          "type": "ChromSizesAdapter",
          "chromSizesLocation": {
            "uri": "grape.chrom.sizes"
          }
        }
      }
    },
    {
      "name": "peach",
      "sequence": {
        "trackId": "peach_seq",
        "type": "ReferenceSequenceTrack",
        "adapter": {
          "type": "ChromSizesAdapter",
          "chromSizesLocation": {
            "uri": "peach.chrom.sizes"
          }
        }
      }
    }
  ],
  "tracks": [
    {
      "trackId": "grape_peach_synteny_mcscan",
      "type": "SyntenyTrack",
      "assemblyNames": ["peach", "grape"],
      "trackIds": [],
      "renderDelay": 100,
      "adapter": {
        "mcscanAnchorsLocation": {
          "uri": "grape.peach.anchors"
        },
        "subadapters": [
          {
            "type": "NCListAdapter",
            "rootUrlTemplate": {
              "uri": "https://jbrowse.org/genomes/synteny/peach_gene/{refseq}/trackData.json"
            }
          },
          {
            "type": "NCListAdapter",
            "rootUrlTemplate": {
              "uri": "https://jbrowse.org/genomes/synteny/grape_gene/{refseq}/trackData.json"
            }
          }
        ],
        "assemblyNames": ["peach", "grape"],
        "type": "MCScanAnchorsAdapter"
      },
      "name": "Grape peach synteny (MCScan)",
      "category": ["Annotation"]
    },
    {
      "trackId": "peach_genes",
      "type": "FeatureTrack",
      "assemblyNames": ["peach"],
      "name": "mcscan",
      "category": ["Annotation"],
      "adapter": {
        "type": "NCListAdapter",
        "rootUrlTemplate": {
          "uri": "https://jbrowse.org/genomes/synteny/peach_gene/{refseq}/trackData.json"
        }
      },
      "displays": [
        {
          "type": "LinearBasicDisplay",
          "displayId": "peach_genes_linear",
          "renderer": {
            "type": "PileupRenderer"
          }
        }
      ]
    },
    {
      "trackId": "peach_genes2",
      "type": "FeatureTrack",
      "assemblyNames": ["peach"],
      "name": "mcscan2",
      "category": ["Annotation"],
      "adapter": {
        "type": "NCListAdapter",
        "rootUrlTemplate": {
          "uri": "https://jbrowse.org/genomes/synteny/peach_gene/{refseq}/trackData.json"
        }
      }
    },
    {
      "trackId": "grape_genes",
      "type": "FeatureTrack",
      "name": "mcscan",
      "assemblyNames": ["grape"],
      "category": ["Annotation"],
      "adapter": {
        "type": "NCListAdapter",
        "rootUrlTemplate": {
          "uri": "https://jbrowse.org/genomes/synteny/grape_gene/{refseq}/trackData.json"
        }
      },
      "displays": [
        {
          "type": "LinearBasicDisplay",
          "displayId": "grape_genes_linear",
          "renderer": {
            "type": "PileupRenderer"
          }
        }
      ]
    },
    {
      "trackId": "grape_genes2",
      "type": "FeatureTrack",
      "name": "mcscan2",
      "category": ["Annotation"],
      "assemblyNames": ["grape"],
      "adapter": {
        "type": "NCListAdapter",
        "rootUrlTemplate": {
          "uri": "https://jbrowse.org/genomes/synteny/grape_gene/{refseq}/trackData.json"
        }
      }
    }
  ],
  "configuration": {}
}
```

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

<Figure src="/img/default_theme.png" caption="Example screenshot showing the customized theme"/>

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
```

Math functions

```

jexl:min(0,2)
jexl:max(0,2)
jexl:abs(-5)
jexl:ceil(0.5)
jexl:floor(0.5)
jexl:round(0.5)

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
