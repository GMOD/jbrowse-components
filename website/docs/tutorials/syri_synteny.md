---
title: Rearrangements between genomes by type (SyRI)
sidebar_label: Synteny (SyRI rearrangement types)
description:
  Load SyRI's classification of the differences between assembled genomes, so
  each syntenic, inverted, translocated or duplicated region is a ribbon colored
  by its type, in a stack of four Arabidopsis accessions
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Whole-genome alignments
---

The Columbia and Landsberg accessions of _Arabidopsis thaliana_ differ by an
inversion of more than a megabase on the short arm of chromosome 4, first seen
under the microscope and later confirmed by assembling Landsberg. We find it
again by aligning four assembled accessions, each to the one above it, and
running [SyRI](https://github.com/schneebergerlab/syri), which sorts what an
alignment contains into syntenic, inverted, translocated and duplicated regions.
SyRI's table loads as a synteny track whose ribbons take their color from the
type column, which is the picture
[plotsr](https://github.com/schneebergerlab/plotsr) draws, with every region
open to zooming and clicking.

## Prerequisites

- [`minimap2`](https://github.com/lh3/minimap2) and `samtools`
- [SyRI](https://github.com/schneebergerlab/syri) (`syri`), from bioconda, or
  Docker, which runs its biocontainers image
- The NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/command-line-tools/download-and-install/)
  CLI, to fetch the assemblies
- `python3`
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

TAIR10 for Columbia, and the chromosome-level assemblies of three more
accessions from
[Jiao and Schneeberger 2020](https://doi.org/10.1038/s41467-020-14779-y), the
four plotsr's own figure stacks.

- Col-0, GCF_000001735.4:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/735/GCF_000001735.4_TAIR10.1/
- Ler, GCA_902460285.1:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/902/460/285/GCA_902460285.1_Arabidopsis_thaliana_Ler/
- Cvi-0, GCA_902460275.1:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/902/460/275/GCA_902460275.1_Arabidopsis_thaliana_Cvi-0/
- Eri-1, GCA_902460315.1:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCA/902/460/315/GCA_902460315.1_Arabidopsis_thaliana_Eri-1/

## Aligning a pair and running SyRI

SyRI reads a whole-genome alignment of two chromosome-level assemblies whose
homologous chromosomes share a name. The [script](#reproduce-it-end-to-end)
keeps each assembly's five nuclear chromosomes and names them `Chr1` to `Chr5`.
Each genome is then aligned to the one above it in the stack:

<!-- from: scripts/build_syri_synteny.sh -->

```bash
# asm5 is the preset for genomes of one species
# --eqx writes = and X in the CIGAR, which SyRI reads the mismatches from
minimap2 -ax asm5 --eqx Col-0.fa Ler.fa |
  samtools sort -O BAM -o Col-0_Ler.bam -

# -F B says the alignment is BAM
# --nc runs that many chromosomes at once
syri -c Col-0_Ler.bam -r Col-0.fa -q Ler.fa -F B --prefix Col-0_Ler. --nc 5
```

`Col-0_Ler.syri.out` holds one row per annotation. The structural regions are
the rows with no parent: `SYN`, `INV`, `TRANS`, `INVTR`, `DUP` and `INVDP`, each
with its interval on both genomes.

## SyRI's regions as a synteny track

A JBrowse ortholog table is a list of id pairs joined to one BED per genome, and
a SyRI region is an id with an interval on each genome, so the conversion is a
rename.
[`syri_to_blocks.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/syri_to_blocks.py)
writes each region to both BEDs under its SyRI id, the inverted types on the
minus strand of the query's, and one table row per region carrying its type,
that type's color in plotsr's palette and its length:

<!-- from: scripts/build_syri_synteny.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/syri_to_blocks.py
python3 syri_to_blocks.py Col-0_Ler.syri.out --prefix Col-0_Ler
```

`attributeColumns` names the table's extra columns. `type` becomes a color-by
mode, and `color` is the palette the file puts beside each type:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "syri_Col-0_Ler",
  "name": "Col-0 vs Ler, SyRI regions",
  "assemblyNames": ["Col-0", "Ler"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "Col-0_Ler.blocks",
    "blockAssemblies": ["Col-0", "Ler"],
    "bedLocations": ["Col-0_Ler.Col-0.bed", "Col-0_Ler.Ler.bed"],
    "attributeColumns": ["type", "color", "length"]
  }
}
```

The ribbons need no sequence, so each accession is an assembly of its chromosome
lengths alone, a `ChromSizesAdapter` over the first two columns of its `.fai`.

## Columbia against Landsberg on chromosome 4

Open the first 6 Mb of chromosome 4 in both accessions and pick **type** under
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
        "tracks": [["syri_Col-0_Ler"]],
        "colorBy": { "field": "type" },
        "drawCurves": true,
        "alpha": 0.9,
        "fadeThinAlignmentsMode": "off",
        "collapseEmptyRows": true,
        "levelHeights": [260]
      }
    ]
  }
}
```

The syntenic regions run straight down in grey, and one inverted region crosses
over between them. The thin ribbons leaving the frame are duplications and
translocations whose other end sits on another chromosome, which the label at
the frame's edge names.

<Figure caption="The first 6 Mb of chromosome 4 in Col-0 above and Ler below, SyRI's regions colored by type. The crossed ribbon is the inversion between the two accessions, with syntenic regions either side of it." src="/img/syri/col_ler_chr4.png" />

## Four accessions

The same view stacks all four, each band drawing the SyRI run between the two
genomes it joins:

```json session config=test_data/syri/config.json
{
  "defaultSession": {
    "name": "Four Arabidopsis accessions, SyRI regions",
    "views": [
      {
        "type": "LinearSyntenyView",
        "views": [
          { "assembly": "Col-0" },
          { "assembly": "Ler" },
          { "assembly": "Cvi" },
          { "assembly": "Eri" }
        ],
        "tracks": [["syri_Col-0_Ler"], ["syri_Ler_Cvi"], ["syri_Cvi_Eri"]],
        "colorBy": { "field": "type" },
        "drawCurves": true,
        "alpha": 0.9,
        "fadeThinAlignmentsMode": "off",
        "collapseEmptyRows": true,
        "levelHeights": [180, 180, 180]
      }
    ]
  }
}
```

<Figure caption="Five chromosomes of four Arabidopsis accessions, each band SyRI's comparison of the two genomes it joins, colored by type. The widest crossed ribbon is the chromosome 4 inversion in the band under Col-0, and the two bands below it run straight at that position." src="/img/syri/four_accessions.png" />

## Check it against syri.out

The largest inverted region of the Col-0 and Ler run, straight from SyRI's
table:

```bash
awk -F'\t' '$11=="INV" {print $3-$2+1, $1, $2, $3}' Col-0_Ler.syri.out | sort -nr | head -1
```

It is 1,170,016 bp on `Chr4`, from 1,612,606 to 2,782,621, the interval the
crossed ribbon spans.

## Reproduce it end to end

The script fetches the four assemblies, aligns each to the one above it, runs
SyRI on the three pairs, converts each table and writes the config; see
[Prerequisites](#prerequisites). Its `ROWS` list is one `<name> <accession>`
line per genome in stack order. For genomes of your own, put a chromosome-level
`<name>.fa` for each row into the output directory, homologous chromosomes
spelled alike, and the download step skips it.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_syri_synteny.sh
bash build_syri_synteny.sh
```

## See also

- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/odp_linkage_groups_synteny)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/hg002_haplotypes)

## References

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
