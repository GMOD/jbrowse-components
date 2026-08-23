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
JBrowse computes the r² triangle in the browser straight from a phased VCF, and
can also draw one from a table PLINK computed ahead of time, which is the route
a large cohort takes.

## Prerequisites

- nothing to read the figures, which load hosted data
- for the commands on this page and the
  [reproduce script](#reproduce-it-end-to-end): `bcftools` built with libcurl,
  htslib (`tabix`), `curl`, `python3`, and `node` for the
  [JBrowse CLI](/docs/cli)
- [vcftools](https://vcftools.github.io/) and
  [`bedGraphToBigWig`](https://hgdownload.soe.ucsc.edu/admin/exe/) for the Fst
  lane, plus [PLINK 2.0](https://www.cog-genomics.org/plink/2.0/) for the r²
  tables[^plink19]

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
a unit. r² is a correlation across whatever samples you hand it, so an
[`LDDisplay`](/docs/config/lddisplay/) always describes one set of samples.

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

r² is computed from the genotypes themselves, so a window this wide asks for
more data than a track fetches unasked, and the lane arrives as a "too much
data" banner with a FORCE LOAD button on it. Setting
[`forceLoad`](/docs/config/sharedlddisplay/#slot-forceload) is that button
pressed in advance, which is what a view nobody will click needs: a figure, an
embed, a notebook. `forceLoad` speaks for the one display that declares it,
while [`fetchSizeLimit`](/docs/config/sharedlddisplay/#slot-fetchsizelimit) sets
the ceiling for the whole track, at every locus.

JBrowse also draws a triangle from r² PLINK has already computed. An
[`LDTrack`](/docs/config/ldtrack) over a `plink --r2` file, PLINK 1.9's `.ld`
rather than the `.vcor` below, needs no genotypes in the browser, which is what
a cohort too large to correlate live wants, and
[](/docs/tutorials/ld_mosquitoes) takes that route over a 22 Mb inversion.

## Selection at the lactase locus

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

## Cut the region out of the VCF

The triangle is drawn from what the file holds, so the slice has to reach past
both edges of the block for those edges to be in frame. One region query cuts
it:

<!-- from: scripts/build_lct_ld.sh -->

```bash
# -r is a range request, so 3.4 Mb costs 3.4 Mb and not the 2.5 GB chromosome.
# -S is one sample name per line; -e drops the symbolic SV records, which are
# spans rather than the allele indicators the display correlates.
bcftools view -r chr2:133800000-137200000 -S unrelated.samples \
  -e 'ALT[0]~"<"' -Oz -o pooled.vcf.gz \
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20220422_3202_phased_SNV_INDEL_SV/1kGP_high_coverage_Illumina.chr2.filtered.SNV_INDEL_SV_phased_panel.vcf.gz
tabix -p vcf pooled.vcf.gz
```

How wide is wide enough is a question for the file rather than for the picture.
Running `plink2 --r2-phased` against the causal variant[^phased] gives r² to
every other variant in the slice, and binning that by position says where the
correlation falls away, which is where the window above comes from.

<!-- from: scripts/build_lct_ld.sh -->

```bash
# plink names a variant by position, and --set-missing-var-ids fills blanks
# only, so strip the release's own chr:pos:ref:alt IDs or --ld-snp matches
# nothing. --output-chr chrM keeps @ expanding to chr2 rather than to 2. One
# biallelic record per position is what r² is defined on anyway.
bcftools view -m2 -M2 -v snps pooled.vcf.gz | bcftools norm -d both |
  bcftools annotate -x ID -Oz -o pooled.snvs.vcf.gz

# --maf is the figure's own floor; --ld-window-r2 0 keeps the weak pairs, which
# at the edges are the answer. Bin anchor.vcor by position afterwards.
plink2 --vcf pooled.snvs.vcf.gz --double-id --allow-extra-chr --output-chr chrM \
  --set-missing-var-ids @:# --maf 0.35 \
  --r2-phased --ld-window 999999 --ld-window-r2 0 \
  --ld-snp chr2:135851076 --ld-window-kb 4000 --out anchor
```

## Subset the VCF to one panel

r² is computed across every sample in the file, so pooling panels that carry the
haplotype at different frequencies averages the correlation down, which is what
the pooled lane in the figure below is showing.

<!-- from: scripts/build_lct_ld.sh -->

```bash
bcftools view -S panel.samples -Oz -o panel.vcf.gz pooled.vcf.gz
tabix -p vcf panel.vcf.gz
```

The same run over a window instead of an anchor gives the mean pairwise r²
inside the block. Run it on both files and average each `block.vcor`'s r²
column:

<!-- from: scripts/build_lct_ld.sh -->

```bash
# no --ld-snp, so every pair inside the window rather than every pair sharing
# one variant. Same window and floor both ways, so only the samples differ.
plink2 --vcf panel.snvs.vcf.gz --double-id --allow-extra-chr --output-chr chrM \
  --set-missing-var-ids @:# --maf 0.35 \
  --r2-phased --ld-window 999999 --ld-window-r2 0 \
  --chr chr2 --from-bp 135000000 --to-bp 136150000 \
  --ld-window-kb 1200 --out block
```

The two lanes also end up drawing different variants, because
`minorAlleleFrequencyFilter` is a frequency in whatever samples the file holds:
a variant common in one panel and rare elsewhere clears the floor in the panel
file and falls below it in the pooled one.

## Compute Fst per variant

The Fst lane is [vcftools](https://vcftools.github.io/man_latest.html) over
`panel.samples` and `rest.samples`, written out as a bigWig for a
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

## The block at two scales

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
  enough to break a haplotype up. The map counts crossovers in sequenced
  families, so it carries no LD of its own, and it draws as an ordinary
  [quantitative track](/docs/user_guides/quantitative_track) on UCSC's bigWig.
  If you reach for a different recombination track in that hub, check how it was
  made: the HapMap and 1000 Genomes maps there are estimated from LD, so they
  cannot check a triangle independently.
- **The two triangles.** Remember that r² is a correlation across the samples
  you hand it, and this haplotype swept in Europe. Pool that panel with
  populations the haplotype never reached and their chromosomes go into the same
  correlation, where they carry a different background: every pair of variants
  then looks less correlated than it is inside either group, which is why the
  upper triangle is the paler and patchier of the two.

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

The highlight across both lanes in the figure is the 89 kb of LCT/MCM6 that
selection acted on.

<Figure src="/img/ld/lct_haploblock.png" caption="An LD triangle over the haplotypes it summarises: 1000 Genomes chromosomes at LCT/MCM6, one row each, clustered by genotype. The pale slab is one cluster of near-identical chromosomes, uniform across the block that fills the triangle above."/>

**Ordering is what makes a block visible.** In file order the same matrix is a
plaid at any size, because a block is a set of alleles travelling together and
which of them is the non-reference allele varies from site to site. Clustering
puts near-identical chromosomes next to each other, and a swept haplotype
carries little variation of its own, so it resolves into one slab.

`rs4988235` falls below the figure's own frequency floor, so the ClinVar lane
marks it independently of the columns the clustering ran on.
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
map and the haplotype matrix. The VCFs it writes hold genotypes only, and
JBrowse computes the r² from them as it draws the triangle.

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

[^phased]:
    `--r2-phased` is the haplotypic r² an `LDDisplay` computes, so a cell in
    these tables and a cell in the triangle are the same quantity. plink2's
    other r², `--r2-unphased`, is between genotype allele counts.

[^plink19]:
    PLINK 1.9 does the same work: `--r2 dprime` for the phased statistic and a
    bare `--r2` for the unphased one, writing `.ld` where plink2 writes `.vcor`.
