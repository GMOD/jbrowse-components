---
name: mark-system-convergence
description: The 2026-09-05 render-core mark-system review landed three of its six items on main (the display-held encode memo, span's hitNearest with a draw-against-hit sweep, MSAA derived from a shader directive) plus a cleanup batch; what is left is two decisions Colin has not taken (a positioned-label overlay component, a cell shape for the multi-sample variant display), two recorded prerequisites no consumer has pulled (bufferOf, params(state, region)), and a coordination note for the MAF/alignments store work that should build on createEncodeMemo rather than a third memo
---

# Mark-system convergence handoff

Four Fable review passes on 2026-09-05 converged on one boundary rule for
`packages/render-core/src/marks/`: **the shape owns geometry and picking, the
display owns its data and the encode from data to channels, and the installer
owns only the diff.** `channels` on `defineMark` is a lens that picks fields,
never work. The rule is now stated in `packages/render-core/CLAUDE.md`
§Upload; this file records what landed against it, what was declined, and what
is still open.

## Landed on main (seven commits, all fast-forwarded)

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

## Open: two decisions for Colin, not refactors

1. **Positioned-label overlay component in display-kit.** Eleven ~30-line
   `OverlayCanvas` wrappers (alignments, MAF, multi-row indels, canvas labels,
   variants insertions, sequence, offscreen mates, arcs) differ only in painter
   and colour rule; one component plus one SVG emitter, redrawn on data
   identity, nets ~200 lines. Placement (`computeVisibleLabels` etc.) stays
   per display. Needs a decision on the label record shape.
2. **A `cell` shape for `LinearMultiSampleVariantDisplay`.** Admissible under
   ADR-090's surviving one-consumer clause (ADR-040's two-consumer bar is for
   shared `.slang` modules). It is `span` plus a glyph lane and the display's
   own half-canvas snap grid with a 2 px floor (`variant.slang`), so converting
   onto `span` would change drawn output. Payoff is one renderer pair
   (`interleaveVariantInstances` + `drawVariantBlocks`), ~150 lines, lateral.

## Recorded prerequisites, unbuilt until a consumer pulls

- `bufferOf` on `defineMark`: a mark registered but never uploaded, drawn off
  another mark's buffer via the HAL's existing `bufferPassId`.
- `params(state, region)`: `writeUniforms` never sees the region, so a
  per-region uniform (canvas rect's `outlineColor`) is unsayable.
- Even with both, canvas basic needs a conditional continuation draw off
  `canvasEdgeFlags`, a renderer-chosen chevron cap and a typed layer registry
  (`GpuCanvasFeatureRenderer.ts:168-186`); wiggle needs the pass chosen per
  region off `sources[0].renderingType` and a ramp texture upload per pass
  (`GpuWiggleRenderer.ts:140-220`). Alignments stays off for the reason
  `REJECTED_IDEAS.md` §"Fold PileupMark" measured.

## Coordination: the MAF/alignments store work

Another session is generalizing `DensityTierMixin` into a shared coarse-tier
mixin, then moving MAF's detail rows onto the foundation store with the placed
map as a projection. Told them: rebase onto main; step 2's "per-region memo
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
  times in `ARCHITECTURE.md` and `creating_display.md`; the foundation-table
  generator reads beyond its own tree when sibling worktrees exist. The agent
  reverted those two files; the generator itself was not fixed.
