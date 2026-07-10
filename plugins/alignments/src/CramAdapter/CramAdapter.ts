import { CraiIndex, IndexedCramFile } from '@gmod/cram'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadStatus, sum, withProgress } from '@jbrowse/core/util'
import QuickLRU from '@jbrowse/core/util/QuickLRU'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import CramSlightlyLazyFeature from './CramSlightlyLazyFeature.ts'
import {
  filterReadFlag,
  filterTagValue,
  parseSamHeader,
} from '../shared/util.ts'

import type { CramAdapterConfig } from './configSchema.ts'
import type { FilterBy } from '../shared/types.ts'
import type { ParsedSamHeader } from '../shared/util.ts'
import type { CramRecord } from '@gmod/cram'
import type {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
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
    const tagValue =
      tf.tag === 'RG'
        ? samHeader.readGroups[record.readGroupId]
        : record.tags[tf.tag]
    return filterTagValue(tagValue, tf.value)
  })
  if (failsTag) {
    return true
  }
  return readName !== undefined && record.readName !== readName
}

export default class CramAdapter extends BaseFeatureDataAdapter<CramAdapterConfig> {
  public samHeader?: ParsedSamHeader

  private setupP?: Promise<{
    samHeader: ParsedSamHeader
    cram: IndexedCramFile
  }>

  // true once the header + .crai index have downloaded; gates the status label
  // so pan/zoom re-entry into setup() doesn't re-flash "Downloading index"
  private setupDone = false

  // the CraiIndex is kept alongside `cram` because IndexedCramFile.index is
  // typed as the minimal CramIndexLike (no getIndex); we need the concrete
  // CraiIndex to pre-download the .crai with progress in setup()
  private configureResult?: { cram: IndexedCramFile; index: CraiIndex }

  private sequenceAdapterP?: Promise<BaseSequenceAdapter>

  private ultraLongFeatureCache = new QuickLRU<number, Feature>({
    maxSize: 500,
  })

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
    const seq = await sequenceAdapter.getSequence({
      refName,
      start: start - 1,
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
        seqFetch: (seqId: number, start: number, end: number) =>
          this.seqFetch(seqId, start, end),
        checkSequenceMD5: false,
      })
      this.configureResult = { cram, index }
    }
    return this.configureResult
  }

  private clearCaches() {
    this.setupP = undefined
    this.setupDone = false
    this.configureResult = undefined
  }

  async getSequenceAdapter() {
    const config = this.sequenceAdapterConfig
    if (!config || !this.getSubAdapter) {
      return undefined
    }
    this.sequenceAdapterP ??= this.getSubAdapter(config)
      .then(r => r.dataAdapter as BaseSequenceAdapter)
      .catch((e: unknown) => {
        this.sequenceAdapterP = undefined
        throw e
      })
    return this.sequenceAdapterP
  }

  async getHeader(_opts?: BaseOptions) {
    const { cram } = this.configure()
    return cram.cram.getHeaderText()
  }

  // The header read + .crai parse are memoized in setupP so they run exactly
  // once. CraiIndex.getIndex memoizes its own parse too, so the later
  // per-region getEntriesForRange calls reuse this download instead of pulling
  // the index again.
  private setupOnce(onProgress?: (bytes: number, total?: number) => void) {
    this.setupP ??= (async () => {
      const { cram, index } = this.configure()
      const rawHeader = await cram.cram.getSamHeader()
      this.samHeader = parseSamHeader(rawHeader)
      await index.getIndex({ onProgress })
      this.setupDone = true
      return { samHeader: this.samHeader, cram }
    })().catch((e: unknown) => {
      this.clearCaches()
      throw e
    })

    return this.setupP
  }

  // Show "Downloading index" only while the header/index are genuinely
  // downloading (the first fetch, typically during refname mapping). Once
  // loaded, callers (every getFeatures on pan/zoom) await the cached promise
  // silently rather than re-flashing the label. Mirrors BamAdapter.setup.
  private async setup(opts?: BaseOptions) {
    return this.setupDone
      ? this.setupOnce()
      : downloadStatus('Downloading index', opts?.statusCallback, onProgress =>
          this.setupOnce(onProgress),
        )
  }

  async getRefNames(opts?: BaseOptions) {
    const { samHeader } = await this.setup(opts)
    return samHeader.idToName
  }

  refNameToId(refName: string) {
    return this.samHeader?.nameToId[refName]
  }

  refIdToName(refId: number) {
    return this.samHeader?.idToName[refId]
  }

  refIdToOriginalName(refId: number) {
    return this.seqIdToOriginalRefName[refId]
  }

  private getOrCacheFeature(record: CramRecord) {
    const cached = this.ultraLongFeatureCache.get(record.uniqueId)
    if (cached) {
      return cached
    }
    const feat = new CramSlightlyLazyFeature(record, this)
    this.ultraLongFeatureCache.set(record.uniqueId, feat)
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
      const { cram, samHeader } = await this.setup(opts)

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
      const records = await downloadStatus(
        'Downloading alignments',
        statusCallback,
        onProgress =>
          cram.getRecordsForRange(refId, start, end, {
            onProgress,
          }),
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

  /**
   * we return the configured fetchSizeLimit, and the bytes for the region
   */
  async getMultiRegionFeatureDensityStats(regions: Region[]) {
    const bytes = await this.bytesForRegions(regions)
    const fetchSizeLimit = this.getConf('fetchSizeLimit')
    return {
      bytes,
      fetchSizeLimit,
    }
  }

  /**
   * get the approximate number of bytes queried from the file for the given
   * query regions
   */
  private async bytesForRegions(regions: Region[]) {
    // setup() (not just configure()) so samHeader is populated — refNameToId
    // reads it, and without it every region resolves to 0 bytes, silently
    // bypassing the fetchSizeLimit warning in a worker that hasn't yet loaded
    // the header.
    const { cram } = await this.setup()
    const blockResults = await Promise.all(
      regions.map(region => {
        const { refName, start, end } = region
        const chrId = this.refNameToId(refName)
        return chrId !== undefined
          ? cram.index.getEntriesForRange(chrId, start, end)
          : Promise.resolve([{ sliceBytes: 0 }])
      }),
    )

    return sum(blockResults.flat().map(a => a.sliceBytes))
  }
}
