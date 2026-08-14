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

**Looping several DATASETS through the same arm function objects.** The rules
above are all about sharing code between arms; this is about sharing an arm
between fixtures, and it is the same failure one level up. A bench that loads
fixture A, times every arm on it, then loads fixture B and times the same arm
objects on it, contaminates B — and every fixture after it. Reported a
**0.73x** where one-fixture-per-process gives **1.22x**, a 1.7x swing, on the
tag-walk probe.

The tell is that **the reversal follows position, not data**: put the same two
fixtures in the other order and the loser swaps. Confirm it that way before
believing any multi-fixture row, because the natural reading — "this
optimization does not help small inputs" — is a plausible, publishable, wrong
conclusion, and it is the one that was nearly written down here.

Three things that do *not* fix it, each measured: pre-warming every arm on every
fixture before timing (recovers 0.73x to 0.92x, not to 1.22x), releasing the
other fixtures' records so the live heap matches (no change, so it is not GC or
cache pressure), and raising the rounds tenfold (no change, so it is not
tiering). **One process per fixture** does fix it. Give the bench an
`--only=<fixture>` flag and quote numbers from separate runs;
`plugins/alignments/benches/readBaseCounts.bench.ts` and `tagAndSeq.probe.ts`
both carry one, with the reasoning at the flag.

Not every bench is equally exposed. The arm that degrades is the one doing raw
property and typed-array access on the records; an arm that calls into the
library's own methods is unaffected, because those call sites are polymorphic
from everything else in the process anyway. So a bench comparing two *library*
paths may be fine where one comparing a hand-rolled walk against a library path
is not — which is exactly the asymmetry that makes the hand-rolled candidate
look worse than it is.

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

**A jest probe is not a timing harness for typed-array code — it inflates by
6-30x, and NOT uniformly.** Measured 2026-08-14 on the synteny geometry and pick
paths, running the *same esbuild bundle* in each host so nothing but the harness
differed:

| | jest | node | Chrome |
| --- | --- | --- | --- |
| `buildSyntenyGeometry`, 300k features | ~105ms | 10.6ms | 12.9ms |
| synteny pick rebuild (collinear, 1/100) | 201ms | 24.4ms | 33.4ms |
| synteny pick warm query @5000px skew | 8.9ms | 0.39ms | 0.3ms |
| synteny hover, wide hulls, zero skew | 134ms | 15.5ms | 12.5ms |

**Node and Chrome agree to within ~30%; jest agrees with neither.** So node is a
fine proxy for a worker-side question and jest is not, for anything that touches
typed arrays in a loop.

The cost is in typed-array **element access**, which is why it does not divide
out. In the same jest file an empty 300k loop runs in 0.17ms — the JIT is
working — while a 300k loop doing four `Float64Array` reads takes 58ms, about
60x below memory bandwidth. Both jest environments do it (`node` measured worse
than `jsdom`, so switching `testEnvironment` is not the fix); the arrays are
realm-local to jest's vm context, and element access falls off V8's fast path.

**What this cost:** a handoff reported `buildSyntenyGeometry` as "the largest
single item, 105ms, and nobody has looked at it". It is 12.9ms in a browser and
there is nothing there to find. A whole profile table was built on jest numbers
and every row of it was wrong by a different factor, which is worse than being
uniformly wrong — the *ranking* changed too.

**The fix is cheap.** `esbuild --bundle` the module under test and run the bundle
under `node`, or under Chrome via the puppeteer resolved from
`packages/browser-test-utils/`. Both take minutes. Note Chrome clamps
`performance.now()` to ~0.1ms for Spectre, so anything faster than that reads as
`0.000` there and wants the node arm for resolution.

**Every `*.bench.ts` in this repo is already node-run** — each names its own
`node <path>` command in its header — and the whole set was checked when this
entry was written, so nothing committed is affected. That is the property to
preserve: a bench that grows a `test()` around it to get a runner is not a
cheaper bench, it is a different and wrong measurement. The only jest-derived
timings found anywhere were the throwaway probes behind one handoff, which is
where the numbers above came from.



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
