import { freeAdapterResources } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

/**
 * Drop cached data adapters associated with the given session.
 *
 * Reached from `releaseAdapterSession` (`data_adapters/adapterSessionRefcount`)
 * when the last track model holding an rpcSessionId is destroyed — closing a
 * track, closing its view, or switching session. It counts the holders because
 * an rpcSessionId is derived from the adapter config and so is shared by every
 * track configured alike; the cache entry's own `sessionIds` refcount then keeps
 * an adapter alive for any *other* session still using it, which is what makes a
 * shared sub-adapter safe.
 *
 * This does not bound the cache, and is not meant to: an adapter whose track is
 * open stays cached however long that takes.
 */
export default class CoreFreeResources extends RpcMethodType<'CoreFreeResources'> {
  name = 'CoreFreeResources' as const

  async execute(args: RpcExecuteArgs<'CoreFreeResources'>) {
    await freeAdapterResources(args)
  }

  async serializeArguments(args: Record<string, unknown>) {
    return args
  }
}
