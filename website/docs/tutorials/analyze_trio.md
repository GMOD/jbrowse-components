---
title: Phased trio analysis
description: Examine inheritance patterns and variant phasing in a trio dataset
guide_category: Tutorials
tutorial_category: Population genomics
---

A trio is a mother, father, and child sequenced together. A phased VCF tags each
variant with the haplotype it sits on (`0|1` vs `1|0`), so you can follow which
copy of the genome it came from.

We'll use a pre-built phased VCF from the 1000 Genomes Project, the
Kinh-Vietnamese trio HG02024, chr1 only:

- [VCF](https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz)
- [Index (.tbi)](https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz.tbi)

Everything here is on `hg38`, so set that assembly up first if you haven't (see
the [assemblies guide](/docs/config_guides/assemblies)). Then add the VCF with
`jbrowse add-track` or the in-app "Add track" workflow. The
[variant track guide](/docs/config_guides/variant_track) covers both. You'll get
this:

<Figure caption="The VCF on initial load, in the default display: one orange box per variant." src="/img/trio-basic.png"/>

## Enabling the matrix view

Switch the track to the
[Multi-sample variant display (matrix)](/docs/user_guides/multivariant_track).
Each sample becomes a row and each variant a column, with black lines tying the
columns back to their genomic positions.

<Figure caption="Multi-sample variant display (matrix). One row per sample, one column per variant, black lines connecting columns to their genome positions." src="/img/trio-matrix.png"/>

## Enabling the phased mode

The matrix has a "phased" rendering mode under the track menu's "Rendering
mode". It splits each sample into its two haplotypes, so the three trio members
become six rows. You need genotypes written with the `0|1` separator rather than
`0/1`. Getting there from unphased calls takes a phasing program like SHAPEIT.

<Figure caption="The phased rendering mode, and the 'Rendering mode' → 'Phased' menu item that turns it on." src="/img/trio-matrix-phased.png"/>

## Reading matching haplotypes off the matrix

Every row is now a strip of colored blocks, and matching stretches between rows
jump out: the child's two haplotypes match the mother's in some blocks and the
father's in others. The rest of this tutorial turns that by-eye pattern into a
painted track.

<Figure caption="The phased mode with no markup added. Rows are child hap1/hap2, mother hap1/hap2, father hap1/hap2, top to bottom. Several stretches where rows match each other are visible by eye." src="/img/trio-matrix-phased-clean.png"/>

## Finding the matching blocks programmatically

