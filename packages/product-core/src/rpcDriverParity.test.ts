import { serialize } from 'node:v8'

import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

import { wrapForRpc } from './rpcWorker.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcStatus } from '@jbrowse/core/util'

/**
 * The two drivers are one contract, and they have disagreed about it three
 * times: `WebWorkerRpcDriver` honored a `statusCallback` in an `opts`
 * parameter that `MainThreadRpcDriver` ignored entirely (see `RpcManager.call`'s
 * docstring); the worker then manufactured a `statusCallback` for a caller who
 * passed none while the main thread passed the `undefined` through; and
 * `MainThreadRpcDriver` spread a `statusCallback: undefined` key that
 * `wrapForRpc` does not add. All three were found by reading, none by a test,
 * and each was live in the driver every worker deployment uses.
 *
 * So: run one call both ways and compare. Same doctrine as `crossBackendGate`
 * for the render backends — a correctness oracle needing no golden, because the
 * other implementation is the oracle.
 *
 * Driven through `RpcManager` rather than the drivers directly, because that is
 * the entry point every caller has and the one that picks between them; the
 * drivers are not in core's export map at all.
 *
 * Here rather than in `@jbrowse/core` because the worker half of the contract is
 * `wrapForRpc`, which lives in this package — core importing it would be an
 * upward dependency edge, and `scripts/workspaceLayering.test.ts` pins that
 * those are deliberate.
 */

// the bare-`string` escape hatch RpcMethodType documents: a name with no
// RpcRegistry entry otherwise resolves to `NotInRpcRegistry`, which nothing
// satisfies
const METHOD: string = 'ParityMethod'

interface Arm {
  executeArgs: Record<string, unknown>
  statuses: RpcStatus[]
}

/**
 * A `Worker` stand-in wired into an `RpcServer` whose methods come from
 * `wrapForRpc` — the wiring `initializeWorker` builds, so the arm under test is
 * the shipped one rather than a re-implementation.
 *
 * **Every frame is checked for cloneability, and `structuredClone` is not what
 * checks it.** This realm has no native one, so `config/jest/structuredClone.js`
 * installs a `JSON.parse(JSON.stringify())` shim — which accepts a function and
 * rewrites a Map, i.e. it would turn this arm's whole reason for existing into a
 * test of the shim. That file's own comment records a DataCloneError that
 * reached production behind exactly this.
 *
 * `node:v8`'s serializer is the real algorithm and throws the real message. Its
 * OUTPUT is discarded and the original value passed on: deserializing crosses
 * into node's realm, where the `Float32Array` a packer built stops answering to
 * jsdom's `instanceof`. So this checks serializability and does not simulate the
 * copy — worth knowing if you add a case about mutation across the boundary.
 * (A jsdom `File` would be a false positive here; postMessage takes one and v8
 * does not. Nothing in these payloads carries one.)
 *
 * Transferables are not transferred either — a real transfer detaches the
 * sender's copy, and both sides get read.
 */
function loopbackWorker() {
  const listeners: Record<string, ((e: MessageEvent) => void)[]> = {}
  let onServerMessage: ((e: MessageEvent) => void) | undefined
  const crossable = (data: unknown) => {
    serialize(data)
    return data
  }
  const api = {
    setServer(handler: (e: MessageEvent) => void) {
      onServerMessage = handler
    },
    worker: {
      postMessage: (data: unknown) => {
        onServerMessage?.(
          new MessageEvent('message', { data: crossable(data) }),
        )
      },
      addEventListener: (type: string, fn: (e: MessageEvent) => void) => {
        ;(listeners[type] ??= []).push(fn)
        // A real worker posts `ready` once its own script has booted, which is
        // after the driver has attached. Registering the listener is the only
        // observable moment we have, and `makeWorker` attaches several awaits
        // into `manager.call` — so announce on every registration rather than
        // trying to schedule it from the outside, which fires too early.
        if (type === 'message') {
          setTimeout(() => {
            api.deliver({ message: 'ready' })
          }, 0)
        }
      },
      removeEventListener: (type: string, fn: (e: MessageEvent) => void) => {
        const l = listeners[type]
        if (l) {
          l.splice(l.indexOf(fn), 1)
        }
      },
      terminate: () => {},
    } as unknown as Worker,
    deliver(data: unknown) {
      for (const fn of [...(listeners.message ?? [])]) {
        fn(new MessageEvent('message', { data: crossable(data) }))
      }
    },
  }
  return api
}

