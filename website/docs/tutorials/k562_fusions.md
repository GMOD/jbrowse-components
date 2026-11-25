---
title: Gene fusion calls and the DNA behind them
sidebar_label: SVs (gene fusion calls)
description:
  Triage a fusion caller's short-read calls against long RNA reads from the same
  cells, then find the DNA breaks in the introns beside the transcript junctions
guide_category: Tutorials
tutorial_category: Cancer genomics
---

A fusion caller writes a table of gene pairs, each with the coordinate of the
transcript junction where the RNA joins the two genes. The chromosome itself
broke somewhere in the introns around that junction, so the RNA call and the DNA
break sit at different coordinates. In the K562 leukemia cell line we take the
calls through long RNA reads to the DNA at _BCR_-_ABL1_ and _NUP214_-_XKR3_. We:

- load long RNA reads as an alignments track, and triage STAR-Fusion's calls in
  the SV inspector
- open the split RNA reads at _BCR_-_ABL1_ across three regions of one view,
  with read connections drawn between the pieces
- load the DNA breakpoints, lifted to hg38, and the copy number, and draw them
  with **Display types → Marks** beside the fusion calls

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

<!-- BEGIN GENERATED TUTORIAL_INSTALL samtools,htslib,jbrowse-cli,bedGraphToBigWig,liftOver,node -->

```bash
# Debian/Ubuntu
sudo apt install samtools tabix nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge samtools htslib \
  ucsc-bedgraphtobigwig ucsc-liftover nodejs
# or Linux x86_64 binaries for the tools apt lacks
wget -P ~/.local/bin \
  https://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/bedGraphToBigWig \
  https://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/liftOver
chmod +x ~/.local/bin/bedGraphToBigWig ~/.local/bin/liftOver
# any platform
npm install -g @jbrowse/cli@next
```

<!-- END GENERATED TUTORIAL_INSTALL samtools,htslib,jbrowse-cli,bedGraphToBigWig,liftOver,node -->

## The data