You can compute that matching instead of eyeballing it.
[hap-ibd](https://github.com/browning-lab/hap-ibd) finds "identical by descent"
blocks. It's built for population-scale cohorts but works fine on a single trio
VCF. It needs two things:

- a phased VCF, like the
  [trio dataset](https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz)
  above
- a genetic map in PLINK format (hap-ibd's README links GRCh38 ones)

Grab `hap-ibd.jar` from the
[releases page](https://github.com/browning-lab/hap-ibd/releases) along with
those maps. It needs Java 8+, as does FLARE later on.

## Running hap-ibd

The trio VCF calls its chromosome `1`, with no `chr` prefix, so reach for the
`no_chr_in_chrom_field` variant of the GRCh38 PLINK map:

```bash
java -jar hap-ibd.jar \
  gt=HG02024_VN049_KHVTrio.chr1.vcf.gz \
  map=plink.chr1.GRCh38.map \
  out=trio min-seed=1.0 min-output=1.0
```

You get `trio.ibd.gz`, one row per shared segment, with columns sample1, hap1,
sample2, hap2, chrom, start, end, cM-length. In a trio every segment pairs the
child with one parent, and the child's two haplotypes split cleanly between
them:

| child haplotype | matches parent   | inherited copy |
| --------------- | ---------------- | -------------- |
| HG02024:1       | HG02026 (father) | paternal       |
| HG02024:2       | HG02025 (mother) | maternal       |

(The roles come from the 1000 Genomes pedigree line
`VN049 HG02024 HG02026 HG02025`: father HG02026, mother HG02025.) Within one
child haplotype, the matching _parental_ copy flips between the parent's copy 1
and copy 2 at each crossover. Those flips are what we're after.

Don't paint the raw segments, though. hap-ibd's output has gaps, plus short
spurious segments from the statistical phasing, so collapse it into clean blocks
first.

## Converting hap-ibd data into painted inheritance blocks

The goal is one row per parental haplotype (father copy 1, father copy 2, mother
copy 1, mother copy 2), with the child's inherited chromosome tiled across each
parent's pair of rows. A crossover then shows up as a block stepping from one
row to its partner.

[`hapibd_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/hapibd_to_bed.py)
does the cleanup. Per child haplotype it:

- merges adjacent segments of the same parental copy into runs,
- drops short interior runs (the switch-error specks), and
- snaps each remaining crossover to the midpoint of the gap between runs so the
  blocks abut (real gaps, like the centromere, stay blank).

Out comes one BED9 line per block plus a `parenthap` label, with the father's
two copies in blues and the mother's in reds via `itemRgb`. Feed it
`trio.ibd.gz` plus the child, father, and mother sample IDs, then `bgzip` and
`tabix -p bed` so the `BedTabixAdapter` can read it:

```bash
python3 scripts/hapibd_to_bed.py trio.ibd.gz HG02024 HG02026 HG02025 trio.hapibd.bed
sort -k1,1 -k2,2n trio.hapibd.bed | bgzip > trio.hapibd.bed.gz
tabix -p bed trio.hapibd.bed.gz
```

Don't want to run any of this? Every figure below has an "Open this view in
JBrowse ↗" link that loads the finished track live.

Load the result as a `FeatureTrack` using a `LinearMultiRowFeatureDisplay`. That
display draws one row per distinct value of `partitionField`, so pointing it at
`parenthap` gives you the four parental-haplotype rows, and `rowOrder` sets
their top-to-bottom order. There's no color config: a BED carrying `itemRgb` is
painted with it automatically. Drop this into the `tracks` array of your
`config.json`, or paste it into the add-track JSON editor in the app:

```json
{
  "type": "FeatureTrack",
  "trackId": "khv_trio_hapibd",
  "name": "KHV trio hap-ibd haplotype blocks (chr1)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "disableGeneHeuristic": true,
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
      "parenthap"
    ],
    "bedGzLocation": { "uri": "trio.hapibd.bed.gz" },
    "index": { "location": { "uri": "trio.hapibd.bed.gz.tbi" } }
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "khv_trio_hapibd-LinearMultiRowFeatureDisplay",
      "partitionField": "parenthap",
      "rowOrder": ["Father hap1", "Father hap2", "Mother hap1", "Mother hap2"]
    }
  ]
}
```

## Reading the painted crossovers

No manual markup this time. The painting comes straight from the data. The four
rows are each parent's two copies, blues for father HG02026 and reds for mother
HG02025:

<Figure caption="hap-ibd inheritance blocks in the multi-row feature display. Blue rows are father HG02026's two haplotypes, red rows are mother HG02025's. Each crossover is a spot where a painted block steps from one row to its partner." src="/img/trio-hapibd-painting.png"/>

Read the two blue rows together as the child's paternal chromosome: exactly one
of them is filled at any position, and that tells you which of the father's two
copies the child got there. Every step between the blue rows is a crossover. The
red rows work the same way for the maternal chromosome.

## Coloring an admixed trio by ancestry

The same display can paint rows by inferred ancestry instead of parental copy.
That only shows structure for an admixed individual, so let's switch to a 1000
Genomes African-American (ASW) trio: child NA19828, parents NA19818 and NA19819.

[FLARE](https://github.com/browning-lab/flare) infers per-haplotype local
ancestry by comparing each target haplotype to labeled reference samples. It
wants the phased trio genotypes (`gt`), phased reference genotypes (`ref`)
tagged `AFR` or `EUR` in the `ref-panel` map, and a genetic map. This command is
just illustrative. The script below builds all of it for you:

```bash
java -jar flare.jar \
  ref=ref.vcf.gz ref-panel=ref_panel_map.txt gt=trio.vcf.gz \
  map=plink.chr1.GRCh38.map out=asw_trio seed=42
```

FLARE writes per-marker calls into the `AN1`/`AN2` `FORMAT` fields of
`asw_trio.anc.vcf.gz`, which get collapsed into per-haplotype runs, one BED9
line each, rows labeled `Child/Mother/Father hap1|hap2`, colored by ancestry via
`itemRgb`. Picking the reference panel, pulling genotypes from the public 1000
Genomes phased panel, running FLARE, and writing the BED all live in one script:
[`build_asw_trio_ancestry.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_asw_trio_ancestry.sh).

Load that as a `LinearMultiRowFeatureDisplay` partitioned by `sample`, so each
haplotype gets a row:

