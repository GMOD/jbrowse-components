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
  data/           bgzipped and indexed copies of your inputs, plus
                  conflicts.bed — every junction that differs
  img/            one capture per candidate
  jbrowse/        JBrowse itself, with --with-app
```

Nothing points outside the directory, so `aws s3 sync portal/ s3://…` is the
whole deployment.

## Reviewing

The queue is meant to be read one card at a time, so it takes the keyboard:
<kbd>j</kbd> and <kbd>k</kbd> move, <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> are
keep / needs editing / reject on the card under the cursor, <kbd>o</kbd> opens
it in JBrowse and <kbd>/</kbd> jumps to the search box. The same digit twice
takes a verdict back off. **Keys** in the toolbar, or <kbd>?</kbd>, shows the
list.

Set **Unreviewed** as the verdict filter and the queue drains as it is judged,
the cursor closing over each card that leaves.

Verdicts live in the reviewer's browser (`localStorage`), which is one browser
on one machine: **Export decisions** writes them out as TSV to hand back to a
pipeline, and **Import** reads that TSV back, so a second reviewer, a second
laptop or a cleared site setting is not a review started again from nothing.

## Requirements

`bgzip`, `tabix` and `samtools` on PATH (htslib + samtools), plus the `jbrowse`
CLI for `--with-app`. Captures run `products/jbrowse-capture` from this repo.

## Outside the monorepo

The same pipeline ships on its own as
[cmdcolin/gene-review-portal](https://github.com/cmdcolin/gene-review-portal),
which is where to send someone who wants to run it against their own prediction
without cloning JBrowse. The two trees differ only in how they find the capture
tool — a sibling product here, the `@jbrowse/capture` dependency there — so a
change to `lib/` or `bin/` belongs in both. Once `@jbrowse/capture` is published
this copy can go, and the tutorial can name `npx gene-review-portal` instead.

## How the page is built

`lib/app.jsx` is a React app, and the portal renders it twice. `renderPage`
builds it to a string with `react-dom/server` when the portal is written, so the
cards, the captures and the prose are in `index.html` before any script runs;
the browser hydrates the same tree to take input. Turn scripting off and the
review page is still a readable, printable document — only judging it stops.

React earns its place on the card list. Filtering used to rebuild the whole list
from a string, which recreated every `<img>` on every keystroke — and with
`--inline-images` each of those carries a quarter-megabyte data URI. Four
keystrokes over 35 cards made 56 of them; keyed reconciliation makes none, with
no hand-written "repaint just this bit" path to keep correct.

esbuild does both bundles at portal-build time, so nothing is checked in and
there is no separate build step to forget. The client bundle is about 200 KB, 68
KB over the wire.

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

**A gene's junctions are read one isoform at a time and then unioned.** Sorting
every isoform's exons into one list and joining consecutive pairs is the obvious
shortcut, and it invents junctions no transcript has: across RANBP1's 13
isoforms it matched none of Tiberius's five correct junctions. That shortcut was
what 18 of the 21 structure conflicts first reported on human chr22 turned out
to be.

## Where the disagreement is

A capture of a structure conflict shows a plausible-looking model over a stack
of reference isoforms, and nothing says which junction is the one in dispute. So
the classifier also writes down where it looked:

`data/conflicts.bed` is one BED6 record per place a model and the reference
actually differ, named `<transcript>:<what disagrees>`:

```
chr22  21636314  21636431  g13605.t1:donor-1048     0  +
chr22  23977067  23977386  g13682.t1:acceptor+3025  0  -
chr22  50012765  50018574  g14001.t1:split          0  -
```

| name                           | what it marks                                                   |
| ------------------------------ | --------------------------------------------------------------- |
| `donor±N`                      | the acceptor matches a reference intron, the donor is N bp off  |
| `acceptor±N`                   | the donor matches, the acceptor is N bp off                     |
| `shifted±N`                    | the intron lies inside a reference intron sharing neither end   |
| `skips-N-exons`                | the intron swallows N whole reference exons                     |
| `intron-in-exon`               | the intron is cut inside a reference exon                       |
| `novel-intron`                 | no reference intron nearby at all                               |
| `split`                        | a merged model's cut point: the gap between the genes it joined |
| `novel-locus` / `novel-coding` | the model's span, having no reference gene to disagree with     |

The same file rides in every capture and every live link as the
**Disagreements** track, directly under the prediction, so the picture points at
the junction rather than leaving a reviewer to find it.

**The BED reaches further than the page does.** Cards exist only for the four
flagged classes, and a model sharing four junctions out of five is filed as
`agrees` and never gets one — while the fifth is still a real splice-site edit.
On chr22 that is 64 models the page cannot show and the BED lists.

## Test

```bash
node test/run.mjs
```

Regenerates a synthetic genome built to produce one candidate of every class,
then checks the classifier still puts each model where the fixture intends.
Offline, about a second.

It then drives the review page itself in a headless Chrome — the keyboard queue,
the in-place repaint, the progress arithmetic and the TSV round trip, none of
which the offline half can reach. That needs puppeteer; without it the run says
so and stops rather than reporting a page it never opened.

The fixture deliberately contains a small gene inside a big gene's intron **on
the same strand**, which is the case that fails if the comparison reverts to
span overlap. Reverting it is one of the two sabotages this suite is written
against — the other cases survive it.

The second is `TWOFORM`, a gene with two isoforms and a prediction reproducing
the second one exactly. Flatten the gene's exons into one list and that
prediction shares none of the junctions the flattening produces, so a correct
model lands in structure conflict. Every other gene in the fixture has a single
isoform, where flattening and reading per transcript agree — which is why the
fixture missed the bug for as long as it did.

## Flags worth knowing

- `--no-capture` skips the screenshots. Fast, and the links still work.
- `--region` restricts the scan, repeatable. A whole mammalian genome is a lot
  of captures; one chromosome is a demo.
- `--max` caps candidates per class (default 12).
- Without `--with-app` the links point at `jbrowse.org/code/jb2/latest`, which
  **cannot read a config on your laptop** — that mode is for data already
  published at a public URL. The CLI says so when it applies.
- `--measurement <prefix>` writes the run's counts as `agent-docs/measurements/`
  records, so a tutorial quotes a generated cell rather than a number somebody
  typed. That is the one that goes stale first: fixing the junction comparison
  moved chr22's structure conflicts from 21 to 3 and took a card the prose named
  down with it.
- **The captures show a release unless you say otherwise.** `jbrowse create`
  installs the latest npm release and `code/jb2/latest` is that same release, so
  a portal showing off work that has not shipped shows the version before it.
  `--app-branch main` bundles the development build instead, `--app-dir <dir>` a
  build you made yourself, and `--instance https://jbrowse.org/code/jb2/main/`
  drives main without bundling anything.

## Known gap

`jbrowse.org/code/jb2/latest` silently drops a track entry's inline display
settings, so the staged recipe is bare trackIds and every track arrives at its
default. Verified: `height: 400` on a track renders at the default height. Once
that lands, the recipe can also say _how_ to show the evidence — sorted,
filtered, coloured — which is most of what a review preset is for.
