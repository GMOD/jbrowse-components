import { isFeatureAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

export default class CoreGetInfo extends RpcMethodType<'CoreGetInfo'> {
  name = 'CoreGetInfo' as const

  async execute(args: RpcExecuteArgs<'CoreGetInfo'>) {
    const pm = this.pluginManager
    const { sessionId, adapterConfig } = args
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    return isFeatureAdapter(dataAdapter) ? dataAdapter.getHeader(args) : null
  }
}
