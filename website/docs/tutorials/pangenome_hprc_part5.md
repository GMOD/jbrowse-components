---
title: Pangenome (HPRC) part 5, repeat lengths across haplotypes
sidebar_label: Pangenome (HPRC 5, repeat lengths)
description:
  Measure the ABCA7 intronic VNTR in every HPRC haplotype straight from the
  graph, set TRGT's read-based genotypes on the same bars, and find the samples
  where reads lost an allele the assemblies kept
guide_category: Tutorials
tutorial_category: Pangenomes
tutorial_subcategory: HPRC release 2
---

A tandem repeat can be many times longer in one person than in the reference,
and the long alleles are the ones association studies care about. An intron of
_ABCA7_ holds a variable number tandem repeat whose expansions were tied to
Alzheimer's disease risk (De Roeck et al. 2018). Genotyping it from reads needs
reads that span the whole allele, which gets harder the longer the allele is. We
draw the repeat once per haplotype from the Human Pangenome Reference
Consortium's release 2 graph, where each haplotype is an assembled sequence, set
the TRGT genotypes PacBio called from HiFi reads of the same samples on the same
bars, and look at the samples where the two disagree.
[Part 3](/docs/tutorials/pangenome_hprc_part3#walks-from-the-graph) set up the
graph track this page cuts from.

:::caution Experimental

The graph view is a beta plugin, and walk rows is its newest layout. We welcome
your [feedback](/contact).

:::

## Prerequisites

- [part 3](/docs/tutorials/pangenome_hprc_part3#walks-from-the-graph), for the
  `hprc_v2_1_gbz_lanes` track
- [the GraphGenomeView plugin](/docs/tutorials/pangenome_prepare_graph#the-graphgenomeview-plugin)

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

## The TRGT genotypes

[TRGT](https://github.com/PacificBiosciences/trgt) genotypes tandem repeats from
HiFi reads against a catalogue of repeat loci, and writes a VCF whose `MOTIFS`
field gives each locus its repeat unit and whose `AL` field gives each sample's
two allele lengths. PacBio published TRGT's calls for 100 HPRC samples over the
Genome in a Bottle repeat catalogue. We host the record for the _ABCA7_ locus as
a VCF in TRGT's own format. Add it:

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

Its one record spans `chr19:1,049,408-1,050,096` and names a 51 bp motif. TRGT
writes the same fields for your own samples, one VCF each, which `trgt merge`
joins:

```bash
# one run per sample: HiFi reads aligned to GRCh38, and the repeat catalogue
trgt genotype --genome GRCh38.fa --reads sample.bam \
  --repeats adotto_repeats.hg38.bed --output-prefix sample
# one multi-sample VCF, which the steps below read unchanged
trgt merge --vcf *.vcf.gz --genome GRCh38.fa --output-type z --output merged.vcf.gz
```

## Every haplotype's walk through the repeat

The session below opens _ABCA7_ with the TRGT track and the catalogue's own row
for the VNTR, carried inline as a session track, and under them a graph view cut
from `hprc_v2_1_gbz_lanes` over the same window for every haplotype the graph
holds, drawn in **Walk rows** from the **Layout** dropdown with **Uniform** from
the **Color** dropdown:

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

Each row is one haplotype's walk between the reference nodes flanking the
window, drawn on its own bp axis: blue where GRCh38 carries the same sequence,
purple where it does not. GRCh38's own walk is the short bar at the top, the
span the catalogue lane marks.

## TRGT's calls on the same bars

With the TRGT track in the session, a **Repeat** dropdown appears beside
**Walk**. Pick the _ABCA7_ record. The bars now start and end at the record's
flanks and are divided into motif-length units, and each readout gives its copy
count. The record also carries each sample's genotype, so each walk gets a black
tick at the allele TRGT called for it. A VCF lists a sample's alleles in the
genotype's order, which is the genotyper's own and says nothing about which
assembled haplotype is which, so the walks and the alleles are paired by length.
A readout turns red where its walk and its allele are more than 10% apart.

<Figure caption="The ABCA7 VNTR in walk rows, one bar per HPRC haplotype, longest first, with the TRGT record picked in the Repeat dropdown, boxed. The catalogue lane marks the VNTR on GRCh38, whose walk is the short blue bar at the top. Each bar is tiled by the motif, and a black tick marks the allele TRGT called for that walk. A red readout is a walk far from its allele." src="/img/pangenome/hprc_abca7_repeat_units.png" />

## The samples where they disagree

The rows run longest first, so a sample's two haplotypes land far apart. The
session below keeps the whole cut and shows seven samples' walks in pairs, named
in `walkRowSamples`: three where the calls land on both walks, two where reads
and assemblies part, and two carrying a walk the view declines to score.

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

HG00099, HG03688 and HG00741 carry a tick at the end of each bar. Reads and
assemblies agree on both haplotypes there, across a sample whose two alleles lie
far apart, one whose two are both long, and one whose two are both short.

HG02647 and HG01943 are where reads and assemblies part. TRGT called each of
them close to homozygous, with reads spanning both alleles, and the graph
carries a haplotype neither call reaches (in HG01943 it carries two), so those
readouts turn red.

The last two samples each carry a walk the view leaves unscored, because one
side of that comparison is not a measurement. No read spanned HG02559's second
allele, so TRGT reported the first one twice; the copy lands on the sample's
long walk as a grey tick and says nothing about it. HG04199's second walk is
partial, since that assembly does not span the repeat, and TRGT's long allele
sits far past where the bar stops, so here it is the graph that may be missing
an allele.

<Figure caption="Seven samples' walks through the ABCA7 VNTR in pairs, each bar carrying the allele TRGT called for it as a tick. A tick at the end of its bar is agreement, a red readout is a walk far from its allele, and a grey tick is an allele no read spanned." src="/img/pangenome/hprc_abca7_disagreements.png" />

## Check it against TRGT's genotypes

Click the TRGT record in the linear view. Its sample table gives each sample's
`AL`, the allele lengths the ticks are drawn from, and `SD`, the reads spanning
each allele. HG02559's second allele has no spanning read at all, so its tick is
grey: TRGT's second call copies the first, and the walk it landed on takes no
verdict.

## Reproduce it end to end

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_hprc_abca7_trgt.sh
bash build_hprc_abca7_trgt.sh       # writes ./hprc_abca7_trgt_build/
```

The TRGTdb is a directory of Parquet tables, one per sample beside a table of
loci and one of alleles, so DuckDB reads a locus's calls straight out of it:

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
downloads PacBio's TRGT database (1.1 GB) and the repeat catalogue, and writes
the _ABCA7_ record with every sample's genotype.

## See also

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
- Liao WW, Asri M, Ebler J, et al. A draft human pangenome reference. Nature.
  2023;617(7960):312-324. https://doi.org/10.1038/s41586-023-05896-x
- [HPRC release 2](https://doi.org/10.64898/2026.07.21.739710)
