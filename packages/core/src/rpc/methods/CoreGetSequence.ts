import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'
import { renameRegionsIfNeeded } from '../../util/index.ts'

import type { RenderArgs } from './util.ts'
import type { BaseSequenceAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import type { Region } from '../../util/index.ts'

export default class CoreGetSequence extends RpcMethodType {
  name = 'CoreGetSequence'

  async serializeArguments(args: RenderArgs, rpcDriver: string) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel!.session!.assemblyManager
    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)
    return super.serializeArguments(
      renamedArgs,
      rpcDriver,
    ) as Promise<RenderArgs>
  }

  async execute(
    args: {
      sessionId: string
      region: Region
      adapterConfig: Record<string, unknown>
      stopToken?: string
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