function makeMethod(arm: Arm) {
  return new (class extends RpcMethodType {
    name = METHOD

    async execute(args: any) {
      const { statusCallback, ...rest } = args
      arm.executeArgs = {
        ...rest,
        // the key's PRESENCE is half of what drifted, so record it rather than
        // letting a spread of `undefined` compare equal to an absent key
        declaresStatusCallback: 'statusCallback' in args,
      }
      statusCallback?.('halfway')
      return { echoed: rest.payload }
    }
  })({} as PluginManager)
}

function newArm(): Arm {
  return { executeArgs: {}, statuses: [] }
}

// the two members a driver reaches for: the method to run, and the
// `Core-extendWorker` fold the pool applies once per booted worker
function stubPluginManager(method: RpcMethodType) {
  return {
    getRpcMethodType: () => method,
    evaluateExtensionPoint: (_name: string, worker: unknown) => worker,
  } as unknown as PluginManager
}

async function runMainThread(arm: Arm, args: Record<string, unknown>) {
  const method = makeMethod(arm)
  const manager = new RpcManager(
    stubPluginManager(method),
    RpcManager.configSchema.create({}),
  )
  return manager.call('sid', METHOD, args)
}

async function runWorker(arm: Arm, args: Record<string, unknown>) {
  const { RpcServer } = await import('@jbrowse/core/util/librpc')
  const method = makeMethod(arm)
  const loopback = loopbackWorker()

  const originalPost = (globalThis as any).postMessage
  ;(globalThis as any).postMessage = (data: unknown) => {
    loopback.deliver(data)
  }
  try {
    const server = new RpcServer({
      [METHOD]: wrapForRpc(method.invoke.bind(method)),
    })
    // wrapForRpc emits status through `self.rpcServer`, exactly as the real
    // worker entry sets it
    ;(globalThis as any).rpcServer = server
    loopback.setServer(e => {
      server.handler(e)
    })

    const manager = new RpcManager(
      stubPluginManager(method),
      RpcManager.configSchema.create({}),
      {
        makeWorkerInstance: () => loopback.worker,
        defaultDriverName: 'WebWorkerRpcDriver',
      },
    )
    return await manager.call('sid', METHOD, args)
  } finally {
    ;(globalThis as any).postMessage = originalPost
  }
}

async function bothDrivers(
  args: Record<string, unknown>,
  { withStatus }: { withStatus: boolean },
) {
  const main = newArm()
  const worker = newArm()
  const argsFor = (arm: Arm) => ({
    ...args,
    ...(withStatus
      ? {
          statusCallback: (s: RpcStatus) => {
            arm.statuses.push(s)
          },
        }
      : {}),
  })
  const mainResult = await runMainThread(main, argsFor(main))
  const workerResult = await runWorker(worker, argsFor(worker))
  return { main, worker, mainResult, workerResult }
}

test('both drivers hand execute the same args, and the caller the same result', async () => {
  const { main, worker, mainResult, workerResult } = await bothDrivers(
    { payload: { n: 41 } },
    { withStatus: true },
  )

  expect(worker.executeArgs).toEqual(main.executeArgs)
  expect(workerResult).toEqual(mainResult)
  expect(main.statuses).toEqual(['halfway'])
  expect(worker.statuses).toEqual(['halfway'])
})

// The one that was live: the worker minted a status channel for every call, so a
// method run under it saw a `statusCallback` its caller had declined while the
// same method under MainThreadRpcDriver saw `undefined`. Every "no status
// channel" branch in the worker was unreachable in production as a result.
test('a caller who passes no statusCallback gets none under either driver', async () => {
  const { main, worker, mainResult, workerResult } = await bothDrivers(
    { payload: { n: 41 } },
    { withStatus: false },
  )

  expect(main.executeArgs.declaresStatusCallback).toBe(false)
  expect(worker.executeArgs.declaresStatusCallback).toBe(false)
  expect(worker.executeArgs).toEqual(main.executeArgs)
  expect(workerResult).toEqual(mainResult)
})

// The worker arm checks every frame for real, so it is also the check almost
// nothing else in the suite performs: an RPC unit test either calls `execute`
// directly or runs on the main-thread driver, and neither serializes anything.
// A payload postMessage refuses passes both.
test('the worker arm refuses a payload the main thread accepts', async () => {
  const main = newArm()
  const worker = newArm()
  const uncloneable = { payload: { fn: () => {} } }

  await expect(runMainThread(main, uncloneable)).resolves.toBeDefined()
  await expect(runWorker(worker, uncloneable)).rejects.toThrow(
    /could not be cloned|DataCloneError/,
  )
})
