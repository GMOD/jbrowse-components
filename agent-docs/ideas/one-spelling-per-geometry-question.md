---
name: one-spelling-per-geometry-question
description: canvas2dUtils holds the forward bp→px mapper, the scale and the integer inverse, each shared because a second spelling agrees until it doesn't. Four geometry questions the hit tests and the global family ask have no such home — which region owns a pixel is copied four times, the fractional inverse three, the global family's canvas width has the getter on two of its four displays, and basePaintedAt declines to share its pivot for a dependency reason that expired.
---

# One spelling per geometry question

**Status: built, all four sections.** Each carries what the implementation found
where it differed from the proposal — read those before acting on the prose
around them.

`packages/render-core/src/canvas2dUtils.ts` is where a geometry number goes when
two paths have to agree on it, and each entry's docstring says what happened
before it existed: `makeBpMapper` (:447) and `makeCellLeftMapper` (:497) own the
reversed pivot the alignments pileup got wrong across all five of its cell
layers, `pxPerBpOf` (:491) exists because "a mark sized against it in a draw pass
and hit-tested against it in a component is two spellings of one number", and
`bpAtPx` (:596) carries an exact-rational oracle over 11.6M samples.

Four questions of the same kind have no entry.

## 1. Which region owns this pixel — four copies

```
plugins/canvas/src/LinearBasicDisplay/components/hitTesting.ts:223
plugins/wiggle/src/shared/wiggleHitTest.ts:150
plugins/variants/src/LinearMultiSampleVariantDisplay/components/VariantComponent.tsx:57
plugins/alignments/src/LinearAlignmentsDisplay/components/useAlignmentsBase.ts:153
```

All four are `px >= r.screenStartPx && px < r.screenEndPx`. All four are right.
The half-open upper bound is the whole content of the predicate and it is
explained in exactly one of them — canvas's, which records that adjacent regions
share a pixel (`regionA.screenEndPx === regionB.screenStartPx`), so an inclusive
bound lets the earlier region win and steal clicks meant for the later one.

Wiggle's copy is already generic (`hitTestMouse<R extends MouseRegion, D>`) and
already returns the region, its data and the bp.

**Built, and this paragraph used to call `hitTestMouse` "the extraction", which
was wrong.** The shared thing is the bare predicate, and the three non-wiggle
sites say so unanimously: alignments splits `visibleRegionAt` out precisely
*because* its arc band needs the region with no data map in scope
(`useAlignmentsBase.ts:147`), the variant display wants a **fractional** bp
rather than `hitTestMouse`'s `bpAtPx`, and canvas keys two maps off the match
behind a `?.feature` guard. What `hitTestMouse` adds is a single-data-map lookup,
which is exactly what none of them has. It stays wiggle's own composition and now
calls `regionAtPixel`.

## 2. The fractional pixel→bp inverse — three spellings

`bpAtPx` answers "which integer base is painted here". Nothing answers "what
fractional bp is here", which is what a search window or a distance test needs:

| | spelling |
| --- | --- |
| `plugins/alignments/src/LinearAlignmentsDisplay/components/hitTestPipeline.ts:325` | `frac * bpSpan`, added to `bpRange[0]` or subtracted from `bpRange[1]` |
| `plugins/variants/src/LinearMultiSampleVariantDisplay/components/variantHitTest.ts:48` | `frac * regionLengthBp`, same two branches |
| `plugins/gwas/src/LinearManhattanDisplay/findManhattanHit.ts:60` | `start + (screenEndPx - px) * bpPerPx` reversed, `start + (px - screenStartPx) * bpPerPx` forward |

**The gwas row anchors on `start` in BOTH branches**, which this table got wrong
by dropping the anchor. Algebraically it lands where the other two do; as
floating point it is a *third distinct spelling*, not a copy, and it is the one
whose value moves most — against an exact-rational BigInt oracle over 300,000
fractional-anchor samples the shared function returns a different double from
the gwas spelling on 289 of them and from the `frac` spelling on 114, by at most
7.5e-9 bp. Every one stays within 1 ulp of the exactly-rounded value, which is
what makes this a de-duplication rather than a fix.

