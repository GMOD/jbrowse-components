---
title: DNA methylation
description:
  Per-read, aggregate, allele-specific, and chromatin-accessibility (6mA)
  methylation from ONT/PacBio long reads and modkit
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

DNA methylation (**5mC** at **CpG** sites, and other base modifications) is read
straight off long reads: ONT and PacBio basecallers emit per-base modification
calls in the BAM/CRAM `MM`/`ML` tags, and JBrowse renders them with no extra
processing. This tutorial demonstrates each view JBrowse offers, using public
COLO829 melanoma ONT data, an HG002 fiber-seq dataset, and a chr20 nanopore
methylation dataset:

- **Per-read modification coloring** on BAM/CRAM alignments
- **Aggregate methylation** from
  [modkit](https://github.com/nanoporetech/modkit) bedMethyl files
- **Allele-specific methylation** by grouping reads on their haplotype tag
- **6mA chromatin accessibility** from fiber-seq

This tutorial is a tour of each methylation view rather than a copy-paste
pipeline: the configs below use `https://yourhost/...` placeholders, and the
figures use public datasets (linked where shown) that JBrowse reads by URL. Swap
in your own modBAM/CRAM or bedMethyl file to reproduce any view.

## Per-read methylation with BAM/CRAM

When a BAM or CRAM file carries base modification tags (MM/ML as specified in
the
[SAM format specification](https://samtools.github.io/hts-specs/SAMtags.pdf)),
JBrowse 2 can color individual bases on each read by their modification
probability, with no extra configuration required.

Load the modBAM (or modCRAM) as an `AlignmentsTrack` — its `assemblyNames` must
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

From the track menu, choose **Color by → Modification type** to paint the calls
listed in the MM tag, or **Color by → Methylation** to additionally scan the
read sequence for CpG dinucleotides and paint any CpG the MM tag left uncalled
(the difference is exactly what the figure below shows). Each modification type
renders in its own color, with intensity reflecting the modification probability
(ML tag value).

<Figure caption="The same nanopore track shown in modifications mode (top) and methylation mode (bottom) over a hypo-methylated CpG island. Modifications mode only draws the positive 5mC calls listed in the MM tag, so a hypomethylated region looks nearly empty. The MM tag does not necessarily mark unmodified bases, so methylation mode instead scans the read sequence itself for CpG dinucleotides and paints any CpG the MM tag left uncalled in blue. That manual lookup is what fills a hypomethylated region with solid blue where modifications mode shows nothing." src="/img/alignments/modifications2.png" />

## Aggregate methylation with modkit bedMethyl

[modkit pileup](https://nanoporetech.github.io/modkit/) aggregates per-read
modification calls into a bedMethyl file — one row per CpG per modification
type, with the fraction of reads carrying that modification. This is a compact
format for storing population-level methylation across a whole genome.

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

To _compare_ two samples — tumor vs normal, treated vs control — run
`modkit dmr` on the per-sample pileups to score differentially-methylated
regions, and load its BED output as a `FeatureTrack` beside the bedMethyl tracks
so the DMRs line up with the positions driving them.

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

### Example: COLO829 tumor with CRAM and bedMethyl

The screenshot below shows the COLO829 melanoma tumor ONT dataset at
chr20:21,505,200–21,514,000, spanning two adjacent CpG islands. Top: the UCSC
CpG-island annotation. Middle: the CRAM alignment with reads colored by 5mC
methylation (the sparser 5hmC calls are hidden here so the per-read band reads
cleanly). Bottom: the modkit bedMethyl file as a `MultiQuantitativeTrack` with
`h` (5hmC) and `m` (5mC) subtracks. The per-read 5mC calls and the aggregate
fractions track each other, and both drop over the leftmost, hypomethylated
island.

<Figure caption="COLO829 tumor ONT alignments (top) with per-read 5mC methylation coloring, alongside the modkit bedMethyl MultiQuantitativeTrack (bottom) showing 5hmC ('h') and 5mC ('m') methylation fractions at individual CpG positions." src="/img/methylation/colo829_cram_and_bedmethyl.png" />

## Allele-specific methylation by haplotype

Because each long read is one DNA molecule, reads carrying an `HP` haplotype tag
(from WhatsHap, HiPhase, or ONT's `wf-somatic-variation` haplotagged `.ht`
output) can be split by allele. **Group by** the `HP` tag from the track menu,
leave coloring on modifications (or methylation), and the pileup stacks into one
per-haplotype profile — computed live in the browser, no external tool.
Allele-specific methylation then reads off as a difference between the haplotype
bands, and is clearest at a germline imprinting center.

`modkit pileup --partition-tag HP` writes the same split as an aggregate
bedMethyl per haplotype (`wf-human-variation` emits these as its `.1`/`.2`
outputs). Loaded as two `MultiQuantitativeTrack`s, they give a phased 0–100% 5mC
profile per allele that reads cleanest at a germline imprinting center — for
example the SNRPN / Prader-Willi imprinting center (`chr15:24.95Mb`) in HG002,
where one parental allele is methylated and the other is not.

<Figure caption="Allele-specific methylation at the SNRPN / Prader-Willi imprinting center in HG002 ONT data. modkit's phased bedMethyl is loaded as one MultiQuantitativeTrack per haplotype (HP1, HP2), each a 0–100% 5mC profile. Over the CpG island one allele is ~89% methylated while the other is ~10% — the canonical imprinted split, read straight off the two stacked profiles." src="/img/methylation/hg002_snrpn_allele_specific.png" />

The same split is visible in the underlying reads. Loading the haplotagged ONT
alignments and setting Group-by → HP with Color-by → methylation stacks the
reads into their two haplotypes, each CpG call painted red (5mC) or blue
(unmethylated).

<Figure caption="The read-level source of the aggregate profiles above: the same HG002 ONT reads modkit summarized, grouped by haplotype and colored by methylation over the SNRPN CpG island. HP1 reads are methylated (red) across the island while HP2 reads are unmethylated (blue) — the imprinted allele-specific split, read by read." src="/img/methylation/hg002_snrpn_reads.png" />

See the
[alignments track guide](/docs/user_guides/alignments_track#grouping-reads) for
the Group-by dialog and the [phased-trio tutorial](/docs/tutorials/analyze_trio)
for producing `HP`-tagged reads.

## Plant methylation in non-CpG contexts (CHG/CHH)

Mammalian methylation is overwhelmingly in the CpG context, but plants also
methylate cytosines in the **CHG** and **CHH** contexts (where H is A, C, or T).
JBrowse restricts modification (or bisulfite) coloring to a chosen context via
the `cytosineContext` setting, so CpG, CHG, and CHH can each be read off the
same reads. The [bisulfite / EM-seq tutorial](/docs/tutorials/bisulfite) works
through all three contexts on an _Arabidopsis_ WGBS dataset, where methylation
is inferred from C→T conversion in the alignment rather than from MM/ML tags.

## 6mA base modifications (fiber-seq)

Modification coloring is not limited to 5mC. Fiber-seq calls **N6-methyladenine
(6mA)**, tagged `A+a` in the MM/ML tags, and JBrowse draws it like any other
modification — set the color mode to **modifications** and the `A+a` calls paint
on the reads. Because the assay's adenine methyltransferase stencils 6mA onto
accessible DNA, the density is a **chromatin-accessibility** readout: below,
Oxford Nanopore's
[HG002 chromatin-accessibility dataset](https://epi2me.nanoporetech.com/chromatin-acc-hg002/)
shows a clear 6mA peak over the GAPDH promoter in the enzyme-treated sample that
the no-enzyme control lacks.

<Figure caption="ONT HG002 fiber-seq at the GAPDH promoter in modifications mode: the enzyme-treated sample (top, PAY22766) carries 6mA (A+a) calls that the native no-enzyme control (bottom, PBA15131) does not." src="/img/methylation/chromatin_accessibility_6ma.png" />

## Choosing between the two approaches

| Approach                         | Best for                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Per-read BAM/CRAM coloring       | Haplotype-aware methylation, allele-specific methylation, individual read inspection         |
| bedMethyl MultiQuantitativeTrack | Whole-genome methylation overview, comparing tumor vs normal, fast loading at any zoom level |

The two are complementary rather than exclusive: keep the bedMethyl track for
fast, whole-genome navigation to regions of interest, then drop the per-read
CRAM/BAM below it for single-molecule and
[allele-specific](#allele-specific-methylation-by-haplotype) detail once you're
there.

## See also

- [Alignments track](/docs/user_guides/alignments_track#grouping-reads) —
  per-read modification coloring plus grouping/sorting reads by the `HP`
  haplotype tag
- [Phased trio](/docs/tutorials/analyze_trio) — generating and working with
  `HP`-tagged reads alongside a phased VCF, the basis for allele-specific
  methylation
- [Multi-quantitative track](/docs/user_guides/multiquantitative_track) —
  display modes for the bedMethyl subtracks (multirow, overlap, shared scales)
- [Cancer SVs (C-GIAB)](/docs/tutorials/sv_visualization_cgiab) — another
  long-read cancer workflow, using the HG008 PacBio HiFi dataset
- [modkit documentation](https://nanoporetech.github.io/modkit/) — generating
  bedMethyl pileups and phased output
- [Gallery: methylation and base modifications](/gallery/#methylation) — a live
  nanopore methylation-coloring example to open and explore
