import { Observable } from 'rxjs'

import { BamFile } from '@gmod/bam'

import Feature from '../../util/feature'

import { openLocation } from '../../util'

class BamSlightlyLazyFeature {
  uncachedGetType() {
    return 'match'
  }

  uncachedGetScore() {
    return this.record._get('mq')
  }

  uncachedGetMappingQuality() {
    return this.record.mappingQuality
  }

  uncachedGetFlags() {
    return `0x${this.record.flags.toString(16)}`
  }

  uncachedGetstrand() {
    return this.record.isReverseComplemented() ? -1 : 1
  }

  uncachedGetReadGroupId() {
    return this.record.readGroupId
  }

  uncachedGetSeqId() {
    return this.adapter.RefIdToName(this.record._refID)
  }

  uncachedGetQcFailed() {
    return this.record.isFailedQc()
  }

  uncachedGetduplicate() {
    return this.record.isDuplicate()
  }

  uncachedGetSecondaryAlignment() {
    return this.record.isSecondary()
  }

  uncachedGetSupplementaryAlignment() {
    return this.record.isSupplementary()
  }

  uncachedGetMultiSegmentTemplate() {
    return this.record.isPaired()
  }

  uncachedGetMultiSegmentAllCorrectlyAligned() {
    return this.record.isProperlyPaired()
  }

  uncachedGetMultiSegmentAllAligned() {
    return this.record.isProperlyPaired()
  }

  uncachedGetMultiSegmentNextSegmentUnmapped() {
    return this.record.isMateUnmapped()
  }

  uncachedGetMultiSegmentFirst() {
    return this.record.isRead1()
  }

  uncachedGetMultiSegmentLast() {
    return this.record.isRead2()
  }

  uncachedGetMultiSegmentNextSegmentReversed() {
    return this.record.isMateReverseComplemented()
  }

  uncachedGetPairOrientation() {
    return this.record.getPairOrientation()
  }

  uncachedGetunmapped() {
    return this.record.isSegmentUnmapped()
  }

  uncachedGetNextSeqId() {
    return this.record.isPaired()
      ? this.adapter.refIdToName(this.record._next_refid())
      : undefined
  }

  uncachedGetNextPos() {
    return this.record.isPaired() ? this.record._next_pos() : undefined
  }

  uncachedGetNextSegmentPosition() {
    return this.record.isPaired()
      ? `${this.adapter.refIdToName(
          this.record._next_refid(),
        )}:${this.record._next_pos() + 1}`
      : undefined
  }

  uncachedGetTags() {
    return this.record._tags()
  }

  uncachedGetseq() {
    return this.record.getReadBases()
  }

  constructor(record, adapter) {
    this.record = record
    this.adapter = adapter
  }

  tags() {
    return this.uncachedGetTags()
  }

  id() {
    return this.record.get('id')
  }

  _get(field) {
    const methodName = `uncachedGet${field}`
    if (this[methodName]) return this[methodName]()
    return this.record._get(field)
  }

  get(field) {
    const methodName = `uncachedGet${field.toLowerCase()}`
    if (this[methodName]) return this[methodName]()
    return this.record.get(field)
  }

  parent() {}

  children() {}

  pairedFeature() {
    return false
  }

  toJSON() {
    const plain = {}
    this.tags().forEach(t => {
      plain[t] = this.get(t)
    })
    return plain
  }
}

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

  bamRecordToFeature(record) {
    return new BamSlightlyLazyFeature(record, this)
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
}
