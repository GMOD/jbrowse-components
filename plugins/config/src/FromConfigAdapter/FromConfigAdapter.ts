import { readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export function mergeFeaturesToRegions(features: Map<string, Feature[]>) {
  const regions: { refName: string; start: number; end: number }[] = []
  for (const [refName, feats] of features) {
    let currentRegion:
      | { refName: string; start: number; end: number }
      | undefined
    for (const feature of feats) {
      if (
        currentRegion &&
        currentRegion.end >= feature.get('start') &&
        currentRegion.start <= feature.get('end')
      ) {
        // take the max: a fully-contained feature (smaller end) must not
        // shrink the merged region
        currentRegion.end = Math.max(currentRegion.end, feature.get('end'))
      } else {
        if (currentRegion) {
          regions.push(currentRegion)
        }
        currentRegion = {
          refName,
          start: feature.get('start'),
          end: feature.get('end'),
        }
      }
    }
    if (currentRegion) {
      regions.push(currentRegion)
    }
  }
  return regions
}

export function makeFeatures(fdata: SimpleFeatureSerialized[]) {
  const features = new Map<string, Feature[]>()
  for (const entry of fdata) {
    const f = new SimpleFeature(entry)
    const refName = f.get('refName')
    let bucket = features.get(refName)
    if (!bucket) {
      bucket = []
      features.set(refName, bucket)
    }

    bucket.push(f)
  }

  // sort the features on each reference sequence by start coordinate
  for (const refFeatures of features.values()) {
    refFeatures.sort((a, b) => a.get('start') - b.get('start'))
  }

  return features
}

export default class FromConfigAdapter extends BaseFeatureDataAdapter {
  protected features: Map<string, Feature[]>

  constructor(
    conf: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(conf, getSubAdapter, pluginManager)
    const feats = readConfObject(conf, 'features') as SimpleFeatureSerialized[]
    this.features = makeFeatures(feats)
  }

  async getRefNames() {
    return [...this.features.keys()]
  }

  async getRefNameAliases() {
    return [...this.features.values()].map(featureArray => ({
      refName: featureArray[0]!.get('refName'),
      aliases: featureArray[0]!.get('aliases'),
    }))
  }

  getFeatures(region: NoAssemblyRegion) {
    const { refName, start, end } = region

    return ObservableCreate<Feature>(async observer => {
      const features = this.features.get(refName) ?? []
      for (const f of features) {
        if (f.get('end') > start && f.get('start') < end) {
          observer.next(f)
        }
      }
      observer.complete()
    })
  }
}
