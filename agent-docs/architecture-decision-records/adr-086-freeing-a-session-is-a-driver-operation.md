---
status: Accepted
summary: "Freeing a session is a driver lifecycle operation, not an RPC call, and RpcManager.destroy is terminal. Routing the free through `call` made teardown boot the worker pool `detach()` had just terminated"
---

# ADR-086: freeing a session is a driver operation, and destroy is terminal

## Status

Accepted (2026-08-22).

## Context

ADR-069 splits a root model's teardown in two: `detach()` stops everything
reaching outside the tree — the worker pool among them — and the tree itself is
destroyed on a later task, because React is not finished reading the outgoing
props. Its own argument for why the deferral is safe is that `detach()` has
already stopped everything that would otherwise keep running in the gap.

Destroying the tree is also what runs every `addDisposer` in it, and
`BaseTrackModel` registers one that releases its `rpcSessionId` claim. At zero
claims `releaseAdapterSession` asks the worker to drop the adapters cached under
that id — the only thing that ever makes a parsed BAM or a whole parsed GFF3
collectable, since the cache is rooted in the worker's module scope.

So the free ran one task *after* the pool it addresses was terminated, and it ran
as an ordinary RPC: `rpcManager.call(sessionId, 'CoreFreeResources', …)`, plus a
`functionName === 'CoreFreeResources'` branch in the manager's `finally` to drop
the driver's assignment afterwards. Neither half refused to work on a destroyed
manager, and nothing in the shape of a `call` could:

- `RpcManager.destroy` cleared its driver cache, so the next `getDriver` built a
  second `WebWorkerRpcDriver`;
- `WorkerPoolRpcDriver.destroy` dropped its pool, and `getWorkerPool`'s `??=`
  built a second one;
- `transport` routes through `getWorker`, which **boots** the assigned slot.

Each free therefore started a fresh worker — the whole worker bundle and every
runtime plugin — to tell it about an adapter cache it had never filled, and
`createWorkerPool`'s stop-token broadcaster registration then rooted that worker
in a module-global `Set`, so it was not merely un-terminated but uncollectable.
Up to `workerCount` of them per session switch, on both jbrowse-web's config swap
and jbrowse-desktop's start-screen swap. Reading the config off the dying tree
did not stop it: MST's `die()` runs `aboutToDie` over the whole subtree before
any `finalizeDeath`, so every disposer sees a live tree, and a slot read off a
node that *has* died warns and still returns its value.

The same routing had a quieter cost with no teardown involved: a session with no
worker assignment is one that never dispatched anything, and freeing it booted a
worker anyway. Every track closed before it fetched paid for one.

## Decision

**Freeing a session is a driver lifecycle operation.** `BaseRpcDriver.freeSession`
replaces the manager's magic-string branch, and each driver answers it where its
adapters actually live:

- the base (and so `MainThreadRpcDriver`) invokes `CoreFreeResources` in this
  realm;
- `WebWorkerRpcDriver` looks the session up in its own assignment table, drops
  the entry, and calls the worker **only if that slot has one** — never booting
  one, the same rule `notifyStopToken` already followed.

`RpcManager.freeSession(sessionId)` is what `releaseAdapterSession` calls.

**`destroy` is terminal**, on the manager and on the pool. A later `call` or
`getDriver` throws rather than silently building a replacement. This is the
second half rather than the whole fix on purpose: the free path is now inert
after a destroy by construction, and the guard covers the other traffic in
ADR-069's gap — a fetch autorun that has not been disposed yet, whose call would
otherwise resurrect the pool. `freeSession` after a destroy is silent, not an
error, because the destroy already freed strictly more than it would.

**The driver-factory registry is gone** — `registerDriverFactory`,
`driverFactories`, `driverObjects`, `RpcDriverFactory`. It was documented as the
way a plugin supplies its own driver and could never have been: a factory returns
a `BaseRpcDriver`, and `@jbrowse/core` has no `exports` entry for that class, so
no plugin can name the type. `RpcManager` resolves `rpc.defaultDriver` (or the
host default) once and holds the one driver, which also takes a `readConfObject`
off the dispatch path of every call — a read that, reached from an autorun body,
made the pool's own configuration a dependency of every fetch.

