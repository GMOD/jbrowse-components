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

  protected featureToSyntenyBlock: any

  protected syntenyBlockToFeature: any

  protected loaded: Promise<boolean>

  protected source: string

  public static capabilities = ['getFeatures', 'getRefNames', 'getRegions']

  public constructor(config: {
    featuresLocation: IFileLocation
    mcscanAnchorsLocation: IFileLocation
  }) {
    super()
    const { mcscanAnchorsLocation, featuresLocation } = config
    if (!mcscanAnchorsLocation) {
      throw new Error('must provide mcscanAnchorsLocation')
    }
    const mcscan = openLocation(mcscanAnchorsLocation)
    const features = openLocation(featuresLocation)
    this.source = `${mcscan.toString()}-${features.toString()}`
    this.featureToSyntenyBlock = {}
    this.syntenyBlockToFeature = {}
    this.loaded = this.init(mcscan, features)
  }

  async init(file: GenericFilehandle, features: GenericFilehandle) {
    const data = (await file.readFile('utf8')) as string
    const m: { [key: string]: string } = {}
    const r: {
      [key: string]: {
        name1: string
        name2: string
        name3: string
        name4: string
        score: number
      }
    } = {}
    if (!data.length) {
      throw new Error(`Could not read file ${file.toString()}`)
    }
    data.split('\n').forEach((line: string, index: number) => {
      if (line.length) {
        const [name1, name2, name3, name4, score] = line.split('\t')
        m[name1] = `line-${index}`
        m[name2] = `line-${index}`
        m[name3] = `line-${index}`
        m[name4] = `line-${index}`
        r[index] = { name1, name2, name3, name4, score: +score }
      }
    })
    this.syntenyBlockToFeature = r
    this.featureToSyntenyBlock = m
    return true
  }

  public async getRefNames() {
    await this.loaded
    return []
  }

  public async getRegions() {
    const refSeqs = await this.loaded
    return {}
    // return Object.keys(refSeqs).map(refName => ({
    //   refName,
    //   start: 0,
    //   end: refSeqs[refName],
    // }))
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
