---
title: Methylation (long-read)
description:
  Per-read, aggregate, and allele-specific 5mC from HG002 nanopore reads
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

**TL;DR:** JBrowse reads DNA methylation straight from the MM/ML tags nanopore
and PacBio basecallers write. This tutorial follows one dataset, HG002 nanopore
reads over an imprinting center, from per-read calls to an aggregate profile to
the two parental alleles pulled apart.

## Prerequisites

- nothing to install to read along: every figure loads hosted data
- for your own data, long reads whose BAM or CRAM already carries `MM`/`ML`
  modification tags, which modern ONT and PacBio basecallers write by default,
  plus a JBrowse instance to load them into (the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop), which opens a local modBAM
  with no hosting step)
- [modkit](https://github.com/nanoporetech/modkit/releases) for the aggregate
  section only, a single-binary download from its releases page

## The locus

The locus is the SNRPN / Prader-Willi imprinting center on chr15, where one
parental allele is methylated and the other is not. That makes it a dataset with
its own control: whatever the views show has to come out as two populations, not
one intermediate blur, and both the reads and the aggregate profile have to
agree on which allele is which.

## Per-read methylation from the alignments

Load the modBAM as an `AlignmentsTrack`. Its `assemblyNames` must match an
assembly already configured in JBrowse (see the
[assemblies configuration guide](/docs/config_guides/assemblies)), and the
`.bai` index sits beside the file:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "HG002_snrpn_5mC_reads",
  "name": "HG002 ONT reads (5mC, haplotagged)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BamAdapter",
    "uri": "https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam"
  }
}
```

Set **Color by → Modifications** from the track menu and each read is painted
with its own 5mC calls, no extra processing and no methylation caller. Two modes
are offered: one paints only the positions the MM tag reports as modified, the
other (IGV's "2-color" scheme) also fills in every CpG the tag left implicit, so
an unmethylated region reads as solid blue rather than as empty space. The
[alignments track guide](/docs/user_guides/alignments_track#modifications-and-methylation)
covers both modes, the probability threshold, and the cytosine-context submenu.

At this point the reads carry the answer but do not show it: the pileup over the
CpG island is an interleaved mix of methylated and unmethylated reads, and
nothing in that mix says whether it is one allele or two. Splitting them apart
is one setting, two sections below.

## Aggregate methylation with modkit bedMethyl

[modkit pileup](https://nanoporetech.github.io/modkit/) collapses the per-read
calls into a bedMethyl file, one row per CpG per modification type, carrying the
fraction of reads that were modified. It is the compact form of the same
information, and the form that stays fast at whole-genome zoom.

```bash
modkit pileup sample.bam output.bedmethyl --ref reference.fa --preset traditional
bgzip output.bedmethyl
tabix -p bed output.bedmethyl.gz
```

`--preset traditional` collapses 5mC and 5hmC into a single 5mC fraction
(bisulfite-equivalent). Omit it to keep separate rows per modification type (`m`
for 5mC, `h` for 5hmC). Passing `--partition-tag HP` instead writes one file per
haplotype, which is what this dataset uses.

Because bedMethyl is a BED file with a numeric score column, it loads through a
`BedTabixAdapter` in a `MultiQuantitativeTrack` (see the
[multi-quantitative track config guide](/docs/config_guides/multiquantitative_track)).
JBrowse reads the modification type from the `name` column and gives each type
its own subtrack:

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "HG002_snrpn_modkit_hp1",
  "name": "HG002 methylation HP1 (modkit)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/methylation/HG002_SNRPN_hp1.modkit.bed.gz"
  }
}
```

The Y axis is percent methylation, each CpG a vertical bar.

## Splitting the alleles apart

Each long read is a single DNA molecule, so reads that carry an `HP` haplotype
tag (from WhatsHap, HiPhase, or ONT's `wf-human-variation`) can be separated by
allele. Pick **Group by... → Tag...** from the track menu and enter `HP`, leave
coloring on modifications, and the pileup stacks into one band per haplotype,
computed in the browser with no external tool. The interleaved mix from the
first section resolves: one band is methylated over the island, the other is
not.

<Figure caption="HG002 ONT reads over the SNRPN CpG island, colored by 5mC with unmethylated CpGs in blue. Top: file order, where methylated and unmethylated reads alternate down the pileup. Bottom: the same reads grouped by the HP tag, one band per haplotype. Only the grouping differs." src="/img/methylation/hg002_snrpn_group_by_hp.png" links="Ungrouped=methylation/hg002_snrpn_ungrouped,Grouped by HP=methylation/hg002_snrpn_grouped" />

Loading the two per-haplotype bedMethyl files above the reads puts the summary
and its source in the same view, on one x scale.

<Figure caption="Allele-specific methylation at the SNRPN / Prader-Willi imprinting center in HG002 ONT data. Top: modkit's phased bedMethyl loaded as one MultiQuantitativeTrack per haplotype (HP1, HP2), each a 0-100% 5mC profile. Bottom: the ONT reads those profiles summarize, grouped by HP and colored by methylation, HP1 methylated (red) and HP2 unmethylated (blue) read by read." src="/img/methylation/hg002_snrpn_combined.png" />

Reading the figure top to bottom is the check worth making: the aggregate says
one allele is methylated over the island and the other is not, and the reads
below it show the same split molecule by molecule, with the same haplotype on
the same side. An aggregate profile that disagreed with the reads under it would
mean the phasing, not the methylation, was what changed.

See the
[alignments track guide](/docs/user_guides/alignments_track#grouping-reads) for
the Group-by dialog and the [phased-trio tutorial](/docs/tutorials/analyze_trio)
for producing `HP`-tagged reads.

## Choosing between the two approaches

The two are complements rather than alternatives. Keep the bedMethyl track for
fast, whole-genome navigation to regions of interest, since it stays quick at
any zoom and is what a tumor-versus-normal comparison reads off. Then drop the
per-read BAM or CRAM below it once you are there, for single-molecule and
[allele-specific](#splitting-the-alleles-apart) detail, which only the reads
carry.

To compare two samples rather than two alleles, run `modkit dmr` on their
per-sample pileups and load its BED output as a `FeatureTrack` beside the
bedMethyl tracks, so the differentially-methylated regions line up with the
positions driving them.

## Where the data comes from

Both files are region slices of public
[ONT open data](https://labs.epi2me.io/dataindex/), hosted so this page loads
without a large download:

- the per-haplotype bedMethyl from the `wf-human-variation` sup run on HG002
  (`giab_2025.01/.../PAW70337/output/SAMPLE.wf_mods.{1,2}.bedmethyl.gz`),
  restricted to the SNRPN locus and to `m` (5mC) rows, since the `h` and `a`
  rows are near-empty here and only clutter the plot;
- the reads from the HG002 sup basecalls
  (`giab_2023.05/analysis/hg002/sup/PAO83395.pass.cram`), sliced to the same
  locus and haplotagged with `whatshap haplotag` against the phased SNP calls
  from that same `wf-human-variation` run.

## See also

- [](/docs/user_guides/alignments_track#modifications-and-methylation)
- [](/docs/user_guides/alignments_track#grouping-reads)
- [Bisulfite and EM-seq](/docs/tutorials/bisulfite)
- [Phased trio](/docs/tutorials/analyze_trio)
- [](/docs/user_guides/multiquantitative_track)
- [modkit documentation](https://nanoporetech.github.io/modkit/)
- [Gallery: methylation and base modifications](/gallery/#alignments)
