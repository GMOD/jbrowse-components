import BaseAdapter from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation, INoAssemblyRegion } from '@gmod/jbrowse-core/mst-types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { Observable, Observer } from 'rxjs'
import { GenericFilehandle } from 'generic-filehandle'

export default class extends BaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected data: any

  // the map of refSeq to length
  protected refSeqs: Promise<{ [key: string]: number }>

  protected source: string

  public static capabilities = ['getFeatures', 'getRefNames', 'getRegions']

  public constructor(config: { chromSizesLocation: IFileLocation }) {
    super()
    const { chromSizesLocation } = config
    if (!chromSizesLocation) {
      throw new Error('must provide chromSizesLocation')
    }
    const file = openLocation(chromSizesLocation)
    this.source = file.toString()
    this.refSeqs = this.init(file)
  }

  async init(file: GenericFilehandle) {
    const data = (await file.readFile('utf8')) as string
    const refSeqs: { [key: string]: number } = {}
    if (!data.length) {
      throw new Error(`Could not read file ${file.toString()}`)
    }
    data.split('\n').forEach((line: string) => {
      if (line.length) {
        const [name, length] = line.split('\t')
        refSeqs[name] = +length
      }
    })
    return refSeqs
  }

  public async getRefNames() {
    return Object.keys(await this.refSeqs)
  }

  public async getRegions() {
    const refSeqs = await this.refSeqs
    return Object.keys(refSeqs).map(refName => ({
      refName,
      start: 0,
      end: refSeqs[refName],
    }))
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures({
    refName,
    start,
    end,
  }: INoAssemblyRegion): Observable<Feature> {
    return ObservableCreate<Feature>(
      async (observer: Observer<Feature>): Promise<void> => {
        // provides no sequence
        observer.complete()
      },
    )
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */): void {}
}
