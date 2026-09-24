import { updateStatus } from '@jbrowse/core/util'

import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region, StatusCallback } from '@jbrowse/core/util'

/**
 * Every record overlapping `regions`, each once. `getFeaturesInMultipleRegions`
 * runs one query per region and merges them, so a record spanning two fetched
 * regions arrives once per region; every consumer downstream wants the record,
 * and places it into regions itself.
 */
export async function fetchVariantFeatures(
  adapter: BaseFeatureDataAdapter,
  regions: Region[],
  opts: BaseOptions & { statusCallback?: StatusCallback },
) {
  const features = await updateStatus(
    'Downloading features',
    opts.statusCallback,
    () => adapter.getFeaturesInMultipleRegionsArray(regions, opts),
  )
  if (regions.length < 2) {
    return features
  }
  const seen = new Set<string>()
  const unique: Feature[] = []
  for (const feature of features) {
    const id = feature.id()
    if (!seen.has(id)) {
      seen.add(id)
      unique.push(feature)
    }
  }
  return unique
}
