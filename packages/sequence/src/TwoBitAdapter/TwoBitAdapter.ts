import BaseAdapter from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation, INoAssemblyRegion } from '@gmod/jbrowse-core/mst-types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { TwoBitFile } from '@gmod/twobit'
import { Observable, Observer } from 'rxjs'

export default class extends BaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private twobit: any

  public static capabilities = ['getFeatures', 'getRefNames', 'getRegions']

  public constructor(config: { twoBitLocation: IFileLocation }) {
    super()
    const twoBitOpts = {
      filehandle: openLocation(config.twoBitLocation),
    }

    this.twobit = new TwoBitFile(twoBitOpts)
  }

  public async getRefNames(): Promise<string[]> {
    return this.twobit.getSequenceNames()
  }

  public async getRegions(): Promise<INoAssemblyRegion[]> {
    const refSizes = await this.twobit.getSequenceSizes()
    return Object.keys(refSizes).map(
      (refName: string): INoAssemblyRegion => ({
        refName,
        start: 0,
        end: refSizes[refName],
      }),
    )
  }

  /**
   * Fetch features for a certain region
   * @param {INoAssemblyRegion} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures({
    refName,
    start,
    end,
  }: INoAssemblyRegion): Observable<Feature> {
    return ObservableCreate<Feature>(
      async (observer: Observer<Feature>): Promise<void> => {
        let seq: string = await this.twobit.getSequence(refName, start, end)
        if (seq) {
          if (seq.length !== end - start) {
            // we might have queried past the end of the sequence
            const size = await this.twobit.getSequenceSize(refName)
            if (end > size) {
              end = size
              seq = await this.twobit.getSequence(refName, start, end)
            }
          }
          observer.next(
            new SimpleFeature({
              id: `${refName} ${start}-${end}`,
              data: { refName, start, end, seq },
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
