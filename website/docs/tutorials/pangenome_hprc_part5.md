---
title: Pangenome (HPRC) part 4, repeat lengths across haplotypes
sidebar_label: Pangenome (HPRC 4, repeat lengths)
description:
  Measure the ABCA7 intronic VNTR in every HPRC haplotype straight from the
  graph, set TRGT's read-based genotypes on the same bars, and find the samples
  where reads lost an allele the assemblies kept
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: HPRC release 2
---

An intron of _ABCA7_ holds a variable number tandem repeat tied to Alzheimer's
disease risk (De Roeck et al. 2018). We draw it once per haplotype from HPRC
release 2's graph. We:

- set PacBio's TRGT genotypes, called from HiFi reads of the same samples, on
  the same bars
- find the samples where the assemblies and the reads disagree

[Part 3](/docs/tutorials/pangenome_hprc_part3) reads the same database as one
lane per haplotype.

:::caution Experimental

The graph view is a beta plugin, and walk rows is its newest layout. We welcome
your [feedback](/contact).

:::

## Prerequisites

- the GraphGenomeView plugin, which the hosted HPRC config the sessions below
  open already loads;
  [hosting your own graph](/docs/tutorials/pangenome_prepare_graph#the-graphgenomeview-plugin)
  loads it into your own JBrowse

## Where the data comes from

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710) and PacBio's TRGT
genotypes of 100 of its samples (Dolzhenko et al. 2024):

- the release 2.1 gbz-base database, read by range request:
  https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/v2.1/hprc-v2.1-mc-grch38/hprc-v2.1-mc-grch38.gbz.db
- TRGT's genotypes over the Genome in a Bottle repeat catalogue, a TRGTdb:
  https://zenodo.org/records/8329210/files/adotto_hprc.tdb.tar
- the catalogue itself:
  https://zenodo.org/records/8329210/files/adotto_repeats.hg38.bed.gz
- the _ABCA7_ record of those genotypes, as a TRGT VCF:
  https://jbrowse.org/demos/hprc/hprc_abca7_trgt.vcf.gz

## Every haplotype's walk through the repeat

Open the session below: the genes, the catalogue's VNTR row and PacBio's TRGT
genotypes, over the graph cut from the gbz-base database in **Walk rows** layout
with **Uniform** color:

```json session config=https://jbrowse.org/demos/hprc/config.json
{
  "defaultSession": {
    "name": "ABCA7 VNTR, walk rows",
    "sessionTracks": [
      {
        "type": "FeatureTrack",
        "trackId": "abca7_vntr",
        "name": "Tandem repeat catalogue (adotto)",
        "assemblyNames": ["hg38"],
        "adapter": {
          "type": "FromConfigAdapter",
          "features": [
            {
              "uniqueId": "abca7_vntr",
              "refName": "chr19",
              "start": 1049407,
              "end": 1050096,
              "name": "ABCA7 VNTR"
            }
          ]
        }
      }
    ],
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr19:1,049,000-1,050,500",
        "tracks": [
          {
            "trackId": "hg38_ncbiRefSeq_ucsc",
            "type": "LinearBasicDisplay",
            "showOnlyGenes": true,
            "displayMode": "compact",
            "height": 40
          },
          {
            "trackId": "abca7_vntr",
            "type": "LinearBasicDisplay",
            "height": 40
          },
          {
            "trackId": "hprc_abca7_trgt",
            "type": "LinearVariantDisplay",
            "height": 40
          }
        ]
      },
      {
        "type": "GraphGenomeView",
        "loadedTrackId": "hprc_v2_1_gbz_lanes",
        "loadedRegion": {
          "refName": "chr19",
          "assemblyName": "hg38",
          "start": 1049407,
          "end": 1050096
        },
        "layoutMode": "walkrows",
        "colorScheme": "uniform",
        "paneHeight": 600
      }
    ]
  }
}
```

Each row is one haplotype's walk between the flanking reference nodes, blue
where it matches GRCh38 and purple where it does not; GRCh38's own walk is the
short bar at the top.

## TRGT's calls on the same bars

[TRGT](https://github.com/PacificBiosciences/trgt) genotypes tandem repeats from
HiFi reads. We host its _ABCA7_ call for 100 HPRC samples as this track:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hprc_abca7_trgt",
  "name": "TRGT repeat genotypes at ABCA7, 100 HPRC samples",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc_abca7_trgt.vcf.gz"
  }
}
```

TRGT writes the same fields for your own samples, one VCF each, joined by
`trgt merge`:

```bash
# one run per sample: HiFi reads aligned to GRCh38, and the repeat catalogue
trgt genotype --genome GRCh38.fa --reads sample.bam \
  --repeats adotto_repeats.hg38.bed --output-prefix sample
