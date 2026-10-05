import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

/**
 * Load the code a track's first request runs in the worker it is about to use:
 * its adapter classes and the RPC methods its display names. Each arrives by
 * dynamic import on that request otherwise, after the view lays out, the
 * assembly loads and the request's refNames resolve.
 */
export default class CoreLoadTrackCode extends RpcMethodType<'CoreLoadTrackCode'> {
  name = 'CoreLoadTrackCode' as const

  async execute({
    adapterTypes,
    rpcMethods,
  }: RpcExecuteArgs<'CoreLoadTrackCode'>) {
    const { pluginManager } = this
    await Promise.all([
      ...adapterTypes.map(type =>
        pluginManager.getAdapterType(type).getAdapterClass(),
      ),
      ...rpcMethods.map(name => pluginManager.getRpcMethodType(name).preload()),
    ])
  }

  async serializeArguments(args: Record<string, unknown>) {
    return args
  }
}
