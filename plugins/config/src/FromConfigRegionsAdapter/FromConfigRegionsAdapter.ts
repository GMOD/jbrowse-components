import {
  BaseAdapter,
  RegionsAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { makeFeatures } from '../FromConfigAdapter/FromConfigAdapter'

/**
 * Adapter that just returns the features defined in its `features` configuration
 * key, like:
 *   `"features": [ { "refName": "ctgA", "start":1, "end":20 }, ... ]`
 */
export default class FromConfigRegionsAdapter
  extends BaseAdapter
  implements RegionsAdapter
{
  private features: Map<string, Feature[]>

  constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const f = readConfObject(config, 'features') as SimpleFeatureSerialized[]
    this.features = makeFeatures(f || [])
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
