import { BamFile } from '@gmod/bam'
// jbrowse
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { bytesForRegions, updateStatus } from '@jbrowse/core/util'
import QuickLRU from '@jbrowse/core/util/QuickLRU'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

// locals
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import BamSlightlyLazyFeature from './BamSlightlyLazyFeature'
import { filterReadFlag, filterTagValue } from '../shared/util'
import type { FilterBy } from '../shared/types'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
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
    sequenceAdapter?: BaseFeatureDataAdapter
  }>

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
      yieldThreadTime: Number.POSITIVE_INFINITY,
    })

    const adapterConfig = this.getConf('sequenceAdapter')
    if (adapterConfig && this.getSubAdapter) {
      const { dataAdapter } = await this.getSubAdapter(adapterConfig)
      return {
        bam,
        sequenceAdapter: dataAdapter as BaseFeatureDataAdapter,
      }
    }
    return { bam }
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

  private async setupPre(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    const { bam } = await this.configure()
    this.samHeader = await updateStatus(
      'Downloading index',
      statusCallback,
      async () => {
        const samHeader = await bam.getHeader()

        // use the @SQ lines in the header to figure out the
        // mapping between ref ref ID numbers and names
        const idToName: string[] = []
        const nameToId: Record<string, number> = {}
        samHeader
          ?.filter(l => l.tag === 'SQ')
          .forEach((sqLine, refId) => {
            const SN = sqLine.data.find(item => item.tag === 'SN')
            if (SN) {
              // this is the ref name
              const refName = SN.value
              nameToId[refName] = refId
              idToName[refId] = refName
            }
          })

        return { idToName, nameToId }
      },
    )
    return this.samHeader
  }

  async setup(opts?: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.setupPre(opts).catch((e: unknown) => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  async getRefNames(opts?: BaseOptions) {
    const { idToName } = await this.setup(opts)
    return idToName
  }

  private async seqFetch(refName: string, start: number, end: number) {
    const { sequenceAdapter } = await this.configure()
    const refSeqStore = sequenceAdapter
    if (!refSeqStore) {
      return undefined
    }
    if (!refName) {
      return undefined
    }

    const features = refSeqStore.getFeatures({
      refName,
      start,
      end,
      assemblyName: '',
    })

    const seqChunks = await firstValueFrom(features.pipe(toArray()))

    let sequence = ''
    seqChunks
      .sort((a, b) => a.get('start') - b.get('start'))
      .forEach(chunk => {
        const chunkStart = chunk.get('start')
        const chunkEnd = chunk.get('end')
        const trimStart = Math.max(start - chunkStart, 0)
        const trimEnd = Math.min(end - chunkStart, chunkEnd - chunkStart)
        const trimLength = trimEnd - trimStart
        const chunkSeq = chunk.get('seq') || chunk.get('residues')
        sequence += chunkSeq.slice(trimStart, trimStart + trimLength)
      })

    if (sequence.length !== end - start) {
      throw new Error(
        `sequence fetch failed: fetching ${refName}:${(
          start - 1
        ).toLocaleString()}-${end.toLocaleString()} returned ${sequence.length.toLocaleString()} bases, but should have returned ${(
          end - start
        ).toLocaleString()}`,
      )
    }
    return sequence
  }

  getFeatures(
    region: Region & { originalRefName?: string },
    opts?: BaseOptions & {
      filterBy: FilterBy
    },
  ) {
    const { refName, start, end, originalRefName } = region
    const { stopToken, filterBy, statusCallback = () => {} } = opts || {}
    return ObservableCreate<Feature>(async observer => {
      const { bam } = await this.configure()
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
    opts?: BaseOptions,
  ) {
    const { bam } = await this.configure()
    // this is a method to avoid calling on htsget adapters
    if (bam.index) {
      const bytes = await bytesForRegions(regions, bam)
      const fetchSizeLimit = this.getConf('fetchSizeLimit')
      return { bytes, fetchSizeLimit }
    }
    return super.getMultiRegionFeatureDensityStats(regions, opts)
  }

  freeResources(/* { region } */): void {}

  // depends on setup being called before the BAM constructor
  refIdToName(refId: number) {
    return this.samHeader?.idToName[refId]
  }
}
