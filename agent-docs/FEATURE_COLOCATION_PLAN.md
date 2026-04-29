# Feature colocation plan — alignments renderer

Reorganize the alignments renderer so each visual feature owns a folder
(`plugins/alignments/src/features/X/`) instead of being scattered across role-
organized files (renderer / processor / hit-test / shader). Editing a feature
becomes "edit one folder" instead of "edit ~6 files across 3 directories."

## Status

| Step | Scope | Status |
| --- | --- | --- |
| 1 | `modification` | ✅ done |
| 1.5 | type/shader leak fixes; raise `shaders/` | ✅ done |
| 2 | CIGAR family (gap, mismatch, insertion, soft/hardclip, softclip-bases) | ✅ done |
| 3 | Coverage family (coverage, snpCoverage, modCoverage, noncov, indicator) | ✅ done |
| 4 | Paired/read-shape (arcs, linkedReads, connectingLines, segments → folded into `read/`) | ✅ done |
| — | Layering fixes: `interbaseRangeEnds` + upload types in `shared/uploadTypes.ts`; `features/read/` trunk; `computePileupArcs` → `features/arcs/computeOverlay.ts` | ✅ done |
| — | SVG-only feature template (sashimi, arcs overlay) | ✅ documented below |
| 5 | Renderer-class → closure refactor of `Gpu/Canvas2DAlignmentsRenderer` | ⬜ deferred — see footer |

## Reference shapes

- Canonical full feature: `features/modification/` — extract / buildArrays /
  buildRegion / packGpu / uploadGpu / drawCanvas / hitTest / hitTest.test /
  types.
- Trunk feature (no `buildRegion`; trunk fields live on `Canvas2DRegionData`
  directly): `features/read/` — packGpu / uploadGpu / drawCanvas / hitTest /
  buildSegments (segment arrays are a sub-concern of the read pass, like
  `softclip/packBases.ts` is a sub-concern of softclip).
- Sub-concern files: `features/softclip/{packBases,uploadBases,drawBases}.ts`
  for showSoftClipping bases; `features/read/buildSegments.ts` for skip-gap
  splitting. Sub-concerns are named `*X.ts` (drawBases, packBases) so they're
  visually distinct from the parent feature's main files.
- SVG-only feature half-template: `features/sashimi/{compute,computeOverlay}.ts`
  and `features/arcs/computeOverlay.ts`. No buildRegion / packGpu / drawCanvas
  — vector SVG paths are emitted directly by the overlay React component and
  by `renderSvg.tsx`. Use this shape when a feature is *intentionally* not on
  the GPU/Canvas2D pipeline (low element count, hover behavior native to
  SVG).

## Layering

`shared/` and `features/X/` must never import from
`LinearAlignmentsDisplay/components/`. The dependency direction is:

```
LinearAlignmentsDisplay → features/ → shared/ → shaders/
```

Worker→main upload payload shapes (`CigarUploadData`, `CoverageUploadData`,
`ModCoverageUploadData`, `ReadUploadData`) and the merged-interbase slicer
`interbaseRangeEnds` live in `shared/uploadTypes.ts` so per-feature folders
can type their inputs without reaching upward.

`Canvas2DRegionData` (the renderer's per-region cache, composed from each
feature's `*RegionFields`) and `RenderState` (per-frame state passed to draw
functions) stay in `LinearAlignmentsDisplay/components/rendererTypes.ts`
because they're inherently renderer-level concerns.

## Guiding rules

1. **Code independence over 100% DRY.** Trivial duplication is fine.
2. **Shared third space allowed.** When something is genuinely cross-feature
   (orchestrators, kind-discriminated shaders, merged arrays), keep it in
   `shared/` or a renderer-level file. The feature folder owns only what's
   feature-specific.
3. **Heuristics for "shared vs per-feature":**
   - Mentions more than one feature by name → shared
   - Could a new feature be added without modifying this code → per-feature
   - Loop over heterogeneous things → shared loop, per-feature body
4. **Stop after each substep.** Type-check, run tests, lint. If the diff
   doesn't feel like a clarity win, revert and reconsider.
5. **No premature classes-to-closures.** That's a separate refactor (see
   bottom).

## File template per feature folder

```
features/X/
  extract.ts        # emitX(mm, ctx, out) — called by shared dispatch loop
  buildArrays.ts    # buildXArrays — only if not using a shared merged array
  packGpu.ts        # packX, PASS_X, X_PASS descriptor; omit if pass is shared
  uploadGpu.ts      # uploadX(hal, idx, data) free function
  buildRegion.ts    # XRegionFields + buildXFields + emptyXFields
  drawCanvas.ts     # drawX(ctx, region, block, ...) for Canvas2D + SVG
  hitTest.ts        # hitTestX(resolved, coords, ...)
  types.ts          # XUploadData and any feature-only types
```

