/* eslint-disable no-underscore-dangle */
import {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'
import { BamRecord } from '@gmod/bam'
import {
  parseCigar,
  generateMD,
  cigarToMismatches,
  mdToMismatches,
  Mismatch,
} from './MismatchParser'

import BamAdapter from './BamAdapter'

export default class BamSlightlyLazyFeature implements Feature {
  constructor(
    private record: BamRecord,
    private adapter: BamAdapter,
    private ref?: string,
  ) {}

  _get_name() {
    return this.record.get('name')
  }

  _get_type(): string {
    return 'match'
  }

  _get_score(): number {
    return this.record.get('mq')
  }

  _get_flags(): string {
    return this.record.flags
  }

  _get_strand(): number {
    return this.record.isReverseComplemented() ? -1 : 1
  }

  _get_pair_orientation() {
    return this.record.isPaired() ? this.record.getPairOrientation() : undefined
  }

  _get_next_seq_id() {
    return this.record._next_refid()
  }

  _get_seq_id() {
    // @ts-ignore
    return this.record._refID
  }

  _get_next_refName() {
    return this.adapter.refIdToName(this.record._next_refid())
  }

  _get_next_segment_position() {
    const { record, adapter } = this
    return record.isPaired()
      ? `${adapter.refIdToName(record._next_refid())}:${record._next_pos() + 1}`
      : undefined
  }

  _get_seq() {
    return this.record.getReadBases()
  }

  _get_MD() {
    const md = this.record.get('MD') as string | undefined
    const seq = this.get('seq') as string
    if (!md && seq && this.ref) {
      return generateMD(this.ref, this.record.getReadBases(), this.get('CIGAR'))
    }
    return md
  }

  qualRaw() {
    return this.record.qualRaw()
  }

  set() {}

  tags() {
    const properties = Object.getOwnPropertyNames(
      BamSlightlyLazyFeature.prototype,
    )

    return [
      ...new Set(
        properties
          .filter(
            prop =>
              prop.startsWith('_get_') &&
              prop !== '_get_mismatches' &&
              prop !== '_get_skips_and_dels' &&
              prop !== '_get_cram_read_features' &&
              prop !== '_get_tags' &&
              prop !== '_get_next_seq_id' &&
              prop !== '_get_seq_id',
          )
          .map(methodName => methodName.replace('_get_', ''))
          .concat(this.record._tags()),
      ),
    ]
  }

  id() {
    return `${this.adapter.id}-${this.record.id()}`
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(field: string): any {
    const methodName = `_get_${field}`
    // @ts-ignore
    if (this[methodName]) {
      // @ts-ignore
      return this[methodName]()
    }
    return this.record.get(field)
  }

  _get_refName() {
    return this.adapter.refIdToName(this.record.seq_id())
  }

  parent() {
    return undefined
  }

  children() {
    return undefined
  }

  pairedFeature() {
    return false
  }

  toJSON(): SimpleFeatureSerialized {
    return {
      ...Object.fromEntries(
        this.tags()
          .map(t => [t, this.get(t)])
          .filter(elt => elt[1] !== undefined),
      ),
      uniqueId: this.id(),
    }
  }

  _get_skips_and_dels(
    opts: {
      cigarAttributeName: string
    } = {
      cigarAttributeName: 'CIGAR',
    },
  ) {
    const { cigarAttributeName } = opts
    let mismatches: Mismatch[] = []
    let cigarOps: string[] = []

    // parse the CIGAR tag if it has one
    const cigarString = this.get(cigarAttributeName)
    if (cigarString) {
      cigarOps = parseCigar(cigarString)
      mismatches = mismatches.concat(
        cigarToMismatches(cigarOps, this.get('seq'), this.qualRaw()),
      )
    }
    return mismatches
  }

  _get_mismatches({
    cigarAttributeName = 'CIGAR',
    mdAttributeName = 'MD',
  }: {
    cigarAttributeName?: string
    mdAttributeName?: string
  } = {}) {
    let mismatches: Mismatch[] = []
    let cigarOps: string[] = []

    // parse the CIGAR tag if it has one
    const cigarString = this.get(cigarAttributeName)
    const seq = this.get('seq')
    const qual = this.qualRaw()
    if (cigarString) {
      cigarOps = parseCigar(cigarString)
      mismatches = mismatches.concat(cigarToMismatches(cigarOps, seq, qual))
    }

    // now let's look for CRAM or MD mismatches
    const mdString = this.get(mdAttributeName)
    if (mdString) {
      mismatches = mismatches.concat(
        mdToMismatches(mdString, cigarOps, mismatches, seq, qual),
      )
    }

    // uniqify the mismatches
    const seen: { [index: string]: boolean } = {}
    return mismatches.filter(m => {
      const key = `${m.type},${m.start},${m.length}`
      const s = seen[key]
      seen[key] = true
      return !s
    })
  }

  _get_clipPos() {
    const cigar = this.get('CIGAR') || ''
    return this.get('strand') === -1
      ? +(cigar.match(/(\d+)[SH]$/) || [])[1] || 0
      : +(cigar.match(/^(\d+)([SH])/) || [])[1] || 0
  }
}