**The driver hierarchy is two deep, not three.** `WorkerPoolRpcDriver` was an
abstract base over one `makeWorker`, which had one implementation; it is folded
into `WebWorkerRpcDriver`, where `makeWorker` is a plain overridable method —
all the tests ever wanted from the seam. `RpcDriverConstructorArgs` and
`WebWorkerRpcDriverConstructorArgs` go with it: a driver takes its config
positionally and, if it needs more, one options object rather than two.

**One `driverName` getter replaces `mainConfiguration` and `defaultDriverName`
on the manager's surface.** Both were public only so the About widget and the
error-stack dialog could re-derive `readConfObject(config, 'defaultDriver') ||
hostDefault` — three copies of the rule for where a call goes, one of them
carrying a cast.

**A driver holds its `PluginManager` instead of being handed one per call.**
`call`, `transport` and `freeSession` each took one as their first parameter and
the manager passed the same object to all of them on every RPC. Holding it is
also what lets `Core-extendWorker` fire from `LazyWorker`, where a worker boots,
rather than from `transport`, which is the only place that had a plugin manager
— so the fold is once-per-worker by construction and the WeakMap that memoized
it per dispatch is gone.

**`Core-extendWorker` stays, and its declared type finally covers what it is
used for.** `WorkerHandle` gains `on?(eventName, listener)` and
`postMessage?(message)`. The only consumer is jbrowse-plugin-apollo, whose
worker-side sequence adapter asks the main thread for sequence across this seam,
and it was reaching a `private client` and a public `worker` that the interface
promised nothing about — so the hook worked only because TypeScript erases
`private`. See "Consequences" for what that costs them.

**The pool drives a worker's life on the handle it booted, not on what the fold
returns.** `WorkerHandle` makes `onError` and `notifyStopToken` optional, so a
wrapper that spreads the handle and forwards `call` — the obvious way to write
one — conforms while carrying neither, and a slot driven through it never
notices a dead worker and never re-boots. `LazyWorker` keeps the two apart:
`bootP` for the error hook and the termination, `workerP` for calls. The
dispatch-time fold got this right by accident, by only ever using the extended
handle for `call`; moving the fold made it a decision, and a test caught the day
it stopped being true.

## Consequences

- Tearing a session down spawns no workers. The outgoing pool is terminated once
  and stays terminated; the incoming session boots its own on its first fetch,
  as it always did.
- Closing a track that never fetched costs nothing.
- `RpcManager` is one driver, not a registry of them; the two built-ins are named
  in `makeDriver`.
- Plugin-supplied RPC drivers are not a thing that regressed — they were never
  reachable. Restoring them means deciding to export `BaseRpcDriver`, which is
  the decision nobody made. See `reference/PLUGIN_ABI_STABILITY.md`.
- **jbrowse-plugin-apollo has two lines to change**, on `main` and on its
  `jbrowse_5` branch: `handle.client.on(…)` becomes `handle.on(…)` (and the
  guard above it, `'on' in handle.client`, becomes `'on' in handle`), and
  `handle.worker.postMessage(…)` becomes `handle.postMessage(…)`. Both now name
  something `WorkerHandle` declares, so the plugin stops depending on a private
  field surviving into the emitted JS.

## Rejected alternatives

**Keep the free as a `call` and teach the pool not to boot for that one method.**
Moves the magic string from the manager into the driver and leaves the free
outliving `destroy`. The knowledge that a free has nothing to do without a
transport is a property of the operation, not of a method name a transport
pattern-matches.

**Let `destroy` stay non-terminal and only fix the boot.** A driver that keeps
working after the teardown that killed it is the shape the bug came in; a test
asserted the rebuild as a feature. Nothing in the tree destroys an RpcManager and
then means to use it — all three production callers are terminal.

**Free eagerly in `detach()` instead of deferring.** The refcount is not known
there: `detach()` runs before the disposers that release the claims, so it cannot
tell which sessions are actually going away, and ADR-069 will not move the
disposers earlier.
