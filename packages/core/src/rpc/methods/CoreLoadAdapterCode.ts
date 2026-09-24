import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

/**
 * Load these adapter types' code in the worker a track is about to use. An
 * adapter's class arrives by dynamic import on the track's first request
 * otherwise, and that download waits for the view to lay out and the assembly
 * to load.
 */
export default class CoreLoadAdapterCode extends RpcMethodType<'CoreLoadAdapterCode'> {
  name = 'CoreLoadAdapterCode' as const

  async execute({ adapterTypes }: RpcExecuteArgs<'CoreLoadAdapterCode'>) {
    await Promise.all(
      adapterTypes.map(type =>
        this.pluginManager.getAdapterType(type).getAdapterClass(),
      ),
    )
  }

  async serializeArguments(args: Record<string, unknown>) {
    return args
  }
}
