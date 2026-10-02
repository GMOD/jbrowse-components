---
title: Differential transcript usage
sidebar_label: RNA-seq (differential transcript usage)
description:
  Build a GFF3 carrying a per-transcript statistic in its attribute column, and
  configure a gene track to paint it
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
---

Differential transcript usage tests whether a gene changes which of its isoforms
it expresses between two conditions, here skeletal muscle and liver. We run the
test with satuRn on ENCODE quantifications, write each transcript's statistic
into the GFF3 attribute column, and color the gene track by it, with a key
listing each bin.

## Prerequisites

- a JBrowse to open them in: [Desktop](/docs/quickstart_desktop) takes a local
  file by path, [Web](/docs/quickstart_web) through **Add track**
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

The build takes the ENCODE quantifications to a colorable GFF3 in four steps,
and one [script](#reproduce-it-end-to-end) runs all four.

**Fetch the quantifications.** The script downloads the eight RSEM tables listed
above, with the accessions written into it.

**Build the matrices.** One pass over those tables writes a count matrix and a
TPM matrix: counts feed the model, TPM feeds the effect size.

**Test usage.** [satuRn](https://doi.org/10.12688/f1000research.51749.1) fits a
quasi-binomial model to each transcript's share of its gene's reads and tests
that share between the two tissues. It needs a transcript-by-sample count matrix
`cnt`, a `coldata` table with one `tissue` row per sample, and a `txinfo` table
with an `isoform_id` and a `gene_id` for each transcript:

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

`res` holds the p-value, both FDRs and the model estimates per transcript. The
script computes the isoform fractions for the color from the TPM matrix.

**Write the statistics into GENCODE.** The annotation has to be the release the
quantifications were made against. RSEM names each transcript with its version,
`ENST00000356708.11`, and GENCODE raises that version whenever it revises the
transcript, so joining these tables against a later release drops every
transcript revised since, with no error. ENCODE lists the release on each
quantification's file page as its genome annotation, `V29` for all eight here.

The script keeps each gene with a called transcript that is meaningfully
expressed, since a fraction can swing widely on a handful of reads. It subsets
those genes out of the GENCODE v29 GFF3 and appends each transcript's numbers to
its attribute column.

To do the same join over your own results, write the table as `results.tsv` with
one row per transcript and the columns `isoform_id`, `regular_FDR` and `dIF`
(the isoform-fraction change). This version keeps every GENCODE row and appends
the numbers to each transcript row, with the keys the track reads: `dif`, `fdr`,
`dtu` and `dif_called`:

<!-- from: scripts/build_dtu_demo.sh -->

```python
import csv
import gzip

stats = {r['isoform_id']: r
         for r in csv.DictReader(open('results.tsv'), delimiter='\t')}

records = []
with gzip.open('gencode.v29.annotation.gff3.gz', 'rt') as fh:
    for line in fh:
        if line.startswith('#'):
            continue
        cols = line.rstrip('\n').split('\t')
        if cols[2] == 'transcript':
            d = dict(kv.split('=', 1) for kv in cols[8].split(';') if '=' in kv)
            r = stats.get(d['transcript_id'])
            if r:
                dif, fdr = float(r['dIF']), float(r['regular_FDR'])
                direction = 'ns'
                if fdr < 0.05 and abs(dif) > 0.1:
                    direction = 'muscle' if dif > 0 else 'liver'
                cols[8] += f';dif={dif:.3f};fdr={fdr:.3g};dtu={direction}'
                if direction != 'ns':
                    cols[8] += f';dif_called={dif:.3f}'
        records.append((cols[0], int(cols[3]), int(cols[4]), '\t'.join(cols)))

records.sort(key=lambda r: r[:3])
with open('dtu_muscle_vs_liver.gff3', 'w') as out:
    out.write('##gff-version 3\n')
    for _, _, _, line in records:
        out.write(line + '\n')
```

The rows come out in coordinate order, so indexing is the ordinary pair:

<!-- from: scripts/build_dtu_demo.sh -->

```bash
bgzip -f dtu_muscle_vs_liver.gff3
tabix -f -p gff dtu_muscle_vs_liver.gff3.gz
```

### The attribute column

The track configuration reads its values from this column. A transcript row from
the finished file, wrapped:

```text
chr10  HAVANA  transcript  7788129  7807815  .  +  .
  ID=ENST00000356708.11;Parent=ENSG00000165629.19;gene_name=ATP5F1C;
  transcript_name=ATP5F1C-202;...;
  dif=-0.299;fdr=0.0022;if_muscle=0.075;if_liver=0.375;
  tpm_muscle=10.03;tpm_liver=28.88;dtu=liver;dif_called=-0.299
```

The numbers sit on the transcript row alone, and the exons, CDS and UTRs take
the transcript value. The keys are lowercase because the GFF parser lowercases
them, so a color field named `dIF` reads nothing and paints every transcript
grey.

`dtu` is a flag with the values `muscle`, `liver` and `ns`. The script calls a
transcript when its FDR is below 0.05 and its isoform fraction moves by more
than 0.1, the same threshold it reports on. `dif_called` is `dif` on the
transcripts the flag calls and absent on the rest, so a transcript the test
could not separate has no value to color and stays grey.

### The effect size and the FDR gate

The script takes the isoform fraction from TPM, because read counts scale with
effective length and bias a count-based fraction toward long isoforms. It gates
on satuRn's regular FDR, because the empirical FDR assumes most tests are null
and this contrast breaks that assumption.

## The genome

GENCODE v29 is a GRCh38 annotation and the coverage is on GRCh38, so we load the
hg38 assembly before either track.

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

## Configuring the track

`color` bins `dif_called` through a threshold scale. `domain` lists the cut
points, `range` gives one color per interval between them, and `labels` gives
the key's name for each interval, liver-preferred below zero and
muscle-preferred above. A value on a cut takes the interval above it. The key
lists every interval under the `title`, and a `(no value)` row for the uncalled
transcripts. A UTR follows `color` unless `utrColor` is set.

`labels.name` reads GENCODE's `transcript_name`, which also labels the isoform
under the cursor. `mouseover` resolves against the gene and summarizes it;
clicking an isoform opens its numbers in the details panel.

```json addtrack
{
  "trackId": "dtu_muscle_vs_liver",
  "name": "Transcript usage: skeletal muscle vs liver (satuRn)",
  "uri": "https://jbrowse.org/demos/dtu/dtu_muscle_vs_liver.gff3.gz",
  "assemblyNames": ["hg38"],
  "displayDefaults": {
    "subfeatureLabels": "below",
    "color": {
      "field": "dif_called",
      "scale": "threshold",
      "domain": ["-0.6", "-0.3", "0", "0.3", "0.6"],
      "range": [
        "#124f95",
        "#2370cc",
        "#6394d5",
        "#d5716a",
        "#c63335",
        "#901e21"
      ],
      "labels": [
        "liver, below -0.6",
        "liver, -0.6 to -0.3",
        "liver, -0.3 to 0",
        "muscle, 0 to 0.3",
        "muscle, 0.3 to 0.6",
        "muscle, 0.6 and above"
      ],
      "title": "ΔIF, muscle - liver"
    },
    "labels": {
      "name": "jexl:feature.transcript_name||feature.gene_name||feature.name||feature.id"
    },
    "mouseover": "jexl:feature.gene_name+': '+feature.dtu_transcripts+' isoform(s) with a usage shift, largest ΔIF '+feature.dtu_top_dif"
  }
}
```

Open the track over the two coverage tracks at _ATP5F1C_. satuRn used no genomic
coordinates, so the coverage lanes are an independent check on the color.

Each coverage lane scales to its peak until the lanes share an axis. **Score →
Autoscale with other tracks...** on one lane, with the other ticked, gives both
one axis that follows the view, so the two tissues compare by height. In a
config, each track names the same group:

```json addtrack
{
  "trackId": "liver_plus",
  "name": "Liver RNA-seq, + strand (ENCSR135IAL)",
  "uri": "https://jbrowse.org/demos/dtu/ENCFF565QRM.liver.plus.bigWig",
  "assemblyNames": ["hg38"],
  "displayDefaults": {
    "scales": { "y": { "autoscaleGroup": "coverage" } }
  }
}
```

The other three lanes differ in their id, name and file:

```json addtrack
{
  "trackId": "liver_minus",
  "name": "Liver RNA-seq, - strand (ENCSR135IAL)",
  "uri": "https://jbrowse.org/demos/dtu/ENCFF253OSP.liver.minus.bigWig",
  "assemblyNames": ["hg38"],
  "displayDefaults": {
    "scales": { "y": { "autoscaleGroup": "coverage" } }
  }
}
```

```json addtrack
{
  "trackId": "muscle_plus",
  "name": "Skeletal muscle RNA-seq, + strand (ENCSR609NZM)",
  "uri": "https://jbrowse.org/demos/dtu/ENCFF007ZBY.muscle.plus.bigWig",
  "assemblyNames": ["hg38"],
  "displayDefaults": {
    "scales": { "y": { "autoscaleGroup": "coverage" } }
  }
}
```

```json addtrack
{
  "trackId": "muscle_minus",
  "name": "Skeletal muscle RNA-seq, - strand (ENCSR609NZM)",
  "uri": "https://jbrowse.org/demos/dtu/ENCFF518WGP.muscle.minus.bigWig",
  "assemblyNames": ["hg38"],
  "displayDefaults": {
    "scales": { "y": { "autoscaleGroup": "coverage" } }
  }
}
```

<Figure caption="ATP5F1C on hg38. ENCODE skeletal-muscle and liver RNA-seq coverage on a shared scale, over GENCODE transcripts colored by the isoform-fraction change satuRn measured between the two tissues. The marked column is the cassette exon, where the muscle lane is flat and the liver lane peaks." src="/img/dtu/dtu_colored_gene_glyph.png" links="Open this view=dtu/dtu_colored_gene_glyph" />

## Reproduce it end to end

One script wraps every step above,
[`build_dtu_demo.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dtu_demo.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dtu_demo.sh
bash build_dtu_demo.sh dtu_build   # writes ./dtu_build/
```

The script fetches the eight RSEM tables and the four coverage bigWigs from
ENCODE, downloads the GENCODE v29 GFF3 those quantifications were made against,
runs the satuRn fit, and writes `dtu_muscle_vs_liver.gff3.gz` with its `.tbi`
index, a local build of the file the track configuration above loads from
jbrowse.org. Point the track's `uri` at the local copy to open your own run. The
script needs [Prerequisites](#prerequisites) on your `PATH`.

Along the way the script prints the transcript and gene counts at each filtering
step, and the minimum empirical FDR beside the regular-FDR count.

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
