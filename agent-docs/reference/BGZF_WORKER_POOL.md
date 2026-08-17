---
name: bgzf-worker-pool
description: What the BGZF inflate pool is worth, measured per format, and the benchmark traps that produce fake numbers. Read before quoting a speedup for it or benchmarking it again.
---

# The BGZF worker pool, measured

`sharedBgzfWorkerPool()` (`packages/core/src/util/bgzfWorkerPool.ts`) spreads
BGZF block inflation across four workers instead of doing it on the thread that
asked. Where it is wired, from the call sites:

<!-- BGZF_POOL_SITES START -->

<!-- prettier-ignore -->
| Reader | Plugin |
| --- | --- |
| `BamAdapter` | `alignments` |
| `BedGraphTabixAdapter` | `bed` |
| `BedTabixAdapter` | `bed` |
| `Gff3TabixAdapter` | `gff3` |
| `GtfTabixAdapter` | `gtf` |
| `PifFile` | `comparative-adapters` |
| `PlinkLDTabixAdapter` | `variants` |
| `SplitVcfTabixAdapter` | `variants` |
| `VcfTabixAdapter` | `variants` |

<!-- BGZF_POOL_SITES END -->

`CramAdapter` is absent on purpose and names the helper in a comment anyway: its
own codec pool is a different pool, and the comment is there to say so.

The headline number people remember is **1.95x, and that is BAM's**. Tabix is
worth appreciably less, for a structural reason, and quoting the BAM figure for
a VCF track overstates it by a third.

## What it is worth

Fixture is `~/src/gmod/tabix-js/test/data/1kg.chr1.subset.vcf.gz` — 213MB of
1000 Genomes over `chr1:10,109-622,047`, so thousands of samples and ~60KB
lines. Headless Chrome, real HTTP with range requests, 4 workers, arms
interleaved, **min of 6**, machine on AC. Both arms asserted to return the same
record count on every run.

<!-- BEGIN GENERATED MEASUREMENT bgzf-pool-tabix -->

| workload      | records | unpooled | pooled | speedup |
| ------------- | ------- | -------- | ------ | ------- |
| 50kb window   | 2,732   | 803ms    | 562ms  | 1.43x   |
| 100kb window  | 4,878   | 1222ms   | 887ms  | 1.38x   |
| 200kb window  | 7,627   | 1880ms   | 1289ms | 1.46x   |
| 400kb window  | 8,503   | 2025ms   | 1390ms | 1.46x   |
| 12 x 20kb pan | 7,627   | 2446ms   | 1822ms | 1.34x   |

<!-- END GENERATED MEASUREMENT bgzf-pool-tabix -->

So **1.35-1.45x on a big multi-sample VCF**, against 1.95x for BAM.

## Why tabix gets less than BAM

Because a third of a VCF query is not decompression and never will be. Splitting
the 100kb query by running a second pan over the *same* file — which answers
from the decompressed chunk cache and so inflates nothing — separates the two
halves:

```
unpooled cold   1210ms
unpooled warm    335ms   <- line scanning alone, no decompression
                          = 28% of the cold query
movable part     875ms -> 478ms pooled = 1.83x on the part the pool can reach
end to end      1210ms -> 834ms        = 1.45x
```

The decompression itself moves **1.83x**, which is a perfectly good result; the
28% floor is what drags the end-to-end figure down. Amdahl agrees:
`1 / (0.28 + 0.72/1.83)` = 1.49x, against 1.45x measured.

That floor is per-line byte scanning and string decoding, and it is large for
VCF precisely because the lines are enormous — a 1000-Genomes record carries a
genotype field per sample. A format with narrow lines would sit closer to BAM.
Anyone wanting more than 1.5x on multi-sample VCF should attack the scan, not
the decompression; the pool has already taken most of what it can reach.

## It does engage in production — verified, and how to re-check

Verify this deliberately, because the failure mode is silence. jbrowse-web runs
adapters under `WebWorkerRpcDriver`, so `sharedBgzfWorkerPool()` is called
*inside* a web worker and the pool is a worker spawning workers — **nested**
workers. Where those are unavailable `workersAvailable()` is false, the pool
resolves to `undefined`, every read quietly inflates in process, and nothing
fails: no error, no failing test, just the speedup gone. That is the same
graceful degradation that makes the option safe to pass unconditionally, working
against you.

Checked on the production build, and it works:

- Inside a dedicated worker, `Worker` / `Blob` / `URL.createObjectURL` are all
  present, the pool is created, and it round-tripped 55 BGZF blocks to 3.4MB.
- `pnpm build` puts the bgzf worker in its own 56.7kb chunk rather than
  `main.js`, so the dynamic import splits in the shipped app too.
