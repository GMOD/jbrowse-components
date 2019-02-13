import { Observable } from 'rxjs'

import BaseAdapter from '../../BaseAdapter'
import SimpleFeature from '../../util/simpleFeature'

/**
 * Adapter that just returns the features defined in its `features` configuration
 * key, like:
 *   "features": [ { "seq_id": "ctgA", "start":1, "end":20 },
 *                 ...
 *               ]
 */

export default class FromConfigAdapter extends BaseAdapter {
  constructor(config, rootConfig) {
    super(config, rootConfig)
    const { features } = config
    this.features = this.makeFeatures(features || [])
  }

  makeFeatures(fdata) {
    const features = new Map()
    for (let i = 0; i < fdata.length; i += 1) {
      if (fdata[i]) {
        const f = this.makeFeature(fdata[i])
        const refName = f.get('seq_id')
        if (!features.get(refName)) features.set(refName, [])
        features.get(refName).push(f)
      }
    }
    return features
  }

  makeFeature(data, parent) {
    return new SimpleFeature({ data, parent })
  }

  async loadData() {
    const seqNames = Array.from(this.features.keys())
    return seqNames
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  async getFeatures({ refName, start, end }) {
    return Observable.create(async observer => {
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
