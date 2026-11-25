---
title: QTL mapping (BXD mice)
sidebar_label: QTL mapping (BXD)
description:
  Chromosome-painting and a QTL Manhattan plot from GeneNetwork BXD data
guide_category: Tutorials
tutorial_category: Population genomics
---

The [BXD mice](https://genenetwork.org) are recombinant-inbred strains bred down
from two parents, C57BL/6J (B6, the "B" parent) and DBA/2J (the "D" parent), so
each strain is a mosaic of blocks from one or the other. A GeneNetwork QTL scan
of coat color marks the region linked to variation in that trait. We:

- load GeneNetwork's BXD genotype file as a BED track and paint each strain's B
  and D blocks, one row per strain
- load the coat-color scan as a Manhattan track above the strains
- facet the strains by coat color and open the chr4 peak at _Tyrp1_
- repeat the facets at the chr9 peak at _Myo5a_

## Prerequisites

- `curl`, to fetch GeneNetwork's QTL scan
- [`jq`](https://jqlang.org/), to reshape it
- `python3`, for the painting
- htslib (`bgzip`, `tabix`), for the painting
- `node`, for the [JBrowse CLI](/docs/cli)'s `sort-bed`
- a JBrowse instance to add the tracks to
  ([web quickstart](/docs/quickstart_web) or
  [desktop quickstart](/docs/quickstart_desktop))

<!-- BEGIN GENERATED TUTORIAL_INSTALL htslib,node,jbrowse-cli -->

```bash
# Debian/Ubuntu
sudo apt install tabix nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge htslib nodejs
# any platform
npm install -g @jbrowse/cli@next
```

<!-- END GENERATED TUTORIAL_INSTALL htslib,node,jbrowse-cli -->

## The data

BXD consensus genotypes and QTL scans from GeneNetwork
([Wang et al. 2016](https://doi.org/10.1038/ncomms10464)).

The page's commands build local files from these. The Manhattan track reads the
local file they write, and the painting and gene tracks read hosted copies. The
[build script](#reproduce-it-end-to-end) fetches everything itself, or run the
commands on files of your own. The painting script reads GeneNetwork's `.geno`
format.

| What it is                                                           | File                                                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| The BXD consensus genotypes                                          | [BXD.geno](https://gn1.genenetwork.org/genotypes/BXD.geno)                                      |
| The coat-color scan (trait 11280), from GeneNetwork's mapping API    | [mapping](https://genenetwork.org/api/v_pre1/mapping?db=BXDPublish&method=gemma&trait_id=11280) |
| The coat-color scores per strain, from GeneNetwork's sample-data API | [11280](https://genenetwork.org/api/v_pre1/sample_data/BXDPublish/11280)                        |

## Paint each strain's B and D blocks

The painting has one row per strain, each block colored by genotype. GeneNetwork
distributes the consensus BXD genotypes as a plain-text `.geno` file. Each row
is a marker with a `cM` genetic-map position and an mm10 `Mb` physical position,
and the painting uses `Mb`. Each column is a strain, with a one-letter genotype,
`B`, `D`, `H` (heterozygous) or `U` (unknown):

```text
@name:BXD
@mat:B
@pat:D
Chr  Locus         cM    Mb        BXD1  BXD2  BXD5  ...
1    rs31443144    0.11  3.010274  B     B     D     ...
1    rs6269442     0.21  3.492195  B     B     D     ...
```

The painting skips the F1 columns, since an F1 (a B by D hybrid) is heterozygous
at every marker and GeneNetwork computes the scan over the strains.

[`bxd_geno_to_painting_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/bxd_geno_to_painting_bed.py)
reads the markers of each strain in order along every chromosome and writes one
BED interval per run of consecutive same-genotype markers (run-length encoding),
coloring `B`/`D`/`H` and writing the strain name into an extra `sample` column:

```text
#chrom  chromStart  chromEnd   name  score strand thickStart thickEnd itemRgb      sample  genotype
chr1    3001490     20291558   B     0     .      3001490    20291558 65,105,225   BXD1    B
chr1    20291558    53451539   D     0     .      20291558   53451539 220,60,50    BXD1    D
chr1    53451539    69355875   B     0     .      53451539   69355875 65,105,225   BXD1    B
```

Run it on the `.geno`, then sort, `bgzip` and `tabix` the result:

<!-- from: scripts/bxd_build_demo.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/bxd_geno_to_painting_bed.py
python3 bxd_geno_to_painting_bed.py BXD.geno bxd_painting.bed
jbrowse sort-bed bxd_painting.bed | bgzip > bxd_painting.bed.gz
tabix -p bed bxd_painting.bed.gz
```

[`sort-bed`](/docs/cli#jbrowse-sort-bed) keeps the `#` header on top and sorts
the rest under `LC_ALL=C`, so the adapter reads the column names off the file
whatever your locale.

## Load the mm10 assembly

The painting and Manhattan tracks both use the `mm10` assembly, whose chromosome
names the marker positions follow:

```json addassembly genome=mm10
{
  "name": "mm10",
  "aliases": ["GRCm38"],
  "uri": "https://jbrowse.org/genomes/mm10/fasta/mm10.fa.gz",
  "refNameAliases": {
    "uri": "https://hgdownload.soe.ucsc.edu/goldenpath/mm10/bigZips/latest/mm10.chromAlias.txt"
  },
  "cytobands": "https://jbrowse.org/ucsc/mm10/cytoBandIdeo.bed.gz"
}
```

The figures also show NCBI's RefSeq genes as a track:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "mm10_ncbi_refseq",
  "name": "NCBI RefSeq genes (mm10)",
  "assemblyNames": ["mm10"],
  "adapter": {
    "type": "GtfTabixAdapter",
    "gtfGzLocation": {
      "uri": "https://jbrowse.org/demos/bxd/mm10.ncbiRefSeq.sorted.gtf.gz"
    },
    "index": {
      "location": {
        "uri": "https://jbrowse.org/demos/bxd/mm10.ncbiRefSeq.sorted.gtf.gz.tbi"
      }
    }
  }
}
```

The painting track is a `FeatureTrack` with a
[`LinearMultiRowFeatureDisplay`](/docs/user_guides/multirow_feature_track). In
[grammar-of-graphics](/docs/config_guides/mark_display) terms, `rows` assigns
one row per `sample` and `encoding.color` is a color scale. For your own panel,
swap `uri` for the bgzipped, tabix-indexed BED your conversion wrote.

```json addtrack loc=chr4
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
      "encoding": {
        "color": {
          "scale": {
            "type": "identity",
            "domain": ["rgb(65,105,225)", "rgb(220,60,50)", "rgb(150,150,150)"],
            "names": ["B (C57BL/6J)", "D (DBA/2J)", "H (heterozygous)"]
          },
          "legend": { "title": "Genotype" }
        }
      }
    }
  ]
}
```

- `scale.type: "identity"` on
  [`encoding.color`](/docs/config/featureencoding/#slot-color) keeps the
  `itemRgb` colors, and its `scale.names` name the genotype each `scale.domain`
  color stands for. The same entries fill the **Categories** toggles in the
  track menu, so hiding `H` isolates the B/D contrast.
- `disableGeneHeuristic: true` stops the BED adapter from reading each block as
  a gene, which the `thickStart`/`thickEnd` columns would otherwise trigger.

## Load the coat-color QTL scan as a Manhattan track

GeneNetwork maps these traits itself, and its API serves the per-marker result
of a GEMMA run. We fetch the scan for one trait by its GeneNetwork id and
reshape it with `jq` into records of a marker, its mm10 position in Mb, a LOD
score (log odds of linkage) and a p-value:

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

The trait id is the number in the GeneNetwork URL, and
[`bxd_phenocovar.csv`](https://github.com/rqtl/qtl2data/tree/master/BXD) in the
qtl2data BXD release lists the ids with their descriptions.

A `GWASTrack` with a `GWASAdapter` reads one column of that file as the
Manhattan score ([GWAS track guide](/docs/config_guides/gwas_track)):

- [`scoreColumn`](/docs/config/gwasadapter/#slot-scorecolumn) names the column.
  The default is a pre-computed `-log10(p)` called `neg_log_pvalue`, so a LOD
  column needs it set.
- [`scoreTransform`](/docs/config/gwasadapter/#slot-scoretransform) stays at its
  default, since a LOD is already on the scale the plot draws. A raw or
  natural-log p-value column would need it.

```json addtrack
{
  "type": "GWASTrack",
  "trackId": "bxd_gwas_coatcolor_mm10",
  "name": "BXD QTL: coat color (GEMMA)",
  "assemblyNames": ["mm10"],
  "adapter": {
    "type": "GWASAdapter",
    "uri": "bxd_gwas_coatcolor.tsv.gz",
    "scoreColumn": "lod"
  },
  "displayDefaults": {
    "encoding": { "y": { "axis": { "title": "LOD" } } }
  }
}
```

## Facet the strains by coat color at Tyrp1

GeneNetwork scores coat color on a four-step scale: black is 4, grey 3, brown 2
and DBA/2's dilute brown 1. We'll fetch each strain's score and turn the four
values into four sections of painting rows, so the rows are ordered by
phenotype.

The scores come from GeneNetwork's sample-data API. `jq` turns them into one
[`rows.groups`](/docs/config/markrows/#slot-groups) entry per score, a regex
matching that score's strains, and a
[`rows.color`](/docs/config/markrows/#slot-color) that pairs each group with its
coat color:

<!-- from: scripts/bxd_build_demo.sh -->

```bash
curl -fsSL https://genenetwork.org/api/v_pre1/sample_data/BXDPublish/11280 -o coat_color_values.json
jq '{ "4": ["black", "rgb(30,30,30)"], "3": ["grey", "rgb(150,150,160)"],
      "2": ["brown", "rgb(130,80,40)"], "1": ["dilute brown", "rgb(210,175,130)"] } as $class
  | [ .[] | select((.sample_name | startswith("BXD")) and (.value | IN(1, 2, 3, 4))) ]
  | group_by(-.value)
  | map($class[.[0].value | floor | tostring] + [map(.sample_name) | join("|")])
  | { groups: map({ match: ("^(" + .[2] + ")$"), group: .[0] }),
      color: { field: "group", scale: { domain: map(.[0]), range: map(.[1]) } } }' \
  coat_color_values.json > coatColor.json
```

Put `groups` and `color` inside the painting's `rows`, and add `facet: "group"`
beside it. This `jq` call prints the keys in the shape the display entry takes,
ready to paste into **Advanced → Edit plot...** in the painting's track menu,
which shows the display's keys as text and applies edits live:

```bash
jq '{ facet: "group", rows: ({ field: "sample" } + .) }' coatColor.json
```

- `rows.groups` tags each strain with its coat color as its `group`.
- `facet: "group"` splits the display into one section per `group`, black at the
  top. The few strains scored between two steps match no entry and form a
  section at the bottom.
- `rows.color` by `group` is a color scale on each row's label bar, showing the
  strain's coat color. The blocks keep their genotype colors, and the unscored
  strains, with no group, get no color.

`https://jbrowse.org/code/jb2/main/test_data/config_bxd.json` holds the whole
track, as `bxd_chromosome_painting_mm10`.

With the coat-color sections in place:

- Filter the RefSeq gene track to _Tyrp1_ with **Filter by...** in its track
  menu (`jexl:feature.name=='Tyrp1'`).
- Open chr4 with the genes, the scan and the painting.

<Figure src="/img/qtl/bxd_tyrp1_locus.png" caption="chr4 with the painting's rows banded by coat color, B in blue and D in red."/>

## Repeat the coat-color facets at the chr9 peak

The chr9 peak falls on _Myo5a_, the dilute locus (its mutation lightens coat
color). Open chr9 with the same grouped painting, and filter the gene track to
_Myo5a_ the same way:

<Figure src="/img/qtl/bxd_myo5a_locus.png" caption="chr9, banded the same way."/>

## Reproduce it end to end

[`bxd_build_demo.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/bxd_build_demo.sh)
runs every step above. It:

- downloads JBrowse and the GeneNetwork consensus genotypes
- builds the painting with
  [`bxd_geno_to_painting_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/bxd_geno_to_painting_bed.py)
- fetches the coat-color scan (trait `11280`) and the per-strain scores from
  GeneNetwork
- writes a `config.json` that opens on mm10 chr4 with the scan over the painting
  banded by coat color, and prints the marker at the peak and its LOD as it goes

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/bxd_build_demo.sh
bash bxd_build_demo.sh            # builds ./bxd_demo/jbrowse2
npx --yes serve bxd_demo/jbrowse2 # then open the printed URL
```

Any GeneNetwork trait id works in place of `11280` for the scan; the coat-color
groups and facets are specific to that trait.

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
