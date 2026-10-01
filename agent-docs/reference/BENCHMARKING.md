---
name: benchmarking
description: How to build a benchmark whose number is real, and the catalogue of traps that have produced fake ones in this repo. Read before writing a bench or quoting a speedup.
kind: operations
---

# Benchmarking, and the traps that fake it

A bad harness does not produce noise, it produces a confident wrong answer: a
clean ratio with a tidy standard deviation. Each trap below got as far as being
believed in this repo.

## The shape of a bench you can believe

- **Interleave the arms, round-robin, in one process.** Machine drift (another
  agent's typecheck, a laptop leaving AC) otherwise lands on whichever arm ran
  second.
- **Report the MIN across rounds.** Interference only slows things down, so the
  minimum is the closest sample to uncontended. Absolute times drift between
  runs; the within-run ratio does not.
- **Run a control.** A third arm that is the same code as the baseline,
  extracted or declared twice. Any claimed ratio has to clear what the control
  scores. **A control far from 1.00 means the row measured nothing.** A control
  coming back wrong caught most of the traps below.
- **Check identity before believing timing.** Compare every field both sides
  emit, describe the first difference, and fail unless the caller passes
  `--allow-diff`.

## The trap catalogue

### JIT and shape

- **One shared driver across arms.** A shared function calling both
  implementations goes polymorphic and every arm pays. Write one longhand driver
  per arm.
- **Identical driver source.** Three `new Function` calls with the same text hit
  V8's compilation cache and share a feedback vector, restoring the
  megamorphism. Use separate function literals.
- **Asymmetric warmup.** An identity pass over only some arms leaves the others
  monomorphic. Warm every arm the same way.
- **Direct call vs call-through-parameter.** A directly imported function can
  inline; one reached through a parameter often cannot. Pass all arms the same
  way.
- **Arm declared in the bench vs imported from a module.** The two compile
  differently enough to move a ratio by roughly 10%. When the candidate is
  imported production code, import the baseline and control too, as
  `packages/render-core/benches/twoLiteralBpMapper.ts` does.
- **Arms in blocks.** The second block inherits the first's warmup. Interleave.
- **Looping several DATASETS through the same arm function objects.** Fixture A
  contaminates B and every later fixture. The reversal follows position, not
  data: swap the order and the loser swaps. It invites the plausible wrong
  conclusion "this does not help small inputs". Pre-warming, releasing other
  fixtures and more rounds do not fix it. **One process per fixture** does: give
  the bench an `--only=<fixture>` flag, as
  `plugins/alignments/benches/readBaseCounts.bench.ts` and `tagAndSeq.probe.ts`
  do. Arms that raw-access records are exposed; arms that call library methods
  are not.

### Measuring the wrong thing

- **Setup inside the timed region.** Hoist anything the real caller does once
  per region.
- **Too few rounds against a warming cache.** A min over a series that has not
  plateaued is not a min of anything. Watch the spread of the raw rounds.
- **A window small enough to sit in cache.** It prices arithmetic and moves the
  answer, in the flattering direction. Size the window from the working set.
- **A window LARGE enough that the arms' own garbage decides.** `pafLineParse.bench`
  stops resolving at a few thousand rows per arm and the control drifts well
  off 1.00. Row count matters, not bytes, and more rounds do not help. Cut the
  fixture down.
- **A degenerate microbench.** Pure-allocation microbenches overstate by
  multiples. Use them to find a mechanism, never to size one.
- **A baseline silently doing less work.** A suspiciously fast arm may have
  skipped the computation (an undefined `ref` skipped mismatch detection). The
  identity check exists for this.
- **A fixture that cannot produce the event under test.** The synthetic MAF in
  `mafOverlays.bench.ts` put a reference gap every 29 columns, so no deletion
  reached label width and the overlay emitted zero markers while the walk was
  timed. Identity passes because zero equals zero. **Print the count of whatever
  the code under test emits on every row**, and treat zero as a broken fixture.
- **Rounds that vary the workload.** If a bench sweeps positions or inputs, a
  round must be the whole sweep, or `min` picks the cheapest frame.

### Tools that cannot see what you are asking

- **A jest probe is not a timing harness for typed-array code.** Jest inflates
  typed-array element access and global-builtin calls (`Number(s)`,
  `Number.isFinite`) by one to two orders of magnitude, non-uniformly, because
  arrays and builtins are realm-local to jest's vm context. Both jest
  environments do it. The profile ranking changes too: a handoff once named
  `buildSyntenyGeometry` the largest item from jest numbers, and it was not.
  Node and Chrome agree within about 30%, so node is a fine proxy for
  worker-side questions. `esbuild --bundle` the module and run it under `node`,
  or under Chrome via the puppeteer in `packages/browser-test-utils/`. Chrome
  clamps `performance.now()` to ~0.1ms, so use node for finer resolution.
- **Every `*.bench.ts` runs under node**, naming its own `node <path>` command in
  its header. A bench that grows a `test()` for a runner is a different and
  wrong measurement.
- **V8's sampling heap profiler reports only survivors.** Dead nursery objects
  never appear. `HeapProfiler.startTrackingHeapObjects` with `trackAllocations`
  answers "how much transient garbage".
- **Node cannot measure the BGZF worker pool.** `getSharedWorkerPool()` needs a
  global `Worker` plus Blob URLs, so it resolves to `undefined` and the
  in-process path runs. That question needs a browser.
- **Don't infer bundle weight from a test run.** Measure with esbuild
  `--splitting --minify` and compare the entry chunk.

## Worked examples

- `plugins/alignments/benches/mismatchWalk.bench.ts` — A/Bs a library against
  the implementation it replaced, extracted from a git ref twice (baseline and
  control).
- `plugins/alignments/benches/recordShape.bench.ts` — A/Bs two object designs
  with a separately declared control class.
- `plugins/maf/benches/mafCoverage.bench.ts` — A/Bs the working tree against a
  git ref over synthetic input whose shape is swept.
- `plugins/maf/benches/mafOverlays.bench.ts` — code that runs on every frame of
  a pan; reports a cold call and a whole pan sweep, since up-front cost that
  buys cheap frames needs both.

Related: [bgzf-worker-pool](BGZF_WORKER_POOL.md);
[adr-049](../architecture-decision-records/adr-049-region-bound-wrapper-stays.md)
separates retained from transient cost.
