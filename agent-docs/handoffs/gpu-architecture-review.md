---
name: handoff-gpu-architecture-review
description: Three large simplifications the GPU render path is holding, found while reading ARCHITECTURE.md and GPU_RENDERING.md against the code. None is started. Each deletes a mechanism rather than adding one, and each makes a claim the v5 manuscript wants to make exceptionless — read this before re-deriving any of them.
---

# Handoff: the GPU architecture review

An end-to-end read of the render path — `ARCHITECTURE.md`, `GPU_RENDERING.md`,
`packages/render-core`, and all fourteen displays with wiggle traced through —
looking for abstractions that would *remove* machinery. **Nothing here is
started.** What this file holds is the three that survived checking, the
evidence already in tree for each, and the oracle each one can be verified
against.

They are ordered by size, not by priority; the order to take them is at the
bottom.

## Why now, and the shared criterion

The manuscript's strategy table makes four claims about this architecture. Two
are exceptionless and two are not, and each of the refactors below is the work
that removes a footnote:

| claim | today |
| --- | --- |
| Worker output is absolute genomic uint32 | **not HiC, not LD** — fetch-time pixel space |
| Pan and zoom are a redraw, not a refetch | **not HiC, not LD** — every pan refetches |
| Shaders are single-sourced across WebGPU and WebGL2 | holds ([ADR-005](../architecture-decision-records/adr-005-shader-codegen-slang.md)) |
| One display, one drawing definition | **holds nowhere** — a feature is written three times |

That is the criterion each proposal was held to: it has to delete a mechanism
*and* retire an exception, not merely tidy one.

## 1. The mark is the missing primitive

**The abstraction already exists, for exactly one feature.**
`plugins/alignments/src/features/arcs/mark.ts` is it. Read its header before
anything else here — it records two drift bugs (`98dd82120b` split the dome's Y
and updated two of three consumers; the hit test diverged from the paint one
commit earlier) and states the conclusion this proposal generalizes: *two
instances of one shape is a missing function, not two bugs.* Its consumers are
named there — the Canvas2D/SVG stroke, the hover highlight path, the hit test,
the debug overlay.

**The scale it has not been generalized to.** In `plugins/alignments/src/features/`
alone, 20 feature directories hold:

| file | count | lines |
| --- | --- | --- |
| `packGpu.ts` | 18 | 773 |
| `drawCanvas.ts` | 18 | 1459 |
| `hitTest.ts` | 10 | 1102 |

3,334 lines, and every one of them is a walk over the same per-feature arrays.

**`gap` is the smallest complete triple and the one to read.** All three files
walk `(gapPositions, gapYs, gapTypes, gapFrequencies)`, all three filter on
`gapTypes[i] === kind`, and all three apply one visibility gate. `drawCanvas.ts`
calls its copy "Twin of gap.slang's deletion branch". `hitTest.ts` carries a
paragraph explaining that its gate had to be *added*, because without it a
deletion the worker had zeroed went on intercepting every click across its span
— and notes `hitTestClip` was fixed for the same reason. So the content per
feature is one array schema, one selection predicate, one visibility gate and
one shape, written out three times.

**What holds them together today, and what does not.** GPU_RENDERING.md
§"Keeping the two backends in parity" lists four mechanisms plus the `SYNC:`
fallback, and `reference/CROSS_BACKEND_GATE.md` is the CI gate. Every one of
them is about GPU ↔ Canvas2D. **Nothing covers draw ↔ hit test**, which is why
that third copy's drift shows up as comments rather than as a failing gate.

**The shape.** A feature declares its mark once — arrays, predicate, gate,
shape. The packer and the hit test derive from the declaration. The Canvas2D
painter comes from a shape library of roughly ten marks (span rect, row rect,
line/segment, point glyph, capsule, triangle/indicator, chevron, diagonal cell,
bezier/dome, text) rather than from 18 feature directories. The shape library
has already started forming and its first three entries are in tree:
`packages/render-core/src/shaders/{pointGlyph,rowRect,diagonalGrid}.slang`, two
consumers each, admitted on the
[ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md)
bar.

**Two things it must not do**, both already settled and both easy to get wrong
on a first attempt:

