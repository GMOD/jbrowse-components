import { IndexedFasta } from '@gmod/indexedfasta'
import BaseAdapter from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation, INoAssemblyRegion } from '@gmod/jbrowse-core/mst-types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { Observable, Observer } from 'rxjs'

export default class extends BaseAdapter {
  protected features: any

  public static capabilities = ['getFeatures', 'getRefNames', 'getRegions']

  public constructor(config: { features: any }) {
    super()
    const { features } = config

    this.features = features.map(
      (feature: any) => new SimpleFeature({ data: feature }),
    )
  }

  public async getRefNames(): Promise<string[]> {
    return this.features.map((feature: any) => feature.get('refName'))
  }

  public async getRegions(): Promise<INoAssemblyRegion[]> {
    return this.features.map((feature: any) => {
      return {
        refName: feature.get('refName'),
        start: feature.get('start'),
        end: feature.get('end'),
      }
    })
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
        const seq = this.features.find(
          (feature: any) => feature.get('refName') === refName,
        )

        if (seq) {
          observer.next(
            new SimpleFeature({
              id: `${refName} ${start}-${end}`,
              data: {
                refName,
                start,
                end,
                seq: seq.get('seq').slice(start, end),
              },
            }),
          )
        }
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
