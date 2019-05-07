import { BamFile } from '@gmod/bam'

import { openLocation } from '@gmod/jbrowse-core/util/io'
import BaseAdapter, {
  BaseOptions,
  Region,
} from '@gmod/jbrowse-core/BaseAdapter'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { checkAbortSignal } from '@gmod/jbrowse-core/util'
import { GenericFilehandle } from 'generic-filehandle'
import { Observer, Observable } from 'rxjs'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import BamSlightlyLazyFeature from './BamSlightlyLazyFeature'

export interface BamOptions extends BaseOptions {
  viewAsPairs?: boolean
}

export default class BamAdapter extends BaseAdapter {
  private bam: any

  private samHeader: any

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: {
    bamLocation: string
    index: { location: string; index: string }
  }) {
    super(config)
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

  async setup(): Promise<void> {
    if (!this.samHeader) {
      const samHeader = await this.bam.getHeader()
      this.samHeader = {}

      // use the @SQ lines in the header to figure out the
      // mapping between ref ref ID numbers and names
      const idToName: any[] = []
      const nameToId: any = {}
      const sqLines = samHeader.filter((l: { tag: string }) => l.tag === 'SQ')
      sqLines.forEach((sqLine: { data: any }, refId: number) => {
        sqLine.data.forEach((item: any) => {
          if (item.tag === 'SN') {
            // this is the ref name
            const refName = item.value
            nameToId[refName] = refId
            idToName[refId] = refName
          }
        })
      })
      if (idToName.length) {
        this.samHeader.idToName = idToName
        this.samHeader.nameToId = nameToId
      }
    }
  }

  async getRefNames(): Promise<string[]> {
    await this.setup()
    return Object.keys(this.samHeader.nameToId)
  }

  /**
   * Fetch features for a certain region. Use getFeaturesInRegion() if you also
   * want to verify that the store has features for the given reference sequence
   * before fetching.
   * @param {Region} param
   * @param {AbortSignal} [signal] optional signalling object for aborting the fetch
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  // @ts-ignore type conflict between this rxjs and base
  getFeatures(
    { refName, start, end }: Region,
    opts: BaseOptions = {},
  ): Observable<Feature> {
    // @ts-ignore  same as above
    return ObservableCreate(
      async (observer: Observer<Feature>): Promise<void> => {
        await this.setup()
        const records = await this.bam.getRecordsForRange(
          refName,
          start,
          end,
          opts,
        )
        checkAbortSignal(opts.signal)
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
  freeResources(/* { region } */): void {}

  bamRecordToFeature(record: any): Feature {
    return new BamSlightlyLazyFeature(record, this)
  }

  refIdToName(refId: number): string | undefined {
    // use info from the SAM header if possible, but fall back to using
    // the ref name order from when the browser's ref names were loaded
    if (this.samHeader.idToName) {
      return this.samHeader.idToName[refId]
    }
    return undefined
  }
}
