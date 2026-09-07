---
name: synteny-docs-accuracy
description: What the 2026-09-07 pass over the synteny tutorials could not finish — four figures to reshoot (two shot against superseded data or code, two predating the color key their prose promises), two that are weak rather than stale, a latent ordering nondeterminism in ComparativeAdapterBase, a demo redeploy that would let three configs shed boilerplate, and the reason check-menu-labels passed a menu path that does not exist. Read before reshooting a multiway figure, before trusting check-menu-labels on a path, or before redeploying the ortholog demos.
---

# Synteny docs accuracy: handoff

Nine synteny pages plus `config_guides/synteny_track.md` were checked against
the code and against their own figures on 2026-09-07. What was settled is in
git and in the permanent homes: the display's findings in
[ideas/multiway-synteny-analysis-2026-09-06.md](../ideas/multiway-synteny-analysis-2026-09-06.md)
(its top block says which of the older findings have since landed, and 4.10 and
4.11 are what this pass added), the graph-native thread in
[handoffs/multiway-graph-native.md](multiway-graph-native.md). This file holds
only what is still open.

## Four figures to reshoot

The first two are the load-bearing ones: their pages now describe them
accurately, which means the pages describe a picture that is behind the code.

- `multiway_synteny/hprc_lane_menu` — shot 2026-09-05, against HPRC release
  **2.0**. The hosted PIF was rebuilt on 2.1 the next day (`758b30a558`), so it
  is the only figure in `hprc_multiway_synteny.md` showing 2.0 lane order, and
  it contradicts `pangenome/hprc_cfh_haplotypes` three sections away. The
  arithmetic that makes the order deterministic is ideas §4.10.
- `multiway_synteny/hg38_vertebrates_17p_break` — predates `05ec50660e`
  (`splitAtGapBp`). It draws the marmoset lane `[rev]` at `2.4Mbp 2x`;
  `decideLaneFrames` now decides forward at rung 3, against the measurement
  record `measurements/multiway-17p-orientation.json`. The page's prose was
  corrected to stop asserting the orientation, so the two only disagree in the
  picture.
- `multiway_synteny/ecoli_symbol_atp_operon` and
  `multiway_synteny/ecoli_symbol_oantigen` — shot `ef37b2f32a` (2026-09-02),
  four days before the lane color key and the prose promising it landed
  together in `29f2346416`. The prose is right about the app; neither figure
  shows the key.

## Two figures that are weak rather than stale

Captions were corrected to describe what these actually show, which is the
lesser fix. A better window is the real one.

- `multiway_synteny/primate_chr17_inversions` — ten megabases where the frame
  is dominated by whole-sheet lane offset and rung, not by the synteny painting
  the section promises.
- `multiway_synteny/primate_amy_cluster` — the near-identical amylase copies the
  section is about are not legible, and `randomColor` gives each lettered copy a
  different color, so the family reads as unrelated genes.

## Code

- **`ComparativeAdapterBase.getFeaturesInMultipleRegions` merges per-region
  streams by arrival.** On a multi-region view that is run-to-run
  nondeterministic, and lane weights tie exactly often enough for it to reorder
  a stack. It wants the `fileOffset` sort `MultiGenomeIndexedPAFAdapter` already
  applies. Evidence and the exact tie that exposes it: ideas §4.10.

## Demos

`demos/*/config.json` still carry two things the tutorials and build scripts no
longer need to, because the repo copy is what `check-live-configs --network`
compares against the hosted one and the hosted copies have not been redeployed:

- the adapter-level `assemblyNames` that duplicates `blockAssemblies`, now
  defaulted (`MCScanBlocksAdapter.mateAssemblies`)
- `jexl:feature.name ? randomColor(feature.name) : '#b0b0b0'`, where
  `randomColor` already answers `NO_CATEGORY_COLOR` for an absent value

Both are no-ops on screen, so the unit of work is one pass over the build
scripts plus `scripts/deploy-demo.sh`, not a config edit.

## Checks

- **`check-menu-labels` cannot see a menu PATH.** It asserts each segment of a
  documented `**A → B**` exists somewhere in the tree, so a path assembled from
  two real labels that never appear together passes. Two pages documented
  `Color by... → dN/dS` for a synteny track — "Color by..." is the variants
  plugin's — and the check was green on both. It also skips a bold label that
  wraps a line, which is how a third instance survived.
- `website/docs/user_guide.md` still has no multiway section, the last open item
  of ideas §4.8.
