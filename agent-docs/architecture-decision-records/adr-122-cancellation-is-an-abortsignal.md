---
status: Accepted
summary: "Cancellation is a plain `AbortSignal` from the caller to the reader. The stop token — a revocable blob URL probed by synchronous XHR in a worker loop, with a SharedArrayBuffer arm for a page that never ran isolated — goes, and with it its registry, its broadcast, its throttled checker and every name that spelled it. The worker learns of an abort through an `{abort: uid}` frame keyed to the call, and a loop that never awaits yields a task every 50 ms instead of probing. Measured in a real Chrome worker: a probe cost about a millisecond, not the ten the tree believed, and the yield cancels a loop at the latency the probe did — then within one interval once the backoff the probe needed is gone"
---

# ADR-122: Cancellation is an AbortSignal

## Status

Accepted (2026-09-15). Closes the revisit condition
[ADR-056](adr-056-jbrowse-org-is-not-cross-origin-isolated.md) left open, "a
cancel measurement on an await-free workload", and retires both mechanisms
that ADR weighed.

## Context

Every RPC call carried a `stopToken`. On the main thread it was a string minted
by `URL.createObjectURL(new Blob())`; stopping it revoked the URL, recorded the
id in a module-global set, and posted the id to every booted worker. A worker
checked the set at await boundaries, and a loop that never awaited called
`checkStopTokenThrottled`, which every 50 ms (backing off to 500 ms) ran a
synchronous XHR against the blob URL and read the revocation as a failed
request. A `SharedArrayBuffer` arm stood beside it for a cross-origin-isolated
page, which no deployment of ours is.

Three things were wrong with it, in increasing order of weight.

**It was a notion of ours.** Nine exported names (`createStopToken`,
`stopStopToken`, `checkStopToken`, `checkStopTokenThrottled`,
`createStopTokenChecker`, `stopTokenSignal`, `withStopTokenSignal`, `isStopped`,
`createStopTokenRotation`), a `StopToken` type that was a `string |
SharedArrayBuffer` union every reader had to remember not to compare, and a
bridge (`withStopTokenSignal`) at every reader that takes the platform's
`AbortSignal` — which is all of them. An agent writing a plugin has to learn it;
one writing against `AbortController` already knows it.

**Its cost was misremembered, in both directions.** `stopToken.ts`'s header
put the probe at "~10ms a call", which is why it backed off to 500 ms and why
cancellation on an await-free loop lagged by up to half a second. A separate
belief had the blob mints at ~15 ms each and blamed them for a zoom frame.
Neither survived being measured on this machine (the record's notes carry the
unit costs): a probe is about a millisecond, a mint-and-revoke a tenth of that.

**It carried an unmeasured claim as load-bearing.** The header said the probe
"was deleted once and had to be restored" and warned any deletion needs "a
cancel measurement on an await-free workload"; ADR-056 repeated both. The
revert was a development-time one, and the measurement had never been taken.

## Decision

`signal?: AbortSignal` is the one cancellation handle, everywhere a stop token
was:

- **Callers** hold an `AbortController` and pass `signal` in the RPC args
  (`RpcHandles`), the adapter options (`BaseOptions`) and the text-search args.
  `createAbortRotation` is the latest-wins rotation for a fetch family, and
  hands out `signal` where it handed out a token.
- **The transport** carries it. A signal does not structured-clone, so
  `BaseRpcDriver.call` strips it with the `statusCallback`; `RpcClient.call`
  posts the call with `abortable: true`, listens on the signal, and posts
  `{abort: uid}` to the worker that took the call, dropping the listener when
  the call settles; `RpcServer` runs an abortable call under a controller keyed
  by uid and aborts it on the frame. `MainThreadRpcDriver` passes the caller's
  own signal through. No registry, no TTL, no broadcast: the uid routes the
  abort to the one worker running the call.
- **Workers** check with `checkAbortSignal(signal)` after an await and in a
  reader's per-item callback — a `signal.aborted` read, which the second table
  shows costs what the set lookup did. `updateStatus`, `withProgress` and
  `createProgressReporter` take the signal and check for their callers.
- **A loop that can run for seconds without awaiting** takes
  `createAbortBreakpoint(signal)` and writes
  `if (breakpoint.due()) await breakpoint.yield()`, which gives the event loop a
  task every 50 ms so the posted abort can land. Two calls rather than one
  because a per-item `await` of a non-promise costs a microtask (the last row
  of the second table), and a loop over every read in a pileup would notice.
  The yield is a `MessageChannel` task in any browser realm, Electron's
  included, and a zero timer in plain Node and jsdom, where a port turn runs
  no due timer. Not `scheduler.yield`: in Chrome and Electron workers its
  continuation outranks the posted abort, and the loop runs to completion.
  The genotype and phased-genotype matrix fills, the wiggle score matrix, the
  GC window and the dotplot and synteny position loops are the loops of that
  shape. `report()` reads the signal but never yields, so it does not make a
  loop interruptible; the old probe did, and every report()-driven loop lost
  mid-loop cancel with it. What stops short of a breakpoint is a loop bounded
  by the byte gate or by one region's features — alignments processing, canvas
  layout, variant cells, `encodeFeatures`, the Hi-C pack — which finishes in
  well under a second and only checks.
