---
title: Differential transcript usage
sidebar_label: RNA-seq (differential transcript usage)
description:
  Build a GFF3 carrying a per-transcript statistic in its attribute column, and
  configure a gene track to paint it
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
data: pipeline
---

**TL;DR:** a per-transcript statistic goes into the GFF3 attribute column, and a
`jexl:` color callback on the gene track paints it. This page builds that GFF3
from ENCODE quantifications and gives the track configuration that reads it.

## Prerequisites

- `curl`
- `python3`
- htslib (`bgzip`, `tabix`)
- R with satuRn, SummarizedExperiment, edgeR and limma, all Bioconductor
- to read along without running anything, the finished analysis is hosted at
  [jbrowse.org/demos/dtu](https://jbrowse.org/demos/dtu/)

## Where the data comes from

ENCODE's ENTEx panel, four skeletal-muscle and four liver donors, quantified
with RSEM against GENCODE v29.

- eight RSEM per-transcript quantification tables, the four muscle donors then
  the four liver donors:
  https://www.encodeproject.org/files/ENCFF353NZM/@@download/ENCFF353NZM.tsv,
  https://www.encodeproject.org/files/ENCFF172SLW/@@download/ENCFF172SLW.tsv,
  https://www.encodeproject.org/files/ENCFF140GJI/@@download/ENCFF140GJI.tsv,
  https://www.encodeproject.org/files/ENCFF576DOG/@@download/ENCFF576DOG.tsv,
  https://www.encodeproject.org/files/ENCFF996LRE/@@download/ENCFF996LRE.tsv,
  https://www.encodeproject.org/files/ENCFF641ADT/@@download/ENCFF641ADT.tsv,
  https://www.encodeproject.org/files/ENCFF392VYD/@@download/ENCFF392VYD.tsv,
  https://www.encodeproject.org/files/ENCFF383KWZ/@@download/ENCFF383KWZ.tsv
- the four coverage bigWigs the demo's track config loads, one donor per tissue,
  plus and minus strand:
  https://www.encodeproject.org/files/ENCFF007ZBY/@@download/ENCFF007ZBY.bigWig,
  https://www.encodeproject.org/files/ENCFF518WGP/@@download/ENCFF518WGP.bigWig,
  https://www.encodeproject.org/files/ENCFF565QRM/@@download/ENCFF565QRM.bigWig,
  https://www.encodeproject.org/files/ENCFF253OSP/@@download/ENCFF253OSP.bigWig
- the GENCODE v29 annotation those quantifications were made against:
  https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_29/gencode.v29.annotation.gff3.gz
- the finished GFF3 with satuRn's statistics written in, rehosted so the track
  configuration below loads without the build:
  https://jbrowse.org/demos/dtu/dtu_muscle_vs_liver.gff3.gz

## Building the GFF3

Four steps take the ENCODE quantifications to a GFF3 the gene glyph can paint.
One [script](#reproduce-it-end-to-end) runs all four.

**Fetch the quantifications.** Eight RSEM per-transcript tables from ENCODE's
ENTEx panel, skeletal muscle and liver, four donors each, quantified against
GENCODE v29. The accessions are written into the script.

**Build the matrices.** One pass over those tables writes a count matrix and a
TPM matrix: counts feed the model, TPM feeds the effect size.

**Test usage.** [satuRn](https://doi.org/10.12688/f1000research.51749.1) fits a
quasi-binomial model to each transcript's share of its gene's reads and tests
that share between the two tissues, over a counts matrix and a `tissue` column:

<!-- from: scripts/build_dtu_demo.sh -->

```r
# after filterByExpr, any gene left with one isoform goes too: usage is a
# within-gene proportion, so a lone isoform is always 100%
keep <- edgeR::filterByExpr(cnt, group = coldata$tissue)
cnt <- cnt[keep, ]
multi <- names(which(table(txinfo$gene_id) > 1))
cnt <- cnt[txinfo$isoform_id[txinfo$gene_id %in% multi], ]

# rowData has to carry isoform_id and gene_id: satuRn reads each transcript's
# gene from there to know whose proportion the transcript is a share of
se <- SummarizedExperiment(
  assays = list(counts = cnt),
  colData = coldata,
  rowData = txinfo
)

# the formula names the colData column holding the groups. 0 + tissue drops the
# intercept, so each tissue gets its own coefficient and the contrast below is a
# plain difference between two of them rather than a difference of differences
se <- satuRn::fitDTU(object = se, formula = ~ 0 + tissue, parallel = FALSE)

design <- model.matrix(~ 0 + tissue, data = coldata)
colnames(design) <- levels(factor(coldata$tissue))
L <- limma::makeContrasts(muscle_vs_liver = muscle - liver, levels = design)

# sort = FALSE leaves the result rows in the order the assay had them, which is
# what lets the isoform fractions be indexed straight into the result
se <- satuRn::testDTU(object = se, contrasts = L, sort = FALSE)
res <- rowData(se)[["fitDTUResult_muscle_vs_liver"]]
```

`res` carries the p-value, both FDRs and the model's own estimates per
transcript. The isoform fractions the color reads come from the TPM matrix
rather than from this table.

**Write the statistics into GENCODE.** The called genes are subset out of the
GENCODE v29 GFF3 and each transcript's numbers are appended to its attribute
column. The rows come out in coordinate order, so indexing is the ordinary pair:

<!-- from: scripts/build_dtu_demo.sh -->

```bash
bgzip -f dtu_muscle_vs_liver.gff3
tabix -f -p gff dtu_muscle_vs_liver.gff3.gz
```

### The attribute column

This is the part the track configuration depends on. A transcript row from the
finished file, wrapped:

```
chr10  HAVANA  transcript  7788129  7807815  .  +  .
  ID=ENST00000356708.11;Parent=ENSG00000165629.19;gene_name=ATP5F1C;
  transcript_name=ATP5F1C-202;...;
  dif=-0.299;fdr=0.0022;if_muscle=0.075;if_liver=0.375;
  tpm_muscle=10.03;tpm_liver=28.88;dtu=liver
```

Three properties of that line, each of which fails without an error:

- **keys are lowercase**: the GFF parser lowercases them, so `dIF=` read back as
  `feature.dIF` is undefined, and an undefined branch returns the default color
- **values are strings**, so numeric comparison requires `parseFloat`
- **the numbers are on the transcript row and nothing below it**: the glyph
  evaluates the color against the box it paints, so the callback reaches up with
  `feature.parent.dif`. `feature.dif` reads the exon and paints the default

`dtu` is a flag with the values `muscle`, `liver` and `ns`, set by the same
threshold the script reports on. The color branches on it before reading `dif`,
so transcripts the test could not separate stay neutral.

### The effect size and the FDR gate

**Effect size from TPM, model fit on counts.** Isoform fraction is a molar
quantity, and read counts scale with abundance times effective length, so a
count-based fraction is biased toward long isoforms.

**The gate is satuRn's regular FDR.** Its empirical FDR assumes most tests are
null, which does not hold for this contrast: `locfdr` reports a misfit, and no
transcript passes it. The script prints the minimum empirical FDR beside its
count.

## Configuring the track

One expression covers the whole transcript: a UTR follows `color` unless
`utrColor` claims it. `labels.name` reads GENCODE's `transcript_name`, which
also names the isoform under the cursor, and `legend` declares what the ramp
means. `mouseover` resolves against the gene, so it summarizes the gene; an
isoform's own numbers are in the details panel, one click away.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "dtu_muscle_vs_liver",
  "name": "Transcript usage: skeletal muscle vs liver (satuRn)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/demos/dtu/dtu_muscle_vs_liver.gff3.gz"
  },
  "displayDefaults": {
    "subfeatureLabels": "below",
    "color": "jexl:feature.parent.dtu=='muscle'?(parseFloat(feature.parent.dif)>0.6?'#901e21':parseFloat(feature.parent.dif)>0.3?'#c63335':'#d5716a'):feature.parent.dtu=='liver'?(parseFloat(feature.parent.dif)<-0.6?'#124f95':parseFloat(feature.parent.dif)<-0.3?'#2370cc':'#6394d5'):'#b2b1ac'",
    "labels": {
      "name": "jexl:feature.transcript_name||feature.gene_name||feature.name||feature.id"
    },
    "mouseover": "jexl:feature.gene_name+': '+feature.dtu_transcripts+' isoform(s) with a usage shift, largest ΔIF '+feature.dtu_top_dif",
    "legend": [
      { "label": "muscle-preferred, ΔIF > 0.6", "color": "#901e21" },
      { "label": "muscle-preferred, ΔIF 0.3–0.6", "color": "#c63335" },
      { "label": "muscle-preferred, ΔIF 0.1–0.3", "color": "#d5716a" },
      { "label": "no usage shift (FDR ≥ 0.05)", "color": "#b2b1ac" },
      { "label": "liver-preferred, ΔIF 0.1–0.3", "color": "#6394d5" },
      { "label": "liver-preferred, ΔIF 0.3–0.6", "color": "#2370cc" },
      { "label": "liver-preferred, ΔIF > 0.6", "color": "#124f95" }
    ]
  }
}
```

The track loads over the two coverage tracks at _ATP5F1C_. satuRn used no
genomic coordinates, so the coverage lanes are an independent check on the
color.

<Figure caption="ATP5F1C on hg38. ENCODE skeletal-muscle and liver RNA-seq coverage on a shared scale, over GENCODE transcripts colored by the isoform-fraction change satuRn measured between the two tissues. The marked column is the cassette exon, where the muscle lane is flat and the liver lane peaks." src="/img/dtu/dtu_colored_gene_glyph.png" links="Open this view=dtu/dtu_colored_gene_glyph" />

## Reproduce it end to end

Every step above is wrapped in one script,
[`build_dtu_demo.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dtu_demo.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dtu_demo.sh
bash build_dtu_demo.sh dtu_build   # writes ./dtu_build/
```

It fetches the eight RSEM tables and the four coverage bigWigs from ENCODE,
downloads the GENCODE v29 GFF3 those quantifications were made against, runs the
satuRn fit, and writes `dtu_muscle_vs_liver.gff3.gz` with its `.tbi` index: the
local build of the file the track configuration above loads from jbrowse.org.
Point the adapter's `uri` at the local copy to open your own run instead. It
needs [Prerequisites](#prerequisites) on your `PATH`.

Along the way it prints the transcript and gene counts at each filtering step,
and the minimum empirical FDR beside the regular-FDR count.

## See also

- [](/docs/user_guides/gene_track)
- [](/docs/config_guides/jexl)
- [](/docs/tutorials/rnaseq)

## References

- Gilis J, Vitting-Seerup K, Van den Berge K, Clement L.
  [satuRn: Scalable analysis of differential transcript usage for bulk and single-cell RNA-sequencing applications](https://doi.org/10.12688/f1000research.51749.1).
  _F1000Research_ 10:374 (2021), the method behind the statistic drawn here.
- Li B, Dewey CN.
  [RSEM: accurate transcript quantification from RNA-Seq data with or without a reference genome](https://doi.org/10.1186/1471-2105-12-323).
  _BMC Bioinformatics_ 12:323 (2011), the quantifier ENCODE ran.
