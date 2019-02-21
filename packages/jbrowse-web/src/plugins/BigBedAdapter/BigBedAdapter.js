import { Observable } from 'rxjs'

import { BigBed } from '@gmod/bbi'

import BaseAdapter from '../../BaseAdapter'
import { openLocation } from '../../util/io'
import SimpleFeature from '../../util/simpleFeature'

export default class BigBedAdapter extends BaseAdapter {
  constructor(config) {
    super(config)
    this.bigbed = new BigBed({
      filehandle: openLocation(config.bigBedLocation),
    })
  }

  async loadData() {
    const header = await this.bigbed.getHeader()
    return Object.keys(header.refsByName)
  }

  async refIdToName(refId) {
    return ((await this.bigbed.getHeader()).refsByNumber[refId] || {}).name
  }

  async getGlobalStats() {
    const header = await this.bigbed.getHeader()
    return header.totalSummary
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  async getFeatures({ /* assembly, */ refName, start, end }) {
    await this.loadData()
    return Observable.create(async observer => {
      const records = await this.bigbed.getFeatures(refName, start, end)
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
