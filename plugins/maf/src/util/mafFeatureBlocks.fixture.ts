// `MafFeature`s fed into a sink the way an adapter's `readBlocks` feeds it, so
// tests and benches can hold the direct parse equal to the feature path.
import { subscribeToObservable } from '@jbrowse/core/util/rxjs'

import { MafTableSink } from './mafFeatureTable.ts'

import type { AlignmentRecord, EmptyRecord } from '../types.ts'
import type { MafBlockSink } from './mafBlockSink.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Observable } from 'rxjs'

export function addFeatureBlock(sink: MafBlockSink, feature: Feature) {
  const seq = feature.get('seq') as string
  const alignments = feature.get('alignments') as Record<
    string,
    AlignmentRecord
  >
  const empties = feature.get('empties') as
    | Record<string, EmptyRecord>
    | undefined
  sink.startBlock(
    feature.id(),
    feature.get('start'),
    feature.get('end'),
    seq,
    0,
    seq.length,
    feature.get('refSampleId') as string | undefined,
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

/** {@link MafTableSink} over blocks as `MafFeature`s. */
export async function mafFeatureTable(
  features: Observable<Feature>,
  refName: string,
) {
  const sink = new MafTableSink(refName)
  await featureBlocks(features, sink)
  return sink.table()
}

/** {@link mafFeatureTable} over blocks already fetched. */
export function mafFeatureTableOf(
  features: Iterable<Feature>,
  refName: string,
) {
  const sink = new MafTableSink(refName)
  for (const feature of features) {
    addFeatureBlock(sink, feature)
  }
  return sink.table()
}
