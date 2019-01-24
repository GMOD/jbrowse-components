import { Observable } from 'rxjs'

import { BigWig } from '@gmod/bbi'

import { openLocation } from '../../util'

class Record {
  id() {
    return this.start
  }

  constructor(obj) {
    Object.assign(this, obj)
  }
}
export default class BigWigAdapter {
  constructor(config) {
    const { bigWigLocation, assemblyName } = config
    const bigWigOpts = {
      filehandle: openLocation(bigWigLocation),
    }

    this.assemblyName = assemblyName

    this.bigwig = new BigWig(bigWigOpts)
    this.gotBigWigHeader = this.bigwig.getHeader()
  }

  async hasDataForRefSeq({ assembly, refName }) {
    if (this.assemblyName !== assembly) return false
    await this.gotBamHeader
    return this.samHeader.refSeqNameToId[refName] !== undefined
  }

  refIdToName(refId) {
    // use info from the SAM header if possible, but fall back to using
    // the ref seq order from when the browser's refseqs were loaded
    if (this.samHeader.refSeqIdToName) {
      return this.samHeader.refSeqIdToName[refId]
    }
    return undefined
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeaturesInRegion({ /* assembly, */ refName, start, end }) {
    // TODO
    return Observable.create(async observer => {
      await this.gotBigWigHeader
      const records = await this.bigwig.getFeatures(refName, start, end)
      records.forEach(record => {
        observer.next(new Record(record))
      })
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
