# tiberius_review

The static review portal the
[gene prediction review tutorial](../../website/docs/tutorials/gene_prediction_review.md)
links to: Tiberius predictions on chr22 read against GENCODE 47, one card per
model that disagrees, each with a JBrowse capture and a link back into the app.

Eight objects are deployed. `config.json` is here and is the copy to deploy
from; `conflicts.bed.gz` and its `.tbi` are written by the build and are what
the **Disagreements** track reads. `portal.png` is the screenshot to link from a
PR or an issue, and what it frames should be a card where the RNA-seq earns its
place: dense pileups either side of a junction, sashimi arcs over both lanes,
and a prediction the reads do not support. `g13516.t1` over `MICAL3` is that
card. The first card on the page is the merged model, which spans 61.8 kb and so
shows the same evidence as a smear. `index.html` is generated and is **not**
checked in, because it carries its captures inline and runs to about 2.4 MB;
regenerate it with the command below and deploy it with
`DEPLOY_DEMO_ALLOW_UNTRACKED=1`. The last two are the RNA-seq BAMs below and
their indexes.

**Deployed 2026-08-26** from the command below, against the classifier and the
lane layout described here. `portal.png` frames `g13516.t1` over `MICAL3`.

**Invalidate the directory URL, not just the file.**
`jbrowse.org/demos/tiberius_review/` and `.../index.html` are two CloudFront
cache keys, and this deploy served a 13-hour-old page to every browser while
curl on the explicit filename showed the new one. `deploy-demo.sh` invalidates
both now; a demo deployed with an older copy of the script needs `.../`
invalidated by hand.

`portal.png` is not checked in either — `frame-card.mjs` writes it from the
built portal, which is why the line that uploads it needs
`DEPLOY_DEMO_ALLOW_UNTRACKED=1` like the generated `index.html` does. Framing it
by hand is what made the deployed one go stale on a card that no longer exists;
naming the model on a command line means reframing it costs one run.

```bash
node demo/tiberius-portal/bin/make-portal.mjs \
  --prediction https://jbrowse.org/genomes/GRCh38/tiberius_grch38.gff.gz \
  --reference https://jbrowse.org/genomes/GRCh38/gencode/gencode.v47.chr_patch_hapl_scaff.annotation.sorted.gff3.gz \
  --fasta https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz \
  --aliases https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt \
  --rnaseq https://jbrowse.org/demos/tiberius_review/HBR_brain_rnaseq_chr22.bam \
  --rnaseq-name "RNA-seq · brain (HBR)" \
  --rnaseq https://jbrowse.org/demos/tiberius_review/UHR_reference_rnaseq_chr22.bam \
  --rnaseq-name "RNA-seq · universal reference (UHR)" \
  --rnaseq-height 170 \
  --assembly hg38 --region chr22 --max 2 --height 920 \
  --prediction-name "Tiberius predictions" --reference-name "GENCODE 47" \
  --app-branch main --inline-images \
  --instance https://jbrowse.org/code/jb2/main/ \
  --measurement agent-docs/measurements/tiberius-chr22 \
  --public-config https://jbrowse.org/demos/tiberius_review/config.json \
  --title "Tiberius predictions on chr22 that need a human" \
  --out /tmp/tiberius_review

scripts/deploy-demo.sh demos/tiberius_review/config.json tiberius_review/config.json
for x in conflicts.bed.gz conflicts.bed.gz.tbi; do
  DEPLOY_DEMO_ALLOW_UNTRACKED=1 scripts/deploy-demo.sh \
    "/tmp/tiberius_review/data/$x" "tiberius_review/$x"
done
DEPLOY_DEMO_ALLOW_UNTRACKED=1 scripts/deploy-demo.sh /tmp/tiberius_review/index.html tiberius_review/index.html

node demo/tiberius-portal/bin/frame-card.mjs \
  --portal /tmp/tiberius_review --card g13516.t1 \
  --out /tmp/tiberius_review/portal.png
DEPLOY_DEMO_ALLOW_UNTRACKED=1 scripts/deploy-demo.sh \
  /tmp/tiberius_review/portal.png tiberius_review/portal.png
```

