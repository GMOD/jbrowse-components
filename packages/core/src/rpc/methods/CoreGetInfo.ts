import { isFeatureAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

export default class CoreGetInfo extends RpcMethodType<'CoreGetInfo'> {
  name = 'CoreGetInfo' as const

  async execute(args: RpcExecuteArgs<'CoreGetInfo'>) {
    const { sessionId, adapterConfig, sequenceAdapter } = args
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
      sequenceAdapter,
    )
    return isFeatureAdapter(dataAdapter) ? dataAdapter.getHeader(args) : null
  }
}
