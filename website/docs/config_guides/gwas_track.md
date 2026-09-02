---
title: GWAS track
description:
  Preparing GWAS and LD files and configuring GWASTrack, GWASAdapter, and
  LinearManhattanDisplay
guide_category: Track types
---

**TL;DR:** a `GWASTrack` renders association results as a Manhattan plot. The
main work is prep: a bgzipped, tabix-indexed BED-like file whose score column is
in -log₁₀(p) units (or set `scoreTransform` to convert). Add a PLINK `.ld` file
and `colorBy: "ld"` to color points by linkage disequilibrium to an index SNP.

<Figure src="/img/gwas/manhattan.png" caption="A GWAS track rendered as a Manhattan plot: each point is a variant, plotted by genomic position (X) and -log₁₀(p-value) (Y), so association peaks rise above the background."/>

## Preparing the GWAS file

`GWASAdapter` reads a bgzipped, tabix-indexed BED-like file with a `#`-prefixed
header row whose score column is in **-log₁₀(p) units**.
[`scoreTransform`](/docs/config/gwasadapter/#slot-scoretransform) converts a raw
p-value column (`negLog10`) or a natural-log one (`negLog10FromLn`, a Pan-UKBB
`ln P` column) at read time. The `name` column (4th BED field) is the SNP id LD
lookups key on; without it they fall back to `chr:bp` (1-based).

```
#chrom  chromStart  chromEnd  name      neg_log_pvalue
chr1    109817590   109817591 rs4970383 1.234
chr1    110162459   110162460 rs4971059 7.891
```

Prefix the header so tabix skips it, then sort, bgzip and index:

```bash
sed '1s/^/#/' results.tsv | jbrowse sort-bed | bgzip > results.sorted.txt.gz
tabix -p bed results.sorted.txt.gz
```

`jbrowse sort-bed` is `sort -k1,1 -k2,2n` under `LC_ALL=C` with every `#` line
kept on top. A `.txt.gz` auto-detects as `GWASAdapter` in the Add track dialog;
another extension such as `.bed.gz` needs the adapter picked by hand.

## Preparing the LD file

LD data is PLINK's `--r2` table, from a binary fileset (`--bfile study`) or a
VCF (`--vcf study.vcf.gz`):

```bash
# "dprime" adds the D' column (DP)
plink --bfile study --r2 dprime with-freqs \
  --ld-window 99999 --ld-window-kb 1000 --ld-window-r2 0 \
  --out study
```

- **`--ld-window-r2 0`** keeps every pair; PLINK otherwise drops pairs below
  r²=0.2. The `--ld-window*` flags bound how far apart paired SNPs may be, so
  tune them to the span you want drawn
- **`dprime`** also switches r² to the haplotype-frequency estimate, so the R2
  column of a run with it and a run without it are two different statistics
- **This is PLINK 1.9**; plink2 replaced `--r2` with `--r2-phased` and
  `--r2-unphased`

A regional `study.ld` loads as-is with
[`PlinkLDAdapter`](/docs/config/plinkldadapter). For chromosome-scale or
genome-wide LD, bgzip and tabix it and use
[`PlinkLDTabixAdapter`](/docs/config/plinkldtabixadapter), which fetches only
the pairs in view; its page has the retab, `sort-bed` and `tabix` commands and
why the header is commented with `#`.

## Example

`colorBy: "ld"` on the display colors points by r² to the index SNP and needs an
`ldAdapter` sub-adapter on the `GWASAdapter`; swap in `PlinkLDTabixAdapter` for
an indexed `.ld.gz`. `color` takes a CSS literal or a `jexl:` expression per
feature, and `scatterPointSize` sets the point diameter in px
([](/docs/config/linearmanhattandisplay)):

```json addtrack
{
  "type": "GWASTrack",
  "trackId": "sle_gwas",
  "name": "SLE GWAS",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "GWASAdapter",
    "uri": "https://yourhost/sle.bed.gz",
    "scoreColumn": "neg_log_pvalue",
    "ldAdapter": {
      "type": "PlinkLDAdapter",
      "uri": "https://yourhost/sle.ld"
    }
  },
  "displayDefaults": {
    "colorBy": "ld"
  }
}
```

## See also

- [](/docs/user_guides/gwas_track)
- [Variant track: Linkage disequilibrium (LD) display](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display)
