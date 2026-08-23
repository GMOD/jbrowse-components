---
name: give-the-rpc-workers-one-inflate-pool-and-one-byte-cache-between-them
description: the speed premise is measured out; weigh the wasm memory, or close it
metadata:
  area: bgzf, RPC, limits
  category: measure-first
---

# Give the RPC workers one inflate pool and one byte cache between them

**Read the close condition before the design: this entry is more likely to end
in a measurement than in a build.** Three of the four reasons it was opened have
since been measured out or fixed upstream — the thread count (no arm beat the
status quo), the sizing worry (unsupported), and the resting memory (reaped
upstream in `@gmod/bgzf-filehandle` 6.6.0). What is left is the memory *peak*
while someone is actively browsing several tracks, and if that turns out not to
matter, **close this rather than building the channel**; the duplication is then
untidy and free.

**The multiplication is measured; what is open is the sizing.**
`browser-tests/percontext-probe.ts`, production build, 16 cores:

| tracks | RPC workers | bgzf pool workers | reference fetches |
| ------ | ----------- | ----------------- | ----------------- |
| 1      | 1           | 4                 | 1                 |
| 5      | 5           | 20                | 5                 |
| 8      | 5           | 20                | 5                 |

Eight tracks give five of each, so both scale with JS contexts rather than with
tracks: `sharedBgzfWorkerPool()` and `RemoteFileWithRangeCache`'s chunk map are
both per context, and adapters are sticky per track to one of
`clamp(hardwareConcurrency - 1, 1, 5)` workers. Twenty inflate workers each hold
a grow-only wasm heap and none is ever torn down; the same reference sequence is
downloaded once per worker for tracks sharing an assembly and a viewport.
[reference/BAM_STACK_INTEGRATION.md](../reference/BAM_STACK_INTEGRATION.md) seam 1.

`@gmod/bgzf-filehandle` ships `BgzfWorkerPoolHost` / `BgzfWorkerPoolClient` /
`createPoolPort` for the pool half and names JBrowse's data workers as the case;
neither symbol appears in this repo. **Both halves want the same
`MessagePort`-at-boot channel through `makeWorker`, so build that once** and
carry the byte cache over it too rather than solving the pool alone.

**Do not take this on for the thread count — that premise is measured out.**
`pool-oversub-probe.ts` at 4 cores under `taskset`, where the multiplication is
worst (3 RPC x 4 = 12 inflate workers, ~4x oversubscribed): no arm beat the
status quo, and cutting the inflate workers to 3 was slower in every batch.
Per-chunk parallelism is worth more than avoiding oversubscription. Two builds
of identical code differed by 15%, wider than any gap between arms, so nothing
finer than "no win here" can be read off it.

The sizing worry that used to be written here — that one shared pool of four
would regress the several-tracks case — is not supported either: the "capped to
1 per context" arm is strictly worse than that and cost ~13%, inside the drift.

**What is left is the memory PEAK, and only that.** The resting level is
handled upstream as of `@gmod/bgzf-filehandle` 6.6.0: a pool reaps its own
workers after 3 minutes idle and respawns them on demand, so the 20 grow-only
`WebAssembly.Memory` instances no longer outlive the tracks that needed them.
What sharing would additionally buy is a lower peak *while someone is actively
browsing several tracks*, and that is unmeasured. Note the usual tools do not
see it — wasm memory is outside `Runtime.getHeapUsage`, so this wants
process-level RSS per target rather than a heap snapshot. If the peak turns out
not to matter either, close this entry rather than building the channel; the
duplication is then untidy and free.

Do **not** touch `SharedBudget` (ADR-064) while doing this. Per context is the
right scope for it — a worker OOMs on its own heap — and only threads and the
network are being bounded from the wrong place.

Both halves of the reclamation pair are now done, so don't re-open either. The
cache sweeps itself on an interval that starts with the first chunk and stops
when the sweep empties the cache (`@gmod/range-cache-filehandle`, re-exported
from `packages/core/src/util/io/`); the exported `sweepIdleCache` is a
documented extra for a caller with its own schedule, not a dangling hook. And the pool's fix could NOT have been "call
`destroySharedWorkerPool` when the last bgzip track closes", which is the obvious
shape and a footgun: a destroyed pool throws out of `decompressBlocks`, and
`BamFile` holds the pool promise for the life of the track, so that would break
open readers rather than reclaim anything. It had to be reaping inside the pool.

Node cannot measure any of it — `getSharedWorkerPool` returns `undefined` there,
so every vitest bench in all three repos reports parity forever. Use
`percontext-probe.ts` and heed the traps in its header and in
[reference/BGZF_WORKER_POOL.md](../reference/BGZF_WORKER_POOL.md).

For the byte-cache half, build the fixture with `make-tiled-fixture.sh` first.
The stock one is a 255 KB reference that fits inside a single 256 KiB chunk, so
sharing the cache across workers looks free on it whatever the truth is — the
duplication is real (measured: one reference download per RPC worker) but its
COST is invisible until a pan can miss that cache.
