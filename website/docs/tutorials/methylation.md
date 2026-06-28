---
title: DNA methylation
description: Per-read and aggregate methylation from ONT and modkit
guide_category: Tutorials
---

JBrowse 2 supports two complementary views of DNA methylation: **per-read
modification coloring** directly on BAM/CRAM alignments, and **aggregate
methylation** from bedMethyl files produced by tools like
[modkit](https://github.com/nanoporetech/modkit). This tutorial demonstrates
both using publicly available COLO829 melanoma ONT data and a chr20 nanopore
methylation dataset.

## Per-read methylation with BAM/CRAM

When a BAM or CRAM file carries base modification tags (MM/ML as specified in
the
[SAM format specification](https://samtools.github.io/hts-specs/SAMtags.pdf)),
JBrowse 2 can color individual bases on each read by their modification
probability. This works out of the box — no extra config is needed.

Turn on modification or methylation coloring from the track menu. Each
modification type renders in its own color, with intensity reflecting the
modification probability (ML tag value).

<Figure caption="The same nanopore track shown in modifications mode (top) and methylation mode (bottom) over a hypo-methylated CpG island. Modifications mode only draws the positive 5mC calls listed in the MM tag, so a hypomethylated region looks nearly empty. The MM tag does not necessarily mark unmodified bases, so methylation mode instead scans the read sequence itself for CpG dinucleotides and paints any CpG the MM tag left uncalled in blue. That manual lookup is what fills a hypomethylated region with solid blue where modifications mode shows nothing." src="/img/alignments/modifications2.png" />

## Aggregate methylation with modkit bedMethyl

[modkit pileup](https://nanoporetech.github.io/modkit/) aggregates per-read
modification calls into a bedMethyl file — one row per CpG per modification
type, with the fraction of reads carrying that modification. This is a compact
format for storing population-level methylation across a whole genome.

### Generating the file

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
vertical bar; the two subtracks (`h` for 5hmC and `m` for 5mC) are stacked in
multirow mode by default so their scales are independent.

### Example: COLO829 tumor with CRAM and bedMethyl

The screenshot below shows the COLO829 melanoma tumor ONT dataset at
chr20:10,000,000–10,003,000. The upper track is the CRAM alignment with reads
colored by modification; the lower track is the modkit bedMethyl file loaded as
a `MultiQuantitativeTrack` with `h` (5hmC) and `m` (5mC) subtracks.

<Figure caption="COLO829 tumor ONT alignments (top) with per-read modification coloring, alongside the modkit bedMethyl MultiQuantitativeTrack (bottom) showing 5hmC ('h') and 5mC ('m') methylation fractions at individual CpG positions." src="/img/methylation/colo829_cram_and_bedmethyl.png" />

[Live demo — COLO829 CRAM + bedMethyl](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-RveRrmeOL8&password=V2mo9)

## Plant methylation in non-CpG contexts (CHG/CHH)

Mammalian methylation is overwhelmingly in the CpG context, but plants also
methylate cytosines in the **CHG** and **CHH** contexts (where H is A, C, or T).
JBrowse 2 lets you restrict modification coloring to a specific cytosine context
via the `cytosineContext` setting, which is useful for examining plant
methylation patterns.

For example, on an _Arabidopsis_ ONT dataset you can set `cytosineContext` to
**CHH** so that only cytosines in a CHH context are colored.

JBrowse 2 can also infer methylation from **bisulfite** (or EM-seq) data via
C-to-T conversion in the read alignment (the `bisulfite` coloring mode) rather
than from MM/ML tags.

## Choosing between the two approaches

| Approach                         | Best for                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Per-read BAM/CRAM coloring       | Haplotype-aware methylation, allele-specific methylation, individual read inspection         |
| bedMethyl MultiQuantitativeTrack | Whole-genome methylation overview, comparing tumor vs normal, fast loading at any zoom level |

For haplotype-aware analysis, combine both: load a haplotagged BAM (with HP tags
from WhatsHap or HiPhase), color by modification, and sort by HP tag to see
per-haplotype methylation patterns. The bedMethyl track provides the aggregate
signal for quick navigation to regions of interest.

## See also

- [Alignments track](/docs/user_guides/alignments_track) — per-read modification
  coloring, sorting, and filtering options for BAM/CRAM
- [Multi-quantitative track](/docs/user_guides/multiquantitative_track) —
  display modes for the bedMethyl subtracks (multirow, overlap, shared scales)
- [Cancer SVs (C-GIAB)](/docs/tutorials/sv_visualization_cgiab) — another
  long-read cancer workflow, using the HG008 PacBio HiFi dataset
- [modkit documentation](https://nanoporetech.github.io/modkit/) — generating
  bedMethyl pileups and phased output
