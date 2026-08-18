import { SimpleFeature, updateStatus } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

/**
 * The residues behind a sequence adapter. `@gmod/indexedfasta` and
 * `@gmod/twobit` already have this shape; UnindexedFastaAdapter wraps its
 * in-memory map in it.
 *
 * `undefined` from either method means the file has no such refName, which is
 * not an error — an assembly's sequence file legitimately lacks contigs the
 * rest of the session knows about, and the adapter answers with no feature.
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
 * The single feature a sequence adapter emits for a region, shared by all of
 * them.
 *
 * The clamp to the contig length is why this is written once rather than three
 * times. Regions routinely run past the end of a contig — a scan adapter pads
 * its window by 10kb, a block sits at the edge of the last contig — and the file
 * answers with fewer residues than were asked for. The feature has to report the
 * end it actually got: consumers anchor the residues at `start` and take the
 * extent from `end`, so an unclamped feature claims bases it does not carry.
 */
export function sequenceFeatures(
  { refName, start, end }: NoAssemblyRegion,
  opts: BaseOptions | undefined,
  setup: () => Promise<SequenceSource>,
) {
  const { statusCallback, stopToken } = opts ?? {}
  return ObservableCreate<Feature>(async observer => {
    // outside the updateStatus below because setup owns its own phase labels —
    // an unindexed FASTA downloads and parses the whole file here — and a
    // 'Downloading sequence' wrapper would clobber them
    const source = await setup()
    await updateStatus(
      'Downloading sequence',
      statusCallback,
      async () => {
        const size = await source.getSequenceSize(refName)
        const regionEnd = size === undefined ? end : Math.min(size, end)
        const seq = await source.getSequence(refName, start, regionEnd)
        checkStopToken(stopToken)
        if (seq) {
          observer.next(
            new SimpleFeature({
              id: `${refName}-${start}-${regionEnd}`,
              data: { refName, start, end: regionEnd, seq },
            }),
          )
        }
      },
      stopToken,
    )
    observer.complete()
  })
}
