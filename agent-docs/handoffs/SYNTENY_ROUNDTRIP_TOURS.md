---
name: synteny-roundtrip-tours
description: Two written, unfilmed tours on branch `synteny-roundtrip-tours` — `synteny/ecoli_roundtrip` (one selection offers graph and stack, stack re-anchored from the Sakai row, graph cut from the stack's K12 row) and `synteny/maf_row_synteny` (a MAF drag launching K12 vs NCTC86) — with their `<Video>` embeds in pangenome_ecoli.md. Film, push media, commit media.lock; then the graph plugin's unpublished row-aware `connectedViewId` fix.
---

# Synteny round-trip tours, unfilmed

Session ended 2026-08-25 out of budget with the build fresh and the specs
validated (`node website/scripts/check-video-specs.ts`: 43 specs pair up).

## What landed on main

- `67d275f4fe` a row of a stack launches from the bands beside it
  (`launchableTrackConfs`; the launch offers to replace the STACK).
- `bf31d363d7`, `87b0e93ac7` MAF row → two-row synteny view
  (`plugins/maf/src/LinearMafDisplay/launchMafRowSynteny.ts`), and the
  loaded-assembly fallback in `rowNavigationTarget`.
- Both verified in the built app against
  `https://jbrowse.org/demos/ecoli_pangenome/config.json` with a puppeteer
  probe (deleted): the Sakai row's rubberband dialog listed K12/CFT073/NCTC86/
  IAI39 anchored on Sakai; the MAF launch opened K12 (genes + MAF) over NCTC86
  (`NCTC86_genes`) with a full-width ribbon.

## What is parked, on branch `synteny-roundtrip-tours`

One commit over main holding:

- `website/scripts/specs/synteny.ts`: fixtures `roundTripStart`, `mafRows`,
  `segmentsTrackId`.
- `website/scripts/videos/synteny.ts`: the two specs (last two in the array).
- `website/docs/tutorials/pangenome_ecoli.md`: prose plus two `<Video>` embeds
  (`/media/synteny/ecoli_roundtrip.mp4`, `/media/synteny/maf_row_synteny.mp4`).

**Do not land it before the media is pushed** — `check-figure-refs` fails on an
embed with no clip. To finish:

```sh
git merge --ff-only synteny-roundtrip-tours      # in a worktree on main
pnpm --filter @jbrowse/web build                 # the tours load build/
node website/scripts/generate-video.ts --filter synteny/ecoli_roundtrip
node website/scripts/generate-video.ts --filter synteny/maf_row_synteny
pnpm figures:push --filter ecoli_roundtrip --filter maf_row_synteny
git add website/media.lock && git commit
```

Things the first filming will probably hit, in order:

- Another agent's `runner.ts` from a worktree predating `1c2ce8a7fc` SIGKILLs
  every puppeteer renderer on the machine at its startup; the symptom is
  `Target closed` / `detached Frame` seconds in. Memory
  `probe-hosted-config-seed-trusted-plugins` has the workaround.
- The re-anchor drag is a selector anchor (`RUBBERBAND`, `view: [0, 1]`,
  `dx ±220`), untested through the video harness; the probe drove the same
  step through the model. If the band does not resolve, the row's ruler is the
  second `rubberband_controls` on the page.
- The MAF drag is a selector anchor inside `[data-testid="maf-display"]`
  (center+10 to bottom-6); the rows must include NCTC86 or
  `MAF_NCTC86_ENTRY` never appears — the probe's drag over the lower 70% of
  the display covered K12 and NCTC86.
- The graph launch inside the stack assumes the stack's K12 row carries
  `ecoli_minigraph_segments` (copied by `anchorPanelTracks`); `viewportHeight`
  1110 is a guess sized from `pggb_subgraph_launch`.
- After filming, `pnpm autogen` for `liveLinks.generated.ts` (video frames).

## The cross-repo half

`~/src/jb2plugins/jbrowse-plugin-graphgenomeview` commit `76c3904` (unpushed,
unpublished): `linearViewTarget` walks nested `views[]`, so "Open in K12" from
a graph node scrolls the synteny row the graph was launched from. Until
`betabuild.sh` republishes the hosted bundle, the tutorials' graph → row step
opens a new pane instead. The plugin repo's typecheck is red on 26
pre-existing errors from a `@jbrowse/mobx-state-tree` 6.3 → 6.5 drift.
