---
title: LD across an inversion (mosquitoes)
description:
  Read precomputed PLINK LD over a 22 Mb inversion, and load the same inversion
  genotyped per mosquito
guide_category: Tutorials
tutorial_category: Population genomics
---

The 2La chromosomal inversion of the malaria mosquito _Anopheles gambiae_ spans
about 22 Mb and suppresses crossing over, so linkage disequilibrium runs across
it as one block. We compute the LD with `plink2 --r2-phased`, draw it with an
[`LDTrack`](/docs/config/ldtrack), and load the inversion as a structural
variant genotyped per mosquito beneath it.

## Prerequisites

- a JBrowse to paste the tracks into ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- [PLINK 2.0](https://www.cog-genomics.org/plink/2.0/) (`plink2`)
- htslib (`bgzip`, `tabix`)
- `samtools`
- `curl`
- `python3`
- `node`, for the [JBrowse CLI](/docs/cli)

## Where the data comes from

Ag1000G phase 2 AR1
([Anopheles gambiae 1000 Genomes Consortium 2020](https://doi.org/10.1101/gr.262790.120)),
whose terms of use were lifted in March 2022.

- the phased haplotypes and their sample list for chromosome arm 2L, which the
  commands subset to one population at a time:
  https://ngs.sanger.ac.uk/production/ag1000g/phase2/AR1/haplotypes/main/shapeit/
- the sample metadata the population lists come from, `CMgam` (Cameroon) and
  `GAgam` (Gabon):
  https://ngs.sanger.ac.uk/production/ag1000g/phase2/AR1/samples/samples.meta.txt
- the AgamP4 reference and its gene models, which the gene lane reads:
  https://ngs.sanger.ac.uk/production/ag1000g/phase3/genome/
- the 2La tag SNPs, the ~200 positions whose allele marks which arrangement a
  chromosome has, which each mosquito's karyotype is scored from
  ([Love et al. 2019](https://doi.org/10.1534/g3.119.400445)):
  https://raw.githubusercontent.com/rrlove/compkaryo/master/compkaryo/targets/2La_targets.txt
- the finished `CMgam` LD table, rehosted:
  https://jbrowse.org/demos/popgen/ag1000g_2L_CMgam.vcor.gz
- the 2La genotypes per mosquito:
  https://jbrowse.org/demos/popgen/ag1000g_2La_CMgam.vcf.gz
- the karyotype table the sample lane is grouped by:
  https://jbrowse.org/demos/popgen/ag1000g_2La_CMgam_samples.tsv

## Loading the AgamP4 assembly and genes

The LD table and the inversion calls use 2L coordinates of the AgamP4 reference,
so we load that assembly and its gene models first. The gene lane reads the
`AgamP4.12` annotation.

```json addassembly
{
  "name": "AgamP4",
  "sequence": {
    "adapter": {
      "type": "BgzipFastaAdapter",
      "uri": "https://jbrowse.org/demos/ag1000g/AgamP4.fa.bgz"
    }
  }
}
```

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "agamp4_genes",
  "name": "AgamP4.12 genes",
  "assemblyNames": ["AgamP4"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/demos/ag1000g/AgamP4.sorted.gff3.gz"
  }
}
```

## The 2La inversion as one LD block

Crossing over is suppressed in a 2La heterokaryotype, so the segment travels as
a unit. The inversion spans roughly 22 Mb of chromosome arm 2L. JBrowse draws LD
from a precomputed table, so PLINK correlates the variants and
[`PlinkLDTabixAdapter`](/docs/config/plinkldtabixadapter) reads its output.

## Precomputing 2L LD with PLINK

PLINK reads a binary fileset, so we first convert the phased VCF of common
variants into one. `--double-id` sets each family id to the sample id:

<!-- from: scripts/build_ag1000g_ld.sh -->

```bash
plink2 --vcf common.vcf --double-id --allow-extra-chr --make-bed --out common
```

Then thin the variants, correlate them, and index the table. `keep.CMgam.txt` is
the population, two tab-separated columns of the same sample id, the
family/individual pair plink asks for.

<!-- from: scripts/build_ag1000g_ld.sh -->

```bash
# the display uploads n(n-1)/2 cells, and ~800 SNPs across an arm already
# reach screen resolution, so keep roughly one variant per 50 kb
plink2 --bfile common --allow-extra-chr --keep keep.CMgam.txt --maf 0.2 \
  --chr 2L --write-snplist --out sel
awk -F'_' -v g=50000 '{p=$2+0; if (p >= nxt) {print $0; nxt = p + g}}' \
  sel.snplist > grid.snplist

# --r2-phased estimates r2 from haplotype frequencies, the statistic the
# display draws
# dprimeabs adds D' as a magnitude, the form the display reads
# --ld-window-r2 0 keeps the uncorrelated pairs
# PLINK 1.9 spells the pair `--r2 dprime`, with the columns at the same offsets
plink2 --bfile common --allow-extra-chr --keep keep.CMgam.txt \
  --extract grid.snplist \
  --r2-phased cols=chrom,pos,id,dprimeabs \
  --ld-window 999999 --ld-window-kb 1000000 --ld-window-r2 0 \
  --out ag1000g_2L_CMgam

# plink2 writes tabs and a commented header, which `tabix -H` returns
# sort-bed runs `sort -k1,1 -k2,2n` under LC_ALL=C and keeps the `#` line on
# top; this table sorts on the same first two columns
jbrowse sort-bed < ag1000g_2L_CMgam.vcor |
  bgzip > ag1000g_2L_CMgam.vcor.gz
tabix -s 1 -b 2 -e 2 -f ag1000g_2L_CMgam.vcor.gz
```

The track over that file is an `LDTrack`, and the display reads one of its two
metric columns:

```json addtrack
{
  "type": "LDTrack",
  "trackId": "ag1000g_2l_cmgam",
  "name": "Cameroon, both arrangements segregating (r²)",
  "assemblyNames": ["AgamP4"],
  "adapter": {
    "type": "PlinkLDTabixAdapter",
    "uri": "https://jbrowse.org/demos/popgen/ag1000g_2L_CMgam.vcor.gz"
  },
  "displays": [
    {
      "type": "LDTrackDisplay",
      "ldMetric": "r2",
      "variantLayout": "genomic",
      "showLegend": true,
      "height": 340
    }
  ]
}
```

## The inversion genotyped per mosquito

The 2La inversion also loads as one `<INV>` record spanning the breakpoints,
genotyped across every mosquito. The
[regular multi-sample variant display](/docs/user_guides/multivariant_track#regular-best-for-full-sv-detail)
draws each genotype at the call's true span. `END` is the far breakpoint and
each sample column holds one `GT`:

```text
#CHROM  POS       ID   REF  ALT    QUAL  FILTER  INFO                     FORMAT  AN0007-C  AN0009-C
2L      20524058  2La  N    <INV>  .     PASS    SVTYPE=INV;END=42165532  GT      0/0       0/1
```

The samples TSV has a `name` column matching the VCF sample ids and a
`karyotype` column naming the three classes: `2L+a/2L+a`, `2La/2L+a`, `2La/2La`,
the `+` marking the non-inverted arrangement.

Load each population as a `VariantTrack` whose adapter includes the samples TSV,
with a `LinearMultiSampleVariantDisplay` that bands (`facet`) and colors
(`rowColor`) rows by `karyotype`:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "ag1000g_2la_karyotype_cmgam",
  "name": "Cameroon, one row per mosquito",
  "assemblyNames": ["AgamP4"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/popgen/ag1000g_2La_CMgam.vcf.gz",
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/demos/popgen/ag1000g_2La_CMgam_samples.tsv"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "facet": {
        "field": "karyotype",
        "domain": ["2L+a/2L+a", "2La/2L+a", "2La/2La"]
      },
      "rowColor": "karyotype",
      "referenceDrawingMode": "skip"
    }
  ]
}
```

[`facet`](/docs/config/linearmultisamplevariantdisplay/#slot-facet) keeps the
karyotype classes contiguous, with its `domain` stacking them in dosage order,
and
[`referenceDrawingMode`](/docs/config/linearmultisamplevariantdisplay/#slot-referencedrawingmode)
`skip` fills the lane with the reference color and paints alt cells on top. The
display draws a row for every sample in the file and divides the lane height
among them, so each population gets a separate track. Gabon's two tracks are the
same configs with `CMgam` replaced by `GAgam` in the trackIds and file names:
`https://jbrowse.org/demos/popgen/ag1000g_2L_GAgam.vcor.gz`,
`https://jbrowse.org/demos/popgen/ag1000g_2La_GAgam.vcf.gz` and
`https://jbrowse.org/demos/popgen/ag1000g_2La_GAgam_samples.tsv`.

### The karyotype calls

The 2La breakpoints have been cloned and sequenced
([Sharakhov et al. 2006](https://doi.org/10.1073/pnas.0509683103)), and the
build script draws the call at that published extent
([White et al. 2007](https://doi.org/10.4269/ajtmh.2007.76.334) karyotyped
single mosquitoes by PCR across the junctions). The script scores the karyotype
of each mosquito from the tag SNPs, the in-silico method MalariaGEN ships for
its phase 3 release, Ag3: the mean number of alternate alleles across the tags,
rounded into a genotype. The score is trimodal, and the
[reproduce script](#reproduce-it-end-to-end) prints the histogram and the
karyotype breakdown per population.

## Reading the 2La LD block against the karyotype lanes

Stack the r² track of each population over the karyotype track of the same
population, one row per mosquito.

<Figure src="/img/ld/anopheles_2la.png" caption="Ag1000G chromosome arm 2L, the same window and settings throughout. Top: the published extents of 2La and of Vgsc, the two loci the blocks below sit on. r² fills the 2La extent in the Cameroon panel, which segregates both arrangements, and is empty over that span in Gabon, which is near-fixed for the standard arrangement."/>

The edges of the block line up with the published breakpoint coordinates, where
the karyotype lane beneath draws its calls. That lane adds which mosquitoes
carry the inversion, and the block sits over the panel whose rows hold both
arrangements.

- The second block, at the low-coordinate end of the arm in both panels, is
  _Vgsc_, the sodium channel whose codon-995 substitutions confer pyrethroid
  resistance ([Clarkson et al. 2021](https://doi.org/10.1111/mec.15845)).
- The 2La span is flat in Gabon. That population is near-fixed for the standard
  arrangement, so almost no chromosome pair is a heterokaryotype, and the few
  2La chromosomes fall below the MAF floor with the variants that tag them.

## Reproduce it end to end

[`build_ag1000g_ld.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ag1000g_ld.sh)
takes the published 2La span only as a probe window, and prints the evidence for
each choice it makes from there:

1. Each panel is one population, since correlation pooled across populations
   invents linkage none of them has. The script prints, per population, mean D'
   between variants more than 5 Mb apart inside the probe window and outside it,
   because only a population with both arrangements can show the block.
2. It keeps common variants, thins them to a grid, and writes each panel's r²
   and D' table.
3. It bins D' to distant partners along the whole arm. The steps up and down are
   the inversion's breakpoints, recovered from the data alone.
4. It scores each mosquito's karyotype from the tag SNPs, prints the score
   histogram, which has to come out with three peaks, and writes the `<INV>`
   calls and a `config.json` opening on the inversion.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ag1000g_ld.sh
bash build_ag1000g_ld.sh              # writes ./ag1000g_ld_build/jbrowse2
npx --yes serve ag1000g_ld_build/jbrowse2
```

## See also

- [](/docs/tutorials/ld_human)
- [](/docs/tutorials/population_genomics)
- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/variant_track)
- [](/docs/config_guides/variant_track)
- [](/docs/config_guides/grouping_and_ordering)

## Citations

- Anopheles gambiae 1000 Genomes Consortium (2020).
  [Genome variation and population structure among 1142 mosquitoes of the African malaria vector species Anopheles gambiae and Anopheles coluzzii](https://doi.org/10.1101/gr.262790.120)
- Clarkson et al. (2021).
  [The genetic architecture of target-site resistance to pyrethroid insecticides in the African malaria vectors Anopheles gambiae and Anopheles coluzzii](https://doi.org/10.1111/mec.15845)
- Love et al. (2019).
  [In silico karyotyping of chromosomally polymorphic malaria mosquitoes in the Anopheles gambiae complex](https://doi.org/10.1534/g3.119.400445)
- Sharakhov et al. (2006).
  [Breakpoint structure reveals the unique origin of an interspecific chromosomal inversion (2La) in the Anopheles gambiae complex](https://doi.org/10.1073/pnas.0509683103)
- White et al. (2007).
  [Molecular karyotyping of the 2La inversion in Anopheles gambiae](https://doi.org/10.4269/ajtmh.2007.76.334)
