# tiberius_review

The static review portal the
[gene prediction review tutorial](../../website/docs/tutorials/gene_prediction_review.md)
links to: Tiberius predictions on chr22 read against GENCODE 47, one card per
model that disagrees, each with a JBrowse capture and a link back into the app.

Six objects are deployed. `config.json` is here and is the copy to deploy from;
`portal.png` is the screenshot to link from a PR or an issue, and what it frames
is deliberate: the page scrolled so the `RANBP1` card sits under the sticky
filter rail, because that card is where the RNA-seq earns its place — dense
pileups either side of the junction, sashimi arcs over both lanes, and a
prediction whose exon structure the reads do not support. The first card on the
page is the merged model, which spans 61.8 kb and so shows the same evidence as
a smear. `index.html` is generated and is **not** checked in, because it carries
its captures inline and runs to about 1.8 MB; regenerate it with the command
below and deploy it with `DEPLOY_DEMO_ALLOW_UNTRACKED=1`. The other three are
the two RNA-seq BAMs below and their indexes.

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
  --rnaseq-height 280 \
  --assembly hg38 --region chr22 --max 2 --height 1000 \
  --prediction-name "Tiberius predictions" --reference-name "GENCODE 47" \
  --with-app --inline-images \
  --public-config https://jbrowse.org/demos/tiberius_review/config.json \
  --title "Tiberius predictions on chr22 that need a human" \
  --out /tmp/tiberius_review

scripts/deploy-demo.sh demos/tiberius_review/config.json tiberius_review/config.json
DEPLOY_DEMO_ALLOW_UNTRACKED=1 scripts/deploy-demo.sh /tmp/tiberius_review/index.html tiberius_review/index.html
DEPLOY_DEMO_ALLOW_UNTRACKED=1 scripts/deploy-demo.sh portal.png tiberius_review/portal.png
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

**Two data files are hosted here**, and only because their source has no CORS
headers. Both are the Griffith lab's RNA-seq course data from
[genomedata.org](https://genomedata.org/rnaseq-tutorial/results/alignments/hisat/)
— real human RNA, HISAT2-aligned to GRCh38 chr22 — which a browser cannot read
cross-origin: `HBR_brain_rnaseq_chr22.bam` (53 MB) is Human Brain Reference and
`UHR_reference_rnaseq_chr22.bam` (85 MB) is Universal Human Reference, a pool of
ten cell lines. Their refNames say `22`, which the alias table below resolves.
Everything else in the config points at files that were already on jbrowse.org.

**Two tissues, because one is not evidence of absence.** Coverage over the
candidate loci splits both ways: the merged `IL17REL`/`TTLL8` model has 1,350
brain reads against 178 UHR, and `RANBP1` has 3,469 UHR against 549 brain. A
model with reads in neither is the one worth doubting.

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

`--rnaseq-height 280` is what puts the evidence in the picture rather than under
it. An evidence lane opens 250px deep and spends most of that on whitespace at
gene scale, so the first pass shortened it to 110 and fitted four tracks into a
560px capture — which left the reads too small to read. Taller lanes in a taller
capture is the other way out of the same problem: the sashimi arcs sit over deep
pileups, and on a card like `RANBP1` those arcs are what say which of the two
exon structures the reads support. The setting rides in the track config rather
than in the link because the config is the one place the picture and the live
view both read — `displayDefaults` postdates the released JBrowse, and a session
spec's tracks are ids, so a track written as an object to hang settings off
resolves to nothing at all. `--max 2` keeps two candidates per class. The
merged-model class has only one member on chr22, so the portal has seven cards
rather than eight.
