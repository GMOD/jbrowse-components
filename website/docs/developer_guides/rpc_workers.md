---
title: RPC and worker system
id: rpc_workers
description: How to register and call RPC methods that run in web workers
guide_category: Core concepts
---

JBrowse runs data-intensive work (parsing adapters, computing layouts, encoding
GPU buffers) inside web workers via an RPC layer. The main thread dispatches
calls by name; a pool of workers receives them and returns results via structured
clone.

## The RPC lifecycle

```
Main thread                          Worker
───────────                          ──────
rpcManager.call('MyMethod', args)
  → serializeArguments()
  → structured-clone to worker    →  deserializeArguments()
                                      execute() ← your code
  ← deserializeReturn()          ←  serializeReturn()
result
```

Sessions are sticky: a `sessionId` is assigned to one worker via round-robin
and stays there, so adapter caches remain warm across calls from the same
session.

## Implementing an RPC method

Extend `RpcMethodType` and implement `execute()`:

```ts
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface MyRpcArgs {
  sessionId: string
  adapterConfig: AnyConfigurationModel
  region: { refName: string; start: number; end: number; assemblyName: string }
  stopToken?: StopToken
}

export default class MyRpcMethod extends RpcMethodType {
  name = 'MyRpcMethod'

  async execute(args: MyRpcArgs, rpcDriverClassName: string) {
    // Always deserialize first — handles blob map and other transport concerns
    const { sessionId, adapterConfig, region, stopToken } =
      await this.deserializeArguments(args, rpcDriverClassName)

    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )

    // Do your work here — this runs in the worker
    return computeResult(dataAdapter, region, stopToken)
  }
}
```

### Renaming regions

If your method receives `Region` objects, call `renameRegions` inside
`serializeArguments` so refName aliases are resolved before the args cross the
worker boundary:

```ts
async serializeArguments(args: MyRpcArgs, rpcDriverClassName: string) {
  return super.serializeArguments(
    await this.renameRegions(args),
    rpcDriverClassName,
  )
}
```

### Returning ArrayBuffers zero-copy

Wrap results with `rpcResult` to transfer `ArrayBuffer`s without copying:

```ts
import { rpcResult } from '@jbrowse/core/util/rpc'

async execute(args: MyRpcArgs, rpcDriverClassName: string) {
  const { sessionId, adapterConfig, region } =
    await this.deserializeArguments(args, rpcDriverClassName)
  const buf = await buildBuffer(...)
  // Second argument is the transfer list — buffers are moved, not copied
  return rpcResult(buf, [buf.buffer])
}
```

## Registering the method

In your plugin's `install()`:

```ts
import Plugin from '@jbrowse/core/Plugin'
import type PluginManager from '@jbrowse/core/PluginManager'

import MyRpcMethod from './MyRpcMethod.ts'

export default class MyPlugin extends Plugin {
  name = 'MyPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addRpcMethod(() => new MyRpcMethod(pluginManager))
  }
}
```

## Calling from the main thread

```ts
import { getRpcSessionId } from '@jbrowse/core/util'
import { getSession } from '@jbrowse/core/util'

// Inside an MST action or async function that has access to a model
const sessionId = getRpcSessionId(self)
const { rpcManager } = getSession(self)

const result = await rpcManager.call(sessionId, 'MyRpcMethod', {
  sessionId,
  adapterConfig: self.adapterConfig,
  region: { refName: 'chr1', start: 0, end: 1000, assemblyName: 'hg38' },
})
```

## What can cross the worker boundary

The worker boundary uses the [Structured Clone Algorithm][sca]. Safe types:

- Primitives — `string`, `number`, `boolean`, `null`, `undefined`
- `ArrayBuffer`, typed arrays (`Uint8Array`, `Float32Array`, …) — use `rpcResult`
  transfer list to avoid copying
- `File`, `Blob`
- Plain objects and arrays (recursively)
- `Map`, `Set`, `Date`, `RegExp`

**Not safe** — filtered out automatically:

- Functions (including callbacks) — use `statusCallback` mechanism below
- MST model nodes or observables
- Circular references

### Status callbacks

`statusCallback` props are intercepted by the RPC layer and channeled back to
the main thread via a side-channel. Pass it through to your adapter calls:

```ts
// Main thread
await rpcManager.call(sessionId, 'MyRpcMethod', {
  statusCallback: (msg: string) => {
    if (isAlive(self)) self.setStatusMessage(msg)
  },
})

// Worker — statusCallback arrives deserialized and can be called normally
async execute(args, rpcDriverClassName) {
  const { statusCallback } = await this.deserializeArguments(args, rpcDriverClassName)
  statusCallback?.('Loading index…')
}
```

## Type-registering your method

Add an augmentation to `RpcRegistry` so `rpcManager.call` is fully typed:

```ts
// myPlugin/rpcTypes.ts
import type MyRpcArgs from './MyRpcMethod.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcMethods {
    MyRpcMethod: {
      args: MyRpcArgs
      return: MyReturnType
    }
  }
}
```

## Worker count and configuration

The default worker count is `clamp(hardwareConcurrency - 1, 1, 5)`. Users can
override it per-driver in config:

```json
{
  "configuration": {
    "rpc": {
      "defaultDriver": "WebWorkerRpcDriver",
      "drivers": {
        "WebWorkerRpcDriver": { "workerCount": 4 }
      }
    }
  }
}
```

[sca]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
