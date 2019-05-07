import { TwoBitFile } from '@gmod/twobit'

import { openLocation } from '@gmod/jbrowse-core/util/io'
import BaseAdapter from '@gmod/jbrowse-core/BaseAdapter'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Observable, Observer } from 'rxjs'

export default class TwoBitAdapter extends BaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private twobit: any

  public static capabilities = ['getFeatures', 'getRefNames', 'getRegions']

  public constructor(config: { twoBitLocation: string }) {
    super()
    const twoBitOpts = {
      filehandle: openLocation(config.twoBitLocation),
    }

    this.twobit = new TwoBitFile(twoBitOpts)
  }

  public async getRefNames(): Promise<string[]> {
    return this.twobit.getSequenceNames()
  }

  public async getRegions(): Promise<IRegion[]> {
    const refSizes = await this.twobit.getSequenceSizes()
    return Object.keys(refSizes).map(
      (refName: string): IRegion => ({
        refName,
        start: 0,
        end: refSizes[refName],
      }),
    )
  }

  /**
   * Fetch features for a certain region
   * @param {IRegion} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures({ refName, start, end }: IRegion): Observable<Feature> {
    return ObservableCreate<Feature>(
      async (observer: Observer<Feature>): Promise<void> => {
        const seq = await this.twobit.getSequence(refName, start, end)
        observer.next(
          new SimpleFeature({
            id: `${refName} ${start}-${end}`,
            data: { refName, start, end, seq },
          }),
        )
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
