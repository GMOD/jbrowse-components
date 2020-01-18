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
interface Stats{
  scoreMin: number,
  scoreMax: number
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

  /**
   * Fetch stats for a certain region. Uses BaseAdapter's generate sample
   * to gather a range for getRecordsForRange to use, then calculates
   * and sums feature density for each record and returns
   * If calculate density returns a falsy value (0), recurse by doubling
   * the interval/length which is initially 100
   * @param {Any} regions set to any so BaseAdapter doesn't complain when accessing
   * @param {AbortSignal} [signal] optional signalling object for aborting the fetch
   * @param {Number} length used to generate record range, doubles til condition hit
   * @returns {Stats} Estimated stats of this region used for domain and rendering
   */
  public async getMultiRegionStats(
    regions: any,
    opts: BaseOptions = {},
    length: number
  ):Promise<Stats>{
    // const defaultDomain = {scoreMin: 0, scoreMax: 0}

    // if(regions.length > 0){
    //   const sample = await this.generateSample(regions[0], length)
    //   this.samHeader = await setup(this.bam)
    //   const records = await this.bam.getRecordsForRange(
    //     sample.refName, 
    //     sample.sampleStart, 
    //     sample.sampleEnd, 
    //     opts
    //   )
    //   checkAbortSignal(opts.signal)
    //   const results = await this.calculateDensity(
    //     sample.sampleStart, 
    //     sample.sampleEnd, 
    //     regions[0], 
    //     records, 
    //     length,
    //   )
    //   return results.scoreMax > 0 ? {scoreMin: 0, scoreMax: results.scoreMax} : this.getMultiRegionStats(regions, opts, length * 2)
    // }
    // else return defaultDomain

    // Below works and is cleaner but renders slower (can see hitch when rendering, scalebar starts at 0)
    const stats = regions[0]
    ? await this.estimateStats(
        regions[0],
        opts,
        length,
        await setup(this.bam),
        this.bam,
      )
    : { scoreMin: 0, scoreMax: 0 }
    checkAbortSignal(opts.signal)
    return {scoreMin: stats.scoreMin, scoreMax: stats.scoreMax}
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
