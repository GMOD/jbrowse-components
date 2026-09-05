---
name: mark-system-convergence
description: The 2026-09-05 render-core mark-system review landed five of its six items on main (the display-held encode memo, span's hitNearest with a draw-against-hit sweep, MSAA derived from a shader directive, a cleanup batch, and the multi-sample variant display drawing through a plugin-held cell mark); the positioned-label overlay was declined as already built (OverlayCanvas plus Ctx2D); the variant matrix display pulled params(state, region), and canvas basic and multiway pulled bufferOf, so every recorded prerequisite has a consumer and the canvas feature glyph set is five marks two displays declare; nothing is open, and the file closes once its remainder is filed
---

# Mark-system convergence handoff

Four Fable review passes on 2026-09-05 converged on one boundary rule for
`packages/render-core/src/marks/`: **the shape owns geometry and picking, the
display owns its data and the encode from data to channels, and the installer
owns only the diff.** `channels` on `defineMark` is a lens that picks fields,
never work. The rule is now stated in `packages/render-core/CLAUDE.md`
§Upload; this file records what landed against it, what was declined, and what
is still open.

## Landed on main (twelve commits, all fast-forwarded)

- `a0856226cd`..`42bd8bfb1d` — cleanup batch: `MarkFrame` aliases
  `FrameDimensions`; core's `abgrToCssRgba` re-exports render-core's through
  the narrow `marks/colorFill` subpath (the `marks` index would drag shader
  strings into every plugin); `RowRectInstance` lanes renamed `x/x2/row/color`
  so the span pack is a one-liner; the two one-line renderer factories moved
  into their lazy component modules as module-level functions (an inline arrow
  rebuilds the backend every render, `useRenderingBackend` keys on it).
- `fe046d45c2` — `createEncodeMemo` (`packages/render-core/src/encodeMemo.ts`)
  is the one per-key encode memo; `installUpload`'s `encode` path runs on it;
  multi-row and MAF hold their own in a `.views` closure and hand identity
  cells. Multi-row's hit index is a byproduct of its encode in channel-index
  space (`MultiRowEncoded extends SpanChannels`, `featureIndex` lane, CSR row
  buckets); `createDrawnFeaturesByRowIndex` and `featurePainting.ts`'s bucket
  helpers are gone; both `renderSvg.tsx` files stopped re-encoding on-screen
  inputs. `installUpload.test.ts` and `featurePaintInputs.test.ts` pin identical
  upload/release sequences between the two shapes.
- `a57548aca6` — `spanMark.hitNearest` from the exact painted rect (no
  `seamPx`); multi-row's `featureAtBase` feeds it row buckets nearest-first,
  each back to front; `paintedSpanContainsBp` deleted.
  `marks/drawAgainstHit.ts` is the sweep harness every shape inherits.
  **Behaviour change:** with `rowProportion < 1` multi-row no longer answers a
  hit in the inter-row gutter; nothing asserted the old answer.
- `dd8b8dae8d` — `//! coverage: analytic` shader directive → `ShaderModule.COVERAGE`
  → `PipelineDescriptor.coverage`; `createRenderingBackend` derives
  `sampleCount` 1 iff every registered pass declares it, explicit option
  overrides both ways. Declared on the four synteny passes, dotplot, arcFlat,
  linkedReadLine, rect. Only LinearSyntenyDisplay and DotplotDisplay flip;
  cross-backend gate scoped to them ran 44 pairs, max 1.28% under the 1.5%
  threshold. Per-shader declare/leave table is in the commit message.
- `LinearMultiSampleVariantDisplay` draws through a mark (2026-09-05, second
  session). `components/cellMark.ts` is a `MarkShape` over `variant.slang`
  (unchanged), `variantMarks.ts` declares `VARIANT_MARKS`, the component
  builds its backend with `createMarkBackend` and `renderSvg.tsx` paints with
  `paintMarkBlocks`. `GpuVariantRenderer`, `Canvas2DVariantRenderer`,
  `variantShaders.ts` and `VariantRenderer.ts` are gone with their two tests;
  `variantMarks.test.ts` pins the lane mapping, the uniform slots and the
  painter geometry. The shape stays in the plugin: the shader's generated
  twins (`snapVariantCellX`, `drawnCellHeightPx`) feed the hit test, the
  hover box and the insertion overlay, so moving the `.slang` would have
  spread that picking logic over two packages; `marks/types.ts` now says
  where a shape lives. The pass id changed from `main` to `cell`; nothing
  outside the deleted tests named it. The hit test did not move onto
  `hitNearest`: it is index-driven with insertion widening
  (`pickVariantCell`), a different question from nearest ink.
- `scripts/declaredDependencies.test.ts` green on main again: its
  test-support pattern matched `testutils` but not `test-utils`, so the
  private `display-test-utils` harness was held at production strictness for
  its `@testing-library/react` import.
- `LinearMultiSampleVariantMatrixDisplay` draws through a mark, and
  `defineMark`'s `params` sees the region. `components/matrixCellMark.ts` is a
  `MarkShape` over `variantMatrix.slang` (unchanged), `variantMatrixMarks.ts`
  declares `VARIANT_MATRIX_MARKS` with `params: (state, data) => ({
  numFeatures: data.numFeatures, ... })`, and the display hands
  `createMarkBackend` one block spanning the canvas over `[0, numFeatures]`
  (`matrixBlocks`) with the payload under key 0 (`matrixRegions`, left out
  while it has no cells so `canvasDrawn` stays down over a blank canvas, as
  the global backend's `false` did). No global mark backend was needed: a
  matrix is one region whose x axis is a column index, and the per-region
  backend's whole-canvas clip is a no-op on it. `GpuVariantMatrixRenderer`,
  `Canvas2DVariantMatrixRenderer`, `variantMatrixShaders.ts` and
  `VariantMatrixRenderer.ts` are gone; `variantMatrixMarks.test.ts` pins the
  lanes, the uniforms and the painter geometry the old test pinned.
  `GlobalRenderingBackend` is HiC's and LD's now.
- The canvas feature glyph set is five marks (`2fbd892022`). `defineMark`
  gained `bufferOf` (a mark drawing off another's uploaded buffer;
  `createMarkBackend` uploads only the owners) and `MarkShape.paintsBlock`
  (a shape declining a block from its place in the frame, before either
  backend walks it). `plugins/canvas/.../marks/featureGlyphShapes.ts` holds
  rect, line, chevron, arrow and continuation with their painters moved over
  unchanged and one uniform writer; `featureGlyphMarks({ params,
  maxChevronsPerLine, continuation })` is the list in paint order.
  `LinearBasicDisplay` declares `CANVAS_FEATURE_MARKS` and
  `MultiWaySyntenyDisplay` — the second consumer, through its own renderer
  pair until then — declares `MULTIWAY_GLYPH_MARKS` under a px-per-bp block.
  Both renderer pairs, the glyph-layer registry and its two draw tables are
  gone. Cross-backend gate, canvas2d vs webgl on swiftshader: 18 pairs on the
  gene and wiggle captures and 10 on multiway, every gene and multiway pair
  0.00%, wiggle's known 0.3–0.4% antialiasing drift showing the comparison
  live. `REJECTED_IDEAS.md` records why this converted and alignments still
  does not.

## Declined during the review, do not re-propose

- A mark-level installer (`installMarks`) on the marks subpath — ADR-088
  refused presets; the memo factory was the right-sized cut.
- `span.hitAt` as a backwards channel scan — channels are in feature order,
  and the pre-index hit test walked half a million features per hover
  (`featurePainting.ts` history). The candidates form of `hitNearest` fits.
- A `containsPx` per-instance predicate — rebuilds the bp mapper per instance.
- `MarkShape.antialiased` as a boolean on the shape — a shader property one
  level up; the directive reaches non-mark displays too.
- A `scale` slot on `defineMark` — ADR-097 measured the refusal.
- A text mark painted by the mark backend inside the frame loop —
  `INTERACTION_PERF.md` measured that any `fillText` flushes style recalc.
- "canvas basic display and wiggle become mark candidates once `bufferOf`
  exists" — overstated; see prerequisites below.
- **A positioned-label overlay component in display-kit** (was an open
  item). Read against the tree on 2026-09-05: the shared half already exists.
  `OverlayCanvas` is the component (the dpr-prepared, pointer-inert,
  absolutely positioned canvas) and `Ctx2D` with `SvgCanvas` is the SVG
  emitter, which is why every painter (`drawAlignmentLabels`, `drawMafLabels`,
  `drawMafDeletionLabels`) is already called unchanged from the export path.
  What the eleven ~30-line wrappers hold is a props interface, an empty-list
  early return and one draw call, and each wrapper is the `observer` memo
  boundary that keeps a hover re-render from redrawing — inlining the closure
  into the parent redraws every render without the React Compiler, which
  `build:esm` ships without. A shared label record (`{x, y, text, font, fill,
  align, opacity}`) would move colour resolution into placement, making
  `computeVisibleLabels` palette-dependent, for a ~50-line saving. Nothing
  left to converge.

## Prerequisites, all pulled

- `params(state, region)`: the matrix's column count, the canvas rect's
  per-region `outlineColor`.
- `bufferOf`: the canvas chevrons off the line buffer, the continuation
  markers off rect's.
- Canvas basic converted without the "typed layer registry" the earlier
  round listed as a need: the mark list is the order, each mark carries both
  backends, and the passes register off it. Wiggle stays off (a pass chosen
  per region off `sources[0].renderingType` and a ramp texture upload per
  pass); alignments stays off for the reason `REJECTED_IDEAS.md` §"Fold
  PileupMark" measured.

## Coordination: the MAF/alignments store work

Another session generalized `DensityTierMixin` into `CoarseTierMixin` (step
1, `0dc7cb37cc`..`d8621afe31`) and moved MAF's detail rows onto the foundation
store (step 2, `06952f2574`), both on 2026-09-05; its handoff closed with
`eab557a060`. What had been told them, kept for the record: rebase onto main; step 2's "per-region memo
keyed on wire identity and row order" IS `createEncodeMemo` (cells = wire map,
inputs = row order, encode = placement), do not write a third memo; MAF's
upload memo reads `self.rpcDataMap` as cells and only that getter moves when
the map becomes a projection; land step 1 before step 2. The
`afterAttach` autorun rule in render-core's CLAUDE.md applies: an unobserved
memo whose inputs getter allocates re-encodes every region per read.

## What each subagent did (seven Fable agents, all reports relayed to Colin)

Four read-only review forks, each with the full session context:

1. **Critical review** of the original seven findings. Demoted the installer to
   an accessor, `hitAt` to a per-instance predicate, struck the canvas/wiggle
   candidacy claim, reframed the text mark as an overlay component, corrected
   the variant-display admission rule, and added the sample-count derivation.
2. **Adjudication** of the disputed items against ADR-078/088/090/091. Chose
   the display-held memo over both installer variants, `hitNearest` over both
   picking proposals, a shader directive over a shape flag, and ruled that
   `channels` stays a lens because MAF's payload carries coverage buffers
   beside the cells.
3. **Implementer's review.** Enumerated the fourteen `installUpload` callers
   (six encode, only multi-row and MAF change); proved identity cells give the
   same upload counts via `mapUploadSync` reference compares; found the
   feature-index vs channel-index hole in the hit test and the fix (buckets
   emitted by the encode); set the landing order and moved the MSAA item out
   of the mark sequence.
4. **Convergence check** that produced the boundary rule and the final ranked
   list, with the `computed(inputs)` requirement on the memo factory.

Three implementers, each in its own worktree, landed serially by fast-forward:

- **Encode memo + span hit test** (`fe046d45c2`, `a57548aca6`): oracles
  `pnpm typecheck`, `test-related` 359 suites then `--with-web` 534 suites /
  4149 tests, `check-format`, oxlint, `autogen`; sabotage of `spanLeft` in
  `hitNearest` went red on the reversed sub-pixel rect. Retired
  `createDrawnFeaturesByRowIndex`, `drawnFeaturesByRow`,
  `findTopDrawnFeatureInRow`, `paintedSpanContainsBp`, `featurePainting.test.ts`.
- **Cleanup batch** (four commits): `test-related --with-web` 1376 suites /
  13648 tests, `gen:shaders` exit 0, `publicApi` snapshot updated for the new
  `marks/colorFill` subpath, new pack-layout test pinning the four span lanes.
  Left `setAbgrFill` in core: its semantics differ from `makeAbgrFill`. Noted
  `scripts/declaredDependencies.test.ts` red on main for
  `packages/display-test-utils/src/teardownNoise.ts` importing
  `@testing-library/react` undeclared, untouched by the batch.
- **MSAA derivation** (`dd8b8dae8d`): `gen:shaders`, typecheck, `test-related`
  328 suites, lint, format, autogen all exit 0; built jbrowse-web and ran the
  cross-backend gate `--backend=all --swiftshader --gate-only --drift-report`
  filtered to synteny and dotplot: 57 tests on canvas2d/webgl/webgpu (webgpu
  on Firefox Nightly), 44 pairs, 0 over 1.5%, max 1.28% on a held display,
  dotplot 0.02%/0.42%, synteny ≤0.18%/≤0.57%. Bytes at dpr 2: 7.7 MiB per
  synteny level, 46.4 MiB per dotplot view, each to zero at sample count 1.
  Nothing held pending capture.

## Tooling seen

- `pnpm test-related` without `--with-web` exited 249 with no jest output
  twice; `npx jest --ci <touched dirs>` was the fallback (memory
  `test-related-exits-249-with-no-jest-output`).
- `pnpm autogen` in a worktree listed `LinearMultiRowFeatureDisplay` three
  times in `ARCHITECTURE.md` and `creating_display.md`. Not reproduced on
  2026-09-05 from a worktree with six siblings: `autogen` exited 0 with no
  diff. The census walks `plugins/packages/products` under the worktree's own
  root and the API corpus comes from `git ls-files`, which `.gitignore`'s
  `.claude/*` keeps clear of sibling worktrees — so the likely source is a
  subagent worktree nested inside the parent worktree (memory
  `subagent-worktrees-nest-under-the-parent-worktree`) at a path the walk
  does not skip, not a sibling. Unfixed; reproduce with a nested worktree
  before touching the generator.
- `pnpm test-related --with-web` on the cell-mark branch: 6 failures in
  three jbrowse-web synteny suites (`ExportSvgLinearSyntenyView`,
  `LinearSyntenyFollow`, `LinearSyntenyMoveFollow`), identical at main's tip
  `d8621afe31` with the branch detached — the synteny audit's, not the mark
  work's. The export one is a mate-label x moving 520.42 → 519.88; the
  follow ones time out or find no band feature.
