import { getFeatureAdapterOrThrow } from '../../data_adapters/getFeatureAdapter.ts'
import RpcMethodTypeWithRenameRegions from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegions.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

export default class CoreGetExportData extends RpcMethodTypeWithRenameRegions<'CoreGetExportData'> {
  name = 'CoreGetExportData' as const

  async execute(args: RpcExecuteArgs<'CoreGetExportData'>) {
    const {
      sessionId,
      adapterConfig,
      regions,
      formatType,
      opts,
      stopToken,
      statusCallback,
    } = args

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
    //
    // undefined travels: it is the adapter saying it does not write this
    // format, which is a different answer from an empty region, and the caller
    // falls back to reading features. Coercing it to '' here handed the user an
    // empty file instead.
    return dataAdapter.getExportData(regions, formatType, {
      ...opts,
      stopToken,
      statusCallback,
    })
  }
}
