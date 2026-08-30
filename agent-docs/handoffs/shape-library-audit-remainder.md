---
name: shape-library-audit-remainder
description: What the 2026-08-29 eight-way audit of the shader/shape library and the surrounding 100 commits found and nobody has committed to yet — two subagent branches whose work was never read back, six confirmed defects with file:line and a failure scenario each, and one colour unification that is a judgement call because it moves rendered output. Waiting on someone to pick the branches up or re-derive them, and on a decision about the synteny viridis.
---

# Shape-library audit: the remainder

Eight agents audited `packages/render-core/src/shaders/` and the other subsystems
that moved in the 100 commits ending `6fea41ab4d`. Twelve commits landed on
`shape-library-audit-fixes` and are described by their own messages; this file is
only what did **not** land.

## Two branches nobody read back

Both were launched from `origin/main` at `6fea41ab4d` and were still running when
the session ran out of budget. **Neither has been reviewed, and neither is
merged.** Check `git branch --list` for them before re-deriving anything.

| worktree / branch | subject |
| --- | --- |
| `prune-type-walk` | the type-directed session walk below |
| `synteny-mate-nav-fixes` | the off-screen mate findings below |

If the branches exist and look sound, they still need `pnpm test-related` — the
path-scoped runs do not reach the jbrowse-web suites, and this audit's own band
fix was caught there and nowhere else (see "what the module-graph run caught").

## Confirmed defects, ranked

Each was traced to file:line by an agent; the first two were re-verified by hand.

### 1. A synteny session defeats the plugin-hold entirely

`packages/product-core/src/pruneUnbuildableNodes.ts` — `pruneView` reads exactly
`view.tracks` and `view.views`. `LinearComparativeView` keeps its tracks under
`levels[].tracks` (`plugins/linear-comparative-view/src/LinearComparativeView/model.ts:133`
→ `LinearSyntenyViewHelper/stateModelFactory.ts:72`), and `admit` short-circuits
on the registered *view* name, so the union never inspects the subtree.

With the synteny track type unregistered, pruning returns `dropped: []` and the
snapshot unchanged, and `Session.create` then throws — the exact failure the
module exists to prevent, on the route its docstring names.
`Session/Connections.ts:36` (`connectionInstances`) is the same class, lower
severity because `finalizeSession` strips it on the way out.

**Do not fix by adding `levels` to `pruneView`.** There are ten
`pluggableMstType` declaration sites and the walk knows four fields; the next
container gets forgotten the same way. The schema is already written down as the
MST type, and `BaseRootModelFactory` takes `sessionModelType: IAnyType`, so a
type-directed walk is reachable from the call site.

### 2. A held widget is destroyed on restore

Same file, ~line 428. `widgets` is `types.stripDefault(types.map(...), {})`, so
**MST omits the key once the map is empty**. The restore builds a local `widgets`
object, writes the restored widget into it, drops the entry from `stillHeld`, and
then discards the object because `snapshot.widgets` is absent. A session whose
only widget was the unbuildable one loses it from both places. Line ~429 has the
identical shape for `views`.

Findings 1 and 2 are each a divergence between the module's two hand-written
encodings of one schema — the prune walk and `Anchors` — which is why the fix is
the walk and not two patches.

### 3. The off-screen-mate ADD branch can throw out of a pointer handler

`plugins/linear-comparative-view/src/LinearSyntenyViewHelper/stateModelFactory.ts:555-567`.
`region` is the assembly's whole-contig region, so `navSpan` clamps to that and
not to what the row displays; when the contig is already shown, nothing is
appended and the window can fall outside every displayed region, where
`resolveNavEndpoint` throws. `LevelSyntenyCanvas.tsx:265-269` calls it straight
from `handlePointerUp`, and `setDisplayedRegions` has already run.
`LinearSyntenyDisplay/moveMatchingPanel.ts:86-91` wraps the identical call in
try/catch.

### 4. The fit ladder drops the isoform count when labels are off

`plugins/canvas/src/LinearBasicDisplay/fitLadderViews.ts:378-387` — the
`!showLabels` branch of `fitBodiesOnlyLayout` resolves to `fitLabelsOnlyLayout`,
whose inputs never carry `maxIsoformsPerGene`; `:370-372` has the same hole.
Reachable in fit mode with `showLabels: 'none'`, `displayMode: 'collapsed'`, or
the auto density gate above 0.2/px — which is exactly when stacks are deep.
`resolveFitLadder` still reports `maxIsoforms`, so the tooltip and
`geneGlyphTrimmedGenes` claim a trim over a layout that drew every transcript.
Every fit-ladder case in tree runs with `showLabels: true`.

