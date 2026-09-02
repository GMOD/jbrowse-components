---
name: alignments-display-review
description: Review of plugins/alignments LinearAlignmentsDisplay — findings, what is being implemented in the alignments-display-review worktree, and what is still open
---

# LinearAlignmentsDisplay review handoff

Worktree: `.claude/worktrees/alignments-display-review`, reset to local `main`
at `ac47137850`. Nothing committed yet except this file. Three opus
implementers and two opus reviewers may still be running in it when you read
this — check `git status` there before editing, and do not `git stash`.

## Confirmed findings (first pass, all verified by reading the code path)

Bugs

- `model.ts:1048` doc block for `densityCoverageRegions` sits above
  `densityStandsIn`; generated docs page glues them (`website/docs/models/LinearAlignmentsDisplay.md:207-208`).
- `components/PileupBezierOverlay.tsx:121` click selects one mate; canvas click
  (`useAlignmentsBase.ts:496`) selects the chain via `setSelectedChainReadIds`.
- `setMouseoverExtraInformation` (`model.ts:3859`) has no context-menu guard;
  `setHoverState` (`:3883`) does. Sashimi (`SashimiArcsOverlay.tsx:88`) and
  bezier (`PileupBezierOverlay.tsx:113`) hover through the unguarded one.
- `setReadConnectionsLineWidth` (`model.ts:3734`) has no caller anywhere; the
  slot is config-only. GPU memo tracks `arcLineWidth` for nothing.

Perf

- `renderers/GpuAlignmentsRenderer.ts:865` — any change to the `arcs` object
  (every arc-tier setting, incl. the live `minInterchromSupport` slider)
  rebuilds all 13 pileup + 5 coverage passes. Only the recolour path is narrow.

Cleanups

- Casts where `model.view` (typed LGV) exists: `model.ts:2532`,
  `PileupComponent.tsx:96`, `AlignmentsDisplayComponent.tsx:87`.
- `pileupViewportHeight`/`pileupContentHeight` (`model.ts:2489/2505`) duplicate
  the sticky-band subtraction.
- Hover-band type spelled twice (`model.ts:482`, `:3876`); `readLookup.ts:705`
  `?? 1` strand fallback; `model.ts:3151` `name || id`; `menus/sortGroup.ts:741`
  three actions per radio; direct MST actions passed as callbacks in
  `menus/reads.ts:920`, `menus/readConnections.ts:377`.

UX

- Plain-pileup hover is name+location+strand only; `formatChainTooltip`
  (`tooltipUtils.ts:627`) already falls back to the read span and could serve
  both modes (+ MAPQ line).
- "Debug: show arc geometry" (`menus/readConnections.ts:455`) ships in the user
  menu.
- `clearDisplaySpecificData` (`model.ts:3291`) zeroes scroll on every refetch.
- `SetFeatureHeightDialog.tsx:24` says "read" while the menu threads
  `featureNoun`.
- `menus/coverage.ts:151` SNP-floor radio ticks nothing for an off-list value.

## Being implemented right now (three concurrent agents, file-partitioned)

- Agent A owns `model.ts`, `PileupBezierOverlay.tsx`, `SashimiArcsOverlay.tsx`,
  `CrossRegionArcsOverlay.tsx`, `menus/sortGroup.ts`, `menus/readConnections.ts`:
  docs block move + `pnpm autogen`; hover via `setHoverState` and delete
  `setMouseoverExtraInformation`; bezier chain select + test; `self.view`;
  `stickyBandHeight` getter; one hover-band interface; `setLayoutOrder` action;
  scroll-reset scoping (only if scrollTop is clamped on content shrink); line
  width `makeSizeMenu` row + gate the debug toggle to dev; wrap callbacks.
- Agent B owns `renderers/GpuAlignmentsRenderer.ts` + renderer tests: arc-only
  upload path (re-upload `ARC_PASSES` only when layout/colours unchanged), test
  with fake HAL, measurement if a bench fits.
- Agent C owns `useAlignmentsBase.ts`, `tooltipUtils.ts`, `PileupComponent.tsx`,
  `AlignmentsDisplayComponent.tsx`, `readLookup.ts`, `SetFeatureHeightDialog.tsx`,
  `menus/featureSize.ts`, `menus/coverage.ts`, `menus/reads.ts`: one read
  tooltip formatter (+MAPQ, keep strand), noun threading, SNP radio snapping,
  callback wrapping, casts, strand fallback.

Agents were told not to commit. When they report: run
`pnpm lint --cache --fix`, typecheck, `pnpm test-related --with-web` (menu
labels changed), then commit with an explicit pathspec.

## Second-pass findings not yet assigned (colour modules reviewer, verified)

Implement after A/B/C finish (touches `shared/legendUtils.ts`, `colorUtils.ts`,
`colorTagUtils.ts`, `readTagColors.ts`, core `palette.ts`):

- bug `shared/legendUtils.ts:627-635` collapsed-overlap legend swatch composites
  black; pass paints `colorOverlapTint` = `palette.text.primary` (light in
  dark mode). Composite the real tint; reword "darker = more"; add
  `colorOverlapTint` to the test palette.
- bug `colorUtils.ts:60-66,584-591` + `legendUtils.ts:255-260`: `modFwd`/`modRev`
  are flat slots misfiled as dynamic, so a modifications legend never names
  the read fill. Move into `swatchPaletteKeys` with `CATEGORY_LEGEND` labels.
- bug `legendUtils.ts:900-902` `{type:'tag'}` with no tag → empty legend box;
  fall back to the `normal` branch's "Reads" row.
- bug `colorTagUtils.ts:33-39` categorical tag hash into 10 slots collides;
  use the `refNamePaletteColorAt` lap/relight treatment or the 40-colour
  categorical palette.
- cleanup `colorUtils.ts:331-337` restates `framesUnpairedChainStrand`; call it.
- cleanup `legendUtils.test.ts:226-232` pins an unreachable scheme/category
  combination; retarget or assert the negative.
- cleanup dead exports `colorUtils.ts:140 orientationSchemes`,
  `colorTagUtils.ts:15 TAG_COLOR_PALETTE`.
- ux `legendUtils.ts:821-827` sort baked-value rows numerically / by assembly
  position; `:917-931` per-base schemes never name the read body (add "Reads").
- cleanup `legendUtils.ts:355-361` load-bearing cast; `readTagColors.ts:117-122`
  `?? 0` hides a length mismatch.
- ux `packages/core/src/ui/palette.ts:698-700` modification fills have no dark
  variant (tag palette likewise, bigger job — decide separately).
- drifted comments to delete: `colorUtils.ts:449-453` ("ten" schemes, there are
  nine), `:45` (`rgb255` "backwards-compat"), the "dynamic ramps" claim.
- refactor `colorUtils.ts:265-457` `readColorCategory` → override ladder +
  scheme switch.

Two more reviewers (tooltip/arc components; chain/layout helpers) were still
running — read their reports from the session if available, else re-run the
same read-only review on those file sets.

## Parked / rejected

- GroupByDialog firing two actions: the fetch autorun coalesces within a
  microtask, so no double fetch. Dropped.
- Layout, hit-test and both renderers' math checked against their parity tests;
  no wrong-answer bug found there.
