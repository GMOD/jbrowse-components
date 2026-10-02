---
name: hprc-genotypes-and-sample-count
description: pangenome_hprc reads the graph against the per-allele VCF and the graph plugin's carriers/carriedBy became sampleCount/samples (4.2.0, hosted); the figure reshoots, two prose checks against the new frames, and the corpus-wide "carry" sweep are left
audience: internal
kind: handoff
---

# HPRC genotypes and `sampleCount`: what is left

`pangenome_hprc` reads the graph against `pgbi.vcf.gz` (one record per whole
allele) with `alleleLength>=50`. Findings are in `reference/HPRC_RELEASE2.md`
§"Which VCF to read the graph against". The graph plugin renamed the segment
field `carriers` → `sampleCount` and the popup's `carriedBy` → `samples` in
4.2.0, which the store hosts under `latest/` since 2026-10-02. The
`ecoli_pangenome` and `hprc` demo configs are deployed to match.

## Reshoots

With `jb-shoot --publish`: `pangenome/hprc_graph_vs_callset`,
`maf_hprc_pangenome`, `pangenome/hprc_lpa_kiv2`, `pangenome/bovine_bola`,
`pangenome/rgfa_hover_sync`, `pangenome/rgfa_insertion_synteny`,
`pangenome/graph_mouse_nnt_halos`, the E. coli and prepare_graph
strains-per-segment figures (legend title is now "Strains"), and the cactus
graph_bubble figure (track name). Film `pangenome/hprc_cluster_callset` and
`pangenome/pggb_out_to_strain`. Then `pnpm autogen`. The 4.0.30 → 4.2.0 store
step also moves every other graph figure
([[graph-figures-lag-the-unpublished-plugin]]).

## Prose to check against the new frames

`pangenome_hprc` states these from tabix probes, not from pixels:

- MHC: the band's blue block is the 46 haplotypes with any of the four DRB5
  records, plus a block for the 86 kb deletion (26 haplotypes).
- C4: "Every alignment row in the white block has that deletion" holds only if
  the white rows are HG00320.1 and HG00321.2 (pgbi has HG00320 `1|0`, HG00321
  `0|1`); read the row names off the figure. "The narrower blocks are the 6.4 kb
  HERV-K" deletion (C4A short 17, C4B short 225) needs the frame too.

## Open, not started

- The corpus-wide "carry" sweep: about 600 uses in other hand-written docs
  (`website/docs` outside the pangenome pages). The claudish checklist names the
  pattern and its `scan.sh` labels it under `agency`.
- jb2hubs: the variants launch still filters `wave.vcf.gz` with `LV==0`, which
  blanks HLA-DRB5 in the MHC window and the 1.7 kb HP deletion (not DRB1, as
  the comment in `pangenomeLinks.ts` says). The comment justifies the filter by
  this tutorial, which no longer uses it. Switching the launch to `pgbi` is
  Colin's call; the case, drawn per window, is in `reference/HPRC_RELEASE2.md`
  §"Which VCF to read the graph against".
- `~/src/claudish` has `edfa0d6` (the carry entry) on a main that was already
  five commits ahead of origin; nothing pushed.
