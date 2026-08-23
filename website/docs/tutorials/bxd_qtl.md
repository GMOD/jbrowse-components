---
title: QTL mapping (BXD mice)
sidebar_label: QTL mapping (BXD)
description:
  Chromosome-painting and a QTL Manhattan plot from GeneNetwork BXD data
guide_category: Tutorials
tutorial_category: Population genomics
data: download
---

**TL;DR:** build a strain chromosome-painting `LinearMultiRowFeatureDisplay`
from the BXD genotype matrix and a `GWASTrack` from GeneNetwork's own GEMMA
scan, then stack them so a trait peak sits directly over the B/D haplotype
blocks that drive it.

## Prerequisites

- `curl` and `jq`, to fetch and reshape GeneNetwork's QTL scan
- `python3` and htslib (`bgzip`, `tabix`), for the painting
- A JBrowse instance to add the tracks to (see the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop) to add the built files with no
  hosting step)

On Debian/Ubuntu, `apt install curl jq python3 tabix` covers it. The QTL scan is
[downloaded already computed](#track-2-the-qtl-manhattan).

## The BXD panel

The [BXD family](https://genenetwork.org) is a panel of ~200 mouse
recombinant-inbred (RI) strains bred from a cross of C57BL/6J (the "B" parent)
and DBA/2J (the "D" parent). Each strain's genome is a fixed pattern of B and D
blocks, and the same strains have been phenotyped for thousands of traits at
[GeneNetwork](https://genenetwork.org).

This tutorial builds two JBrowse tracks from the same BXD panel, on mm10:

- a chromosome-painting track (the
  [multi-row feature display](/docs/user_guides/multirow_feature_track)) showing
  each strain's B and D blocks, and
- a QTL Manhattan track (the [Manhattan display](/docs/user_guides/gwas_track))
  from a single-marker scan of a real BXD phenotype.

The GWAS/Manhattan and multi-row feature tracks shown here also render inline
through the [Python anywidget interface](/docs/jbrowse_anywidget) (or
[](/docs/jbrowser) in R), so you can run the scan and view the peak in one
Python or R session.

## The data: BXD consensus genotypes

GeneNetwork distributes the consensus BXD genotypes as a plain-text `.geno`
file. Each row is a marker (with a `cM` genetic-map and an mm10 `Mb` physical
position, we use `Mb`). Each column is a strain, with a one-letter genotype,
`B`, `D`, `H` (heterozygous) or `U` (unknown):

```
@name:BXD
@mat:B
@pat:D
Chr  Locus         cM    Mb        BXD1  BXD2  BXD5  ...
1    rs31443144    0.11  3.010274  B     B     D     ...
1    rs6269442     0.21  3.492195  B     B     D     ...
```

Download it from
[gn1.genenetwork.org/genotypes/BXD.geno](https://gn1.genenetwork.org/genotypes/BXD.geno)
(please cite
[Wang et al. 2016, _Nat Commun_ 7:10464](https://doi.org/10.1038/ncomms10464)).

Its own header describes what the columns are: "198 BXD strains and ... the
reciprocal F1s", of which "191 are independent, whereas 7 are substrains". The
painting below skips the F1 columns: an F1 is heterozygous at every marker by
construction, and the scan is computed over the strains.

On JBrowse Desktop, add the `.bed.gz`/`.tsv.gz` files you build through **Add
track** with no hosting step needed
([desktop quickstart](/docs/quickstart_desktop)).

## Track 1: chromosome painting

The painting is a
[multi-row feature display](/docs/user_guides/multirow_feature_track): one row
per strain, each block colored by genotype. To make it, walk each strain's
markers along every chromosome and emit one BED interval per run of consecutive
same-genotype markers (run-length encoding), coloring `B`/`D`/`H` and writing
the strain name into an extra `sample` column:

```
#chrom  chromStart  chromEnd   name  score strand thickStart thickEnd itemRgb      sample  genotype
chr1    3001490     20291558   B     0     .      3001490    20291558 65,105,225   BXD1    B
chr1    20291558    53451539   D     0     .      20291558   53451539 220,60,50    BXD1    D
chr1    53451539    69355875   B     0     .      53451539   69355875 65,105,225   BXD1    B
```

The
[`bxd_geno_to_painting_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/bxd_geno_to_painting_bed.py)
script does exactly this run-length encoding. Run it on the downloaded `.geno`,
then sort, `bgzip`, and `tabix` the result:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/bxd_geno_to_painting_bed.py
python3 bxd_geno_to_painting_bed.py BXD.geno bxd_painting.bed
jbrowse sort-bed bxd_painting.bed | bgzip > bxd_painting.bed.gz
tabix -p bed bxd_painting.bed.gz
```

[`sort-bed`](/docs/cli#jbrowse-sort-bed) keeps the `#`-header line on top and
sorts the rest under `LC_ALL=C`, so the adapter can read the column names off
the file and the order does not shift with your locale.

Then configure a `FeatureTrack` whose `LinearMultiRowFeatureDisplay` partitions
on the `sample` column and colors each block from its `itemRgb` field. Both
tracks reference the `mm10` assembly, so set that up first if you haven't. See
the [assemblies configuration guide](/docs/config_guides/assemblies).

```json
{
  "type": "FeatureTrack",
  "trackId": "bxd_chromosome_painting_mm10",
  "name": "BXD chromosome painting (GeneNetwork, 198 strains)",
  "assemblyNames": ["mm10"],
  "adapter": {
    "type": "BedTabixAdapter",
    "disableGeneHeuristic": true,
    "uri": "https://jbrowse.org/demos/bxd/bxd_painting.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "partitionField": "sample",
      "legend": [
        { "label": "B (C57BL/6J)", "color": "rgb(65,105,225)" },
        { "label": "D (DBA/2J)", "color": "rgb(220,60,50)" },
        { "label": "H (heterozygous)", "color": "rgb(150,150,150)" }
      ]
    }
  ]
}
```

- `partitionField: "sample"` splits the one file into one labeled row per
  strain.
- A BED carrying `itemRgb` is painted with it automatically
  ([`color`](/docs/config/linearmultirowfeaturedisplay/#slot-color)), so every
  block gets its genotype color straight from the file.
- [`legend`](/docs/config/linearmultirowfeaturedisplay/#slot-legend) names the
  two parents the colors stand for, a mapping the BED itself does not record.
  Its entries also drive the track menu's **Categories** toggles, so hiding `H`
  isolates the B/D contrast.
- `disableGeneHeuristic: true` keeps the BED adapter from reading each block as
  a gene: the `thickStart`/`thickEnd` columns trip its BED12 transcript
  detection.

## Track 2: the QTL Manhattan

GeneNetwork maps these traits itself, and its API serves the whole per-marker
result of a GEMMA run, the mixed model that accounts for how closely the BXD
strains are related.

Fetch a trait's scan by its GeneNetwork id and reshape it with `jq`. Each record
carries a marker, its mm10 position in Mb, a LOD score and a p-value:

```bash
GN='https://genenetwork.org/api/v_pre1/mapping?db=BXDPublish&method=gemma'
curl -fsSL "$GN&trait_id=11280" -o coat_color.json   # 11280 = coat color

{
  printf '#chrom\tstart\tend\tname\tscore\tstrand\tlod\n'
  jq -r '.[0][] | [ "chr" + (.chr|tostring), ((.Mb*1000000)|round),
                    ((.Mb*1000000)|round + 1), .name, ".", ".",
                    (.lod_score*10000|round/10000) ] | @tsv' coat_color.json |
    sort -k1,1 -k2,2n
} | bgzip > bxd_gwas_coatcolor.tsv.gz
tabix -p bed bxd_gwas_coatcolor.tsv.gz
```

Trait ids are the numbers in a GeneNetwork trait's own URL, and
[`bxd_phenocovar.csv`](https://github.com/rqtl/qtl2data/tree/master/BXD) in the
qtl2data BXD release lists them with their descriptions. `11280` is the hair
coat color scale, scored across more strains than most.

That writes a tabix'd BED-like table, one line per marker:

```
#chrom  start     end       name        score strand lod
chr4    81304223  81304224  rs3708061   .     .      48.1126
```

A `GWASTrack`/`GWASAdapter` reads one column of that file as the Manhattan
score. It defaults to a pre-computed `-log10(p)` in a column called
`neg_log_pvalue`, so a LOD column needs
[`scoreColumn`](/docs/config/gwasadapter/#slot-scorecolumn) naming it.
[`scoreTransform`](/docs/config/gwasadapter/#slot-scoretransform) stays at its
default, since a LOD is already on the scale the plot draws; it is what a raw or
natural-log p-value column would need. See the
[GWAS track guide](/docs/config_guides/gwas_track).

```json addtrack
{
  "type": "GWASTrack",
  "trackId": "bxd_gwas_coatcolor_mm10",
  "name": "BXD QTL: coat color (GEMMA, Tyrp1, chr4)",
  "assemblyNames": ["mm10"],
  "adapter": {
    "type": "GWASAdapter",
    "uri": "bxd_gwas_coatcolor.tsv.gz",
    "scoreColumn": "lod"
  },
  "displays": [
    {
      "type": "LinearManhattanDisplay"
    }
  ]
}
```

## Reading the result

The coat-color scan puts a plateau of tied markers on chr4, whose interval
contains _Tyrp1_. To line the painting up with it, right-click the painting at
that column and pick the "Sort rows by color here" option (a saved session can
bake the same sort in through the display's `sortRowsBy` position). Rows then
order by their B/D genotype at the peak: the split directly beneath it is the
contrast the scan scores, and it breaks up into mixed B/D blocks away from the
locus.

<Video src="/media/qtl/painting_sort.mp4" caption="The sort as the menu item does it: 198 strains arrive in their recombinant mosaic, a right-click on the column under the peak reaches Sort rows by color here, and the rows resolve into the B/D split the scan scores." />

<Figure src="/img/qtl/bxd_painting_sorted.png" caption="The menu open over the sorted painting: keyed on genotype at the peak, the strains resolve into a clean, wide red-over-blue split directly beneath the Manhattan peak."/>

<Figure src="/img/qtl/bxd_tyrp1_locus.png" caption="The whole of chr4 (~156 Mb): the coat-color association rises to a peak at ~80 Mb over Tyrp1, and the haplotype painting (sorted by genotype at that peak) resolves into a clean D (red) over B (blue) split at the gene."/>

### Clustering the rows by similarity

Sorting keys every row on one column. The track menu's **Clustering → Cluster
rows by similarity** keys them on the whole visible region and draws the tree
down the left-hand side; a session can trigger it declaratively with
`runClustering: true`, the same way `sortRowsBy` bakes in a sort. See
[](/docs/user_guides/clustering).

Clustering is computed over the region in view, so this is chr4 similarity.

## Reproduce it end to end

Every step above is wrapped in one script,
[`bxd_build_demo.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/bxd_build_demo.sh),
which paints the genotypes with
[`bxd_geno_to_painting_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/bxd_geno_to_painting_bed.py):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/bxd_build_demo.sh
bash bxd_build_demo.sh            # builds ./bxd_demo/jbrowse2
npx --yes serve bxd_demo/jbrowse2 # then open the printed URL
```

It downloads JBrowse and the GeneNetwork consensus genotypes, builds the
painting, fetches the coat-color scan (trait `11280`) from GeneNetwork's mapping
API, and writes a `config.json` that opens on mm10 chr4 with the scan over the
painting. It prints the scan's peak marker and LOD as it goes. It needs `curl`,
`jq`, `python3` and htslib (`bgzip`, `tabix`) on your `PATH`.

Any GeneNetwork trait id can be swapped in. Coat color is close to Mendelian
here, and a polygenic trait scans flatter, with no peak sharp enough to sort the
painting under.

## See also

- [](/docs/tutorials/chromhmm)
- [](/docs/tutorials/analyze_trio)
- [](/docs/tutorials/population_genomics)
- [](/docs/tutorials/dog10k_selection)
- [](/docs/tutorials/local_ancestry)
- [](/docs/user_guides/gwas_track)
- [](/docs/config_guides/gwas_track)
- [](/docs/config_guides/jexl)
- [](/docs/user_guides/clustering)
