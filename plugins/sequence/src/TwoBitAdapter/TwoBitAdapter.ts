import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { TwoBitFile } from '@gmod/twobit'
import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

export default class TwoBitAdapter extends BaseSequenceAdapter {
  private twobit: TwoBitFile

  // the chromSizesData can be used to speed up loading since TwoBit has to do
  // many range requests at startup to perform the getRegions request
  protected chromSizesData: Promise<Record<string, number> | undefined>

  private async initChromSizes() {
    const conf = readConfObject(this.config, 'chromSizesLocation')
    // check against default and empty in case someone makes the field blank in
    // config editor, may want better way to check "optional config slots" in
    // future
    if (conf.uri !== '/path/to/default.chrom.sizes' && conf.uri !== '') {
      const file = openLocation(conf, this.pluginManager)
      const data = await file.readFile('utf8')
      return Object.fromEntries(
        data
          ?.split(/\n|\r\n|\r/)
          .filter(line => !!line.trim())
          .map(line => {
            const [name, length] = line.split('\t')
            return [name, +length]
          }),
      )
    }
    return undefined
  }

  constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    this.chromSizesData = this.initChromSizes()
    this.twobit = new TwoBitFile({
      filehandle: openLocation(
        readConfObject(config, 'twoBitLocation'),
        this.pluginManager,
      ),
    })
  }

  public async getRefNames() {
    const chromSizesData = await this.chromSizesData
    if (chromSizesData) {
      return Object.keys(chromSizesData)
    }
    return this.twobit.getSequenceNames()
  }

  public async getRegions(): Promise<NoAssemblyRegion[]> {
    const chromSizesData = await this.chromSizesData
    if (chromSizesData) {
      return Object.keys(chromSizesData).map(refName => ({
        refName,
        start: 0,
        end: chromSizesData[refName],
      }))
    }
    const refSizes = await this.twobit.getSequenceSizes()
    return Object.keys(refSizes).map(refName => ({
      refName,
      start: 0,
      end: refSizes[refName],
    }))
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
      const seq = await this.twobit.getSequence(refName, start, regionEnd)
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