### 5. `computeArcBand` still re-combines the pair the fold owns

`plugins/alignments/src/LinearAlignmentsDisplay/renderers/rendererTypes.ts:248` —
`const covH = state.showCoverage ? state.coverageHeight : 0`, with `ArcBandInput`
carrying the flag beside the raw height. This is `reservedPx` open-coded, and the
one surviving re-combination in the three converted displays. It became reachable
when the coverage band gained `bounds`: `computeStackedSections` already has the
reserve in hand and can pass the resolved number.

`plugins/variants/src/LDDisplay/shared.ts:460-466` (`effectiveLineZoneHeight`) is
a fourth hand-rolled `reservedPx`, and the caller that would make that export
earn its keep — it currently has none.

### 6. `depthScale` is a round trip that can produce NaN

`packages/render-core/src/shaders/coverageBand.slang:214` —
`relDepth * u.depthScale * u.depthDomainMax`, where `depthScale` is
`regionMaxDepth / domainMax`. The domain cancels algebraically. `hasCoverageScale`
passes a `maxScore: 0`, so `getNiceDomain` can hand back `domainMax === 0`,
`depthScale` is `Infinity`, and the product is NaN — reaching `clamp(NaN, 0, 1)`,
unspecified in WGSL, on the `minScore < 0` linear arm. Canvas2D computes
`relDepth * regionMaxDepth` and draws every bar full height. Carrying
`regionMaxDepth` as the uniform removes both the divergence and the round trip;
it is `depthScale`'s only remaining use site.

Related, same file: `covYOffset` is a GPU-only degree of freedom. Its Canvas2D
twin `coverageBandBox.ts:20-25` hardcodes `YSCALEBAR_LABEL_OFFSET` (5), and
`interbaseBarHeightPx` is computed on the CPU through that constant while the
bars beside it use the uniform — so any non-5 value splits the band against
itself within one GPU frame. `coverageParity.test.ts:351` sets it to 5 to make
the two agree.

## One decision, not a defect

`packages/synteny-core/src/colorRamps.ts:46` carries a **second viridis** — ten
stops interpolated, against `@jbrowse/core/util/colorRamp`'s full 256. The ten
values are exact entries of the core table, so this is precisely the
"interpolation over a subset" that spec exists to prevent; 94% of `t` values
differ, max 16 channel units at `t = 0.9471`. `synteny-core` already depends on
`@jbrowse/core`, and there are two real consumers
(`dotplot-view/.../dotplotColors.ts:33`,
`linear-comparative-view/.../syntenyColors.ts:113`).

Unifying it **moves rendered dotplot and synteny colours** and changes bytes
pinned in `dotplotColors.test.ts:74,77`, so it needs golden refreshes and is a
call about whether the corrected colours are wanted, not a silent fix. Left
alone deliberately.

## What the module-graph run caught, and why it matters here

`pnpm test-related` failed four suites the path-scoped runs pass. One was a real
defect in the audit's own fix, not a stale golden: the new band ceiling reserved
`MIN_BAND_HEIGHT` of pileup unconditionally, and the two failing goldens were
`volvox_bam_snpcoverage` and `volvox_cram_snpcoverage` — coverage-only tracks
that legitimately want the band to be the whole height. Refreshing the golden
would have shipped a shorter coverage band on every SNP-coverage track.

Anything picked up from this file gets the same treatment: bisect a moved golden
before refreshing it.

## Audited and found correct

Recorded so nobody re-derives it. The frame/coverage split really is what
`linkedReadLine`'s generated WGSL and GLSL do; `arc.slang`'s tangent guard is
genuinely separate from `capsuleFrame`; `scoreScale`'s three importers and their
degenerate-domain answers agree; all 27 `CoverageBandUniforms` fields are read by
at least one of the five passes and all five entry points are forced rather than
chosen; the five coverage packers really are one-line re-exports; the `point`
mark's centred bar and its tolerance are orientation-free by construction; held
nodes survive `getSnapshot` → JSON → `create` byte-identically and reach every
persistence path; and `3e39fd6462` left no dangling reference to the ABI removals
baseline.
