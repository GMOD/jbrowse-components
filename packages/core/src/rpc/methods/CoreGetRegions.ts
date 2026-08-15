import { isRegionsAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

export default class CoreGetRegions extends RpcMethodType<'CoreGetRegions'> {
  name = 'CoreGetRegions' as const

  async execute(args: RpcExecuteArgs<'CoreGetRegions'>) {
    const pm = this.pluginManager
    const { sessionId, adapterConfig } = args
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    return isRegionsAdapter(dataAdapter) ? dataAdapter.getRegions(args) : []
  }
}
