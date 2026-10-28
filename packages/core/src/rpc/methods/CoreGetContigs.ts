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
      const contigs = await dataAdapter.getContigs({
        ...args,
        contigLengthsOnly: true,
      })
      return {
        refNames: contigs.map(c => c.refName),
        lengths: contigs.map(c => c.length),
      }
    }
    return {
      refNames: isRefNameSource(dataAdapter)
        ? await dataAdapter.getRefNames(args)
        : [],
      lengths: [],
    }
  }
}
