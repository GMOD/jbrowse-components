import { BamFile } from '@gmod/bam'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import {
  checkAbortSignal,
  bytesForRegions,
  updateStatus,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { toArray } from 'rxjs/operators'
import { readConfObject } from '@jbrowse/core/configuration'
import BamSlightlyLazyFeature from './BamSlightlyLazyFeature'

interface Header {
  idToName: string[]
  nameToId: Record<string, number>
}

export default class BamAdapter extends BaseFeatureDataAdapter {
  private samHeader?: Header

  private setupP?: Promise<Header>

  protected configured?: Promise<{
    bam: BamFile
    sequenceAdapter?: BaseFeatureDataAdapter
  }>

  // derived classes may not use the same configuration so a custom
  // configure method allows derived classes to override this behavior
  protected async configure() {
    if (!this.configured) {
      const bamLocation = readConfObject(this.config, 'bamLocation')
      const location = readConfObject(this.config, ['index', 'location'])
      const indexType = readConfObject(this.config, ['index', 'indexType'])
      const bam = new BamFile({
        bamFilehandle: openLocation(bamLocation, this.pluginManager),
        csiFilehandle:
          indexType === 'CSI'
            ? openLocation(location, this.pluginManager)
            : undefined,
        baiFilehandle:
          indexType !== 'CSI'
            ? openLocation(location, this.pluginManager)
            : undefined,

        // chunkSizeLimit and fetchSizeLimit are more troublesome than
        // helpful, and have given overly large values on the ultra long
        // nanopore reads even with 500MB limits, so disabled with infinity
        chunkSizeLimit: Infinity,
        fetchSizeLimit: Infinity,
        yieldThreadTime: Infinity,
      })

      const adapterConfig = readConfObject(this.config, 'sequenceAdapter')
      if (adapterConfig && this.getSubAdapter) {
        this.configured = this.getSubAdapter(adapterConfig).then(
          ({ dataAdapter }) => ({
            bam,
            sequenceAdapter: dataAdapter as BaseFeatureDataAdapter,
          }),
        )
      } else {
        this.configured = Promise.resolve({ bam })
      }
    }
    return this.configured
  }

  async getHeader(opts?: BaseOptions) {
    const { bam } = await this.configure()
    return bam.getHeaderText(opts)
  }

  private async setupPre(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    const { bam } = await this.configure()
    this.samHeader = await updateStatus(
      'Downloading index',
      statusCallback,
      async () => {
        const samHeader = await bam.getHeader(opts)

        // use the @SQ lines in the header to figure out the
        // mapping between ref ref ID numbers and names
        const idToName: string[] = []
        const nameToId: Record<string, number> = {}
        samHeader
          .filter(l => l.tag === 'SQ')
          .forEach((sqLine, refId) => {
            sqLine.data.forEach(item => {
              if (item.tag === 'SN') {
                // this is the ref name
                const refName = item.value
                nameToId[refName] = refId
                idToName[refId] = refName
              }
            })
          })

        return { idToName, nameToId }
      },
    )
    return this.samHeader
  }

  private async setup(opts?: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.setupPre(opts).catch(e => {
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

    const seqChunks = await features.pipe(toArray()).toPromise()

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
        sequence += chunkSeq.substr(trimStart, trimLength)
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
    opts?: BaseOptions,
  ) {
    const { refName, start, end, originalRefName } = region
    const { signal, statusCallback = () => {} } = opts || {}
    return ObservableCreate<Feature>(async observer => {
      const { bam } = await this.configure()
      await this.setup(opts)
      statusCallback('Downloading alignments')
      const records = await bam.getRecordsForRange(refName, start, end, opts)

      checkAbortSignal(signal)

      for (const record of records) {
        let ref: string | undefined
        if (!record.get('MD')) {
          ref = await this.seqFetch(
            originalRefName || refName,
            record.get('start'),
            record.get('end'),
          )
        }
        observer.next(new BamSlightlyLazyFeature(record, this, ref))
      }
      statusCallback('')
      observer.complete()
    }, signal)
  }

  async estimateRegionsStats(regions: Region[], opts?: BaseOptions) {
    const { bam } = await this.configure()
    // this is a method to avoid calling on htsget adapters
    // @ts-ignore
    if (bam.index.filehandle !== '?') {
      const bytes = await bytesForRegions(regions, bam)
      const fetchSizeLimit = readConfObject(this.config, 'fetchSizeLimit')
      return { bytes, fetchSizeLimit }
    } else {
      return super.estimateRegionsStats(regions, opts)
    }
  }

  freeResources(/* { region } */): void {}

  // depends on setup being called before the BAM constructor
  refIdToName(refId: number): string | undefined {
    return this.samHeader?.idToName[refId]
  }
}
