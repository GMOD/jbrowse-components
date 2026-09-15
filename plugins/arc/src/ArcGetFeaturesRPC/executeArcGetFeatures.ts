import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { updateStatus } from '@jbrowse/core/util'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export async function executeArcGetFeatures({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'ArcGetFeatures'>
}) {
  const {
    sessionId,
    adapterConfig,
    sequenceAdapter,
    regions,
    byteLimit,
    signal,
    statusCallback,
  } = args

  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
    sequenceAdapter,
  })

  const { bytes, tooLarge } = await measureRegionBytes({
    dataAdapter,
    regions,
    byteLimit,
    signal,
    statusCallback,
  })
  if (tooLarge) {
    return tooLarge
  }

  const features = await updateStatus(
    'Downloading features',
    statusCallback,
    () =>
      firstValueFrom(
        dataAdapter
          .getFeaturesInMultipleRegions(regions, { statusCallback, signal })
          .pipe(toArray()),
      ),
  )
  return { features: features.map(f => f.toJSON()), bytes }
}
