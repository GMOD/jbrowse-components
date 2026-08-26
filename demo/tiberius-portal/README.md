# make-portal

Turn a gene prediction, a reference annotation and a genome into a **static
review portal**: a page of candidate models that disagree with the reference,
each with a JBrowse screenshot, a verdict, and a link that opens the same view
live.

Everything it emits is a file. With `--with-app` the portal carries its own copy
of JBrowse, so the whole directory works from any web server, an S3 bucket, or a
laptop with no internet.

```bash
node bin/make-portal.mjs \
  --prediction tiberius.gff3 \
  --reference gencode.v47.gff3 \
  --fasta GRCh38.fa \
  --rnaseq rnaseq.bam \
  --assembly hg38 --region chr22 \
  --with-app --out ./portal

npx serve ./portal
```

## What comes out

```
portal/
  index.html      the review page — filters, verdicts, export
  config.json     a JBrowse config naming the data below
  data/           bgzipped and indexed copies of your inputs
  img/            one capture per candidate
  jbrowse/        JBrowse itself, with --with-app
```

Nothing points outside the directory, so `aws s3 sync portal/ s3://…` is the
whole deployment. Verdicts live in the reviewer's browser (`localStorage`);
**Export decisions** writes them out as TSV to hand back to a pipeline.

## Requirements

`bgzip`, `tabix` and `samtools` on PATH (htslib + samtools), plus the `jbrowse`
CLI for `--with-app`. Captures run `products/jbrowse-capture` from this repo.

## How a model gets flagged

| class              | test                                                                          | annotator action        |
| ------------------ | ----------------------------------------------------------------------------- | ----------------------- |
| merged model       | exons hit exons of ≥2 same-strand coding genes that do not overlap each other | split into two models   |
| structure conflict | covers one coding gene, shares none of its splice junctions                   | check exon structure    |
| novel locus        | exons hit nothing annotated                                                   | assess, then create     |
| novel coding       | exons hit only non-coding annotation                                          | assess coding potential |

Everything else is `agrees` and never reaches the page.

**The comparison is at exon level, against same-strand genes only.** Span
overlap is the obvious test and it is wrong twice over: a gene nested in
another's intron shares the whole span and no exon, and two overlapping
same-strand genes are a fact about the reference rather than a prediction error.
On real chr22 data the span test called Tiberius's correct PI4KA model a
two-gene fusion, because SERPIND1 sits inside PI4KA's intron. Readthrough genes
(`CHKB-CPT1B`) are excluded for the same reason.

The classifier prefers `exon` features and falls back to `CDS` per model, since
plenty of annotation files carry only one of the two.

## Test

```bash
node test/run.mjs
```

Regenerates a synthetic genome built to produce one candidate of every class,
then checks the classifier still puts each model where the fixture intends.
Offline, about a second.

The fixture deliberately contains a small gene inside a big gene's intron **on
the same strand**, which is the case that fails if the comparison reverts to
span overlap. Reverting it is the sabotage this suite is written against — the
other cases survive it.

## Flags worth knowing

- `--no-capture` skips the screenshots. Fast, and the links still work.
- `--region` restricts the scan, repeatable. A whole mammalian genome is a lot
  of captures; one chromosome is a demo.
- `--max` caps candidates per class (default 12).
- Without `--with-app` the links point at `jbrowse.org/code/jb2/latest`, which
  **cannot read a config on your laptop** — that mode is for data already
  published at a public URL. The CLI says so when it applies.

## Known gap

`jbrowse.org/code/jb2/latest` silently drops a track entry's inline display
settings, so the staged recipe is bare trackIds and every track arrives at its
default. Verified: `height: 400` on a track renders at the default height. Once
that lands, the recipe can also say _how_ to show the evidence — sorted,
filtered, coloured — which is most of what a review preset is for.
