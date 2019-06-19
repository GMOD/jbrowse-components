/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable camelcase,no-underscore-dangle */
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import BamAdapter from './BamAdapter'

interface Mismatch {
  start: number
  length: number
  type: string
  base: string
  altbase?: string
  seq?: string
  cliplen?: number
}

export default class implements Feature {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private record: any

  private adapter: BamAdapter

  private cachedMismatches?: Mismatch[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(record: any, adapter: BamAdapter) {
    this.record = record
    this.adapter = adapter
  }

  _get_name() {
    return this.record._get('name')
  }

  _get_start() {
    return this.record._get('start')
  }

  _get_end() {
    return this.record._get('end')
  }

  _get_type() {
    return 'match'
  }

  _get_score() {
    return this.record._get('mq')
  }

  _get_mapping_quality() {
    return this.record.mappingQuality
  }

  _get_flags() {
    return `0x${this.record.flags.toString(16)}`
  }

  _get_strand() {
    return this.record.isReverseComplemented() ? -1 : 1
  }

  _get_read_group_id() {
    return this.record.readGroupId
  }

  _get_qual() {
    return this.record._get('qual')
  }

  _get_cigar() {
    return this.record._get('cigar')
  }

  _get_refname() {
    return this.adapter.refIdToName(this.record._refID)
  }

  _get_qc_failed() {
    return this.record.isFailedQc()
  }

  _get_duplicate() {
    return this.record.isDuplicate()
  }

  _get_secondary_alignment() {
    return this.record.isSecondary()
  }

  _get_supplementary_alignment() {
    return this.record.isSupplementary()
  }

  _get_multi_segment_template() {
    return this.record.isPaired()
  }

  _get_multi_segment_all_correctly_aligned() {
    return this.record.isProperlyPaired()
  }

  _get_multi_segment_all_aligned() {
    return this.record.isProperlyPaired()
  }

  _get_multi_segment_next_segment_unmapped() {
    return this.record.isMateUnmapped()
  }

  _get_multi_segment_first() {
    return this.record.isRead1()
  }

  _get_multi_segment_last() {
    return this.record.isRead2()
  }

  _get_multi_segment_next_segment_reversed() {
    return this.record.isMateReverseComplemented()
  }

  _get_unmapped() {
    return this.record.isSegmentUnmapped()
  }

  _get_next_refname() {
    return this.adapter.refIdToName(this.record._next_refid())
  }

  _get_next_segment_position() {
    return this.record.isPaired()
      ? `${this.adapter.refIdToName(
          this.record._next_refid(),
        )}:${this.record._next_pos() + 1}`
      : undefined
  }

  _get_tags() {
    return this.record._tags()
  }

  _get_seq() {
    return this.record.getReadBases()
  }

  _get_md() {
    return this.record._get('md')
  }

  set(): void {}

  tags() {
    return this._get_tags()
  }

  id() {
    return this.record.get('id')
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

  parent() {
    return undefined
  }

  children() {
    return undefined
  }

  pairedFeature() {
    return false
  }

  toJSON() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plain: any = {}
    this.tags().forEach((t: string) => {
      plain[t] = this.get(t)
    })
    return plain
  }

  _get_mismatches(
    opts: { cigarAttributeName: string; mdAttributeName: string } = {
      cigarAttributeName: 'cigar',
      mdAttributeName: 'md',
    },
  ): Mismatch[] {
    let mismatches: Mismatch[] = []
    if (this.cachedMismatches) {
      return this.cachedMismatches
    }
    const { cigarAttributeName, mdAttributeName } = opts

    // parse the CIGAR tag if it has one
    const cigarString = this.get(cigarAttributeName)
    const cigarOps = this.parseCigar(cigarString)
    mismatches.concat(this.cigarToMismatches(cigarOps))

    // now let's look for CRAM or MD mismatches
    const mdString = this.get(mdAttributeName)

    // if there is an MD tag or CRAM mismatches, mismatches and deletions from the
    // CIGAR string are replaced by those from MD
    if (mdString) {
      mismatches = mismatches.filter(
        m => !(m.type === 'deletion' || m.type === 'mismatch'),
      )
    }

    // parse the MD tag if it has one
    if (mdString) {
      mismatches.push(...this.mdToMismatches(mdString, cigarOps, mismatches))
    }

    // uniqify the mismatches
    const seen: { [index: string]: boolean } = {}
    mismatches = mismatches.filter(m => {
      const key = `${m.type},${m.start},${m.length}`
      const s = seen[key]
      seen[key] = true
      return !s
    })
    this.cachedMismatches = mismatches

    return mismatches
  }

  private cigarToMismatches(ops: [string, number][]): Mismatch[] {
    let currOffset = 0
    const mismatches: Mismatch[] = []
    ops.forEach(oprec => {
      const op = oprec[0]
      const len = oprec[1]
      // if( op == 'M' || op == '=' || op == 'E' ) {
      //     // nothing
      // }
      if (op === 'I')
        // GAH: shouldn't length of insertion really by 0, since JBrowse internally uses zero-interbase coordinates?
        mismatches.push({
          start: currOffset,
          type: 'insertion',
          base: `${len}`,
          length: 1,
        })
      else if (op === 'D')
        mismatches.push({
          start: currOffset,
          type: 'deletion',
          base: '*',
          length: len,
        })
      else if (op === 'N')
        mismatches.push({
          start: currOffset,
          type: 'skip',
          base: 'N',
          length: len,
        })
      else if (op === 'X')
        mismatches.push({
          start: currOffset,
          type: 'mismatch',
          base: 'X',
          length: len,
        })
      else if (op === 'H')
        mismatches.push({
          start: currOffset,
          type: 'hardclip',
          base: `H${len}`,
          length: 1,
        })
      else if (op === 'S')
        mismatches.push({
          start: currOffset,
          type: 'softclip',
          base: `S${len}`,
          cliplen: len,
          length: 1,
        })

      if (op !== 'I' && op !== 'S' && op !== 'H') currOffset += len
    })
    return mismatches
  }

  // parse just the skips and deletions out of a CIGAR string
  private cigarToSkipsAndDeletions(ops: [string, number][]): Mismatch[] {
    let currOffset = 0
    const mismatches: Mismatch[] = []
    ops.forEach(oprec => {
      const op = oprec[0]
      const len = oprec[1]
      if (op === 'D')
        mismatches.push({
          start: currOffset,
          type: 'deletion',
          base: '*',
          length: len,
        })
      else if (op === 'N')
        mismatches.push({
          start: currOffset,
          type: 'skip',
          base: 'N',
          length: len,
        })

      if (op !== 'I' && op !== 'S' && op !== 'H') currOffset += len
    })
    return mismatches
  }

  private parseCigar(cigar: string): [string, number][] {
    return (cigar.toUpperCase().match(/\d+\D/g) || []).map((op: string) => {
      // @ts-ignore
      return [op.match(/\D/)[0], parseInt(op, 10)]
    })
  }

  /**
   * parse a SAM MD tag to find mismatching bases of the template versus the reference
   * @returns {Array[Object]} array of mismatches and their positions
   * @private
   */
  private mdToMismatches(
    mdstring: string,
    cigarOps: [string, number][],
    cigarMismatches: Mismatch[],
  ) {
    const mismatchRecords: Mismatch[] = []
    let curr: Mismatch = { start: 0, base: '', length: 0, type: 'mismatch' }

    // convert a position on the reference sequence to a position
    // on the template sequence, taking into account hard and soft
    // clipping of reads

    function nextRecord() {
      // correct the start of the current mismatch if it comes after a cigar skip
      ;(cigarMismatches || []).forEach((mismatch: Mismatch) => {
        if (mismatch.type === 'skip' && curr.start >= mismatch.start) {
          curr.start += mismatch.length
        }
      })

      // record it
      mismatchRecords.push(curr)

      // get a new mismatch record ready
      curr = {
        start: curr.start + curr.length,
        length: 0,
        base: '',
        type: 'mismatch',
      }
    }

    const seq = this.get('seq')

      // now actually parse the MD string
    ;(mdstring.match(/(\d+|\^[a-z]+|[a-z])/gi) || []).forEach(token => {
      if (token.match(/^\d/)) {
        // matching bases
        curr.start += parseInt(token, 10)
      } else if (token.match(/^\^/)) {
        // insertion in the template
        curr.length = token.length - 1
        curr.base = '*'
        curr.type = 'deletion'
        curr.seq = token.substring(1)
        nextRecord()
      } else if (token.match(/^[a-z]/i)) {
        // mismatch
        for (let i = 0; i < token.length; i += 1) {
          curr.length = 1
          curr.base = seq
            ? seq.substr(
                cigarOps
                  ? this.getTemplateCoord(curr.start, cigarOps)
                  : curr.start,
                1,
              )
            : 'X'
          curr.altbase = token
          nextRecord()
        }
      }
    })
    return mismatchRecords
  }

  private getTemplateCoord(refCoord: number, cigarOps: [string, number][]) {
    let templateOffset = 0
    let refOffset = 0
    for (let i = 0; i < cigarOps.length && refOffset <= refCoord; i += 1) {
      const op = cigarOps[i][0]
      const len = cigarOps[i][1]
      if (op === 'S' || op === 'I') {
        templateOffset += len
      } else if (op === 'D' || op === 'P') {
        refOffset += len
      } else {
        templateOffset += len
        refOffset += len
      }
    }
    return templateOffset - (refOffset - refCoord)
  }
}
