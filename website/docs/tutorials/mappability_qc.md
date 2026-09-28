---
title: Low-mappability regions (SMN)
sidebar_label: Low-mappability regions
description:
  Check whether a locus can support the calls made on it, using the mappability,
  coverage and problematic-region tracks genomes.jbrowse.org already publishes
guide_category: Tutorials
tutorial_category: Structural variation
---

A pileup looks the same whether its reads belong at a locus or merely landed
there. At _SMN1_ and _SMN2_, a duplicated gene pair on chromosome 5, we check
four hosted hg38 tracks against a control window, and then ask whether the
finished T2T-CHM13 assembly gives the reads a better place to land.

## Prerequisites

- a JBrowse to paste the tracks into ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- to re-measure the numbers on this page, the tools listed under
  [Reproduce it end to end](#reproduce-it-end-to-end)

## Where the data comes from

Every hosted lane here is a file already wired into the
[genomes.jbrowse.org](https://genomes.jbrowse.org) hg38 config, plus the 1000
Genomes high-coverage short-read CRAM and its ONT long-read release
([Gustafson et al. 2024](https://doi.org/10.1101/gr.279273.124)).

- Umap k100 multi-read mappability:
  https://hgdownload.soe.ucsc.edu/gbdb/hg38/hoffmanMappability/k100.Umap.MultiTrackMappability.bw
- gnomAD v3 mean genome coverage:
  https://hgdownload.soe.ucsc.edu/gbdb/hg38/gnomAD/coverage/v3-genome/gnomad.coverage.mean.bw
- GIAB's low-mappability and segmental-duplication regions:
  https://hgdownload.soe.ucsc.edu/gbdb/hg38/problematic/GIAB/alllowmapandsegdupregions.bb
- ENCODE's blacklist:
  https://hgdownload.soe.ucsc.edu/gbdb/hg38/problematic/encBlacklist.bb
- the GRC's exclusion list:
  https://hgdownload.soe.ucsc.edu/gbdb/hg38/problematic/grcExclusions.bb
- UCSC's own problematic-regions comments:
  https://hgdownload.soe.ucsc.edu/gbdb/hg38/problematic/comments.bb
- the DGV merged CNV catalogue:
  https://hgdownload.soe.ucsc.edu/gbdb/hg38/dgv/dgvMerged.bb
- the 1000 Genomes ONT long-read SV callset:
  https://hgdownload.soe.ucsc.edu/gbdb/hg38/lrSv/1kgOnt.bb
- NA12878 at 30x, GRCh38, the read track added to the session:
  https://s3.amazonaws.com/1000genomes/1000G_2504_high_coverage/data/ERR3239334/NA12878.final.cram
- UCSC's hg38-to-CHM13 liftOver chain set:
  https://jbrowse.org/ucsc/hg38/liftOver/hg38ToHs1.over.pif.gz
- GM18501 ONT long reads aligned to GRCh38, counted here since the bucket serves
  no CORS headers and so cannot be loaded as a track:
  https://s3.amazonaws.com/1000g-ont/PROCESSED_DATA/ALIGNED_TO_HG38/MINIMAP2_ALIGNED_BAMS/GM18501-ONT-hg38-R9-LSK110-guppy-sup-5mC.phased.bam
- the same sample aligned to T2T-CHM13:
  https://s3.amazonaws.com/1000g-ont/PROCESSED_DATA/ALIGNED_TO_CHM13/MINIMAP2_ALIGNED_BAMS/GM18501-ONT-chm13-R9-LSK110-guppy-sup-5mC.phased.bam

## The SMN1 and SMN2 duplication

_SMN1_ and _SMN2_ sit about 900 kb apart on chromosome 5 and are roughly 99.9%
identical across their ~28 kb. A 150 bp read from either copy has two equally
good places to align, which an aligner reports as MAPQ 0. MAPQ is
`-10 log10 Pr{mapping position is wrong}`
([SAM specification](https://samtools.github.io/hts-specs/SAMv1.pdf)), so MAPQ 0
means the chosen position is about as likely wrong as right. The distinction
matters clinically, because spinal muscular atrophy turns on the copy number of
_SMN1_.

## The block, and the reads inside it

<Figure src="/img/qc/smn_block_and_reads.png" caption="Two scales of the same place. Top, the block on chr5 with SMN2 and SMN1 banded: RefSeq genes, gnomAD mean coverage, GIAB's low-mappability and segmental-duplication regions, and the 1000 Genomes long-read SV callset. Below it, a second view from SMN1 to where the reads recover, with Umap k100 mappability and NA12878 reads colored by mapping quality." links="Open the wide view=qc/smn_problematic_regions,Open the read view=qc/smn_read_placement" />

The affected sequence is a block much larger than the gene. GIAB's interval
stops well short of where ENCODE's blacklist continues, and the gnomAD coverage
lane stays low across the span GIAB lets go of. In the lower view, reads do not
recover until well past the end of _SMN1_.

## What the lanes show

Each lane is computed independently:

- **Umap k100 multi-read mappability** comes from the reference alone: the
  fraction of overlapping 100-mers that are unique in the genome. Positions
  where no 100-mer is unique are absent from the file, so the lane goes blank.
  The default **Score → Summary score mode → Whiskers** paints a pixel full
  height if it touches one unique position. **Minimum** takes the worst position
  in the bin, which sits on the floor across the block, and past about a
  kilobase per pixel it saturates low. Pin the axis with **Score → Set min/max
  score...** at 0 to 1.
- **gnomAD v3 mean genome coverage** averages tens of thousands of genomes after
  dropping non-uniquely-placed reads, so it falls wherever the Umap lane is
  blank.
- **Mapping quality on the reads** is the aligner's per-read confidence. Dark
  blue is MAPQ 0 and yellow is MAPQ 60 and above.
- **GIAB low-mappability + segdup** is a published opinion of the same sequence.

<Figure src="/img/qc/smn1_evidence.png" caption="The SMN cassette, holding SERF1A, SMN1 and NAIP, with the same four lanes and one read per row. Almost every read is dark blue, mapped where it is drawn and fitting somewhere else just as well." links="Open this view=qc/smn1_evidence" />

All lanes except the reads come from the hosted hg38 config at
[genomes.jbrowse.org](https://genomes.jbrowse.org), under **Multi-read
mappability**, **gnomAD v3 Genome Coverage** and **Problematic Regions**. The
reads are the public 1000 Genomes NA12878 CRAM, which the figure's link opens
together with the lanes.

## Depth at the locus and at a control

`scan_mappability_qc.sh` counts reads in equal windows over _SMN1_ and over the
right-hand end of the frame, from the same library. The depth matches, so a
coverage track draws flat across both. The share of reads at MAPQ 0 separates
them: most at _SMN1_ and almost none at the control. The gnomAD lane shows the
same thing from the other side, dropping to a fraction of the control's depth
over _SMN1_ because it discards MAPQ 0 reads.

The same comparison is three counts per window, `-q` being a minimum MAPQ:

<!-- from: scripts/scan_mappability_qc.sh -->

```bash
samtools view -c "$CRAM" chr5:70,900,000-71,000,000            # every read
samtools view -c -q 1 "$CRAM" chr5:70,900,000-71,000,000       # placed at all
samtools view -c -q 60 "$CRAM" chr5:70,900,000-71,000,000      # placed uniquely
```

Run it on the control window too. The Umap lane has a number as well, the
fraction of a span carrying any value:

<!-- from: scripts/scan_mappability_qc.sh -->

```bash
# A position where NO 100-mer maps uniquely is absent from the file, so
# bigWigToBedGraph emits no interval there
bigWigToBedGraph -chrom=chr5 -start=70049000 -end=70077000 \
  k100.Umap.MultiTrackMappability.bw stdout |
  awk -v s=70049000 -v e=70077000 \
    '{cov += $3 - $2} END {printf "%.1f%% has a value\n", 100 * cov / (e - s)}'
```

## Does T2T-CHM13 resolve it?

T2T-CHM13 is a finished assembly of this chromosome, so a reader might expect
reads to place better there. UCSC's hg38 to CHM13 liftOver chains do not resolve
the block to one correspondence: they overlap each other on both sides, and some
run backwards.

<Figure src="/img/qc/smn_vs_t2t.png" caption="GRCh38 above, T2T-CHM13 below, each framed on that assembly's SMN2-to-SMN1 span, ribbons from UCSC's liftOver chains and colored by strand. Three chains cross each other." links="Open this view=qc/smn_vs_t2t" />

The gene order is the same in both assemblies, _SMN2_ first and then _SMN1_. The
two copies are similar enough that a chainer can join either to either. The
array is shorter in CHM13, with the genes closer together.

The 1000 Genomes ONT release aligned GM18501 to both references with the same
minimap2 pipeline. `scan_mappability_qc.sh` counts its records over _SMN1_ in
each assembly's own coordinates:

| reference | records | MAPQ 0 | MAPQ 60 |
| --------- | ------: | -----: | ------: |
| GRCh38    |     290 |  46.6% |    6.9% |
| T2T-CHM13 |     290 |  46.6% |    9.7% |

The long reads place better than the short reads do at the same gene, and 46.6%
still fit somewhere else as well in both assemblies. The complete assembly
carries the same two copies, so mapping quality at _SMN1_ does not improve.

## SV calls over the block

The long-read SV lane in the wide figure is empty across the block.
`scan_mappability_qc.sh` counts few calls from that callset inside the flagged
block and many on both sides, where the older DGV catalogue carries records
throughout. Over the whole of chr5, both catalogues put a larger share of their
calls inside the flagged regions than those regions' share of the chromosome
predicts, because segmental duplications are copy-number variable. A short-read
call over _SMN1_ therefore cannot be checked against its reads.

## Checking your own locus

Open the hosted hg38 config and turn on **Umap M100**, **gnomAD v3 Genome
Coverage - Mean Coverage** and the two problematic-regions tracks. Set **Umap
M100** to a 0 to 1 axis with each bin's minimum. Add your reads and choose
**Color by... → Mapping quality**, with **Show legend** on. Then take a second
window of the same width from the same sample, outside every flagged interval,
and compare the two.

## Reproduce it end to end

Every number on this page comes from
[`scripts/scan_mappability_qc.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/scan_mappability_qc.sh),
run against the same files the figures draw. It needs kent tools (`bigWigInfo`,
`bigWigToBedGraph`, `bigBedToBed`), `bedtools`, `samtools`, `curl` and `awk`,
downloads the four small annotation files it reads twice, and streams the rest.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/scan_mappability_qc.sh
bash scan_mappability_qc.sh
```

The script prints the mappability, coverage, region-annotation, MAPQ and callset
sections in the order this page uses them, so a locus swapped into its `LOCI`
list is measured the same way.

## See also

- [](/docs/tutorials/sv_multisamples)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/user_guides/alignments_track)
- [](/docs/tutorials/genomes_synteny)

## References

- Li H, Handsaker B, Wysoker A, et al.
  [The Sequence Alignment/Map format and SAMtools](https://doi.org/10.1093/bioinformatics/btp352).
  _Bioinformatics_ 25:2078-2079 (2009), and the current
  [SAM specification](https://samtools.github.io/hts-specs/SAMv1.pdf), which
  defines MAPQ as `-10 log10 Pr{mapping position is wrong}`.
- Li H, Ruan J, Durbin R.
  [Mapping short DNA sequencing reads and calling variants using mapping quality scores](https://doi.org/10.1101/gr.078212.108).
  _Genome Research_ 18:1851-1858 (2008), which introduced that estimator.
- Karimzadeh M, Ernst C, Kundaje A, Hoffman MM.
  [Umap and Bismap: quantifying genome and methylome mappability](https://doi.org/10.1093/nar/gky677).
  _Nucleic Acids Research_ 46:e120 (2018), the source of the k100 mappability
  track.
- Gustafson JA, Gibson SB, Damaraju N, et al.
  [High-coverage nanopore sequencing of samples from the 1000 Genomes Project to build a comprehensive catalog of human genetic variation](https://doi.org/10.1101/gr.279273.124).
  _Genome Research_ 34:2061-2073 (2024), the source of both the long-read SV
  callset in the wide figure and the GRCh38 / T2T-CHM13 read counts above.
