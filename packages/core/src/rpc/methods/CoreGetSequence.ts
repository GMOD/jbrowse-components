import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

import type { BaseSequenceAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import type { Region } from '../../util/index.ts'
import type { StopToken } from '../../util/stopToken.ts'

// CoreGetSequence takes a single region whose refName fetchSeq() has already
// resolved to the sequence adapter's name, so no region renaming is needed here
export default class CoreGetSequence extends RpcMethodType {
  name = 'CoreGetSequence'

  async execute(
    args: {
      sessionId: string
      region: Region
      adapterConfig: Record<string, unknown>
      stopToken?: StopToken
    },
    rpcDriver: string,
  ) {
    const { stopToken, sessionId, adapterConfig, region } =
      await this.deserializeArguments(args, rpcDriver)

    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseSequenceAdapter

    return dataAdapter.getSequence(region, { stopToken })
  }
}