The two RNA-seq BAMs and their indexes are already up; they only need deploying
again if the source files change:

```bash
for f in HBR_brain_rnaseq_chr22.bam UHR_reference_rnaseq_chr22.bam; do
  for x in "$f" "$f.bai"; do
    DEPLOY_DEMO_ALLOW_UNTRACKED=1 scripts/deploy-demo.sh "$x" "tiberius_review/$x"
  done
done
```

**Two flags say which JBrowse, and both are needed.** `--app-branch main`
bundles the development build for the _captures_, where bare `jbrowse create`
would install the latest npm release;
`--instance https://jbrowse.org/code/jb2/main/` points the **Open in JBrowse**
links at the hosted main instance, where they would otherwise open
`code/jb2/latest`, which is that same release. The point of this demo is to show
what JBrowse does now, and a picture of main behind a link to the last release
is half of it.

`--measurement` rewrites `agent-docs/measurements/tiberius-chr22-*.json` from
the run, which is where the tutorial's counts come from. Rebuild without it and
the prose keeps last run's numbers.

**Two data files are hosted here**, and only because their source has no CORS
headers. Both are the Griffith lab's RNA-seq course data from
[genomedata.org](https://genomedata.org/rnaseq-tutorial/results/alignments/hisat/)
— real human RNA, HISAT2-aligned to GRCh38 chr22 — which a browser cannot read
cross-origin: `HBR_brain_rnaseq_chr22.bam` (53 MB) is Human Brain Reference and
`UHR_reference_rnaseq_chr22.bam` (85 MB) is Universal Human Reference, a pool of
ten cell lines. Their refNames say `22`, which the alias table below resolves.
Everything else in the config points at files that were already on jbrowse.org.

**Two tissues, because one is not evidence of absence.** Coverage over the
candidate loci splits both ways: the merged `IL17REL`/`TTLL8` model has 1,770
brain reads against 228 UHR, and `g13664.t1`, predicted coding over the lncRNA
`FAM230I`, has 188 UHR against 14 brain. A model with reads in neither is the
one worth doubting.

The prediction is Tiberius's released human annotation, made with default
weights rather than through its Nextflow evidence mode, so the RNA-seq here is
evidence the reviewer judges the call against rather than an input the call was
made from.

**`refNameAliases` is load-bearing, not decoration.** The annotations say
`chr22` and `hg38.prefix.fa.gz` says `22`. Without the alias adapter the
assembly loads, both tracks open, and every navigation fails with "unknown
reference sequence name" — which reads like a broken locus rather than a
mismatched config. Every capture in the first build of this portal failed that
way.

**`--with-app` is for the captures, not for the deployment.** The generator
drives a local copy of JBrowse against a local copy of the config so the
pictures do not depend on the deploy having happened yet; `--public-config` is
what points the links at the deployed config instead of the local one. The
`jbrowse/` directory the run produces is not uploaded.

**`--rnaseq-height 170` with `--height 920` is a whole card**, and getting there
was mostly about the three annotation lanes rather than the evidence. Left at
the 100px default each of them drew two rows of features in a lane deep enough
for six, which cost about 200px of frame between them and pushed the second
RNA-seq lane off the bottom; they size themselves to what they drew now
(`heightMode: 'grow'`), and the reference annotation — context here rather than
the subject — draws its isoforms compact. That paid for evidence lanes with
compact reads in them: at 3px against the default 7px a lane holds three times
the depth, so 170px shows the pileup the old 280 did with the sashimi arcs still
over it, and on a card like `MICAL3` — 4,005 brain reads over the window — those
arcs are what say which of the two exon structures the reads support. Reads that
carry a junction take the top rows (`splicedReadsFirst`) instead of scattering
among the ones that do not.

Every one of those settings rides in the track config rather than in the link,
because the config is the one place the picture and the live view both read —
`displayDefaults` postdates the released JBrowse, and a session spec's tracks
are ids, so a track written as an object to hang settings off resolves to
nothing at all. `--max 2` keeps two candidates per class. The merged-model class
has only one member on chr22, so the portal has seven cards rather than eight.
