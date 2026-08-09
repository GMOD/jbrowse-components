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

import type { BareFeature } from '../mcscanUtil.ts'
import type { MCScanSimpleAnchorsAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { Region } from '@jbrowse/core/util/types'

// A `.anchors.simple` row names the first and last gene of a block on each side
// (`startGene1 endGene1 startGene2 endGene2 size orientation`), so a side spans
// from one gene to the other rather than being a single gene. Both genes of a
// block sit on the same contig, so the span keeps the first one's refName — the
// same refName getRefNames reports, which is what keeps the two answers from
// disagreeing.
function spanBetween(first: BareFeature, last: BareFeature): BareFeature {
  return {
    refName: first.refName,
    start: Math.min(first.start, last.start),
    end: Math.max(first.end, last.end),
    name: `${first.name}-${last.name}`,
    score: first.score,
    strand: first.strand,
  }
}

export default class MCScanSimpleAnchorsAdapter extends BaseFeatureDataAdapter<MCScanSimpleAnchorsAdapterConfig> {
  public static capabilities = ['getFeatures', 'getRefNames']

  setup = createSharedSetup((opts: BaseOptions) => this.setupPre(opts))

  async setupPre(opts: BaseOptions) {
    const assemblyNames = this.getConf('assemblyNames')
    const pm = this.pluginManager
    const feats = await readAnchorsPair(
      {
        bed1: openLocation(this.getConf('bed1Location'), pm),
        bed2: openLocation(this.getConf('bed2Location'), pm),
        anchors: openLocation(this.getConf('mcscanSimpleAnchorsLocation'), pm),
      },
      opts,
      ([n11, n12, n21, n22, score, strand], join, rowNum) => {
        const starts = join(n11, n21)
        const ends = join(n12, n22)
        return starts === undefined || ends === undefined
          ? undefined
          : {
              a: spanBetween(starts.a, ends.a),
              b: spanBetween(starts.b, ends.b),
              rowNum,
              // the file states the block's orientation, so unlike the
              // gene-to-gene anchors format this is not the product of the
              // two BED strands
              strand: strand === '-' ? -1 : 1,
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
    // determining this properly is basically a call to getFeatures
    // so is not really that important, and has to be true or else
    // getFeatures is never called (BaseFeatureDataAdapter filters it out)
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