```json
{
  "type": "FeatureTrack",
  "trackId": "asw_trio_ancestry",
  "name": "African-American (ASW) trio local ancestry (FLARE, chr1)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "disableGeneHeuristic": true,
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
      "sample",
      "ancestry"
    ],
    "bedGzLocation": { "uri": "NA19828_ASW_trio.chr1.ancestry.bed.gz" },
    "index": { "location": { "uri": "NA19828_ASW_trio.chr1.ancestry.bed.gz.tbi" } }
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "asw_trio_ancestry-LinearMultiRowFeatureDisplay",
      "partitionField": "sample",
      "rowOrder": [
        "Child hap1",
        "Child hap2",
        "Mother hap1",
        "Mother hap2",
        "Father hap1",
        "Father hap2"
      ]
    }
  ]
}
```

Each of the six rows is one haplotype, painted African (orange) or European
(blue) block by block. Note that nothing changed but `partitionField` (`sample`
instead of `parenthap`), and the same display gives six rows instead of four.
The row structure comes entirely from the BED column you point it at.

<Figure caption="FLARE local-ancestry calls for a 1000 Genomes ASW trio on chr1, in the multi-row feature display. Six rows, one per haplotype (child, mother, father), colored African (orange) or European (blue)." src="/img/trio-ancestry.png"/>

## Relating the painting back to the genotypes

Stack the painting directly above the same VCF in the **phased multi-sample
variant display** and you can see where the blocks came from. That display draws
genotypes at their real genomic positions. Use it rather than _matrix_ mode,
whose evenly-spaced columns won't line up with the painting. Its six rows are
the two haplotypes of each trio member, and the painting above is just a summary
of which parental haplotype the child matches where.

Zoomed out to the whole chromosome the genotype rows are a solid block of color,
so there's nothing to see. Zoom to a few hundred kb around one boundary instead,
where the block-step is obvious and the genotype columns resolve into individual
variants. Start with the paternal crossover near chr1:29.7 Mb:

<Figure caption="Paternal crossover near chr1:29.7 Mb (~400 kb wide). Up top the painting steps from Father hap2 (light blue) to Father hap1 (dark blue), and an arrow drops to the same breakpoint in the genotypes. The tinted frames read that switch off the raw genotypes: yellow ties Child hap1 to Father hap2 on the left, purple ties it to Father hap1 on the right, and the two abut at the breakpoint." src="/img/trio-crossover-paternal.png"/>

The maternal chromosome does the same thing at its own boundaries. Near
chr1:55.8 Mb the child's maternal haplotype steps between the mother's two
copies:

<Figure caption="Maternal crossover near chr1:55.8 Mb (~400 kb wide). Same idea in a different palette: the painting steps from Mother hap2 (pink) to Mother hap1 (red), the green frame ties Child hap2 to Mother hap2 on the left, orange ties it to Mother hap1 on the right." src="/img/trio-crossover-maternal.png"/>

The painting is the clean summary. The genotypes underneath switch between the
two parental copies far more often than real crossovers do, so the painted
block-step above is easier to trust than the raw genotypes below it.

## A caveat on the input data

This 1000 Genomes VCF is _statistically_ phased, so its haplotypes carry switch
errors: the extra copy-switches in the genotype rows. hap-ibd's cM-length
threshold filters most of them out, so its blocks track the real boundaries more
closely, but treat the finer ones as approximate. The two crossovers above are
the well-supported ones.

## Reproduce it end to end

[`build_khv_trio_hapibd.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_khv_trio_hapibd.sh)
runs the whole pipeline in one shot. It downloads the trio VCF, hap-ibd, and the
genetic map, runs hap-ibd, builds the painted BED, downloads JBrowse, and writes
a `config.json` with the hg38 assembly plus the VCF and hap-ibd tracks.

```bash
bash scripts/build_khv_trio_hapibd.sh
```

It needs java, python3, node, and htslib (`bgzip` and `tabix`). Serve the
resulting `jbrowse2/` directory to open the finished view.

## See also

- [Multi-sample SVs (1000 Genomes)](/docs/tutorials/sv_multisamples) -
  structural variant analysis with the 1000 Genomes dataset: multi-sample
  genotypes, trio inheritance of SVs, and a large chromosomal inversion.
- [Multi-sample variant display](/docs/user_guides/multivariant_track) - the
  matrix/phased display this tutorial builds on.
- [Variant track config](/docs/config_guides/variant_track) - loading the phased
  VCF used throughout.
