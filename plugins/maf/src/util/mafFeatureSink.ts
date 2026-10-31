import MafFeature from '../MafFeature.ts'

import type {
  AlignmentContext,
  AlignmentRecord,
  EmptyRecord,
} from '../types.ts'
import type { MafBlockSink } from './mafBlockSink.ts'

/**
 * A {@link MafBlockSink} that files each block as a `MafFeature`, slicing
 * every range it is handed into the record's `seq`. A block's feature goes to
 * `emit` once the next block starts, or at `finish`.
 */
export class MafFeatureSink implements MafBlockSink {
  private refName: string
  private emit: (feature: MafFeature) => void
  private pending: MafFeature | undefined
  private alignments: Record<string, AlignmentRecord> = {}
  private empties: Record<string, EmptyRecord> = {}

  constructor(refName: string, emit: (feature: MafFeature) => void) {
    this.refName = refName
    this.emit = emit
  }

  startBlock(
    id: string,
    start: number,
    end: number,
    ref: string,
    refFrom: number,
    refTo: number,
    refSampleId: string | undefined,
  ) {
    this.finish()
    this.alignments = {}
    this.empties = {}
    this.pending = new MafFeature(
      id,
      start,
      end,
      this.refName,
      this.alignments,
      ref.slice(refFrom, refTo),
      this.empties,
      refSampleId,
    )
  }

  addRow(
    sampleId: string,
    text: string,
    from: number,
    to: number,
    srcRefName: string,
    srcStart: number,
    strand: number,
    srcSize: number,
    context: AlignmentContext | undefined,
  ) {
    const seq = text.slice(from, to)
    this.alignments[sampleId] =
      context === undefined
        ? { srcRefName, srcStart, seq, strand, srcSize }
        : { srcRefName, srcStart, seq, strand, srcSize, context }
  }

  addEmpty(sampleId: string, empty: EmptyRecord) {
    this.empties[sampleId] = empty
  }

  finish() {
    if (this.pending) {
      this.emit(this.pending)
      this.pending = undefined
    }
  }
}
