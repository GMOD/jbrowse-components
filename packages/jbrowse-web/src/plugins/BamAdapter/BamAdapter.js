import { Observable } from 'rxjs'

import { BamFile } from '@gmod/bam'

import Feature from '../../util/feature'

import { openLocation } from '../../util'

export default class BamAdapter {
  constructor({ bamLocation, indexLocation, indexType }) {
    const bamOpts = {
      bamFilehandle: openLocation(bamLocation),
    }

    const indexFile = openLocation(indexLocation)
    if (indexType === 'CSI') {
      bamOpts.csiFilehandle = indexFile
    } else {
      bamOpts.baiFilehandle = indexFile
    }

    this.bam = new BamFile(bamOpts)
    this.gotBamHeader = this.bam.getHeader()
  }

  async hasDataForRefSeq({ assembly, refName }) {
    // TODO
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} observable emitter of Feature objects in the region
   */
  getFeaturesInRegion({ assembly, refName, start, end }) {
    // TODO
    return Observable.create(async observer => {
      await this.gotBamHeader
      const records = await this.bam.getRecordsForRange(refName, start, end)
      records.forEach(record => {
        observer.next(record)
      })
      observer.complete()
    })
  }
}
