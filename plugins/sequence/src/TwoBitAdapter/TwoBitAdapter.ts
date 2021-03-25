import {
  BaseFeatureDataAdapter,
  SequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { TwoBitFile } from '@gmod/twobit'
import { readConfObject } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'

import configSchema from './configSchema'

export default class TwoBitAdapter
  extends BaseFeatureDataAdapter
  implements SequenceAdapter {
  private twobit: typeof TwoBitFile

  constructor(config: Instance<typeof configSchema>) {
    super(config)
    const twoBitOpts = {
      filehandle: openLocation(readConfObject(config, 'twoBitLocation')),
    }

    this.twobit = new TwoBitFile(twoBitOpts)
  }

  public getRefNames() {
    return this.twobit.getSequenceNames()
  }

  public async getRegions(): Promise<NoAssemblyRegion[]> {
    const refSizes = await this.twobit.getSequenceSizes()
    return Object.keys(refSizes).map(
      (refName: string): NoAssemblyRegion => ({
        refName,
        start: 0,
        end: refSizes[refName],
      }),
    )
  }

  /**
   * Fetch features for a certain region
   * @param param -
   * @returns Observable of Feature objects in the region
   */
  public getFeatures({ refName, start, end }: NoAssemblyRegion) {
    return ObservableCreate<Feature>(async observer => {
      const size = await this.twobit.getSequenceSize(refName)
      const regionEnd = size !== undefined ? Math.min(size, end) : end
      const seq: string = await this.twobit.getSequence(
        refName,
        start,
        regionEnd,
      )
      if (seq) {
        observer.next(
          new SimpleFeature({
            id: `${refName} ${start}-${regionEnd}`,
            data: { refName, start, end: regionEnd, seq },
          }),
        )
      }
      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */): void {}
}
