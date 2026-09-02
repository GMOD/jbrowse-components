---
title: Gene fusion calls and the DNA behind them
sidebar_label: SVs (gene fusion calls)
description:
  Triage a fusion caller's output against the long RNA reads it was called from,
  then find the DNA break the transcript junction does not sit on
guide_category: Tutorials
tutorial_category: Cancer genomics
---

**TL;DR:** a fusion caller hands you a table of gene pairs and a junction
coordinate, and nothing about the DNA event underneath. Load STAR-Fusion's table
beside the long RNA reads it was called from, count the molecules that cross
each junction, then find where the chromosome actually broke: for K562's
BCR-ABL1 that is 122 kb away from the junction the caller reports, inside
_ABL1_'s first intron.

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
chord per row. **Add → SV inspector**, then a File Type of STAR-Fusion, which
the wizard cannot infer from a `.tsv` extension.

Searching the table narrows both halves. `chr9` leaves `BCR--ABL1` and
`NUP214--XKR3`, one junction seen from both sides, with more junction reads than
anything else in the file.

Each row's caret menu has **Open in linear genome view**, which goes to its
breakpoint. Type the partner's window into the location box after it to hold
both side by side, then turn on **Read connections → View as pairs** to merge
each molecule's two alignments onto one row. Flip the chr22 region (`[rev]`),
since _XKR3_ is on the minus strand.

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

Near-identical curves stack into one line. **Read connections → Show read arcs**
adds a band under the coverage where each junction is drawn once, thickened by
the reads behind it. An arc needs both ends in view, and each acceptor window
receives one. The vertical at the _BCR_ donor stands for the molecules whose
_ABL1_ alignment lands in neither window.

<Figure caption="BCR on chr22 beside two ABL1 windows on chr9 as three regions of one view, showing only split reads with supplementary alignments linked. The arc band draws one counted arc from the BCR donor into each ABL1 window, and only the right-hand window carries a STAR-Fusion band." src="/img/cancer_sv/k562_bcr_abl_split.png" />

## Where the DNA broke

BCR-ABL1 is amplified as well as expressed. Both chr9 breakpoints fall inside a
segment at roughly seven copies while the chr22 partners sit at one. DepMap's
segmentation covers no interval over _BCR_ itself, so that window has an arc but
no copy-number step.

A fusion caller only reports transcribed junctions, so its arcs land on exon
boundaries and cannot say where the amplified block begins. ENCODE's 10X
Chromium linked-read run on K562 (ENCSR053AXS) puts the chr9 DNA breakpoint at
130,731,760, and DepMap's copy-number segmentation steps up at 130,731,326. The
transcript junction is 122 kb to the right of both, inside _ABL1_'s first
intron: the amplicon boundary is a DNA break, and the transcript is spliced from
it to the nearest exon.

SplitThreader applied the same reasoning to the _ERBB2_ amplicon in SK-BR-3
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
- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/sv_visualization)
- [](/docs/tutorials/sv_visualization_cgiab)

## References

- Nattestad M, et al. Complex rearrangements and oncogene amplifications
  revealed by long-read DNA and RNA sequencing of a breast cancer cell line.
  _Genome Research_ (2018). https://doi.org/10.1101/gr.231100.117
