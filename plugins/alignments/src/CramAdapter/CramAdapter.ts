import { CraiIndex, IndexedCramFile, CramRecord } from '@gmod/cram'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { checkAbortSignal, Region, Feature } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { toArray } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'
import CramSlightlyLazyFeature from './CramSlightlyLazyFeature'

interface Header {
  idToName?: string[]
  nameToId?: Record<string, number>
  readGroups?: (string | undefined)[]
}

interface FilterBy {
  flagInclude: number
  flagExclude: number
  tagFilter: { tag: string; value: unknown }
  readName: string
}

export default class CramAdapter extends BaseFeatureDataAdapter {
  samHeader: Header = {}

  private setupP?: Promise<{
    samHeader: Header
    cram: IndexedCramFile
    sequenceAdapter: BaseSequenceAdapter
  }>

  private configureP?: Promise<{
    cram: IndexedCramFile
    sequenceAdapter: BaseSequenceAdapter
  }>

  // maps a refname to an id
  private seqIdToRefName: string[] | undefined

  // maps a seqId to original refname, passed specially to render args, to a seqid
  private seqIdToOriginalRefName: string[] = []

  public async configurePre() {
    const cramLocation = this.getConf('cramLocation')
    const craiLocation = this.getConf('craiLocation')
    if (!cramLocation) {
      throw new Error('missing cramLocation argument')
    }
    if (!craiLocation) {
      throw new Error('missing craiLocation argument')
    }
    const pm = this.pluginManager

    const cram = new IndexedCramFile({
      cramFilehandle: openLocation(cramLocation, pm),
      index: new CraiIndex({ filehandle: openLocation(craiLocation, pm) }),
      seqFetch: (...args) => this.seqFetch(...args),
      checkSequenceMD5: false,
      fetchSizeLimit: 200_000_000, // just make this a large size to avoid hitting it
    })

    if (!this.getSubAdapter) {
      throw new Error('Error getting subadapter')
    }

    const seqConf = this.getConf('sequenceAdapter')
    const subadapter = await this.getSubAdapter(seqConf)

    return {
      cram,
      sequenceAdapter: subadapter.dataAdapter as BaseSequenceAdapter,
    }
  }

  public async configure() {
    if (!this.configureP) {
      this.configureP = this.configurePre().catch(e => {
        this.configureP = undefined
        throw e
      })
    }
    return this.configureP
  }

  async getHeader(opts?: BaseOptions) {
    const { cram } = await this.configure()
    return cram.cram.getHeaderText()
  }

