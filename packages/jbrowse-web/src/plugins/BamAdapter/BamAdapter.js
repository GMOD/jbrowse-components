import { Observable } from 'rxjs'

import { BamFile } from '@gmod/bam'

import Feature from '../../util/simpleFeature'

import { openLocation } from '../../util'
import BamSlightlyLazyFeature from './BamSlightlyLazyFeature'

export default class BamAdapter {
  constructor(config) {
    const { bamLocation, assemblyName } = config
    const indexLocation = config.index.location
    const { indexType } = config.index
    const bamOpts = {
      bamFilehandle: openLocation(bamLocation),
    }

    this.assemblyName = assemblyName

    const indexFile = openLocation(indexLocation)
    if (indexType === 'CSI') {
      bamOpts.csiFilehandle = indexFile
    } else {
      bamOpts.baiFilehandle = indexFile
    }

    this.bam = new BamFile(bamOpts)
    this.gotBamHeader = this.bam
      .getHeader()
      .then(header => this.loadSamHeader(header))
  }

  async hasDataForRefSeq({ assembly, refName }) {
    if (this.assemblyName !== assembly) return false
    await this.gotBamHeader
    return this.samHeader.refSeqNameToId[refName] !== undefined
  }

  bamRecordToFeature(record) {
    return new BamSlightlyLazyFeature(record, this)
  }

  // process the parsed SAM header from the bam file
  loadSamHeader(samHeader) {
    this.samHeader = {}

    // use the @SQ lines in the header to figure out the
    // mapping between ref seq ID numbers and names
    const refSeqIdToName = []
    const refSeqNameToId = {}
    const sqLines = samHeader.filter(l => l.tag === 'SQ')
    sqLines.forEach((sqLine, seqId) => {
      sqLine.data.forEach(item => {
        if (item.tag === 'SN') {
          // this is the seq name
          const seqName = item.value
          refSeqNameToId[seqName] = seqId
          refSeqIdToName[seqId] = seqName
        }
      })
    })
    if (refSeqIdToName.length) {
      this.samHeader.refSeqIdToName = refSeqIdToName
      this.samHeader.refSeqNameToId = refSeqNameToId
    }
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
  getFeaturesInRegion({ assembly, refName, start, end }) {
    // TODO
    return Observable.create(async observer => {
      await this.gotBamHeader
      const records = await this.bam.getRecordsForRange(refName, start, end)
      records.forEach(record => {
        observer.next(this.bamRecordToFeature(record))
      })
      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources({ region }) {}
}
