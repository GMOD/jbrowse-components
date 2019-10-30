import { BamFile } from '@gmod/bam'
import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation, IRegion } from '@gmod/jbrowse-core/mst-types'
import { checkAbortSignal } from '@gmod/jbrowse-core/util'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { GenericFilehandle } from 'generic-filehandle'
import { Observable, Observer } from 'rxjs'
import BamSlightlyLazyFeature from './BamSlightlyLazyFeature'

interface HeaderLine {
  tag: string
  value: string
}
interface SamHeader {
  idToName?: string[]
  nameToId?: Record<string, number>
}
export default class extends BaseAdapter {
  private bam: BamFile

  private samHeader?: SamHeader

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: {
    bamLocation: IFileLocation
    index: { location: IFileLocation; index: string }
  }) {
    super()
    const { bamLocation } = config

    const { location: indexLocation, index: indexType } = config.index
    const bamOpts: {
      bamFilehandle: GenericFilehandle
      baiFilehandle?: GenericFilehandle
      csiFilehandle?: GenericFilehandle
    } = {
      bamFilehandle: openLocation(bamLocation),
    }

    const indexFile = openLocation(indexLocation)
    if (indexType === 'CSI') {
      bamOpts.csiFilehandle = indexFile
    } else {
      bamOpts.baiFilehandle = indexFile
    }

    this.bam = new BamFile(bamOpts)
  }

  async setup(opts: BaseOptions = {}): Promise<void> {
    if (!this.samHeader) {
      const samHeader = await this.bam.getHeader(opts.signal)
      this.samHeader = {}

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
      this.samHeader.idToName = idToName
      this.samHeader.nameToId = nameToId
    }
  }

  async getRefNames(opts: BaseOptions = {}): Promise<string[]> {
    await this.setup(opts)
    return (this.samHeader && this.samHeader.idToName) || []
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
        await this.setup(opts)
        const records = await this.bam.getRecordsForRange(
          refName,
          start,
          end,
          opts,
        )
        checkAbortSignal(opts.signal)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        records.forEach((record: any) => {
          observer.next(this.bamRecordToFeature(record))
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
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  freeResources(/* { region } */): void {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bamRecordToFeature(record: any): Feature {
    return new BamSlightlyLazyFeature(record, this)
  }

  refIdToName(refId: number): string | undefined {
    // use info from the SAM header if possible, but fall back to using
    // the ref name order from when the browser's ref names were loaded
    if (this.samHeader && this.samHeader.idToName) {
      return this.samHeader.idToName[refId]
    }
    return undefined
  }
}
