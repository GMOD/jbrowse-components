---
name: benchmarking
description: How do I measure performance honestly here — the bench shape and trap catalogue, render-count and jank instrumentation, the whole-app jb2bench corpus and its publishable tables, and the track-selector result?
kind: operations
---

# Benchmarking, and the traps that fake it

A bad harness does not produce noise, it produces a confident wrong answer: a
clean ratio with a tidy standard deviation. Each trap below got as far as being
believed in this repo. [BGZF_WORKER_POOL.md](BGZF_WORKER_POOL.md) holds the traps
specific to benchmarking the inflate pool.

## The shape of a bench you can believe

- **Interleave the arms, round-robin, in one process.** Machine drift otherwise
  lands on whichever arm ran second.
- **Report the MIN across rounds.** Interference only slows things down. Absolute
  times drift between runs; the within-run ratio does not.
- **Run a control**: a third arm that is the same code as the baseline, extracted
  or declared twice. **A control far from 1.00 means the row measured nothing.**
- **Check identity before believing timing.** Compare every field both sides emit
  and fail unless the caller passes `--allow-diff`.

## The trap catalogue

### JIT and shape

- **One shared driver across arms.** A shared function calling both
  implementations goes polymorphic and every arm pays. Write one longhand driver
  per arm.
- **Arm declared in the bench vs imported from a module** compile differently
  enough to move a ratio by roughly 10%. When the candidate is imported production
  code, import the baseline and control too, as
  `packages/render-core/benches/twoLiteralBpMapper.ts` does.
- **Looping several DATASETS through the same arm function objects.** Fixture A
  contaminates B and every later fixture; swap the order and the loser swaps.
  Pre-warming and more rounds do not fix it. **One process per fixture** does: give
  the bench an `--only=<fixture>` flag, as
  `plugins/alignments/benches/readBaseCounts.bench.ts` does.

### Measuring the wrong thing

- **Setup inside the timed region.** Hoist anything the real caller does once per
  region.
- **Too few rounds against a warming cache.** Watch the spread of the raw rounds.
- **A window LARGE enough that the arms' own garbage decides.** `pafLineParse.bench`
  stops resolving at a few thousand rows per arm and the control drifts well off
  1.00. More rounds do not help. Cut the fixture down.
- **A degenerate microbench.** Pure-allocation microbenches overstate by multiples.
  Use them to find a mechanism, never to size one.
- **A baseline silently doing less work.** The identity check exists for this.
- **A fixture that cannot produce the event under test.** The synthetic MAF in
  `mafOverlays.bench.ts` put a reference gap every 29 columns, so the overlay
  emitted zero markers while the walk was timed, and identity passed because zero
  equals zero. **Print the count of whatever the code under test emits on every
  row**, and treat zero as a broken fixture.

### Tools that cannot see what you are asking

- **A jest probe is not a timing harness for typed-array code.** Jest inflates
  typed-array element access and global-builtin calls by one to two orders of
  magnitude, non-uniformly, and changes the profile ranking. Node and Chrome agree
  within about 30%, so `esbuild --bundle` the module and run it under `node`, or
  under Chrome via the puppeteer in `packages/browser-test-utils/` (Chrome clamps
  `performance.now()` to ~0.1ms).
- **Every `*.bench.ts` runs under node**, naming its own `node <path>` command in
  its header. A bench that grows a `test()` for a runner is a different and wrong
  measurement.

## Measuring on a contended box

Other agents run `tsc` concurrently, so load average often sits far above core
count. That invents or erases results: a sequential before/after reported a babel
change as a 2.2x win that an interleaved A/B put at zero.

- Check `uptime` before believing anything, and again after.
- `website/scripts/ab-compare.ts` interleaves two prebuilt `build/` trees. For a
  source A/B, `git worktree add --detach <dir> <sha>` with symlinked `node_modules`
  runs jest in both trees.

## Instrumenting render and scroll jank

Gate probes on a `?gpu-perf=1` URL flag and strip them before landing.

**Shrinking the RPC worker pool is not a win; don't retry it.** Forcing
`rpc.workerCount: 1` was a wash, because worker boots overlap off the critical path.

## Whole-app benchmarks against released JBrowse

[jb2bench](https://github.com/cmdcolin/jb2bench), a sibling checkout, compares the
whole application against released versions of itself; its corpus cannot live in
this repo or CI. `website/scripts/import-jb2bench.ts` reads that checkout's result
JSON and writes `agent-docs/measurements/<id>.json`, and the committed record is
what CI gates. Refresh with `make interaction` in jb2bench, then
`pnpm import-jb2bench`.

### Zoom in: the current renderer does not refetch

<!-- BEGIN GENERATED MEASUREMENT zoom-in-refetch -->

_Generated by `pnpm autogen` — edit the source, not this block._

| case            | current | release-4.3.0 | longest redraw frame |
| --------------- | ------: | ------------: | -------------------: |
| 20x-shortread   |     0ms |        1059ms |                 17ms |
| 200x-shortread  |     0ms |        1085ms |                 17ms |
| 1000x-shortread |     0ms |        1717ms |                 17ms |
| 20x-longread    |     0ms |        1178ms |                 17ms |
| 200x-longread   |     0ms |        2984ms |                 17ms |
| 1000x-longread  |     0ms |       15321ms |                 50ms |

<!-- END GENERATED MEASUREMENT zoom-in-refetch -->

`0ms` is the time a loading indicator was shown. Zoom in is the one gesture where
the architecture skips work entirely, so quoting this as the general speedup
overstates it.

## Worked case: the track selector's cost is per-row rendering

Mounting a track selector row costs about 1.4 ms.

<!-- BEGIN GENERATED MEASUREMENT track-selector-row-cost -->

_Generated by `pnpm autogen` — edit the source, not this block._

| n=1000 tracks               | before, round 1 | before, round 2 | after, round 1 | after, round 2 |
| --------------------------- | --------------: | --------------: | -------------: | -------------: |
| mount, min of 9             |          1656ms |          1631ms |         1460ms |         1401ms |
| toggle re-render, min of 18 |          80.6ms |          73.6ms |         63.3ms |         66.1ms |
| DOM nodes                   |          21,506 |               — |         20,505 |              — |

<!-- END GENERATED MEASUREMENT track-selector-row-cost -->

Measured null, so don't retry without new evidence:

- **Caching the unfiltered hierarchy and pruning it per keystroke**, and
  **preserving track-node identity** so memoized `TreeItem`s bail out: the
  `buildRows` walk dominates, and reconciling ~1000 elements costs about what
  re-rendering them does.
- **Resolving each track's name/description/categories once**: reading a slot off
  an un-hydrated frozen `jbrowse.tracks` entry is nearly a property access.
- **Debouncing `filterText`**: `ClearableSearchField` already holds the input in
  local state and wraps the model update in `startTransition`.