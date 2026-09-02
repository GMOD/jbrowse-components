import { CraiIndex, IndexedCramFile } from '@gmod/cram'
import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadStatus, sum, withProgress } from '@jbrowse/core/util'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  checkStopToken,
  withStopTokenSignal,
} from '@jbrowse/core/util/stopToken'

import { BaseSamAdapter } from '../shared/BaseSamAdapter.ts'
import {
  filterReadFlag,
  filterSpliced,
  filterTagValue,
} from '../shared/util.ts'
import CramSlightlyLazyFeature, {
  cramReadGroup,
} from './CramSlightlyLazyFeature.ts'

import type { FilterBy } from '../shared/types.ts'
import type { ParsedSamHeader } from '../shared/util.ts'
import type { CramAdapterConfig } from './configSchema.ts'
import type { CramRecord } from '@gmod/cram'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

/**
 * How many workers @gmod/cram should decode slices on, per RPC worker.
 *
 * Its own default is `min(hardwareConcurrency, 4)`, which is right for a
 * consumer with one JS context and wrong for this one. Each track gets its own
 * rpcSessionId and those round-robin over up to five RPC workers, so N CRAM
 * tracks sit in N contexts — and the pool is shared per *context*, so five
 * tracks start five pools. At the library default that is 5 x 4 = 20 slice
 * workers plus the RPC workers themselves.
 *
 * On a machine with cores to spare that is free. On a laptop it is not.
 * Measured on the jb2bench 19 kb region at 1000x short-read coverage, timing
 * the slowest track (a pan is not done until every track has drawn), best of
 * 4 reps:
 *
 *                       4 cores            16 cores
 *   tracks  pool     workers  slowest    workers  slowest
 *        1     4           5    220 ms         5    148 ms
 *        1     2           3    241 ms         3    203 ms
 *        3     4          15    669 ms        15    259 ms
 *        3     2           9    498 ms         9    304 ms
 *        5     4          25   1347 ms        25    484 ms
 *        5     2          15    956 ms        15    471 ms
 *
 * So 4 wins on 16 cores everywhere, and loses badly on 4 cores from three
 * tracks up — 1.41x at five. Halving the core count gives both: 2 on a 4-core
 * machine, 4 on anything from 8 up, which is where the library default already
 * caps.
 *
 * The trade is deliberate. A single track on a 4-core machine gets slightly
 * slower (220 -> 241 ms) so that five tracks get much faster (1347 -> 956 ms),
 * and the multi-track case is the one where the user is actually waiting.
 *
 * Note this pool is not the only one in a context: `sharedBgzfWorkerPool` puts
 * another four in any context that also holds a bgzip-backed track, and nothing
 * coordinates the two. Sizing this one down is a local fix for a gap that is
 * really about the total — see the note in `util/bgzfWorkerPool.ts` on why the
 * per-context scope was chosen, and `util/cacheBudgets.ts` for how the same
 * "per-instance ceiling times N instances bounds nothing" problem was solved
 * for memory.
 */
function sliceWorkerCount() {
  const cores =
    typeof navigator === 'undefined' ? 1 : navigator.hardwareConcurrency || 1
  return Math.max(2, Math.min(4, Math.floor(cores / 2)))
}

function shouldFilterRecord(
  record: CramRecord,
  filterBy: FilterBy | undefined,
  samHeader: ParsedSamHeader,
) {
  const {
    flagInclude = 0,
    flagExclude = 0,
    tagFilters,
    readName,
    spliced,
  } = filterBy ?? {}
  if (filterReadFlag(record.flags, flagInclude, flagExclude)) {
    return true
  }
  // CRAM has no CIGAR; a skip is an 'N' read feature. `readFeatures` is
  // rebuilt per access, which the thunk keeps off every read while the filter
  // is off.
  if (
    filterSpliced(
      spliced,
      () => record.readFeatures?.some(f => f.code === 'N') ?? false,
    )
  ) {
    return true
  }
  // Multiple tag filters are AND-ed: reject the read if any one rejects it.
  const failsTag = tagFilters?.some(tf => {
    // getTag rather than record.tags[...]: this runs per record of the query, and
    // the object form decodes every tag on the read to answer for the one being
    // filtered on.
    const tagValue =
      tf.tag === 'RG' ? cramReadGroup(samHeader, record) : record.getTag(tf.tag)
    return filterTagValue(tagValue, tf.value)
  })
  if (failsTag) {
    return true
  }
  return readName !== undefined && record.readName !== readName
}

export default class CramAdapter extends BaseSamAdapter<CramAdapterConfig> {
  // the CraiIndex is kept alongside `cram` because IndexedCramFile.index is
  // typed as the minimal CramIndexLike (no getIndex); we need the concrete
  // CraiIndex to pre-download the .crai with progress in setup()
  private configureResult?: {
    cram: IndexedCramFile<CramSlightlyLazyFeature>
    index: CraiIndex
  }

  private seqIdToOriginalRefName: string[] = []

  private getSeqAdapterRefNames = cachedSetup({
    setup: async () => {
      const adapter = await this.getSequenceAdapter()
      return new Set(adapter ? await adapter.getRefNames() : [])
    },
  })

  private async resolveSeqFetchRefName(seqId: number) {
    const originalName = this.refIdToOriginalName(seqId)
    const cramName = this.refIdToName(seqId)
    const seqRefNames = await this.getSeqAdapterRefNames()
    if (originalName && seqRefNames.has(originalName)) {
      return originalName
    }
    if (cramName && seqRefNames.has(cramName)) {
      return cramName
    }
    // fall back to whatever we have, even if not in the set
    return originalName ?? cramName
  }

