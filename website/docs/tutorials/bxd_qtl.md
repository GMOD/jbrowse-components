---
title: QTL mapping (BXD mice)
sidebar_label: QTL mapping (BXD)
description:
  Chromosome-painting and a QTL Manhattan plot from GeneNetwork BXD data
guide_category: Tutorials
tutorial_category: Population genomics
---

The BXD mice are inbred strains bred down from two parents, B6 and DBA/2, so
each strain carries a mosaic of blocks from one or the other. We paint each
strain by which parent gave it each block and stack that under a GeneNetwork QTL
scan, so a trait peak sits over the blocks that drive it.

## Prerequisites

- `curl`, to fetch GeneNetwork's QTL scan
- `jq`, to reshape it
- `python3`, for the painting
- htslib (`bgzip`, `tabix`), for the painting
- A JBrowse instance to add the tracks to (see the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop) to add the built files with no
  hosting step)

On Debian/Ubuntu, `apt install curl jq python3 tabix` covers it. GeneNetwork
serves the QTL scan [already computed](#qtl-manhattan-plot).

## Where the data comes from

BXD consensus genotypes and QTL scans from GeneNetwork
([Wang et al. 2016](https://doi.org/10.1038/ncomms10464)).

- the BXD consensus genotypes, 198 strains:
  https://gn1.genenetwork.org/genotypes/BXD.geno
- the coat-color scan (trait 11280), from GeneNetwork's mapping API:
  https://genenetwork.org/api/v_pre1/mapping?db=BXDPublish&method=gemma&trait_id=11280
- the chromosome painting, rehosted for the track config:
  https://jbrowse.org/demos/bxd/bxd_painting.bed.gz

## The BXD panel

The [BXD family](https://genenetwork.org) is a panel of ~200 mouse
recombinant-inbred (RI) strains bred from a cross of C57BL/6J (the "B" parent)
and DBA/2J (the "D" parent), and GeneNetwork has phenotyped the same strains for
thousands of traits. We build two tracks from the panel on mm10:

- a chromosome-painting track (the
  [multi-row feature display](/docs/user_guides/multirow_feature_track)) showing
  the B and D blocks of each strain
- a QTL Manhattan track (the [Manhattan display](/docs/user_guides/gwas_track))
  from a single-marker scan of a BXD phenotype

Both tracks also render inline through the
[Python anywidget interface](/docs/jbrowse_anywidget) (or [](/docs/jbrowser) in
R), so you can run a scan and view its peak in one Python or R session.

## BXD consensus genotypes

GeneNetwork distributes the consensus BXD genotypes as a plain-text `.geno`
file. Each row is a marker with a `cM` genetic-map position and an mm10 `Mb`
physical position, and the painting uses `Mb`. Each column is a strain, with a
one-letter genotype, `B`, `D`, `H` (heterozygous) or `U` (unknown):

```text
@name:BXD
@mat:B
@pat:D
Chr  Locus         cM    Mb        BXD1  BXD2  BXD5  ...
1    rs31443144    0.11  3.010274  B     B     D     ...
1    rs6269442     0.21  3.492195  B     B     D     ...
```

The file header lists "198 BXD strains and ... the reciprocal F1s", of which
"191 are independent, whereas 7 are substrains". The painting skips the F1
columns, since an F1 is heterozygous at every marker and GeneNetwork computes
the scan over the strains.

## Chromosome painting

The painting draws one row per strain, each block colored by genotype.
[`bxd_geno_to_painting_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/bxd_geno_to_painting_bed.py)
walks the markers of each strain along every chromosome and writes one BED
interval per run of consecutive same-genotype markers (run-length encoding),
coloring `B`/`D`/`H` and writing the strain name into an extra `sample` column:

```text
#chrom  chromStart  chromEnd   name  score strand thickStart thickEnd itemRgb      sample  genotype
chr1    3001490     20291558   B     0     .      3001490    20291558 65,105,225   BXD1    B
chr1    20291558    53451539   D     0     .      20291558   53451539 220,60,50    BXD1    D
chr1    53451539    69355875   B     0     .      53451539   69355875 65,105,225   BXD1    B
```

Run it on the downloaded `.geno`, then sort, `bgzip` and `tabix` the result:

<!-- from: scripts/bxd_build_demo.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/bxd_geno_to_painting_bed.py
python3 bxd_geno_to_painting_bed.py BXD.geno bxd_painting.bed
jbrowse sort-bed bxd_painting.bed | bgzip > bxd_painting.bed.gz
tabix -p bed bxd_painting.bed.gz
```

[`sort-bed`](/docs/cli#jbrowse-sort-bed) keeps the `#`-header line on top and
sorts the rest under `LC_ALL=C`, so the adapter can read the column names off
the file and the order does not shift with your locale.

The track is a `FeatureTrack` with a `LinearMultiRowFeatureDisplay` that splits
rows on the `sample` column and colors each block from the `itemRgb` field. Both
tracks on this page use the `mm10` assembly
([assemblies configuration guide](/docs/config_guides/assemblies)).

```json addtrack
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
      "rows": "sample",
      "color": {
        "scale": "identity",
        "domain": ["rgb(65,105,225)", "rgb(220,60,50)", "rgb(150,150,150)"],
        "labels": ["B (C57BL/6J)", "D (DBA/2J)", "H (heterozygous)"],
        "title": "Genotype"
      }
    }
  ]
}
```

- `rows: "sample"` splits the one file into one labeled row per strain.
- The display paints each block in the `itemRgb` color from the file
  ([`color`](/docs/config/linearmultirowfeaturedisplay/#slot-color)).
- `scale: "identity"` on the `color` keeps those colors, and its `labels` name
  the genotype each `domain` color stands for. The same entries fill the
  **Categories** toggles in the track menu, so hiding `H` isolates the B/D
  contrast.
- `disableGeneHeuristic: true` stops the BED adapter from reading each block as
  a gene, which the `thickStart`/`thickEnd` columns would otherwise trigger.

## QTL Manhattan plot

GeneNetwork maps these traits itself, and its API serves the whole per-marker
result of a GEMMA run, the mixed model that accounts for how closely the BXD
strains are related.

Fetch the scan for one trait by its GeneNetwork id and reshape it with `jq`.
Each record carries a marker, its mm10 position in Mb, a LOD score and a
p-value:

<!-- from: scripts/bxd_build_demo.sh -->

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

The commands write a tabix-indexed BED-like table, one line per marker:

```text
#chrom  start     end       name        score strand lod
chr4    81304223  81304224  rs3708061   .     .      48.1126
```

The trait id is the number in the GeneNetwork URL for that trait, and
[`bxd_phenocovar.csv`](https://github.com/rqtl/qtl2data/tree/master/BXD) in the
qtl2data BXD release lists the ids with their descriptions. `11280` is the hair
coat color scale, scored across more strains than most.

A `GWASTrack`/`GWASAdapter` reads one column of that file as the Manhattan
score. The adapter defaults to a pre-computed `-log10(p)` in a column called
`neg_log_pvalue`, so a LOD column needs
[`scoreColumn`](/docs/config/gwasadapter/#slot-scorecolumn) naming it.
[`scoreTransform`](/docs/config/gwasadapter/#slot-scoretransform) stays at its
default, since a LOD is already on the scale the plot draws; a raw or
natural-log p-value column would need it. See the
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
  "displayDefaults": {
    "scales": { "y": { "title": "LOD" } }
  }
}
```

## Reading the coat-color peak

The coat-color scan puts a plateau of tied markers on chr4, whose interval
contains _Tyrp1_. To line the painting up with it, right-click the painting at
that column and pick **Sort rows by color here** (a saved session stores the
same sort in `sortRowsBy` on the display). Rows then order by B/D genotype at
the peak. The split directly beneath the peak is the contrast the scan scores,
and away from the locus it breaks up into mixed B/D blocks.

<Video src="/media/qtl/painting_sort.mp4" caption="The sort as the menu item does it: 198 strains arrive in their recombinant mosaic, a right-click on the column under the peak reaches Sort rows by color here, and the rows resolve into the B/D split the scan scores." />

<Figure src="/img/qtl/bxd_painting_sorted.png" caption="The menu open over the sorted painting: keyed on genotype at the peak, the strains resolve into a clean, wide red-over-blue split directly beneath the Manhattan peak."/>

<Figure src="/img/qtl/bxd_tyrp1_locus.png" caption="The whole of chr4: the coat-color association rises to a peak over Tyrp1, and the haplotype painting (sorted by genotype at that peak) resolves into a clean D (red) over B (blue) split at the gene."/>

### Clustering the rows by similarity

Sorting orders every row on one column. **Clustering → Cluster rows by
similarity...** in the track menu orders them on the whole region in view, here
chr4, and draws the tree down the left-hand side. A session sets it with
`runClustering: true`, as `sortRowsBy` stores a sort. See
[](/docs/user_guides/clustering).

## Reproduce it end to end

[`bxd_build_demo.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/bxd_build_demo.sh)
runs every step above, painting the genotypes with
[`bxd_geno_to_painting_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/bxd_geno_to_painting_bed.py):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/bxd_build_demo.sh
bash bxd_build_demo.sh            # builds ./bxd_demo/jbrowse2
npx --yes serve bxd_demo/jbrowse2 # then open the printed URL
```

The script downloads JBrowse and the GeneNetwork consensus genotypes, builds the
painting, fetches the coat-color scan (trait `11280`) from GeneNetwork's mapping
API, and writes a `config.json` that opens on mm10 chr4 with the scan over the
painting. It prints the marker at the peak and its LOD as it goes.

You can swap in any GeneNetwork trait id. Coat color is close to Mendelian here,
and a polygenic trait scans flatter, with no peak sharp enough to sort the
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
