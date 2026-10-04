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
there. At the _SMN1_/_SMN2_ duplication on chromosome 5, we tell the two apart
with tracks that genomes.jbrowse.org publishes for hg38 (reference mappability,
gnomAD coverage and problematic-region annotations) and a public 1000 Genomes
CRAM, added as a session track and colored by mapping quality. We then ask
whether the finished T2T-CHM13 reference resolves the duplication, and compare
the locus against a control window from the same sample.

## Prerequisites

- a JBrowse to open the hosted hg38 config in ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- to re-measure the numbers on this page, the tools listed under
  [Reproduce it end to end](#reproduce-it-end-to-end)

## Where the data comes from

The hosted lanes are files already wired into the
[genomes.jbrowse.org](https://genomes.jbrowse.org) hg38 config. The reads come
from the 1000 Genomes high-coverage short-read release and its ONT long-read
release ([Gustafson et al. 2024](https://doi.org/10.1101/gr.279273.124)).

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
- UCSC's problematic-regions comments:
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
identical across their ~28 kb. Spinal muscular atrophy turns on the copy number
of _SMN1_, so which copy a read came from is the clinical question. An aligner
given a 150 bp read from either copy has two equally good places to put it, and
reports that as MAPQ 0. The read is still drawn where it aligned. MAPQ is
`-10 log10 Pr{mapping position is wrong}`
([SAM specification](https://samtools.github.io/hts-specs/SAMv1.pdf)), so MAPQ 0
means the chosen position is about as likely wrong as right.

## Mappability, coverage and reads across the SMN block

Open the hosted hg38 config at
[genomes.jbrowse.org](https://genomes.jbrowse.org) and turn on these tracks from
the track selector. The lanes are plain bigWig and bigBed files, so the configs
below add them to any JBrowse with the hg38 assembly loaded. UCSC publishes the
mappability and problematic-region lanes for hg38 only:

- **Multi-read mappability - Umap M100**, the fraction of overlapping 100-mers
  at each position that are unique in the genome, computed from the reference
  alone. The file omits positions with no unique 100-mer, so the lane goes blank
  there. Set **Resolution → Summary score mode → Minimum**, which draws the
  worst position in each bin, and pin the axis at 0 to 1 with **Y axis... →
  Range**. In the 2.5 Mb frame, at about a kilobase per pixel, even **Minimum**
  sits on the floor everywhere, so read this lane in the narrower read view.
- **gnomAD v3 Genome Coverage - Mean Coverage**, averaged over tens of thousands
  of genomes. gnomAD drops reads that do not place uniquely before averaging, so
  this lane falls wherever the Umap lane is blank.
- **GIAB Problematic Regions - LowMap+SegDup**, the sequence GIAB leaves out of
  its benchmark.
- **Long-read SVs - 1KG Vienna ONT SVs**, the long-read callset.

The Umap config holds the **Minimum** score mode and the 0 to 1 axis:

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "hg38-umap100Quantitative",
  "name": "Multi-read mappability - Umap M100",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "https://hgdownload.soe.ucsc.edu/gbdb/hg38/hoffmanMappability/k100.Umap.MultiTrackMappability.bw"
  },
  "displays": [
    {
      "type": "LinearWiggleDisplay",
      "displayId": "hg38-umap100Quantitative-LinearWiggleDisplay",
      "summaryScoreMode": "min",
      "scales": { "y": { "domainMin": 0, "domainMax": 1 } }
    }
  ]
}
```

```json addtrack
{
  "trackId": "hg38-gnomad3MeanCoverage",
  "name": "gnomAD v3 Genome Coverage - Mean Coverage",
  "uri": "https://hgdownload.soe.ucsc.edu/gbdb/hg38/gnomAD/coverage/v3-genome/gnomad.coverage.mean.bw",
  "assemblyNames": ["hg38"]
}
```

```json addtrack
{
  "trackId": "hg38-alllowmapandsegdupregions",
  "name": "GIAB Problematic Regions - LowMap+SegDup",
  "uri": "https://hgdownload.soe.ucsc.edu/gbdb/hg38/problematic/GIAB/alllowmapandsegdupregions.bb",
  "assemblyNames": ["hg38"]
}
```

```json addtrack
{
  "trackId": "hg38-lrSv1kgOnt",
  "name": "Long-read SVs - 1KG Vienna ONT SVs",
  "uri": "https://hgdownload.soe.ucsc.edu/gbdb/hg38/lrSv/1kgOnt.bb",
  "assemblyNames": ["hg38"]
}
```

Then add the NA12878 reads, colored by mapping quality. The CRAM needs its
`.crai` beside it and decodes against the hg38 assembly; for your own sample,
swap the `uri`:

```json addtrack
{
  "trackId": "na12878_qc_reads",
  "name": "NA12878, 30x Illumina (1000 Genomes)",
  "uri": "https://s3.amazonaws.com/1000genomes/1000G_2504_high_coverage/data/ERR3239334/NA12878.final.cram",
  "assemblyNames": ["hg38"],
  "displayDefaults": { "color": { "field": "mapq" } }
}
```

Open `chr5:69,200,000-71,700,000` for the whole block, and a second view at
`chr5:70,850,000-71,500,000` for the reads.

<Figure src="/img/qc/smn_block_and_reads.png" caption="Two scales of the same place. Top, the block on chr5 with SMN2 and SMN1 banded: RefSeq genes, gnomAD mean coverage, GIAB's low-mappability and segmental-duplication regions, and the 1000 Genomes long-read SV callset. Below it, a second view from SMN1 to where the reads recover, with Umap k100 mappability and NA12878 reads colored by mapping quality." links="Open the wide view=qc/smn_problematic_regions,Open the read view=qc/smn_read_placement" />

The affected sequence is much larger than the gene. GIAB flags it as two long
intervals, chr5:69,533,889-71,009,585 and a second that starts a few kilobases
past its end, and the gnomAD lane stays low across both. Beyond them, GIAB flags
nothing larger than a few kilobases for megabases in either direction. In the
read view, the reads stay at MAPQ 0 until well past the end of _SMN1_, and the
Umap lane steps up at the same coordinate as the gnomAD coverage.

Zoom the read view to the SMN cassette, `chr5:70,889,000-70,989,000`.

<Figure src="/img/qc/smn1_evidence.png" caption="The SMN cassette, holding SERF1A, SMN1 and NAIP, with the same four lanes and one read per row. Almost every read is dark blue, mapped where it is drawn and fitting somewhere else just as well." links="Open this view=qc/smn1_evidence" />

Dark blue is MAPQ 0, a read that fits another place equally well; yellow is MAPQ
60 and above.

## The SMN duplication in T2T-CHM13

T2T-CHM13 is a finished assembly of this chromosome, so it could in principle
place reads that GRCh38 cannot. UCSC's hg38-to-CHM13 liftOver chains over the
block come back as several long chains that overlap each other, some of them
reversed:

```bash
tabix https://jbrowse.org/ucsc/hg38/liftOver/hg38ToHs1.over.pif.gz \
  tchr5:69200000-71700000
```

Drawn as a synteny view between the two assemblies, each chain is a ribbon. The
hosted hg38 config already has the track and loads hs1 with it. On another
JBrowse, load the hs1 assembly and the chain file, which names the genome it
lifts to as its query:

```json addassembly
{
  "name": "hs1",
  "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hs1/bigZips/hs1.2bit"
}
```

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "hg38_to_hs1_liftOver",
  "name": "hg38 to Human (hs1) liftOver",
  "assemblyNames": ["hs1", "hg38"],
  "adapter": {
    "type": "PairwiseIndexedPAFAdapter",
    "uri": "https://jbrowse.org/ucsc/hg38/liftOver/hg38ToHs1.over.pif.gz",
    "csi": true,
    "queryAssembly": "hs1",
    "targetAssembly": "hg38"
  }
}
```

<Figure src="/img/qc/smn_vs_t2t.png" caption="GRCh38 above, T2T-CHM13 below, each framed on that assembly's SMN2-to-SMN1 span and its flanks, ribbons from UCSC's liftOver chains and colored by strand. Three chains cross each other." links="Open this view=qc/smn_vs_t2t" />

The gene order is the same in both assemblies, _SMN2_ first and then _SMN1_. The
crossing chains join each GRCh38 copy to both CHM13 copies, so CHM13 has the
same duplication, with the two genes closer together.

Long reads test whether T2T-CHM13 places reads at _SMN1_ better than GRCh38
does. The 1000 Genomes ONT release aligned GM18501 to both references with the
same minimap2 pipeline, and `scan_mappability_qc.sh` prints the share of its
records over _SMN1_ at MAPQ 0 and at MAPQ 60 on each. The long reads place
better than the short reads at the same gene, and the MAPQ 0 share is the same
on both references.

## Depth and MAPQ at SMN1 and at a control window

`scan_mappability_qc.sh` counts the reads in equal windows over _SMN1_ and over
the right-hand end of the read view, from the same library, and the two come
back at the same depth. A coverage track with no MAPQ filter draws flat across
both. The MAPQ 0 share separates them, with most reads at _SMN1_ at MAPQ 0 and
almost none at the control.

The gnomAD lane shows the effect of a MAPQ filter on a depth track. Over _SMN1_
it drops to a fraction of the control's depth, because gnomAD dropped MAPQ 0
reads before averaging.

## Long-read SV calls across the SMN block

The long-read SV lane in the wide view is empty across the block.
`scan_mappability_qc.sh` counts calls over the flagged block and an equal-width
window on either side, and finds few inside and many on both sides, where the
older Database of Genomic Variants (DGV) merged catalogue,
https://hgdownload.soe.ucsc.edu/gbdb/hg38/dgv/dgvMerged.bb, has records
throughout. Over the whole chromosome, both catalogues put a larger share of
their calls inside the flagged regions than those regions' share of chr5.
Segmental duplications are copy-number variable, so real variation and artifacts
both concentrate there.

## Checking your own locus

The tracks above and a control window work anywhere in hg38. Turn on the four
tracks above with the same Umap settings, add your reads colored by mapping
quality, and put a second window of the same width, from the same sample and
outside every flagged interval, beside the first.

In numbers, the comparison is three `samtools` counts per window, `-q` being a
minimum MAPQ:

<!-- from: scripts/scan_mappability_qc.sh -->

```bash
samtools view -c "$CRAM" chr5:70,900,000-71,000,000            # every read
samtools view -c -q 1 "$CRAM" chr5:70,900,000-71,000,000       # placed at all
samtools view -c -q 60 "$CRAM" chr5:70,900,000-71,000,000      # placed uniquely
```

The Umap lane's value over a window is one command over the same bigWig:

<!-- from: scripts/scan_mappability_qc.sh -->

```bash
# positions with no unique 100-mer are absent from the file, so the share of
# the span that has any value is the number to read
bigWigToBedGraph -chrom=chr5 -start=70049000 -end=70077000 \
  k100.Umap.MultiTrackMappability.bw stdout |
  awk -v s=70049000 -v e=70077000 \
    '{cov += $3 - $2} END {printf "%.1f%% has a value\n", 100 * cov / (e - s)}'
```

Run both on the control window too, at the same width.

## Reproduce it end to end

[`scan_mappability_qc.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/scan_mappability_qc.sh)
produces every number on this page from the files the figures draw. It asks
whether a read can be placed at a locus several ways, and reads each answer
against a control:

1. Over _SMN1_, _SMN2_ and two controls, it measures how much of each window the
   Umap lane has a value for, gnomAD's mean depth, and the share of NA12878's
   reads at MAPQ 0. The near control is a window of the same width at the 5' end
   of _BDP1_, past both flagged intervals on the same chromosome, so sample,
   library and chromosome all match; _ACTB_ on chromosome 7 shows the near
   control is ordinary.
2. It lists which problematic-region tracks flag the block, and bins the gnomAD
   lane across it to find where the depth recovers.
3. It counts GM18501's long-read records over _SMN1_ at MAPQ 0 and MAPQ 60, once
   on each reference. The release aligned that sample to both with the same
   pipeline, so the two counts compare.
4. It counts each SV catalogue's calls inside the block and in a flank of about
   the same width on either side, and across chr5 the share of calls whose
   midpoint falls in a flagged region. Counting by midpoint gives a long record
   the same weight as a short one.

It needs kent tools (`bigWigInfo`, `bigWigToBedGraph`, `bigBedToBed`),
`bedtools`, `samtools`, `curl` and `awk`.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/scan_mappability_qc.sh
bash scan_mappability_qc.sh
```

The script prints its sections in the order this page uses them, and measures a
locus added to its `LOCI` list the same way.

## See also

- [](/docs/tutorials/sv_multisamples)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/user_guides/alignments_track)
- [](/docs/tutorials/genomes_synteny)
- [](/docs/tutorials/read_marks)

## Citations

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
