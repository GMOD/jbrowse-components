import { getRpcSessionId } from './parentWalk.ts'
import { getRpcHost } from './sessionServices.ts'

import type { RpcCallArgs, RpcCallReturn } from '../rpc/RpcRegistry.ts'
import type { StatusCallback } from './progress.ts'
import type { StopToken } from './stopToken.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface FetchContext {
  stopToken: StopToken
  isStale: () => boolean
  /**
   * The RPC `statusCallback` for the work this context describes: guarded to
   * this fetch (a superseded one cannot repaint the overlay of the fetch that
   * replaced it) and throttled through the display-wide window. `callRpc`
   * injects it — read it directly only for a status write of your own
   * (`updateStatus` phase labels).
   *
   * The fan-out helpers hand each region a context whose callback is that
   * region's own slot (`callEachRegion`, and `fetchEachRegion` through it), so
   * a `ctx.callRpc` aggregates N parallel regions into one bar in the fan-out
   * case and reports the whole fetch in the batched one. Reading it off the
   * model instead — or reusing the *outer* ctx's inside a fan-out — is what
   * made parallel regions clobber each other's progress, and is now the thing
   * you would have to go out of your way to do.
   */
  statusCallback: StatusCallback
  /**
   * The one way a fetch calls an RPC: the registry-typed
   * `rpcManager.call(rpcSessionId, method, args)` with this context's
   * `stopToken` and `statusCallback` injected. Both used to be hand-threaded
   * at every fetch site, and forgetting either was silent — no cancellation
   * for that display, or no progress — which is exactly the failure class the
   * envelope makes inexpressible: a fetch cannot issue an RPC the cancel and
   * the status bar don't know about.
   *
   * Declared with a `this` parameter so it reads the *holding* context's
   * token and callback — the fan-out copies rebind it to their own status
   * slot by construction — and so destructuring it off the context is a type
   * error rather than a stale binding.
   */
  callRpc: <M extends string>(
    this: FetchContext,
    method: M,
    args: Omit<RpcCallArgs<M>, 'stopToken' | 'statusCallback'>,
  ) => Promise<RpcCallReturn<M>>
}

/**
 * Build a {@link FetchContext} over a live fetch's primitives. One
 * constructor, so every context — `runFetch`'s, the prerequisite skeleton's —
 * carries the same `callRpc` envelope.
 */
export function makeFetchContext(
  self: IStateTreeNode,
  base: {
    stopToken: StopToken
    isStale: () => boolean
    statusCallback: StatusCallback
  },
): FetchContext {
  return {
    ...base,
    callRpc(method, args) {
      return getRpcHost(self).rpcManager.call(getRpcSessionId(self), method, {
        ...args,
        stopToken: this.stopToken,
        statusCallback: this.statusCallback,
      } as RpcCallArgs<typeof method>)
    },
  }
}
