import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { isFeatureAdapter } from '../../data_adapters/BaseAdapter'
import { getAdapter } from '../../data_adapters/dataAdapterCache'

import type { AnyConfigurationModel } from '../../configuration'
import type { Feature } from '../../util/simpleFeature'
import type { Region } from '../../util'
import type SerializableFilterChain from './util/serializableFilterChain'
import type PluginManager from '../../PluginManager'

export function normalizeRegion(region: Region): Region {
  return {
    ...region,
    start: Math.floor(region.start),
    end: Math.ceil(region.end),
  }
}

export interface GetFeaturesArgs {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: AnyConfigurationModel
  regions: Region[]
  filters?: SerializableFilterChain
  expandRegion?: (region: Region) => Region
}

export async function getFeatures(
  args: GetFeaturesArgs,
): Promise<Map<string, Feature>> {
  const {
    pluginManager,
    sessionId,
    adapterConfig,
    regions,
    filters,
    expandRegion,
  } = args
  const { dataAdapter } = await getAdapter(pluginManager, sessionId, adapterConfig)

  if (!isFeatureAdapter(dataAdapter)) {
    throw new Error('Adapter does not support retrieving features')
  }

  const requestRegions = regions.map(r => {
    const normalized = normalizeRegion(r)
    return expandRegion ? expandRegion(normalized) : normalized
  })

  const featureObservable =
    requestRegions.length === 1
      ? dataAdapter.getFeatures(requestRegions[0]!)
      : dataAdapter.getFeaturesInMultipleRegions(requestRegions)

  const feats = await firstValueFrom(featureObservable.pipe(toArray()))
  return new Map<string, Feature>(
    feats
      .filter(feat => (filters ? filters.passes(feat, args) : true))
      .map(feat => [feat.id(), feat] as const),
  )
}
