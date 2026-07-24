---
title: Methylation (long-read)
description:
  Per-read, aggregate, and allele-specific methylation from long reads
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

You can read DNA methylation (5mC at CpG sites, plus other base modifications)
straight off long reads. ONT and PacBio basecallers write per-base modification
calls into the BAM/CRAM `MM`/`ML` tags, and JBrowse renders them with no extra
processing. This tutorial walks through each of the methylation views JBrowse
offers, using public COLO829 melanoma ONT data, an HG002 fiber-seq dataset, and
a chr20 nanopore methylation dataset:

- Per-read modification coloring on BAM/CRAM alignments
- Aggregate methylation from [modkit](https://github.com/nanoporetech/modkit)
  bedMethyl files
- Allele-specific methylation by grouping reads on their haplotype tag
- 6mA chromatin accessibility from fiber-seq

Think of it as a tour of the methylation views rather than a copy-paste
pipeline. The configs below use `https://yourhost/...` placeholders, and the
figures come from public datasets (linked where shown) that JBrowse reads by
URL. To reproduce any view, just swap in your own modBAM/CRAM or bedMethyl file.

## What you need

Nothing to install to read along: the figures come from public datasets that
JBrowse reads over HTTP. For your own data you need long reads with `MM`/`ML`
modification tags already in the BAM/CRAM, which modern ONT and PacBio
basecallers write by default. The configs below use `https://yourhost/...`
placeholders for those files.

## Per-read methylation with BAM/CRAM

When a BAM or CRAM file carries base modification tags (MM/ML as specified in
the
[SAM format specification](https://samtools.github.io/hts-specs/SAMtags.pdf)),
JBrowse 2 can color individual bases on each read by their modification
probability, with no extra configuration required.

Load the modBAM (or modCRAM) as an `AlignmentsTrack`. Its `assemblyNames` must
match an assembly already configured in JBrowse (see the
[assemblies configuration guide](/docs/config_guides/assemblies)), and the
`.bai`/`.crai` index sits beside the file:

```json
{
  "type": "AlignmentsTrack",
  "trackId": "my_modbam",
  "name": "My modified-base BAM",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BamAdapter",
    "uri": "https://yourhost/sample.bam"
  }
}
```

From the track menu, choose **Color by → Modifications**. You then have two
options. **One color per modification type** paints just the calls listed in the
MM tag, each modification in its own color, with the intensity reflecting the
modification probability (the ML tag value). **One color per type, plus
low-probability & unmodified in blue** (IGV's "2-color" scheme) also scans the
read sequence for CpG dinucleotides and paints any CpG the MM tag left uncalled.
The figure below shows the difference between the two.

<Figure caption="The same nanopore track colored by type (top) and 2-color (bottom) over a hypomethylated CpG island. By-type mode draws only the positive 5mC calls in the MM tag, so the region looks nearly empty. The 2-color mode paints every CpG, filling the region with the blue of the low-probability and unmarked ones." src="/img/alignments/modifications2.png" />

## Aggregate methylation with modkit bedMethyl

[modkit pileup](https://nanoporetech.github.io/modkit/) aggregates per-read
modification calls into a bedMethyl file, one row per CpG per modification type,
with the fraction of reads carrying that modification. This is a compact format
for storing population-level methylation across a whole genome.

### Generating the file

Needs [modkit](https://github.com/nanoporetech/modkit) plus `bgzip`/`tabix`
(htslib).

```bash
# Standard (single modification fraction per CpG)
modkit pileup sample.bam output.bedmethyl --ref reference.fa --preset traditional
bgzip output.bedmethyl
tabix -p bed output.bedmethyl.gz

# Phased (produces hp1.bedmethyl, hp2.bedmethyl, combined.bedmethyl)
modkit pileup sample.bam output_dir/ --ref reference.fa --phased
bgzip output_dir/combined.bedmethyl
tabix -p bed output_dir/combined.bedmethyl.gz
```

`--preset traditional` collapses 5mC and 5hmC into a single 5mC fraction
(bisulfite-equivalent). Omit it to keep separate rows for each modification type
(`m` for 5mC, `h` for 5hmC).

To _compare_ two samples (tumor vs normal, treated vs control), run `modkit dmr`
on the per-sample pileups to score differentially-methylated regions, and load
its BED output as a `FeatureTrack` beside the bedMethyl tracks so the DMRs line
up with the positions driving them.

### Loading as a MultiQuantitativeTrack

Because bedMethyl is a BED-format file with a numeric score column, it can be
loaded using a `BedTabixAdapter` inside a `MultiQuantitativeTrack` (see the
[multi-quantitative track config guide](/docs/config_guides/multiquantitative_track)).
JBrowse reads the modification type from the `name` column (e.g. `m` for 5mC,
`h` for 5hmC) and creates one subtrack per type.

```json
{
  "type": "MultiQuantitativeTrack",
  "trackId": "sample_modkit",
  "name": "CpG methylation (modkit)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "bedGzLocation": {
      "uri": "https://yourhost/sample_modkit.bed.gz"
    },
    "index": {
      "location": {
        "uri": "https://yourhost/sample_modkit.bed.gz.tbi"
      }
    }
  }
}
```

The Y-axis shows the percent methylation (0–100). Each CpG position appears as a
vertical bar. The two subtracks (`h` for 5hmC and `m` for 5mC) are stacked in
multirow mode by default so their scales are independent.

## Allele-specific methylation by haplotype

Since each long read is a single DNA molecule, you can split reads by allele
whenever they carry an `HP` haplotype tag (from WhatsHap, HiPhase, or ONT's
`wf-somatic-variation` haplotagged `.ht` output). **Group by** the `HP` tag from
the track menu, leave coloring on modifications (or methylation), and the pileup
stacks into one profile per haplotype, computed live in the browser with no
external tool. Allele-specific methylation then shows up as a difference between
the two haplotype bands.

You can also compute that split ahead of time.
`modkit pileup --partition-tag HP` writes an aggregate bedMethyl per haplotype
(`wf-human-variation` emits these as its `.1`/`.2` outputs). Load them as two
`MultiQuantitativeTrack`s and you get a phased 0–100% 5mC profile per allele.
This is clearest at a germline imprinting center, for example the SNRPN /
Prader-Willi imprinting center (`chr15:24.95Mb`) in HG002, where one parental
allele is methylated and the other is not.

The same split is also visible in the underlying reads: loading the haplotagged
ONT alignments and setting Group-by → HP with Color-by → methylation stacks the
reads into their two haplotypes, each CpG call painted red (5mC) or blue
(unmethylated). Adding both to one view shows the aggregate profiles and the
reads they summarize together.

<Figure caption="Allele-specific methylation at the SNRPN / Prader-Willi imprinting center in HG002 ONT data. Top: modkit's phased bedMethyl loaded as one MultiQuantitativeTrack per haplotype (HP1, HP2), each a 0–100% 5mC profile. Over the CpG island one allele is ~89% methylated while the other is ~10%. Bottom: the ONT reads those profiles summarize, grouped by HP and colored by methylation, HP1 methylated (red) and HP2 unmethylated (blue) read by read." src="/img/methylation/hg002_snrpn_combined.png" />

See the
[alignments track guide](/docs/user_guides/alignments_track#grouping-reads) for
the Group-by dialog and the [phased-trio tutorial](/docs/tutorials/analyze_trio)
for producing `HP`-tagged reads.

## Plant methylation in non-CpG contexts (CHG/CHH)

Mammalian methylation is overwhelmingly in the CpG context, but plants also
methylate cytosines in the CHG and CHH contexts (where H is A, C, or T). JBrowse
restricts modification (or bisulfite) coloring to a chosen context via the
`cytosineContext` setting, so CpG, CHG, and CHH can each be read off the same
reads. The [bisulfite / EM-seq tutorial](/docs/tutorials/bisulfite) works
through all three contexts on an _Arabidopsis_ WGBS dataset, where methylation
is inferred from C→T conversion in the alignment rather than from MM/ML tags.

## 6mA base modifications (fiber-seq)

Modification coloring isn't limited to 5mC. Fiber-seq calls N6-methyladenine
(6mA), tagged `A+a` in the MM/ML tags, and JBrowse draws it like any other
modification: set the color mode to **modifications** and the `A+a` calls paint
onto the reads. The fiber-seq assay adds 6mA to accessible DNA, so the density
of these calls also serves as a chromatin-accessibility readout. Below, Oxford
Nanopore's
[HG002 chromatin-accessibility dataset](https://epi2me.nanoporetech.com/chromatin-acc-hg002/)
shows a clear 6mA peak over the GAPDH promoter in the enzyme-treated sample that
the no-enzyme control lacks.

<Figure caption="ONT HG002 fiber-seq at the GAPDH promoter in modifications mode: the enzyme-treated sample (top, PAY22766) carries 6mA (A+a) calls that the native no-enzyme control (bottom, PBA15131) does not." src="/img/methylation/chromatin_accessibility_6ma.png" />

## Choosing between the two approaches

| Approach                         | Best for                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Per-read BAM/CRAM coloring       | Haplotype-aware methylation, allele-specific methylation, individual read inspection         |
| bedMethyl MultiQuantitativeTrack | Whole-genome methylation overview, comparing tumor vs normal, fast loading at any zoom level |

Keep the bedMethyl track for fast, whole-genome navigation to regions of
interest, then drop the per-read CRAM/BAM below it for single-molecule and
[allele-specific](#allele-specific-methylation-by-haplotype) detail once you're
there.

## See also

- [Alignments track](/docs/user_guides/alignments_track#grouping-reads)
- [Phased trio](/docs/tutorials/analyze_trio)
- [Multi-quantitative track](/docs/user_guides/multiquantitative_track)
- [Cancer SVs (C-GIAB)](/docs/tutorials/sv_visualization_cgiab)
- [modkit documentation](https://nanoporetech.github.io/modkit/)
- [Gallery: methylation and base modifications](/gallery/#alignments)
