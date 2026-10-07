---
title: Phased trio analysis (1000 Genomes)
sidebar_label: Phased trio (1000 Genomes)
description:
  Paint a child's inherited haplotype blocks from hap-ibd IBD segments, one row
  per parental copy, and read the crossovers off the track
guide_category: Tutorials
tutorial_category: Population genomics
---

hap-ibd identifies which stretches of a phased child's genome came down from the
mother and which from the father. We paint those as one colored row per parental
haplotype, so a meiotic crossover reads as a color change along the row.

## Prerequisites

- a JBrowse to open them in: [Desktop](/docs/quickstart_desktop) takes a local
  file by path, [Web](/docs/quickstart_web) through **Add track**
- the `hg38` assembly set up in JBrowse
  ([assemblies guide](/docs/config_guides/assemblies))
- Java 8+, for hap-ibd
- `python3`
- `node`
- htslib (`bgzip`, `tabix`)

On Debian/Ubuntu, `apt install tabix python3 default-jre` covers most of it;
`node` comes from [nodejs.org](https://nodejs.org/), and `hap-ibd.jar` is a
single download from its
[releases page](https://github.com/browning-lab/hap-ibd/releases).

## Where the data comes from

1000 Genomes Project phased low-coverage calls
([1000 Genomes Project Consortium 2015](https://doi.org/10.1038/nature15393)),
the Kinh-Vietnamese trio HG02024 (child), HG02026 (father) and HG02025 (mother),
chr1 only.

The [build script](#reproduce-it-end-to-end) fetches these files, so there is
nothing to download by hand.

- the phased trio VCF:
  https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz
- the GRCh38 PLINK genetic map hap-ibd needs, the `no_chr_in_chrom_field`
  variant, since the trio VCF calls its chromosome `1` rather than `chr1`:
  https://bochet.gcc.biostat.washington.edu/beagle/genetic_maps/plink.GRCh38.map.zip

## Loading the hg38 assembly

The trio calls are on GRCh38, and the hap-ibd blocks below use its chr1
coordinates, so we load that assembly first.

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

## Loading the trio's phased VCF

A trio is a mother, father, and child sequenced together. A phased VCF tags each
variant with the haplotype it sits on (`0|1` vs `1|0`), so you can follow each
variant to the copy of the genome it came from.

The VCF loads on `hg38` as an ordinary `VariantTrack`
([variant track guide](/docs/config_guides/variant_track)). For your own trio,
swap `uri` for a bgzipped VCF with its `.tbi` beside it and the same chromosome
naming as the assembly. In JBrowse Web you can instead paste the URL into **File
→ Open track...**, which infers the adapter and the index.

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "khv_trio_vcf",
  "name": "KHV trio phased calls (chr1)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz"
  }
}
```

<Figure caption="The VCF on initial load, in the default display: one orange box per variant." src="/img/trio-basic.png"/>

## Showing the trio VCF as a genotype matrix

In the track menu, choose **Display types → Multi-sample variant display** (the
[multi-sample variant display](/docs/user_guides/multivariant_track)), then
check **Show... → Show as genotype matrix**. Each sample becomes a row and each
variant a column, with black lines tying the columns back to their genomic
positions.

<Figure caption="The multi-sample variant display as a genotype matrix. One row per sample, one column per variant, black lines connecting columns to their genome positions." src="/img/trio-matrix.png"/>

## Splitting each sample into two haplotype rows

Choose **Rows → Per haplotype** from the track menu:

- each sample splits into its two haplotypes, so the three trio members become
  six rows
- per-haplotype rows need phased genotypes, written `0|1`; unphased calls
  (`0/1`) need a phasing program such as SHAPEIT first

<Figure caption="One row per haplotype: the two haplotypes (HP0, HP1) of child HG02024, mother HG02025 and father HG02026, top to bottom, under the RefSeq genes, with connector lines tying each matrix column back to the position it came from." src="/img/trio-matrix-phased-clean.png"/>

<Video src="/media/variants/trio_phased_matrix.mp4" caption="The multi-sample matrix display switched on, then Rows → Per haplotype splitting each trio member into its two haplotype rows." />

Each of the child's two haplotypes comes from one parent: along it, the matching
parental copy is one of that parent's two copies for a stretch, then the other.
The rest of the page paints that pattern as a track.

## Running hap-ibd to find segments shared with each parent

[hap-ibd](https://github.com/browning-lab/hap-ibd) computes the matching
stretches as "identical by descent" (IBD) segments. It is built for
population-scale cohorts and also runs on a single trio. It takes a phased VCF
and a genetic map in PLINK format.

The trio VCF calls its chromosome `1`, with no `chr` prefix, so the run uses the
`no_chr_in_chrom_field` variant of the GRCh38 PLINK map:

<!-- from: scripts/build_khv_trio_hapibd.sh -->

```bash
# min-seed: shortest shared stretch (cM) hap-ibd starts a segment from
# min-output: shortest segment (cM) it writes
# both default to 2.0, so 1.0 also reports segments between 1 and 2 cM
java -jar hap-ibd.jar \
  gt=HG02024_VN049_KHVTrio.chr1.vcf.gz \
  map=plink.chr1.GRCh38.map \
  out=trio min-seed=1.0 min-output=1.0
```

The output is `trio.ibd.gz`, one row per shared segment, with columns sample1,
hap1, sample2, hap2, chrom, start, end, cM-length. In a trio every segment pairs
the child with one parent, and the child's two haplotypes split cleanly between
them:

| child haplotype | matches parent   | inherited copy |
| --------------- | ---------------- | -------------- |
| HG02024:1       | HG02026 (father) | paternal       |
| HG02024:2       | HG02025 (mother) | maternal       |

The 1000 Genomes pedigree line `VN049 HG02024 HG02026 HG02025` gives the roles:
father HG02026, mother HG02025. Within one child haplotype, the matching
_parental_ copy flips between the parent's copy 1 and copy 2 at each crossover.

hap-ibd's output has gaps, plus short spurious segments from the statistical
phasing, so the next step merges its segments into clean blocks before painting.

## Converting hap-ibd data into painted inheritance blocks

The painted track has one row per parental haplotype (father copy 1, father copy
2, mother copy 1, mother copy 2), with the child's inherited chromosome split
between each parent's pair of rows. A crossover shows up as a block stepping
from one row to its partner.

[`hapibd_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/hapibd_to_bed.py)
does the cleanup. Per child haplotype it:

- merges adjacent segments of the same parental copy into runs
- drops short interior runs, which are switch errors
- snaps each remaining crossover to the midpoint of the gap between runs so the
  blocks abut; a gap too wide to bridge stays blank

The script writes one BED9 line per block plus a `parenthap` label, and its
`itemRgb` colors the father's two copies blue and the mother's red. It takes
`trio.ibd.gz` and the child, father and mother sample IDs; `bgzip` and
`tabix -p bed` then index the output:

<!-- from: scripts/build_khv_trio_hapibd.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/hapibd_to_bed.py
python3 hapibd_to_bed.py trio.ibd.gz HG02024 HG02026 HG02025 trio.hapibd.bed
jbrowse sort-bed trio.hapibd.bed | bgzip > trio.hapibd.bed.gz
tabix -p bed trio.hapibd.bed.gz
```

[`sort-bed`](/docs/cli#jbrowse-sort-bed) keeps the `#`-header line on top and
sorts the rest under `LC_ALL=C`, so the adapter reads the column names from the
header, needs no `columnNames`, and sees the same order in every locale.

Load `trio.hapibd.bed.gz` as a `FeatureTrack` with a
`LinearMultiRowFeatureDisplay`:

- `rows` draws one row per distinct value of its `field`, so `parenthap` gives
  the four parental-haplotype rows
- `rows.domain` sets their top-to-bottom order
- the display paints each block with its BED `itemRgb`
- [`showLegend`](/docs/config/linearmultirowfeaturedisplay/#slot-showlegend) is
  off, because the row labels already name the four categories

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "khv_trio_hapibd",
  "name": "KHV trio hap-ibd haplotype blocks (chr1)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "disableGeneHeuristic": true,
    "uri": "trio.hapibd.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "rows": {
        "field": "parenthap",
        "domain": ["Father hap1", "Father hap2", "Mother hap1", "Mother hap2"]
      },
      "showLegend": false
    }
  ]
}
```

## Reading crossovers off the painted blocks

The four rows of the painted track are each parent's two copies, blue for father
HG02026 and red for mother HG02025:

<Figure caption="hap-ibd inheritance blocks in the multi-row feature display. Blue rows are father HG02026's two haplotypes, red rows are mother HG02025's. Each crossover is a spot where a painted block steps from one row to its partner." src="/img/trio-hapibd-painting.png"/>

The blue rows together are the child's paternal chromosome. Where one of them is
filled, it is the father's copy the child inherited there, so hap-ibd places a
paternal crossover at each step between the blue rows. The red rows are the
maternal chromosome in the same way.

The control in the figure is that no position has both blue rows filled, or both
red rows, which would mean hap-ibd matched one child haplotype to both of a
parent's copies. That holds along the whole chromosome. A position with neither
row filled, such as the gap all four rows share around the 50M tick, is one
where hap-ibd found no segment long enough to report. The blocks run straight
through the centromere, because hap-ibd joins the markers on either side of it.

## Comparing the painted blocks with the raw genotypes

To line the painted blocks up with the genotypes underneath:

- Drag the painting's track label above the VCF's.
- Uncheck **Show... → Show as genotype matrix** on the VCF track, so the
  **phased multi-sample variant display** draws each genotype at its genomic
  position.
- To show one parent's two rows only, as the figures below do, set the
  painting's `rows.kept` to those names, for example
  `["Father hap1", "Father hap2"]`.
- To name the VCF's rows after the painting's rows, set the variant display's
  `rows.labels` to
  `{ "HG02024 HP0": "Child hap1", "HG02024 HP1": "Child hap2", "HG02025 HP0": "Mother hap1", "HG02025 HP1": "Mother hap2", "HG02026 HP0": "Father hap1", "HG02026 HP1": "Father hap2" }`,
  or rename the rows in **Edit colors/arrangement...** in its track menu.

Zoom to a few hundred kb around one boundary, where the block-step is obvious
and the genotype columns resolve into individual variants. Start with the
paternal crossover near chr1:29.7 Mb:

<Figure caption="A paternal crossover. The painting steps from Father hap2 to Father hap1, and the tinted frames mark that switch in the raw genotypes." src="/img/trio-crossover-paternal.png"/>

Near chr1:55.8 Mb the child's maternal haplotype steps between the mother's two
copies:

<Figure caption="A maternal crossover. The painting steps from Mother hap2 to Mother hap1, and the frames tie Child hap2 to each in turn." src="/img/trio-crossover-maternal.png"/>

The 1000 Genomes VCF is _statistically_ phased, so the genotypes underneath
switch between the two parental copies more often than real crossovers do. The
painting summarises those switch errors away, because hap-ibd's cM-length
threshold filters most of them out. The two crossovers above are well supported,
and the finer blocks are approximate. For crossover mapping, use a
pedigree-aware method such as
[duoHMM](https://mathgen.stats.ox.ac.uk/genetics_software/duohmm/duohmm.html).

## Reproduce it end to end

[`build_khv_trio_hapibd.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_khv_trio_hapibd.sh)
runs the whole pipeline. It downloads the trio VCF, hap-ibd and the genetic map,
runs hap-ibd, paints the BED with
[`hapibd_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/hapibd_to_bed.py),
downloads JBrowse, and writes `khv_trio_build/jbrowse2` with a `config.json`
holding the hg38 assembly plus the VCF and hap-ibd tracks. It needs the tools in
[Prerequisites](#prerequisites). Serve the folder and open the URL `serve`
prints:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_khv_trio_hapibd.sh
bash build_khv_trio_hapibd.sh
npx --yes serve khv_trio_build/jbrowse2
```

In JBrowse Desktop, **File → Session → Open config.json or .jbrowse file...**
opens `khv_trio_build/jbrowse2/config.json` directly.

## See also

- [](/docs/tutorials/local_ancestry)
- [](/docs/tutorials/bxd_qtl)
- [](/docs/tutorials/sv_multisamples)
- [](/docs/tutorials/ld_human)
- [](/docs/user_guides/multirow_feature_track)
- [](/docs/user_guides/multivariant_track)
- [](/docs/config_guides/variant_track)

## Citations

- 1000 Genomes Project Consortium (2015).
  [A global reference for human genetic variation](https://doi.org/10.1038/nature15393)
- Zhou et al. (2020).
  [A fast and simple method for detecting identity-by-descent segments in large-scale data](https://doi.org/10.1016/j.ajhg.2020.02.010),
  hap-ibd
- O'Connell et al. (2014).
  [A general approach for haplotype phasing across the full spectrum of relatedness](https://doi.org/10.1371/journal.pgen.1004234),
  duoHMM
