# Aborting in-flight requests — planning doc

Status: **proposal, not implemented.** Branch context `webgl-poc`. Companion to
`PROGRESS_REPORTING.md` (status/progress) — this doc is specifically about
*tearing down the network request* on cancel, which we currently do **not** do.

## Problem

Cancel today (`FetchMixin.cancelFetchByUser` → `stopStopToken`) interrupts
**processing**, not the **socket**. The `stopToken` is checked at await
boundaries and inside sync worker loops, so on cancel we stop computing and
discard the result — but any HTTP read already on the wire keeps downloading
until it resolves. For a large BAM/CRAM range or a whole-file BigWig read,
that's wasted bandwidth and a connection-pool slot held to completion.

The bottom of the stack is already abort-ready and unused above it:

- `BaseOptions.signal?: AbortSignal` **exists but is dead** — present only for
  structural assignability to gmod `Options { signal? }` interfaces, never
  populated. `VcfTabixAdapter` / `SplitVcfTabixAdapter` forward `opts.signal` to
  readers, but it's always `undefined`.
- `RemoteFileWithRangeCache.fetchRange(url, start, end, signal)` already accepts
  a signal and passes it to `fetch`. The missing piece is entirely upstream:
  producing a signal wired to cancel.

## Why not "derive a signal from the stopToken" (SAB / `Atomics.waitAsync`)

Tempting: the `stopToken` already crosses `postMessage`; on the worker side wrap
the `SharedArrayBuffer` in `Atomics.waitAsync(view, 0, CLEAR).then(abort)` (plus
an `Atomics.notify` added to `stopStopToken`) and you get a worker-local
`AbortSignal` for free, no protocol change.

**It can't be the general solution, because SAB isn't available by default.**
SAB requires the page to be `crossOriginIsolated`, which requires two HTTP
**response headers on the top-level document**:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These are **server-side** — set by whoever serves the HTML. JBrowse is **mostly
a client-side library**, and the embedded products
(`@jbrowse/react-linear-genome-view` etc.) run inside *someone else's*
top-level document whose headers we don't control at all. So we cannot assume
isolation. The repo confirms it: there are **no COOP/COEP headers anywhere**,
and `stopToken.ts` is built around the XHR/blob fallback being a real, common
path (`ErrorMessageStackTraceDialog` even reports `Worker abort:
SharedArrayBuffer | XHR fallback` as a diagnostic).

Client-side escape hatches exist but don't fit:

- **`coi-serviceworker`** (a service worker that re-injects COOP/COEP) can turn
  isolation on without server config, but it forces a reload on first load,
  registers a SW we'd impose on every host page, and `COEP: require-corp`
  breaks cross-origin subresources that don't send CORP/CORS — unacceptable for
  an embeddable component dropped into arbitrary pages.
- Setting headers in `jbrowse-web`'s own hosting is possible but
  deployment-specific (GitHub Pages can't; Netlify/CloudFront can) and still
  does nothing for the embedded use case.

**Conclusion:** abort must work **without** SAB. `Atomics.waitAsync` stays an
*opportunistic fast-path* for the rare isolated deployment, never a dependency.

## Design: one fused cancel primitive, three sinks

The user-facing idea is a single cancellation handle that drives everything:

```ts
// packages/core/src/util/stopToken.ts (or a new cancellation.ts)
interface Cancellation {
  stopToken: StopToken   // crosses postMessage; interrupts SYNC worker loops (today)
  signal: AbortSignal    // aborts MAIN-thread fetches at the socket, directly
  cancel(): void         // trips the token, aborts the signal, AND posts the abort message
}
function createCancellation(): Cancellation
```

`AbortSignal` is **not** structured-cloneable, so it can't ride `postMessage`
into the worker. The fusion is conceptual: `cancel()` on the main thread drives

1. **the stopToken** — sync-loop interruption in the worker, exactly as today
   (works on both the SAB and XHR paths);
2. **the local `signal`** — for fetches that run on the **main thread**
   (`MainThreadRpcDriver` executes methods in-thread, so the real signal flows
   straight into the adapter — no message needed);
3. **an out-of-band abort message** — for fetches in a **worker**, where the
   socket lives across the boundary.

### The worker path (the common, load-bearing case)

Reuse the existing uid-keyed RPC channel (the same machinery `statusCallback`
rides back on):

- **`RpcServer`** (`packages/core/src/rpc/RpcServer.ts`): keep a
  `Map<uid, AbortController>`. On a method call, create the controller, inject
  its `signal` into the deserialized args, store it. On an incoming
  `{ abort: uid, libRpc: true }` message, `controller.abort()` and delete. Clean
  up the entry in `reply`/`throw` so the map can't leak.
- **`RpcClient`** (`packages/core/src/rpc/RpcClient.ts`): expose
  `abort(uid)` → `postMessage({ abort: uid, libRpc: true })`. `call()` already
  mints the `uid`; surface it so the driver can tie it to a stopToken.
- **Driver / `RpcManager`**: record `(stopToken → uid[])` at call time. Either a
  new `RpcManager.abort(stopToken)` (called from `FetchMixin` alongside
  `stopStopToken`), or — cleaner — have the same main-thread `cancel()` that
  trips the token also fan out `client.abort(uid)` to every uid registered
  against it. The main thread is the side that calls `stopStopToken`, so it
  already knows exactly when to abort.
- **Injection seam**: args are reconstructed worker-side in
  `RpcMethodType.deserializeArguments` (`packages/core/src/pluggableElementTypes/RpcMethodType.ts:228`),
  but the `uid` lives at the `RpcServer.handler` level. So the controller's
  `signal` is best attached at the server/worker-glue layer (where the uid is
  known) rather than inside `deserializeArguments`, or `uid` is threaded down.
  Resolve this in the prototype.

Net: socket teardown works in **every** environment, SAB or not.

## The correctness trap: range-cache coalescing

`RemoteFileWithRangeCache` coalesces chunk fetches (256 KiB-aligned, see
`feedback`/architecture notes). If two logical reads share one coalesced
underlying fetch and one aborts, a naive abort tears down the fetch the other
read still needs.

Mitigations, in order of preference:

- **Abort at call (uid) granularity, not chunk granularity.** One RPC call = one
  `AbortController` = all that call's reads abandoned together. A whole
  `RenderFeatureData` aborting is coherent. The cross-call collision only
  remains when two *different* calls coalesce onto the same chunk fetch.
- For that residual: **ref-counted abort** in the range cache — track consumers
  per in-flight chunk fetch, only abort the underlying `fetch` when the last
  consumer aborts; otherwise just detach the aborting consumer.
- Acceptable interim: don't abort shared chunk fetches at all (let them complete
  into cache); only abort fetches with a single consumer. Bounds the waste
  without risking a correctness regression.

