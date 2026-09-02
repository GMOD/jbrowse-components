---
title: LD across an inversion (mosquitoes)
description:
  Read precomputed PLINK LD over a 22 Mb inversion, and load the same inversion
  genotyped per mosquito
guide_category: Tutorials
tutorial_category: Population genomics
data: hosted
---

**TL;DR:** a 22 Mb inversion reads as one block, from `plink2 --r2-phased`
output through an [`LDTrack`](/docs/config/ldtrack). The same inversion also
loads as a structural variant genotyped per mosquito.

## Prerequisites

- a JBrowse to paste the tracks into ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop)); every file here is a URL, so Desktop
  needs nothing hosted
- [PLINK 2.0](https://www.cog-genomics.org/plink/2.0/) (`plink2`), labeled alpha
  for years despite being the version in general use
- htslib (`bgzip`, `tabix`)
- `samtools`
- `curl`
- `python3`
- `node`, for the [JBrowse CLI](/docs/cli)

## Where the data comes from

Ag1000G phase 2 AR1
([Anopheles gambiae 1000 Genomes Consortium 2020](https://doi.org/10.1101/gr.262790.120)),
whose terms of use were lifted in March 2022, so nothing here needs registration
or a data-access agreement.

- the phased haplotypes and their sample list for chromosome arm 2L, which the
  commands subset to one population at a time:
  https://ngs.sanger.ac.uk/production/ag1000g/phase2/AR1/haplotypes/main/shapeit/
- the sample metadata the population lists come from, `CMgam` (Cameroon) and
  `GAgam` (Gabon):
  https://ngs.sanger.ac.uk/production/ag1000g/phase2/AR1/samples/samples.meta.txt
- the AgamP4 reference and its gene models, which the gene lane reads:
  https://ngs.sanger.ac.uk/production/ag1000g/phase3/genome/
- the 2La tag SNPs, the ~200 positions whose allele says which arrangement a
  chromosome carries, which each mosquito's karyotype is scored from
  ([Love et al. 2019](https://doi.org/10.1534/g3.119.400445)):
  https://raw.githubusercontent.com/rrlove/compkaryo/master/compkaryo/targets/2La_targets.txt
- the finished `CMgam` LD table, rehosted so the track blocks on this page load
  without the build: https://jbrowse.org/demos/popgen/ag1000g_2L_CMgam.vcor.gz
- the 2La genotypes per mosquito:
  https://jbrowse.org/demos/popgen/ag1000g_2La_CMgam.vcf.gz
- the karyotype table the sample lane is grouped by:
  https://jbrowse.org/demos/popgen/ag1000g_2La_CMgam_samples.tsv

## The 2La inversion as one LD block

Crossing over is suppressed in a 2La heterokaryotype, so the segment travels as
a unit. The inversion spans roughly 22 Mb of chromosome arm 2L in _Anopheles
gambiae_, past what can be computed live from a VCF, so the LD is precomputed
with PLINK and read through
[`PlinkLDTabixAdapter`](/docs/config/plinkldtabixadapter).

## Precompute the LD with PLINK

Three steps: thin the variants, correlate them, index the table.
`keep.CMgam.txt` is the population, two tab-separated columns of the same sample
id, the family/individual pair plink asks for.

<!-- from: scripts/build_ag1000g_ld.sh -->

```bash
# the display uploads n(n-1)/2 cells, and ~800 SNPs across an arm is already at
# screen resolution, so keep roughly one variant per 50 kb rather than every
# variant the callset has
plink2 --bfile common --allow-extra-chr --keep keep.CMgam.txt --maf 0.2 \
  --chr 2L --write-snplist --out sel
awk -F'_' -v g=50000 '{p=$2+0; if (p >= nxt) {print $0; nxt = p + g}}' \
  sel.snplist > grid.snplist

# --r2-phased is the haplotype-frequency estimate rather than a correlation
# between dosages, which is what the display draws; dprimeabs adds D' beside it
# as a magnitude, which is how the display reads a precomputed cell.
# --ld-window-r2 0 keeps the uncorrelated pairs. On PLINK 1.9 the pair is one
# flag, `--r2 dprime`, and the columns come out at the same offsets.
plink2 --bfile common --allow-extra-chr --keep keep.CMgam.txt \
  --extract grid.snplist \
  --r2-phased cols=chrom,pos,id,dprimeabs \
  --ld-window 999999 --ld-window-kb 1000000 --ld-window-r2 0 \
  --out ag1000g_2L_CMgam

# plink2 writes tabs and comments its own header, which is what `tabix -H`
# returns. `sort-bed` is `sort -k1,1 -k2,2n` under LC_ALL=C with that `#` line
# kept on top, which is what this table wants too: same first two columns.
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
  "assemblyNames": ["anoGam3"],
  "adapter": {
    "type": "PlinkLDTabixAdapter",
    "uri": "https://jbrowse.org/demos/popgen/ag1000g_2L_CMgam.vcor.gz"
  },
  "displays": [
    {
      "type": "LDTrackDisplay",
      "ldMetric": "r2",
      "useGenomicPositions": true,
      "showLegend": true,
      "height": 340
    }
  ]
}
```

## The inversion genotyped per mosquito

The same inversion loads as one `<INV>` record spanning the breakpoints,
genotyped across every mosquito. The
[regular multi-sample variant display](/docs/user_guides/multivariant_track#regular-best-for-full-sv-detail)
draws each genotype at the call's true span. The `karyotype` column names the
three classes: `2L+a/2L+a`, `2La/2L+a`, `2La/2La`, the `+` marking the
non-inverted arrangement.

Load each population as a `VariantTrack` whose adapter carries the samples TSV,
with a `LinearMultiSampleVariantDisplay` that orders (`groupBy`) and colors
(`colorBy`) rows by `karyotype`:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "ag1000g_2la_karyotype_cmgam",
  "name": "Cameroon, one row per mosquito",
  "assemblyNames": ["anoGam3"],
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
      "groupBy": "karyotype",
      "colorBy": "karyotype",
      "referenceDrawingMode": "skip"
    }
  ]
}
```

[`groupBy`](/docs/config/linearmultisamplevariantdisplay/#slot-groupby) keeps
the karyotype classes contiguous, and
[`referenceDrawingMode`](/docs/config/linearmultisamplevariantdisplay/#slot-referencedrawingmode)
`skip` fills the lane with the reference color and paints alt cells on top. Rows
divide the lane's height between them, and the display draws a row for every
sample in the file, which makes each population its own track.

### The karyotype calls

2La's breakpoints have been cloned and sequenced
([Sharakhov et al. 2006](https://doi.org/10.1073/pnas.0509683103)), and the call
is drawn at that published extent
([White et al. 2007](https://doi.org/10.4269/ajtmh.2007.76.334) karyotyped
single mosquitoes by PCR across the junctions). Each mosquito's karyotype here
is scored from the tag SNPs, the in-silico method MalariaGEN ships for Ag3: the
mean number of alternate alleles across the tags, rounded into a genotype. The
score is trimodal, and the [reproduce script](#reproduce-it-end-to-end) prints
the histogram and the karyotype breakdown per population.

## The block on the karyotype lanes

Each population's r² heatmap stacks over its own karyotype lane, one row per
mosquito.

<Figure src="/img/ld/anopheles_2la.png" caption="Ag1000G chromosome arm 2L, the same window and settings throughout. Top: the published extents of 2La and of Vgsc, the two loci the blocks below sit on. r² fills the 2La extent in the Cameroon panel, which segregates both arrangements, and is empty over that span in Gabon, which is near-fixed for the standard arrangement."/>

The block's edges land on the published breakpoint coordinates, and on the
karyotype lane beneath, drawn at the same coordinates from a different file.

- **The second block is _Vgsc_**, at the low-coordinate end of the arm in both
  panels: the sodium channel whose codon-995 substitutions confer pyrethroid
  resistance ([Clarkson et al. 2021](https://doi.org/10.1111/mec.15845))
- **Gabon's 2La span reads flat.** It is near-fixed for the standard
  arrangement, so almost no chromosome pair is a heterokaryotype, and the few
  2La chromosomes fall below the MAF floor with the variants that tag them

## Which metric recovers the breakpoints

D' saturates wherever no recombinant haplotype has turned up, so it reads on
where crossing over stops. The [reproduce script](#reproduce-it-end-to-end)
switches to it to recover the 2La breakpoints from the table;
[the guide](/docs/config_guides/variant_track#which-metric-and-how-far-to-thin)
covers both metrics and the allele-frequency floor.

## Reproduce it end to end

[`build_ag1000g_ld.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ag1000g_ld.sh)
downloads the phased haplotypes, prints the long-range D' profile, the 2La score
distribution and the karyotype breakdown per population, builds the `.vcor.gz`
tracks and the karyotype calls, and writes a `config.json` opening on the
inversion:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ag1000g_ld.sh
bash build_ag1000g_ld.sh              # writes ./ag1000g_ld_build/jbrowse2
npx --yes serve ag1000g_ld_build/jbrowse2
```

## The same karyotype track in Drosophila

[](/docs/tutorials/population_genomics) builds the same one-record karyotype
track for an 11 Mb Drosophila inversion.

## See also

- [](/docs/tutorials/ld_human)
- [](/docs/tutorials/population_genomics)
- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/variant_track)
- [](/docs/config_guides/variant_track)
- [Gallery: variants and populations](/gallery/#variants)

## References

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
