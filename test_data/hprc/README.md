# HPRC release 2 zoom-out tier (chr6)

`hprc_chr6.summary.bed.gz` is the `summaryAdapter` file for the HPRC release 2
pangenome alignment — one row per haplotype per contiguous aligned run, with a
percent-identity score and no sequence. 35,200 rows, 185 KB, all 464 haplotypes,
covering chr6:71,779–170,755,775.

Built 2026-08-14 from the published v2.0 TAF, ~13 min for the chromosome:

```sh
export LC_ALL=C
taffy view -i hprc-v2.0-mc-grch38.full.taf.gz -r GRCh38.chr6:0-171000000 -m \
  | maf2bed GRCh38 --summary chr6.summary.bed > /dev/null
(head -1 chr6.summary.bed; tail -n +2 chr6.summary.bed | sort -k1,1 -k2,2n) \
  | bgzip > hprc_chr6.summary.bed.gz
tabix -p bed hprc_chr6.summary.bed.gz
```

`taffy view -r` does the indexed extraction, so only chr6's 354 MB of the 5.96
GB file is read; the MAF is never materialized (chr6 is ~90 GB of it at 464
haplotypes). `maf2bed` needs v0.6.0 or newer for `--summary`.

**chr6 only, deliberately for now.** The same command with `-r` dropped covers
the genome, at roughly 5 hours by the rate above. Nothing is broken off chr6 —
the track falls back to the too-large prompt exactly as it does today with no
summary at all.

**taffy has known trouble with pggb-produced files
([taffy#89](https://github.com/ComparativeGenomicsToolkit/taffy/issues/89)).**
This file is minigraph-cactus and taffy wrote it, and the extraction was checked
rather than assumed: against the independently built C4 summary in
`~/scratch/jbrowse-pangenome` (made from a MAF slice without `taffy view`), the
haplotype sets match exactly at 464/464, and the fully-aligned haplotypes cover
exactly the requested window in both.

What it is worth, measured through the app on whole chr6
(`agent-docs/reference/HPRC_RELEASE2.md` § "What the zoom-out tier is worth"):
354 Mb refused, against 250 kB drawn.
