import { getFeatureAdapterOrThrow } from '../../data_adapters/getFeatureAdapter.ts'
import { rpcResult } from '../../util/librpc.ts'
import {
  encodeFeatures,
  encodedChannelTransferables,
} from '../../util/markEncoding.ts'
import { createProgressReporter } from '../../util/progress.ts'
import { wholeFeatureRow } from '../../util/stepTables.ts'
import { measureRegionBytes } from '../byteBudget.ts'
import { layerFeatures } from './layerFeatures.ts'

import type PluginManager from '../../PluginManager.ts'
import type { EncodedLayersResult } from '../../util/markEncoding.ts'
import type { RpcExecuteArgs } from '../RpcRegistry.ts'

export async function executeGetEncodedLayers({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'CoreGetEncodedLayers'>
}) {
  const { region, layers: requested, byteLimit, signal, statusCallback } = args
  const dataAdapter = await getFeatureAdapterOrThrow({
    ...args,
    pluginManager,
  })

  const { bytes, tooLarge } = await measureRegionBytes({
    dataAdapter,
    regions: [region],
    byteLimit,
    signal,
    statusCallback,
  })
  if (tooLarge) {
    return tooLarge
  }

  const { jexl } = pluginManager
  const {
    fetched,
    layers: layered,
    sections,
    zoomRange,
    notices,
    facts,
    unreadFilterFields,
  } = await layerFeatures(dataAdapter, args, jexl)
  const layers = requested.map((request, i) => {
    const { table, row, series, gapBp } = layered[i]!
    const encoded = encodeFeatures(
      table,
      { ...request.encoding, row, series },
      request.lanes,
      {
        jexl,
        root: fetched,
        report: createProgressReporter({
          label: 'Processing features',
          total: table.length,
          statusCallback,
          signal,
        }),
      },
    )
    return gapBp === undefined ? encoded : { ...encoded, gapBp }
  })
  const result: EncodedLayersResult = {
    layers,
    facet: sections,
    bytes,
    zoomRange,
    unreadFilterFields,
    ...(notices.length > 0 ? { notices } : {}),
    ...(Object.keys(facts).length > 0 ? { facts } : {}),
  }
  return rpcResult(
    result,
    layers.flatMap(l => encodedChannelTransferables(l)),
  )
}

export async function executeGetEncodedFeature({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'CoreGetEncodedFeature'>
}) {
  const { layer, featureIndex } = args
  const asked = args.layers[layer]
  if (!asked) {
    return undefined
  }
  const dataAdapter = await getFeatureAdapterOrThrow({
    ...args,
    pluginManager,
  })
  // A layer's list does not depend on its neighbours, so only the one asked
  // about runs its steps.
  const { layers } = await layerFeatures(
    dataAdapter,
    { ...args, layers: [asked] },
    pluginManager.jexl,
  )
  const table = layers[0]?.table
  return table && featureIndex < table.length
    ? wholeFeatureRow(table, featureIndex).toJSON()
    : undefined
}
