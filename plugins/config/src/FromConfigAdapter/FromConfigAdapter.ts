import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import SimpleFeature, {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { readConfObject } from '@jbrowse/core/configuration'
import { ConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { configSchema as FromConfigAdapterConfigSchema } from './configSchema'

/**
 * Adapter that just returns the features defined in its `features` configuration
 * key, like:
 *   `"features": [ { "refName": "ctgA", "start":1, "end":20 }, ... ]`
 */

export default class FromConfigAdapter extends BaseFeatureDataAdapter {
  protected features: Map<string, Feature[]>

  constructor(
    config: ConfigurationModel<typeof FromConfigAdapterConfigSchema>,
  ) {
    super(config)
    const features = readConfObject(
      config,
      'features',
    ) as SimpleFeatureSerialized[]
    this.features = FromConfigAdapter.makeFeatures(features || [])
  }

  static makeFeatures(fdata: SimpleFeatureSerialized[]) {
    const features = new Map<string, Feature[]>()
    for (let i = 0; i < fdata.length; i += 1) {
      if (fdata[i]) {
        const f = this.makeFeature(fdata[i])
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

  static makeFeature(data: SimpleFeatureSerialized): SimpleFeature {
    return new SimpleFeature(data)
  }

  async getRefNames() {
    const refNames: Set<string> = new Set()
    for (const [refName, features] of this.features) {
      // add the feature's primary refname
      refNames.add(refName)

      // also look in the features for mate or breakend specifications, and add
      // the refName targets of those
      features.forEach(feature => {
        // get refNames of generic "mate" records
        const mate = feature.get('mate')
        if (mate && mate.refName) {
          refNames.add(mate.refName)
        }
        // get refNames of VCF BND and TRA records
        const svType = ((feature.get('INFO') || {}).SVTYPE || [])[0]
        if (svType === 'BND') {
          const breakendSpecification = (feature.get('ALT') || [])[0]
          const matePosition = breakendSpecification.MatePosition.split(':')
          refNames.add(matePosition[0])
        } else if (svType === 'TRA') {
          const chr2 = ((feature.get('INFO') || {}).CHR2 || [])[0]
          refNames.add(chr2)
        }
      })
    }
    return Array.from(refNames)
  }

  async getRefNameAliases() {
    return Array.from(this.features.values()).map(featureArray => ({
      refName: featureArray[0].get('refName'),
      aliases: featureArray[0].get('aliases'),
    }))
  }

  getFeatures(region: NoAssemblyRegion) {
    const { refName, start, end } = region

    return ObservableCreate<Feature>(async observer => {
      const features = this.features.get(refName) || []
      for (let i = 0; i < features.length; i += 1) {
        const f = features[i]
        if (f.get('end') > start && f.get('start') < end) {
          observer.next(f)
        }
      }
      observer.complete()
    })
  }

  freeResources(/* { region } */): void {}
}
