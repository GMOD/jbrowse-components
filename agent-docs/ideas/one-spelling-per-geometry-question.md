---
name: one-spelling-per-geometry-question
description: canvas2dUtils holds the forward bp→px mapper, the scale and the integer inverse, each shared because a second spelling agrees until it doesn't. Four geometry questions the hit tests and the global family ask have no such home — which region owns a pixel is copied four times, the fractional inverse three, the global family's canvas width has the getter on two of its four displays, and basePaintedAt declines to share its pivot for a dependency reason that expired.
---

# One spelling per geometry question

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
already returns the region, its data and the bp — it is the extraction, sitting
in a plugin with three in-plugin callers.

## 2. The fractional pixel→bp inverse — three spellings

`bpAtPx` answers "which integer base is painted here". Nothing answers "what
fractional bp is here", which is what a search window or a distance test needs:

| | spelling |
| --- | --- |
| `plugins/alignments/src/LinearAlignmentsDisplay/components/hitTestPipeline.ts:325` | `frac * bpSpan`, added to `bpRange[0]` or subtracted from `bpRange[1]` |
| `plugins/variants/src/LinearMultiSampleVariantDisplay/components/variantHitTest.ts:48` | `frac * regionLengthBp`, same two branches |
| `plugins/gwas/src/LinearManhattanDisplay/findManhattanHit.ts:60` | `(screenEndPx - mouseX) * bpPerPx` / `(mouseX - screenStartPx) * bpPerPx` |

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
element's CSS size, the backing store, the SVG export's paint layer):

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
`bpAtPx` was hardened for does not arise on that path. What is left is a comment
citing a blocker that is not there — the class
`website/scripts/check-rename-archaeology.ts` was built for, one axis over.
Either share the pivot or restate the reason as the choice it now is.

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
