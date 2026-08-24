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

**TL;DR:** we look at linkage disequilibrium around the lactase gene, where
selection for lactase persistence left one long block of correlated variants.
JBrowse computes the r² triangle in the browser, straight from a phased VCF.

## Prerequisites

- nothing to read the figures, which load hosted data
- for the commands on this page and the
  [reproduce script](#reproduce-it-end-to-end): `bcftools` built with libcurl,
  htslib (`tabix`), `curl`, `python3`, and `node` for the
  [JBrowse CLI](/docs/cli)
- [`bedGraphToBigWig`](https://hgdownload.soe.ucsc.edu/admin/exe/) and
  [PLINK 2.0](https://www.cog-genomics.org/plink/2.0/) for the Fst
  lane[^plink19]

## Where the data comes from

1000 Genomes 30x high-coverage from NYGC
([Byrska-Bishop et al. 2022](https://doi.org/10.1016/j.cell.2022.08.004)),
called natively on GRCh38, so no liftover sits between the calls and the hg38
coordinates the figures use.

- phased chromosome 2, which the commands slice to a 3.4 Mb region:
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20220422_3202_phased_SNV_INDEL_SV/1kGP_high_coverage_Illumina.chr2.filtered.SNV_INDEL_SV_phased_panel.vcf.gz
- the release's own unrelated set, whose SAMPLE_NAME column is
  `unrelated.samples`. Relatives share long haplotypes for reasons that have
  nothing to do with a sweep:
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/1000G_2504_high_coverage.sequence.index
- populations and superpopulations, narrowed to that unrelated set for
  `panel.samples` (EUR) and `rest.samples` (everything else):
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/20130606_g1k_3202_samples_ped_population.txt
- the EUR slice the triangle is drawn from, rehosted so the figures and their
  live links load without the EBI round trip:
  https://jbrowse.org/demos/popgen/lct_1kg38_chr2_eur_wide.vcf.gz
- the six-population slice the haplotype matrix reads:
  https://jbrowse.org/demos/popgen/lct_1kg38_chr2_6pop.vcf.gz

The gene, ClinVar and recombination lanes beside them are tracks of the hosted
UCSC hg38 [hub](/docs/user_guides/hub_url).

## Reading the triangle

Red means two variants are almost always inherited together, white means they
are independent, so the triangle shows where a stretch of chromosome travels as
a unit. It is a pairwise matrix turned on its corner: the vertical axis is the
distance between the two variants being compared.

An [`LDDisplay`](/docs/config/lddisplay/) on an ordinary `VariantTrack` is the
whole setup:

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
      "showLegend": true,
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

r² is computed from the genotypes themselves, so a window this wide asks for
more data than a track fetches unasked, and the lane arrives as a "too much
data" banner with a FORCE LOAD button on it. Setting
[`forceLoad`](/docs/config/sharedlddisplay/#slot-forceload) is that button
pressed in advance, which is what a view nobody will click needs: a figure, an
embed, a notebook. `forceLoad` speaks for the one display that declares it,
while [`fetchSizeLimit`](/docs/config/sharedlddisplay/#slot-fetchsizelimit) sets
the ceiling for the whole track.

An [`LDTrack`](/docs/config/ldtrack) reads r² PLINK has already computed, so the
browser fetches a table of pairs rather than the genotypes behind them, which is
what a cohort too large to correlate live wants. The adapter takes plink2's
`.vcor` or PLINK 1.9's `.ld`, and [](/docs/tutorials/ld_mosquitoes) takes that
route over a 22 Mb inversion.

The block here is a selective sweep. Selection favouring one variant, the allele
that keeps lactase switched on into adulthood, carried the whole run of
neighbouring variants up in frequency with it, leaving them correlated
([Bersaglieri et al. 2004](https://doi.org/10.1086/421051)). That allele is
`rs4988235`, and its [dbSNP report](https://www.ncbi.nlm.nih.gov/snp/rs4988235)
carries its ClinVar entry and the frequency table population by population.

## Cut the region out of the VCF

The triangle is drawn from what the file holds, so the slice has to reach past
both edges of the block for those edges to be in frame. r² is a correlation
across every sample in the file, so the same region is cut twice: once over the
whole release, once over the European panel the sweep happened in.

<!-- from: scripts/build_lct_ld.sh -->

```bash
# -r is a range request, so 3.4 Mb costs 3.4 Mb and not the 2.5 GB chromosome.
# -S is one sample name per line; -e drops the symbolic SV records, which are
# spans rather than the allele indicators the display correlates.
bcftools view -r chr2:133800000-137200000 -S unrelated.samples \
  -e 'ALT[0]~"<"' -Oz -o pooled.vcf.gz \
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20220422_3202_phased_SNV_INDEL_SV/1kGP_high_coverage_Illumina.chr2.filtered.SNV_INDEL_SV_phased_panel.vcf.gz
tabix -p vcf pooled.vcf.gz

bcftools view -S panel.samples -Oz -o panel.vcf.gz pooled.vcf.gz
tabix -p vcf panel.vcf.gz
```

How wide is wide enough is a question for the file rather than for the picture.
The [reproduce script](#reproduce-it-end-to-end) bins r² against the causal
variant by position and prints where the correlation falls away, which is where
this window comes from.

The two files also end up drawing different variants, because
`minorAlleleFrequencyFilter` is a frequency in whatever samples the file holds:
a variant common in one panel and rare elsewhere clears the floor in the panel
file and falls below it in the pooled one.

## Compute Fst per variant

The Fst lane is `plink2 --fst` over `panel.samples` and `rest.samples`, written
out as a bigWig for a
[quantitative track](/docs/user_guides/quantitative_track):

<!-- from: scripts/build_lct_fst_scan.sh -->

```bash
# plink2 takes the two panels as one categorical phenotype rather than as two
# sample lists, and wants FID beside IID: a #IID-only header is refused as "No
# entries correspond to loaded sample IDs" even when every ID matches
{ printf '#FID\tIID\tPOP\n'
  awk '{print $1"\t"$1"\tPANEL"}' panel.samples
  awk '{print $1"\t"$1"\tREST"}' rest.samples; } > fst_pops.txt

# method=wc is Weir and Cockerham; plink2 defaults to Hudson, which is a
# different number. report-variants is per variant rather than windowed, and
# --output-chr chrM keeps CHROM spelled chr2 rather than plink2's bare 2
plink2 --vcf pooled.vcf.gz --double-id --output-chr chrM --pheno fst_pops.txt \
  --fst POP method=wc report-variants vcols=chrom,pos,fst --out fst_site

# 1-based site to bedGraph interval, dropping the sites scored nan
awk 'NR>1 && $4!="nan" {printf "%s\t%d\t%d\t%.5f\n",$1,$2-1,$2,$4}' \
  fst_site.PANEL.REST.fst.var | sort -k1,1 -k2,2n > fst_site.bedgraph
printf 'chr2\t242193529\n' > hg38.chrom.sizes
bedGraphToBigWig fst_site.bedgraph hg38.chrom.sizes fst.bw
```

## The block at two scales

<Figure src="/img/ld/lct_sweep_two_scales.png" caption="Top, RefSeq genes and Weir and Cockerham Fst per variant across a wide span of chr2. Under the wedge, the same locus and allele-frequency floor twice, differing only in which samples went in, over that Fst lane at its own scale and the deCODE genetic map." links="Wide scan=ld/lct_fst_scan,The two triangles=ld/lct_pooled_vs_panel"/>

The lower frame is all block, so it cannot tell you the locus is unusual:
everything in it sits on the swept haplotype, which makes the sweep the frame's
own background. The lanes around it are where that comparison comes from.

- **Fst, top.** Fst scores how differently two sets of samples carry a variant,
  so a variant one panel carries and the other mostly lacks scores high. Widened
  well past the block, the most differentiated sites in the span are the ones
  inside it. Read it per variant, which is what the
  [build script](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_fst_scan.sh)
  scores: a sweep differentiates the variants on its own haplotype and leaves
  the rest of a bin on the background, so averaging a bin averages the signal
  away.
- **Genetic map.** The block fills the span where the deCODE map
  ([Halldorsson et al. 2019](https://doi.org/10.1126/science.aau1043)) reads
  flat, with a recombination hotspot at each end, where crossovers are frequent
  enough to break a haplotype up. The map counts crossovers in sequenced
  families, so it carries no LD of its own. If you reach for a different
  recombination track in that hub, check how it was made: the HapMap and 1000
  Genomes maps there are estimated from LD, so they cannot check a triangle
  independently.
- **The two triangles.** This haplotype swept in Europe. Pool that panel with
  populations the haplotype never reached and their chromosomes go into the same
  correlation carrying a different background, so every pair of variants looks
  less correlated than it is inside either group. That is the paler, patchier
  upper triangle.

## The haplotypes behind the triangle

The same VCF draws those haplotypes in the same view, one lane below the
triangle. A
[`LinearMultiSampleVariantMatrixDisplay`](/docs/config/linearmultisamplevariantmatrixdisplay/)
in
[`renderingMode: 'phased'`](/docs/config/linearmultisamplevariantmatrixdisplay/#slot-renderingmode)
gives one row per chromosome and one column per variant, with population in its
sidebar stripe.

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

<Figure src="/img/ld/lct_haploblock.png" caption="An LD triangle over the haplotypes it summarises: 1000 Genomes chromosomes at LCT/MCM6, one row each, clustered by genotype. The pale slab is one cluster of near-identical chromosomes, uniform across the block that fills the triangle above."/>

The highlight across both lanes is the 89 kb of _LCT_ and _MCM6_ that selection
acted on.

**Ordering is what makes a block visible.** In file order the same matrix is a
plaid at any size, because a block is a set of alleles travelling together and
which of them is the non-reference allele varies from site to site. Clustering
puts near-identical chromosomes next to each other, and a swept haplotype
carries little variation of its own, so it resolves into one slab.

`rs4988235` falls below the figure's own frequency floor, so it is not one of
the matrix columns and the ClinVar lane is what marks where it is, independently
of the rows the clustering ran on. That lane is the hub's ClinVar track narrowed
to the phenotype with
`jexl:get(feature,'phenotypeList')=='LACTASE PERSISTENCE'`. Unfiltered it draws
every ClinVar record in the window, congenital lactase deficiency in the same
gene included, and marks nothing.
[`colorBy`](/docs/config/sharedvariantdisplay/#slot-colorby) keeps the
populations in the sidebar stripe, so which of them carry the block reads off
the clustered rows.

### The subsample behind the figure {#rows-have-to-be-worth-a-pixel}

Over the whole release each haplotype row falls well below a pixel in a lane
this tall and averages into its neighbours, leaving a flat wash whatever the
ordering. This figure reads a subsample of six populations instead, built by the
third script under [Reproduce it end to end](#reproduce-it-end-to-end).

## Reproduce it end to end

[`build_lct_ld.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_ld.sh)
cuts the region out of the 1000 Genomes 30x callset without downloading it, then
writes a ready-to-serve config carrying both LD lanes, the Fst lane, the genetic
map and the haplotype matrix. The VCFs it writes hold genotypes only, and
JBrowse computes the r² from them as it draws the triangle. It also prints the
two PLINK tables the window and the panel choice rest on: r² against `rs4988235`
binned by position, and mean pairwise r² inside the block for the panel against
the pooled release.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_lct_ld.sh
bash build_lct_ld.sh                  # builds ./lct_ld_build/jbrowse2
npx --yes serve lct_ld_build/jbrowse2 # then open the printed URL
```

The wide Fst lane is a second file, from
[`build_lct_fst_scan.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_fst_scan.sh),
because the slice above it stops a little either side of the block:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_lct_fst_scan.sh
bash build_lct_fst_scan.sh            # builds ./lct_fst_scan_build
```

The million-site slice it reads takes a few minutes to come down.

The [subsampled haplotype matrix](#rows-have-to-be-worth-a-pixel) is a third
file, from
[`build_lct_haploblock.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_haploblock.sh),
since the whole release draws a flat wash at that lane height:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_lct_haploblock.sh
bash build_lct_haploblock.sh          # builds ./lct_haploblock_build
```

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

[^plink19]:
    PLINK 1.9 does the same work under different spellings, and writes `.ld`
    where plink2 writes `.vcor`. JBrowse reads either.
