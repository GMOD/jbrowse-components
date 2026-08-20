---
name: one-upload-model-not-four
description: The HAL keys every buffer one way and three modules above it still spell that key three ways, plus a fifth mechanism inside the HAL and eight displays hand-rolling the attach. The per-region dialect is gone (ADR-078); what is left is the global/keyed pair, the direct attaches, and retainRegion.
---

# One upload model instead of four

`packages/render-core/src/hal/regionRegistry.ts` keys every buffer by
`(regionKey, passId)`. That is the storage model, and there is exactly one of
it. Above it were four dialects for saying which of those entries to rewrite.
**One is gone**: `installPerRegionLifecycle` no longer runs an autorun per key,
it runs `createRegionUploadSync` under an encode step, so the per-region family
and the whole-map-computed family now diff the same way
([ADR-078](../architecture-decision-records/adr-078-one-upload-autorun-and-a-diff.md)).

| module | code lines | keyed by | status |
| --- | --- | --- | --- |
| `regionUploadSync.ts` | 28 | region index, via a reference diff | the one per-region diff |
| `installPerRegionLifecycle.ts` | 70 | — | encode + cache **over** that diff |
| `globalUploadSync.ts` | 19 | a slot name | open |
| `keyedUploadSync.ts` | 33 | a display key | open |

That collapse cost eight code lines, which is the honest measure of what it was
worth on its own. What it bought is that "which of these does my display want"
has one fewer answer, and that an encode's dependencies are a declaration the
helper memoizes rather than whatever the closure happened to touch.

## What is left

**The global/keyed pair.** Both are the same identity diff over a `Map`, and
they differ in the prune: `keyedUploadSync` deletes each departed key
individually because the keys belong to sibling displays, where an active-set
prune computed from one display's view would wipe the others. That is a real
difference and it is three lines. Whether one helper with a prune strategy beats
two helpers with a paragraph each is the open question, and the answer is not
obviously "one".

**Eight displays call `attachRenderingBackend` directly** rather than through a
helper — alignments, canvas `LinearBasicDisplay`, hic, LD, dotplot, the synteny
level, multi-sample variant, variant matrix. Each hand-rolls the same three
lines, and three of them hand-roll the "create the sync outside the callback"
rule that only a docstring states.

**`RegionRegistry.retainRegion` is a fifth mechanism**, living in the HAL, whose
docstring says it exists because the caller "cannot enumerate the passes it
writes". That is the same memo as `createRegionUploadSync`, one layer down,
reached because alignments hands over a whole-map payload instead of keyed slots.

**Half of the incidental defect is retired.** `installPerRegionLifecycle` no
longer registers an `addDisposer` before calling `attachRenderingBackend` (it has
no per-key autoruns to dispose), so a context-loss re-init no longer strands a
disposer on the node. It still allocates two `Map`s and a computed that the
second call's callbacks never use. An `attachRenderingBackend` that takes a setup
thunk invoked once fixes the cause for every caller, and retires the warning
three helper docstrings still repeat.

## Take the remaining three in this order

`attachRenderingBackend`'s setup thunk first — it is the one that touches all
eight direct callers and the three helpers at once, and it is what makes the
"build the closure outside the call" rule unnecessary rather than repeated. The
global/keyed merge is second and may end in "no". `retainRegion` is last and is
really a question about alignments' payload shape, not about the HAL.

The other two render-path simplifications are
[absolute-coordinates-for-hic-and-ld](absolute-coordinates-for-hic-and-ld.md) and
[one-mark-declaration-per-feature](one-mark-declaration-per-feature.md).

## Already declined nearby — do not re-derive

- **A scheduler on the render autorun** —
  [ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md#a-region-arrival-draws-twice-wherever-the-render-autorun-observes-the-data),
  A/B'd on real hardware, every column inside baseline spread. ADR-078 removed
  the arrival's *stale* draw without a scheduler; the surplus that A/B measured
  is mostly something else and is still unexplained.
- **Buffer pooling** — the one unclaimed item in `GPU_RENDERING.md`
  §"What this architecture deliberately does not have", correctly blocked on a
  measurement rather than a design.
- **Folding the comparative fetch onto `FetchMixin`** —
  [ADR-054](../architecture-decision-records/adr-054-comparative-displays-keep-their-own-fetch.md),
  four independent grounds. This proposal does not touch it.
- **A uniform slot token** — `ARCHITECTURAL_LIMITS.md` §"A uniform write binds
  to its draws by adjacency" already carries the retire-when, gated on a
  renderer wanting two uniform sets alive at once.
