---
title: LD at a selective sweep (human)
sidebar_label: LD at a sweep (human)
description:
  Precompute an LD triangle with PLINK, and cut a window that shows the block's
  edges
guide_category: Tutorials
tutorial_category: Population genomics
---

We look at linkage disequilibrium (LD) around the lactase gene, where selection
for lactase persistence left one long block of correlated variants. PLINK
correlates the phased genotypes and JBrowse draws the triangle from its output.
With that view we:

- read the edges of the block against Fst and a genetic map
- compare the swept population's triangle against the pooled release
- cluster a haplotype matrix into the block the triangle draws
- draw each population's allele frequency across the block

## Prerequisites

- a JBrowse to paste the tracks into ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- `bcftools` built with libcurl
- htslib (`tabix`)
- `curl`
- `python3`
- `node`, for the [JBrowse CLI](/docs/cli)
- [`bedGraphToBigWig`](https://hgdownload.soe.ucsc.edu/admin/exe/), for the Fst
  track
- [PLINK 1.9](https://www.cog-genomics.org/plink/) for the r² tables and
  [PLINK 2.0](https://www.cog-genomics.org/plink/2.0/) for the Fst track and the
  frequency filter[^plink19]

## Where the data comes from

1000 Genomes 30x high-coverage from NYGC
([Byrska-Bishop et al. 2022](https://doi.org/10.1016/j.cell.2022.08.004)),
called natively on GRCh38.

The [build scripts](#reproduce-it-end-to-end) take these files from their URLs,
so there is nothing to download by hand.

- phased chromosome 2:
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20220422_3202_phased_SNV_INDEL_SV/1kGP_high_coverage_Illumina.chr2.filtered.SNV_INDEL_SV_phased_panel.vcf.gz
- the release's own unrelated set, whose SAMPLE_NAME column is
  `unrelated.samples`:
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/1000G_2504_high_coverage.sequence.index
- populations and superpopulations, narrowed to that unrelated set for
  `panel.samples` (EUR) and `rest.samples` (everything else):
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/20130606_g1k_3202_samples_ped_population.txt

The gene, ClinVar and recombination tracks come from the hosted UCSC hg38
[hub](/docs/user_guides/hub_url).

## Loading the hg38 assembly

The tables, the Fst track and the haplotypes all use GRCh38 coordinates on chr2,
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

## Drawing the LCT LD triangle from a PLINK table

In the triangle, red means two variants are inherited together and white means
independent. The triangle is a matrix turned on its corner, so the vertical axis
is the distance between the two variants.

Point an [`LDTrack`](/docs/config/ldtrack) at the r² table (squared correlation
per variant pair) [PLINK wrote below](#correlating-the-lct-variants-with-plink),
in an hg38 session:

```json addtrack loc=chr2:134,400,000-136,900,000
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

The block is the lactase-persistence sweep
([Bersaglieri et al. 2004](https://doi.org/10.1086/421051)).
[`color.field`](/docs/config/ldcolor/#slot-field) picks r² or D' (a second LD
measure), and this table has both.

## Cutting the LCT region out of the 1000 Genomes VCF

Cut the region twice: over the whole release, and over its European samples (the
panel, where the sweep happened). `*.samples` files list one ID per line.

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

## Correlating the LCT variants with PLINK

PLINK correlates allele indicators, so we first reduce each slice to biallelic
SNVs with one record per position and the IDs dropped:

<!-- from: scripts/build_lct_ld.sh -->

```bash
bcftools view -m2 -M2 -v snps panel.vcf.gz | bcftools norm -d both |
  bcftools annotate -x ID -Oz -o panel.snvs.vcf.gz
```

Then pick common variants per cohort and correlate every pair. PLINK's table
holds one row per pair, so the minor allele frequency (MAF) floor keeps it small
enough for a browser to draw. [](/docs/tutorials/ld_mosquitoes) draws a 22 Mb
inversion by thinning the variants to a grid before PLINK correlates them. The
same reduction on `pooled.vcf.gz` gives `pooled.snvs.vcf.gz` for the pooled
table.

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

## Computing Fst per variant with plink2

Fst, how far apart two groups' allele frequencies sit, comes from `plink2 --fst`
over `panel.samples` and `rest.samples`, as a bigWig for a
[quantitative track](/docs/user_guides/quantitative_track):

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

The Fst track lowers the adapter's `resolutionMultiplier`. Zoomed out, a bigWig
serves summary bins, and a bin's average sinks the few differentiated variants
into the many around them:

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "kgp_lct_fst",
  "name": "Fst, European panel vs the other 1000 Genomes samples (Weir & Cockerham)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "https://jbrowse.org/demos/popgen/lct_1kg38_chr2_fst_eur_vs_rest.bw",
    "resolutionMultiplier": 0.001
  }
}
```

## The LCT block against Fst and the deCODE map

Open the region the slice covers with that Fst track, the hub's **Recomb Rate -
Recomb. deCODE Avg** track, and two copies of the `LDTrack` above, the second
pointed at `https://jbrowse.org/demos/popgen/lct_1kg38_chr2_pooled.ld.gz`:

<Figure src="/img/ld/lct_sweep_two_scales.png" caption="Top: RefSeq genes and Weir and Cockerham Fst per variant across a wide span of chr2. Bottom: two LD triangles at one locus and allele-frequency floor, differing only in which samples went in, over the same Fst track and the deCODE genetic map." links="Wide scan=ld/lct_fst_scan,The two triangles=ld/lct_pooled_vs_panel"/>

- In the Fst track at the top, the most differentiated sites in the window sit
  inside the block.
- The block fills the flat span of the
  [deCODE map](https://doi.org/10.1126/science.aau1043). The map counts
  crossovers in sequenced families, so it checks the triangle independently of
  LD.
- Pooling the swept European samples with populations the sweep never reached
  lightens the pooled triangle.

## Clustering LCT haplotypes into the block the triangle draws

The triangle summarises haplotypes, the variants each chromosome carries along
the block. A track over the six-population VCF draws them below it in
equal-width columns, one row per chromosome. For your own cohort, write a
samples TSV with a `name` column and a `population` column and point
`samplesTsvLocation` at it:

```json addtrack loc=chr2:134,400,000-136,900,000
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
      "unit": "haplotype",
      "rowColor": "population",
      "minorAlleleFrequencyFilter": 0.35,
      "forceLoad": true,
      "height": 700
    }
  ]
}
```

Cluster the rows by genotype two ways:

- from the track menu, **Clustering** → **Cluster rows by genotype...**
- baked into a session with the
  [`runClustering`](/docs/models/treesidebarmixin/) and
  [`clusterRegion`](/docs/models/treesidebarmixin/) model properties

<Figure src="/img/ld/lct_haploblock.png" caption="An LD triangle over the haplotypes it summarises: 1000 Genomes chromosomes at LCT/MCM6, one row each, clustered by genotype. The pale slab is one cluster of near-identical chromosomes, uniform across the block that fills the triangle above."/>

- In file order the matrix is a plaid. Clustering puts near-identical
  chromosomes together, so a swept haplotype forms one slab.
- The ClinVar track marks `rs4988235`, which falls below the frequency floor of
  the matrix. It is the hub's ClinVar track filtered with
  `jexl:feature.phenotypeList=='LACTASE PERSISTENCE'`.

### Subsampling six populations for the haplotype matrix {#rows-have-to-be-worth-a-pixel}

Over the whole release each haplotype row falls below a pixel, so the figure
reads 25 samples from each of six populations. The core of the script behind it
is one `bcftools` call over a list of 150 sample IDs, one per line:

<!-- from: scripts/build_lct_haploblock.sh -->

```bash
bcftools view -S sub.samples --force-samples -Oz -o lct_1kg38_chr2_6pop.vcf.gz pooled.vcf.gz
```

## Allele frequency per population across the LCT block {#allele-frequency-per-population}

Twenty-five people from each of the six populations are enough to sort
haplotypes and too few to read a frequency off. So `bcftools +fill-tags`
computes each population's allele frequency over all of its unrelated samples
and writes it into one INFO field per population. Its `-S` table holds a sample
ID and a group on each line, tab-separated, so the same command takes any
grouping:

<!-- from: scripts/build_lct_population_af.sh -->

```bash
# -S gives fill-tags the groups, and -t AF writes AF_<group> for each
# norm -d both keeps one record per position, so no two bedGraph intervals
# overlap
bcftools view -m2 -M2 -v snps -Ou pooled.vcf.gz |
  bcftools norm -d both -Ou |
  bcftools +fill-tags -Ou -- -S pops.txt -t AF |
  bcftools query \
    -f '%CHROM\t%POS0\t%END\t%AF_CEU\t%AF_FIN\t%AF_PJL\t%AF_TSI\t%AF_YRI\t%AF_CHB\n' \
    > af.tsv

# one bedGraph per population, columns 4 to 9 of af.tsv, then a bigWig each
printf 'chr2\t242193529\n' > hg38.chrom.sizes
column=4
for pop in CEU FIN PJL TSI YRI CHB; do
  cut -f 1-3,$column af.tsv > "af_$pop.bedgraph"
  bedGraphToBigWig "af_$pop.bedgraph" hg38.chrom.sizes "lct_1kg38_chr2_af_$pop.bw"
  column=$((column + 1))
done
```

A [`MultiQuantitativeTrack`](/docs/config_guides/quantitative_track) draws the
six bigWigs as a row each, on one axis from 0 to 1:

```json addtrack loc=chr2:135,844,000-135,858,000
{
  "type": "MultiQuantitativeTrack",
  "trackId": "kgp_lct_population_af",
  "name": "Allele frequency per population, 1000 Genomes unrelated samples",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "source": "CEU",
        "color": "#4e79a7",
        "uri": "https://jbrowse.org/demos/popgen/lct_1kg38_chr2_af_CEU.bw"
      },
      {
        "type": "BigWigAdapter",
        "source": "FIN",
        "color": "#e15759",
        "uri": "https://jbrowse.org/demos/popgen/lct_1kg38_chr2_af_FIN.bw"
      },
      {
        "type": "BigWigAdapter",
        "source": "PJL",
        "color": "#76b7b2",
        "uri": "https://jbrowse.org/demos/popgen/lct_1kg38_chr2_af_PJL.bw"
      },
      {
        "type": "BigWigAdapter",
        "source": "TSI",
        "color": "#59a14f",
        "uri": "https://jbrowse.org/demos/popgen/lct_1kg38_chr2_af_TSI.bw"
      },
      {
        "type": "BigWigAdapter",
        "source": "YRI",
        "color": "#edc948",
        "uri": "https://jbrowse.org/demos/popgen/lct_1kg38_chr2_af_YRI.bw"
      },
      {
        "type": "BigWigAdapter",
        "source": "CHB",
        "color": "#f28e2b",
        "uri": "https://jbrowse.org/demos/popgen/lct_1kg38_chr2_af_CHB.bw"
      }
    ]
  },
  "displayDefaults": {
    "height": 300,
    "scales": { "y": { "domainMin": 0, "domainMax": 1 } }
  }
}
```

Open it over `chr2:135,844,000-135,858,000`, the stretch of _MCM6_ that holds
`rs4988235`:

<Figure src="/img/ld/lct_population_af.png" caption="RefSeq genes, ClinVar's lactase-persistence variants, and the alternate allele frequency of each biallelic SNV in six 1000 Genomes populations, a row each on one axis, across MCM6. The highlight marks rs4988235, whose bar falls from CEU to TSI and is absent in YRI and CHB."/>

- At `rs4988235` the allele is common in the two northern European populations
  (CEU, FIN) and rarer in PJL (Punjabi) and TSI (Tuscan), the spread
  [Bersaglieri et al. (2004)](https://doi.org/10.1086/421051) describe.
- The YRI (Yoruba) and CHB (Han Chinese) rows carry common variants elsewhere in
  the window, at sites where the other four are low.

## Reproduce it end to end

[`build_lct_ld.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_ld.sh)
builds the triangles and the narrow Fst track, and writes a ready-to-serve
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

Three more scripts build the other files:

- [`build_lct_fst_scan.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_fst_scan.sh)
  writes the wide Fst track. It scores the same panels with the same estimator
  over 40 Mb of chr2 with _LCT_ at its middle, one value per variant, and prints
  where `rs4988235` ranks across the span.
- [`build_lct_haploblock.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_haploblock.sh)
  builds the [subsampled haplotype matrix](#rows-have-to-be-worth-a-pixel). It
  takes the same number of unrelated samples from each of CEU, FIN, PJL, TSI,
  YRI and CHB, which span the lactase-persistence allele from common to absent,
  so no population outweighs the rest in the clustering. It prints the allele's
  frequency in each, over the release and over the subsample.
- [`build_lct_population_af.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_lct_population_af.sh)
  builds the [per-population frequencies](#allele-frequency-per-population). It
  reads the pooled slice, takes every unrelated sample of the six populations,
  and prints the frequencies at `rs4988235` so the bars can be checked against
  them.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_lct_fst_scan.sh
bash build_lct_fst_scan.sh            # builds ./lct_fst_scan_build
```

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_lct_haploblock.sh
bash build_lct_haploblock.sh          # builds ./lct_haploblock_build
```

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_lct_population_af.sh
bash build_lct_population_af.sh       # builds ./lct_population_af_build
```

## See also

- [](/docs/tutorials/ld_mosquitoes)
- [](/docs/tutorials/population_genomics)
- [](/docs/tutorials/analyze_trio)
- [](/docs/user_guides/variant_track)
- [](/docs/user_guides/gwas_track)
- [Variant track configuration](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display)

## Citations

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
