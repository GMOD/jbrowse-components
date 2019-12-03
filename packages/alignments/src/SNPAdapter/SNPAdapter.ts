import { BamFile } from '@gmod/bam' // change to @gmod snp when implemented
import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation, IRegion } from '@gmod/jbrowse-core/mst-types'
import { checkAbortSignal } from '@gmod/jbrowse-core/util'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { GenericFilehandle } from 'generic-filehandle'
import { Observable, Observer } from 'rxjs'
import memoize from 'memoize-one'
import SNPSlightlyLazyFeature from './SNPSlightlyLazyFeature'

interface HeaderLine {
  tag: string
  value: string
}
interface Header {
  idToName: string[]
  nameToId: Record<string, number>
}

const setup = memoize(async (snp: BamFile) => {
  const samHeader = await snp.getHeader()

  // !!!!! File will be read differently, change whole section below !!!!!!

  // use the @SQ lines in the header to figure out the
  // mapping between ref ref ID numbers and names
  const idToName: string[] = []
  const nameToId: Record<string, number> = {}
  const sqLines = samHeader.filter((l: { tag: string }) => l.tag === 'SQ')
  sqLines.forEach((sqLine: { data: HeaderLine[] }, refId: number) => {
    sqLine.data.forEach((item: HeaderLine) => {
      if (item.tag === 'SN') {
        // this is the ref name
        const refName = item.value
        nameToId[refName] = refId
        idToName[refId] = refName
      }
    })
  })
  return { idToName, nameToId }
})

export default class extends BaseAdapter {
  private snp: BamFile

  private samHeader: Header = { idToName: [], nameToId: {} }

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: {
    snpLocation: IFileLocation
    index: { location: IFileLocation; index: string }
  }) {
    super()
    const { snpLocation } = config

    const { location: indexLocation, index: indexType } = config.index

    // !!! files will be different change below
    const snpOpts: {
      SNPFilehandle: GenericFilehandle
      sniFilehandle?: GenericFilehandle
      csiFilehandle?: GenericFilehandle
    } = {
      SNPFilehandle: openLocation(snpLocation),
    }

    const indexFile = openLocation(indexLocation)
    if (indexType === 'CSI') {
      snpOpts.csiFilehandle = indexFile
    } else {
      snpOpts.sniFilehandle = indexFile
    }

    this.snp = new BamFile(snpOpts)
  }

  async getRefNames() {
    return (await setup(this.snp)).idToName
  }

  /**
   * Fetch features for a certain region. Use getFeaturesInRegion() if you also
   * want to verify that the store has features for the given reference sequence
   * before fetching.
   * @param {IRegion} param
   * @param {AbortSignal} [signal] optional signalling object for aborting the fetch
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeatures(
    { refName, start, end }: IRegion,
    opts: BaseOptions = {},
  ): Observable<Feature> {
    return ObservableCreate(
      async (observer: Observer<Feature>): Promise<void> => {
        this.samHeader = await setup(this.snp)
        const records = await this.snp.getRecordsForRange(
          refName,
          start,
          end,
          opts,
        )
        checkAbortSignal(opts.signal)
        records.forEach(record => {
          observer.next(new SNPSlightlyLazyFeature(record, this))
        })
        observer.complete()
      },
    )
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources(/* { region } */): void {}

  // depends on setup being called before the BAM constructor
  refIdToName(refId: number): string | undefined {
    return this.samHeader.idToName[refId]
  }
}
