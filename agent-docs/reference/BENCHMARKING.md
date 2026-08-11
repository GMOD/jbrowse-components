---
name: benchmarking
description: How to build a benchmark whose number is real, and the catalogue of traps that have produced fake ones in this repo — each with the bogus figure it actually reported. Read before writing a bench or quoting a speedup.
---

# Benchmarking, and the traps that fake it

Every number in this file is one a benchmark in this repo actually reported
before someone noticed it was wrong. That is the point of the catalogue: these
are not hypothetical failure modes, they are the ones that got as far as being
believed.

The through-line is that **a bad harness does not produce noise, it produces a
confident wrong answer**. Noise you would distrust. A clean 1.31x with a tidy
standard deviation you would not, and several of the entries below are exactly
that.

## The shape of a bench you can believe

Four things, and none of them is decoration.

**Interleave the arms, round-robin, in one process.** Not one arm then the
other, and not two processes. Any drift in machine state — another agent's
typecheck starting, a laptop coming off AC — lands entirely on whichever arm ran
second.

**Report the MIN across rounds, not the mean.** Interference only ever makes
things slower, so the minimum is the closest thing to an uncontended sample.
Absolute times still drift 2x between runs on a shared box; the within-run
ratio does not.

**Run a control.** A third arm that is the *same code as the baseline* —
extracted twice, or declared twice — separately loaded and separately
optimized. Whatever it scores is what your harness could resolve at that moment,
and any ratio you want to claim has to clear it. **A row whose control is far
from 1.00 measured nothing.** This is the single highest-value item here: most
of the catalogue below was caught by a control coming back wrong, and would
have shipped without one.

**Check identity before you believe timing.** A faster implementation that emits
different output is not a faster implementation. Compare every field both sides
emit, describe the first difference rather than just flagging it, and fail the
run unless the caller passes something like `--allow-diff` to say the change was
deliberate.

## The trap catalogue

### JIT and shape

**One shared driver across arms.** If the same function calls into both
implementations, its call site goes polymorphic and every arm pays for it.
Reported a **byte-identical control at 1.14x**. Write the drivers out longhand,
one per arm, and say in a comment that the duplication is deliberate.

**Sharing driver SOURCE is enough to do it too.** Three `new Function` calls
with identical source text hit V8's compilation cache and come back sharing a
feedback vector, which silently restores the megamorphism separate drivers were
meant to prevent. Put the control back at **~1.3x**, and no amount of
interleaving or rotation moved it. Separate function *literals* is what actually
gives separate inline caches.

**Asymmetric warmup between arms.** An identity-check pass run over only some of
the arms leaves the others' call sites monomorphic while the checked ones have
gone polymorphic. The unchecked control "won" by 39% — **a 0.61x control**. Warm
every arm the same way.

**Direct call vs call-through-parameter.** An arm that calls an imported
function directly can be inlined; one reached through a parameter often cannot.
That is a structural advantage unrelated to either implementation. Pass all arms
in the same way.

**Running arms in blocks lets the second inherit the first's warmup.** Flipped
one case from **1.375x to 0.954x** on its own. This is the interleaving rule
again, from the other direction.

### Measuring the wrong thing

**Setup inside the timed region.** Packing a 50kb reference *inside* the timed
loop measured `packReference`, not the walk under test, on a 260-read set —
handing a byte-identical control **2.0x**. Hoist anything the real caller does
once per region out of the per-call timing.

**Too few rounds against a warming cache.** At 3 rounds a workload measured
**0.74x — the worker pool apparently making it slower**. The same workload at 6
rounds is 1.46x, because the HTTP cache needs several rounds to plateau and the
early ones are 2-3x slower than steady state. A min over a series that has not
plateaued is not a min of anything. Watch the spread: `5418, 4506, 2263` in one
3-round run gives it away.

**A degenerate microbench.** A pure-allocation microbench claimed **5.2x** for
removing two throwaway objects per record. The same change on a real 300x BAM
measured **1.013x**. Microbenches are for finding a mechanism, never for sizing
one.

**A baseline that is silently doing less work.** Unwrapping features to build a
comparison left `ref` undefined, and the walk then skipped mismatch detection
entirely. That comparison reported **10x** and was meaningless. If an arm is
suspiciously fast, check it is still computing the answer — which is what the
identity check is for.

### Tools that cannot see what you are asking

**V8's sampling heap profiler reports only survivors.** 500k objects allocated
and dropped sample as **0.0 MB**; the same loop retaining them samples 27 MB.
Nursery-dead objects never appear at all, so the profiler cannot answer "how
much transient garbage does this make". `HeapProfiler.startTrackingHeapObjects`
with `trackAllocations` can.

**Node cannot measure the BGZF worker pool.** `getSharedWorkerPool()` needs a
global `Worker` plus Blob URLs; node has neither (`worker_threads` is a
different API), so it resolves to `undefined` and the in-process path runs.
Every node bench of it will report parity forever. That question needs a
browser.

**Don't infer bundle weight from a test run.** Measure with esbuild
`--splitting --minify` and compare the entry chunk.

## Worked examples

Three benches in the repo implement the pattern, and each carries the detail
specific to its own question:

- `plugins/alignments/benches/mismatchWalk.bench.ts` — A/Bs a library against
  the implementation it replaced, extracting the old one from a git ref twice
  (once as baseline, once as control).
- `plugins/alignments/benches/recordShape.bench.ts` — A/Bs two object designs,
  with a separately-declared control class.
- `plugins/maf/benches/mafCoverage.bench.ts` — A/Bs the working tree against
  another git ref, over synthetic input whose shape is swept deliberately.

Related: [bgzf-worker-pool](BGZF_WORKER_POOL.md) for the pool's real numbers per
format, and
[adr-049](../architecture-decision-records/adr-049-region-bound-wrapper-stays.md)
for a decision that turned on separating retained from transient cost.
