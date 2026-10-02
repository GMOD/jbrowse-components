---
title: QTL mapping (BXD mice)
sidebar_label: QTL mapping (BXD)
description:
  Chromosome-painting and a QTL Manhattan plot from GeneNetwork BXD data
guide_category: Tutorials
tutorial_category: Population genomics
---

The BXD mice are inbred strains bred down from two parents, B6 and DBA/2, so
each strain has a mosaic of blocks from one or the other. We paint each strain
by which parent gave it each block and stack that under a GeneNetwork QTL scan
of coat color, then band the strains by their coat color to see which blocks
under each peak set it.

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
- the coat-color scores per strain, from GeneNetwork's sample-data API:
  https://genenetwork.org/api/v_pre1/sample_data/BXDPublish/11280
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

The painting skips the F1 columns, since an F1 is heterozygous at every marker
and GeneNetwork computes the scan over the strains.

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

Both tracks on this page use the `mm10` assembly, whose chromosome names the
marker positions follow:

```json addassembly
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

The painting track is a `FeatureTrack` with a `LinearMultiRowFeatureDisplay`
that splits rows on the `sample` column and colors each block from the `itemRgb`
field. For your own panel, swap `uri` for the bgzipped, tabix-indexed BED your
conversion wrote.

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
Each record has a marker, its mm10 position in Mb, a LOD score and a p-value:

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
  "name": "BXD QTL: coat color (GEMMA)",
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

The scan puts a plateau of tied markers on chr4, whose interval contains
_Tyrp1_, the brown locus. A second, lower peak sits on chr9. Stacked over the
painting, a peak marks a column, and the question is whether the strains' coat
colors line up with their genotype there.

## Grouping the strains by coat color

GeneNetwork scores coat color on a four-step scale: black is 4, grey 3, brown 2
and DBA/2's dilute brown 1. We'll fetch each strain's score and turn the four
values into four bands of painting rows, so the phenotype orders the rows and
the genotype stays free to agree with it or not.

The scores come from GeneNetwork's sample-data API, and `jq` writes one
[`rowGroups`](/docs/config/linearmultirowfeaturedisplay/#slot-rowgroups) entry
per score, a regex matching that score's strains:

<!-- from: scripts/bxd_build_demo.sh -->

```bash
curl -fsSL https://genenetwork.org/api/v_pre1/sample_data/BXDPublish/11280 -o coat_color_values.json
jq '{ "4": ["black", "rgb(30,30,30)"], "3": ["grey", "rgb(150,150,160)"],
      "2": ["brown", "rgb(130,80,40)"], "1": ["dilute brown", "rgb(210,175,130)"] } as $class
  | [ .[] | select((.sample_name | startswith("BXD")) and (.value | IN(1, 2, 3, 4))) ]
  | group_by(-.value)
  | map($class[.[0].value | floor | tostring] as [$group, $color]
        | { match: ("^(" + (map(.sample_name) | join("|")) + ")$"), group: $group, color: $color })' \
  coat_color_values.json > rowGroups.json
