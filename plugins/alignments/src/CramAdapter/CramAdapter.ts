import { CraiIndex, IndexedCramFile } from '@gmod/cram'
import { downloadStatus, sum, withProgress } from '@jbrowse/core/util'
import QuickLRU from '@jbrowse/core/util/QuickLRU'
import { decodedRecordsBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  checkStopToken,
  withStopTokenSignal,
} from '@jbrowse/core/util/stopToken'

import { BaseSamAdapter } from '../shared/BaseSamAdapter.ts'
import { filterReadFlag, filterTagValue } from '../shared/util.ts'
import CramSlightlyLazyFeature from './CramSlightlyLazyFeature.ts'

import type { FilterBy } from '../shared/types.ts'
import type { ParsedSamHeader } from '../shared/util.ts'
import type { CramAdapterConfig } from './configSchema.ts'
import type { CramRecord } from '@gmod/cram'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

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
  } = filterBy ?? {}
  if (filterReadFlag(record.flags, flagInclude, flagExclude)) {
    return true
  }
  // Multiple tag filters are AND-ed: reject the read if any one rejects it.
  const failsTag = tagFilters?.some(tf => {
    // getTag rather than record.tags[...]: this runs per record of the query, and
    // the object form decodes every tag on the read to answer for the one being
    // filtered on.
    const tagValue =
      tf.tag === 'RG'
        ? samHeader.readGroups[record.readGroupId]
        : record.getTag(tf.tag)
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
  private configureResult?: { cram: IndexedCramFile; index: CraiIndex }

  private ultraLongFeatureCache = new QuickLRU<number, CramSlightlyLazyFeature>(
    { maxSize: 500 },
  )

  private seqIdToOriginalRefName: string[] = []

  private seqAdapterRefNamesP?: Promise<Set<string>>

  private async getSeqAdapterRefNames() {
    this.seqAdapterRefNamesP ??= this.getSequenceAdapter()
      .then(async adapter => {
        if (!adapter) {
          return new Set<string>()
        }
        const refNames = await adapter.getRefNames()
        return new Set(refNames)
      })
      .catch((e: unknown) => {
        this.seqAdapterRefNamesP = undefined
        throw e
      })
    return this.seqAdapterRefNamesP
  }

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
        // cacheSize is per file, and one IndexedCramFile is held per open
        // track. Its own budget, not the bytes one: this cache weighs decoded
        // records, and a budget summing records with bytes bounds neither
        cacheBudget: decodedRecordsBudget,
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

  // Long reads get their wrapper reused across fetches so what is memoized on it
  // survives a pan instead of being rebuilt per read. Measured worth ~13% of the
  // extract pass on long-read CRAM back when the wrapper retained a rebuilt
  // NUMERIC_CIGAR — ~2 MB across a 37-read ONT slice.
  //
  // It retains far less now: the render path reads `clipLengthAtStartOfRead`,
  // which is memoized as a *number*, and NUMERIC_CIGAR is built only if a
  // consumer asks for the packed form. So this is worth re-measuring — it may
  // now be carrying its own bookkeeping for a memo of 8 bytes per read, in which
  // case deleting it is simpler and frees the LRU's retention of the records
  // themselves. Left in place because that has not been measured, not because it
  // is known to still pay.
  private getOrCacheFeature(record: CramRecord) {
    let feat = this.ultraLongFeatureCache.get(record.uniqueId)
    if (!feat) {
      feat = new CramSlightlyLazyFeature(record, this)
      this.ultraLongFeatureCache.set(record.uniqueId, feat)
    }
    return feat
  }

  getFeatures(
    region: Region & { originalRefName?: string },
    opts?: BaseOptions & {
      filterBy?: FilterBy
    },
  ) {
    const { stopToken, filterBy, statusCallback = () => {} } = opts ?? {}
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
            const feat =
              record.readLength > 5_000
                ? this.getOrCacheFeature(record)
                : new CramSlightlyLazyFeature(record, this)
            observer.next(feat)
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
