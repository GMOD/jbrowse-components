import BaseAdapter from '../../BaseAdapter'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'

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
        if (!features.has(refName)) features.set(refName, [])
        features.get(refName).push(f)
      }
    }

    // sort the features on each reference sequence by start coordinate
    const byStartCoordinate = (a, b) => a.get('start') - b.get('start')
    for (const refFeatures of features.values()) {
      refFeatures.sort(byStartCoordinate) // Array.sort sorts in-place!
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
          if (currentRegion) regions.push(currentRegion)
          currentRegion = {
            refName,
            start: feature.get('start'),
            end: feature.get('end'),
          }
        }
      }
      if (currentRegion) regions.push(currentRegion)
    }

    // sort the regions by refName
    regions.sort((a, b) => a.refName.localeCompare(b.refName))

    return regions
  }

  async getRefNameAliases() {
    return Array.from(this.features.values()).map(featureArray => ({
      refName: featureArray[0].get('refName'),
      aliases: featureArray[0].get('aliases'),
    }))
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @param {AbortSignal} [signal] optional AbortSignal for aborting the request
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeatures({ refName, start, end }, signal) {
    return ObservableCreate(async observer => {
      const features = this.features.get(refName, signal) || []
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
