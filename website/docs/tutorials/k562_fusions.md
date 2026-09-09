---
title: Gene fusion calls and the DNA behind them
sidebar_label: SVs (gene fusion calls)
description:
  Triage a fusion caller's short-read calls against long RNA reads from the same
  cells, then find the DNA breaks the transcript junctions do not sit on
guide_category: Tutorials
tutorial_category: Cancer genomics
---

**TL;DR:** a fusion caller hands you a table of gene pairs and a junction
coordinate, and nothing about the DNA event underneath. Load STAR-Fusion's
short-read calls beside long RNA reads from the same cell line, count the
molecules that cross each junction, then find where the chromosome actually
broke: K562's BCR-ABL1 breaks 122 kb before the junction the caller reports,
inside _ABL1_'s first intron, and the other junction of the same amplicon breaks
on top of its own.

## Prerequisites

- nothing to read along. Everything below is for rebuilding the data
- a JBrowse to open them in: [Desktop](/docs/quickstart_desktop) takes a local
  file by path, [Web](/docs/quickstart_web) through **Add track**
- [](/docs/cli)
- [samtools](http://www.htslib.org/), to sort and merge the four Iso-Seq runs
- `bedGraphToBigWig` and `liftOver`, both from the
  [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/)
- `python3`, for `depmap_to_jbrowse.py` and `lift_bnd_vcf.py`

The two python helpers are one file each:

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

## K562

K562 is a chronic myeloid leukemia line carrying the Philadelphia chromosome,
the t(9;22) that fuses _BCR_ to _ABL1_. Its transcripts here are long RNA reads,
its fusion calls come from DepMap's short-read pipeline, and its DNA breakpoints
from a linked-read run.

Both DepMap tables cover every line in the release. `depmap_to_jbrowse.py`
filters to one line and writes a STAR-Fusion TSV from the fusion table and a
bedGraph from the copy-number segments. K562 is model `ACH-000551`, and its WGS
copy-number profile is `PR-aheaZL`:

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
python3 depmap_to_jbrowse.py fusions OmicsFusionFiltered.csv ACH-000551 K562.star-fusion.tsv
python3 depmap_to_jbrowse.py segments OmicsCNSegmentsProfile.csv PR-aheaZL K562_cn.bedGraph
sort -k1,1 -k2,2n K562_cn.bedGraph |
  awk 'NR==FNR{ok[$1];next} ($1 in ok)' hg38.chrom.sizes - > K562_cn.sorted.bedGraph
bedGraphToBigWig K562_cn.sorted.bedGraph hg38.chrom.sizes K562_cn.bw
```

The DNA breakpoints arrive on hg19. A breakend record carries a second
coordinate inside its `ALT` string, so a plain `liftOver` of the `POS` column
produces a valid VCF whose partner coordinates still point at hg19.
[`lift_bnd_vcf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/lift_bnd_vcf.py)
moves both:

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
python3 lift_bnd_vcf.py calls.hg19.vcf.gz hg19ToHg38.over.chain.gz \
  ./liftOver calls.hg38.vcf liftwork
bgzip calls.hg38.vcf && tabix -p vcf calls.hg38.vcf.gz
```

The script's five arguments are the input VCF, the chain, the `liftOver` binary,
the output VCF and a scratch directory.

## Triaging the calls

The SV inspector opens the STAR-Fusion table beside a circular view of it, one
chord per row. **Add → SV inspector**, then the file: the import form reads the
File Type off a STAR-Fusion filename or the table's own header line, and the
menu sets it by hand for a file named some other way.

Searching the table narrows both halves. `chrM` collects the rows that pair a
gene with a mitochondrial transcript, the usual chimeric-read artefacts, and
`Mitelman` leaves the two rows the fusion databases already know. `chr9` leaves
the same two, `BCR--ABL1` and `NUP214--XKR3`: two junctions between chr9 and
chr22 whose chr22 partners are 6.5 Mb apart, which the rest of the page shows to
be the two ends of one amplified segment.

Each row's caret menu has **Open in linear genome view**, which puts the row's
two breakpoints side by side as two regions of one view, each turned so the
fusion transcript reads left to right across the join. _XKR3_ is on the minus
strand, so its region arrives reversed (`[rev]`). Turn on **Read connections →
View as pairs / link supplementary alignments** to merge each molecule's two
alignments onto one row.

<Figure caption="NUP214--XKR3 as two regions of one view with reads linked, opened from its row in the SV inspector. The breakpoints are banded green and each line is one Iso-Seq molecule running from NUP214 into XKR3." src="/img/cancer_sv/k562_fusion_inspector_reads.png" links="Import form=cancer_sv/k562_fusion_inspector_form,All 44 calls=cancer_sv/k562_fusion_inspector_all,Searched for chr9=cancer_sv/k562_fusion_inspector_pair,Linked reads=cancer_sv/k562_fusion_inspector_reads" />

`BCR--ABL1` takes the rest of this page in the same layout. The build script
adds the STAR-Fusion calls as this track:

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

## BCR-ABL1 across three regions

Right-click a read that crosses the junction and choose **Split current view to
show split alignments**, or type the locations into the location box separated
by spaces. The transcript reaches _ABL1_ at more than one place, so this view
uses three regions, the _BCR_ donor and two acceptor windows.

A read crossing the junction is one alignment on chr22 and a supplementary
alignment on chr9. **Read connections → Use curved connectors** draws a curve
between the two across the region divider. **Filter by... → Split alignments →
Only split alignments** drops every read that stays on one chromosome.

Near-identical curves stack into one line. **Read connections → Read arcs** adds
a band under the coverage where each junction is drawn once, thickened by the
reads behind it. An arc needs both ends in view, and each acceptor window
receives one. The vertical at the _BCR_ donor stands for the molecules whose
_ABL1_ alignment lands in neither window.

<Figure caption="BCR on chr22 beside two ABL1 windows on chr9 as three regions of one view, showing only split reads with supplementary alignments linked. The arc band draws one counted arc from the BCR donor into each ABL1 window, and only the right-hand window carries a STAR-Fusion band." src="/img/cancer_sv/k562_bcr_abl_split.png" />

## Where the DNA broke

A fusion caller only reports transcribed junctions, so both of its breakpoints
sit on exon edges and say nothing about where the chromosome broke or how much
of it is amplified. Two DNA assays on the same cells answer that: ENCODE's 10X
Chromium linked-read run on K562 (ENCSR053AXS,
[Zhou et al. 2019](https://doi.org/10.1101/gr.234948.118)) called the breakends,
and DepMap's WGS segmentation gives the copy number. The build script lifts the
breakends to hg38 and adds both as tracks:

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
  "type": "QuantitativeTrack",
  "trackId": "K562_cn",
  "name": "K562 copy-number segments (DepMap WGS)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "K562_cn.bw"
  }
}
```

