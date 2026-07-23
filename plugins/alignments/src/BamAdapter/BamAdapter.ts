import { BamFile } from '@gmod/bam'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadStatus, withProgress } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { filterTagValue, parseSamHeader } from '../shared/util.ts'
import BamSlightlyLazyFeature from './BamSlightlyLazyFeature.ts'

import type { FilterBy } from '../shared/types.ts'
import type { ParsedSamHeader } from '../shared/util.ts'
import type { BamAdapterConfig } from './configSchema.ts'
import type {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

// The [start, end) reference span needed for mismatch rendering: the union of
// every record lacking an MD tag, clamped to the queried viewport. null when
// every record carries MD, so no reference fetch is needed at all. Clamping
// here keeps a whole-chromosome contig alignment from fetching sequence outside
// the visible slice (the mismatch walk is windowed to the same region).
function seqFetchSpan(
  records: readonly { NUMERIC_MD: unknown; start: number; end: number }[],
  regionStart: number,
  regionEnd: number,
) {
  let start = Infinity
  let end = 0
  for (const record of records) {
    if (!record.NUMERIC_MD) {
      start = Math.min(start, record.start)
      end = Math.max(end, record.end)
    }
  }
  return start !== Infinity
    ? { start: Math.max(start, regionStart), end: Math.min(end, regionEnd) }
    : null
}

export default class BamAdapter extends BaseFeatureDataAdapter<BamAdapterConfig> {
  public samHeader?: ParsedSamHeader

  private setupP?: Promise<{
    samHeader: ParsedSamHeader
    bam: BamFile<BamSlightlyLazyFeature>
  }>

  // true once the index has finished downloading; gates the status label so
  // pan/zoom re-entry into setup() doesn't re-flash "Downloading index"
  private setupDone = false

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
    this.setupDone = false
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
        this.setupDone = true
        return { samHeader: this.samHeader, bam }
      } catch (e) {
        this.clearCaches()
        throw e
      }
    })()
    return this.setupP
  }

  // While the index is genuinely downloading, downloadStatus wraps the memoized
  // work *per caller*, so every concurrent caller gets the "Downloading index"
  // status and waits on the shared promise; the first caller's onProgress drives
  // the determinate bar. Once downloaded, later callers (every getFeatures on
  // pan/zoom) await the cached promise silently rather than re-flashing the
  // label.
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

      // A failed region fetch (e.g. a transient network error mid-pan) must not
      // wipe the header/index caches — those are memoized in setup() and only
      // invalidated on a setup failure. Re-downloading them on every dropped
      // data chunk would force a full re-download on the next pan.
      const records = await downloadStatus(
        'Downloading alignments',
        statusCallback,
        onProgress =>
          bam.getRecordsForRange(refName, start, end, {
            filterBy,
            onProgress,
          }),
      )
      checkStopToken(stopToken)

      const { readName, tagFilters } = filterBy ?? {}
      // only reads lacking an MD tag need the reference, so defer loading the
      // sequence adapter (and the fetch) until we know at least one does
      const span = seqFetchSpan(records, start, end)
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
            // @gmod/bam applies only flags + a single tagFilter; multiple tag
            // filters are AND-ed here (excluded if any one rejects the read).
            if (
              tagFilters?.some(tf =>
                filterTagValue(record.tags[tf.tag], tf.value),
              )
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

  async getMultiRegionByteEstimate(regions: Region[], opts?: BaseOptions) {
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
    return super.getMultiRegionByteEstimate(regions, opts)
  }

  refIdToName(refId: number) {
    return this.samHeader?.idToName[refId]
  }
}
