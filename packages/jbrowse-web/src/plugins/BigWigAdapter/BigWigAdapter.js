import { Observable } from 'rxjs'

import { BigWig } from '@gmod/bbi'

import BaseAdapter from '../../BaseAdapter'
import { openLocation } from '../../util'
import SimpleFeature from '../../util/simpleFeature'

export default class BigWigAdapter extends BaseAdapter {
  constructor(config, rootConfig) {
    super(config, rootConfig)
    this.bigwig = new BigWig({
      filehandle: openLocation(config.bigWigLocation),
    })
  }

  async loadData() {
    const header = await this.bigwig.getHeader()
    return Object.keys(header.refsByName)
  }

  async refIdToName(refId) {
    return ((await this.bigwig.getHeader()).refsByNumber[refId] || {}).name
  }

  async getGlobalStats() {
    const header = await this.bigwig.getHeader()
    return header.totalSummary
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeaturesInRegion({ /* assembly, */ refName, start, end }) {
    return Observable.create(async observer => {
      const records = await this.bigwig.getFeatures(refName, start, end)
      records.forEach(record => {
        observer.next(
          new SimpleFeature({
            id: record.start,
            data: record,
          }),
        )
      })
      observer.complete()
    })
  }
}
