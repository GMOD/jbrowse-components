import { TwoBitFile } from '@gmod/twobit'

import { openLocation } from '@gmod/jbrowse-core/util/io'
import BaseAdapter, { Region } from '@gmod/jbrowse-core/BaseAdapter'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Observer } from 'rxjs'

export default class TwoBitAdapter extends BaseAdapter {
  private twobit: any

  public static capabilities = ['getFeatures', 'getRefNames', 'getRegions']

  public constructor(config: Record<string, any>) {
    super(config)
    const { twoBitLocation } = config
    const twoBitOpts = {
      filehandle: openLocation(twoBitLocation),
    }

    this.twobit = new TwoBitFile(twoBitOpts)
  }

  public async getRefNames() {
    return this.twobit.getSequenceNames()
  }

  public async getRegions() {
    const refSizes = await this.twobit.getSequenceSizes()
    return Object.keys(refSizes).map(refName => ({
      refName,
      start: 0,
      end: refSizes[refName],
    }))
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures({ refName, start, end }: Region) {
    return ObservableCreate<Feature>(async (observer: Observer<Feature>) => {
      const seq = await this.twobit.getSequence(refName, start, end)
      observer.next(
        new SimpleFeature({
          id: `${refName} ${start}-${end}`,
          data: { refName, start, end, seq },
        }),
      )
      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */) {}
}
