import { BamFile } from '@gmod/bam'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { bytesForRegions, updateStatus } from '@jbrowse/core/util'
import QuickLRU from '@jbrowse/core/util/QuickLRU'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import BamSlightlyLazyFeature from './BamSlightlyLazyFeature'
import { filterReadFlag, filterTagValue } from '../shared/util'

import type { FilterBy } from '../shared/types'
import type {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

interface Header {
  idToName: string[]
  nameToId: Record<string, number>
}

export default class BamAdapter extends BaseFeatureDataAdapter {
  private samHeader?: Header

  private setupP?: Promise<Header>

  // used for avoiding re-creation new BamSlightlyLazyFeatures, keeping
  // mismatches in cache. at an average of 100kb-300kb, keeping even just 500
  // of these in memory is memory intensive but can reduce recomputation on
  // these objects
  private ultraLongFeatureCache = new QuickLRU<string, Feature>({
    maxSize: 500,
  })

  private configureP?: Promise<{
    bam: BamFile
  }>

  private sequenceAdapterP?: Promise<BaseSequenceAdapter | undefined>

  private sequenceAdapterConfig?: Record<string, unknown>

  // derived classes may not use the same configuration so a custom configure
  // method allows derived classes to override this behavior
  protected async configurePre() {
    const bamLocation = this.getConf('bamLocation')
    const location = this.getConf(['index', 'location'])
    const indexType = this.getConf(['index', 'indexType'])
    const pm = this.pluginManager
    const csi = indexType === 'CSI'
    const bam = new BamFile({
      bamFilehandle: openLocation(bamLocation, pm),
      csiFilehandle: csi ? openLocation(location, pm) : undefined,
      baiFilehandle: !csi ? openLocation(location, pm) : undefined,
    })
    return { bam }
  }

  async getSequenceAdapter(sequenceAdapterConfig?: Record<string, unknown>) {
    // cache the config on first call so subsequent calls don't need it
    if (sequenceAdapterConfig) {
      this.sequenceAdapterConfig = sequenceAdapterConfig
    }
    const config = this.sequenceAdapterConfig
    if (!config || !this.getSubAdapter) {
      return undefined
    }
    if (!this.sequenceAdapterP) {
      this.sequenceAdapterP = this.getSubAdapter(config)
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
    }
    return this.sequenceAdapterP
  }

  protected async configure() {
    if (!this.configureP) {
      this.configureP = this.configurePre().catch((e: unknown) => {
        this.configureP = undefined
        throw e
      })
    }
    return this.configureP
  }

  async getHeader(_opts?: BaseOptions) {
    const { bam } = await this.configure()
    return bam.getHeaderText()
  }

  private async setupPre(_opts?: BaseOptions) {
    const { bam } = await this.configure()
    const samHeader = await bam.getHeader()

    // use the @SQ lines in the header to figure out the
    // mapping between ref ref ID numbers and names
    const idToName: string[] = []
    const nameToId: Record<string, number> = {}
    if (samHeader) {
      for (const [refId, sqLine] of samHeader
        .filter(l => l.tag === 'SQ')
        .entries()) {
        const SN = sqLine.data.find(item => item.tag === 'SN')
        if (SN) {
          // this is the ref name
          const refName = SN.value
          nameToId[refName] = refId
          idToName[refId] = refName
        }
      }
    }

    this.samHeader = { idToName, nameToId }
    return this.samHeader
  }

  async setupPre2(opts?: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.setupPre(opts).catch((e: unknown) => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  async setup(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    return updateStatus('Downloading index', statusCallback, () =>
      this.setupPre2(opts),
    )
  }

  async getRefNames(opts?: BaseOptions) {
    const { idToName } = await this.setup(opts)
    return idToName
  }

  private async seqFetch(
    refName: string,
    start: number,
    end: number,
    sequenceAdapter?: BaseSequenceAdapter,
  ) {
    if (!sequenceAdapter || !refName) {
      return undefined
    }

    return sequenceAdapter.getSequence({
      refName,
      start,
      end,
    })
  }

  getFeatures(
    region: Region & { originalRefName?: string },
    opts?: BaseOptions & {
      filterBy?: FilterBy
      sequenceAdapter?: Record<string, unknown>
    },
  ) {
    const { refName, start, end, originalRefName } = region
    const {
      stopToken,
      filterBy,
      sequenceAdapter: sequenceAdapterConfig,
      statusCallback = () => {},
    } = opts || {}
    return ObservableCreate<Feature>(async observer => {
      const { bam } = await this.configure()
      const sequenceAdapter = await this.getSequenceAdapter(
        sequenceAdapterConfig,
      )
      await this.setup(opts)
      checkStopToken(stopToken)
      const records = await updateStatus(
        'Downloading alignments',
        statusCallback,
        () => bam.getRecordsForRange(refName, start, end),
      )
      checkStopToken(stopToken)

      await updateStatus('Processing alignments', statusCallback, async () => {
        const {
          flagInclude = 0,
          flagExclude = 0,
          tagFilter,
          readName,
        } = filterBy || {}

        for (const record of records) {
          let ref: string | undefined
          if (!record.tags.MD) {
            ref = await this.seqFetch(
              originalRefName || refName,
              record.start,
              record.end,
              sequenceAdapter,
            )
          }

          if (filterReadFlag(record.flags, flagInclude, flagExclude)) {
            continue
          }

          if (
            tagFilter &&
            filterTagValue(record.tags[tagFilter.tag], tagFilter.value)
          ) {
            continue
          }

          if (readName && record.name !== readName) {
            continue
          }

          const ret = this.ultraLongFeatureCache.get(`${record.id}`)
          if (!ret) {
            const elt = new BamSlightlyLazyFeature(record, this, ref)
            this.ultraLongFeatureCache.set(`${record.id}`, elt)
            observer.next(elt)
          } else {
            observer.next(ret)
          }
        }
        observer.complete()
      })
    })
  }

  async getMultiRegionFeatureDensityStats(
    regions: Region[],
    opts?: BaseOptions & { sequenceAdapter?: Record<string, unknown> },
  ) {
    // cache sequenceAdapter config if provided, so subsequent getFeatures
    // calls don't need to pass it
    if (opts?.sequenceAdapter) {
      this.sequenceAdapterConfig = opts.sequenceAdapter
    }
    const { bam } = await this.configure()
    // this is a method to avoid calling on htsget adapters
    if (bam.index) {
      const bytes = await bytesForRegions(regions, bam)
      const fetchSizeLimit = this.getConf('fetchSizeLimit')
      return {
        bytes,
        fetchSizeLimit,
      }
    }
    return super.getMultiRegionFeatureDensityStats(regions, opts)
  }

  // depends on setup being called before the BAM constructor
  refIdToName(refId: number) {
    return this.samHeader?.idToName[refId]
  }
}
