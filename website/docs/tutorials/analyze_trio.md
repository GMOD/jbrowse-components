---
title: Phased trio analysis (1000 Genomes)
sidebar_label: Phased trio (1000 Genomes)
description:
  Paint a child's inherited haplotype blocks from hap-ibd IBD segments, one row
  per parental copy, and read the crossovers off the track
guide_category: Tutorials
tutorial_category: Population genomics
data: pipeline
---

**TL;DR:** hap-ibd tells which stretches of a phased child's genome came down
from the mother and which from the father. We paint those as one colored row per
parental haplotype, so a meiotic crossover reads as a color change along the
row.

## Prerequisites

- nothing to read along. Everything below is for building the tracks yourself
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

- the phased trio VCF:
  https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz
- the GRCh38 PLINK genetic map hap-ibd needs, the `no_chr_in_chrom_field`
  variant, since the trio VCF calls its chromosome `1` rather than `chr1`:
  https://bochet.gcc.biostat.washington.edu/beagle/genetic_maps/plink.GRCh38.map.zip
- the hg38 reference sequence the reproduce script's own JBrowse instance opens
  on, rehosted: https://jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz

## The trio VCF

A trio is a mother, father, and child sequenced together. A phased VCF tags each
variant with the haplotype it sits on (`0|1` vs `1|0`), so each variant can be
followed to the copy of the genome it came from.

This page uses the phased VCF above, the Kinh-Vietnamese trio HG02024, chr1
only.

Everything here is on `hg38`. Add the VCF with `jbrowse add-track` or the in-app
"Add track" workflow, both covered in the
[variant track guide](/docs/config_guides/variant_track).

<Figure caption="The VCF on initial load, in the default display: one orange box per variant." src="/img/trio-basic.png"/>

## Enabling the matrix view

Switch the track to the
[Multi-sample variant display (matrix)](/docs/user_guides/multivariant_track).
Each sample becomes a row and each variant a column, with black lines tying the
columns back to their genomic positions.

<Figure caption="Multi-sample variant display (matrix). One row per sample, one column per variant, black lines connecting columns to their genome positions." src="/img/trio-matrix.png"/>

## Enabling the phased mode

Turn on **Rendering mode → Phased** from the track menu:

- it splits each sample into its two haplotypes, so the three trio members
  become six rows
- it needs genotypes written with the `0|1` separator rather than `0/1`; getting
  there from unphased calls takes a phasing program like SHAPEIT

<Figure caption="The phased rendering mode, and the 'Rendering mode' → 'Phased' menu item that turns it on." src="/img/trio-matrix-phased.png"/>

<Video src="/media/variants/trio_phased_matrix.mp4" caption="Both picks in one pass, on the track the figures above are of: the multi-sample matrix display, then the phased rendering mode splitting each trio member into its two haplotype rows in place. The last move zooms out to the window the rest of the page works in." />