  private async seqFetch(
    seqId: number,
    start: number,
    end: number,
  ): Promise<string> {
    start -= 1 // convert from 1-based closed to interbase

    const { sequenceAdapter } = await this.configure()
    const refName = this.refIdToOriginalName(seqId) || this.refIdToName(seqId)
    if (!refName) {
      throw new Error('unknown')
    }

    const seqChunks = await firstValueFrom(
      sequenceAdapter
        .getFeatures({
          refName,
          start,
          end,
          assemblyName: '',
        })
        .pipe(toArray()),
    )

    const sequence = seqChunks
      .sort((a, b) => a.get('start') - b.get('start'))
      .map(chunk => {
        const chunkStart = chunk.get('start')
        const chunkEnd = chunk.get('end')
        const trimStart = Math.max(start - chunkStart, 0)
        const trimEnd = Math.min(end - chunkStart, chunkEnd - chunkStart)
        const trimLength = trimEnd - trimStart
        const chunkSeq = chunk.get('seq') || chunk.get('residues')
        return chunkSeq.slice(trimStart, trimStart + trimLength)
      })
      .join('')

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

  private async setupPre(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    const conf = await this.configure()
    statusCallback('Downloading index')
    const { cram } = conf
    const samHeader = await cram.cram.getSamHeader()

    // use the @SQ lines in the header to figure out the
    // mapping between ref ID numbers and names
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

    const readGroups = samHeader
      .filter(l => l.tag === 'RG')
      .map(rgLine => rgLine.data.find(item => item.tag === 'ID')?.value)

    const data = { idToName, nameToId, readGroups }
    statusCallback('')
    this.samHeader = data
    return { samHeader: data, ...conf }
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
    const { samHeader } = await this.setup(opts)
    if (!samHeader.idToName) {
      throw new Error('CRAM file has no header lines')
    }
    return samHeader.idToName
  }

  // use info from the SAM header if possible, but fall back to using
  // the ref seq order from when the browser's refseqs were loaded
  refNameToId(refName: string) {
    if (this.samHeader.nameToId) {
      return this.samHeader.nameToId[refName]
    }
    if (this.seqIdToRefName) {
      return this.seqIdToRefName.indexOf(refName)
    }
    return undefined
  }

  // use info from the SAM header if possible, but fall back to using
  // the ref seq order from when the browser's refseqs were loaded
  refIdToName(refId: number) {
    return this.samHeader.idToName?.[refId] || this.seqIdToRefName?.[refId]
  }

  refIdToOriginalName(refId: number) {
    return this.seqIdToOriginalRefName[refId]
  }

  getFeatures(
    region: Region & { originalRefName?: string },
    opts?: BaseOptions & {
      filterBy: FilterBy
    },
  ) {
    const { signal, filterBy, statusCallback = () => {} } = opts || {}
    const { refName, start, end, originalRefName } = region

    return ObservableCreate<Feature>(async observer => {
      const { cram } = await this.setup(opts)

      const refId = this.refNameToId(refName)
      if (refId === undefined) {
        console.warn('Unknown refName', refName)
        observer.complete()
        return
      }

      if (originalRefName) {
        this.seqIdToOriginalRefName[refId] = originalRefName
      }
      statusCallback('Downloading alignments')
      const records = await cram.getRecordsForRange(refId, start, end)
      checkAbortSignal(signal)
      const {
        flagInclude = 0,
        flagExclude = 0,
        tagFilter,
        readName,
      } = filterBy || {}

      let filtered = records.filter(record => {
        const flags = record.flags
        return (flags & flagInclude) === flagInclude && !(flags & flagExclude)
      })

      if (tagFilter) {
        filtered = filtered.filter(record => {
          // @ts-expect-error
          const val = record[tagFilter.tag]
          return val === '*' ? val !== undefined : val === tagFilter.value
        })
      }

      if (readName) {
        filtered = filtered.filter(record => record.readName === readName)
      }

      filtered.forEach(record => {
        observer.next(this.cramRecordToFeature(record))
      })
      statusCallback('')
      observer.complete()
    }, signal)
  }

  freeResources(/* { region } */): void {}

  cramRecordToFeature(record: CramRecord) {
    return new CramSlightlyLazyFeature(record, this)
  }

  // we return the configured fetchSizeLimit, and the bytes for the region
  async getMultiRegionFeatureDensityStats(
    regions: Region[],
    opts?: BaseOptions,
  ) {
    const bytes = await this.bytesForRegions(regions, opts)
    const fetchSizeLimit = this.getConf('fetchSizeLimit')
    return {
      bytes,
      fetchSizeLimit,
    }
  }

  /**
   * get the approximate number of bytes queried from the file for the given
   * query regions
   * @param regions - list of query regions
   */
  private async bytesForRegions(regions: Region[], _opts?: BaseOptions) {
    const { cram } = await this.configure()
    const blockResults = await Promise.all(
      regions.map(region => {
        const { refName, start, end } = region
        const chrId = this.refNameToId(refName)
        return chrId !== undefined
          ? cram.index.getEntriesForRange(chrId, start, end)
          : [{ sliceBytes: 0 }]
      }),
    )

    return blockResults.flat().reduce((a, b) => a + b.sliceBytes, 0)
  }
}