- **It does not transpile a vertex or fragment stage.**
  [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  is right and stands; the shader stays hand-written, per *shape* rather than
  per feature.
- **It does not erase the intentional backend divergences.**
  `WIGGLE_FUDGE_FACTOR`, the variant-matrix `f2`, synteny's stroke-vs-fill swap
  are per-backend AA compensation, enumerated in GPU_RENDERING.md under
  "Intentional divergences". The load-bearing observation is that **each of them
  is a property of the shape, not of the feature** — which is what makes ten
  homes for them correct where 18 would not be.

**Oracle: it already exists.** `coverageParity.test.ts`,
`flatPaintOrder.test.ts`, `crossRegionFlatParity.test.ts`,
`qualityFadeParity.test.ts` and the rest of the per-feature parity suite pin the
current behavior. Convert one feature, run them unchanged. Most of them should
become structurally unnecessary afterwards, which is the result rather than a
side effect.

**For the manuscript** this is what upgrades the contribution from "we
single-source shaders across two GPU APIs" — a toolchain claim — to "a display
declares its marks once; the GPU pass, the Canvas2D and SVG painters, and the
hit test all derive from that declaration", which is a claim about the
architecture.

## 2. Absolute coordinates, with no exceptions

HiC sends `viewBlocks` (`calcViewBlocks(contentBlocks, offsetPx)`) plus
`bpPerPx` and records `setLastDrawnViewport(offsetPx, bpPerPx)` after committing
(`plugins/hic/src/LinearHicDisplay/model.ts`). Its worker output is, in
`renderTransform.ts`' own words, "fetch-time pixel space relative to the first
visible block's start". LD is the same shape.

**What that one decision is currently costing, all of it deletable:**

- `StaleViewportRescaleMixin`
  (`plugins/linear-genome-view/src/BaseLinearDisplay/models/`) — a cross-cutting
  mixin no other display composes.
- `renderTransform.ts` beside it — a correction consumed by the GPU render, the
  mouse hit test and the SVG export alike, three consumers of a transform that
  would otherwise be the identity.
- **One of the three staleness mechanisms.**
  `reference/ARCHITECTURAL_LIMITS.md` §"Three staleness mechanisms behind one
  name" lists spatial coverage, viewport snapshot and signature compare, and
  notes each has independently shipped a stale-capture bug. The viewport
  snapshot exists for these two displays and nothing else.
- **Two hand-written reversal mirrors.** `computeRenderTransform` is
  FORWARD-ONLY by construction — "one linear map can't express a reversed axis"
  — so orientation is baked worker-side twice, in `hic/regionOffsets.ts`'s
  `mirrorU` and `variants/RenderLDDataRPC/reversedRegions.ts`.
- A refetch on every pan and every zoom, on the display whose data volume argues
  hardest for the GPU in the first place.

**Why it looks tractable.** A Hi-C contact is `(bin1, bin2, count)` at a known
binsize — absolute genomic coordinates already — and `diagonalGrid.slang`
already owns the rotation. Moving the projection into the shader is the same
move that made pan-a-redraw true for the rest of the tree. LD's axis is SNP
index rather than bp, but every SNP carries an absolute position, so the same
applies with a position array beside the matrix.

**Unverified, and to check first**: whether the binsize decision can stay
viewport-derived (it reads `effectiveResolution`, which `CoreGetInfo` supplies)
while the *coordinates* go absolute. If it can, the fetch stops being
viewport-keyed and `isCacheValid` handles the resolution axis the way wiggle
handles BigWig zoom levels
([ADR-008](../architecture-decision-records/adr-008-wiggle-strict-bpperpx-equality.md)).
That is the load-bearing question for the whole item and it is one afternoon's
reading.

## 3. One upload model instead of four

**The HAL already has exactly one storage model.**
`packages/render-core/src/hal/regionRegistry.ts` keys every buffer by
`(regionKey, passId)`. Everything above it is four dialects for saying which of
those entries to rewrite:

| module | lines | keyed by |
| --- | --- | --- |
| `installPerRegionLifecycle.ts` | 180 | region index, via one autorun per key |
| `regionUploadSync.ts` | 59 | region index, via a reference diff |
| `globalUploadSync.ts` | 69 | a slot name |
| `keyedUploadSync.ts` | 84 | a display key |

392 lines, plus 8 displays that hand-roll `attachRenderingBackend` themselves
(alignments, canvas `LinearBasicDisplay`, hic, LD, dotplot, the synteny level,
multi-sample variant, variant matrix) against 5 call sites that go through the
helper. Plus `RegionRegistry.retainRegion` — a **fifth** mechanism, living in
the HAL, whose docstring says it exists because the caller "cannot enumerate the
passes it writes". That is the same memo as `createRegionUploadSync`, one layer
down, reached because alignments hands over a whole-map payload instead of keyed
slots.

**[ADR-017](../architecture-decision-records/adr-017-wiggle-per-key-autoruns.md)'s
premise has expired, and the ADR says so itself.** It chose per-key autoruns
because "the natural shape re-uploads all N entries", which was true of the
naive loop. Canvas has exactly the whole-map computed ADR-017 describes as
disqualifying and gets O(1) uploads per arrival anyway, because
`createIncrementalLayout` returns stable references and `createRegionUploadSync`
diffs on them. The ADR's own "Revisit if" names this trigger — "make
`computeLaidOutData` return stable per-key references" — and it fired in the
other direction, leaving two mechanisms doing one job with the choice between
them historical.

**Declaring the encode's inputs is the half that makes the collapse safe.**
`encode` becomes `(data, props) => Encoded` with no `self` in scope, and the
helper memoizes `props` once for every key. That is the same collapse
`serializeRpcProps` made on the fetch side — invalidate on what the props
*return*, never on what building them *reads* (ARCHITECTURE.md, "the cache key
is the return value, not the reads"). It also turns render-core's CLAUDE.md rule
— "an `encode` reads a narrow inputs getter, never the display's `renderState`"
— from prose into something that cannot be written. Every consumer already has
the signature: `buildSourceRenderData(data, gpuProps)` literally is it, and both
wiggle `renderSvg.tsx` files already hoist `model.gpuProps()` out of the region
loop while the on-screen path re-reads it per region.

**Oracle: it already exists.** `installPerRegionLifecycle.test.ts` pins the
upload-count contract in five tests (O(N) arrivals, encoder-dep re-fire, per-key
mutation, removal, backend swap). Reimplement the helper on the diff and run
that file unchanged. Green means the two mechanisms are interchangeable and one
can go; red names the property that actually distinguishes them, which is worth
knowing either way.

**One incidental defect the same change removes.**
`installPerRegionLifecycle` allocates two `Map`s and registers an `addDisposer`
*before* calling `attachRenderingBackend`, which returns early once installed.
`useRenderingBackend` calls `startRenderingBackend` again on every context-loss
re-init, so each recovery leaves a dead disposer and two dead maps on the node.
Harmless in size; it is the shape that makes "only the first call's callbacks
survive" invisible at the call site. An `attachRenderingBackend` that takes a
setup thunk invoked once fixes the cause, and retires the warning three helper
docstrings currently repeat.

## Order to take them

1. **§3**, first: smallest, the oracle is ready, and it removes the "which of
   four patterns" question from the new-display checklist in GPU_RENDERING.md.
2. **§2**, second: two contained display rewrites that delete a mixin, a
   transform module and a staleness axis. Answer the binsize question before
   starting.
3. **§1**, last and incrementally: one alignments feature at a time behind the
   parity suite, because it is the one that touches 46 files.

## Already declined — do not re-derive

Each of these was checked against this review and each has a standing reason:

- A scheduler on the render autorun —
  [ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md#a-region-arrival-draws-twice-wherever-the-render-autorun-observes-the-data),
  A/B'd on real hardware, every column inside baseline spread.
- Render graph, indirect draws, SSBOs, GPU-driven culling — GPU_RENDERING.md
  §"What this architecture deliberately does not have", one specific reason each.
- Buffer pooling — the one unclaimed item there, correctly blocked on a
  measurement rather than a design.
- Folding the comparative fetch onto `FetchMixin` —
  [ADR-054](../architecture-decision-records/adr-054-comparative-displays-keep-their-own-fetch.md),
  four independent grounds. §3 does not touch it.
- A uniform slot token — ARCHITECTURAL_LIMITS.md §"A uniform write binds to its
  draws by adjacency" already carries the retire-when, gated on a renderer
  wanting two uniform sets alive at once.

## When this lands

Delete this file. A refactor that becomes committed work moves to `TODO.md` in
the order to take it; one that gets parked moves to `ideas/`, one per file; a
decision against any of the three goes to `reference/REJECTED_IDEAS.md` with
what it was measured or costed against.
