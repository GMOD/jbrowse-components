# protein_domains data

The Pfam domain track the
[protein domains tutorial](../../website/docs/tutorials/protein_domains.md) and
`website/scripts/specs/protein_domains.ts` read, at
`https://jbrowse.org/demos/protein_domains/pfam.gff3.gz` (and `.csi`). The
genome and genes come from the honey bee GenArk hub, `GCF_003254395.2`, so there
is no config here.

`pfam.gff3.gz` is domains2genome 2.4.0 `--gff3` run on NCBI's
`GCF_003254395.2_Amel_HAv3.1_genomic.gff.gz`, the annotation the hub's `ncbiGff`
track serves, and the hmmscan `--cut_ga` calls
`scripts/build_protein_domains.sh` made on its proteins (on ada,
`~/protein_domains/`: `pfam.domtblout`, whose last line is truncated, and the
nine `chunk*.domtblout` that finished it).

- A fresh run of the script writes the same layout. Its domain calls can differ,
  since the script downloads Pfam's current release.
- `pfam.bed.gz`, the earlier domains-only BED12 from the same calls, stays
  hosted for the deployed site's copy of the tutorial until the site redeploys;
  delete it after that.

Deploy it with
`DEPLOY_DEMO_ALLOW_UNTRACKED=1 scripts/deploy-demo.sh pfam.gff3.gz protein_domains/pfam.gff3.gz`,
then the `.csi` the same way.
