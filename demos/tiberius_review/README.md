# tiberius_review

The static review portal the
[gene prediction review tutorial](../../website/docs/tutorials/gene_prediction_review.md)
links to: Tiberius predictions on chr22 read against GENCODE 47, one card per
model that disagrees, each with a JBrowse capture and a link back into the app.

Three objects are deployed. `config.json` is here and is the copy to deploy
from; `portal.png` is a screenshot of the finished page, for linking from a PR
or an issue. `index.html` is generated and is **not** checked in, because it
carries its captures inline and runs to about 1.1 MB; regenerate it with the
command below and deploy it with `DEPLOY_DEMO_ALLOW_UNTRACKED=1`.

```bash
node demo/tiberius-portal/bin/make-portal.mjs \
  --prediction https://jbrowse.org/genomes/GRCh38/tiberius_grch38.gff.gz \
  --reference https://jbrowse.org/genomes/GRCh38/gencode/gencode.v47.chr_patch_hapl_scaff.annotation.sorted.gff3.gz \
  --fasta https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz \
  --aliases https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt \
  --assembly hg38 --region chr22 --max 2 \
  --prediction-name "Tiberius predictions" --reference-name "GENCODE 47" \
  --with-app --inline-images \
  --public-config https://jbrowse.org/demos/tiberius_review/config.json \
  --title "Tiberius predictions on chr22 that need a human" \
  --out /tmp/tiberius_review

scripts/deploy-demo.sh demos/tiberius_review/config.json tiberius_review/config.json
DEPLOY_DEMO_ALLOW_UNTRACKED=1 scripts/deploy-demo.sh /tmp/tiberius_review/index.html tiberius_review/index.html
DEPLOY_DEMO_ALLOW_UNTRACKED=1 scripts/deploy-demo.sh portal.png tiberius_review/portal.png
```

**No data is hosted here.** Every URI in the config points at files that were
already on jbrowse.org, so the demo is two objects and adds nothing to the
bucket's data.

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

`--max 2` keeps two candidates per class. The merged-model class has only one
member on chr22, so the portal has seven cards rather than eight.
