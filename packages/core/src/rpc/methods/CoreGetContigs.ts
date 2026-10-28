import {
  isContigSource,
  isRefNameSource,
} from '../../data_adapters/BaseAdapter/util.ts'
import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

/**
 * The file's contigs with the lengths its header states. `loadRefNameMap`
 * builds the rename map from these names, so an adapter whose file states no
 * lengths answers with its refNames alone.
 */
export default class CoreGetContigs extends RpcMethodType<'CoreGetContigs'> {
  name = 'CoreGetContigs' as const

  async execute(args: RpcExecuteArgs<'CoreGetContigs'>) {
    const { sessionId, adapterConfig, sequenceAdapter } = args
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
      sequenceAdapter,
    )
    if (isContigSource(dataAdapter)) {
      return dataAdapter.getContigs(args)
    }
    return isRefNameSource(dataAdapter)
      ? (await dataAdapter.getRefNames(args)).map(refName => ({ refName }))
      : []
  }
}
