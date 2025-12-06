import { CraiIndex, IndexedCramFile } from '@gmod/cram'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { sum, toLocale, updateStatus } from '@jbrowse/core/util'
import QuickLRU from '@jbrowse/core/util/QuickLRU'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import CramSlightlyLazyFeature from './CramSlightlyLazyFeature'
import { filterReadFlag, filterTagValue } from '../shared/util'

import type { FilterBy } from '../shared/types'
import type {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

interface Header {
  idToName?: string[]
  nameToId?: Record<string, number>
  readGroups?: (string | undefined)[]
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

  // used for avoiding re-creation new BamSlightlyLazyFeatures, keeping
  // mismatches in cache. at an average of 100kb-300kb, keeping even just 500
  // of these in memory is fairly intensive but can reduce recomputation on
  // these objects
  private ultraLongFeatureCache = new QuickLRU<string, Feature>({
    maxSize: 500,
  })

  // maps a refname to an id
  private seqIdToRefName: string[] | undefined

  // maps a seqId to original refname, passed specially to render args, to a seqid
  private seqIdToOriginalRefName: string[] = []

  public async configurePre() {
    const cramLocation = this.getConf('cramLocation')
    const craiLocation = this.getConf('craiLocation')
    const pm = this.pluginManager

    const cram = new IndexedCramFile({
      cramFilehandle: openLocation(cramLocation, pm),
      index: new CraiIndex({
        filehandle: openLocation(craiLocation, pm),
      }),
      seqFetch: (...args) => this.seqFetch(...args),
      checkSequenceMD5: false,
    })

    if (!this.getSubAdapter) {
      throw new Error('Error getting subadapter')
    }

    const seqConf = this.getConf('sequenceAdapter')
    if (!seqConf) {
      throw new Error('no sequenceAdapter supplied to CramAdapter config')
    }
    const subadapter = await this.getSubAdapter(seqConf)

    return {
      cram,
      sequenceAdapter: subadapter.dataAdapter as BaseSequenceAdapter,
    }
  }

  public async configure() {
    if (!this.configureP) {
      this.configureP = this.configurePre().catch((e: unknown) => {
        this.configureP = undefined
        throw e
      })
    }
    return this.configureP
  }

  async getHeader(_opts?: BaseOptions) {
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

    const qlen = end - start
    if (sequence.length !== qlen) {
      throw new Error(
        `fetching ${refName}:${toLocale(
          start - 1,
        )}-${toLocale(end)} returned ${toLocale(sequence.length)} bases, should have returned ${toLocale(
          qlen,
        )}`,
      )
    }
    return sequence
  }

  private async setupPre(_opts?: BaseOptions) {
    const conf = await this.configure()
    const { cram } = conf
    const samHeader = await cram.cram.getSamHeader()

    // use the @SQ lines in the header to figure out the mapping between ref
    // ID numbers and names
    const idToName: string[] = []
    const nameToId: Record<string, number> = {}
    for (const [refId, sqLine] of samHeader
      .filter(l => l.tag === 'SQ')
      .entries()) {
      const SN = sqLine.data.find(item => item.tag === 'SN')
      if (SN) {
        const refName = SN.value
        nameToId[refName] = refId
        idToName[refId] = refName
      }
    }

    const readGroups = samHeader
      .filter(l => l.tag === 'RG')
      .map(rgLine => rgLine.data.find(item => item.tag === 'ID')?.value)

    const data = { idToName, nameToId, readGroups }
    this.samHeader = data
    return {
      samHeader: data,
      ...conf,
    }
  }

  private async setupPre2(opts?: BaseOptions) {
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
    const { samHeader } = await this.setup(opts)
    if (!samHeader.idToName) {
      throw new Error('CRAM file has no header lines')
    }
    return samHeader.idToName
  }

  // use info from the SAM header if possible, but fall back to using the ref
  // seq order from when the browser's refseqs were loaded
  refNameToId(refName: string) {
    if (this.samHeader.nameToId) {
      return this.samHeader.nameToId[refName]
    }
    if (this.seqIdToRefName) {
      return this.seqIdToRefName.indexOf(refName)
    }
    return undefined
  }

  // use info from the SAM header if possible, but fall back to using the ref
  // seq order from when the browser's refseqs were loaded
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
      const records = await updateStatus(
        'Downloading alignments',
        statusCallback,
        () => cram.getRecordsForRange(refId, start, end),
      )
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
                ? samHeader.readGroups?.[record.readGroupId]
                : record.tags[tagFilter.tag],
              tagFilter.value,
            )
          ) {
            continue
          }

          if (readName && record.readName !== readName) {
            continue
          }

          const ret = this.ultraLongFeatureCache.get(`${record.uniqueId}`)
          if (!ret) {
            const elt = new CramSlightlyLazyFeature(record, this)
            this.ultraLongFeatureCache.set(`${record.uniqueId}`, elt)
            observer.next(elt)
          } else {
            observer.next(ret)
          }
        }

        observer.complete()
      })
    }, stopToken)
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
   *
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
          : Promise.resolve([{ sliceBytes: 0 }])
      }),
    )

    return sum(blockResults.flat().map(a => a.sliceBytes))
  }
}