That last move is wider than the default display will draw: it stops above its
[feature-density limit](/docs/config/baselineardisplay/#slot-maxfeaturescreendensity),
where the matrix keeps going because a column is a variant rather than a
position.

## Reading matching haplotypes off the matrix

Every row is now a strip of colored blocks, and matching stretches between rows
jump out: the child's two haplotypes match the mother's in some blocks and the
father's in others. The rest of this tutorial turns that by-eye pattern into a
painted track.

<Figure caption="The phased mode with no markup added. Rows are child hap1/hap2, mother hap1/hap2, father hap1/hap2, top to bottom, under the RefSeq genes, with connector lines tying each matrix column back to the position it came from." src="/img/trio-matrix-phased-clean.png"/>

## Finding the matching blocks programmatically

[hap-ibd](https://github.com/browning-lab/hap-ibd) computes that matching, as
"identical by descent" blocks. hap-ibd is built for population-scale cohorts and
runs on a single trio VCF, and the run needs two things:

- a phased VCF, like the
  [trio dataset](https://hgdownload.soe.ucsc.edu/gbdb/hg38/1000Genomes/trio/HG02024_VN049_KHV/HG02024_VN049_KHVTrio.chr1.vcf.gz)
  above
- a genetic map in PLINK format (hap-ibd's README links GRCh38 ones)

Grab `hap-ibd.jar` from the
[releases page](https://github.com/browning-lab/hap-ibd/releases) along with
those maps.

## Running hap-ibd

The trio VCF calls its chromosome `1`, with no `chr` prefix, so reach for the
`no_chr_in_chrom_field` variant of the GRCh38 PLINK map:

<!-- from: scripts/build_khv_trio_hapibd.sh -->

```bash
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

(The roles come from the 1000 Genomes pedigree line
`VN049 HG02024 HG02026 HG02025`: father HG02026, mother HG02025.) Within one
child haplotype, the matching _parental_ copy flips between the parent's copy 1
and copy 2 at each crossover. Those flips are what the track below paints.

hap-ibd's output has gaps, plus short spurious segments from the statistical
phasing, so it is collapsed into clean blocks before painting.

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

<!-- from: scripts/build_khv_trio_hapibd.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/hapibd_to_bed.py
python3 hapibd_to_bed.py trio.ibd.gz HG02024 HG02026 HG02025 trio.hapibd.bed
jbrowse sort-bed trio.hapibd.bed | bgzip > trio.hapibd.bed.gz
tabix -p bed trio.hapibd.bed.gz
```

[`sort-bed`](/docs/cli#jbrowse-sort-bed) keeps the `#`-header line on top and
sorts the rest under `LC_ALL=C`, so the adapter can read the column names off
the file and the order does not shift with your locale.

Load the result as a `FeatureTrack` with a `LinearMultiRowFeatureDisplay`:

- `partitionField` draws one row per distinct value it finds, so `parenthap`
  gives the four parental-haplotype rows
- `rowOrder` sets their top-to-bottom order
- a BED carrying `itemRgb` is painted with it automatically, no extra color
  config needed

```json
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
      "partitionField": "parenthap",
      "showLegend": false,
      "rowOrder": ["Father hap1", "Father hap2", "Mother hap1", "Mother hap2"]
    }
  ]
}
```

Two things about the config above:

- The BED's `#`-header line names its columns, so the adapter needs no
  `columnNames`, and `parenthap` is the one the display partitions on.
- [`showLegend`](/docs/config/linearmultirowfeaturedisplay/#slot-showlegend) is
  off, because the color and the row label already carry the same four
  categories.

## Reading the painted crossovers

The four rows are each parent's two copies, blues for father HG02026 and reds
for mother HG02025:

<Figure caption="hap-ibd inheritance blocks in the multi-row feature display. Blue rows are father HG02026's two haplotypes, red rows are mother HG02025's. Each crossover is a spot where a painted block steps from one row to its partner." src="/img/trio-hapibd-painting.png"/>

Read the rows in pairs:

- **Blue rows are the child's paternal chromosome.** Exactly one of them is
  filled at any position, and that is which of the father's two copies the child
  got there there; every step between the blue rows is a crossover.
- **Red rows work the same way** for the maternal chromosome.

That rule is the figure's own control: two filled blue rows at a position, or
neither, means hap-ibd matched one child haplotype to both of the father's
copies or to neither. The centromere is the blank with no markers to match on.

## Relating the painting back to the genotypes

Stack the painting directly above the same VCF in the **phased multi-sample
variant display**, which draws genotypes at their real genomic positions.
_Matrix_ mode spaces its columns evenly, on a scale of its own.

Zoom to a few hundred kb around one boundary, where the block-step is obvious
and the genotype columns resolve into individual variants. Start with the
paternal crossover near chr1:29.7 Mb:

<Figure caption="Paternal crossover at chr1:29,697,418, in a 400 kb window. The painting steps from Father hap2 to Father hap1, and the tinted frames read that switch off the raw genotypes." src="/img/trio-crossover-paternal.png"/>

The maternal chromosome does the same thing at its own boundaries. Near
chr1:55.8 Mb the child's maternal haplotype steps between the mother's two
copies:

<Figure caption="Maternal crossover at chr1:55,753,613, in a 400 kb window, the same idea in a different palette: the painting steps from Mother hap2 to Mother hap1, and the frames tie Child hap2 to each in turn." src="/img/trio-crossover-maternal.png"/>

The genotypes underneath switch between the two parental copies more often than
real crossovers do, and the painting above summarises those switches away.

## Where the boundaries come from

This 1000 Genomes VCF is _statistically_ phased, and its haplotypes carry switch
errors, which are the extra copy-switches visible in the genotype rows.
hap-ibd's cM-length threshold filters most of them out, so its blocks track the
real boundaries more closely and the two crossovers above are the well-supported
ones; the finer blocks are approximate. hap-ibd gives paintable inheritance
blocks, and crossover mapping proper uses a pedigree-aware method such as
[duoHMM](https://mathgen.stats.ox.ac.uk/genetics_software/duohmm/duohmm.html).

## Reproduce it end to end

[`build_khv_trio_hapibd.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_khv_trio_hapibd.sh)
runs the whole pipeline in one shot. It downloads the trio VCF, hap-ibd, and the
genetic map, runs hap-ibd, paints the BED with
[`hapibd_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/hapibd_to_bed.py),
downloads JBrowse, and writes a `config.json` with the hg38 assembly plus the
VCF and hap-ibd tracks.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_khv_trio_hapibd.sh
bash build_khv_trio_hapibd.sh   # builds ./khv_trio_build/jbrowse2
npx --yes serve khv_trio_build/jbrowse2 # then open the printed URL
```

It needs java, python3, node, and htslib (`bgzip` and `tabix`). Opening
`khv_trio_build/jbrowse2/config.json` in JBrowse Desktop via **File -> Session
-> Open config.json or .jbrowse file...** gives the same view without serving
anything.

## See also

- [](/docs/tutorials/local_ancestry)
- [](/docs/tutorials/bxd_qtl)
- [](/docs/tutorials/sv_multisamples)
- [](/docs/tutorials/ld_human)
- [](/docs/user_guides/multirow_feature_track)
- [](/docs/user_guides/multivariant_track)
- [](/docs/config_guides/variant_track)

## References

- 1000 Genomes Project Consortium (2015).
  [A global reference for human genetic variation](https://doi.org/10.1038/nature15393)
- Zhou et al. (2020).
  [A fast and simple method for detecting identity-by-descent segments in large-scale data](https://doi.org/10.1016/j.ajhg.2020.02.010),
  hap-ibd
- O'Connell et al. (2014).
  [A general approach for haplotype phasing across the full spectrum of relatedness](https://doi.org/10.1371/journal.pgen.1004234),
  duoHMM