```

Add the result to the painting's display entry, beside `rows` and `color`,
together with `facet: "group"`:

- `rowGroups` tags each strain with its coat color and tints its sidebar swatch
  in that color. The blocks keep their genotype colors.
- `facet: "group"` stacks the four groups in labelled bands, black at the top.
  The few strains scored between two steps match no entry and sit in a band of
  their own at the bottom.

```json
{
  "rowGroups": [
    {
      "match": "^(BXD100|BXD105|BXD109|BXD11|BXD110|BXD116|BXD119|BXD120|BXD121|BXD123|BXD124|BXD125|BXD128a|BXD131|BXD133|BXD136|BXD14|BXD142|BXD145|BXD148|BXD149|BXD151|BXD152|BXD153|BXD154|BXD156|BXD165|BXD171|BXD173|BXD186|BXD190|BXD191|BXD199|BXD2|BXD20|BXD204|BXD207|BXD210|BXD217|BXD218|BXD219|BXD23|BXD31|BXD32|BXD34|BXD35|BXD42|BXD43|BXD48|BXD48a|BXD50|BXD51|BXD56|BXD86|BXD87)$",
      "group": "black",
      "color": "rgb(30,30,30)"
    },
    {
      "match": "^(BXD101|BXD117|BXD12|BXD122|BXD130|BXD135|BXD139|BXD141|BXD144|BXD146|BXD147|BXD155|BXD157|BXD16|BXD162|BXD169|BXD172|BXD174|BXD175|BXD176|BXD178|BXD18|BXD180|BXD181|BXD183|BXD184|BXD19|BXD198|BXD202|BXD205|BXD208|BXD211|BXD212|BXD215|BXD22|BXD29|BXD33|BXD38|BXD39|BXD40|BXD49|BXD5|BXD6|BXD76|BXD79|BXD8|BXD94)$",
      "group": "grey",
      "color": "rgb(150,150,160)"
    },
    {
      "match": "^(BXD102|BXD104|BXD106|BXD108|BXD111|BXD114|BXD115|BXD126|BXD127|BXD128|BXD13|BXD132|BXD134|BXD15|BXD150|BXD177|BXD192|BXD193|BXD194|BXD195|BXD196|BXD197|BXD200|BXD203|BXD209|BXD24|BXD24a|BXD25|BXD27|BXD28|BXD36|BXD52|BXD53|BXD55|BXD59|BXD60|BXD62|BXD65|BXD65a|BXD66|BXD68|BXD72|BXD74|BXD78|BXD88)$",
      "group": "brown",
      "color": "rgb(130,80,40)"
    },
    {
      "match": "^(BXD1|BXD107|BXD112|BXD113|BXD138|BXD160|BXD161|BXD168|BXD170|BXD187|BXD188|BXD189|BXD201|BXD206|BXD21|BXD216|BXD220|BXD30|BXD44|BXD45|BXD61|BXD63|BXD64|BXD65b|BXD67|BXD69|BXD70|BXD71|BXD73|BXD73a|BXD73b|BXD75|BXD77|BXD81|BXD83|BXD84|BXD85|BXD89|BXD9|BXD90|BXD91|BXD93|BXD95|BXD98|BXD99)$",
      "group": "dilute brown",
      "color": "rgb(210,175,130)"
    }
  ],
  "facet": "group"
}
```

Open chr4 with the gene track filtered to _Tyrp1_ (**Filter by...** in its track
menu, `jexl:get(feature,'name')=='Tyrp1'`), the scan and the grouped painting:

<Figure src="/img/qtl/bxd_tyrp1_locus.png" caption="The whole of chr4, with the painting's rows banded by coat color. Under the peak at Tyrp1 the black and grey bands are solid B (blue) and both brown bands solid D (red). Away from the peak every band is a mix of the two."/>

The bands come from the phenotype alone, so the solid column under the peak is
the finding: black and grey strains inherited B6's copy of _Tyrp1_, brown and
dilute brown strains DBA/2's. The rest of chr4 is the control, where the bands
mix B and D blocks because nothing there sets coat color.

## The second peak: dilute on chr9

The chr9 peak falls on _Myo5a_, the dilute locus. The same grouped painting,
with the gene track filtered to _Myo5a_, splits the bands the other way:

<Figure src="/img/qtl/bxd_myo5a_locus.png" caption="The whole of chr9, same bands. Under the peak at Myo5a the black and brown bands are B and the grey and dilute brown bands D, while the rest of chr9 is mixed."/>

So the four-step scale is two genes. _Tyrp1_ sets black against brown and
_Myo5a_ sets full color against dilute, and grey is a black coat diluted. The
scale puts the brown step at twice the dilute step, which is why the chr4 peak
stands higher than the chr9 one.

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
painting, fetches the coat-color scan (trait `11280`) and the per-strain scores
from GeneNetwork, and writes a `config.json` that opens on mm10 chr4 with the
scan over the painting banded by coat color. It prints the marker at the peak
and its LOD as it goes.

You can swap in any GeneNetwork trait id. Coat color is close to Mendelian here,
and a polygenic trait scans flatter, with no peak sharp enough to band the
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
