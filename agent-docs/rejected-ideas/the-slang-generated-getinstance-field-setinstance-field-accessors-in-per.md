---
name: the-slang-generated-getinstance-field-setinstance-field-accessors-in-per
description: The Slang-generated `getInstance<Field>` / `setInstance<Field>` accessors in per-instance loops
area: performance-and-measurement
---

# The Slang-generated `getInstance<Field>` / `setInstance<Field>` accessors in per-instance loops

emitted, adopted across every coverage-band packer and
Canvas2D draw loop, measured, and reverted to inline indexing against the
generated per-view offset maps. They are the right shape on paper: each binds
its field to its own typed-array view, so `position` cannot be written through
the f32 view and a field whose Slang type changes fails to compile at the call
site rather than reinterpreting bits — the residual hole the
`INSTANCE_OFFSET_F32` / `_U32` split left open. They measured **0.43-0.47x on
the write side and 0.56-0.62x on the read side** against the hoisted-offset
inline form (`plugins/alignments/benches/instanceAccessors.bench.ts`, controls
0.98-1.06 across three runs, on 60k and 12k instance fixtures).

The cost is **the call, not the arithmetic**, which is what makes this a dead
end rather than a fixable one. The obvious diagnosis is that a per-field
accessor taking an instance INDEX recomputes `i * STRIDE` once per field where
the inline form hoists it once per instance — so the fix would be accessors
taking a hoisted word offset. That variant is the `offset` arm of the same
bench and measured **0.43x**, i.e. no better than the index-taking one. Don't
re-propose either shape for a loop that runs per instance.

**The obvious next move — generate the whole LOOP instead of the field access
— is only half right, and the half that works already existed.** Three
generated forms were measured against the same baseline, and what separates
them is calls-per-record, not how much of the loop is generated:

- `packInstances` (struct-of-arrays in, **zero** calls per record) — **0.99
  to 1.15x, free.** It is what `packModCovSegmentsForGpu` runs.
- `InstanceWriter.push` (**one** call per record) — **0.20-0.36x**, i.e.
  worse than the four bare accessors, because the method also reloads four
  `this.` views and tests capacity on every record.
- a generated `forEachInstance` (**one** callback per record, the read-side
  counterpart to `packInstances`) — **0.14-0.52x**. Written, measured,
  and not emitted.

So a caller that cannot hand `packInstances` one array per field — because it
scales on the way in, computes a field, or emits a variable number of records
— should write the loop over the generated offset maps, NOT reach for a
generated per-record form. `packCoverageBinsForGpu` (scales and computes),
`computeSNPCoverage` (one to five records per position) and
`computeInterbaseCoverage` (one to three records per bucket) are all that
case, and all are hand-written on purpose. The codegen's own header already says
this for `packInstances`; the addition is that no other generated shape is an
escape from it.

What survives is the emission: `//! layout-out` now writes the full typed
surface — `INSTANCE_STRIDE_*`, the per-view offset maps, `InstanceArrays`,
`packInstances` and the accessors — into packages that cannot import the
plugin owning the `.slang`, and the callers that are not per-record loops use
it (the two straight-interleave packers; the interbase hit test, which
resolves one position per mousemove; fixtures, which encode a record through
`packInstances` rather than by hand). The rule is the loop's iteration count,
not the module.

Beware the harness here: a first attempt at the same question dispatched its
arms through `arms[w](...)`, one shared call site, and reported a
byte-identical control at **0.31x** — trap #1 in `BENCHMARKING.md`, reproduced
exactly. The `coverage-bin-cap` fixture (262k instances) is also memory-bound
enough that its control swings 0.41-1.11 on a contended box; read the 60k and
12k rows.
