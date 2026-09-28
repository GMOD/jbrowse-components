---
name: multiway-demos-and-genark-stars
description: "After the 2026-09-28 multi-way round: two hosted-star tutorial sections wait on an ada shoot in the multiway-demos worktree, jb2hubs' GenArk stars wait on a pipeline run and staging deploy, and the Arabidopsis knob demo's CG lane layer needs a value check before it earns a page."
---

The round landed the one lane-fetch bookkeeping with four fixes
(`bc85b6305b`), three comment trims and their docs regen, and on jb2hubs main
(`af11f15ad39`, pushed) a multi-way star for every GenArk hub with three or
more liftOver mates.

## Next

1. **Shoot the two figures and land the page.** Branch `multiway-demos`
   (`.claude/worktrees/multiway-demos`, `3d13cb59a3`) holds two
   `genomes_synteny.md` sections, "Choosing the lanes: mouse strains at Nnt"
   and "One person's two haplotypes at 17q21.31", their specs
   `genomes_synteny/mouse_strains_nnt` and `human_17q21_haplotypes` in
   `specs/synteny.ts`, and `handoffs/multiway-orientation-few-groups.md`.
   From that worktree: `jb-shoot genomes_synteny/mouse_strains_nnt
   genomes_synteny/human_17q21_haplotypes --publish`, commit `figures.lock`,
   `pnpm autogen`, rebase (the handoffs README will conflict; regenerate it),
   land. Ada refused ssh on 2026-09-28 (fail2ban); Colin logs in first. Both
   pictures were checked locally: every strain lane opens a gap over Nnt's
   exons 7 to 11 with the C57BL/6J T2T lane straight, and H9 hap2 crosses hap1
   across the H2 inversion.

2. **Run the GenArk pipeline for the 47 hubs and deploy staging.** On ada,
   `genark2jbrowse/src/buildConfigsBatch.ts` over the hubs in
   `website/src/genarkStars.json` writes each `config-staging.json`; upload
   them (the star reads the pairwise tracks' own PIFs, so nothing else moves),
   then `./run.sh --staging`. Untested end to end: a GenArk star's lanes are
   labelled by GenArk's common name and open on the first nine mates by name,
   since GenArk carries no `speciesDefaultOn`; look at one (the T2T apes,
   `GCA_0288*`) before deploying the site.

3. **The hs1 orientation vote** is a real defect on hosted data,
   `handoffs/multiway-orientation-few-groups.md`: a fresh lane with three
   shared groups lets one inverted record outvote 1.5 Mb of forward chain.
   The fix proposed there needs the grape stability walk re-run.

## Not now

- **Arabidopsis knob with CG methylation as a lane layer.** Driven locally
  through the dev server with the 11 accessions' `CGmeth.bw` files as
  `laneLayers` on `syri_1001g`: the layer draws in every lane but reads as a
  solid strip at a 1.5 Mb window and the shared domain printed `-1–1`. The
  bigWigs name their refs `6909_Chr4` and hold scores 0 to 1. Check what a
  zoom level's summary returns over the knob against the arm before
  building the page; the config generator is the session's scratchpad
  `arabidopsis_layers.cjs`.
- Drosophila's bithorax split on dm6 and the Bovini stack on bosTau9 were
  surveyed (both hosted in their stars) and not started.
