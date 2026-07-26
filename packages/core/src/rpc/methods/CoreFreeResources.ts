import { freeAdapterResources } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

/**
 * Drop cached data adapters associated with the given session.
 *
 * UNUSED: nothing in the app calls this — the only callers are RpcManager tests.
 * So the worker-side adapter cache is never pruned (it has no size bound
 * either), and `RpcManager`'s CoreFreeResources special case plus every
 * driver's `freeSession` are dead in production. Wiring it up means picking a
 * teardown hook (display beforeDestroy, session switch) and relying on the
 * cache entry's `sessionIds` refcount to keep adapters shared by another
 * session alive.
 */
export default class CoreFreeResources extends RpcMethodType<'CoreFreeResources'> {
  name = 'CoreFreeResources'

  async execute(args: { sessionId?: string }) {
    await freeAdapterResources(args)
  }

  async serializeArguments(args: Record<string, unknown>, _rpcDriver: string) {
    return args
  }
}
