---
title: Rearrangements between genomes by type (SyRI)
sidebar_label: Synteny (SyRI rearrangement types)
description:
  Load the SyRI classification of the differences between assembled genomes, so
  each syntenic, inverted, translocated or duplicated region is a ribbon colored
  by its type, in a stack of Arabidopsis accessions and as lanes in the
  reference coordinates
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Whole-genome alignments
---

The Columbia and Landsberg accessions of _Arabidopsis thaliana_ differ by an
inversion of more than a megabase on the short arm of chromosome 4, first seen
under the microscope and later confirmed by assembling Landsberg.
[SyRI](https://github.com/schneebergerlab/syri) sorts a whole-genome alignment
into syntenic, inverted, translocated and duplicated regions. We find the
inversion again with it, then compare four more accessions. We:

- run SyRI on each aligned pair of accessions, and turn its output into a
  JBrowse config with [syri2jbrowse](https://github.com/cmdcolin/syri2jbrowse)
- color the ribbons by SyRI type in a linear synteny view of two accessions
- stack all six accessions in one linear synteny view, as
  [plotsr](https://github.com/schneebergerlab/plotsr) does
- draw the accessions as lanes under Columbia, beside a row of SyRI regions per
  accession

## Prerequisites

- [`minimap2`](https://github.com/lh3/minimap2) and `samtools`
- [SyRI](https://github.com/schneebergerlab/syri) (`syri`), from bioconda, or
  Docker, which runs its biocontainers image
- [syri2jbrowse](https://github.com/cmdcolin/syri2jbrowse), which needs only
  Python
- The NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/command-line-tools/download-and-install/)
  CLI, to fetch the assemblies
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

<!-- BEGIN GENERATED TUTORIAL_INSTALL samtools,minimap2,datasets,syri,syri2jbrowse -->

```bash
# Debian/Ubuntu
sudo apt install samtools minimap2
# or conda, which has every tool above
conda install -c bioconda -c conda-forge samtools minimap2 ncbi-datasets-cli \
  syri
# or Linux x86_64 binaries for the tools apt lacks
wget -P ~/.local/bin \
  https://ftp.ncbi.nlm.nih.gov/pub/datasets/command-line/v2/linux-amd64/datasets \
  https://ftp.ncbi.nlm.nih.gov/pub/datasets/command-line/v2/linux-amd64/dataformat
chmod +x ~/.local/bin/datasets ~/.local/bin/dataformat
# any platform
pip install git+https://github.com/cmdcolin/syri2jbrowse
```

<!-- END GENERATED TUTORIAL_INSTALL samtools,minimap2,datasets,syri,syri2jbrowse -->

## The data

TAIR10 for Columbia, and the chromosome-level assemblies of five more accessions
from [Jiao and Schneeberger 2020](https://doi.org/10.1038/s41467-020-14779-y).
The [build script](#reproduce-it-end-to-end) fetches them all.

| What it is             | File                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Col-0, GCF_000001735.4 | [GCF_000001735.4_TAIR10.1/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/735/GCF_000001735.4_TAIR10.1/)                                     |
| Ler, GCA_902460285.1   | [GCA_902460285.1_Arabidopsis_thaliana_Ler/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/902/460/285/GCA_902460285.1_Arabidopsis_thaliana_Ler/)     |
| Cvi-0, GCA_902460275.1 | [GCA_902460275.1_Arabidopsis_thaliana_Cvi-0/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/902/460/275/GCA_902460275.1_Arabidopsis_thaliana_Cvi-0/) |
| Eri-1, GCA_902460315.1 | [GCA_902460315.1_Arabidopsis_thaliana_Eri-1/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/902/460/315/GCA_902460315.1_Arabidopsis_thaliana_Eri-1/) |
| Kyo, GCA_902460305.1   | [GCA_902460305.1_Arabidopsis_thaliana_Kyo/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/902/460/305/GCA_902460305.1_Arabidopsis_thaliana_Kyo/)     |
| Sha, GCA_902460295.1   | [GCA_902460295.1_Arabidopsis_thaliana_Sha/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/902/460/295/GCA_902460295.1_Arabidopsis_thaliana_Sha/)     |

## Aligning a pair and running SyRI

SyRI reads a whole-genome alignment of two chromosome-level assemblies whose
homologous chromosomes share a name. For each pair:

<!-- from: scripts/build_syri_synteny.sh -->

```bash
# asm5 is the preset for genomes of one species
# --eqx writes = and X in the CIGAR, which SyRI reads the mismatches from
minimap2 -cx asm5 --eqx Col-0.fa Ler.fa >Col-0_Ler.aln.paf

# -F P says the alignment is PAF
# --nc runs that many chromosomes at once
syri -c Col-0_Ler.aln.paf -r Col-0.fa -q Ler.fa -F P --prefix Col-0_Ler. --nc 5
```

We run it on each accession against the one above it, the pairs plotsr stacks,
and on each accession against Col-0.

## From SyRI to a JBrowse config

syri2jbrowse takes plotsr's inputs: a genomes file listing each FASTA and its
name in stack order, and one `--sr` per neighbouring pair. Each `--pair` adds an
accession against Col-0:

```text title="genomes.txt"
Col-0.fa	Col-0
Ler.fa	Ler
Cvi.fa	Cvi
Eri.fa	Eri
Kyo.fa	Kyo
Sha.fa	Sha
```

<!-- from: scripts/build_syri_synteny.sh -->

```bash
syri2jbrowse --genomes genomes.txt -o . \
  --sr Col-0_Ler.syri.out --sr Ler_Cvi.syri.out --sr Cvi_Eri.syri.out \
  --sr Eri_Kyo.syri.out --sr Kyo_Sha.syri.out \
  --pair Col-0 Cvi Col-0_Cvi.syri.out --pair Col-0 Eri Col-0_Eri.syri.out \
  --pair Col-0 Kyo Col-0_Kyo.syri.out --pair Col-0 Sha Col-0_Sha.syri.out
```

It writes `config.json` with one assembly per accession, read from a
`.chrom.sizes` beside it:

```json addassembly
{
  "name": "Col-0",
  "uri": "Col-0.chrom.sizes"
}
```

and two tracks. The first holds every region as a PAF record whose `syri` tag is
its type and `color` tag plotsr's color for it. `attributeColumns` offers both
on the palette button, and the `MultiWaySyntenyDisplay` entry sets up the
[lanes](#every-accession-in-columbia-coordinates):

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "syri",
  "name": "SyRI regions",
  "assemblyNames": ["Col-0", "Ler", "Cvi", "Eri", "Kyo", "Sha"],
  "adapter": {
    "type": "MultiGenomePAFAdapter",
    "uri": "syri.paf",
    "attributeColumns": ["syri", "color"]
  },
  "displays": [
    {
      "type": "MultiWaySyntenyDisplay",
      "rows": { "sort": ["Ler", "Cvi", "Eri", "Kyo", "Sha"] },
      "ribbons": {
        "encoding": {
          "color": {
            "field": "syri",
            "scale": {
              "domain": ["SYN", "INV", "TRANS", "INVTR", "DUP", "INVDP"]
            }
          },
          "opacity": 0.7
        }
      }
    }
  ]
}
```

The second places each accession's regions on Col-0, a BED row per region whose
`name` is its type and whose `query` column names the accession. `rows` gives
each accession a row, `encoding.color` maps the type to plotsr's colors in
plotsr's order, and `disableGeneHeuristic` keeps the lanes from drawing it as
Col-0's genes:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "syri_regions_on_Col-0",
  "name": "SyRI regions on Col-0, by genome",
  "assemblyNames": ["Col-0"],
  "adapter": {
    "type": "BedAdapter",
    "uri": "syri_regions.bed",
    "columnNames": [
      "chrom",
      "chromStart",
      "chromEnd",
      "name",
      "score",
      "strand",
      "thickStart",
      "thickEnd",
      "itemRgb",
      "query"
    ],
    "disableGeneHeuristic": true
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "rows": { "field": "query", "sort": ["Ler", "Cvi", "Eri", "Kyo", "Sha"] },
      "encoding": {
        "color": {
          "field": "name",
          "scale": {
            "domain": ["SYN", "INV", "TRANS", "INVTR", "DUP", "INVDP"],
            "range": [
              "#cccccc",
              "#ffa500",
              "#9acd32",
              "#9acd32",
              "#00bbff",
              "#00bbff"
            ]
          },
          "legend": { "title": "syri" }
        }
      }
    }
  ]
}
```

## Columbia against Landsberg on chromosome 4

Open the first 6 Mb of chromosome 4 in both accessions and pick **syri** under
**Color by value** on the palette button in the view header:

```json session config=test_data/syri/config.json
{
  "defaultSession": {
    "name": "Col-0 vs Ler, chromosome 4",
    "views": [
      {
        "type": "LinearSyntenyView",
        "views": [
          { "assembly": "Col-0", "loc": "Chr4:1-6,000,000" },
          { "assembly": "Ler", "loc": "Chr4:1-6,000,000" }
        ],
        "tracks": [["syri"]],
        "encoding": {
          "color": {
            "field": "syri",
            "scale": {
              "domain": ["SYN", "INV", "TRANS", "INVTR", "DUP", "INVDP"]
            }
          },
          "opacity": 0.9
        },
        "mark": { "interpolate": "bump" },
        "render": { "antialias": false },
        "collapseEmptyRows": true,
        "levelHeights": [260]
      }
    ]
  }
}
```

The thin ribbons leaving the frame end on another chromosome, which the label at
the frame's edge names. plotsr paints `INVTR` as `TRANS` and `INVDP` as `DUP`,
so a key row names every type on screen in its color.

<Figure caption="Chromosome 4 in Col-0 above and Ler below, SyRI regions colored by type. The crossed ribbon is the inversion." src="/img/syri/col_ler_chr4.png" />

## Stacking the accessions, one SyRI run per band

The config opens on every accession stacked, each band drawing the SyRI run
between the two genomes it joins. Like plotsr, `filter` hides regions under 10
kb; regions joining two chromosomes, which plotsr hides unless given `--itx`,
stay as the long ribbons:

```json session config=test_data/syri/config.json
{
  "defaultSession": {
    "name": "Six Arabidopsis accessions, SyRI regions",
    "views": [
      {
        "type": "LinearSyntenyView",
        "views": [
          { "assembly": "Col-0" },
          { "assembly": "Ler" },
          { "assembly": "Cvi" },
          { "assembly": "Eri" },
          { "assembly": "Kyo" },
          { "assembly": "Sha" }
        ],
        "tracks": ["syri"],
        "encoding": {
          "color": {
            "field": "syri",
            "scale": {
              "domain": ["SYN", "INV", "TRANS", "INVTR", "DUP", "INVDP"]
            }
          },
          "opacity": 0.9
        },
        "filter": [{ "field": "length", "gte": 10000 }],
        "mark": { "interpolate": "bump" },
        "render": { "antialias": false },
        "collapseEmptyRows": true,
        "levelHeights": [150, 150, 150, 150, 150]
      }
    ]
  }
}
```

<Figure caption="Arabidopsis accessions stacked, each band the SyRI comparison of the two genomes it joins. The crossed ribbon on Chr3 between Kyo and Sha is an inversion." src="/img/syri/six_accessions.png" />

## Every accession in Columbia coordinates

The `--pair` runs place every accession on Col-0. Open a linear genome view on
Col-0 at `Chr4:1-6,000,000` and turn on **SyRI regions on Col-0, by genome** and
**SyRI regions**, which opens as lanes:

```json session config=test_data/syri/config.json
{
  "defaultSession": {
    "name": "Six accessions in Col-0's coordinates",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "Col-0",
        "loc": "Chr4:1-6,000,000",
        "tracks": [
          {
            "trackId": "syri_regions_on_Col-0",
            "type": "LinearMultiRowFeatureDisplay",
            "height": 110
          },
          {
            "trackId": "syri",
            "type": "MultiWaySyntenyDisplay",
            "height": 640
          }
        ]
      }
    ]
  }
}
```

Each lane is placed by its run against Col-0, while the band between two lanes
comes from the run between those two accessions.

<Figure caption="Col-0 chromosome 4 with a row of SyRI regions per accession above, and the accessions as lanes below." src="/img/syri/col0_lanes.png" />

## Structural forms on the Arabidopsis pangenome page

The
[Arabidopsis pangenome page](https://genomes.jbrowse.org/pangenomes/arabidopsis/)
has SyRI regions for the 1001 Genomes Plus accessions on TAIR10. Type a gene or
region, and it maps the window with one row per structural form: a group of
accessions with the same alleles at every structural-variant site in the window,
called with `minigraph --call`.

- **Open in JBrowse**, under the map, opens the window with a row of SyRI
  regions per accession beneath the graph
- **Every accession as SyRI lanes**, under the page title, opens the same rows
  over the chromosome 4 inversion

The rows are the **SyRI regions on TAIR10, one row per accession** track of the
hosted
[Arabidopsis pangenome config](https://jbrowse.org/demos/arabidopsis_pangenome/config.json):

<Figure caption="TAIR10 chromosome 4 with a row of SyRI regions per 1001 Genomes Plus accession." src="/img/syri/tair10_1001g.png" />

## Reproduce it end to end

The script needs the tools under [Prerequisites](#prerequisites):

1. Fetch the assemblies and keep the nuclear chromosomes, named `Chr1` to
   `Chr5`, since SyRI pairs chromosomes by name.
2. Align each accession to Col-0 and to the accession above it, and run SyRI on
   each alignment.
3. Run syri2jbrowse on the SyRI outputs.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_syri_synteny.sh
bash build_syri_synteny.sh
```

For genomes of your own, pass a rows file after the output directory, one
`<name> [accession]` line per genome in stack order, the reference first. A
chromosome-level `<name>.fa` already in the output directory needs no accession.

```bash
bash build_syri_synteny.sh my_syri rows.txt
```

## See also

- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/odp_linkage_groups_synteny)
- [](/docs/tutorials/hg002_haplotypes)
- [](/docs/tutorials/alu_age)

## Citations

- Goel et al. (2019).
  [SyRI: finding genomic rearrangements and local sequence differences from whole-genome assemblies](https://doi.org/10.1186/s13059-019-1911-0)
- Goel and Schneeberger (2022).
  [plotsr: visualizing structural similarities and rearrangements between multiple genomes](https://doi.org/10.1093/bioinformatics/btac196)
- Jiao and Schneeberger (2020).
  [Chromosome-level assemblies of multiple Arabidopsis genomes reveal hotspots of rearrangements with altered evolutionary dynamics](https://doi.org/10.1038/s41467-020-14779-y)
- Zapata et al. (2016).
  [Chromosome-level assembly of Arabidopsis thaliana Ler reveals the extent of translocation and inversion polymorphisms](https://doi.org/10.1073/pnas.1607532113)
- Fransz et al. (2000).
  [Integrated cytogenetic map of chromosome arm 4S of A. thaliana: structural organization of heterochromatic knob and centromere region](<https://doi.org/10.1016/S0092-8674(00)80672-8>)