Shaders stay in `plugins/alignments/src/shaders/slang/` because they share
`alignmentsUniforms.slang` via slangc's `-I` include path. Treat the
`shaders/slang/` directory as a shared third space owned by the renderer.

---

## What landed (steps 2–4)

The CIGAR family, coverage family, and paired/read-shape features all moved
into `features/X/`. Lessons worth keeping:

**CIGAR family.** `shared/extractCigarFeatures.ts` is a single-pass dispatch
loop; each `mm.type` branch calls `emitX(mm, featureId, featureStart, ...,
output.gaps)`. Per-feature primitives are passed positionally — the loop
runs over thousands of features per region, so a per-call `ctx` object
allocation showed up in profiles (saved as auto-memory feedback).
`shared/buildInterbaseArrays.ts` allocates the merged (insertions, softclips,
hardclips) array; per-feature `buildRegion.ts` files slice via `subarray`
using `interbaseRangeEnds` from `shared/uploadTypes.ts`.

**Soft/hard clip kind-discriminated shader.** `shared/clipPass.ts` owns
`packClips`, `CLIP_PASS`, `hitTestClip`, and the `CLIP_KIND_*` constants —
both features render through one instanced draw with a per-instance kind.
Per-folder `buildRegion.ts` and `drawCanvas.ts` are nearly identical (only
the color and the slice range differ); the duplication is intentional and
matches the "code independence over DRY" rule.

**Coverage family.** `shared/runCoveragePipeline.ts` is the topological
orchestrator (`coverage` → `snpCoverage` / `noncov` / `modCoverage` →
`indicator` → packed buffers). Cross-feature dependencies cross the
orchestrator as parameters. **Critical rule**: if `features/snpCoverage/`
ever imports from `features/mismatch/`, that's a smell — the dep should flow
through the orchestrator.

**Paired/read-shape.** `arcs`, `linkedReads`, `connectingLines` are clean
folder-template features. `linkedReads/compute.ts` exports classifier
helpers (`classifyPair`, `groupReadsByName`, `filterEntries`) consumed by
`features/arcs/computeOverlay.ts` — this is the one allowed cross-feature
import path, because the helpers are genuinely the linkedRead feature's
contract and the arcs overlay needs the same classification.

**Read trunk.** `features/read/` owns `packGpu` (`PASS_READ`, `READ_PASS`,
`packReadSegments`), `uploadGpu` (HAL upload), `drawCanvas` (`drawReads`),
`hitTest` (`hitTestFeature`), and `buildSegments.ts` (skip-gap splitting,
formerly `features/segments/`). Read fields live directly on
`Canvas2DRegionData` — no `buildRegion.ts` because the trunk is the default
shape every feature attaches to. `LocalRegion` (the renderer's per-region
GPU-state cache) stays inside `GpuAlignmentsRenderer.ts` because it's
hybrid (read state + coverage state) and the renderer is the only writer.

**Hit-test composition.** `hitTestPipeline.ts` owns the priority chain
(indicator → coverage → modification → cigar → feature/chain).
`hitTestCigarItem` lives there, not in a feature folder, because it
encodes cross-feature priority (large insertion → mismatch → small
insertion → gap → softclip → hardclip). Per-feature `hitTest.ts` files
are pure leaf checks. `hitTesting.ts` retains only `hitTestChain` and
the `CigarHitResult` / `CigarItemType` / `ResolvedBlock` / `CigarCoords`
types — chain spans multiple reads via Flatbush, so it's orchestrator-
level, not feature-level.

---

## Step 5 — `Gpu/Canvas2DAlignmentsRenderer` to closures (deferred)

The two `*Renderer` classes are now thin shells: `Canvas2DAlignmentsRenderer`
holds a `regions` map + a CanvasRenderingContext2D and forwards to pure
`drawAlignmentBlocks`; `GpuAlignmentsRenderer` holds a HAL + UBO buffer and
threads them through pure `fillFrameUniforms`, `fillArcUniforms`,
`writePaletteToUbo`. Both implement `AlignmentsBackend` (`sync`,
`renderBlocks`, `dispose`).

Step 5 would replace the classes with closure factories:

```ts
export function createCanvas2DBackend(canvas): AlignmentsBackend { ... }
export function createGpuBackend(hal): AlignmentsBackend { ... }
```

Internal state (HAL, UBO, regions map) becomes captured locals in the factory
closure. The pure helpers already take their state via params, so the
mechanical refactor is straightforward. The motivation is consistency with
the per-feature pattern (free functions, no `this`) — but the classes are
already small enough that the refactor is low-value and high-churn.

**Defer until** there's a concrete second motivation (e.g. needing to
swap backends at runtime, or extracting a unit-testable helper from one of
the two `renderBlocks` bodies). At that point the closure shape will pay
for itself; doing it now is rearrangement for its own sake.

