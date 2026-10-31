import { revcom } from '@jbrowse/core/util'

import { applyMafLine } from './mafLines.ts'
import { RecordSlots } from './recordSlots.ts'

import type { AlignmentContext, EmptyRecord } from '../types.ts'
import type { MafBlockSink } from './mafBlockSink.ts'
import type { MafLineTarget, MafSourceLine } from './mafLines.ts'
import type { SourceResolver, makeSourceResolver } from './parseAssemblyName.ts'

/** Whether a block at its reference row's forward extent is one to emit. */
export type KeepBlock = (refSrc: string, start: number, end: number) => boolean

/**
 * One block's rows on their way into a {@link MafBlockSink}, for every
 * format: a bigMaf stanza, a bgzip MAF stanza and a TAF block all file their
 * rows here, in the order a record keyed by species lists them, with no
 * record per species. The reference is the first row the reader names, taken
 * before the sample filter, so a reference the filter drops still positions
 * the block and names no row. A `-` reference row turns the whole block over
 * before it is placed.
 */
export class MafStanzaReader implements MafLineTarget {
  readonly resolve: SourceResolver
  private resolver: ReturnType<typeof makeSourceResolver>
  private rows = new RecordSlots()
  private empties = new RecordSlots()

  private seq: string[] = []
  private srcRefName: string[] = []
  private srcStart: number[] = []
  private size: number[] = []
  private strand: number[] = []
  private srcSize: number[] = []
  private rowContext: (AlignmentContext | undefined)[] = []
  private emptyRecord: EmptyRecord[] = []
  private lastRowId = new Map<string, string>()

  private refSrc: string | undefined
  private refStart = 0
  private refSize = 0
  private refStrand = 1
  private refSrcSize = 0
  private refSeq = ''

  constructor(resolver: ReturnType<typeof makeSourceResolver>) {
    this.resolver = resolver
    this.resolve = resolver.resolve
  }

  begin() {
    this.rows.startBlock()
    this.empties.startBlock()
    this.lastRowId.clear()
    this.refSrc = undefined
    this.refStrand = 1
    this.refSeq = ''
  }

  /** One MAF line; the first `s` line is the reference. */
  line(line: string) {
    const s = applyMafLine(line, this.resolve, this)
    if (s && this.refSrc === undefined) {
      this.reference(s.src, s.start, s.size, s.strand, s.srcSize, s.seq)
    }
  }

  reference(
    src: string,
    start: number,
    size: number,
    strand: number,
    srcSize: number,
    seq: string,
  ) {
    this.refSrc = src
    this.refStart = start
    this.refSize = size
    this.refStrand = strand
    this.refSrcSize = srcSize
    this.refSeq = seq
  }

  row(sampleId: string, srcRefName: string, line: MafSourceLine) {
    this.addRow(
      sampleId,
      srcRefName,
      line.start,
      line.size,
      line.strand,
      line.srcSize,
      line.seq,
    )
  }

  addRow(
    sampleId: string,
    srcRefName: string,
    srcStart: number,
    size: number,
    strand: number,
    srcSize: number,
    seq: string,
  ) {
    const { rows } = this
    const key = rows.freeKey(rows.key(sampleId))
    if (key.name !== sampleId) {
      this.lastRowId.set(sampleId, key.name)
    }
    const slot = rows.slot(key)
    this.seq[slot] = seq
    this.srcRefName[slot] = srcRefName
    this.srcStart[slot] = srcStart
    this.size[slot] = size
    this.strand[slot] = strand
    this.srcSize[slot] = srcSize
    this.rowContext[slot] = undefined
  }

  context(sampleId: string, context: AlignmentContext) {
    const slot = this.rows.slotOf(this.lastRowId.get(sampleId) ?? sampleId)
    if (slot !== -1) {
      this.rowContext[slot] = context
    }
  }

  empty(sampleId: string, empty: EmptyRecord) {
    const { empties } = this
    this.emptyRecord[empties.slot(empties.freeKey(empties.key(sampleId)))] =
      empty
  }

  /** A bigMaf stanza, `;`-joined, at the extent its bigBed feature states. */
  read(
    sink: MafBlockSink,
    id: string,
    start: number,
    end: number,
    stanza: string,
  ) {
    this.begin()
    for (const line of stanza.split(';')) {
      this.line(line)
    }
    if (this.refStrand === -1) {
      this.flip()
    }
    this.emit(sink, id, start, end)
  }

  /**
   * The block at its reference row's forward extent, where `keep` wants it.
   * Nothing without a reference row.
   */
  emitPlaced(sink: MafBlockSink, keep: KeepBlock) {
    const { refSrc } = this
    if (refSrc === undefined) {
      return false
    }
    if (this.refStrand === -1) {
      this.flip()
    }
    const start = this.refStart
    const end = start + this.refSize
    if (!keep(refSrc, start, end)) {
      return false
    }
    this.emit(sink, `${refSrc}-${start}-${this.refSize}`, start, end)
    return true
  }

  reportUnmatched() {
    this.resolver.reportUnmatched()
  }

  private flip() {
    const { rows, empties } = this
    for (let slot = 0; slot < rows.count; slot++) {
      this.srcStart[slot] =
        this.srcSize[slot]! - this.srcStart[slot]! - this.size[slot]!
      this.seq[slot] = revcom(this.seq[slot]!)
      this.strand[slot] = -this.strand[slot]!
      const context = this.rowContext[slot]
      if (context) {
        this.rowContext[slot] = {
          leftStatus: context.rightStatus,
          leftCount: context.rightCount,
          rightStatus: context.leftStatus,
          rightCount: context.leftCount,
        }
      }
    }
    for (let slot = 0; slot < empties.count; slot++) {
      const e = this.emptyRecord[slot]!
      this.emptyRecord[slot] = {
        ...e,
        srcStart: e.srcSize - e.srcStart - e.size,
        strand: -e.strand,
      }
    }
    this.refStart = this.refSrcSize - this.refStart - this.refSize
    this.refSeq = revcom(this.refSeq)
    this.refStrand = 1
  }

  private emit(sink: MafBlockSink, id: string, start: number, end: number) {
    const { rows, empties, refSrc, refSeq } = this
    const refSampleId =
      refSrc === undefined
        ? undefined
        : this.resolve(refSrc)?.assemblyName || undefined
    sink.startBlock(id, start, end, refSeq, 0, refSeq.length, refSampleId)
    const rowOrder = rows.order()
    for (let j = 0; j < rows.count; j++) {
      const slot = rowOrder[j]!
      const seq = this.seq[slot]!
      sink.addRow(
        rows.nameAt(slot),
        seq,
        0,
        seq.length,
        this.srcRefName[slot]!,
        this.srcStart[slot]!,
        this.strand[slot]!,
        this.srcSize[slot],
        this.rowContext[slot],
      )
    }
    const emptyOrder = empties.order()
    for (let j = 0; j < empties.count; j++) {
      const slot = emptyOrder[j]!
      sink.addEmpty(empties.nameAt(slot), this.emptyRecord[slot]!)
    }
  }
}
