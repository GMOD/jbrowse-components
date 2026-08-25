import { getRpcSessionId } from './parentWalk.ts'
import { createStatusFanOut } from './progress.ts'
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
 *
 * **`self` has to be somewhere `getRpcSessionId` can find one, which in practice
 * means a track or something under it.** `rpcSessionId` is declared by
 * `BaseTrackModel` and by nothing above it, so the walk throws rather than
 * falling back — and a fetch installed on a VIEW gets a context whose `callRpc`
 * cannot be called at all. That is not a gap to fix here: the id names the track
 * whose adapter is being read, and a view fetching for several tracks has a
 * different one per call. The shape is to fan out and rebuild a context per
 * track, which is what the breakpoint split view's overlay fetch does.
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

/**
 * One context per concurrent operation, each carrying its own status slot, so
 * the N of them aggregate into a single Σcurrent/Σtotal bar rather than
 * last-writer-wins on the owner's one status field.
 *
 * A copy of the ctx rather than a separate `slot()` on it because a caller
 * should not have to know which kind of context it holds: the field is called
 * `statusCallback` in both, and `statusCallback: ctx.statusCallback` at the RPC
 * call site is correct in the fan-out and in the batched case alike — as is
 * {@link makeFetchContext}'s `callRpc`, whose `this` parameter rebinds to the
 * copy, so the envelope injects that operation's slot and not the batch's.
 * Callers used to reach back to the model for `makeRegionStatusCallback(index)`,
 * and the whole hazard was that forgetting to looked exactly like remembering
 * to.
 *
 * Here beside `makeFetchContext` rather than in either fetch family, because
 * both fan out inside one run: the per-region LGV helpers over N regions
 * (`callEachRegion`), and the shared `installFetch` skeleton over whatever a
 * display's `run` issues concurrently — the multi-way display's N lanes.
 *
 * The fan-out's lifetime is this batch's: slots are never reclaimed, and the
 * batch is the thing that ends.
 */
export function fanOutStatus<C extends FetchContext>(
  ctx: C,
  count: number,
): C[] {
  const slot = createStatusFanOut(ctx.statusCallback)
  return Array.from({ length: count }, () => ({
    ...ctx,
    statusCallback: slot(),
  }))
}
