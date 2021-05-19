import {
  BaseAdapter,
  RegionsAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import { ConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { configSchema as FromConfigAdapterConfigSchema } from './configSchema'
import FromConfigAdapter from './FromConfigAdapter'

/**
 * Adapter that just returns the features defined in its `features` configuration
 * key, like:
 *   `"features": [ { "refName": "ctgA", "start":1, "end":20 }, ... ]`
 */
export default class FromConfigRegionsAdapter
  extends BaseAdapter
  implements RegionsAdapter {
  private features: Map<string, Feature[]>

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

  /**
   * Get refName, start, and end for all features after collapsing any overlaps
   */
  async getRegions() {
    const regions = []

    // recall: features are stored in this object sorted by start coordinate
    for (const [refName, features] of this.features) {
      let currentRegion
      for (const feature of features) {
        if (
          currentRegion &&
          currentRegion.end >= feature.get('start') &&
          currentRegion.start <= feature.get('end')
        ) {
          currentRegion.end = feature.get('end')
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

    // sort the regions by refName
    regions.sort((a, b) => a.refName.localeCompare(b.refName))

    return regions
  }

  freeResources(/* { region } */): void {}
}
