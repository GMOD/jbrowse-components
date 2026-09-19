import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { updateStatus } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'

import { dedupeFeaturesById } from './dedupeFeatures.ts'
import { buildFeatureAdmission } from './featureAdmission.ts'
import { summarizeGroupByCandidates } from './groupByCandidates.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Feature } from '@jbrowse/core/util'

/**
 * The render fetch's download over the blocks in view, under the same
 * admission and the same byte budget, so the attributes it lists and the
 * values it counts are the ones a facet would section.
 */
export async function executeGetGroupByCandidates({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'GetCanvasGroupByCandidates'>
}) {
  const {
    sessionId,
    adapterConfig,
    regions,
    displayConfig,
    showOnlyGenes,
    soloFeatureIds,
    hiddenFeatureIds,
    byteLimit,
    signal,
    statusCallback,
  } = args

  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  const { tooLarge } = await measureRegionBytes({
    dataAdapter,
    regions,
    byteLimit,
    signal,
    statusCallback,
  })
  if (tooLarge) {
    return tooLarge
  }

  const admit = buildFeatureAdmission({
    config: displayConfig,
    jexl: pluginManager.jexl,
    showOnlyGenes,
    soloFeatureIds,
    hiddenFeatureIds,
  })
  const features: Feature[] = []
  for (const region of regions) {
    const fetched = await updateStatus(
      'Downloading features',
      statusCallback,
      () => dataAdapter.getFeaturesArray(region, { signal, statusCallback }),
    )
    checkAbortSignal(signal)
    for (const feature of dedupeFeaturesById(fetched, admit).values()) {
      features.push(feature)
    }
  }
  return summarizeGroupByCandidates(features)
}
