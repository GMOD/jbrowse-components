import { BigWig } from '@gmod/bbi'

import BaseAdapter from '../../BaseAdapter'
import { openLocation } from '../../util/io'
import SimpleFeature from '../../util/simpleFeature'
import { ObservableCreate } from '../../util/rxjs'

export default class BigWigAdapter extends BaseAdapter {
  static capabilities = ['getFeatures', 'getRefNames']

  constructor(config) {
    super(config)
    this.bigwig = new BigWig({
      filehandle: openLocation(config.bigWigLocation),
    })
  }

  async getRefNames() {
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
  getFeatures({ /* assembly, */ refName, start, end }) {
    return ObservableCreate(async observer => {
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
