import type { AlignmentContext, EmptyRecord } from '../types.ts'

/**
 * Where a MAF adapter writes a region's blocks when the reader wants them
 * packed rather than as `MafFeature`s: a block, then its rows in the order a
 * `MafFeature`'s `alignments` lists them, then its empties. Every sequence
 * arrives as `text[from..to)`, so an adapter hands over a range of the line it
 * parsed rather than a string per species. `refSampleId` is the row the block's
 * reference sequence is, or undefined where the sample set leaves it no row.
 */
export interface MafBlockSink {
  startBlock(
    id: string,
    start: number,
    end: number,
    ref: string,
    refFrom: number,
    refTo: number,
    refSampleId: string | undefined,
  ): void
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
  ): void
  addEmpty(sampleId: string, empty: EmptyRecord): void
}
