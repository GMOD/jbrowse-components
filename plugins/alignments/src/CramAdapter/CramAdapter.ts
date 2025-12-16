import { CraiIndex, IndexedCramFile } from '@gmod/cram'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { sum, updateStatus } from '@jbrowse/core/util'
import QuickLRU from '@jbrowse/core/util/QuickLRU'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import CramSlightlyLazyFeature from './CramSlightlyLazyFeature'
import { filterReadFlag, filterTagValue, parseSamHeader } from '../shared/util'

import type { FilterBy } from '../shared/types'
import type { ParsedSamHeader } from '../shared/util'
import type {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class CramAdapter extends BaseFeatureDataAdapter {
  public samHeader?: ParsedSamHeader

  private setupP?: Promise<{
    samHeader: ParsedSamHeader
    cram: IndexedCramFile
  }>

  private configureResult?: { cram: IndexedCramFile }

  private sequenceAdapterP?: Promise<BaseSequenceAdapter>

  // Fallback for standalone CRAM tracks that don't have sequenceAdapter in config
  public sequenceAdapterConfig?: Record<string, unknown>

  private ultraLongFeatureCache = new QuickLRU<number, Feature>({
    maxSize: 500,
  })

  private seqIdToOriginalRefName: string[] = []

  private configure() {
    if (!this.configureResult) {
      const cramLocation = this.getConf('cramLocation')
      const craiLocation = this.getConf('craiLocation')

      this.configureResult = {
        cram: new IndexedCramFile({
          cramFilehandle: openLocation(cramLocation, this.pluginManager),
          index: new CraiIndex({
            filehandle: openLocation(craiLocation, this.pluginManager),
          }),
          seqFetch: async (seqId: number, start: number, end: number) => {
            const sequenceAdapter = await this.getSequenceAdapter()
            if (!sequenceAdapter) {
              throw new Error('no sequenceAdapter available')
            }
            const refName =
              this.refIdToOriginalName(seqId) || this.refIdToName(seqId)
            if (!refName) {
              throw new Error('unknown refName')
            }

            return (
              (await sequenceAdapter.getSequence({
                refName,
                start: start - 1,
                end,
              })) ?? ''
            )
          },
          checkSequenceMD5: false,
        }),
      }
    }
    return this.configureResult
  }

  async getSequenceAdapter() {
    // Check config first, fall back to externally-set property for standalone tracks
    const config = this.getConf('sequenceAdapter') || this.sequenceAdapterConfig
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

  private async setup(_opts?: BaseOptions) {
    this.setupP ??= (async () => {
      const { cram } = this.configure()
      const rawHeader = await cram.cram.getSamHeader()
      const samHeader = parseSamHeader(rawHeader)
      this.samHeader = samHeader
      return { samHeader, cram }
    })().catch((e: unknown) => {
      this.setupP = undefined
      this.configureResult = undefined
      throw e
    })

    return this.setupP
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

  getFeatures(
    region: Region & { originalRefName?: string },
    opts?: BaseOptions & {
      filterBy?: FilterBy
    },
  ) {
    const { stopToken, filterBy, statusCallback = () => {} } = opts || {}
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
      let records
      try {
        records = await updateStatus(
          'Downloading alignments',
          statusCallback,
          () => cram.getRecordsForRange(refId, start, end),
        )
      } catch (e) {
        // Clear caches on error so reload works
        this.setupP = undefined
        this.configureResult = undefined
        throw e
      }
      checkStopToken(stopToken)
      await updateStatus('Processing alignments', statusCallback, () => {
        const {
          flagInclude = 0,
          flagExclude = 0,
          tagFilter,
          readName,
        } = filterBy || {}

        for (const record of records) {
          if (filterReadFlag(record.flags, flagInclude, flagExclude)) {
            continue
          }
          if (
            tagFilter &&
            filterTagValue(
              tagFilter.tag === 'RG'
                ? samHeader.readGroups[record.readGroupId]
                : record.tags[tagFilter.tag],
              tagFilter.value,
            )
          ) {
            continue
          }
          if (readName && record.readName !== readName) {
            continue
          }

          if (record.readLength > 5_000) {
            const ret = this.ultraLongFeatureCache.get(record.uniqueId)
            if (ret) {
              observer.next(ret)
            } else {
              const elt = new CramSlightlyLazyFeature(record, this)
              this.ultraLongFeatureCache.set(record.uniqueId, elt)
              observer.next(elt)
            }
          } else {
            observer.next(new CramSlightlyLazyFeature(record, this))
          }
        }

        observer.complete()
      })
    }, stopToken)
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
    const { cram } = this.configure()
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