- **`@gmod/hclust` takes the signal** (6.0). Its `checkCancellation` callback
  ran inside one synchronous WASM call, where only the probe could interrupt
  it, and a throw from there unwound past the C cleanup and leaked the n²
  distance matrix: at 10,000 samples the sixth run after five cancels ran out
  of memory. 6.0 slices every O(n²) phase into 50 ms steps, yields a task
  between them, and frees the run on abort; a Chrome worker cancels a
  4000-sample run 20–50 ms after the abort is posted.

The `SharedArrayBuffer` arm goes with the probe. It sped up a check no shipped
page took, and ADR-056's reason not to isolate jbrowse.org stands with nothing
left that isolation would buy.

## Measurements

`website/scripts/cancel-mechanism-bench.ts` runs a fixed matrix fill in a real
Chrome worker and consults its cancellation once per pass, one arm per
mechanism; the records are
[`cancel-mechanism.json`](../measurements/cancel-mechanism.json) and
[`abort-check-per-item.json`](../measurements/abort-check-per-item.json).

<!-- BEGIN GENERATED MEASUREMENT cancel-mechanism -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm        | uncancelled run | checks per run | a cancel lands    | overrun, median | overrun, max |
| ---------- | --------------: | -------------: | ----------------- | --------------: | -----------: |
| none       |          5091ms |              0 | n/a               |             0ms |          0ms |
| set        |          5466ms |             16 | ran to completion |          4205ms |       5856ms |
| probe      |          4610ms |             14 | mid-loop          |           172ms |        309ms |
| yield      |          5852ms |             17 | mid-loop          |           174ms |        313ms |
| yield-flat |          5403ms |             84 | mid-loop          |            23ms |         31ms |

<!-- END GENERATED MEASUREMENT cancel-mechanism -->

The `set` arm is the message path alone, which a loop that never yields cannot
receive — it is the arm that ran to completion. The probe and the yield cancel
mid-loop at the same overrun, because both sat behind the same 50→500 ms
backoff; the backoff existed for the probe's believed cost, and `yield-flat`
drops it. Both yield arms yield a `MessageChannel` task, which is what ships;
`scheduler.yield` starves posted messages in Chromium workers, so a loop
yielding through it never receives the abort. The uncancelled columns of the
two yield arms carry a neighbour's load from the run this was recorded on, and
are to be re-read on a quiet machine before anyone quotes an overhead from them.

<!-- BEGIN GENERATED MEASUREMENT abort-check-per-item -->

_Generated by `pnpm autogen` — edit the source, not this block._

| per-item check                           | cost per item, ns |
| ---------------------------------------- | ----------------: |
| none (loop body alone)                   |                 2 |
| `signal.aborted`                         |                11 |
| `Map.has` (the retired stopped-id set)   |                 7 |
| `if (breakpoint.due())` (a counter bump) |                 2 |
| `await` of a non-promise                 |                43 |

<!-- END GENERATED MEASUREMENT abort-check-per-item -->

## Consequences

- **The ABI.** The nine stop-token names leave `@jbrowse/core/util`;
  `checkAbortSignal`, `withAbortCheck`, `createAbortBreakpoint` and
  `createAbortRotation` arrive. `abiBaseline.json` drops the removals in this
  commit; the v5 removal tables name `AbortController` as what took over.
  `WorkerHandle` loses `notifyStopToken` and its `call` options gain `signal`,
  which a `Core-extendWorker` wrapper that forwards its options keeps for free.
  `jb.createStopToken` / `jb.stopStopToken` leave the agent API; an agent
  constructs an `AbortController`.
- **A registry entry declaring `signal` fails the build**, the way one declaring
  `stopToken` did (`EntriesDeclaringCallLevelFields`).
- **Nothing is released at the end of a fetch any more.** A completed fetch's
  token used to pin its signal controllers and blob URL until something stopped
  it; a signal is garbage like any other object, so `createAbortRotation.end()`
  and the desktop indexing job's `clear()` no longer abort what finished.
- **`RpcServer` holds one controller per abortable call in flight**, deleted
  when the call settles. An abort frame for a settled or unknown uid is a no-op.
- **Under jest the yield is a timer**, so a test that drives a breakpoint loop
  aborts it with `setTimeout`, as `aborting.test.ts` does. The browser path is
  what the bench above exercises.
- **The per-base cancel overrun** measured in
  [PER_BASE_SUBPIXEL_BIN.md](../reference/PER_BASE_SUBPIXEL_BIN.md) was the
  gate's; `report()` now reads the signal on every call. Not re-measured.
- `coi-probe.ts`, `coi-server.ts` and `cancel-bench.ts` are gone: each measured
  a mechanism that no longer exists.
