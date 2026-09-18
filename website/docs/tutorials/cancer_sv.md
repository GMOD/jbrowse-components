---
title: Complex rearrangements and derivative alleles
sidebar_label: SVs (complex rearrangements)
description:
  Search a somatic SV callset for rearrangements that take several junctions to
  make, reconstruct the derivative allele, and check it against the reads
guide_category: Tutorials
tutorial_category: Cancer genomics
---

A rearrangement can take several junctions to make, and which genes it joins
does not reveal how many. Search a somatic SV callset for chains of junctions a
single long read could cross, rebuild the derivative allele from the reads that
span it, and show that reconstruction against the reference as a synteny view.

## Prerequisites

- nothing to read along. Everything below is for rebuilding the data
- a JBrowse to open them in: [Desktop](/docs/quickstart_desktop) takes a local
  file by path, [Web](/docs/quickstart_web) through **Add track**
- [](/docs/cli)
- [samtools](http://www.htslib.org/) (v1.21 or later)
- [minimap2](https://github.com/lh3/minimap2)
- `bedGraphToBigWig` from the
  [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/)
- `python3`, for `sv_multihop.py`
- a GRCh38 FASTA, and roughly 40 GB of free disk

On Debian/Ubuntu, `apt install samtools minimap2 python3` covers three of those;
`bedGraphToBigWig` is a single static binary from UCSC and `node`, for the CLI,
comes from [nodejs.org](https://nodejs.org/). `sv_multihop.py` is one file:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/sv_multihop.py
```

## Where the data comes from

Every file but the last comes out of one ONT open-data release and its own
`wf-somatic-variation` run; the last is the multi-platform truth set
([Valle-Inclán et al. 2022](https://doi.org/10.1016/j.xgen.2022.100139)):

- COLO829 tumor reads (ONT R10, haplotagged):
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram
- COLO829BL matched normal reads:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/basecalls/colo829bl/sup/PAU59807.d052sup4305mCG_5hmCGvHg38.bam
- the somatic SV calls `sv_multihop.py` searches:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829.wf-somatic-sv.vcf.gz
- mosdepth coverage regions, tumor:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829/qc/coverage/COLO829_tumor.regions.bed.gz
- mosdepth coverage regions, normal:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829/qc/coverage/COLO829_normal.regions.bed.gz
- the GRCh38 build the CRAM decodes against, which `derive` also realigns the
  consensus to:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/GCA_000001405.15_GRCh38_no_alt_analysis_set.fasta
- the COLO829 somatic SV truth set, lifted to GRCh38:
  https://zenodo.org/api/records/4716169/files/truthset_somaticSVs_COLO829_hg38lifted.vcf/content

## COLO829

COLO829 is a melanoma cell line with a matched normal, COLO829BL, and a
community reference for somatic structural-variant calling. The tumor is
sequenced deeply enough on ONT R10 that a read crosses a whole rearrangement.

The coverage lanes beside those reads are the same run's `mosdepth` output in 50
kb windows, repacked as bigWig:

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
# awk drops the alt and decoy contigs: bedGraphToBigWig rejects a contig absent
# from the chrom.sizes outright, so one leftover row fails the conversion.
gzip -dc COLO829_tumor.regions.bed.gz | sort -k1,1 -k2,2n |
  awk 'NR==FNR{ok[$1];next} ($1 in ok)' hg38.chrom.sizes - > cov.bg
bedGraphToBigWig cov.bg hg38.chrom.sizes COLO829_tumor.coverage.bw
```

## Multi-hop fusions

Fusion callers generally look for one junction joining two genes. Two genes can
also be brought together by a series of junctions, and when the reference
segments between them are short, the result is indistinguishable at the
transcript level from a simple fusion. SplitThreader made this concrete in
SK-BR-3 ([Nattestad et al. 2018](https://doi.org/10.1101/gr.231100.117)),
finding a KLHDC2-SNTB1 fusion that required three variants across three
chromosomes.
[`sv_multihop.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/sv_multihop.py)
runs the same search on any somatic SV callset.

## Finding the chains

The search needs only the VCF. Two junctions belong to the same chain when an
endpoint of one lands close enough to an endpoint of the other that a single
read could carry both:

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
python3 sv_multihop.py chains COLO829.somatic-sv.vcf.gz --min-hops 3
```

```
100 distinct junctions in COLO829.somatic-sv.vcf.gz
4 chain(s) of >=3 junctions linked by reference segments <=20000 bp

chain 1: 3 junctions across 3 chromosome(s)
    chr3:25,359,111 <-> chr12:72,273,112
    chr3:25,359,568 <-> chr10:58,717,464
    chr10:58,717,662 <-> chr12:72,273,294
    --loci chr10:58717464,chr12:72273112,chr3:25359111
```

Those three junctions form a closed cycle, and the whole derivative path is
under a kilobase spread across three chromosomes. The genes involved are _RARB_
on chr3, a tumor suppressor, _BICC1_ on chr10, and _TRHDE_ on chr12.
`--max-segment` is the longest reference segment one read is assumed to bridge,
so set it from your own read-length distribution.

## Reads at the breakpoints

At the chr3 breakpoints the tumor pileup becomes soft-clipped bases, because
every read crossing the junction has its remainder aligned elsewhere. The
matched normal at the same locus is clean. Soft clipping is off by default; turn
it on from the track menu with **Show soft clipping**. These pileups are deep
enough that the track asks before downloading the window, and **Force load**
approves it for the rest of the session.

<Figure caption="Left: COLO829 tumor above COLO829BL normal at the two chr3 breakpoints, soft clipping shown. Tumor reads clip where normal reads read through. Right: the same event as a breakpoint split view over every locus the chain visits." src="/img/cancer_sv/multihop_reads.png" />

## Following the chain across panels

A breakpoint split view, the right half of the figure above, stacks the loci the
chain visits and draws the reads that leave one panel and arrive in another.
**Add → Breakpoint split view** builds a view whose loci you already know, one
row per panel. The callset already knows them, so the view can also open from a
record. Right-click it in the variant track and choose **Open breakpoint split
view**: one dialog asks for the shape, two stacked panels or one row spanning
both breakends, and the window each panel opens at.

A BND names one partner, so the record on its own is two loci. **Follow further
breakends at each end** walks the callset: at each end of the chain it looks for
another junction leaving from the same place, and takes it when there is exactly
one. On this record that is three panels, because the chr10 breakend has a
second junction a couple of hundred bases away whose far end is on chr12. The
walk stops at two open continuations, or at one leading back into the chain. The
dialog's walk assumes that two junctions leaving one locus belong to one
molecule, and the reads are the evidence for that.

<Figure caption="Opening the split view from the record itself: right-click the breakend, set the shape and window in the dialog, and get three panels because the chain runs chr3 to chr10 to chr12." src="/img/cancer_sv/split_view_from_breakend.png" />

For a single read, right-click it and choose **Linear read vs ref**. That builds
a synteny view with the read as its own assembly along the bottom and every
locus it touches along the top, the view Ribbon
([Nattestad et al. 2021](https://doi.org/10.1093/bioinformatics/btaa1080))
introduced.

Stacked panels describe the event in reference coordinates. Laid out along the
derivative, it shows the order and orientation of its pieces. The next section
rebuilds the allele's sequence and lays the event out along it.

## Reconstructing the allele's sequence

`sv_multihop.py derive` rebuilds the allele: it pulls the reads spanning every
locus, takes the longest as a backbone, polishes it into a consensus with the
rest, aligns that consensus back to the reference, and realigns the reads to it.

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
python3 sv_multihop.py derive \
  --aln COLO829_tumor.ht.cram --ref GRCh38.fa \
  --loci chr10:58717464,chr12:72273112,chr3:25359111 \
  --out der3_RARB --name der3_RARB_BICC1_TRHDE
```

```
29 spanning reads
backbone read 8315652b-cd0f-4290-ad6b-51112f93a44a (57,134 bp)
wrote der3_RARB.derivative.fa (39,549 bp supported by >=3 reads)
wrote der3_RARB.vs_reference.paf
    derivative       0-32732   + -> chr3:25,326,821-25,359,568
    derivative   32732-32931   + -> chr10:58,717,463-58,717,662
    derivative   32932-33115   - -> chr12:72,273,111-72,273,294
    derivative   33126-39549   - -> chr3:25,352,683-25,359,111
wrote der3_RARB.derivative_segments.bed
```

The derivative has four contiguous segments: two chr3 arms in opposite
orientations, a foldback, with short pieces of chr10 and chr12 spliced in at the
turn. Those two fragments are templated insertions, stretches of other
chromosomes captured at a repair junction.

The PAF is a synteny track and the consensus is an assembly, so the
reconstruction loads against the reference directly. The BED is the same
segments as a feature track on the derivative. Adding
`--jbrowse-out config.json` writes the config that wires those together and
prints the URL that opens them as a synteny view.

`--genes` takes a tabix-indexed GFF3 and projects the reference's gene
annotation through those segments into derivative coordinates, clipped where a
junction cut it and flipped where a segment is inverted:

```bash
python3 sv_multihop.py derive ... --genes ncbiRefSeq.gff.gz
```

```
wrote der3_RARB.derivative_genes.gff3 (44 features from 41 reference rows)
```

This allele carries _RARB_'s first coding exon and its start codon, then the 183
bp of chr12 that the second junction splices in, which is _TRHDE_ coding
sequence in reverse, then _RARB_ again inverted.

Ribbons below are colored by the reference chromosome they come from. The last
segment names the event: an interval the allele has already carried, read back
on the other strand, so the derivative turns around on itself. That leaves the
stretch in the allele twice in opposite orientations, an inverted duplication,
with the two templated inserts at the turn. A fold-back is the first step of a
breakage-fusion-bridge cycle.

The read lane under the reference row draws split alignments only, one row per
molecule, with the truth set's validated calls above it.

Between the two, each junction is drawn once as an arc joining its two ends,
with a short tick at each foot over the sequence that end keeps: ticks pointing
away from each other are a deletion-type join, toward each other a
duplication-type, and parallel an inversion.

<Figure caption="The reconstructed derivative against its three source loci: RefSeq genes, the truth set and the tumor's split reads above, with each junction drawn once as an arc; the same annotation projected onto the allele below, each segment labelled with the interval it came from." src="/img/cancer_sv/derivative_synteny.png" />

## Checking the reconstruction

Zoomed to the kilobase holding the junctions, the two inserts are the same width
as the arms either side. Against hg38 every split read stops at a junction, and
the truth set has a validated call at each place they stop. Realigned against
the derivative, most of the same reads cross all four junctions in one
alignment. They are the reads the consensus was polished from, so that shows
they agree with each other; the truth set, called from other platforms, is the
independent check.

Each hg38 window runs past the segment the allele takes, so the bare reference
on either side of the reads is sequence the allele does not include. That lane
draws split alignments only, and its coverage band counts the reads carrying a
junction, stepping down as each arm runs out.

<Figure caption="The stitching at base scale: chr3 runs out, chr10 follows, then chr12 inverted, then chr3 resumes backwards. Above, the truth set's validated calls over the same molecules against hg38, split alignments only, each row stopping at a call with a connector to the piece it continues on; below, the allele's segments over the reads realigned to them." src="/img/cancer_sv/derivative_inserts.png" />

A breakpoint split view follows one read across its alignments: soft clipping is
shown on both sides, and a curve joins each molecule's pieces. A dashed
connector means the read passes through a segment no panel is showing.

<Figure caption="COLO829 tumor ONT reads over one junction, twice. Against hg38 (left, split alignments only) they stop at chr3:25,359,568 with their tails clipped; realigned to the derivative (right) they cross at flat depth. The panes are at different zooms." src="/img/cancer_sv/realigned_reads.png" links="hg38=cancer_sv/realigned_reads_reference,derivative=cancer_sv/realigned_reads_derivative" />

## Reproduce it end to end

[`scripts/build_cancer_sv_demo.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_cancer_sv_demo.sh)
builds everything above from public sources:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_cancer_sv_demo.sh
bash build_cancer_sv_demo.sh    # builds ./cancer_sv_build/jbrowse2
npx --yes serve cancer_sv_build/jbrowse2
```

The script fetches the ONT COLO829 somatic SV calls and coverage and runs both
`sv_multihop.py` steps against the tumor CRAM over HTTP. The same script builds
the K562 half of the demo, which [](/docs/tutorials/k562_fusions) walks through.

## Related tools

`sv_multihop.py` is a companion to this page, and each of its steps has a
dedicated tool built for the general case.

- **Calling somatic SVs and their complex clusters from long reads**:
  [Severus](https://github.com/KolmogorovLab/Severus) (Keskus et al. 2025)
  builds breakpoint graphs from phased tumor and normal reads and reports
  multi-break rearrangements as clusters. It was benchmarked on COLO829.
- **Ordering junctions into a derivative chromosome**: LINX (Shale et al. 2022)
  chains breakends using allele-specific copy number from the Hartwig pipeline,
  and [JaBbA](https://github.com/mskilab-org/JaBbA) with gGnome (Hadi et
  al. 2020) infers junction-balanced genome graphs whose walks are allelic
  paths. RCK (Aganezov and Raphael 2020) reconstructs haplotype-specific
  karyotypes under evolutionary constraints. All three take copy number, which
  `chains` does not.
- **Assembling the allele's sequence**: a local de novo assembly of the reads
  pulled at the loci, with [hifiasm](https://github.com/chhylp123/hifiasm) or
  [Shasta](https://github.com/paoloshasta/shasta), is the stronger version of
  `derive`'s single-backbone consensus, and
  [sawfish](https://github.com/PacificBiosciences/sawfish) (Saunders et
  al. 2025) assembles SV haplotypes as part of calling on HiFi reads.
- **Drawing the figure**:
  [ReConPlot](https://github.com/cortes-ciriano-lab/ReConPlot) (Espejo
  Valle-Inclán and Cortés-Ciriano 2023) draws rearrangement and copy number
  plots for complex events in R, and Ribbon (Nattestad et al. 2021) draws one
  read's path across the reference, which the split view above follows.

## See also

- [](/docs/tutorials/k562_fusions)
- [](/docs/tutorials/sv_callset_review)
- [](/docs/tutorials/hic_structural_variants)
- [](/docs/user_guides/sv_visualization)
- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/tutorials/sv_visualization_cgiab)

## References

- Valle-Inclán JE, et al. A multi-platform reference for somatic structural
  variation detection. _Cell Genomics_ (2022).
  https://doi.org/10.1016/j.xgen.2022.100139
- Nattestad M, et al. Complex rearrangements and oncogene amplifications
  revealed by long-read DNA and RNA sequencing of a breast cancer cell line.
  _Genome Research_ (2018). https://doi.org/10.1101/gr.231100.117
- Nattestad M, Aboukhalil R, Chin CS, Schatz MC. Ribbon: intuitive visualization
  for complex genomic variation. _Bioinformatics_ (2021).
  https://doi.org/10.1093/bioinformatics/btaa1080
- Keskus A, et al. Severus detects somatic structural variation and complex
  rearrangements in cancer genomes using long-read sequencing. _Nature
  Biotechnology_ (2025). https://doi.org/10.1038/s41587-025-02618-8
- Shale C, et al. Unscrambling cancer genomes via integrated analysis of
  structural variation and copy number. _Cell Genomics_ (2022).
  https://doi.org/10.1016/j.xgen.2022.100112
- Hadi K, et al. Distinct classes of complex structural variation uncovered
  across thousands of cancer genome graphs. _Cell_ (2020).
  https://doi.org/10.1016/j.cell.2020.08.006
- Aganezov S, Raphael BJ. Reconstruction of clone- and haplotype-specific cancer
  genome karyotypes from bulk tumor samples. _Genome Research_ (2020).
  https://doi.org/10.1101/gr.256701.119
- Saunders CT, et al. Sawfish: improving long-read structural variant discovery
  and genotyping with local haplotype modeling. _Bioinformatics_ (2025).
  https://doi.org/10.1093/bioinformatics/btaf136
- Espejo Valle-Inclán J, Cortés-Ciriano I. ReConPlot: an R package for the
  visualization and interpretation of genomic rearrangements. _Bioinformatics_
  (2023). https://doi.org/10.1093/bioinformatics/btad719
