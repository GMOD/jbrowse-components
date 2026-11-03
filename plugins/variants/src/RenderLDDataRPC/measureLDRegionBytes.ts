import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { isLDRecordSource } from '@jbrowse/ld-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { ByteMeasurableAdapter } from '@jbrowse/core/rpc/byteBudget'

export function measureLDRegionBytes({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'RenderLDData'>
}) {
  const {
    regions,
    byteLimit,
    signal,
    statusCallback,
    sessionId,
    adapterConfig,
  } = args
  const byteSource: ByteMeasurableAdapter = {
    getRegionByteSize: async (measured, opts) => {
      const { dataAdapter } = await getAdapter(
        pluginManager,
        sessionId,
        adapterConfig,
      )
      return isLDRecordSource(dataAdapter) && dataAdapter.getRegionByteSize
        ? dataAdapter.getRegionByteSize(measured, opts)
        : undefined
    },
  }
  return measureRegionBytes({
    dataAdapter: byteSource,
    regions,
    byteLimit,
    signal,
    statusCallback,
  })
}
