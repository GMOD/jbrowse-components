import { BigWig } from '@gmod/bbi'

import BaseAdapter from '@gmod/jbrowse-core/BaseAdapter'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'

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
            id: record.start + 1,
            data: record,
          }),
        )
      })
      observer.complete()
    })
  }
}
