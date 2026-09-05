---
name: alignments-maf-tier-convergence
description: Colin approved converging LinearMafDisplay onto the mechanisms LinearAlignmentsDisplay already gets from display-kit — a shared coarse-tier mixin (step 1, two commits on a Fable agent's worktree, unlanded), then MAF's detail rows onto the foundation's per-region store through createEncodeMemo (step 2), then deleting MAF's four region volatiles (step 3). Step 1 must land before step 2 starts.
---

# Alignments/MAF tier convergence handoff

Colin, 2026-09-05: "i dont understand why we have difference between
alignments and maf. i dont like unnecessary deviation in implementations."
The difference is where each display gets the same shape from:

| Concern | Alignments | MAF |
|---|---|---|
| Detail rows per region | foundation store (`regionPayloads`) | own `wireDataMap` + `rpcDataMap` |
| Zoomed-out tier | `DensityTierMixin` in display-kit | hand-written: `summaryDataMap`, `showSummary`, `regionHasData` override, `clearAlignmentData` |
| Side data riding the fetch | none | `framesDataMap` |
| Post-fetch projection | layout getters over the store | `placeFetchedRows` autorun writing a second map |

## Step 1: one coarse-tier mixin (in flight, unlanded)

A Fable agent's worktree holds it:
`.claude/worktrees/agent-a05bfae401a13f3c8`, branch
`worktree-agent-a05bfae401a13f3c8`. When the session ran out of tokens it had
two commits and one uncommitted file, and was still working:

- `34bc7808ef` refactor(display-kit): CoarseTierMixin is the one zoomed-out
  tier, and DensityTierMixin composes it
- `8fddd63d14` refactor(maf): the summary tier is CoarseTierMixin's, and the
  hand-written tier goes

Its brief also asked it to solve the loaded-span-across-tiers stamp in the
mixin (agent-docs/ideas/maf-tiers-share-one-loaded-span.md: a narrow detail
fetch overwrites the wide coarse span, and `summaryTierSwap.test.ts` cannot
see it because it seeds the whole region), reseed that test with a narrow
detail span, correct the reuse claim in ARCHITECTURE.md around lines
1547-1560, and run `pnpm test-related --with-web`. Check whether those landed
in a third commit before judging the branch.

**Landing pass** (agent-docs memory `parallel-agent-landing-sequence`):
`git -C <worktree> status` must be clean; `git -C <worktree> rebase main`;
`pnpm typecheck` in the worktree; `git merge --ff-only
worktree-agent-a05bfae401a13f3c8` from the primary as its own command, read
the exit code; then `git worktree remove` and `git branch -d`. Do not remove
the worktree while the branch is unmerged.

## Step 2: MAF detail rows onto the foundation store

Start only after step 1 is on main. A reviewer's two notes, verbatim:

- Use `createEncodeMemo` from `packages/render-core/src/encodeMemo.ts` for the
  placed-rows memo. It is the per-key memo keyed on data identity plus an
  inputs identity. Do not write another one. Render-core's CLAUDE.md has the
  rule for holding it in a views closure with an autorun observing it.
- MAF's upload already reads `self.rpcDataMap` through that same memo in
  `startRenderingBackend`. When the placed map becomes a projection off the
  store, point the memo's `cells` getter at the projection and leave the rest
  of the upload path alone.

Shape: `fetchRegionsBatched` (packages/display-kit/src/fetchEachRegion.ts)
gains a per-region payload slice (a `payloadFor(displayedRegionIndex,
batch)` option defaulting to the batch); the wire region
(`MafWireRegionData`) is the payload; `rpcDataMap` becomes the placed
projection through `createEncodeMemo` keyed on wire identity and
`rowIndexBySrc`; frames ride the detail payload since they already piggyback
on the same fetch. `refSampleIdVolatile`'s write moves out of `setRpcData`
into the batch commit beside `setSamples`. Keep `fetchRegionsBatched`, not
`fetchEachRegion`: the sample-set union is a decision over the whole batch
and one refusal refuses the batch (fetchMafData.ts's docblock).

## Step 3: delete

`wireDataMap`, `rpcDataMap`, `framesDataMap`, `setRpcData`,
`placeFetchedRows` and its autorun, and whichever of
`clearAlignmentData`/`clearDisplaySpecificData`/`clearSettingsBakedData`
step 1 left. About 18 MAF test files stage state through `setRpcData`.

## Already on main from this session

Thirteen cleanup commits between `eb6ff5047e` and `620051efbf`: MAF dead
setters gone; alignments' conf-only getters in `configSlotViews.ts`;
`YScaleGutter` in wiggle-core; `ScrollChrome` in core/ui;
`settledSubPixelBinBp` and `hasRegionData` on `MultiRegionDisplayMixin`.
