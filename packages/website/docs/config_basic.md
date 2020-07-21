---
id: config_basic
title: Intro to the JBrowse 2 configuration
---

### Intro to the config.json

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
    /* array of tracks being loaded, contain reference to which assembl(ies)
    they belong to */
  ],
  "defaultSession": {
    /* optional default session */
  },
  "savedSessions": [
    /* optional saved sessions */
  ]
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
            "uri": "test_data/hg19_aliases.txt"
          }
        }
      }
    }
  ]
}
```

## Adding an assembly with the CLI

See https://github.com/GMOD/jbrowse-components/tree/master/packages/jbrowse-cli#jbrowse-add-assembly-sequence

## Track configurations

All tracks contain

- trackId - internal track ID, must be unique
- name - displayed track name
- assemblyNames - an array of assembly names a track is associated with, often
  just a single assemblyName
- category - optional array of categories to display in a hierarchical track selector

Example config.json containing a track config

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
            "uri": "test_data/hg19_aliases.txt"
          }
        }
      }
    }
  ],
  "tracks": [
    {
      "type": "BasicTrack",
      "trackId": "ncbi_gff_hg19",
      "name": "NCBI RefSeq (GFF3Tabix)",
      "assemblyNames": ["hg19"],
      "category": ["Annotation test", "blah"],
      "adapter": {
        "type": "Gff3TabixAdapter",
        "gffGzLocation": {
          "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/hg19/GRCh37_latest_genomic.sort.gff.gz"
        },
        "index": {
          "location": {
            "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/hg19/GRCh37_latest_genomic.sort.gff.gz.tbi"
          }
        }
      },
      "renderer": {
        "type": "SvgFeatureRenderer"
      }
    }
  ]
}
```
