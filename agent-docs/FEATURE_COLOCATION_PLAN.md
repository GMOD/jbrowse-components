# Feature colocation plan — alignments renderer

Reorganize the alignments renderer so each visual feature owns a folder
(`plugins/alignments/src/features/X/`) instead of being scattered across role-
organized files (renderer / processor / hit-test / shader). Editing a feature
becomes "edit one folder" instead of "edit ~6 files across 3 directories."

Step 1 (modification) is complete and committed. Step 1.5 (close type/shader
leaks, raise `shaders/` folder) is complete and committed. This doc covers
steps 2 onward.

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

## Step 2 — CIGAR family

Five features: `gap`, `mismatch`, `insertion`, `softclip`, `hardclip`.
Softclip-bases is a sub-concern of `softclip`.

### Stays in shared third space

- **`shared/extractCigarFeatures.ts`** (renamed from `extractMismatchData`):
  the single-pass dispatch loop. Each `else if (mm.type === ...)` branch
  becomes a call into the relevant feature's `emitX(mm, ctx, out)`.
- **`shared/buildInterbaseArrays.ts`**: the merged array allocator for
  insertion + softclip + hardclip. Stays shared because the merge IS the
  cross-feature infrastructure. Per-feature folders slice it.
- **`shared/clipPass.ts`** (new): `packClips`, `CLIP_PASS`, `CLIP_KIND_SOFT`,
  `CLIP_KIND_HARD`, `uploadClips(hal, idx, data)`. Soft and hard share this.
- **`shared/computeFrequenciesAndThresholds`** — already shared, no change.
- **`shaders/slang/*.slang`** — unchanged.
- **`ALIGNMENTS_PASSES`** order list in `GpuAlignmentsRenderer` — entries
  imported from feature folders, ordering is policy that lives at the
  renderer level.

### Substep order

Pick the simplest first to validate the per-feature emitter pattern, then
work up to the merged-array case.

#### 2a — `gap` (template validation)

Self-contained: own shader (`gap.slang`), own `buildGapArrays`, no shared
infrastructure. The smallest test for "does the per-feature `emitX` pattern
feel clean?"

Files to create:
- `features/gap/extract.ts` — `emitGap(mm, ctx, gapsData)` covering both
  deletion and skip cases (current `extractMismatchData` lines for
  `mm.type === 'deletion'` and `mm.type === 'skip'`)
- `features/gap/buildArrays.ts` — moves `buildGapArrays`
- `features/gap/packGpu.ts` — moves `packGaps`, `PASS_GAP`, `GAP_PASS`
- `features/gap/uploadGpu.ts`
- `features/gap/buildRegion.ts` — `GapRegionFields` (gapPositions/Ys/
  Types/Frequencies, numGaps), `buildGapFields`, `emptyGapFields`
- `features/gap/drawCanvas.ts` — moves `drawGaps`
- `features/gap/hitTest.ts` — `hitTestGap` extracted from
  `hitTestCigarItem`'s gap branch

Wire-up:
- Create `shared/extractCigarFeatures.ts` with the rename + dispatch shell.
  For now, only the gap branch dispatches to a feature folder; other
  branches still call old code in `processFeatureAlignments.ts`.
- `Canvas2DRegionData` adds `extends GapRegionFields`
- `ALIGNMENTS_PASSES` imports `GAP_PASS` from `features/gap/packGpu.ts`
- `hitTestPipeline.ts` calls `hitTestGap` directly; `hitTestCigarItem`
  keeps the rest of the priority chain temporarily

**Stop and assess.** If the `emitGap` pattern reads naturally and the diff
feels like a clarity win, continue. If not, revert and reconsider the
whole plan.

#### 2b — `mismatch`

Same shape as gap. Own shader (`mismatch.slang`) and arrays.

Cross-feature concern: `mismatchShader` is also aliased by softclip-bases
(handled in 2e). Ignore for now.

Files: same template as gap. `emitMismatch` for `mm.type === 'mismatch'`.

**Stop and assess.** Two features under the same template confirms it
generalizes.

#### 2c — `insertion`

First test of the merged-interbase-array third space.

Files:
- `features/insertion/extract.ts` — `emitInsertion(mm, ctx, insertionsData)`
- `features/insertion/packGpu.ts` — `packInsertions`, `PASS_INSERTION`,
  `INSERTION_PASS`
- `features/insertion/uploadGpu.ts`
- `features/insertion/buildRegion.ts` — `InsertionRegionFields`. Takes
  `CigarUploadData` + `insEnd` (already exposed via `interbaseRangeEnds`),
  returns the insertion slice via `subarray(0, insEnd)`
