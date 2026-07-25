import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { createSharedSetup } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { getBlockRefNames, makeBlockFeatures } from '../mcscanUtil.ts'
import { parseBed, readFiles } from '../util.ts'

import type { MCScanAnchorsAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class MCScanAnchorsAdapter extends BaseFeatureDataAdapter<MCScanAnchorsAdapterConfig> {
  public static capabilities = ['getFeatures', 'getRefNames']

  setup = createSharedSetup((opts: BaseOptions) => this.setupPre(opts))

  async setupPre(opts: BaseOptions) {
    const assemblyNames = this.getConf('assemblyNames')
    const pm = this.pluginManager
    const [bed1text, bed2text, mcscantext] = await readFiles(
      [
        openLocation(this.getConf('bed1Location'), pm),
        openLocation(this.getConf('bed2Location'), pm),
        openLocation(this.getConf('mcscanAnchorsLocation'), pm),
      ],
      opts,
    )

    const bed1Map = parseBed(bed1text!)
    const bed2Map = parseBed(bed2text!)
    const feats = mcscantext!
      .split(/\n|\r\n|\r/)
      .filter(f => !!f && f !== '###')
      .map((line, index) => {
        const [name1, name2, score] = line.split('\t')
        const r1 = bed1Map.get(name1!)
        const r2 = bed2Map.get(name2!)
        if (!r1 || !r2) {
          throw new Error(`feature not found, ${name1} ${name2} ${r1} ${r2}`)
        }
        return { a: r1, b: r2, rowNum: index, score: +score! }
      })

    return {
      assemblyNames,
      feats,
    }
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures so is not
    // really that important, and has to be true or else getFeatures is never
    // called (BaseFeatureDataAdapter filters it out)
    return true
  }

  async getRefNames(opts: BaseOptions = {}) {
    const { feats, assemblyNames } = await this.setup(opts)
    return getBlockRefNames(assemblyNames, feats, opts.assemblyName)
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { assemblyNames, feats } = await this.setup(opts)
      for (const feat of makeBlockFeatures(assemblyNames, feats, region)) {
        observer.next(feat)
      }
      observer.complete()
    })
  }
}
