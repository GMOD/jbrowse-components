import BaseAdapter from '../../BaseAdapter'
import SimpleFeature from '../../util/simpleFeature'
import { ObservableCreate } from '../../util/rxjs'

/**
 * Adapter that just returns the features defined in its `features` configuration
 * key, like:
 *   "features": [ { "refName": "ctgA", "start":1, "end":20 },
 *                 ...
 *               ]
 */

export default class FromConfigAdapter extends BaseAdapter {
  static capabilities = [
    'getFeatures',
    'getRefNames',
    'getRegions',
    'getRefNameAliases',
  ]

  constructor(config) {
    super()
    const { features, refNameAliases } = config
    this.features = this.makeFeatures(features || [])
    this.refNameAliases = refNameAliases || []
  }

  makeFeatures(fdata) {
    const features = new Map()
    for (let i = 0; i < fdata.length; i += 1) {
      if (fdata[i]) {
        const f = this.makeFeature(fdata[i])
        const refName = f.get('refName')
        if (!features.get(refName)) features.set(refName, [])
        features.get(refName).push(f)
      }
    }
    return features
  }

  makeFeature(data, parent) {
    return new SimpleFeature({ data, parent })
  }

  async getRefNames() {
    const refNames = Array.from(this.features.keys())
    return refNames
  }

  /**
   * Get refName, start, and end for all features after collapsing any overlaps
   */
  async getRegions() {
    const regions = []
    const compareStart = (firstFeature, secondFeature) =>
      firstFeature.get('start') - secondFeature.get('end')
    for (const [refName, features] of this.features) {
      features.sort(compareStart)
      regions.push({
        refName,
        start: features[0].get('start'),
        end: features[0].get('end'),
      })
      for (let i = 1; i < features.length; i += 1) {
        const feature = features[i]
        const lastRegion = regions[regions.length - 1]
        if (lastRegion.end < feature.get('start'))
          regions.push({
            refName,
            start: feature.get('start'),
            end: feature.get('end'),
          })
        else if (lastRegion.end < feature.get('end')) {
          lastRegion.end = feature.get('end')
          regions.pop()
          regions.push(lastRegion)
        }
      }
    }
    return regions
  }

  async getRefNameAliases() {
    return this.refNameAliases
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeatures({ refName, start, end }) {
    return ObservableCreate(async observer => {
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

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources(/* { region } */) {}
}
