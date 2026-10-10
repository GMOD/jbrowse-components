---
title: Rearrangements between genomes by type (SyRI)
sidebar_label: Synteny (SyRI rearrangement types)
description:
  Load the SyRI classification of the differences between assembled genomes, so
  each syntenic, inverted, translocated or duplicated region is a ribbon colored
  by its type, in a stack of six Arabidopsis accessions and as lanes in the
  reference coordinates
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Whole-genome alignments
---

The Columbia and Landsberg accessions of _Arabidopsis thaliana_ differ by an
inversion of more than a megabase on the short arm of chromosome 4, first seen
under the microscope and later confirmed by assembling Landsberg. We find it
again by aligning six assembled accessions and running
[SyRI](https://github.com/schneebergerlab/syri), which sorts an alignment into
syntenic, inverted, translocated and duplicated regions. We compare each
accession with Columbia and with the accession above it, and every comparison
goes into one file whose ribbons take the color of the type SyRI assigns. We
draw that file two ways:

- the stack [plotsr](https://github.com/schneebergerlab/plotsr) draws
- the same accessions as lanes under Columbia coordinates

## Prerequisites

- [`minimap2`](https://github.com/lh3/minimap2) and `samtools`
- [SyRI](https://github.com/schneebergerlab/syri) (`syri`), from bioconda, or
  Docker, which runs its biocontainers image
- The NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/command-line-tools/download-and-install/)
  CLI, to fetch the assemblies
- `python3`, `bgzip` and `tabix`
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

TAIR10 for Columbia, and the chromosome-level assemblies of five more accessions
from [Jiao and Schneeberger 2020](https://doi.org/10.1038/s41467-020-14779-y),
the first three the ones a figure in the plotsr paper stacks.

The [build script](#reproduce-it-end-to-end) takes these files from their URLs,
so there is nothing to download by hand.

- Col-0, GCF_000001735.4:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/735/GCF_000001735.4_TAIR10.1/
- Ler, GCA_902460285.1:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/902/460/285/GCA_902460285.1_Arabidopsis_thaliana_Ler/
- Cvi-0, GCA_902460275.1:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/902/460/275/GCA_902460275.1_Arabidopsis_thaliana_Cvi-0/
- Eri-1, GCA_902460315.1:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/902/460/315/GCA_902460315.1_Arabidopsis_thaliana_Eri-1/
- Kyo, GCA_902460305.1:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/902/460/305/GCA_902460305.1_Arabidopsis_thaliana_Kyo/
- Sha, GCA_902460295.1:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/902/460/295/GCA_902460295.1_Arabidopsis_thaliana_Sha/

## Aligning a pair and running SyRI

SyRI reads a whole-genome alignment of two chromosome-level assemblies whose
homologous chromosomes share a name, which the
[script](#reproduce-it-end-to-end) arranges. For each pair, the commands are:

<!-- from: scripts/build_syri_synteny.sh -->

```bash
# asm5 is the preset for genomes of one species
# --eqx writes = and X in the CIGAR, which SyRI reads the mismatches from
minimap2 -cx asm5 --eqx Col-0.fa Ler.fa >Col-0_Ler.aln.paf

# -F P says the alignment is PAF
# --nc runs that many chromosomes at once
syri -c Col-0_Ler.aln.paf -r Col-0.fa -q Ler.fa -F P --prefix Col-0_Ler. --nc 5
```

In `Col-0_Ler.syri.out`, the structural regions are the rows with no parent:
`SYN`, `INV`, `TRANS`, `INVTR`, `DUP` and `INVDP`.

## SyRI regions as one PAF

A SyRI region is an interval on each of two genomes, the same shape as a PAF
alignment record.
[`syri_to_paf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/syri_to_paf.py)
writes each region as one:

- **Sequence names** are `<genome>#1#<chrom>`, so records from many pairs can
  share a file.
- **Inverted types** go on the minus strand.
- **Two tags** hold the type (`syri`) and the color plotsr gives that type
  (`color`).
- **Sequence lengths** come from a `.chrom.sizes` file beside `syri.out`, the
  first two columns of the FASTA index.

Concatenating the records from every pair gives one file for every view below:

<!-- from: scripts/build_syri_synteny.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/syri_to_paf.py
for name in Col-0 Ler; do
  samtools faidx $name.fa
  cut -f1,2 $name.fa.fai >$name.chrom.sizes
done
python3 syri_to_paf.py Col-0_Ler.syri.out --reference Col-0 --query Ler
cat Col-0_*.paf Ler_Cvi.paf Cvi_Eri.paf Eri_Kyo.paf Kyo_Sha.paf >syri_pangenome.paf
```

The ribbons need no sequence, so each accession gets an assembly with a
`ChromSizesAdapter` over its `.chrom.sizes`. Col-0 is one; Ler, Cvi, Eri, Kyo
and Sha repeat it with their names and files:

```json addassembly
{
  "name": "Col-0",
  "uri": "Col-0.chrom.sizes"
}
```

Two entries in the track config matter here:

- `attributeColumns` lists the PAF tags the palette button offers: `syri`
  becomes a color-by mode, and `color` is the color the file puts beside each
  type
- the `MultiWaySyntenyDisplay` entry sets up the
  [lanes view](#every-accession-in-columbia-coordinates): `rows.domain` orders
  the lanes, and `ribbonColor` is a color scale on the bands, mapping the `syri`
  field through a `domain` of the six types

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "syri_pangenome",
  "name": "SyRI regions",
  "assemblyNames": ["Col-0", "Ler", "Cvi", "Eri", "Kyo", "Sha"],
  "adapter": {
    "type": "MultiGenomePAFAdapter",
    "uri": "syri_pangenome.paf",
    "attributeColumns": ["syri", "color"]
  },
  "displays": [
    {
      "type": "MultiWaySyntenyDisplay",
      "rows": { "domain": ["Ler", "Cvi", "Eri", "Kyo", "Sha"] },
      "ribbonColor": {
        "field": "syri",
        "domain": ["SYN", "INV", "TRANS", "INVTR", "DUP", "INVDP"]
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
        "tracks": [["syri_pangenome"]],
        "color": {
          "field": "syri",
          "domain": ["SYN", "INV", "TRANS", "INVTR", "DUP", "INVDP"]
        },
        "drawCurves": true,
        "opacity": 0.9,
        "fadeThinAlignmentsMode": "off",
        "collapseEmptyRows": true,
        "levelHeights": [260]
      }
    ]
  }
}
```

The thin ribbons leaving the frame are duplications and translocations whose
other end sits on another chromosome, which the label at the edge of the frame
names. The key has one row per color, so `INVTR` shares a row with `TRANS` and
`INVDP` with `DUP`.

<Figure caption="Chromosome 4 in Col-0 above and Ler below, SyRI regions colored by type. The crossed ribbon is the inversion between the two accessions, with syntenic regions either side." src="/img/syri/col_ler_chr4.png" />

## Stacking six accessions, one SyRI run per band

The `syri_pangenome` track stacks all six, each band drawing the SyRI run
between the two genomes it joins:

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
        "tracks": [
          ["syri_pangenome"],
          ["syri_pangenome"],
          ["syri_pangenome"],
          ["syri_pangenome"],
          ["syri_pangenome"]
        ],
        "color": {
          "field": "syri",
          "domain": ["SYN", "INV", "TRANS", "INVTR", "DUP", "INVDP"]
        },
        "drawCurves": true,
        "opacity": 0.9,
        "fadeThinAlignmentsMode": "off",
        "collapseEmptyRows": true,
        "levelHeights": [150, 150, 150, 150, 150]
      }
    ]
  }
}
```

<Figure caption="Five chromosomes of six Arabidopsis accessions, each band the SyRI comparison of the two genomes it joins, colored by type. The chromosome 4 inversion crosses only in the band under Col-0, and a chromosome 3 inversion only in the band between Kyo and Sha." src="/img/syri/six_accessions.png" />

## Every accession in Columbia coordinates

To compare every accession with Col-0 in Col-0 coordinates, `syri_to_paf.py`
also writes each pair's regions in reference coordinates, one BED row per
region. A row is named by its type, colored by `itemRgb`, and has the accession
name in a `query` column. The rows against Col-0 concatenate into one track:

<!-- from: scripts/build_syri_synteny.sh -->

```bash
{
  head -n1 Col-0_Ler.regions.bed
  for name in Ler Cvi Eri Kyo Sha; do
    tail -n +2 Col-0_$name.regions.bed
  done | sort -k1,1 -k2,2n
} | bgzip >syri_regions.bed.gz
tabix -p bed syri_regions.bed.gz
```

In grammar-of-graphics terms, `rows` assigns one row per value of a field, here
`query`, the accession, and `rows.domain` orders them:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "syri_regions_on_Col-0",
  "name": "SyRI regions on Col-0, by accession",
  "assemblyNames": ["Col-0"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "syri_regions.bed.gz",
    "disableGeneHeuristic": true
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "rows": {
        "field": "query",
        "domain": ["Ler", "Cvi", "Eri", "Kyo", "Sha"]
      },
      "color": { "domain": ["SYN", "INV", "TRANS", "INVTR", "DUP", "INVDP"] }
    }
  ]
}
```

We'll open a linear genome view on Col-0 at `Chr4:1-6,000,000`. Then:

- Turn on **SyRI regions on Col-0, by accession** and **SyRI regions**.
- Switch **SyRI regions** to **Display types → Multi-way synteny display**,
  which takes its lanes and colors from the track's `MultiWaySyntenyDisplay`
  entry.

Each accession is a lane, drawn in its assembly's coordinates and placed by the
SyRI run against Col-0. The band between two lanes comes from the run between
those two accessions, so it has the type SyRI gave that pair.

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
            "trackId": "syri_pangenome",
            "type": "MultiWaySyntenyDisplay",
            "height": 640
          }
        ]
      }
    ]
  }
}
```

<Figure caption="Col-0 chromosome 4 with one row of SyRI regions per accession above, and the accessions as lanes in their own assembly coordinates below, each band colored by the SyRI type between the two genomes it joins. Every accession is inverted against Col-0 across the same stretch, and the bands between accessions run straight there." src="/img/syri/col0_lanes.png" />

## Checking the chromosome 4 inversion against syri.out

The largest inverted region of the Col-0 and Ler run, straight from the SyRI
table:

```bash
awk -F'\t' '$11=="INV" {print $3-$2+1, $1, $2, $3}' Col-0_Ler.syri.out | sort -nr | head -1
```

The largest inversion is on `Chr4`, from 1,612,606 to 2,782,621, the interval
the crossed ribbon spans and the orange block on the Ler row.

## Reproduce it end to end

The script needs the tools under [Prerequisites](#prerequisites) and works in
four steps:

1. Fetch the six assemblies and keep the five nuclear chromosomes, named `Chr1`
   to `Chr5`, since SyRI pairs chromosomes by name.
2. Align each accession to Col-0 and to the accession above it, and run SyRI on
   each alignment.
3. Convert each SyRI table to PAF records and reference-coordinate BED rows.
4. Write the config with the six assemblies, the stacked track and the Col-0
   regions track.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_syri_synteny.sh
bash build_syri_synteny.sh
```

