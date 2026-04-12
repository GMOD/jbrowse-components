import { TwoBitFile } from '@gmod/twobit'
import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class TwoBitAdapter extends BaseSequenceAdapter {
  protected setupP?: Promise<{
    twobit: TwoBitFile
    chromSizesData: Record<string, number> | undefined
  }>

  private async initChromSizes() {
    const conf = this.getConf('chromSizesLocation')
    if (conf.uri !== '/path/to/default.chrom.sizes' && conf.uri !== '') {
      const file = openLocation(conf, this.pluginManager)
      const data = await file.readFile('utf8')
      const entries: [string, number][] = []
      for (const line of data.split(/\n|\r\n|\r/)) {
        const [name, length] = line.split('\t')
        if (name && length) {
          entries.push([name, +length])
        }
      }
      return Object.fromEntries(entries)
    }
    return undefined
  }

  async setupPre() {
    return {
      twobit: new TwoBitFile({
        filehandle: openLocation(
          this.getConf('twoBitLocation'),
          this.pluginManager,
        ),
      }),
      chromSizesData: await this.initChromSizes(),
    }
  }
  async setup() {
    if (!this.setupP) {
      this.setupP = this.setupPre().catch((e: unknown) => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  public async getRefNames() {
    const { chromSizesData, twobit } = await this.setup()
    return chromSizesData
      ? Object.keys(chromSizesData)
      : twobit.getSequenceNames()
  }

  public async getRegions() {
    const { chromSizesData, twobit } = await this.setup()
    if (chromSizesData) {
      return Object.keys(chromSizesData).map(refName => ({
        refName,
        start: 0,
        end: chromSizesData[refName]!,
      }))
    } else {
      const refSizes = await twobit.getSequenceSizes()
      return Object.keys(refSizes).map(refName => ({
        refName,
        start: 0,
        end: refSizes[refName]!,
      }))
    }
  }

  /**
   * Fetch features for a certain region
   * @param param -
   * @returns Observable of Feature objects in the region
   */
  public getFeatures({ refName, start, end }: NoAssemblyRegion) {
    return ObservableCreate<Feature>(async observer => {
      const { twobit } = await this.setup()
      const size = await twobit.getSequenceSize(refName)
      const regionEnd = size !== undefined ? Math.min(size, end) : end
      const seq = await twobit.getSequence(refName, start, regionEnd)
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
}