Four PacBio Iso-Seq runs from [ENCODE](https://www.encodeproject.org/), two
tables out of [DepMap](https://depmap.org/portal/)'s 24Q4 release, and the DNA
breakpoints on hg19.

The tracks below read local files that the
[build script](#reproduce-it-end-to-end) writes from these, fetching each
itself, so run it first, or swap in your own long RNA reads, as _Load hg38 and
the merged Iso-Seq reads_ shows; `depmap_to_jbrowse.py` takes any DepMap
cell-line ID.

| What it is                                                                                             | File                                                                                                          |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| K562 PacBio Iso-Seq, ENCODE `ENCFF433YKW`                                                              | [ENCFF433YKW.bam](https://www.encodeproject.org/files/ENCFF433YKW/@@download/ENCFF433YKW.bam)                 |
| K562 PacBio Iso-Seq, ENCODE `ENCFF092NLB`                                                              | [ENCFF092NLB.bam](https://www.encodeproject.org/files/ENCFF092NLB/@@download/ENCFF092NLB.bam)                 |
| K562 PacBio Iso-Seq, ENCODE `ENCFF515YRZ`                                                              | [ENCFF515YRZ.bam](https://www.encodeproject.org/files/ENCFF515YRZ/@@download/ENCFF515YRZ.bam)                 |
| K562 PacBio Iso-Seq, ENCODE `ENCFF475XQX`                                                              | [ENCFF475XQX.bam](https://www.encodeproject.org/files/ENCFF475XQX/@@download/ENCFF475XQX.bam)                 |
| K562 STAR-Fusion calls (DepMap 24Q4, `OmicsFusionFiltered.csv`)                                        | [51065693](https://ndownloader.figshare.com/files/51065693)                                                   |
| K562 copy-number segments (DepMap 24Q4 WGS, `OmicsCNSegmentsProfile.csv`)                              | [51065333](https://ndownloader.figshare.com/files/51065333)                                                   |
| K562 DNA breakpoints (ENCODE 10X linked-read large-SV calls, hg19, lifted to hg38 by the build script) | [ENCFF863MPP.vcf.gz](https://www.encodeproject.org/files/ENCFF863MPP/@@download/ENCFF863MPP.vcf.gz)           |
| The hg19-to-hg38 chain the lift uses                                                                   | [hg19ToHg38.over.chain.gz](https://hgdownload.soe.ucsc.edu/goldenPath/hg19/liftOver/hg19ToHg38.over.chain.gz) |

## Cut K562 from DepMap and lift its breakpoints

K562 is a chronic myeloid leukemia line with the Philadelphia chromosome, the
t(9;22) translocation between chr9 and chr22 that fuses _BCR_ to _ABL1_.

The fusion and copy-number tables both cover every line in the release.
`depmap_to_jbrowse.py` filters to one line and writes a STAR-Fusion TSV from the
fusion table and a bedGraph from the copy-number segments. K562 is model
`ACH-000551`, and its WGS copy-number profile is `PR-aheaZL`:

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
curl -O https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chrom.sizes
python3 depmap_to_jbrowse.py fusions OmicsFusionFiltered.csv ACH-000551 K562.star-fusion.tsv
python3 depmap_to_jbrowse.py segments OmicsCNSegmentsProfile.csv PR-aheaZL K562_cn.bedGraph
sort -k1,1 -k2,2n K562_cn.bedGraph |
  awk 'NR==FNR{ok[$1];next} ($1 in ok)' hg38.chrom.sizes - > K562_cn.sorted.bedGraph
bedGraphToBigWig K562_cn.sorted.bedGraph hg38.chrom.sizes K562_cn.bw
```

The DNA breakpoints are on hg19, and a breakend record has a second coordinate
inside its `ALT` string, so a plain `liftOver` of the `POS` column leaves the
partner coordinates on hg19.
[`lift_bnd_vcf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/lift_bnd_vcf.py)
moves both:

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
python3 lift_bnd_vcf.py calls.hg19.vcf.gz hg19ToHg38.over.chain.gz \
  liftOver calls.hg38.vcf liftwork
bgzip calls.hg38.vcf && tabix -f -C -p vcf calls.hg38.vcf.gz
```

## Load hg38 and the merged Iso-Seq reads

The lifted DNA breakpoints and the Iso-Seq molecules are on hg38, so we load
that assembly first.

```json addassembly genome=hg38
{
  "name": "hg38",
  "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
  "refNameAliases": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"
  },
  "cytobands": "https://jbrowse.org/genomes/GRCh38/cytoBand.txt"
}
```

The figures also show NCBI's RefSeq genes as a track:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "ncbi_refseq_hg38",
  "name": "NCBI RefSeq genes",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "gffGzLocation": {
      "uri": "https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz"
    },
    "index": {
      "indexType": "CSI",
      "location": {
        "uri": "https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi"
      }
    }
  }
}
```

ENCODE releases each Iso-Seq alignment unsorted. Sort each run, merge them into
one BAM and index it:

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
samtools sort -o s_run1.bam run1.bam
samtools sort -o s_run2.bam run2.bam
samtools sort -o s_run3.bam run3.bam
samtools sort -o s_run4.bam run4.bam
samtools merge -f K562_isoseq.bam s_run1.bam s_run2.bam s_run3.bam s_run4.bam
samtools index K562_isoseq.bam
```

The merged BAM loads as one read track. For your own long RNA reads, swap `uri`
for a BAM aligned to the same assembly, with its `.bai` beside it:

```json addtrack
{
  "trackId": "K562_isoseq",
  "name": "K562 PacBio Iso-Seq (ENCODE)",
  "uri": "K562_isoseq.bam",
  "assemblyNames": ["hg38"]
}
```

## Triage the STAR-Fusion calls in the SV inspector

**Add → SV inspector**, then the file, opens the STAR-Fusion table beside a
circular view of it, one chord per row. The import form reads the **File Type**
from the filename or the table's header line, and its menu sets the type by
hand.

Type into the SV inspector's search box to filter the table and the circular
view together:

- `chrM` keeps the rows that pair a gene with a mitochondrial transcript, the
  usual chimeric-read artifacts.
- `Mitelman` keeps the rows listed in the fusion databases.
- `chr9` keeps the rows with a junction on chr9, such as `BCR--ABL1` and
  `NUP214--XKR3`.

Each table row's caret menu has **Open in linear genome view**, which puts the
row's two breakpoints side by side as two regions of one view:

- Each region is oriented so the fusion transcript reads left to right across
  the join. _XKR3_ is on the minus strand, so its region opens reversed
  (`[rev]`).
- **Read connections → View as pairs/link supplementary alignments** merges each
  molecule's two alignments onto one row.
- The figure's track is filtered to the split reads with alignments on both chr9
  and chr22, by the `filter` in this restatement of the Iso-Seq track:

```json addtrack
{
  "trackId": "K562_isoseq",
  "name": "K562 PacBio Iso-Seq (ENCODE)",
  "uri": "K562_isoseq.bam",
  "assemblyNames": ["hg38"],
  "displayDefaults": {
    "filter": [
      { "field": "split", "equal": true },
      { "field": "alignedRefNames", "equal": "chr9" },
      { "field": "alignedRefNames", "equal": "chr22" }
    ]
  }
}
```

<Figure caption="NUP214--XKR3 as two regions of one view with reads linked, opened from its row in the SV inspector." src="/img/cancer_sv/k562_fusion_inspector_reads.png" links="Import form=cancer_sv/k562_fusion_inspector_form,All 44 calls=cancer_sv/k562_fusion_inspector_all,Searched for chr9=cancer_sv/k562_fusion_inspector_pair,Linked reads=cancer_sv/k562_fusion_inspector_reads" />

Load the STAR-Fusion TSV as a track:

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

## Open BCR-ABL1's split reads across three regions

The transcript reaches _ABL1_ at more than one place, so the view uses three
regions: the _BCR_ donor, where the transcript starts, and two _ABL1_ acceptor
windows. Right-click a read that crosses the junction and choose **Split current
view to show split alignments**, or type the three locations into the location
box separated by spaces:
`chr22:23,286,000-23,293,000 chr9:130,778,000-130,785,000 chr9:130,851,000-130,858,000`.

A read crossing the junction is one alignment on chr22 and a supplementary
alignment (the second piece of the split read) on chr9. In the track menu:

- **Read connections → View as pairs/link supplementary alignments** puts the
  two on one row and joins them across the region divider.
- **Filter by → Split reads → Only split reads** draws only the reads aligned in
  more than one piece (an `SA` tag or the supplementary flag), which here
  include the reads that continue on chr9. The coverage still counts every read;
  **Group by → Split reads**, with the "Not split" band hidden by the hide
  button on its label chip, gives the split reads' coverage, as the figure
  shows.
- **Read connections → Read arcs** adds a band under the coverage with one arc
  per junction, thicker where more reads support it. An arc needs both ends in
  view: the right-hand window gets one arc and the intron 1 window two, one at
  each place the reads enter it.

A vertical line at the _BCR_ donor marks molecules whose _ABL1_ alignment falls
in neither window.

<Figure caption="BCR beside two ABL1 windows, showing split reads only, with coverage counting the split reads alone." src="/img/cancer_sv/k562_bcr_abl_split.png" />

## Load the DNA breakpoints and copy number

A fusion caller reports transcribed junctions, which sit on exon edges. Two DNA
assays on the same cells measure where the chromosome broke and how much of it
is amplified:

- **10X Chromium linked reads** from ENCODE (ENCSR053AXS,
  [Zhou et al. 2019](https://doi.org/10.1101/gr.234948.118)) give the breakends,
  the two ends of each junction.
- **DepMap WGS segmentation** gives the copy number.

The build script lifts the breakends to hg38 and adds both as tracks:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "K562_10x_sv",
  "name": "K562 DNA breakpoints (10X linked reads, lifted to hg38)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": { "uri": "K562.10x-large-sv.vcf.gz" },
    "index": {
      "location": { "uri": "K562.10x-large-sv.vcf.gz.csi" },
      "indexType": "CSI"
    }
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
    "encoding": {
      "y": {
        "scale": { "domainMin": 0, "domainMax": 8 },
        "axis": { "title": "copy ratio (DepMap)" }
      }
    }
  }
}
```

Open chr9 from _ABL1_ to past _NUP214_ with the copy-number track under both
call tracks, and pick **Display types → Marks** from each call track's menu. In
[grammar-of-graphics](/docs/config_guides/mark_display) terms, a `mark` is the
shape drawn per record. A record that names its partner breakend is drawn as a
`link` with nothing configured
([mark display](/docs/config_guides/mark_display#links)), and a call whose
partner is on another chromosome is drawn as a stem at its breakpoint.

<Figure caption="chr9 from ABL1 past NUP214: STAR-Fusion junctions, 10X DNA breakends and DepMap copy number, the DNA breaks banded." src="/img/cancer_sv/k562_amplicon_dna.png" />

## Reproduce it end to end

[`scripts/build_cancer_sv_demo.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_cancer_sv_demo.sh)
builds everything above from public sources. For K562 it:

- sorts the four ENCODE Iso-Seq runs, which ENCODE releases unsorted, and merges
  them into the one read track the junction counts come from
- cuts K562's rows out of DepMap's fusion and copy-number tables, with the
  fusion calls ordered by FFPM (fusion fragments per million RNA-seq fragments),
  best-supported first
- lifts the 10X breakends to hg38 as above, and drops a junction whole when
  either end fails to lift or maps reversed in hg38, where its orientation would
  come out wrong

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

- Zhou et al. (2019).
  [Comprehensive, integrated, and phased whole-genome analysis of the primary ENCODE cell line K562](https://doi.org/10.1101/gr.234948.118)
