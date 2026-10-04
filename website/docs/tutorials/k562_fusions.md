---
title: Gene fusion calls and the DNA behind them
sidebar_label: SVs (gene fusion calls)
description:
  Triage a fusion caller's short-read calls against long RNA reads from the same
  cells, then find the DNA breaks the transcript junctions do not sit on
guide_category: Tutorials
tutorial_category: Cancer genomics
---

A fusion caller outputs a table of gene pairs, each with the coordinate of the
transcript junction, where the RNA joins the two genes. We load STAR-Fusion's
short-read calls beside long RNA reads from the same cell line and count the
molecules crossing each junction. Then we find where the chromosome broke. In
K562, the BCR-ABL1 DNA break lies in the first intron of _ABL1_, well before the
junction the caller reports. The break under NUP214-XKR3, another junction on
the same amplified segment, sits at the reported junction.

## Prerequisites

- a JBrowse to open them in: [Desktop](/docs/quickstart_desktop) takes a local
  file by path, [Web](/docs/quickstart_web) through **Add track**
- [](/docs/cli)
- [samtools](http://www.htslib.org/), to sort and merge the four Iso-Seq runs
- `bedGraphToBigWig` and `liftOver`, both from the
  [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/)
- `python3`, for `depmap_to_jbrowse.py` and `lift_bnd_vcf.py`

Each python helper is a single file:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/depmap_to_jbrowse.py
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/lift_bnd_vcf.py
```

## Where the data comes from

Four PacBio Iso-Seq runs from [ENCODE](https://www.encodeproject.org/), two
tables out of [DepMap](https://depmap.org/portal/)'s 24Q4 release, and the DNA
breakpoints on hg19:

- K562 PacBio Iso-Seq, ENCODE `ENCFF433YKW`:
  https://www.encodeproject.org/files/ENCFF433YKW/@@download/ENCFF433YKW.bam
- K562 PacBio Iso-Seq, ENCODE `ENCFF092NLB`:
  https://www.encodeproject.org/files/ENCFF092NLB/@@download/ENCFF092NLB.bam
- K562 PacBio Iso-Seq, ENCODE `ENCFF515YRZ`:
  https://www.encodeproject.org/files/ENCFF515YRZ/@@download/ENCFF515YRZ.bam
- K562 PacBio Iso-Seq, ENCODE `ENCFF475XQX`:
  https://www.encodeproject.org/files/ENCFF475XQX/@@download/ENCFF475XQX.bam
- K562 STAR-Fusion calls (DepMap 24Q4, `OmicsFusionFiltered.csv`):
  https://ndownloader.figshare.com/files/51065693
- K562 copy-number segments (DepMap 24Q4 WGS, `OmicsCNSegmentsProfile.csv`):
  https://ndownloader.figshare.com/files/51065333
- K562 DNA breakpoints (ENCODE 10X linked-read large-SV calls, hg19, lifted to
  hg38 by the build script):
  https://www.encodeproject.org/files/ENCFF863MPP/@@download/ENCFF863MPP.vcf.gz
- the hg19-to-hg38 chain the lift uses:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg19/liftOver/hg19ToHg38.over.chain.gz

## Cutting K562 out of DepMap and lifting its breakpoints to hg38

K562 is a chronic myeloid leukemia line with the Philadelphia chromosome, the
t(9;22) translocation between chr9 and chr22 that fuses _BCR_ to _ABL1_. Its
transcripts here are long RNA reads, its fusion calls come from DepMap's
short-read pipeline, and its DNA breakpoints from a linked-read run.

The fusion and copy-number tables both cover every line in the release.
`depmap_to_jbrowse.py` filters to one line and writes a STAR-Fusion TSV from the
fusion table and a bedGraph from the copy-number segments. K562 is model
`ACH-000551`, and its WGS copy-number profile is `PR-aheaZL`:

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
python3 depmap_to_jbrowse.py fusions OmicsFusionFiltered.csv ACH-000551 K562.star-fusion.tsv
python3 depmap_to_jbrowse.py segments OmicsCNSegmentsProfile.csv PR-aheaZL K562_cn.bedGraph
sort -k1,1 -k2,2n K562_cn.bedGraph |
  awk 'NR==FNR{ok[$1];next} ($1 in ok)' hg38.chrom.sizes - > K562_cn.sorted.bedGraph
bedGraphToBigWig K562_cn.sorted.bedGraph hg38.chrom.sizes K562_cn.bw
```

The DNA breakpoints arrive on hg19. A breakend record has a second coordinate
inside its `ALT` string, so a plain `liftOver` of the `POS` column produces a
valid VCF whose partner coordinates still point at hg19.
[`lift_bnd_vcf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/lift_bnd_vcf.py)
moves both:

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
python3 lift_bnd_vcf.py calls.hg19.vcf.gz hg19ToHg38.over.chain.gz \
  ./liftOver calls.hg38.vcf liftwork
bgzip calls.hg38.vcf && tabix -p vcf calls.hg38.vcf.gz
```

## Loading hg38 and the merged Iso-Seq reads

The DNA breakpoints are lifted to hg38 and the Iso-Seq molecules align to it, so
we load that assembly first.

```json addassembly
{
  "name": "hg38",
  "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
  "refNameAliases": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"
  },
  "cytobands": "https://jbrowse.org/genomes/GRCh38/cytoBand.txt"
}
```

ENCODE releases each Iso-Seq alignment unsorted. Sort each run, merge them into
one BAM and index it:

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
samtools sort -o s_run1.bam run1.bam
samtools sort -o s_run2.bam run2.bam
samtools merge -f K562_isoseq.bam s_run1.bam s_run2.bam
samtools index K562_isoseq.bam
```

The merged BAM is one read track. For your own long RNA reads, swap `uri` for
your BAM, with its `.bai` beside it and alignments to the same assembly:

```json addtrack
{
  "trackId": "K562_isoseq",
  "name": "K562 PacBio Iso-Seq (ENCODE)",
  "uri": "K562_isoseq.bam",
  "assemblyNames": ["hg38"]
}
```

## Triaging the STAR-Fusion calls in the SV inspector

The SV inspector opens the STAR-Fusion table beside a circular view of it, one
chord per row. **Add → SV inspector**, then the file: the import form reads the
File Type from a STAR-Fusion filename or the table's header line, and the menu
sets it by hand for a file named some other way.

Searching the SV inspector's table filters the table and the circular view
together:

- `chrM` keeps the rows that pair a gene with a mitochondrial transcript, the
  usual chimeric-read artefacts.
- `Mitelman` keeps the two rows listed in the fusion databases.
- `chr9` keeps the same two, `BCR--ABL1` and `NUP214--XKR3`: junctions between
  chr9 and chr22 whose chr22 partners lie megabases apart. The rest of the page
  shows them to be the two ends of one amplified segment.

Each table row's caret menu has **Open in linear genome view**, which puts the
row's two breakpoints side by side as two regions of one view, each oriented so
the fusion transcript reads left to right across the join. _XKR3_ is on the
minus strand, so its region arrives reversed (`[rev]`). Turn on **Read
connections → View as pairs / link supplementary alignments** to merge each
molecule's two alignments onto one row.

<Figure caption="NUP214--XKR3 as two regions of one view with reads linked, opened from its row in the SV inspector. The breakpoints are banded and each line is one Iso-Seq molecule running from NUP214 into XKR3." src="/img/cancer_sv/k562_fusion_inspector_reads.png" links="Import form=cancer_sv/k562_fusion_inspector_form,All 44 calls=cancer_sv/k562_fusion_inspector_all,Searched for chr9=cancer_sv/k562_fusion_inspector_pair,Linked reads=cancer_sv/k562_fusion_inspector_reads" />

The rest of the page follows `BCR--ABL1`, with its breakpoints as regions of one
linear view. The build script adds the STAR-Fusion calls as this track:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "K562_star_fusion",
  "name": "K562 STAR-Fusion calls (DepMap 24Q4)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "StarFusionAdapter",
    "starFusionLocation": { "uri": "K562.star-fusion.tsv" }
  }
}
```

## Split RNA reads at BCR-ABL1 across three regions

Right-click a read that crosses the junction and choose **Split current view to
show split alignments**, or type the three locations into the location box
separated by spaces,
`chr22:23,286,000-23,293,000 chr9:130,778,000-130,785,000 chr9:130,851,000-130,858,000`.
The transcript reaches _ABL1_ at more than one place, so the view uses three
regions: the _BCR_ donor (where the transcript starts) and two _ABL1_ acceptor
windows.

A read crossing the junction is one alignment on chr22 and a supplementary
alignment (the second piece of the split read) on chr9. **Read connections → Use
curved connectors** joins the two across the region divider. **Filter by... →
Split alignments → Only split alignments** drops every read that stays on one
chromosome.

**Read connections → Read arcs** adds a band under the coverage with one arc per
junction, thicker where more reads support it. An arc needs both ends in view:
the right-hand window gets one arc and the intron 1 window two, one at each
place the reads enter it. A vertical line at the _BCR_ donor marks molecules
whose _ABL1_ alignment lands in neither window.

<Figure caption="BCR on chr22 beside two ABL1 windows on chr9 as three regions of one view, showing only split reads with supplementary alignments linked. The arc band draws counted arcs from the BCR donor into both ABL1 windows, and only the right-hand window has a STAR-Fusion band." src="/img/cancer_sv/k562_bcr_abl_split.png" />

## Where the DNA broke under BCR-ABL1 and NUP214-XKR3

A fusion caller reports transcribed junctions, so its breakpoints sit on exon
edges. Two DNA assays on the same cells show where the chromosome broke and how
much of it is amplified: ENCODE's 10X Chromium linked-read run on K562
(ENCSR053AXS, [Zhou et al. 2019](https://doi.org/10.1101/gr.234948.118)) called
the breakends, the two ends of each junction, and DepMap's WGS segmentation
gives the copy number. The build script lifts the breakends to hg38 and adds
both as tracks:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "K562_10x_sv",
  "name": "K562 DNA breakpoints (10X linked reads, lifted to hg38)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": { "uri": "K562.10x-large-sv.vcf.gz" },
    "index": { "location": { "uri": "K562.10x-large-sv.vcf.gz.tbi" } }
  }
}
```

```json addtrack
{
  "trackId": "K562_cn",
  "name": "K562 copy-number segments (DepMap WGS)",
  "uri": "K562_cn.bw",
  "assemblyNames": ["hg38"],
  "displayDefaults": {
    "scales": {
      "y": { "domainMin": 0, "domainMax": 8, "title": "copy ratio (DepMap)" }
    }
  }
}
```

Open chr9 from _ABL1_ to past _NUP214_ with the copy-number track under both
call tracks, and pick **Display types → Marks** from each call track's menu. A
record that names its partner breakend draws as a `link` with nothing configured
([mark display](/docs/config_guides/mark_display#links)), and a call whose
partner is on another chromosome draws a stem at its breakpoint.

<Figure caption="chr9 from ABL1 to past NUP214: STAR-Fusion junctions from RNA-seq, 10X DNA breakends and DepMap copy number, with the three DNA breaks banded. Copy number steps at the outer two breaks. The BCR-ABL1 junction sits well right of its break, the NUP214-XKR3 junction on top of its break, and the right-hand break reaches chr13, where nothing is transcribed." src="/img/cancer_sv/k562_amplicon_dna.png" />

| Junction        | RNA junction (STAR-Fusion)        | DNA break (10X)           | Apart                 |
| --------------- | --------------------------------- | ------------------------- | --------------------- |
| _BCR_ donor     | chr22:23,290,413, end of exon 14  | chr22:23,290,556          | 143 bp into intron 14 |
| _ABL1_ acceptor | chr9:130,854,064, start of exon 2 | chr9:130,731,760          | 122 kb, in intron 1   |
| _NUP214_ donor  | chr9:131,199,015, end of exon 29  | chr9:131,199,198          | 183 bp into intron 29 |
| _XKR3_ acceptor | chr22:16,808,083, start of exon 3 | chr22:16,819,350          | 11 kb, in intron 2    |
| none            | no call                           | chr9:131,280,138 to chr13 | no gene at either end |

The amplified block on chr9 ends where the DNA breaks do. The _ABL1_ intron 1
break is also the locus that
[a Hi-C scan](/docs/tutorials/hic_structural_variants) pairs with _BCR_. The
right-hand break joins chr9 to a point on chr13 outside any gene, so no
transcript crosses it and no fusion caller reports it. DepMap's segmentation has
no interval over _BCR_, so the donor window shows an arc and no copy-number
step. SplitThreader read the _ERBB2_ amplicon in SK-BR-3 the same way, matching
copy-number steps to breakpoints
([Nattestad et al. 2018](https://doi.org/10.1101/gr.231100.117)).

## Reproduce it end to end

[`scripts/build_cancer_sv_demo.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_cancer_sv_demo.sh)
builds everything above from public sources. For K562 it:

1. sorts the four ENCODE Iso-Seq runs, which ENCODE releases unsorted, and
   merges them into the one read track the junction counts come from
2. cuts K562's rows out of DepMap's fusion and copy-number tables, with the
   fusion calls ordered by FFPM, fusion fragments per million RNA-seq fragments,
   so the best-supported call comes first
3. lifts the 10X breakends to hg38 as above, and drops a junction whole when
   either end fails to lift or lands reversed in hg38, where its orientation
   would come out wrong

The same run builds the COLO829 half of the demo, which
[](/docs/tutorials/cancer_sv) walks through.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_cancer_sv_demo.sh
bash build_cancer_sv_demo.sh    # builds ./cancer_sv_build/jbrowse2
npx --yes serve cancer_sv_build/jbrowse2
```

## See also

- [](/docs/tutorials/cancer_sv)
- [](/docs/tutorials/hic_structural_variants)
- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/sv_visualization)
- [](/docs/tutorials/sv_visualization_cgiab)

## Citations

- Nattestad M, et al. Complex rearrangements and oncogene amplifications
  revealed by long-read DNA and RNA sequencing of a breast cancer cell line.
  _Genome Research_ (2018). https://doi.org/10.1101/gr.231100.117
- Zhou B, et al. Comprehensive, integrated, and phased whole-genome analysis of
  the primary ENCODE cell line K562. _Genome Research_ (2019).
  https://doi.org/10.1101/gr.234948.118