- Loading a BAM track, and separately a VCF tabix track, spawns the RPC worker
  plus **4** `blob:` workers — the pool, at `min(hardwareConcurrency, 4)`.
- Control: a bigwig track spawns the RPC worker and **0** blob workers, so the
  signal is specific and the pool really is lazy — nothing spawns at app boot.

To re-check without touching any source, count worker targets with puppeteer:
`browser.on('targetcreated', …)` and filter for `blob:` URLs while loading a
session spec with one bgzip-backed track. Four means engaged, zero means it
fell back. Always run the non-bgzip control in the same session, or you are
just counting whatever else spawns workers.

Note Safari only gained nested workers in 16.4; below that this degrades to
in-process by design, which is correct rather than a bug to fix.

**The four is per RPC worker, not per session.** The check above loaded one
track, which is what made this invisible. `getSharedWorkerPool()` memoizes per JS
context and `WorkerPoolRpcDriver` gives each track a sticky worker out of
`clamp(hardwareConcurrency - 1, 1, 5)`, so the pool multiplies by the number of
contexts: 5 tracks give 20 pool workers, and so do 8.

Each of the 20 has its own grow-only wasm heap. Since `@gmod/bgzf-filehandle`
6.6.0 those are given back after 3 minutes idle — a pool terminates its own
workers and spawns a fresh set on the next call, transparent to holders in a way
`destroySharedWorkerPool` is not, since a destroyed pool throws out of
`decompressBlocks` and every open track holds one.
[BAM_STACK_INTEGRATION.md](BAM_STACK_INTEGRATION.md) § "Seam 1" owns the counts
and the question of what to do about them.

`browser-tests/percontext-probe.ts` is the harness, and it needs a **recursive**
`Target.setAutoAttach`: a pool worker is a worker inside a worker, so
`memHelpers`' one-level `setupWorkerTracking` sees the RPC workers and none of
the pool. Run it with `TRACKS` above the RPC pool size — the 8-track row is what
separates "per track" from "per context".

## Benchmark traps

Three, and two of them produce numbers that look real.

**Six rounds minimum, because the HTTP cache warms for several.** At 3 rounds
the 400kb window measured **0.74x — the pool apparently making it slower**. The
same workload at 6 rounds is 1.46x. The early rounds are 2-3x slower than steady
state and the spread gives it away (unpooled 5418, 4506, 2263 in one 3-round
run). A min over a series that has not plateaued is not a min of anything.

**Node cannot measure this at all.** `getSharedWorkerPool()` checks for a global
`Worker` plus Blob URLs, which node has not got — `worker_threads` is a
different API. So it resolves to `undefined` and the in-process path runs. Every
vitest bench in `tabix-js/benchmarks/`, `bgzf-filehandle/benchmarks/` and
`bam-js/benchmarks/` is therefore blind to the pool and will report parity
forever. It needs a browser. (This is the same property that makes the option
safe to pass unconditionally, pinned by
`packages/core/src/util/bgzfWorkerPool.test.ts`.)

**Interleave the arms.** Run all of one arm then all of the other and any drift
in machine state lands entirely on the second — a laptop coming off AC mid-run
did exactly that here. Interleaving makes throttling hit both arms alike, so the
ratio survives even when the absolute milliseconds do not.

`unzipChunkSlice` also declines the pool outright when a chunk holds a single
BGZF block, one block not being worth a round trip — so a fixture small enough to
have one-block chunks measures nothing, silently.

**Jest suite time is not a usable signal here, and was once mistaken for one.**
The helper's import is dynamic for bundle reasons — static pins the inlined
worker blob into the initial bundle at 23.4kb gzipped, against 141 bytes plus a
lazily fetched chunk — and that is the whole justification. A comment claiming it
also took three alignments suites from 16s to 181s did not reproduce: 13.887s
static against 13.856s dynamic on a warm cache. The 29s reading that seemed to
confirm it was a cold jest transform cache in a fresh worktree — the *same*
mistake as the HTTP-cache trap above, made twice in one session. Measure bundles
with esbuild `--splitting --minify` and compare the entry chunk; don't infer
graph weight from a test run.

## Harness

Not committed — it was a scratch bundle. To rebuild it: esbuild a browser entry
importing `TabixIndexedFile` and `getSharedWorkerPool`, serve the `.vcf.gz` and
`.tbi` from a node http server that honours `Range` (tabix reads by byte range
off the index, so without range support you measure the network), drive it with
puppeteer resolved from `packages/browser-test-utils`, and construct a fresh
`TabixIndexedFile` per run so the chunk cache starts cold.
