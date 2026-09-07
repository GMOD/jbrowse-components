---
name: a-generated-packer-for-the-sources-packinstances-cannot-take-the
description: A generated packer for the sources `packInstances` cannot take — the per-field descriptor object, and the `//! pack-group:` directive that would have replaced it
area: performance-and-measurement
---

# A generated packer for the sources `packInstances` cannot take — the per-field descriptor object, and the `//! pack-group:` directive that would have replaced it

designed, benched against the read pass's own hand loop,
and declined on the gain rather than on the mechanism
(`plugins/alignments/benches/instancePackDescriptor.bench.ts`, controls
0.99-1.04 over 12k / 60k / 200k segments, one process per fixture).

The entry above says a caller that cannot hand `packInstances` one array per
field should write its own loop. `packReadSegments` is the largest such caller
— an instance is a segment, 8 of its 11 fields are per READ and arrive as
`readYs[segmentReadIndices[j]]`, and `startOff`/`endOff` are lanes of one
interleaved array. Those are not computations, they are *indexing*, so the
blanket claim that no generated form can absorb them is **wrong**, and this is
the correction: a generated form with no call, only hoisted parameters, can.
What decides it is whether the grouping is STATIC.

- a declared **group** — one index hoisted once per record and reused by every
  field in the group, exactly as the hand loop hoists `ri` — is **1.00-1.37x**.
  The emitted loop *is* the hand loop.
- a **per-field index array**, no affine at all, is **0.72x**. This is the
  whole finding: eleven index loads a record where the hand loop does one.
- per-field index **plus `* scale + bias`** is **0.52x**, and plus a runtime
  `* stride + offset` **0.41x** — both push the index and the value off V8's
  Smi path.
- a per-field **`index ? src[index[i]] : src[i]`** branch is **0.20x**, the
  worst arm measured, worse than four bare accessors.
- **materializing** the 8 per-read columns and calling the real
  `packInstances` on them is **0.27x**.

So the descriptor object in every form is dead, and a declared group is free.
The directive was still declined: at 60k segments — a typical pileup — the
generated group form is 0.630ms against 0.632ms, and the entire win is ~1.3ms
at 200k, on a pack that runs on layout change and recolor, not per frame. The
prize was never speed. It is that `packInstances` type-checks COMPLETENESS and
a hand loop does not — add a field to `read.slang` and the hand loop ships it
as silent zeroes — and a directive buys that for ONE packer while the other
thirteen, which fail for computed fields and variable record counts, still
need whatever the generic answer turns out to be. Re-propose the directive
only alongside that generic answer, not instead of it.

Two things fell out that are not about codegen at all:

- **`u32[o + F_U32.startOff]` costs 1.21-1.26x against `u32[o + 0]`** at 200k
  instances. V8 does not fold the property load on the imported offset map, so
  every hand-written packer in the tree pays eleven of them per record.
  Destructuring the offset maps into locals before the loop recovers most of it
  (**1.16-1.19x**) while hardcoding no offset, so nothing can drift. It is
  1.00x at 60k and 12k, i.e. worth ~0.8ms on the deepest pileup only, which is
  why no packer was changed — but it is the cheap half of this whole question
  and wants no new machinery at all.
- **two partial passes over an 8.8 MB destination beat one pass** doing the
  same stores, **2.36-2.44x**, reproducibly, with a clean control — while the
  same arm is 0.91-0.95x at 60k and 12k, which is the cost walking the buffer
  twice *should* have. The mechanism is not understood; something about the
  single pass's ~10 concurrent read streams degrades past L2. Do not act on it
  without finding the mechanism, and do not delete the arm.
