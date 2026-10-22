import { SimpleFeature, updateStatus } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

/**
 * The residues behind a sequence adapter, the shape `@gmod/indexedfasta` and
 * `@gmod/twobit` already have. `undefined` means the file lacks the refName,
 * which is not an error: the adapter answers with no feature.
 */
export interface SequenceSource {
  getSequenceSize: (refName: string) => Promise<number | undefined>
  getSequence: (
    refName: string,
    start: number,
    end: number,
  ) => Promise<string | undefined>
}

/**
 * The one feature a sequence adapter emits for a region, its `end` clamped to
 * the contig: consumers anchor the residues at `start` and take the extent
 * from `end`, so an unclamped `end` would count bases `seq` lacks.
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
        const size = await source.getSequenceSize(refName)
        const regionEnd = size === undefined ? end : Math.min(size, end)
        const seq = await source.getSequence(refName, start, regionEnd)
        checkAbortSignal(signal)
        if (seq) {
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
