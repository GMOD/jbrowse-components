---
name: hprc-genotypes-and-sample-count
description: Branch hprc-genotypes rewrites pangenome_hprc onto the per-allele VCF and renames the graph plugin's carriers/carriedBy to sampleCount/samples; plugin 4.2.0 is on npm, and the store step, demo deploys, landing and reshoots are left
audience: internal
kind: handoff
---

# HPRC genotypes and `sampleCount`: what is left

Branch `hprc-genotypes` (worktree `.claude/worktrees/hprc-genotypes`), two
commits on `7140f0678c`, not landed:

- `323058617b` `pangenome_hprc` reads the graph against `pgbi.vcf.gz` (one
  record per whole allele) with `alleleLength>=50`, no `LV==0` and no
  `feature.start==32517421`. The prose states the release lineage (minigraph
  SV graph, then the Cactus alignment, exported as the base-level graph the VCFs
  come from and as the MAF). MAF track id is `hprc_v2_1_mc_grch38`. Findings
  are in `reference/HPRC_RELEASE2.md` §"Which VCF to read the graph against".
- `c2c5f527c3` pangenome pages and the graph guide drop "carry"/"carriage";
  configs, the E. coli build script and figure fixtures colour by `sampleCount`.

Graph plugin: `94b6f39` renames the segment field `carriers` → `sampleCount`
and the popup's `carriedBy` → `samples`; released as **4.2.0** (npm, tag
`v4.2.0`). The hosted store bundle is still **4.0.30**.

## Steps, in this order

1. **Store step**: `pnpm dep` in `~/src/jbrowse-plugin-list`. It also promotes
   graph plugin 4.1.0/4.1.1 (another session's walk-row work) and any other
   pending plugin; say which. Expect many graph figures to differ afterwards
   ([[graph-figures-lag-the-unpublished-plugin]]).
2. `scripts/deploy-demo.sh` for `ecoli_pangenome` (colour field and names) and
   `hprc` (track names). Until then the hosted E. coli lane colours by
   `sampleCount` against a 4.0.30 bundle that emits `carriers`, so do 1 first.
3. Rebase `hprc-genotypes` on main, `pnpm verify`, land ff-only, push.
4. Reshoot with `jb-shoot --publish`: `pangenome/hprc_graph_vs_callset`,
   `maf_hprc_pangenome`, `pangenome/hprc_lpa_kiv2`, `pangenome/bovine_bola`,
   `pangenome/rgfa_hover_sync`, `pangenome/rgfa_insertion_synteny`,
   `pangenome/graph_mouse_nnt_halos`, the E. coli and prepare_graph
   strains-per-segment figures (legend title is now "Strains"), and the cactus
   graph_bubble figure (track name). Film `pangenome/hprc_cluster_callset` and
   `pangenome/pggb_out_to_strain`. Then `pnpm autogen`.
5. **Check the prose against the new frames** (written from tabix probes, not
   from pixels):
   - MHC: the band's blue block is the 46 haplotypes with any of the four DRB5
     records, plus a block for the 86 kb deletion (26 haplotypes).
   - C4: "Every alignment row in the white block has that deletion" holds only
     if the white rows are HG00320.1 and HG00321.2 (pgbi has HG00320 `1|0`,
     HG00321 `0|1`); read the row names off the figure. "The narrower blocks
     are the 6.4 kb HERV-K" deletion (C4A short 17, C4B short 225) needs the
     frame too.

## Open, not started

- The corpus-wide "carry" sweep: about 600 uses in other hand-written docs
  (`website/docs` outside the pangenome pages). The checklist now names the
  pattern and `scan.sh` labels it under `agency`.
- jb2hubs: the variants launch still filters `wave.vcf.gz` with `LV==0`,
  which blanks HLA-DRB1 in its own MHC window. Its comment in
  `pangenomeLinks.ts` justifies the filter by this tutorial, which no longer
  uses it. Switching the launch to `pgbi` is Colin's call.
- `~/src/claudish` has `edfa0d6` (the carry entry) on a main that was already
  five commits ahead of origin; nothing pushed.
