import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { createSharedSetup } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import {
  anchorScore,
  getBlockRefNames,
  makeBlockFeatures,
  readAnchorsPair,
} from '../mcscanUtil.ts'

import type { MCScanAnchorsAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class MCScanAnchorsAdapter extends BaseFeatureDataAdapter<MCScanAnchorsAdapterConfig> {
  public static capabilities = ['getFeatures', 'getRefNames']

  setup = createSharedSetup((opts: BaseOptions) => this.setupPre(opts))

  async setupPre(opts: BaseOptions) {
    const assemblyNames = this.getConf('assemblyNames')
    const pm = this.pluginManager
    const feats = await readAnchorsPair(
      {
        bed1: openLocation(this.getConf('bed1Location'), pm),
        bed2: openLocation(this.getConf('bed2Location'), pm),
        anchors: openLocation(this.getConf('mcscanAnchorsLocation'), pm),
      },
      opts,
      // one orthologous gene pair per row, so the link's orientation is the
      // product of the two BED strands
      ([name1, name2, score], join, rowNum) => {
        const pair = join(name1, name2)
        return pair === undefined
          ? undefined
          : {
              ...pair,
              rowNum,
              strand: pair.a.strand * pair.b.strand,
              score: anchorScore(score),
            }
      },
    )

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
