---
id: fetchmixin
title: FetchMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/FetchMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/FetchMixin.md)

## Overview

Cancel-safe fetch lifecycle for any display that loads data over RPC. Owns the
entire fetch state machine (stop-token rotation, staleness tracking, error
capture, status reporting); consumers see only `runFetch`, `cancelFetch`,
`isLoading`, `error`, `statusMessage`, and `fetchGeneration`.

### FetchMixin - Volatiles

#### volatile: activeStopToken

stop token of the in-flight fetch, or undefined when idle

```js
// type signature
StopToken | undefined
// code
activeStopToken: undefined as StopToken | undefined
```

#### volatile: fetchGeneration

bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the
staleness epoch inside runFetch

```js
// type signature
number
// code
fetchGeneration: 0
```

#### volatile: error

last non-abort fetch error, or undefined

```js
// type signature
unknown
// code
error: undefined as unknown
```

#### volatile: statusMessage

work-in-progress status string

```js
// type signature
string | undefined
// code
statusMessage: undefined as string | undefined
```

#### volatile: statusProgress

determinate progress fraction [0,1] for the current status, or undefined when
the in-flight phase is indeterminate

```js
// type signature
number | undefined
// code
statusProgress: undefined as number | undefined
```

#### volatile: regionStatuses

latest status of each concurrent in-flight operation, keyed by an arbitrary id
(the canvas display uses displayedRegionIndex). Plain bookkeeping — not read
reactively; setRegionStatus derives the observable statusMessage/statusProgress
from it on every update so N parallel region fetches aggregate into one bar
instead of clobbering.

```js
// type signature
Map<number, RpcStatus>
// code
regionStatuses: new Map<number, RpcStatus>()
```

### FetchMixin - Getters

#### getter: isLoading

true while a fetch is active

```js
// type
boolean
```

### FetchMixin - Actions

#### action: setError

```js
// type signature
setError: (error?: unknown) => void
```

#### action: setStatusMessage

```js
// type signature
setStatusMessage: (status?: RpcStatus | undefined) => void
```

#### action: setRegionStatus

Record one concurrent operation's latest status (keyed) and recompute the shared
statusMessage/statusProgress as the aggregate across all in-flight keys. Pass
undefined to drop a key. Used by displays that fan a single fetch out into
parallel per-region RPCs.

```js
// type signature
setRegionStatus: (key: number, status?: RpcStatus | undefined) => void
```

#### action: cancelFetch

cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers
can retrigger fetch autoruns even when nothing was in flight)

```js
// type signature
cancelFetch: () => void
```

#### action: runFetch

Run a cancel-safe fetch (cancels any prior). The work callback gets a
FetchContext with a stopToken to forward to the RPC and an isStale() check to
short-circuit commits once the user has moved on. Abort errors are swallowed;
others are stored in `error` if not stale.

```js
// type signature
runFetch: (work: (ctx: FetchContext) => Promise<void>) => Promise<void>
```
