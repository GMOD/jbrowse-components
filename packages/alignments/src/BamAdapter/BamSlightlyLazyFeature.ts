/* eslint-disable @typescript-eslint/camelcase,no-underscore-dangle */
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import BamAdapter from './BamAdapter'

export interface Mismatch {
  start: number
  length: number
  type: string
  base: string
  altbase?: string
  seq?: string
  cliplen?: number
}

type CigarOp = [string, number]

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
    return this.record.mappingQuality
  }

  _get_flags(): string {
    return `0x${this.record.flags.toString(16)}`
  }

  _get_strand(): number {
    return this.record.isReverseComplemented() ? -1 : 1
  }

  _get_read_group_id(): number {
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
      ? `${this.adapter.refIdToName(
          this.record._next_refid(),
        )}:${this.record._next_pos() + 1}`
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
    return this.record.id()
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plain: any = {}
    this.tags().forEach((t: string) => {
      plain[t] = this.get(t)
    })
    plain.refName = this.get('refName')
    plain.name = this.get('name')
    plain.type = this.get('type')
    plain.uniqueId = this.id()
    plain.clipPos = this._get_clippos()
    return plain
  }

  _get_mismatches(
    opts: { cigarAttributeName: string; mdAttributeName: string } = {
      cigarAttributeName: 'cigar',
      mdAttributeName: 'md',
    },
  ): Mismatch[] {
    const { cigarAttributeName, mdAttributeName } = opts
    let mismatches: Mismatch[] = []
    let cigarOps: CigarOp[] = []

    // parse the CIGAR tag if it has one
    const cigarString = this.get(cigarAttributeName)
    if (cigarString) {
      cigarOps = this.parseCigar(cigarString)
      mismatches = mismatches.concat(this.cigarToMismatches(cigarOps))
    }

    // now let's look for CRAM or MD mismatches
    const mdString = this.get(mdAttributeName)
    if (mdString) {
      mismatches = mismatches.concat(
        this.mdToMismatches(mdString, cigarOps, mismatches),
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
    return this.get('strand') === -1
      ? +(this.get('CIGAR').match(/(\d+)[SH]$/) || [])[1] || 0
      : +(this.get('CIGAR').match(/^(\d+)([SH])/) || [])[1] || 0
  }

  private cigarToMismatches(ops: CigarOp[]): Mismatch[] {
    let currOffset = 0
    const mismatches: Mismatch[] = []
    ops.forEach(oprec => {
      const op = oprec[0]
      const len = oprec[1]
      // if( op == 'M' || op == '=' || op == 'E' ) {
      //     // nothing
      // }
      if (op === 'I') {
        // GAH: shouldn't length of insertion really by 0, since JBrowse internally uses zero-interbase coordinates?
        mismatches.push({
          start: currOffset,
          type: 'insertion',
          base: `${len}`,
          length: 1,
        })
      } else if (op === 'D') {
        mismatches.push({
          start: currOffset,
          type: 'deletion',
          base: '*',
          length: len,
        })
      } else if (op === 'N') {
        mismatches.push({
          start: currOffset,
          type: 'skip',
          base: 'N',
          length: len,
        })
      } else if (op === 'X') {
        mismatches.push({
          start: currOffset,
          type: 'mismatch',
          base: 'X',
          length: len,
        })
      } else if (op === 'H') {
        mismatches.push({
          start: currOffset,
          type: 'hardclip',
          base: `H${len}`,
          cliplen: len,
          length: 1,
        })
      } else if (op === 'S') {
        mismatches.push({
          start: currOffset,
          type: 'softclip',
          base: `S${len}`,
          cliplen: len,
          length: 1,
        })
      }

      if (op !== 'I' && op !== 'S' && op !== 'H') currOffset += len
    })
    return mismatches
  }

  // parse just the skips and deletions out of a CIGAR string
  private cigarToSkipsAndDeletions(ops: CigarOp[]): Mismatch[] {
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

  private parseCigar(cigar: string): CigarOp[] {
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
    cigarOps: CigarOp[],
    cigarMismatches: Mismatch[],
  ): Mismatch[] {
    const mismatchRecords: Mismatch[] = []
    let curr: Mismatch = { start: 0, base: '', length: 0, type: 'mismatch' }

    // convert a position on the reference sequence to a position
    // on the template sequence, taking into account hard and soft
    // clipping of reads

    function nextRecord(): void {
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

  private getTemplateCoord(refCoord: number, cigarOps: CigarOp[]): number {
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
