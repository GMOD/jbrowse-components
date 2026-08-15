import { getFeatureAdapterOrThrow } from '../../data_adapters/getFeatureAdapter.ts'
import RpcMethodTypeWithRenameRegions from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegions.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

export default class CoreGetExportData extends RpcMethodTypeWithRenameRegions<'CoreGetExportData'> {
  name = 'CoreGetExportData' as const

  async execute(args: RpcExecuteArgs<'CoreGetExportData'>, rpcDriver: string) {
    const {
      sessionId,
      adapterConfig,
      regions,
      formatType,
      opts,
      stopToken,
      statusCallback,
    } = await this.deserializeArguments(args, rpcDriver)

    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })

    // The handles go down to the adapter, which is the whole point of the
    // Save-track-data dialog having a cancel button and a progress label: an
    // export of the visible region on a deep track is the same read the display
    // does. They arrived on every call and were dropped here, so both were
    // decorative on this branch — the one taken by any adapter with its own
    // exporter.
    return (
      (await dataAdapter.getExportData(regions, formatType, {
        ...opts,
        stopToken,
        statusCallback,
      })) ?? ''
    )
  }
}
