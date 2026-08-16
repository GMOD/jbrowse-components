---
name: draw-pass-registries
description: The layer-registry technique alignments uses for its draw passes — a shared ordered id list plus an exhaustive Record per consumer — decomposed into the four mechanisms it is really made of, with the precondition that decides whether a display wants one and a scorecard of every display against it. Read before adding a mark to a multi-mark display, before proposing a registry for one, and before declining a registry on the grounds that the backends are "not 1:1".
---

# Draw-pass registries

`plugins/alignments` resolves 23 GPU passes, two Canvas2D painters, an SVG
export and nine hit tests off a handful of shared id lists. That reads as one
technique. It is four, and they generalize very differently — three are already
shared infrastructure, one is a judgement call that most displays should answer
"no" to.

## The four mechanisms

**1. `InstancePass` — the pass descriptor and its packer, fused.**
`packages/render-core/src/instancePass.ts`. A pass id, the packer that fills its
buffer, and the upload joining them are three statements of one fact; separately
held, a pass can register and draw while nothing uploads to it, which paints
nothing, silently, on the GPU backend only. **Fully general — use it.**

**2. The upload loop derived from a pass array.**
`GpuPerRegionRenderingBackend.uploadRegion` walks `regionPasses` and lets
`uploadPass` read each instance count off the bytes the packer allocated, so the
count is never a second expression free to disagree. **Fully general.**
Alignments is the one renderer that doesn't inherit it, because bands and
sections make it extend `GpuRenderingBackendBase` directly.

**3. The id registry.** A shared ordered list carrying z-order and, where the
marks are settings-gated, an `enabled(state)` — `PILEUP_LAYERS`,
`COVERAGE_LAYERS`, `GLYPH_LAYERS` — resolved by an exhaustive
`Record<LayerId, …>` per consumer, and with pass registration derived from the
registry rather than re-listed. **Conditional; see the precondition below.**

**4. `HIT_GATES`.** A second exhaustive record over the same ids forcing every
drawn layer to state a hit-testing story, checked against each layer's actual
`enabled` behaviour rather than its word (`hitTestGateParity.test.ts`).
**Alignments-only today for want of a second display with independently gated
marks — and the most transferable idea here.**

## A registry is two maps over one list, never a table of uniform rows

The 2026-06 decline of this idea (`REJECTED_IDEAS.md`) read: the layers aren't
1:1 across backends, so uniform rows need shims that add back what the table
removes. Every clause was true and none was the question. The list is shared;
each backend's `Record` resolves an id to whatever that backend needs, including
two calls, a shim, or nothing.

**Read a "not 1:1" claim as naming the layer it is true at.** It argues against
collapsing the CALLS. It says nothing about sharing the LIST, and the list is
where drift costs correctness: a coverage pass added to the GPU registry
compiled clean and vanished from Canvas2D and the SVG export for the two months
that decline stood.

## The precondition

A registry earns its keep when all four hold:

1. **Three or more marks** in one band.
2. **The order matters** — they overlap, so z-order is a real decision.
3. **Two or more independent consumers** resolve the ids: backends, a hit test,
   a layout height, an export.
4. Ideally, **each mark is independently gated**. Without this the `enabled`
   column is a row of `() => true`s, and the registry is buying (1)–(3) only.

Fail 1 or 2 and there is no list. Fail 3 and there is nothing to drift against.

## Scorecard

| Display | Marks | Ordered | Per-mark gate | Consumers | Verdict |
| --- | --- | --- | --- | --- | --- |
| alignments pileup | 13 | yes | yes | GPU, Canvas2D, hit (+SVG free) | `PILEUP_LAYERS` |
| alignments coverage | 5 | yes | yes | GPU, Canvas2D | `COVERAGE_LAYERS` |
| alignments arcs | 4 | yes | band-level only | GPU, `drawArcs` | list + `flatPaintOrder.test.ts` |
| alignments SVG overlays | 3 | yes | upstream geometry | overlay, `*Svg` export | order stated twice, below threshold |
| canvas `LinearBasicDisplay` | 4 | yes | no | GPU, Canvas2D, SVG | `GLYPH_LAYERS`, no gate column |
| sequence rows | 3 kinds | yes | yes | painter, hover, height | `rowLayout` |
| wiggle | 3 | mode-exclusive | n/a | GPU, Canvas2D | no |
| synteny | 4 | 2x2 mode grid | no | GPU | no |
| dotplot, hic, maf, gwas, LD, variants x2, multi-row | 1-2 | — | — | 1 | no |

## The list does not have to be a GPU pass list

Two of the three registries in tree aren't. `rowLayout`
(`plugins/sequence/.../sequenceGeometry.ts`) arrived independently and is the
more general shape:

- **It is a function of state.** `reversed` reorders the stack, so the list is
  computed rather than constant — something `PILEUP_LAYERS` cannot express.
- **One consumer is layout height, not a backend.** `rowCount` is
  `rowLayout(...).length`, so the model's height, the painter's loop and the
  hover's mouse-y lookup index one list. The count used to be a third encoding,
  as arithmetic.

So the rule is about **an ordered, gated set of marks resolved by more than one
consumer**, whatever the draw mechanism. Not about GPU passes.

## Where it stops

`ideas/canvas-glyph-system.md` rejects a `Record<GlyphType, {layout, emit}>`
registry for the canvas plugin's glyphs, and those grounds hold. They are a
different argument, worth keeping distinct: that one is about **co-locating two
phases** across a real one-way layer boundary (`glyphs/` imports zero rendering
helpers), and it fails the precondition at (3) — detection is centralized in
`findGlyph` regardless, because glyph precedence is a statement *between*
glyphs. Sharing a list and co-locating phases are separate proposals.
