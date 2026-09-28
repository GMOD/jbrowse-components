import { subscribeToObservable } from '@jbrowse/core/util/rxjs'

import type {
  AlignmentContext,
  AlignmentRecord,
  EmptyRecord,
} from '../types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Observable } from 'rxjs'

/**
 * Where a MAF adapter writes a region's blocks when the reader wants them
 * packed rather than as `MafFeature`s: a block, then its rows in the order a
 * `MafFeature`'s `alignments` lists them, then its empties. Every sequence
 * arrives as `text[from..to)`, so an adapter hands over a range of the line it
 * parsed rather than a string per species.
 */
export interface MafBlockSink {
  startBlock(
    id: string,
    start: number,
    end: number,
    strand: number,
    ref: string,
    refFrom: number,
    refTo: number,
  ): void
  addRow(
    sampleId: string,
    text: string,
    from: number,
    to: number,
    chr: string,
    srcStart: number,
    strand: number,
    srcSize: number | undefined,
    context: AlignmentContext | undefined,
  ): void
  addEmpty(sampleId: string, empty: EmptyRecord): void
}

export function addFeatureBlock(sink: MafBlockSink, feature: Feature) {
  const alignments = feature.get('alignments') as Record<
    string,
    AlignmentRecord
  >
  const empties = feature.get('empties') as
    | Record<string, EmptyRecord>
    | undefined
  const ref = feature.get('seq') as string
  sink.startBlock(
    feature.id(),
    feature.get('start'),
    feature.get('end'),
    feature.get('strand') ?? 0,
    ref,
    0,
    ref.length,
  )
  for (const sampleId in alignments) {
    const a = alignments[sampleId]!
    sink.addRow(
      sampleId,
      a.seq,
      0,
      a.seq.length,
      a.chr,
      a.srcStart,
      a.strand ?? 1,
      a.srcSize,
      a.context,
    )
  }
  for (const sampleId in empties) {
    sink.addEmpty(sampleId, empties[sampleId]!)
  }
}

/** Every `MafFeature` of `features` into `sink`. */
export function featureBlocks(
  features: Observable<Feature>,
  sink: MafBlockSink,
) {
  return subscribeToObservable(features, feature => {
    addFeatureBlock(sink, feature)
  })
}
