// `MafFeature`s fed into a sink the way an adapter's `readBlocks` feeds it, so
// tests and benches can hold the direct parse equal to the feature path.
import { subscribeToObservable } from '@jbrowse/core/util/rxjs'

import { addParsedBlock } from './mafBlockSink.ts'
import { MafTableSink } from './mafFeatureTable.ts'

import type { AlignmentRecord, EmptyRecord } from '../types.ts'
import type { MafBlockSink } from './mafBlockSink.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Observable } from 'rxjs'

export function addFeatureBlock(sink: MafBlockSink, feature: Feature) {
  addParsedBlock(sink, {
    uniqueId: feature.id(),
    start: feature.get('start'),
    end: feature.get('end'),
    seq: feature.get('seq') as string,
    refSampleId: feature.get('refSampleId') as string | undefined,
    alignments: feature.get('alignments') as Record<string, AlignmentRecord>,
    empties: feature.get('empties') as Record<string, EmptyRecord> | undefined,
  })
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
