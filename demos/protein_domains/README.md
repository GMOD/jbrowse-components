# protein_domains data

The Pfam domain track the
[protein domains tutorial](../../website/docs/tutorials/protein_domains.md) and
`website/scripts/specs/protein_domains.ts` read, at
`https://jbrowse.org/demos/protein_domains/pfam.bed.gz` (and `.tbi`). The genome
and genes come from the honey bee GenArk hub, `GCF_003254395.2`, so there is no
config here.

`pfam.bed.gz` is `scripts/build_protein_domains.sh` run on NCBI's
`GCF_003254395.2_Amel_HAv3.1_genomic.fna.gz` and `_genomic.gff.gz`, the
annotation the hub's `ncbiGff` track serves. Deploy it with
`DEPLOY_DEMO_ALLOW_UNTRACKED=1 scripts/deploy-demo.sh pfam.bed.gz protein_domains/pfam.bed.gz`,
then the `.tbi` the same way.