- `features/insertion/drawCanvas.ts` — moves `drawInsertions`
- `features/insertion/hitTest.ts` — exports two functions:
  `hitTestLargeInsertion` and `hitTestSmallInsertion`. The priority split
  goes to `hitTestPipeline.ts`, which calls each in its slot.

No `buildArrays.ts` — the merged build stays in
`shared/buildInterbaseArrays.ts`. The feature contributes the emit branch
and slices the result.

**Stop and assess.** Did the merged-array slice pattern feel right? If
features end up reaching across each other's slice boundaries, that's a
bad sign.

#### 2d — `softclip` + `hardclip` together

The shared-infra case. Both share `clipShader`, `packClips`, `PASS_CLIP`.
Done together because pulling them apart breaks the kind-discriminated pack.

Move shared infrastructure first:
- Create `shared/clipPass.ts`: `packClips`, `CLIP_PASS`, `CLIP_KIND_SOFT`,
  `CLIP_KIND_HARD`, `uploadClips(hal, idx, data)`
- Both features import these

Per-feature folders (`features/softclip/`, `features/hardclip/`):
- `extract.ts` — `emitSoftclip` / `emitHardclip` (the softclip emitter is
  more involved — produces `clipStart` and an optional `sequence` field for
  showSoftClipping mode)
- `buildRegion.ts` — slices the merged interbase array via
  `interbaseRangeEnds`. Each gets its slice.
