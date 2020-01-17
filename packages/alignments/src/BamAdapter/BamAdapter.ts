import { BamFile } from '@gmod/bam'
import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation, IRegion, INoAssemblyRegion } from '@gmod/jbrowse-core/mst-types'
import { checkAbortSignal } from '@gmod/jbrowse-core/util'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { GenericFilehandle } from 'generic-filehandle'
import { Observable, Observer } from 'rxjs'
import memoize from 'memoize-one'
import BamSlightlyLazyFeature from './BamSlightlyLazyFeature'

interface HeaderLine {
  tag: string
  value: string
}
interface Header {
  idToName: string[]
  nameToId: Record<string, number>
}

const setup = memoize(async (bam: BamFile) => {
  const samHeader = await bam.getHeader()

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
  private bam: BamFile

  private samHeader: Header = { idToName: [], nameToId: {} }

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

  async getRefNames() {
    return (await setup(this.bam)).idToName
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
        this.samHeader = await setup(this.bam)
        const records = await this.bam.getRecordsForRange(
          refName,
          start,
          end,
          opts,
        )
        checkAbortSignal(opts.signal)
        records.forEach(record => {
          observer.next(new BamSlightlyLazyFeature(record, this))
        })
        observer.complete()
      },
    )
  }

  public async getMultiRegionStats(
    regions: INoAssemblyRegion[] = [],
    opts: BaseOptions = {},
  ) {
    const scoreMax = regions.length > 0 ? await this.calculateDensity(regions, opts, 100) : 50
    console.log(scoreMax)
    return { scoreMin: 0, scoreMax }
  }

  async calculateDensity(
    region: any,
    opts: BaseOptions = {},
    length: number,
  ): Promise<number> {
    let results = new Array
    const { refName, start, end } = region[0]
    const sampleCenter = start * 0.75 + end * 0.25
    const sampleStart = Math.max(0, Math.round(sampleCenter - length / 2))
    const sampleEnd = Math.max(Math.round(sampleCenter + length / 2), end)

    this.samHeader = await setup(this.bam)
    const records = await this.bam.getRecordsForRange(refName, sampleStart, sampleEnd, opts)
    checkAbortSignal(opts.signal)

    records.forEach(function iterate(feature, index) {
      if (feature.get('start') < sampleStart || feature.get('end') > sampleEnd) return
      results.push({
        featureDensity: feature.get('length_on_ref') / (length)
      })
    })

    if (results.length >= 300 || length * 2 > region[0].parentRegion.end - region[0].parentRegion.start) {
      const total = results.reduce((a, b) => a + (b['featureDensity'] || 0), 0)
      return Math.ceil(total * 2)
    }
    else return this.calculateDensity(region, opts, length * 2)
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources(/* { region } */): void { }

  // depends on setup being called before the BAM constructor
  refIdToName(refId: number): string | undefined {
    return this.samHeader.idToName[refId]
  }
}