This trap is the main reason to **prototype one path before a broad rollout.**

## Affected surface (rough)

| Area | Change |
| --- | --- |
| `util/stopToken.ts` (or new `cancellation.ts`) | `createCancellation()` fused primitive; optional `Atomics.notify` in `stopStopToken` + a SAB→signal `waitAsync` fast-path |
| `rpc/RpcClient.ts` | `abort(uid)` + expose uid from `call()` |
| `rpc/RpcServer.ts` | per-uid `AbortController` map, inject signal, handle `{abort}`, cleanup |
| `rpc/{WebWorkerRpcDriver,WorkerPoolRpcDriver,MainThreadRpcDriver}.ts` | tie stopToken→uid; main-thread driver passes the real signal directly |
| `rpc/BaseRpcDriver.ts` / `RpcManager.ts` | `abort(stopToken)` fan-out (or fold into `cancel()`) |
| `pluggableElementTypes/RpcMethodType.ts` | inject `signal` into reconstructed args (or do it at the server seam) |
| `BaseLinearDisplay/models/FetchMixin.ts` | `cancelFetch`/`cancelFetchByUser` also drive the abort fan-out |
| `RemoteFileWithRangeCache.ts` | ref-counted abort for coalesced chunk fetches |
| adapters | none required if signal is injected centrally; they already accept `opts.signal` |

## Suggested phasing

- **Phase 0 — prototype one path.** Fused primitive + RPC abort message +
  per-uid controller, wired through **one** adapter end-to-end (BAM
  `getRecordsForRange` is the highest-value target). Verify in a browser that a
  slow range read's `fetch` actually aborts (devtools network → "(canceled)")
  and the overlay lands in "Loading canceled". Decide the coalescing policy here.
- **Phase 1 — central injection.** Move signal injection to the worker glue so
  *every* RPC method gets it without per-adapter edits.
- **Phase 2 — range-cache ref-counting** if Phase 0 shows shared-chunk aborts
  matter in practice.
- **Phase 3 — optional SAB fast-path** (`waitAsync`) for isolated deployments.

## Open questions

- Exact seam for signal injection given `uid` lives above `deserializeArguments`.
- `WorkerPoolRpcDriver`: a call may be assigned to any worker in the pool — the
  abort message must reach the **same** worker the call landed on. The pool
  already routes by uid for replies; reuse that routing.
- Do we abort on *internal* `cancelFetch` (viewport change / settings
  invalidate) too, or only user cancel? Probably both — a superseded fetch's
  socket is just as wasteful — but confirm it doesn't abort a fetch whose result
  a coalesced sibling still wants (same coalescing trap).
- Measure first: is the wasted-bandwidth problem big enough outside large
  alignment/whole-file reads to justify Phases 1–2? Index reads are short.

## Don't

- Don't make SAB / `crossOriginIsolated` a **requirement** — we can't guarantee
  COOP/COEP from a client-side/embedded library.
- Don't try to send an `AbortSignal` across `postMessage` — it doesn't clone.
- Don't abort at chunk granularity over a coalescing cache without ref-counting.
- Don't remove the `stopToken` — it's the only thing that interrupts
  **synchronous** worker loops; AbortSignal can't. The two are complementary.
