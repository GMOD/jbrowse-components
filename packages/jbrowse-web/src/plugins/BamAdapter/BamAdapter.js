import { Observable } from 'rxjs'

import { BamFile } from '@gmod/bam'

import { openLocation } from '../../util/io'
import BaseAdapter from '../../BaseAdapter'
import BamSlightlyLazyFeature from './BamSlightlyLazyFeature'

export default class BamAdapter extends BaseAdapter {
  constructor(config) {
    super(config)
    const { bamLocation } = config

    const indexLocation = config.index.location
    const { indexType } = config.index
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
  }

  async loadData() {
    if (!this.samHeader) {
      const samHeader = await this.bam.getHeader()
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
    return this.samHeader.refSeqIdToName
  }

  /**
   * Fetch features for a certain region. Use getFeaturesInRegion() if you also
   * want to verify that the store has features for the given assembly and
   * reference sequence before fetching.
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  async getFeatures({ refName, start, end }) {
    await this.loadData()
    return Observable.create(async observer => {
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
  freeResources(/* { region } */) {}

  bamRecordToFeature(record) {
    return new BamSlightlyLazyFeature(record, this)
  }

  refIdToName(refId) {
    // use info from the SAM header if possible, but fall back to using
    // the ref seq order from when the browser's refseqs were loaded
    if (this.samHeader.refSeqIdToName) {
      return this.samHeader.refSeqIdToName[refId]
    }
    return undefined
  }
}
