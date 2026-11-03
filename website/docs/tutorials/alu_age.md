---
title: A grammar of graphics over a BED (RepeatMasker Alu age)
sidebar_label: Marks over a BED (Alu age)
description:
  Declare a BED column as the height of a bar and another as its color, count
  features per bin zoomed out, and count a whole chromosome into a bigWig
guide_category: Tutorials
tutorial_category: Grammar of graphics
---

RepeatMasker annotates Alu, a primate-specific repeat family, and its `milliDiv`
column records each copy's divergence from its subfamily consensus, in tenths of
a percent. Divergence grows with time, so the column is an age, and the
subfamily name (AluJ, AluS, AluY, oldest to youngest) is a coarser one. We ask
where along chromosome 1 the young copies sit. We:

- load the Alu rows of a RepeatMasker BED as a `LinearMarkDisplay`, one bar per
  copy with `milliDiv` as its height and its lineage as its color
- bin and count the copies per window when zoomed out, with AluY's count over
  the total
- count copies per kilobase over a whole chromosome into a bigWig with
  `jbrowse make-density`
- plot the AluY share per megabase as a two-color bar track under that density

`LinearMarkDisplay` turns the columns of a feature file into plots from a JSON
`marks` list. It is experimental, and its config shape may change.

## Prerequisites

