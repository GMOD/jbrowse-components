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
  private record: BamRecord

  private adapter: BamAdapter

  private ref?: string

  constructor(record: BamRecord, adapter: BamAdapter, ref?: string) {
    this.record = record
    this.adapter = adapter
    this.ref = ref
  }

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
    // @ts-ignore
    return this.record.flags
  }

  _get_strand(): number {
    return this.record.isReverseComplemented() ? -1 : 1
  }

  _get_read_group_id(): number {
    // @ts-ignore
    return this.record.readGroupId
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

  _get_next_refName(): string | undefined {
    return this.adapter.refIdToName(this.record._next_refid())
  }

  _get_next_segment_position(): string | undefined {
    return this.record.isPaired()
      ? `${this.adapter.refIdToName(this.record._next_refid())}:${
          this.record._next_pos() + 1
        }`
      : undefined
  }

  _get_seq(): string {
    return this.record.getReadBases()
  }

  _get_MD(): string | undefined {
    const md = this.record.get('MD')
    const seq = this.get('seq')
    if (!md && seq && this.ref) {
      return generateMD(this.ref, this.record.getReadBases(), this.get('CIGAR'))
    }
    return md
  }

  qualRaw(): Buffer | undefined {
    return this.record.qualRaw()
  }

  set(): void {}

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

  id(): string {
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

  _get_refName(): string | undefined {
    return this.adapter.refIdToName(this.record.seq_id())
  }

  parent(): undefined {
    return undefined
  }

  children(): undefined {
    return undefined
  }

  pairedFeature(): boolean {
    return false
  }

  toJSON(): SimpleFeatureSerialized {
    const tags = Object.fromEntries(
      this.tags()
        .map(t => {
          return [t, this.get(t)]
        })
        .filter(elt => elt[1] !== undefined),
    )

    return {
      ...tags,
      uniqueId: this.id(),
    }
  }

  _get_skips_and_dels(
    opts: {
      cigarAttributeName: string
    } = {
      cigarAttributeName: 'CIGAR',
    },
  ): Mismatch[] {
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
  } = {}): Mismatch[] {
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

    // now let's look for CRAM or MD mismatches
    const mdString = this.get(mdAttributeName)
    if (mdString) {
      mismatches = mismatches.concat(
        mdToMismatches(
          mdString,
          cigarOps,
          mismatches,
          this.get('seq'),
          this.qualRaw(),
        ),
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
