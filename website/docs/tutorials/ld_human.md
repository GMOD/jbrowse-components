---
title: LD at a selective sweep (human)
sidebar_label: LD at a sweep (human)
description:
  Compute an LD triangle live from phased genotypes, and cut a window that shows
  the block's edges
guide_category: Tutorials
tutorial_category: Population genomics
---

**TL;DR:** an `LDDisplay` computes pairwise r² live from a phased VCF, no
precomputed LD file. At the lactase locus the swept haplotype draws one block.
Whether you can see that it is a block depends on the window you cut and on
which samples went in.

## Prerequisites

- nothing to read the figures, which load hosted data
- `bcftools`, htslib (`tabix`), `plink` (1.9, not plink2) and `curl` for the
  [reproduce script](#reproduce-it-end-to-end)

## Reading the triangle

Red means two variants are almost always inherited together, white means they
are independent, so the triangle shows where a stretch of chromosome travels as
a unit. The [`LDDisplay`](/docs/config/sharedlddisplay/) is per-population by
construction: r² is a correlation across whatever samples you hand it.

## A sweep leaves a long haplotype

Selection driving one haplotype to high frequency carries every variant on it
along, leaving a stretch of correlated variants.

<Figure src="/img/ld/lct_lactase.png" caption="LD at the human lactase locus on hg19. The ClinVar lane marks rs4988235; below it is haplotypic r² computed live from phased 1000 Genomes genotypes, with the recombination track above the triangle. The block ends at the banded gene, where the recombination curve spikes, and r² falls to near zero on both sides of it."/>

The blue curve is the recombination track
([`showRecombination`](/docs/config/sharedlddisplay/#slot-showrecombination)), 1
− r² between adjacent variants. It sits near zero across the block and spikes at
its edges.

### Cut the slice wider than the block

A slice that begins where the block begins cannot show that it ends, and renders
as a triangle filling the frame. The reproduce script prints r² against the
causal variant along the slice, which is how to pick the edges. The constraint
is the file rather than the view, so zooming out past the end of the file only
adds white.

### Subset the VCF to one panel

r² is computed across every sample in the file, so a whole callset correlates
across panels that have no shared history.

<Figure src="/img/ld/lct_pooled_vs_panel.png" caption="The same locus, window and MAF floor twice, differing only in which samples went in. Pooling every panel breaks the block into a mosaic and leaves the recombination curve spiky throughout; one panel resolves it into a single block with the curve flat across it."/>

Nothing about the display changed between those two lanes.

```bash
bcftools view -S panel.samples --force-samples -Oz -o panel.vcf.gz all.vcf.gz
tabix -p vcf panel.vcf.gz
```

The same applies to species, and more sharply: a panel mixing two species
invents LD that neither species has.

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
cuts the region out of the 1000 Genomes phase 3 callset without downloading it:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_lct_ld.sh
bash build_lct_ld.sh                  # writes ./lct_ld_build
```

The file it writes is genotypes; the display does the r². What the script prints
is the two choices behind the figure, as `plink --r2` tables: r² against
rs4988235 along the slice, and mean pairwise r² inside the block for one panel
against the pooled release.

## See also

- [](/docs/tutorials/ld_mosquitoes) for a region too large to compute live, and
  the checks to run before blaming the display
- [](/docs/tutorials/population_genomics) for the same panel-level contrast as a
  windowed scan rather than a pairwise matrix
- [](/docs/user_guides/variant_track)
- [](/docs/user_guides/gwas_track)
- [Variant track configuration](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display)
- [Gallery: variants and populations](/gallery/#variants)

## References

- 1000 Genomes Project Consortium (2015).
  [A global reference for human genetic variation](https://doi.org/10.1038/nature15393)
