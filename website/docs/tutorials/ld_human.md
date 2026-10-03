---
title: LD at a selective sweep (human)
sidebar_label: LD at a sweep (human)
description:
  Precompute an LD triangle with PLINK, and cut a window that shows the block's
  edges
guide_category: Tutorials
tutorial_category: Population genomics
---

We look at linkage disequilibrium around the lactase gene, where selection for
lactase persistence left one long block of correlated variants. PLINK correlates
the phased genotypes and JBrowse draws the triangle from its output. With that
view we:

- read the edges of the block against Fst and a genetic map
- compare the swept population's triangle against the pooled release
- cluster a haplotype matrix into the block the triangle draws

## Prerequisites

- a JBrowse to paste the tracks into ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- `bcftools` built with libcurl
- htslib (`tabix`)
- `curl`
- `python3`
- `node`, for the [JBrowse CLI](/docs/cli)
- [`bedGraphToBigWig`](https://hgdownload.soe.ucsc.edu/admin/exe/), for the Fst
  lane
- [PLINK 1.9](https://www.cog-genomics.org/plink/) for the r² tables and
  [PLINK 2.0](https://www.cog-genomics.org/plink/2.0/) for the Fst lane and the
  frequency filter[^plink19]

## Where the data comes from

1000 Genomes 30x high-coverage from NYGC
([Byrska-Bishop et al. 2022](https://doi.org/10.1016/j.cell.2022.08.004)),
called natively on GRCh38.

- phased chromosome 2:
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20220422_3202_phased_SNV_INDEL_SV/1kGP_high_coverage_Illumina.chr2.filtered.SNV_INDEL_SV_phased_panel.vcf.gz
- the release's own unrelated set, whose SAMPLE_NAME column is
  `unrelated.samples`:
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/1000G_2504_high_coverage.sequence.index
- populations and superpopulations, narrowed to that unrelated set for
  `panel.samples` (EUR) and `rest.samples` (everything else):
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/20130606_g1k_3202_samples_ped_population.txt
- the two r² tables, one per cohort, as PLINK wrote them:
  https://jbrowse.org/demos/popgen/lct_1kg38_chr2_eur.ld.gz and
  https://jbrowse.org/demos/popgen/lct_1kg38_chr2_pooled.ld.gz
- the EUR slice they were computed from, rehosted:
  https://jbrowse.org/demos/popgen/lct_1kg38_chr2_eur_wide.vcf.gz
- the six-population slice the haplotype matrix reads:
  https://jbrowse.org/demos/popgen/lct_1kg38_chr2_6pop.vcf.gz

The gene, ClinVar and recombination lanes are tracks of the hosted UCSC hg38
[hub](/docs/user_guides/hub_url).

## The genome

The tables, the Fst lane and the haplotypes all use GRCh38 coordinates on chr2,
so the tracks below go on that assembly.

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

## Reading the triangle

Red means two variants are inherited together, white means independent. The
triangle is a matrix turned on its corner, so the vertical axis is the distance
between the two variants.

Point an [`LDTrack`](/docs/config/ldtrack) at the r² table
[PLINK wrote below](#correlate-the-variants-with-plink), in an hg38 session:

```json addtrack
{
  "type": "LDTrack",
  "trackId": "kgp_lct_ld",
  "name": "LCT lactase-persistence LD, 1000G European panel (r²)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "PlinkLDTabixAdapter",
    "uri": "https://jbrowse.org/demos/popgen/lct_1kg38_chr2_eur.ld.gz"
  },
  "displayDefaults": {
    "variantLayout": "genomic",
    "showLegend": true,
    "height": 360
  }
}
```

[`variantLayout`](/docs/config/ldtrackdisplay/#slot-variantlayout) sizes each
cell by genomic distance, and
[`ldMetric`](/docs/config/ldtrackdisplay/#slot-ldmetric) picks r² or D', both of
which this table has.

The block is a selective sweep. The allele that keeps lactase switched on into
adulthood, `rs4988235`, rose in frequency, and its neighbouring variants rose
with it ([Bersaglieri et al. 2004](https://doi.org/10.1086/421051)). The
[dbSNP report](https://www.ncbi.nlm.nih.gov/snp/rs4988235) for `rs4988235` lists
the ClinVar entry and frequency table.

## Cut the region out of the VCF

Cut the region twice: once over the whole release, once over the European panel
the sweep happened in. `unrelated.samples` and `panel.samples` list one sample
ID per line, as `-S` reads them.

<!-- from: scripts/build_lct_ld.sh -->

```bash
# -r fetches the 3.4 Mb region by range request from the 2.5 GB chromosome file
# -e drops symbolic SV records, which are spans; the display correlates
# allele indicators
bcftools view -r chr2:133800000-137200000 -S unrelated.samples \
  -e 'ALT[0]~"<"' -Oz -o pooled.vcf.gz \
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20220422_3202_phased_SNV_INDEL_SV/1kGP_high_coverage_Illumina.chr2.filtered.SNV_INDEL_SV_phased_panel.vcf.gz
tabix -p vcf pooled.vcf.gz

bcftools view -S panel.samples -Oz -o panel.vcf.gz pooled.vcf.gz
tabix -p vcf panel.vcf.gz
```

## Correlate the variants with PLINK

PLINK correlates allele indicators, so we first reduce each slice to biallelic
SNVs with one record per position and the IDs dropped:

<!-- from: scripts/build_lct_ld.sh -->

```bash
bcftools view -m2 -M2 -v snps panel.vcf.gz | bcftools norm -d both |
  bcftools annotate -x ID -Oz -o panel.snvs.vcf.gz
```

Then pick the common variants per cohort and correlate every pair; the MAF floor
keeps the table small enough for a browser to draw. The same reduction on
`pooled.vcf.gz` gives `pooled.snvs.vcf.gz` for the pooled table.

<!-- from: scripts/build_lct_ld.sh -->

```bash
# 0.35 is a high MAF floor, to keep the variants that tag the block
plink2 --vcf panel.snvs.vcf.gz --double-id --allow-extra-chr --output-chr chrM \
  --set-missing-var-ids @:# --maf 0.35 --chr chr2 --write-snplist --out sel

# dprime adds D' beside r2
# --ld-window-r2 0 keeps the uncorrelated pairs, drawn as white cells
# raise both --ld-window and --ld-window-kb, or the defaults clip this block at
# 10 variants or 1 Mb
plink --vcf panel.snvs.vcf.gz --double-id --allow-extra-chr --output-chr chrM \
  --set-missing-var-ids @:# --extract sel.snplist \
  --r2 dprime --ld-window 999999 --ld-window-kb 4000 --ld-window-r2 0 \
  --out lct_1kg38_chr2_eur

# tabix needs tab-separated columns and a commented header; plink pads with
# spaces
awk 'NR==1{$1=$1; print "#" $0; next} {$1=$1; print}' OFS='\t' \
  lct_1kg38_chr2_eur.ld | bgzip > lct_1kg38_chr2_eur.ld.gz
tabix -s 1 -b 2 -e 2 -f lct_1kg38_chr2_eur.ld.gz
```

## Compute Fst per variant

The Fst lane is `plink2 --fst` over `panel.samples` and `rest.samples`, written
as a bigWig for a [quantitative track](/docs/user_guides/quantitative_track):

<!-- from: scripts/build_lct_fst_scan.sh -->

```bash
# plink2 takes the two panels as one categorical phenotype, with FID beside IID
{ printf '#FID\tIID\tPOP\n'
  awk '{print $1"\t"$1"\tPANEL"}' panel.samples
  awk '{print $1"\t"$1"\tREST"}' rest.samples; } > fst_pops.txt

# method=wc is Weir and Cockerham; the plink2 default, Hudson, gives a
# different number
# --output-chr chrM writes the chromosome as chr2, matching the file
plink2 --vcf pooled.vcf.gz --double-id --output-chr chrM --pheno fst_pops.txt \
  --fst POP method=wc report-variants vcols=chrom,pos,fst --out fst_site

# 1-based site to bedGraph interval, dropping sites scored nan
awk 'NR>1 && $4!="nan" {printf "%s\t%d\t%d\t%.5f\n",$1,$2-1,$2,$4}' \
  fst_site.PANEL.REST.fst.var | sort -k1,1 -k2,2n > fst_site.bedgraph
printf 'chr2\t242193529\n' > hg38.chrom.sizes
bedGraphToBigWig fst_site.bedgraph hg38.chrom.sizes fst.bw
```

## The block at two scales

<Figure src="/img/ld/lct_sweep_two_scales.png" caption="Top, RefSeq genes and Weir and Cockerham Fst per variant across a wide span of chr2. Under the wedge, the same locus and allele-frequency floor twice, differing only in which samples went in, over that Fst lane at a separate scale and the deCODE genetic map." links="Wide scan=ld/lct_fst_scan,The two triangles=ld/lct_pooled_vs_panel"/>

- In the Fst lane at the top, the most differentiated sites in the window sit
  inside the block.
- The block fills the flat span of the
  [deCODE map](https://doi.org/10.1126/science.aau1043). The map counts
  crossovers in sequenced families rather than estimating them from LD, so it
  checks the triangle independently. Pooling the swept panel with populations
  the sweep never reached lightens the upper triangle.

## The haplotypes behind the triangle

A track over the six-population VCF, one lane below the triangle, draws the
haplotypes in equal-width columns, one row per chromosome. The samples TSV maps
each sample ID to its population, a `name` column and a `population` column, and
`rowColor` colors the rows by the second. For your own cohort, write that table
and point `samplesTsvLocation` at it:

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
      "type": "LinearMultiSampleVariantDisplay",
      "variantLayout": "columns",
      "renderingMode": "phased",
      "rowColor": "population",
      "minorAlleleFrequencyFilter": 0.35,
      "forceLoad": true,
      "height": 700
    }
  ]
}
```

Run the clustering two ways:

- from the track menu, **Clustering** → **Cluster rows by genotype...**
- baked into a session with the
  [`runClustering`](/docs/models/treesidebarmixin/) and
  [`clusterRegion`](/docs/models/treesidebarmixin/) model properties

<Figure src="/img/ld/lct_haploblock.png" caption="An LD triangle over the haplotypes it summarises: 1000 Genomes chromosomes at LCT/MCM6, one row each, clustered by genotype. The pale slab is one cluster of near-identical chromosomes, uniform across the block that fills the triangle above."/>

- In file order the matrix is a plaid. Clustering puts near-identical
  chromosomes together, so a swept haplotype forms one slab.
- The ClinVar lane marks `rs4988235`, which falls below the frequency floor of
  the matrix. The lane is the hub's ClinVar track filtered with
  `jexl:feature.phenotypeList=='LACTASE PERSISTENCE'`.

### The subsample behind the figure {#rows-have-to-be-worth-a-pixel}

Over the whole release each haplotype row falls below a pixel and blurs flat.
This figure reads a subsample of six populations, built by the third script
under [Reproduce it end to end](#reproduce-it-end-to-end). Its core is one
`bcftools` call over a list of 150 sample IDs, one per line, 25 from each
population:

<!-- from: scripts/build_lct_haploblock.sh -->

```bash
bcftools view -S sub.samples --force-samples -Oz -o lct_1kg38_chr2_6pop.vcf.gz pooled.vcf.gz
```

## Reproduce it end to end

[`build_lct_ld.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_ld.sh)
builds the triangles and the narrow Fst lane, and writes a ready-to-serve
config. It:

1. keeps the release's unrelated samples, since relatives share long haplotypes
   whether or not a sweep happened, and splits them into the European panel and
   everyone else
2. cuts a region wide enough to reach past both edges of the block, and prints
   mean r² against `rs4988235` along it, so the block's ends show in the data
3. cuts the European panel out of that same slice, so the pooled and panel
   triangles hold the same variants and differ only in their samples
4. correlates each cohort's common variants with PLINK, and scores Fst per
   variant between the panel and the rest

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_lct_ld.sh
bash build_lct_ld.sh                  # builds ./lct_ld_build/jbrowse2
npx --yes serve lct_ld_build/jbrowse2 # then open the printed URL
```

The wide Fst lane is a second file, from
[`build_lct_fst_scan.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_fst_scan.sh).
It scores the same panels with the same estimator over 40 Mb of chr2 with _LCT_
at its middle, one value per variant, because a window averages a sweep's few
differentiated variants into the many around them. It prints where `rs4988235`
ranks across the span.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_lct_fst_scan.sh
bash build_lct_fst_scan.sh            # builds ./lct_fst_scan_build
```

The [subsampled haplotype matrix](#rows-have-to-be-worth-a-pixel) is a third
file, from
[`build_lct_haploblock.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_haploblock.sh).
It takes the same number of unrelated samples from each of six populations, so
no population outweighs the rest in the clustering. The six span the
lactase-persistence allele from common to absent: CEU, FIN, PJL, TSI, YRI and
CHB. The script prints the allele's frequency in each, over the release and over
the subsample.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_lct_haploblock.sh
bash build_lct_haploblock.sh          # builds ./lct_haploblock_build
```

## A bigger span

Live LD from a VCF reaches a few Mb. [](/docs/tutorials/ld_mosquitoes) draws a
22 Mb inversion, past that, by thinning the variants to a grid before PLINK
correlates them.

## See also

- [](/docs/tutorials/ld_mosquitoes)
- [](/docs/tutorials/population_genomics)
- [](/docs/tutorials/analyze_trio)
- [](/docs/user_guides/variant_track)
- [](/docs/user_guides/gwas_track)
- [Variant track configuration](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display)

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
    PLINK 1.9 and PLINK 2.0 are separate programs, and the page runs both.
    plink2 gained `--r2-phased` in its a6 alphas, so on earlier builds the r²
    step needs PLINK 1.9. The
    [`PlinkLDTabixAdapter`](/docs/config/plinkldtabixadapter) reads the column
    names of either program from the header, so output from either loads.
