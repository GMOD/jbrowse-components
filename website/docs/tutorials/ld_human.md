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

**TL;DR:** an `LDDisplay` computes pairwise r² live from a phased VCF, no
precomputed LD file. At the lactase locus the swept haplotype draws one block.
Whether you can see that it is a block depends on the window you cut and on
which samples went in.

## Prerequisites

- nothing to read the figures, which load hosted data
- for the [reproduce script](#reproduce-it-end-to-end): `bcftools` built with
  libcurl, htslib (`tabix`), `curl`, `python3`, and `node` for the
  [JBrowse CLI](/docs/cli)
- [vcftools](https://vcftools.github.io/) and
  [`bedGraphToBigWig`](https://hgdownload.soe.ucsc.edu/admin/exe/) for the Fst
  lane, plus `plink` (1.9, not plink2) for the r² tables the script prints

## Reading the triangle

Red means two variants are almost always inherited together, white means they
are independent, so the triangle shows where a stretch of chromosome travels as
a unit. The [`LDDisplay`](/docs/config/lddisplay/) is per-population by
construction: r² is a correlation across whatever samples you hand it.

An `LDDisplay` on an ordinary `VariantTrack` is the whole setup, with no
precomputed LD file beside it:

```json
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
coordinates they are at. Left off, the x axis is SNP index instead, and index
density is not uniform across a window this wide.

r² is computed from the genotypes themselves, so a window this wide is more data
than the size gate lets a track fetch unasked, and the lane arrives as a "too
much data" banner with a FORCE LOAD button on it.
[`forceLoad`](/docs/config/sharedlddisplay/#slot-forceload) is that button
written down, and it belongs on a view nobody is going to click: a figure, an
embed, a notebook. It applies to the one view that declares it, where
[`fetchSizeLimit`](/docs/config/sharedlddisplay/#slot-fetchsizelimit) is a
ceiling for the whole track at every locus.

## A sweep leaves a long haplotype

Selection driving one haplotype to high frequency carries every variant on it
along, leaving a stretch of correlated variants. That stretch is the signal
[Bersaglieri et al. 2004](https://doi.org/10.1086/421051) read at this locus.
Two things decide whether it shows as a block: the window you cut, and which
samples went into the file.

<Figure src="/img/ld/lct_sweep_two_scales.png" caption="Top, Weir and Cockerham Fst per variant across 40 Mb of chr2. Under the wedge, the same locus, window and MAF floor twice, differing only in which samples went in, over that Fst lane at its own scale and the deCODE genetic map." links="Wide scan=ld/lct_fst_scan,The two triangles=ld/lct_pooled_vs_panel"/>

The upper frame is what says the locus is unusual, and it is the one thing the
lower frame cannot say about itself: every site down there sits on the same
swept haplotype, so the frame's own background is the sweep. Widened to forty
megabases, the most differentiated variant in the span is rs4988235 and the ten
highest-scoring sites are all inside the block with it.

Read it per variant rather than in windows. The
[build script](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_fst_scan.sh)
was written windowed first and the block came out unremarkable, ranked behind
runs elsewhere on the arm: a sweep differentiates the variants on its own
haplotype and leaves the rest of a bin on the background, so averaging a bin
averages the signal away.

Nothing about the display changed between the two triangles. Lactase persistence
swept in Europe, so the block is a property of that panel: pooling it with
populations the haplotype never reached mixes in their backgrounds and the
correlations average down.

Where the block ends is a question the triangle cannot answer about itself, so
the lane above it is a genetic map. The deCODE map
([Halldorsson et al. 2019](https://doi.org/10.1126/science.aau1043)) counts
crossovers in sequenced families, so it is measured in cM/Mb and has no LD in
it, where a map estimated from LD would confirm the triangle with itself. It
loads as an ordinary [quantitative track](/docs/user_guides/quantitative_track)
from the hg38 hub the gene lane comes from. Read the two together: the block
fills the span where that map reads flat, and a hotspot stands at each end of
it.

Which deCODE map matters, and it is the reason this page is on hg38 rather than
hg19. The sequence-level 2019 map was built natively on GRCh38 and resolves to
under a kilobase; what hg19 carries is the earlier map in 10 kb bins. Neither is
the same thing as the HapMap or 1000 Genomes maps sitting beside them in either
hub, which are estimated from LD.

The map is built from Icelandic meioses, which is worth knowing rather than
working around. Broad-scale recombination rates are close to identical between
human populations; what varies between them is the fine-scale hotspots, whose
positions follow PRDM9 allele frequencies
([Hinch et al. 2011](https://doi.org/10.1038/nature10336)). The panel in the
lane below is European, so the map and the samples are matched, which is what
makes reading one against the other fair. On an African or East Asian panel the
same lane would still place the desert and would be a weaker guide to where
exactly each shoulder sits.

The Fst lane on top is the half an LD triangle cannot draw. Linkage says the
haplotype is long; Fst says its variants are the ones whose frequency differs
between this panel and everyone else, which is what a sweep leaves behind. The
reproduce script computes it with
[vcftools](https://vcftools.github.io/man_latest.html) over the same slice, per
variant rather than in windows, and prints where `rs4988235` ranks: it comes out
first of every site in the frame. A windowed version loses that, because a
window mixes the swept haplotype with every rare variant sharing it.

### Cut the slice wider than the block

A slice that begins where the block begins cannot show that it ends, and renders
as a triangle filling the frame. The reproduce script prints r² against the
causal variant along the slice, which is how to pick the edges. The constraint
is the file rather than the view, so zooming out past the end of the file only
adds white.

### Subset the VCF to one panel

r² is computed across every sample in the file, so pooling panels that carry the
haplotype at different frequencies averages the correlation down, which is the
upper lane above. The reproduce script prints mean pairwise r² inside the block
both ways.

```bash
bcftools view -S panel.samples --force-samples -Oz -o panel.vcf.gz all.vcf.gz
tabix -p vcf panel.vcf.gz
```

The two lanes also end up drawing different variants, because
`minorAlleleFrequencyFilter` is a frequency in whatever samples the file holds:
a variant common in one panel and rare elsewhere clears the floor in the panel
file and falls below it in the pooled one.

The same applies to species, and more sharply: a panel mixing two species
invents LD that neither species has.

## What the triangle is a picture of

A triangle is a pairwise matrix turned on its corner, so its vertical axis is
the distance between the two variants being compared rather than any value.
Nothing on screen says so, and no other track works that way.

The haplotypes it summarises need no such explaining, and the same VCF draws
them in the same view, one lane below the triangle. A
[`LinearMultiSampleVariantMatrixDisplay`](/docs/config/linearmultisamplevariantmatrixdisplay/)
in
[`renderingMode: 'phased'`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-renderingmode)
gives one row per chromosome and one column per variant. Its sidebar stripe is
population, and above both lanes sit RefSeq genes and the ClinVar
lactase-persistence records.

```json
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

The clustering is not in that config, because it is not a config slot. Run it
from the track menu's **Clustering** → **Cluster rows by genotype...**, or bake
it into a session with the
[`runClustering`](/docs/models/multisamplevariantbasemodel/#property-runclustering)
and
[`clusterRegion`](/docs/models/multisamplevariantbasemodel/#property-clusterregion)
model properties, which is what the figure below does.

<Figure src="/img/ld/lct_haploblock.png" caption="The triangle and the haplotypes it summarises over one window: 1000 Genomes haplotypes at LCT/MCM6, one row per chromosome, clustered rather than left in file order. The shaded stripe is the 89 kb of LCT/MCM6 selection acted on, and the block it left behind fills the triangle above. The pale slab is one clade, uniform across that block, and the rs4988235-A haplotypes sit inside it."/>

**Ordering is what makes a block visible, not colour and not row count.** Left
in file order the same matrix is a plaid at any size, because a block is a set
of alleles travelling together and which of them is the non-reference allele
varies from site to site. Clustering puts near-identical chromosomes next to
each other, and a swept haplotype carries little variation of its own, so it
resolves into one slab.

The clustering is not told which variant is causal. `rs4988235` falls below the
figure's own MAF floor and is not among the columns drawn, so the ClinVar lane
marks it independently of the rows it lands on.

Grouping by population would leave each band in file order, so the slab would
not form. [`colorBy`](/docs/config/sharedvariantdisplay/#slot-colorby) keeps the
populations in the sidebar stripe, so which of them carry the block is a result
rather than the axis the rows were sorted on.

### Rows have to be worth a pixel

Over the whole release each haplotype row falls well below a pixel in a lane
this tall and averages into its neighbours, leaving a flat wash whatever the
ordering. This figure reads a subsample of six populations instead, built by the
third script under [Reproduce it end to end](#reproduce-it-end-to-end).

## Coloring a GWAS by LD to the lead SNP

Which variants near a GWAS peak are correlated with the lead SNP, and therefore
which of them the association could be tagging, is the same correlation read
along one row of the matrix rather than over the whole of it.

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
the r². What it prints is every measurement this page would otherwise assert: r²
against rs4988235 in bins along the slice, which is where the block's edges come
from, mean pairwise r² inside the block for one panel against the pooled
release, and where rs4988235 ranks on per-site Fst.

It reads the 2504 unrelated samples rather than the release's full 3202.
Relatives share long haplotypes for reasons that have nothing to do with a
sweep, which is the one quantity every lane here draws.

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
