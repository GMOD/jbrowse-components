import { BamFile } from '@gmod/bam'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import BamSlightlyLazyFeature from './BamSlightlyLazyFeature.ts'
import { parseSamHeader } from '../shared/util.ts'

import type { FilterBy } from '../shared/types.ts'
import type { ParsedSamHeader } from '../shared/util.ts'
import type {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

export default class BamAdapter extends BaseFeatureDataAdapter {
  public samHeader?: ParsedSamHeader

  private setupP?: Promise<ParsedSamHeader>

  protected configureResult?: { bam: BamFile<BamSlightlyLazyFeature> }

  private sequenceAdapterP?: Promise<BaseSequenceAdapter | undefined>

  protected configure() {
    if (!this.configureResult) {
      const bamLocation = this.getConf('bamLocation')
      const location = this.getConf(['index', 'location'])
      const indexType = this.getConf(['index', 'indexType'])
      const csi = indexType === 'CSI'
      this.configureResult = {
        bam: new BamFile({
          bamFilehandle: openLocation(bamLocation, this.pluginManager),
          csiFilehandle: csi
            ? openLocation(location, this.pluginManager)
            : undefined,
          baiFilehandle: !csi
            ? openLocation(location, this.pluginManager)
            : undefined,
          recordClass: BamSlightlyLazyFeature,
        }),
      }
    }
    return this.configureResult
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

  private async setup(opts?: BaseOptions) {
    const { statusCallback } = opts || {}
    this.setupP ??= updateStatus(
      'Downloading index',
      statusCallback,
      async () => {
        try {
          const { bam } = this.configure()
          const rawHeader = await bam.getHeader()
          this.samHeader = parseSamHeader(rawHeader ?? [])
          return this.samHeader
        } catch (e) {
          this.setupP = undefined
          this.configureResult = undefined
          throw e
        }
      },
    )
    return this.setupP
  }

  async getRefNames(opts?: BaseOptions) {
    const { idToName } = await this.setup(opts)
    return idToName
  }

  getFeatures(
    region: Region & { originalRefName?: string },
    opts?: BaseOptions & {
      filterBy?: FilterBy
    },
  ) {
    const { refName, start, end, originalRefName } = region
    const { stopToken, filterBy, statusCallback = () => {} } = opts || {}
    return ObservableCreate<Feature>(async observer => {
      const { bam } = this.configure()
      const sequenceAdapter = await this.getSequenceAdapter()
      await this.setup(opts)
      checkStopToken(stopToken)
      const records = await updateStatus(
        'Downloading alignments',
        statusCallback,
        () => bam.getRecordsForRange(refName, start, end, { filterBy }),
      )
      checkStopToken(stopToken)

      await updateStatus('Processing alignments', statusCallback, async () => {
        const { readName } = filterBy || {}

        // Pre-fetch reference sequence for all records that need it
        let regionSeq: string | undefined
        let regionStart = Infinity
        let regionEnd = 0
        if (sequenceAdapter) {
          for (const record of records) {
            if (!record.NUMERIC_MD) {
              regionStart = Math.min(regionStart, record.start)
              regionEnd = Math.max(regionEnd, record.end)
            }
          }
          if (regionEnd > 0) {
            regionSeq = await sequenceAdapter.getSequence({
              refName: originalRefName || refName,
              start: regionStart,
              end: regionEnd,
            })
          }
        }

        for (const record of records) {
          if (readName && record.name !== readName) {
            continue
          }

          // Set adapter reference for id() and refIdToName()
          record.adapter = this

          // Only fetch reference sequence if MD tag is missing
          if (!record.NUMERIC_MD && regionSeq) {
            record.ref = regionSeq.slice(
              record.start - regionStart,
              record.end - regionStart,
            )
          }

          observer.next(record)
        }
        observer.complete()
      })
    })
  }

  async getMultiRegionFeatureDensityStats(
    regions: Region[],
    opts?: BaseOptions,
  ) {
    const { bam } = this.configure()
    // this is a method to avoid calling on htsget adapters
    if (bam.index) {
      const bytes = await bam.estimatedBytesForRegions(regions)
      const fetchSizeLimit = this.getConf('fetchSizeLimit')
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