**This is not a live bug.** Every consumer compares or measures a distance
rather than flooring, so the double rounding `bpAtPx`'s docstring argues against
does not reach a base index here. What it is instead: the reversed pivot,
written out three times, in a file set where the same pivot has already been got
backwards on the drawing side. `canvasXToGenomicPos` and `canvasXToBasePos` are
adjacent declarations in one file, computing the same quantity two ways — one
exact, one not — and the seven-line comment between them exists to say which to
use for what.

## 3. The global family's canvas width — two of four displays have the getter

`MultiRegionDisplayMixin.canvasWidthPx` is guarded by `no-restricted-syntax`
(`eslint.config.mjs:64`), with one file exempted, because four view getters
answer the width question plausibly and MAF had drifted onto the wrong one. The
rule bans reading `trackWidthPx`. It cannot see the global family, which wants
`totalWidthPx` / `totalWidthPxWithoutBorders` — the *content* width, a different
question and legitimately so.

Two of those displays declare the getter and say why, in near-identical
docstrings about the three consumers that have to be one number (the canvas
element's CSS size, the backing store, the SVG export's paint layer) — though
**the third consumer is not universal**: HiC's SVG body takes the export shell's
own `canvasWidth` prop, so its getter has two readers, not three.

- LD, `plugins/variants/src/LDDisplay/shared.ts:448`
- the variant matrix, `plugins/variants/src/LinearMultiSampleVariantMatrixDisplay/model.ts:89`

Two do not:

- HiC reads `lgv.totalWidthPx` twice — `plugins/hic/src/LinearHicDisplay/model.ts:413`
  for `renderState.canvasWidth`, `plugins/hic/src/LinearHicDisplay/components/ReactComponent.tsx:104`
  for the DOM width — and separately takes `totalWidthPxWithoutBorders` for its
  `triangleWidth`, so the display holds two content widths with no getter naming
  either.
- arc reads `view.totalWidthPx` at `plugins/arc/src/shared/ArcsContainer.tsx:44`
  and `plugins/arc/src/shared/renderArcSvg.tsx:39` — the on-screen and export
  halves of one number.

A `canvasWidth` getter on each is four lines, and it is the same getter the other
two already wrote.

## 4. `basePaintedAt` declines to share its pivot for a reason that expired

`packages/core/src/util/Base1DUtils.ts:153` implements the one-base pivot a
second time, and :151 says why: "The pivot is spelled out again here rather than
shared because core does not depend on render-core."

`packages/core/package.json:248` declares `"@jbrowse/render-core":
"workspace:^"`.

The arithmetic risk is low and should be stated as such: `pxToBp` walks
`displayedRegions`, whose bounds are whole bases, so the fractional-anchor case
`bpAtPx` was hardened for does not arise on that path. (Confirmed while
building: `diagonalizeRegions` spreads `...region` and flips only `reversed`, and
no other `setDisplayedRegions` path reshapes start or end.) What is left is a
comment citing a blocker that is not there — the class
`website/scripts/check-rename-archaeology.ts` was built for, one axis over.

**Built, and the answer is neither of the two this section offered.** "Share the
pivot or restate the reason" was a false pair; the outcome is *restate the
reason and pin the duplication with a test*.

Both blockers a reader would reach for are false. The declared one is:
`packages/core` declares `@jbrowse/render-core`, `tsconfig.build.esm.json:5`
already references it, and three core modules import it at runtime. The one this
doc's own review reached for next — that pulling a canvas module into core's
coordinate path would cost a worker bundle — is false too: `canvas2dUtils` has
exactly one import and it is a type import, no module-scope DOM, and it is
*already* in every RPC worker's graph through `plugins/canvas/src/index.ts` →
`labelPositioning.ts`, beside a `Base1DUtils` that genuinely executes in a worker
via `RenderLDData` → `ldLayout.ts`. The
[barrels-block-extraction](barrels-block-extraction.md) cost of the import is
nil.