  private async seqFetch(seqId: number, start: number, end: number) {
    const sequenceAdapter = await this.getSequenceAdapter()
    if (!sequenceAdapter) {
      throw new Error('no sequenceAdapter available')
    }
    const refName = await this.resolveSeqFetchRefName(seqId)
    if (!refName) {
      throw new Error('unknown refName')
    }
    // @gmod/cram is 0-based half-open since v10, which is what getSequence
    // already takes, so the coordinates pass straight through
    const seq = await sequenceAdapter.getSequence({
      refName,
      start,
      end,
    })
    return seq ?? ''
  }

  private configure() {
    if (!this.configureResult) {
      const index = new CraiIndex({
        filehandle: openLocation(
          this.getConf('craiLocation'),
          this.pluginManager,
        ),
      })
      const cram = new IndexedCramFile({
        cramFilehandle: openLocation(
          this.getConf('cramLocation'),
          this.pluginManager,
        ),
        index,
        fetchReferenceSequence: (seqId: number, start: number, end: number) =>
          this.seqFetch(seqId, start, end),
        checkSequenceMD5: false,
        recordClass: CramSlightlyLazyFeature,
        // maxCacheBytes is per file, and one IndexedCramFile is held per open
        // track, so its 1GB ceiling was multiplied by the track count with
        // nothing bounding the sum; see cacheBudgets. The slice cache weighs
        // bytes since @gmod/cram 14, so it shares the BAM and tabix budget
        cacheBudget: decompressedBytesBudget,
        useSliceWorkerPool: this.getConf('useSliceWorkerPool'),
        numSliceWorkers: sliceWorkerCount(),
      })
      this.configureResult = { cram, index }
    }
    return this.configureResult
  }

  async getHeader(_opts?: BaseOptions) {
    const { cram } = this.configure()
    return cram.cram.getHeaderText()
  }

  // CraiIndex.getIndex memoizes its own parse, so the later per-region
  // getEntriesForRange calls reuse this download instead of pulling the index
  // again. Progress goes to the .crai read, which dominates the phase.
  protected async readSamHeader(onProgress?: (n: number, t?: number) => void) {
    const { cram, index } = this.configure()
    const rawHeader = await cram.cram.getSamHeader()
    await index.getIndex({ onProgress })
    return rawHeader
  }

  refIdToOriginalName(refId: number) {
    return this.seqIdToOriginalRefName[refId]
  }

  getFeatures(
    region: Region & { originalRefName?: string },
    opts?: BaseOptions & {
      filterBy?: FilterBy
    },
  ) {
    const { stopToken, filterBy, statusCallback } = opts ?? {}
    const { refName, start, end, originalRefName } = region

    return ObservableCreate<Feature>(async observer => {
      const samHeader = await this.setup(opts)
      checkStopToken(stopToken)
      const { cram } = this.configure()

      const refId = this.refNameToId(refName)
      if (refId === undefined) {
        console.warn('Unknown refName', refName)
        observer.complete()
        return
      }

      if (originalRefName) {
        this.seqIdToOriginalRefName[refId] = originalRefName
      }
      // A failed region fetch (e.g. a transient network error mid-pan) must not
      // wipe the header/index caches — those are memoized in setup() and only
      // invalidated on a setup failure. Re-downloading them on every dropped
      // data chunk would force a full re-download on the next pan.
      //
      // The signal is what makes cancellation reach the socket, as in
      // BamAdapter: without it a canceled navigation stops *processing* the
      // records but downloads every byte of the range to completion first.
      const records = await withStopTokenSignal(stopToken, signal =>
        downloadStatus('Downloading alignments', statusCallback, onProgress =>
          cram.getRecordsForRange(refId, start, end, {
            onProgress,
            signal,
          }),
        ),
      )
      checkStopToken(stopToken)
      await withProgress(
        {
          label: 'Processing alignments',
          total: records.length,
          statusCallback,
          stopToken,
        },
        report => {
          for (const record of records) {
            report()
            if (shouldFilterRecord(record, filterBy, samHeader)) {
              continue
            }
            record.adapter = this
            observer.next(record)
          }
          observer.complete()
        },
      )
    })
  }

  // Index-only estimate of the bytes a fetch of these regions would pull.
  async getRegionByteSize(regions: Region[], opts?: BaseOptions) {
    return this.bytesForRegions(regions, opts)
  }

  /**
   * get the approximate number of bytes queried from the file for the given
   * query regions
   */
  private async bytesForRegions(regions: Region[], opts?: BaseOptions) {
    // setup() (not just configure()) so samHeader is populated — refNameToId
    // reads it, and without it every region resolves to 0 bytes, silently
    // bypassing the fetchSizeLimit warning in a worker that hasn't yet loaded
    // the header.
    await this.setup(opts)
    const { cram } = this.configure()
    const blockResults = await Promise.all(
      regions.map(region => {
        const { refName, start, end } = region
        const chrId = this.refNameToId(refName)
        return chrId !== undefined
          ? cram.index.getEntriesForRange(chrId, start, end)
          : Promise.resolve([])
      }),
    )

    // De-duplicate slices before summing. Adjacent regions routinely overlap
    // the same .crai slice, and it is downloaded once — counting it per region
    // inflated the estimate for exactly the multi-region queries this gates.
    // Keyed on where the slice lives, since a slice is identified by its
    // container plus its offset within that container's blocks.
    const slices = new Map<string, number>()
    for (const entry of blockResults.flat()) {
      slices.set(
        `${entry.containerStart}:${entry.sliceStart}`,
        entry.sliceBytes,
      )
    }
    return sum([...slices.values()])
  }
}