- `drawCanvas.ts` — feature-specific color (calls existing `drawClips`
  helper or inlines the rectangle paint with the feature's color)
- `hitTest.ts` — `hitTestSoftclip` / `hitTestHardclip`

**No per-feature `packGpu.ts`** — pack is shared in `clipPass.ts`. This is
the canonical "third space holds shared infra, feature folders own only
what diverges" case. If both folders end up looking identical, the
abstraction is wrong; reconsider whether soft+hard should just be one
folder.

**Stop and assess.** The two-folders-sharing-infra case is the most
interesting test of the plan's principles. Does the third space feel
right, or contrived?

#### 2e — `softclip-bases` (sub-concern of softclip)

Lives inside `features/softclip/` since it's only a softclip thing.

Files added to `features/softclip/`:
- `packBases.ts` — `packSoftclipBases`, `SOFTCLIP_BASES_PASS` (uses
  `mismatchShader` from `shaders/slang/`)
- `uploadBases.ts`
- `drawBases.ts` — moves `drawSoftclipBases`
- `buildRegion.ts` — extends to include base-letter fields
  (softclipBasePositions/Ys/Bases, numSoftclipBases)

Note: `packBases.ts` imports `mismatchShader` directly from
`../../shaders/slang/mismatch.generated.ts` (NOT from `features/mismatch/`).
The shader is shared infrastructure; both features access via the shared
`shaders/` directory. The shader file is the third space; reaching across
feature folders is not.

#### 2f — Final cleanup

After all five features migrated:
- Delete `extractMismatchData` from `shared/processFeatureAlignments.ts`
  (replaced by `shared/extractCigarFeatures.ts`)
- Delete `buildGapArrays`, `buildMismatchArrays`, `buildSoftclipBaseArrays`
  from `shared/processFeatureAlignments.ts` (now in feature folders)
- Keep `buildInterbaseArrays` in shared (used by interbase trio)
- Delete the 5 buildXFields functions from `Canvas2DAlignmentsRenderer.ts`
- Delete the 5 drawX functions from `Canvas2DAlignmentsRenderer.ts`
- Delete `uploadCigar`, the 5 packs, the moved PASS_* ids from
  `GpuAlignmentsRenderer.ts`
- Delete `hitTestCigarItem` from `hitTesting.ts`
- Final `tsgo --noEmit`, `pnpm test`, `eslint --fix`

### Per-substep checklist

After each of 2a–2e:
- `npx tsgo --noEmit` clean
- `pnpm test` 33/33 suites passing
- `npx eslint --cache --fix` on touched files
- Subjective: did this feel like a net clarity win?

---

## Step 3 — Coverage family

Folders: `coverage`, `snpCoverage`, `modCoverage`, `noncov`, `indicator`.

`runCoveragePipeline.ts` is the third-space orchestrator. Already exists.
Already encodes the topological order:
1. mismatches/insertions/gaps extracted first
2. coverage depths computed
3. SNP segments need mismatches + coverage depths
4. mod cov segments need modifications + coverage depths
5. noncov segments need interbases + coverage depths
6. indicators derived from interbase data

Each coverage-family feature's folder owns its compute/pack/draw/hit; the
orchestrator passes mismatch / modification / interbase outputs as
parameters.

**Critical rule**: cross-feature dependencies happen at the orchestrator,
not via direct cross-folder imports. If `features/snpCoverage/` ever
imports from `features/mismatch/`, that's a smell — the dep should flow
through `runCoveragePipeline.ts` as a parameter.

### Per-feature folder shape

Same template as step 2. Each folder has:
- `compute.ts` (instead of `extract.ts`) — pure function taking inputs from
  the orchestrator, emitting the feature's typed arrays
- `packGpu.ts` — the shaders (snpCoverageShader, modCoverageShader,
  noncovHistogramShader, indicatorShader) all stay in `shaders/slang/`
- `uploadGpu.ts`
- `buildRegion.ts`
- `drawCanvas.ts`
- `hitTest.ts` (only `coverage` and `indicator` have hit tests)
- `types.ts` — `XUploadData`

### Substep order

3a `coverage` — base depth bins, simplest, no cross-feature deps
3b `snpCoverage` — first cross-feature dep (mismatches)
3c `modCoverage` — depends on modifications
3d `noncov` — depends on interbase data (insertion + softclip + hardclip)
3e `indicator` — derived from same interbase data
3f cleanup pass

**Stop and assess** after 3b. The orchestrator-mediated dep pattern is
either the right shape or it's not. If `runCoveragePipeline.ts` starts
ballooning with feature-specific glue, the abstraction isn't paying off.

---

## Step 4 — Paired-end / read-shape

Folders: `arcs`, `linkedReads`, `connectingLines`, `segments`.

These are mostly independent already — own shaders, own data, minimal
cross-feature concern. Likely the cleanest step. Save for last so the
template is well-validated.

### Notes per feature

- **`arcs`**: own arc shader + arcLine shader. Includes the samplot vs
  bezier mode dispatch (state.arcsYDomainBp vs autoscaled).
- **`linkedReads`**: covers both `linkedRead` mode (straight connecting
  lines between mate pairs in the same chain) and `linkedReadBezier` mode
  (bezier curves for aberrant pairs + straight lines for normal). Own
  shader (`linkedReadLine.slang`) + own connecting-line geometry.
- **`connectingLines`**: chain mode straight lines between supplementary
  alignments. Own shader.
- **`segments`**: read splitting at CIGAR `N` gaps for spliced alignments.
  Not really paired but it's a read-shape feature. Own arrays
  (`buildSegmentArrays`).

No new shared third-space infra needed for step 4 (each feature has its
own shader + data layout).

---

## Step 5 — Read (optional)

The read pass is the renderer's most central component. Probably leave it
un-foldered as the "trunk" rather than treat it as one feature among many.
Decide after step 4.

If migrated, the folder includes:
- `extract.ts` / `buildArrays.ts` — `buildReadFields`, `buildSegmentArrays`
- `packGpu.ts` — `packReadSegments`, `PASS_READ`
- `uploadGpu.ts` — `uploadReads`
- `buildRegion.ts` — read fields slice
- `drawCanvas.ts` — `drawReads`
- `hitTest.ts` — `hitTestFeature`, `hitTestChain`

---

## Out of scope for this plan

- **Class → closure refactor of renderers.** `Canvas2DAlignmentsRenderer`
  and `GpuAlignmentsRenderer` are state-bearing classes implementing
  `AlignmentsBackend`. A factory function returning `{sync, renderBlocks,
  dispose}` is a reasonable refactor. Trigger condition: if step 2's
  shared CIGAR infrastructure starts wanting to extend the renderer class
  or share class state, swap to closures then. Otherwise defer to its own
  pass after step 4.
- **Splitting `clip.slang` into two near-duplicate shaders.** Not doing.
  The kind-discriminator pays its keep — single ternary on a color
  uniform.
- **Moving `.slang` files into feature folders.** Tried in step 1.5,
  doesn't work — slangc's `import alignmentsUniforms;` resolves through
  the shared `-I` dir. The `shaders/slang/` directory is shared
  third-space infrastructure by build-script design.
- **Shared `drawClips` helper.** Currently used by both softclip and
  hardclip Canvas2D draw. Stays shared in step 2d. If both folders end
  up calling it, that's exactly the canonical "third space helper" usage.

---

## Stop conditions

The whole plan's value is contingent on each substep feeling like a
clarity win. Specific stop conditions:

- **After 2a (gap)**: if the `emitGap` pattern feels forced or the
  dispatch loop in `shared/extractCigarFeatures.ts` is doing all the
  work and the feature folder is a thin wrapper, abandon and treat
  modification as a one-off.
- **After 2d (softclip+hardclip)**: if the two folders end up looking
  identical except for color constants, the abstraction is wrong —
  consider collapsing to one folder.
- **After 3b (snpCoverage)**: if `runCoveragePipeline.ts` balloons with
  feature-specific glue, the orchestrator-mediated dep pattern isn't
  paying off.
- **Anywhere**: if a step diff feels mostly like moving without
  clarifying, stop.

Don't continue out of momentum.
