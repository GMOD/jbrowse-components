---
name: bgzf-worker-pool
description: What the BGZF inflate pool is worth, measured per format, and the benchmark traps that produce fake numbers. Read before quoting a speedup for it or benchmarking it again.
---

# The BGZF worker pool, measured

`sharedBgzfWorkerPool()` (`packages/core/src/util/bgzfWorkerPool.ts`) spreads
BGZF block inflation across four workers instead of doing it on the thread that
asked. It is wired into `BamAdapter` and the nine `TabixIndexedFile` sites.

The headline number people remember is **1.95x, and that is BAM's**. Tabix is
worth appreciably less, for a structural reason, and quoting the BAM figure for
a VCF track overstates it by a third.

## What it is worth

Fixture is `~/src/gmod/tabix-js/test/data/1kg.chr1.subset.vcf.gz` — 213MB of
1000 Genomes over `chr1:10,109-622,047`, so thousands of samples and ~60KB
lines. Headless Chrome, real HTTP with range requests, 4 workers, arms
interleaved, **min of 6**, machine on AC. Both arms asserted to return the same
record count on every run.

| workload | records | unpooled | pooled | speedup |
| --- | --- | --- | --- | --- |
| 50kb window | 2,732 | 803ms | 562ms | 1.43x |
| 100kb window | 4,878 | 1222ms | 887ms | 1.38x |
| 200kb window | 7,627 | 1880ms | 1289ms | 1.46x |
| 400kb window | 8,503 | 2025ms | 1390ms | 1.46x |
| 12 x 20kb pan | 7,627 | 2446ms | 1822ms | 1.34x |

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

Also worth knowing: `unzipChunkSlice` declines the pool outright when a chunk
holds a single BGZF block, one block not being worth a round trip. A fixture
small enough to have one-block chunks measures nothing, silently.

**Jest suite time is not a usable signal here, and was once mistaken for one.**
The helper's import is dynamic for bundle reasons — static pins the inlined
worker blob into the initial bundle at 23.4kb gzipped, against 141 bytes plus a
lazily fetched chunk — and that is the whole justification. A comment asserting
it also took three jbrowse-web alignments suites from 16s to 181s did not
reproduce: three variant suites measured 13.887s static against 13.856s
dynamic on a warm cache. The 29s reading that seemed to confirm it was a cold
jest transform cache in a fresh worktree, which is the *same* mistake as the
HTTP-cache trap above, made twice in one session. Measure bundles with esbuild
`--splitting --minify` and compare the entry chunk; don't infer graph weight
from a test run.

## Harness

Not committed — it was a scratch bundle. To rebuild it: esbuild a browser entry
importing `TabixIndexedFile` and `getSharedWorkerPool`, serve the `.vcf.gz` and
`.tbi` from a node http server that honours `Range` (tabix reads by byte range
off the index, so without range support you measure the network), drive it with
puppeteer resolved from `packages/browser-test-utils`, and construct a fresh
`TabixIndexedFile` per run so the chunk cache starts cold.
