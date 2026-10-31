import { SimpleFeature, updateStatus } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

/**
 * The residues behind a sequence adapter, the shape `@gmod/indexedfasta` and
 * `@gmod/twobit` already have: `end` is clamped to the contig, and `undefined`
 * means the file lacks the refName, which is not an error: the adapter answers
 * with no feature.
 */
export interface SequenceSource {
  getSequence: (
    refName: string,
    start: number,
    end: number,
  ) => Promise<string | undefined>
}

/**
 * The one feature a sequence adapter emits for a region, its `end` taken from
 * the residues that arrived: consumers anchor them at `start` and take the
 * extent from `end`, so the asked-for `end` would count bases past the contig.
 */
export function sequenceFeatures(
  { refName, start, end }: NoAssemblyRegion,
  opts: BaseOptions | undefined,
  setup: () => Promise<SequenceSource>,
) {
  const { statusCallback, signal } = opts ?? {}
  return ObservableCreate<Feature>(async observer => {
    // outside updateStatus, whose label would clobber setup's own phases
    const source = await setup()
    await updateStatus(
      'Downloading sequence',
      statusCallback,
      async () => {
        const seq = await source.getSequence(refName, start, end)
        checkAbortSignal(signal)
        if (seq) {
          const regionEnd = start + seq.length
          observer.next(
            new SimpleFeature({
              id: `${refName}-${start}-${regionEnd}`,
              data: { refName, start, end: regionEnd, seq },
            }),
          )
        }
      },
      signal,
    )
    observer.complete()
  })
}
