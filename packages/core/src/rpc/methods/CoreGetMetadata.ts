import { isFeatureAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

export default class CoreGetMetadata extends RpcMethodType<'CoreGetMetadata'> {
  name = 'CoreGetMetadata' as const

  async execute(args: RpcExecuteArgs<'CoreGetMetadata'>) {
    const pm = this.pluginManager
    const { sessionId, adapterConfig } = args
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    return isFeatureAdapter(dataAdapter) ? dataAdapter.getMetadata(args) : null
  }
}
