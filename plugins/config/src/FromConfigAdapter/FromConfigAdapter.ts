import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import SimpleFeature, {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

export function makeFeatures(fdata: SimpleFeatureSerialized[]) {
  const features = new Map<string, Feature[]>()
  for (const entry of fdata) {
    if (entry) {
      const f = new SimpleFeature(entry)
      const refName = f.get('refName') as string
      let bucket = features.get(refName)
      if (!bucket) {
        bucket = []
        features.set(refName, bucket)
      }

      bucket.push(f)
    }
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
    this.features = makeFeatures(feats || [])
  }

  async getRefNames() {
    return [...this.features.keys()]
  }

  async getRefNameAliases() {
    return [...this.features.values()].map(featureArray => ({
      refName: featureArray[0].get('refName'),
      aliases: featureArray[0].get('aliases'),
    }))
  }

  getFeatures(region: NoAssemblyRegion) {
    const { refName, start, end } = region

    return ObservableCreate<Feature>(async observer => {
      const features = this.features.get(refName) || []
      for (const f of features) {
        if (f.get('end') > start && f.get('start') < end) {
          observer.next(f)
        }
      }
      observer.complete()
    })
  }

  freeResources(/* { region } */): void {}
}