For genomes of your own, pass a rows file after the output directory:

- one `<name> [accession]` line per genome, in stack order, the reference first
- the script uses a chromosome-level `<name>.fa` in the output directory as it
  is, so a row that has one needs no accession
- homologous chromosomes must be spelled alike in every FASTA, since SyRI pairs
  them by name

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

- Goel M, Sun H, Jiao WB, Schneeberger K. SyRI: finding genomic rearrangements
  and local sequence differences from whole-genome assemblies. Genome Biol
  (2019). https://doi.org/10.1186/s13059-019-1911-0
- Goel M, Schneeberger K. plotsr: visualizing structural similarities and
  rearrangements between multiple genomes. Bioinformatics (2022).
  https://doi.org/10.1093/bioinformatics/btac196
- Jiao WB, Schneeberger K. Chromosome-level assemblies of multiple Arabidopsis
  genomes reveal hotspots of rearrangements with altered evolutionary dynamics.
  Nat Commun (2020). https://doi.org/10.1038/s41467-020-14779-y
- Zapata L, et al. Chromosome-level assembly of Arabidopsis thaliana Ler reveals
  the extent of translocation and inversion polymorphisms. PNAS (2016).
  https://doi.org/10.1073/pnas.1607532113
- Fransz PF, et al. Integrated cytogenetic map of chromosome arm 4S of A.
  thaliana: structural organization of heterochromatic knob and centromere
  region. Cell (2000). https://doi.org/10.1016/S0092-8674(00)80670-5
