/* eslint-disable @typescript-eslint/camelcase,no-underscore-dangle */
import {
  Feature,
  SimpleFeatureSerialized,
} from '@gmod/jbrowse-core/util/simpleFeature'
import { BamRecord } from '@gmod/bam'
import {
  parseCigar,
  cigarToMismatches,
  mdToMismatches,
  Mismatch,
} from './MismatchParser'

import BamAdapter from './BamAdapter'

export default class implements Feature {
  private record: BamRecord

  private adapter: BamAdapter

  constructor(record: BamRecord, adapter: BamAdapter) {
    this.record = record
    this.adapter = adapter
  }

  _get_name(): string {
    return this.record.get('name')
  }

  _get_start(): number {
    return this.record.get('start')
  }

  _get_end(): number {
    return this.record.get('end')
  }

  _get_type(): string {
    return 'match'
  }

  _get_score(): number {
    return this.record.get('mq')
  }

  _get_mapping_quality(): number {
    // @ts-ignore
    return this.record.mappingQuality
  }

  _get_flags(): string {
    // @ts-ignore
    return `0x${this.record.flags.toString(16)}`
  }

  _get_strand(): number {
    return this.record.isReverseComplemented() ? -1 : 1
  }

  _get_read_group_id(): number {
    // @ts-ignore
    return this.record.readGroupId
  }

  _get_qual(): string {
    return this.record.get('qual')
  }

  _get_cigar(): string {
    return this.record.get('cigar')
  }

  _get_refname(): string | undefined {
    return this.adapter.refIdToName(this.record._refID)
  }

  _get_qc_failed(): boolean {
    return this.record.isFailedQc()
  }

  _get_duplicate(): boolean {
    return this.record.isDuplicate()
  }

  _get_secondary_alignment(): boolean {
    return this.record.isSecondary()
  }

  _get_supplementary_alignment(): boolean {
    return this.record.isSupplementary()
  }

  _get_multi_segment_template(): boolean {
    return this.record.isPaired()
  }

  _get_multi_segment_all_correctly_aligned(): boolean {
    return this.record.isProperlyPaired()
  }

  _get_multi_segment_all_aligned(): boolean {
    return this.record.isProperlyPaired()
  }

  _get_multi_segment_next_segment_unmapped(): boolean {
    return this.record.isMateUnmapped()
  }

  _get_multi_segment_first(): boolean {
    return this.record.isRead1()
  }

  _get_multi_segment_last(): boolean {
    return this.record.isRead2()
  }

  _get_multi_segment_next_segment_reversed(): boolean {
    return this.record.isMateReverseComplemented()
  }

  _get_unmapped(): boolean {
    return this.record.isSegmentUnmapped()
  }

  _get_next_refname(): string | undefined {
    return this.adapter.refIdToName(this.record._next_refid())
  }

  _get_next_segment_position(): string | undefined {
    return this.record.isPaired()
      ? `${this.adapter.refIdToName(this.record._next_refid())}:${
          this.record._next_pos() + 1
        }`
      : undefined
  }

  _get_tags(): string[] {
    return this.record._tags()
  }

  _get_seq(): string {
    return this.record.getReadBases()
  }

  _get_md(): string | undefined {
    return this.record.get('md')
  }

  set(): void {}

  tags(): string[] {
    return this._get_tags()
  }

  id(): string {
    return `${this.adapter.id}-${this.record.id()}`
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(field: string): any {
    const methodName = `_get_${field.toLowerCase()}`
    // @ts-ignore
    if (this[methodName]) {
      // @ts-ignore
      return this[methodName]()
    }
    return this.record.get(field)
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tags: Record<string, any> = {}
    this.tags().forEach((t: string) => {
      tags[t] = this.get(t)
    })
    return {
      ...tags,
      refName: this.get('refName'),
      name: this.get('name'),
      type: this.get('type'),
      uniqueId: this.id(),
      clipPos: this._get_clippos(),
    }
  }

  _get_skips_and_dels(
    opts: {
      cigarAttributeName: string
    } = {
      cigarAttributeName: 'cigar',
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
        cigarToMismatches(cigarOps, this.get('seq')),
      )
    }
    return mismatches
  }

  _get_mismatches(
    opts: {
      cigarAttributeName: string
      mdAttributeName: string
    } = {
      cigarAttributeName: 'cigar',
      mdAttributeName: 'md',
    },
  ): Mismatch[] {
    const { cigarAttributeName, mdAttributeName } = opts
    let mismatches: Mismatch[] = []
    let cigarOps: string[] = []

    // parse the CIGAR tag if it has one
    const cigarString = this.get(cigarAttributeName)
    if (cigarString) {
      cigarOps = parseCigar(cigarString)
      mismatches = mismatches.concat(
        cigarToMismatches(cigarOps, this.get('seq')),
      )
    }

    // now let's look for CRAM or MD mismatches
    const mdString = this.get(mdAttributeName)
    if (mdString) {
      mismatches = mismatches.concat(
        mdToMismatches(mdString, cigarOps, mismatches, this.get('seq')),
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

  _get_clippos() {
    const cigar = this.get('cigar') || ''
    return this.get('strand') === -1
      ? +(cigar.match(/(\d+)[SH]$/) || [])[1] || 0
      : +(cigar.match(/^(\d+)([SH])/) || [])[1] || 0
  }
}