**What kills the share is that there is no shared call to make.**
`bpAtPx(px, bounds)` takes a screen pixel plus a px→bp projection and is mostly
about that projection's float behaviour; `basePaintedAt(r, offsetBp)` takes an
offset already in bp. Feeding `bpAtPx` synthetic bounds to fake a projection
computes `(offsetBp * span) / span`, which is not exactly `offsetBp` at genome
scale: over a 3,000,000-sample boundary sweep it named the wrong base 6,885
times, every one of them on a 248,956,422 bp region (1.9% of that span's
samples) and none at or below 133,797,422. A regression, bought with a
de-duplication. What is genuinely common is two lines, and only render-core could
hold them — which would put a pixel-free function downstream of the renderer and
split it from its forward twin `bpOffsetInRegion`, eleven lines up in its own
file.

So the duplication stays and becomes *checked*: a parity block in
`Base1DUtils.test.ts` drives both production paths and asserts they agree, which
is what neither option above would have bought. **A pivot gate has to sample base
BOUNDARIES**: `Math.ceil(x) - 1` and `Math.floor(x)` part company only where `x`
is whole, so a first draft over cell interiors stayed green through both
sabotages. Sampling boundaries in turn needs geometries where both paths land on
one exactly — `pxToBp` forms `px * bpPerPx`, `bpAtPx` forms `px * span / width` —
so the boundary block uses power-of-two `bpPerPx` and a second block sweeps
interiors on the fractional geometries a real view produces.

## Why none of this is visible

Every one of the four is a number that agrees with its other spellings today.
That is the condition the `trackWidthPx` rule was written under, in the message
it prints: "the two agree today, so a second spelling is silent until one of them
moves."

## The shape

Two additions to `canvas2dUtils.ts`, beside the twins they belong with:

```ts
regionAtPixel(regions, px)   // the half-open bound, stated once
bpAtPxExact(px, bounds)      // the fractional twin of bpAtPx, multiply-before-divide
```

Then wiggle's `hitTestMouse` keeps its data-map lookup and calls the first
rather than inlining it, and the three fractional spellings call the second.

Item 3 needs nothing from render-core — four lines on each of two displays,
copied off the two that already have it. Item 4 is a decision rather than an
edit: share the pivot now that the dependency edge exists, or restate the
comment as the choice it now is.

**`bpAtPxExact` must not become `bpAtPx`'s implementation.** `bpAtPx` splits its
anchor into whole and remainder specifically so the genome-scale addend never
enters the rounded expression, and its measured miss rate depends on that; a
fractional version has no rounding to protect and wants the plain form. Two
functions, one file, adjacent docstrings.

## Where this sits

Smallest item in the set and the one that gets more expensive with time — a
fifth copy of either predicate is written the next time a display grows a hit
test.

It is also the incremental on-ramp to
[one-mark-declaration-per-feature](one-mark-declaration-per-feature.md), whose
subject is the same drift one level up: a feature written three times, with
nothing gating draw against hit test the way CI gates GPU against Canvas2D. The
generalizable half of that idea is already in tree as `variantCellSpanPx`
(`plugins/variants/src/LinearMultiSampleVariantDisplay/components/variantCellSpan.ts`)
— one span function whose four consumers are the shader, the Canvas2D painter,
the hover box and the click target — and it can be applied per display without
the 46-file refactor.

## Already declined nearby — do not re-derive

- **Region-too-large gate in render-core** —
  [ADR-045](../architecture-decision-records/adr-045-region-too-large-gate-stays-in-lgv-plugin.md).
  Moving LGV *policy* into render-core is what that declines; the two functions
  above are geometry with no view or model in scope, which is what the package
  already holds.
- **A `genomeQuad` vertex helper on surface similarity** —
  [ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md).
  The bar it sets is two real consumers with a live drift hazard. Both additions
  clear it at three and four.
- **`SYNC:` comments as the answer.**
  [GPU_RENDERING.md](../reference/GPU_RENDERING.md#keeping-the-two-backends-in-parity)
  says the tag means an UNSHARED duplication and only that, and that nearly half
  the registry once spent it on things that could not drift. All four here can
  drift and all four can be shared, so none of them wants a tag.
