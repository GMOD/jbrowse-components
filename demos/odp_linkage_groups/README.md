# odp_linkage_groups fixture

The sessions the
[ancestral linkage group tutorial](../../website/docs/tutorials/odp_linkage_groups_synteny.md)
opens on, and the live link under its figures
(`config=https://jbrowse.org/demos/odp_linkage_groups/config.json`).

Six ortholog tables from the Schultz et al. 2023 Dryad deposit
(10.5061/dryad.dncjsxm47, CC0), each converted by `scripts/rbh_to_blocks.py`
exactly as `scripts/build_odp_linkage_groups_synteny.sh` does: a
`<pair>.blocks.gz` and one `<pair>.<code>.bed.gz` per genome, carrying
`gene_group` and `color`.

The six assemblies are `ChromSizesAdapter` over `<code>.chrom.sizes`, the first
two columns of `samtools faidx` on the deposit's FASTAs (and, for Ephydatia, on
the renamed bitbucket FASTA the build script fetches). The sessions draw no
sequence, so the hosted copy skips the 2 GB of FASTA the build script's
`add-assembly --load copy` writes.

Deploy each output with
`scripts/deploy-demo.sh <file> odp_linkage_groups/<file>`, and this config from
its checked-in copy.
