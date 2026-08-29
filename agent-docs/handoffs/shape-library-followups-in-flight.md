---
name: shape-library-followups-in-flight
description: One thread left of the four that died on a rate limit (2026-08-28) after the a-shape-composes-a-scale plan landed — the bpLen-convention assessment, whose idea doc is drafted and whose verdict is no-go. The defects batch, the legend seam and the capsule module all landed 2026-08-29; what each of them decided that lives nowhere else is now in the tree (adr-051's export gate, ideas/a-display-declares-itself Level 2, ideas/a-shape-composes-a-scale Step 5). Delete this file when the assessment lands.
---

# Shape-library follow-ups in flight

Three of the four threads landed on 2026-08-29 and their worktrees are gone.
One remains. **Do not remove its worktree until it lands or is deliberately
abandoned.**

## Landed, for anyone following a stale pointer

- **Defects batch** — all four items. The MAPQ hue parity test exists
  (`plugins/alignments/src/shaders/mapqHueParity.test.ts`); the vec3 emitter
  extension it was being built on was **discarded**, because `parseDirectives.ts`
  refuses a `float3` export upstream of `wgslToJs.ts` and the draft also
  regressed `rect.slang`. `hueRampHalfSat` was factored onto a scalar
  `hueRampLane` instead — adr-051's own recipe. Wiggle's reorder-no-refetch test
  is in `MultiLinearWiggleDisplay/fetchAutorun.test.ts`. Level 2 of
  `ideas/a-display-declares-itself` is retired in that doc.
- **Legend seam** — `stopsFromRampLut` in `packages/core/src/util/colorRamp.ts`,
  with HiC and LD reading their stops through it and wiggle's `scoreRamp`
  carrying the resolved `densityColorRamp` LUT.
- **Capsule module** — `packages/render-core/src/shaders/capsule.slang`, two
  consumers (dotplot, wiggleLine linecenter), and the alignments pair moved OFF
  round caps onto `buttSegmentCoverage`. Results are in
  `ideas/a-shape-composes-a-scale` Step 5.

## bpLen-convention assessment — `.claude/worktrees/agent-a78e15a55facee98c`

**State**: the draft `agent-docs/ideas/alignments-reversal-convention-migration.md`
is untracked but **complete, not truncated** — it carries its verdict at the
top, frontmatter, a staged reopen plan and kill conditions. An earlier note here
warned it might be cut off mid-write; it is not. Nothing else in the worktree.

**Verified 2026-08-29** against the tree, so a resuming agent need not re-check
these: the 13-of-14 blast radius (15 `.slang` files in
`plugins/alignments/src/shaders/slang/`, minus the shared `alignmentsUniforms`
module, and only `flatQuad.slang` omits the flip family); the
`GpuAlignmentsRenderer.ts` keep-bpLen-positive warning; `flipX` and
`arcBandClipPos` in `alignmentsUniforms.slang`; `bpRangeXTuple` in
`blockClipUtils.ts`; `hpToClipX` and `extendToMinWidthPx` in `hpmath.slang`;
`featureGlyphUniforms.slang`'s own comment that canvas carries `flipX` for
direction scalars as well as positions, which is the doc's "deletes a spelling,
not a concept" point; and the 1 CSS px fit-pitch floor in
`LinearAlignmentsDisplay/groupLayout.ts`.

**Remains**: two line-number cites in the doc need re-checking before it lands,
because the landed threads moved the file under them —
`alignmentsUniforms.slang` gained the `hueRampLane` restructure and the
`buttSegmentCoverage` pair, so every cite past the stroke-coverage block has
shifted. Then `pnpm autogen` (the doc is new, so the ideas index needs it) and
commit. The doc cites `groupLayout.ts:476` with no path and there is exactly one
such file; adding the path would help.

**Resuming**: enter the worktree (`EnterWorktree` with `path`),
`git rebase main`, finish, land as a fast-forward, then remove the worktree and
delete this file.