# one multi-sample VCF, which the steps below read unchanged
trgt merge --vcf *.vcf.gz --genome GRCh38.fa --output-type z --output merged.vcf.gz
```

With the TRGT track in the session, a **Repeat** dropdown appears beside
**Walk**. Pick the _ABCA7_ record: the bars divide into motif-length units, each
walk gets a black tick at the allele TRGT called for it (paired by length), and
a readout turns red past 10% apart.

<Figure caption="The ABCA7 VNTR in walk rows, one bar per HPRC haplotype, longest first, with the TRGT record picked in the Repeat dropdown, boxed. The catalogue lane marks the VNTR on GRCh38, whose walk is the short blue bar at the top. Each bar is tiled by the motif, and a black tick marks the allele TRGT called for that walk. A red readout is a walk far from its allele." src="/img/pangenome/hprc_abca7_repeat_units.png" />

## The samples where they disagree

The session below shows seven samples' walks in pairs, longest first, named in
`walkRowSamples`:

```json session config=https://jbrowse.org/demos/hprc/config.json
{
  "defaultSession": {
    "name": "ABCA7 VNTR, where reads and assemblies disagree",
    "sessionTracks": [
      {
        "type": "FeatureTrack",
        "trackId": "abca7_vntr",
        "name": "Tandem repeat catalogue (adotto)",
        "assemblyNames": ["hg38"],
        "adapter": {
          "type": "FromConfigAdapter",
          "features": [
            {
              "uniqueId": "abca7_vntr",
              "refName": "chr19",
              "start": 1049407,
              "end": 1050096,
              "name": "ABCA7 VNTR"
            }
          ]
        }
      }
    ],
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr19:1,049,000-1,050,500",
        "tracks": [
          {
            "trackId": "abca7_vntr",
            "type": "LinearBasicDisplay",
            "height": 40
          },
          {
            "trackId": "hprc_abca7_trgt",
            "type": "LinearVariantDisplay",
            "height": 40
          }
        ]
      },
      {
        "type": "GraphGenomeView",
        "loadedTrackId": "hprc_v2_1_gbz_lanes",
        "loadedRegion": {
          "refName": "chr19",
          "assemblyName": "hg38",
          "start": 1049407,
          "end": 1050096
        },
        "layoutMode": "walkrows",
        "colorScheme": "uniform",
        "repeatTrackId": "hprc_abca7_trgt",
        "repeatKey": "chr19:1049406-1050096",
        "walkRowSamples": [
          "HG00099",
          "HG03688",
          "HG00741",
          "HG02647",
          "HG01943",
          "HG02559",
          "HG04199"
        ],
        "paneHeight": 360
      }
    ]
  }
}
```

HG00099, HG03688 and HG00741 tick at the end of each bar: reads and assemblies
agree. HG02647 and HG01943 turn red: TRGT calls each near-homozygous while the
graph carries a haplotype neither call reaches (two, in HG01943). HG02559 and
HG04199 carry a grey tick: no read spans HG02559's second allele, and HG04199's
assembly does not span the repeat, so neither walk gets a verdict.

<Figure caption="Seven samples' walks through the ABCA7 VNTR in pairs, each bar carrying the allele TRGT called for it as a tick. A tick at the end of its bar is agreement, a red readout is a walk far from its allele, and a grey tick is an allele no read spanned." src="/img/pangenome/hprc_abca7_disagreements.png" />

## Check it against TRGT's genotypes

Click the TRGT record: its sample table gives `AL`, the allele lengths behind
each tick, and `SD`, the reads spanning each allele. HG02559's second allele has
none, which is why its tick is grey.

## Reproduce it end to end

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_abca7_trgt.sh
bash build_hprc_abca7_trgt.sh       # writes ./hprc_abca7_trgt_build/
```

The TRGTdb is a directory of Parquet tables, and DuckDB reads a locus's calls
straight out of it:

<!-- from: scripts/build_hprc_abca7_trgt.sh -->

```bash
# every sample's allele numbers and spanning-read counts at one locus
duckdb -json -c "
  select regexp_extract(filename, 'sample\.(.*)\.pq', 1) as sample,
    allele_number, spanning_reads
  from read_parquet('hprc_100.tdb/sample.*.pq', filename = true)
  where LocusID = (select LocusID from read_parquet('hprc_100.tdb/locus.pq')
    where chrom = 'chr19' and start = 1049407)"
```

[`build_hprc_abca7_trgt.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_abca7_trgt.sh)
downloads PacBio's TRGT database and the repeat catalogue, and writes the
_ABCA7_ record with every sample's genotype.

## See also

- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_hprc_part3)

## References

- De Roeck A, Duchateau L, Van Dongen J, et al. An intronic VNTR affects
  splicing of ABCA7 and increases risk of Alzheimer's disease. Acta Neuropathol.
  2018;135(6):827-837. https://doi.org/10.1007/s00401-018-1841-z
- Dolzhenko E, English A, Dashnow H, et al. Characterization and visualization
  of tandem repeats at genome scale. Nat Biotechnol. 2024;42(10):1606-1614.
  https://doi.org/10.1038/s41587-023-02057-3
- TRGT repeat catalogues and HPRC genotypes, Zenodo.
  https://doi.org/10.5281/zenodo.8329210
- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710)
