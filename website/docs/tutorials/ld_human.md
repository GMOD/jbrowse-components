---
title: LD at a selective sweep (human)
sidebar_label: LD at a sweep (human)
description:
  Compute an LD triangle live from phased genotypes, and cut a window that shows
  the block's edges
guide_category: Tutorials
tutorial_category: Population genomics
data: hosted
---

**TL;DR:** an `LDDisplay` computes pairwise r² live from a phased VCF. At the
lactase locus the swept haplotype draws one block, whose edges depend on the
window you cut and on which samples went in.

## Prerequisites

- nothing to read the figures, which load hosted data
- for the commands on this page and the
  [reproduce script](#reproduce-it-end-to-end): `bcftools` built with libcurl,
  htslib (`tabix`), `curl`, `python3`, and `node` for the
  [JBrowse CLI](/docs/cli)
- [vcftools](https://vcftools.github.io/) and
  [`bedGraphToBigWig`](https://hgdownload.soe.ucsc.edu/admin/exe/) for the Fst
  lane, plus `plink` (1.9, not plink2) for the r² tables

## Reading the triangle

Red means two variants are almost always inherited together, white means they
are independent, so the triangle shows where a stretch of chromosome travels as
a unit. The [`LDDisplay`](/docs/config/lddisplay/) is per-population by
construction: r² is a correlation across whatever samples you hand it.

An `LDDisplay` on an ordinary `VariantTrack` is the whole setup:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "kgp_lct_ld",
  "name": "LCT lactase-persistence LD, 1000G European panel (r²)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/popgen/lct_1kg38_chr2_eur_wide.vcf.gz"
  },
  "displays": [
    {
      "type": "LDDisplay",
      "minorAlleleFrequencyFilter": 0.35,
      "useGenomicPositions": true,
      "forceLoad": true,
      "height": 360
    }
  ]
}
```

[`minorAlleleFrequencyFilter`](/docs/config/sharedlddisplay/#slot-minorallelefrequencyfilter)
thins a dense callset to the common, block-tagging variants, and
[`useGenomicPositions`](/docs/config/sharedlddisplay/#slot-usegenomicpositions)
sizes each cell by genomic distance, so the block's edges land under the
coordinates they are at.

r² is computed from the genotypes themselves, so a window this wide is more data
than the size gate lets a track fetch unasked, and the lane arrives as a "too
much data" banner with a FORCE LOAD button on it.
[`forceLoad`](/docs/config/sharedlddisplay/#slot-forceload) is that button
written down, for a view nobody is going to click: a figure, an embed, a
notebook. It applies to the one view that declares it;
[`fetchSizeLimit`](/docs/config/sharedlddisplay/#slot-fetchsizelimit) sets a
ceiling for the whole track at every locus.

## Where the block comes from

A haplotype is a run of neighbouring variants sitting on the same copy of a
chromosome, passed on together as a unit. Selection favouring one of them, here
the allele that keeps lactase switched on into adulthood, carries the whole run
up in frequency with it. That is a selective sweep, and it leaves every variant
along the run correlated with the others, which is the block in the triangle.
The stretch it left at this locus is what
[Bersaglieri et al. 2004](https://doi.org/10.1086/421051) read.

The allele itself is `rs4988235`, and its
[dbSNP report](https://www.ncbi.nlm.nih.gov/snp/rs4988235) is where to see what
is known about it: the ClinVar records for lactase persistence hang off it, and
the frequency table gives it population by population.

<Figure src="/img/ld/lct_sweep_two_scales.png" caption="Top, RefSeq genes and Weir and Cockerham Fst per variant across 40 Mb of chr2. Under the wedge, the same locus, window and allele-frequency floor twice, differing only in which samples went in, over that Fst lane at its own scale and the deCODE genetic map." links="Wide scan=ld/lct_fst_scan,The two triangles=ld/lct_pooled_vs_panel"/>

The lower frame is all block, so it cannot tell you the locus is unusual:
everything in it sits on the swept haplotype, which makes the sweep the frame's
own background. The lanes around it are where that comparison comes from.

- **Fst, top.** Fst scores how differently two sets of samples carry a variant,
  so a variant one panel carries and the other mostly lacks scores high. Widened
  to forty megabases, rs4988235 is the most differentiated variant in the span
  and the ten highest-scoring sites are all inside the block with it. Read it
  per variant, which is what the
  [build script](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_fst_scan.sh)
  scores: a sweep differentiates the variants on its own haplotype and leaves
  the rest of a bin on the background, so averaging a bin averages the signal
  away.
- **Genetic map.** The block fills the span where the deCODE map
  ([Halldorsson et al. 2019](https://doi.org/10.1126/science.aau1043)) reads
  flat, with a recombination hotspot at each end, where crossovers are frequent
  enough to break a haplotype up. It counts crossovers in sequenced families, so
  it carries no LD of its own. It loads as an ordinary
  [quantitative track](/docs/user_guides/quantitative_track) from the same hg38
  hub as the gene lane.
- **The two triangles.** Remember that r² is a correlation across the samples
  you hand it, and this haplotype swept in Europe. Pool that panel with
  populations the haplotype never reached and their chromosomes go into the same
  correlation, where they carry a different background: every pair of variants
  then looks less correlated than it is inside either group, which is why the
  upper triangle is the paler and patchier of the two.

The 2019 sequence-level map is why this page is on hg38: it was built natively
on GRCh38, resolves to under a kilobase, and comes from Icelandic meioses.
Broad-scale recombination rates are close to identical between human
populations, and fine-scale hotspot positions follow PRDM9 allele frequencies
([Hinch et al. 2011](https://doi.org/10.1038/nature10336)), so the European
panel in the lane below is matched to it. The HapMap and 1000 Genomes maps in
the same hub are estimated from LD.

### Cut the region out of the VCF

The triangle is drawn from what the file holds, so the slice has to reach past
both edges of the block for those edges to be in frame. One region query cuts
it:

<!-- from: scripts/build_lct_ld.sh -->

```bash
# -r is a range request, so 3.4 Mb costs 3.4 Mb and not the 2.5 GB chromosome.
# -S is one sample name per line; -e drops the symbolic SV records, which are
# spans rather than the allele indicators the display correlates.
bcftools view -r chr2:133800000-137200000 -S unrelated.samples \
  -e 'ALT[0]~"<"' -Oz -o pooled.vcf.gz "$CALLSET"
tabix -p vcf pooled.vcf.gz
```

Where the edges go is `plink --r2` against the causal variant. plink correlates
the genotypes and the display the phase, so the two disagree cell by cell; the
profile settles the window from the file itself.

<!-- from: scripts/build_lct_ld.sh -->

```bash
# plink names a variant by position, and --set-missing-var-ids fills blanks
# only, so strip the release's own chr:pos:ref:alt IDs or --ld-snp matches
# nothing. One biallelic record per position is what r² is defined on anyway.
bcftools view -m2 -M2 -v snps pooled.vcf.gz | bcftools norm -d both |
  bcftools annotate -x ID -Oz -o pooled.snvs.vcf.gz

# --maf is the figure's own floor; --ld-window-r2 0 keeps the weak pairs, which
# at the edges are the answer. Bin anchor.ld by position afterwards.
plink --vcf pooled.snvs.vcf.gz --double-id --allow-extra-chr \
  --set-missing-var-ids @:# --maf 0.35 \
  --r2 --ld-window 999999 --ld-window-r2 0 \
  --ld-snp chr2:135851076 --ld-window-kb 4000 --out anchor
```

### Subset the VCF to one panel

r² is computed across every sample in the file, so pooling panels that carry the
haplotype at different frequencies averages the correlation down, which is the
upper lane above.

<!-- from: scripts/build_lct_ld.sh -->

```bash
bcftools view -S panel.samples -Oz -o panel.vcf.gz pooled.vcf.gz
tabix -p vcf panel.vcf.gz
```

The same run over a window instead of an anchor gives the mean pairwise r²
inside the block. Run it on both files and average each `block.ld`'s r² column:

<!-- from: scripts/build_lct_ld.sh -->

```bash
# no --ld-snp, so every pair inside the window rather than every pair sharing
# one variant. Same window and floor both ways, so only the samples differ.
plink --vcf panel.snvs.vcf.gz --double-id --allow-extra-chr \
  --set-missing-var-ids @:# --maf 0.35 \
  --r2 --ld-window 999999 --ld-window-r2 0 \
  --chr chr2 --from-bp 135000000 --to-bp 136150000 \
  --ld-window-kb 1200 --out block
```

The two lanes also end up drawing different variants, because
`minorAlleleFrequencyFilter` is a frequency in whatever samples the file holds:
a variant common in one panel and rare elsewhere clears the floor in the panel
file and falls below it in the pooled one.

The same applies to species, and more sharply: a panel mixing two species
invents LD that neither species has.

### Score the sweep per variant

The Fst lane is [vcftools](https://vcftools.github.io/man_latest.html) over the
same two sample lists, as a bigWig for a
[quantitative track](/docs/user_guides/quantitative_track):

<!-- from: scripts/build_lct_fst_scan.sh -->

```bash
# two sample lists, one name per line, and no --fst-window-size: Fst per variant
vcftools --gzvcf pooled.vcf.gz \
  --weir-fst-pop panel.samples --weir-fst-pop rest.samples --out fst_site

# 1-based site to bedGraph interval, dropping the sites scored nan
awk 'NR>1 && $3!="-nan" && $3!="nan" {printf "%s\t%d\t%d\t%.5f\n",$1,$2-1,$2,$3}' \
  fst_site.weir.fst | sort -k1,1 -k2,2n > fst_site.bedgraph
printf 'chr2\t242193529\n' > hg38.chrom.sizes
bedGraphToBigWig fst_site.bedgraph hg38.chrom.sizes fst.bw
```

## The haplotypes behind the triangle

A triangle is a pairwise matrix turned on its corner: its vertical axis is the
distance between the two variants being compared.

The same VCF draws those haplotypes in the same view, one lane below the
triangle. A
[`LinearMultiSampleVariantMatrixDisplay`](/docs/config/linearmultisamplevariantmatrixdisplay/)
in
[`renderingMode: 'phased'`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-renderingmode)
gives one row per chromosome and one column per variant. Its sidebar stripe is
population, and above both lanes sit RefSeq genes and the ClinVar
lactase-persistence records.

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "kgp_lct_haplotypes",
  "name": "1000 Genomes haplotypes across LCT (one row per haplotype)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/popgen/lct_1kg38_chr2_6pop.vcf.gz",
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/genomes/hg19/1000g.sorted.csv.gz"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantMatrixDisplay",
      "renderingMode": "phased",
      "colorBy": "population",
      "minorAlleleFrequencyFilter": 0.35,
      "forceLoad": true,
      "height": 700
    }
  ]
}
```

Run the clustering from the track menu's **Clustering** → **Cluster rows by
genotype...**, or bake it into a session with the
[`runClustering`](/docs/models/multisamplevariantbasemodel/#property-runclustering)
and
[`clusterRegion`](/docs/models/multisamplevariantbasemodel/#property-clusterregion)
model properties, which is what the figure below does.

Both work unchanged on [JBrowse Desktop](/docs/quickstart_desktop), which opens
the VCF from local disk with `uri` pointed at a local path. That block's CLI tab
puts the same track into a `config.json`.

<Figure src="/img/ld/lct_haploblock.png" caption="The triangle and the haplotypes it summarises over one window: 1000 Genomes haplotypes at LCT/MCM6, one row per chromosome, clustered rather than left in file order. The shaded stripe is the 89 kb of LCT/MCM6 selection acted on, and the block it left behind fills the triangle above. The pale slab is one cluster of near-identical chromosomes, uniform across that block, and the rs4988235-A haplotypes sit inside it."/>

**Ordering is what makes a block visible.** In file order the same matrix is a
plaid at any size, because a block is a set of alleles travelling together and
which of them is the non-reference allele varies from site to site. Clustering
puts near-identical chromosomes next to each other, and a swept haplotype
carries little variation of its own, so it resolves into one slab.

`rs4988235` falls below the figure's own MAF floor, so the ClinVar lane marks it
independently of the columns the clustering ran on.
[`colorBy`](/docs/config/sharedvariantdisplay/#slot-colorby) keeps the
populations in the sidebar stripe, so which of them carry the block reads off
the clustered rows.

### The subsample behind the figure {#rows-have-to-be-worth-a-pixel}

Over the whole release each haplotype row falls well below a pixel in a lane
this tall and averages into its neighbours, leaving a flat wash whatever the
ordering. This figure reads a subsample of six populations instead, built by the
third script under [Reproduce it end to end](#reproduce-it-end-to-end).

## Coloring a GWAS by LD to the lead SNP

Which variants near a GWAS peak are correlated with the lead SNP, and therefore
which of them the association could be tagging, is the same correlation read
along one row of the matrix.

A [`GWASTrack`](/docs/config_guides/gwas_track) takes a PLINK `.ld` file as an
`ldAdapter` beside its summary statistics, and
[`colorBy: 'ld'`](/docs/config/linearmanhattandisplay/#slot-colorby) shades each
point by its r² to the index SNP, LocusZoom style. It needs the same care about
which panel the r² came from. See [](/docs/user_guides/gwas_track).

## Reproduce it end to end

[`build_lct_ld.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_ld.sh)
cuts the region out of the 1000 Genomes 30x callset without downloading it, then
writes a ready-to-serve config carrying both LD lanes, the Fst lane, the genetic
map and the haplotype matrix:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_lct_ld.sh
bash build_lct_ld.sh                  # builds ./lct_ld_build/jbrowse2
npx --yes serve lct_ld_build/jbrowse2 # then open the printed URL
```

The assembly is the hosted UCSC hg38 hub's own entry copied in, so the reference
is never downloaded. The files the script writes are genotypes; the display does
the r². It prints r² against rs4988235 in bins along the slice, which is where
the block's edges come from, mean pairwise r² inside the block for one panel and
for the pooled release, and where rs4988235 ranks on per-site Fst.

It reads the release's 2504 unrelated samples, since relatives share long
haplotypes for reasons that have nothing to do with a sweep.

The wide Fst lane is a second file, from
[`build_lct_fst_scan.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_fst_scan.sh),
because the slice above it stops a little either side of the block:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_lct_fst_scan.sh
bash build_lct_fst_scan.sh            # builds ./lct_fst_scan_build
```

Same panels, same estimator and the same tool, over forty megabases instead of
three. It prints where rs4988235 ranks across the whole span, and the
million-site slice it needs to get there takes a few minutes to come down.

The [subsampled haplotype matrix](#rows-have-to-be-worth-a-pixel) is a third
file, since the whole release draws a flat wash at that lane height:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_lct_haploblock.sh
bash build_lct_haploblock.sh          # builds ./lct_haploblock_build
```

[`build_lct_haploblock.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_haploblock.sh)
prints the rows-per-pixel arithmetic against the lane, and the per-population
frequencies the six populations were chosen for.

## See also

- [](/docs/tutorials/ld_mosquitoes)
- [](/docs/tutorials/population_genomics)
- [](/docs/user_guides/variant_track)
- [](/docs/user_guides/gwas_track)
- [Variant track configuration](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display)
- [Gallery: variants and populations](/gallery/#variants)

## References

- 1000 Genomes Project Consortium (2015).
  [A global reference for human genetic variation](https://doi.org/10.1038/nature15393)
- Bersaglieri et al. (2004).
  [Genetic signatures of strong recent positive selection at the lactase gene](https://doi.org/10.1086/421051)
- Byrska-Bishop et al. (2022).
  [High-coverage whole-genome sequencing of the expanded 1000 Genomes Project cohort including 602 trios](https://doi.org/10.1016/j.cell.2022.08.004)
- Halldorsson et al. (2019).
  [Characterizing mutagenic effects of recombination through a sequence-level genetic map](https://doi.org/10.1126/science.aau1043)
- Hinch et al. (2011).
  [The landscape of recombination in African Americans](https://doi.org/10.1038/nature10336)