- a JBrowse to open the figures' sessions in ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- htslib (`bgzip`, `tabix`)
- [Node.js](https://nodejs.org/) and the [JBrowse CLI](/docs/cli), for
  `jbrowse make-density`
- `python3`, standard library only, for the per-megabase counts
- `bedGraphToBigWig` from the
  [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/), which
  `make-density` runs

<!-- BEGIN GENERATED TUTORIAL_INSTALL htslib,node,jbrowse-cli,bedGraphToBigWig -->

```bash
# Debian/Ubuntu
sudo apt install tabix nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge htslib nodejs ucsc-bedgraphtobigwig
# or Linux x86_64 binaries for the tools apt lacks
wget -P ~/.local/bin \
  https://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/bedGraphToBigWig
chmod +x ~/.local/bin/bedGraphToBigWig
# any platform
npm install -g @jbrowse/cli@next
```

<!-- END GENERATED TUTORIAL_INSTALL htslib,node,jbrowse-cli,bedGraphToBigWig -->

## The data

UCSC's hg38 RepeatMasker table, rehosted by
[genomes.jbrowse.org's hg38](https://genomes.jbrowse.org/ucsc/hg38/) with the
Alu rows cut out.

You don't need these files to follow the page: the track configs below read the
hosted results. The [build script](#reproduce-it-end-to-end) fetches them to
rebuild those results. Your own RepeatMasker BED and genome FASTA go through the
same steps: the build script takes them as arguments.

| What it is                                                    | File                                                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| RepeatMasker, UCSC's `rmsk` table as BED with a column header | [rmsk.bed.gz](https://jbrowse.org/ucsc/hg38/rmsk.bed.gz)                                     |
| Reference lengths, for the bigWig header                      | [hg38.chrom.sizes](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chrom.sizes) |

## Plotting each Alu copy's divergence at one locus

We'll load hg38, the assembly the RepeatMasker coordinates are on.

```json addassembly
{
  "name": "hg38",
  "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
  "refNameAliases": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"
  },
  "cytobands": "https://jbrowse.org/genomes/GRCh38/cytoBand.txt"
}
```

The track reads one family's rows of a RepeatMasker BED. For a genome of your
own, RepeatMasker's `.out` writes class and family as one `class/family` field,
and splitting it under a header that names the columns gives a BED of the same
shape:

<!-- from: scripts/build_repeatmasker_classes.sh -->

```bash
# the header names the columns, so a track or an awk filter can name repFamily
{
  printf '#genoName\tgenoStart\tgenoEnd\tname\tstrand\trepFamily\trepClass\tswScore\tmilliDiv\n'
  awk 'BEGIN { OFS = "\t" }
    # a data row is the one starting with a bare integer, its SW score
    $1 ~ /^[0-9]+$/ {
      # "LINE/L1" splits; "Simple_repeat" does not, and UCSC repeats the class
      # as the family for exactly those rows. Positions are 1-based inclusive
      # and the strand column spells minus "C".
      n = split($11, cf, "/")
      print $5, $6 - 1, $7, $10, ($9 == "C") ? "-" : "+", (n > 1) ? cf[2] : cf[1], cf[1], $1, int($2 * 10 + 0.5)
    }' repeats.out
} > rmsk.bed

# `sort-bed` is `sort -k1,1 -k2,2n` under LC_ALL=C, header kept on top
jbrowse sort-bed rmsk.bed | bgzip > rmsk.bed.gz
tabix -f -C -p bed rmsk.bed.gz
```

An `awk` filter on the `repFamily` column keeps the header line and the sort
order, so `tabix` indexes the cut file as it is:

<!-- from: scripts/build_alu_age.sh -->

```bash
# the header line names the columns, repFamily the sixth
gzip -dc rmsk.bed.gz | awk -F'\t' -v fam=Alu '/^#/ || $6 == fam' | bgzip > Alu.bed.gz
tabix -f -C -p bed Alu.bed.gz
```

The track reads any BED-like file, bgzipped and CSI-indexed, with a `#` header
line naming the columns, and a mark refers to a column by name. In
[grammar-of-graphics](/docs/config_guides/mark_display) terms, `encoding` maps
columns to a mark's channels, and `color` is a color scale from a `field`
through `scale.domain` to `scale.range`. The track below lists three marks:

- **Per-copy bars** (below `maxBpPerPx`): a `bar` per copy with `milliDiv` as
  the height. A `formula` step writes the first four characters of the name into
  `lineage`, and the ordinal `scale.domain` fixes the legend order
- **Copies per bin** (past `minBpPerPx`): every Alu copy counted per bin, in
  grey
- **AluY per bin**: the same count behind a `filter` for AluY, in red

```json addtrack loc=chr1:151,000,000-151,030,000
{
  "type": "FeatureTrack",
  "trackId": "alu_age",
  "name": "Alu copies",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.gz",
    "csi": true
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "marks": [
        {
          "mark": "bar",
          "transform": [
            {
              "type": "formula",
              "expr": "jexl:substring(feature.name, 0, 4)",
              "as": "lineage"
            }
          ],
          "encoding": {
            "y": "milliDiv",
            "color": {
              "field": "lineage",
              "scale": {
                "type": "ordinal",
                "domain": ["AluJ", "AluS", "AluY", "FLAM", "FRAM"],
                "range": ["#4575b4", "#fdae61", "#d73027", "#8c8c8c", "#8c8c8c"]
              },
              "legend": { "title": "Alu lineage" }
            }
          },
          "maxBpPerPx": 100
        },
        {
          "mark": "bar",
          "transform": [
            { "type": "bin", "step": "auto" },
            {
              "type": "aggregate",
              "groupby": ["start", "end"],
              "ops": [{ "op": "count" }]
            }
          ],
          "encoding": { "color": { "value": "#c0c0c0" } },
          "minBpPerPx": 100
        },
        {
          "mark": "bar",
          "transform": [
            {
              "type": "filter",
              "expr": "jexl:startsWith(feature.name, 'AluY')"
            },
            { "type": "bin", "step": "auto" },
            {
              "type": "aggregate",
              "groupby": ["start", "end"],
              "ops": [{ "op": "count" }]
            }
          ],
          "encoding": { "color": { "value": "#d73027" } },
          "minBpPerPx": 100
        }
      ]
    }
  ]
}
```

Open `chr1:151,000,000-151,030,000`, 30 kb of 1q21, and click a bar to open its
row of the BED.

<Figure src="/img/alu_age/locus.png" caption="Alu copies over 1q21: bar height is divergence from consensus, color is lineage." />

## Counting Alu copies per bin when zoomed out {#zooming-out}

Zoomed out past `minBpPerPx`, the track switches to the two binned marks. On a
whole chromosome it exceeds its fetch budget and shows a "region too large"
message, so a bigWig of copies per kilobase, counted once from the BED, covers
that width:

<!-- from: scripts/build_alu_age.sh -->

```bash
# writes Alu.bed.density.bw beside the input, in 1 kb bins
# --chrom-sizes takes a two-column name and length table;
#   --assembly genome.fa reads the lengths off the FASTA's .fai instead
jbrowse make-density Alu.bed.gz --chrom-sizes hg38.chrom.sizes
```

Add the bigWig as a track:

```json addtrack loc=chr1
{
  "trackId": "alu_per_kb",
  "name": "Alu copies per kb",
  "assemblyNames": ["hg38"],
  "uri": "https://jbrowse.org/demos/gene_density/Alu.bed.density.bw",
  "displayDefaults": { "mark": { "extent": "none" } }
}
```

## AluY share per megabase, against the genome-wide share

The red AluY count is too small to read against a total that varies between
bins. A script instead writes a BED with two log2 columns: the AluY share per
megabase against the genome-wide share, and the plus-strand share against one
half as a control that should show no pattern.

Fetch the script:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/alu_young_share.py
```

<!-- from: scripts/build_alu_age.sh -->

```bash
# columns: copies, young, plus, youngShare, youngLog2, strandLog2, one row per
# 1 Mb bin holding at least 50 copies; also prints the Spearman rank correlation
# of each share against copies per bin
python3 alu_young_share.py Alu.bed.gz Alu.young_share.bed AluY
bgzip -f Alu.young_share.bed
tabix -f -C -p bed Alu.young_share.bed.gz
```

**Advanced → Edit plot...** in the track menu applies edits to the cut, colors
and key names live. The config below sets them in the track:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "alu_young_share",
  "name": "AluY share per Mb, against the genome",
  "uri": "https://jbrowse.org/code/jb2/main/test_data/alu_age/Alu.young_share.bed.gz",
  "csi": true,
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "encoding": {
        "y": {
          "scale": { "domainMin": -1.5, "domainMax": 1.5 },
          "axis": { "title": "AluY share, log2" }
        }
      },
      "marks": [
        {
          "mark": "bar",
          "encoding": {
            "y": "youngLog2",
            "color": {
              "field": "youngLog2",
              "scale": {
                "type": "threshold",
                "domain": [0],
                "range": ["#4575b4", "#d73027"],
                "names": ["below the genome-wide share", "above it"]
              },
              "legend": { "title": "AluY share" }
            }
          }
        }
      ]
    }
  ]
}
```

<Figure src="/img/alu_age/young_share.png" caption="Top: chromosome 1, Alu copies per kilobase above the AluY share per megabase. Below: the copies track over the same AluY share, copies per bin in grey and AluY in red." links="Chromosome 1=alu_age/chromosome,The stretch under the wedge=alu_age/binned" />

## Reproduce it end to end

[`build_alu_age.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_alu_age.sh)
runs every step above. It:

1. fetches UCSC's hg38 RepeatMasker table and the reference lengths, or copies
   your own RepeatMasker BED and FASTA
2. cuts out the Alu rows and indexes them
3. counts the copies per kilobase into a bigWig, and per megabase into the AluY
   share BED
4. writes a JBrowse with the copies, the bigWig and the share as tracks

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_alu_age.sh
bash build_alu_age.sh                     # builds ./alu_age_build/jbrowse2
npx --yes serve alu_age_build/jbrowse2    # then open the printed URL
```

By default the script builds the tracks over UCSC's table.
`bash build_alu_age.sh rmsk.bed.gz genome.fa` uses your own RepeatMasker BED,
and `FAMILY` and `YOUNG` pick another family and its youngest lineage.

## See also

- [](/docs/config_guides/mark_display)
- [](/docs/tutorials/gene_density)
- [](/docs/tutorials/repeatmasker_classes)
- [](/docs/tutorials/read_marks)
- [](/docs/quickstart_web)

## Citations

- Batzer and Deininger (2002).
  [Alu repeats and human genomic diversity](https://doi.org/10.1038/nrg798), the
  subfamily lineages and their ages.
- Lander et al. (2001).
  [Initial sequencing and analysis of the human genome](https://doi.org/10.1038/35057062),
  where the distribution of young against old Alu copies along the genome was
  first described.
- Smit, Hubley and Green (2013-2015).
  [RepeatMasker Open-4.0](https://www.repeatmasker.org)
