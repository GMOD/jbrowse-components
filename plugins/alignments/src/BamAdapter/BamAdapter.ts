import { BamFile } from '@gmod/bam'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadStatus, withProgress } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import BamSlightlyLazyFeature from './BamSlightlyLazyFeature.ts'
import { filterTagValue, parseSamHeader } from '../shared/util.ts'

import type { BamAdapterConfig } from './configSchema.ts'
import type { FilterBy } from '../shared/types.ts'
import type { ParsedSamHeader } from '../shared/util.ts'
import type {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

// Returns the [start, end) span of records that lack an MD tag and need
// reference sequence for mismatch rendering, or null if none do.
function seqFetchSpan(
  records: readonly { NUMERIC_MD: unknown; start: number; end: number }[],
) {
  let start = Infinity
  let end = 0
  for (const record of records) {
    if (!record.NUMERIC_MD) {
      start = Math.min(start, record.start)
      end = Math.max(end, record.end)
    }
  }
  return start !== Infinity ? { start, end } : null
}

export default class BamAdapter extends BaseFeatureDataAdapter<BamAdapterConfig> {
  public samHeader?: ParsedSamHeader

  private setupP?: Promise<{
    samHeader: ParsedSamHeader
    bam: BamFile<BamSlightlyLazyFeature>
  }>

  protected configureResult?: { bam: BamFile<BamSlightlyLazyFeature> }

  private sequenceAdapterP?: Promise<BaseSequenceAdapter | undefined>

  protected configure() {
    const csi = this.getConf(['index', 'indexType']) === 'CSI'
    const location = this.getConf(['index', 'location'])
    this.configureResult ??= {
      bam: new BamFile({
        bamFilehandle: openLocation(
          this.getConf('bamLocation'),
          this.pluginManager,
        ),
        csiFilehandle: csi
          ? openLocation(location, this.pluginManager)
          : undefined,
        baiFilehandle: !csi
          ? openLocation(location, this.pluginManager)
          : undefined,
        recordClass: BamSlightlyLazyFeature,
      }),
    }
    return this.configureResult
  }

  private clearCaches() {
    this.setupP = undefined
    this.configureResult = undefined
  }

  async getSequenceAdapter() {
    const config = this.sequenceAdapterConfig
    if (!config || !this.getSubAdapter) {
      return undefined
    }
    this.sequenceAdapterP ??= this.getSubAdapter(config)
      .then(r => {
        const adapter = r.dataAdapter as BaseSequenceAdapter
        // workaround for ChromSizesAdapter which doesn't have getSequence.
        // sequence adapter is optional for BAM
        return 'getSequence' in adapter ? adapter : undefined
      })
      .catch((e: unknown) => {
        this.sequenceAdapterP = undefined
        throw e
      })
    return this.sequenceAdapterP
  }

  async getHeader(_opts?: BaseOptions) {
    const { bam } = this.configure()
    return bam.getHeaderText()
  }

  // The index download itself is memoized in setupP so it runs exactly once.
  private setupOnce(onProgress?: (bytes: number, total?: number) => void) {
    this.setupP ??= (async () => {
      try {
        const { bam } = this.configure()
        const rawHeader = await bam.getHeader({ onProgress })
        this.samHeader = parseSamHeader(rawHeader ?? [])
        return { samHeader: this.samHeader, bam }
      } catch (e) {
        this.clearCaches()
        throw e
      }
    })()
    return this.setupP
  }

  // downloadStatus wraps the memoized work *per caller*, so every concurrent
  // caller gets the "Downloading index" status and waits on the shared promise.
  // The first caller's onProgress drives the determinate bar; later callers
  // still see the label (their onProgress no-ops against the cached download).
  private async setup(opts?: BaseOptions) {
    return downloadStatus(
      'Downloading index',
      opts?.statusCallback,
      onProgress => this.setupOnce(onProgress),
    )
  }

  async getRefNames(opts?: BaseOptions) {
    const { samHeader } = await this.setup(opts)
    return samHeader.idToName
  }

  getFeatures(
    region: Region & { originalRefName?: string },
    opts?: BaseOptions & {
      filterBy?: FilterBy
    },
  ) {
    const { refName, start, end, originalRefName } = region
    const { stopToken, filterBy, statusCallback = () => {} } = opts ?? {}
    return ObservableCreate<Feature>(async observer => {
      const { bam } = await this.setup(opts)
      checkStopToken(stopToken)

      const records = await downloadStatus(
        'Downloading alignments',
        statusCallback,
        onProgress =>
          bam.getRecordsForRange(refName, start, end, {
            filterBy,
            onProgress,
          }),
      ).catch((e: unknown) => {
        this.clearCaches()
        throw e
      })
      checkStopToken(stopToken)

      const { readName, tagFilter } = filterBy ?? {}
      // only reads lacking an MD tag need the reference; defer loading the
      // sequence adapter (and the fetch) until we know at least one does
      const span = seqFetchSpan(records)
      const sequenceAdapter = span ? await this.getSequenceAdapter() : undefined
      const regionSeq =
        sequenceAdapter && span
          ? await sequenceAdapter.getSequence({
              refName: originalRefName ?? refName,
              start: span.start,
              end: span.end,
            })
          : undefined

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
            if (readName && record.name !== readName) {
              continue
            }
            if (
              tagFilter &&
              filterTagValue(record.tags[tagFilter.tag], tagFilter.value)
            ) {
              continue
            }

            record.adapter = this

            if (!record.NUMERIC_MD && regionSeq && span) {
              // share the one region string; refOffset locates this read in it
              record.ref = regionSeq
              record.refOffset = record.start - span.start
            }

            observer.next(record)
          }
          observer.complete()
        },
      )
    })
  }

  async getMultiRegionFeatureDensityStats(
    regions: Region[],
    opts?: BaseOptions,
  ) {
    const { bam } = this.configure()
    // this is a method to avoid calling on htsget adapters
    if (bam.index) {
      const fetchSizeLimit = this.getConf('fetchSizeLimit')
      const bytes = await bam.estimatedBytesForRegions(regions)
      return {
        bytes,
        fetchSizeLimit,
      }
    }
    return super.getMultiRegionFeatureDensityStats(regions, opts)
  }

  refIdToName(refId: number) {
    return this.samHeader?.idToName[refId]
  }
}