Open chr9 from _ABL1_ to past _NUP214_ with the copy-number track under both
call tracks, each switched to **Display types → Variant display arcs**. A call
whose partner is on another chromosome draws a stem at its breakpoint with a
tick toward the sequence it keeps.

<Figure caption="chr9 from ABL1 to past NUP214: STAR-Fusion junctions, 10X DNA breakends and DepMap copy number, with the three DNA breaks banded. Copy number steps at the outer two breaks. The BCR-ABL1 junction sits well right of its break, the NUP214-XKR3 junction on top of its own, and the right-hand break reaches chr13, where nothing is transcribed." src="/img/cancer_sv/k562_amplicon_dna.png" />

Both donors break a few hundred bases into the intron after their last retained
exon. Both acceptors break upstream of the exon the transcript lands on, and the
transcript is spliced from the break to that exon: a short hop for _XKR3_, a
long one across _ABL1_'s first intron.

| Junction        | RNA junction (STAR-Fusion)        | DNA break (10X)           | Apart                 |
| --------------- | --------------------------------- | ------------------------- | --------------------- |
| _BCR_ donor     | chr22:23,290,413, end of exon 14  | chr22:23,290,556          | 143 bp into intron 14 |
| _ABL1_ acceptor | chr9:130,854,064, start of exon 2 | chr9:130,731,760          | 122 kb, in intron 1   |
| _NUP214_ donor  | chr9:131,199,015, end of exon 29  | chr9:131,199,198          | 183 bp into intron 29 |
| _XKR3_ acceptor | chr22:16,808,083, start of exon 3 | chr22:16,819,350          | 11 kb, in intron 2    |
| none            | no call                           | chr9:131,280,138 to chr13 | no gene at either end |

The amplified block on chr9 ends where the DNA breaks do, and the right-hand
break, whose partner on chr13 is not inside any gene, is the one a fusion caller
cannot see. DepMap's segmentation covers no interval over _BCR_ itself, so the
donor's own window shows an arc but no copy-number step. SplitThreader applied
the same reasoning to the _ERBB2_ amplicon in SK-BR-3
([Nattestad et al. 2018](https://doi.org/10.1101/gr.231100.117)): copy-number
steps and breakpoints describing the same interval are evidence of one event.

## Reproduce it end to end

[`scripts/build_cancer_sv_demo.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_cancer_sv_demo.sh)
builds everything above from public sources:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_cancer_sv_demo.sh
bash build_cancer_sv_demo.sh    # builds ./cancer_sv_build/jbrowse2
npx --yes serve cancer_sv_build/jbrowse2
```

It merges the four ENCODE Iso-Seq alignments, converts the DepMap release into a
STAR-Fusion TSV and a copy-number bigWig, and lifts the ENCODE linked-read
breakpoints onto hg38. The same run builds the COLO829 half of the demo, which
[](/docs/tutorials/cancer_sv) walks through.

## See also

- [](/docs/tutorials/cancer_sv)
- [](/docs/tutorials/hic_structural_variants)
- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/sv_visualization)
- [](/docs/tutorials/sv_visualization_cgiab)

## References

- Nattestad M, et al. Complex rearrangements and oncogene amplifications
  revealed by long-read DNA and RNA sequencing of a breast cancer cell line.
  _Genome Research_ (2018). https://doi.org/10.1101/gr.231100.117
- Zhou B, et al. Comprehensive, integrated, and phased whole-genome analysis of
  the primary ENCODE cell line K562. _Genome Research_ (2019).
  https://doi.org/10.1101/gr.234948.118
