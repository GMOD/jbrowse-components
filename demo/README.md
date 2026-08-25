# Tiberius review app

A gene-model triage queue built on top of JBrowse rather than inside it: the
pipeline compares a Tiberius prediction GFF against GENCODE, captures a JBrowse
view at each disagreement, and emits a single self-contained page with a verdict
per candidate and a live link back into the browser.

Built for the v5.0.0 Apollo conversation. The point it makes: the triage is
JBrowse's half and the edit is Apollo's, and the review app around them is a few
hundred lines because the two hard parts — knowing when a genome browser has
finished drawing, and a URL that reconstitutes an exact view — are already
packages.

## Run it

Nothing is checked in but the scripts and the built page; the intermediates go
to a scratch directory the scripts name at the top of each file. From `demo/`:

```bash
# 1. candidates. Reads the hosted GFFs directly, no download step.
tabix https://jbrowse.org/genomes/GRCh38/tiberius_grch38.gff.gz chr22 > tib_chr22_all.gff
tabix https://jbrowse.org/genomes/GRCh38/gencode/gencode.v47.chr_patch_hapl_scaff.annotation.sorted.gff3.gz chr22 > gencode_chr22_all.gff
node 1-classify.mjs      # exon-level comparison -> candidates2.json
node 2-select.mjs        # picks one worked example per class -> selected.json

# 2. one JBrowse capture per candidate (~30s each, drives jbrowse.org/code/jb2/latest)
node 3-capture.mjs

# 3. the page
node 4-build.mjs
```

`3-capture.mjs` runs `products/jbrowse-capture` from source with `node`, **not**
`npx tsx` — tsx's `keepNames` injects a helper that breaks functions passed to
`page.evaluate`.

## How a model gets flagged

Span overlap is not a merge. The first pass used it and called Tiberius's
perfectly good PI4KA model a two-gene fusion, because SERPIND1 sits inside
PI4KA's intron on the opposite strand. So `1-classify.mjs` compares **exons**,
and only against same-strand genes:

| class              | test                                                        | annotator action        |
| ------------------ | ----------------------------------------------------------- | ----------------------- |
| merged model       | prediction's exons hit exons of ≥2 same-strand coding genes | split into two models   |
| structure conflict | covers one coding gene, shares none of its splice junctions | check exon structure    |
| novel locus        | exons hit nothing annotated                                 | assess, then create     |
| novel coding       | exons hit only non-coding annotation                        | assess coding potential |

`2-select.mjs` narrows "merged model" further to fusions of genes that **do not
overlap each other**, since overlapping same-strand genes are a GENCODE fact
rather than a prediction error, and a readthrough gene (`CHKB-CPT1B`) is
GENCODE's own fused model. On chr22 that takes 45 merges down to 1.

## chr22 result

559 predicted models: 370 agree with a GENCODE gene, 189 disagree — 119 novel
coding, 12 novel loci, 12 structure conflicts, 45 span-level merges of which 1
is an unambiguous fusion (`IL17REL` + `TTLL8`, 5,809 bp apart).

## The one thing that does not work

`jbrowse.org/code/jb2/latest` **silently drops a track entry's inline display
settings**. Verified directly: a spec setting `height: 400` on the Tiberius
track renders at the default height, and `showOnlyGenes: true` on NCBI RefSeq
still draws its `region` features. So the staged recipe here is only two bare
trackIds, and the RefSeq track is left out rather than shown as one long bar.

That is the gap worth closing for v5 — the whole value of a review preset is
that the evidence arrives configured, and `reference/SESSION_SPEC_FORMAT.md`
already describes folding those keys into the display snapshot.
