import { createSharedSetup } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { ComparativeAdapterBase } from './ComparativeAdapterBase.ts'
import {
  getBlockRefNames,
  indexBlockRows,
  makeBlockFeatures,
  readAnchorsPair,
} from './mcscanUtil.ts'

import type { AnchorsRowParser } from './mcscanUtil.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, FileLocation, Region } from '@jbrowse/core/util'
import type { GenericFilehandle } from 'generic-filehandle2'

// The three slots both anchors formats declare identically. Read through a free
// function taking the adapter, for the reason getAssemblyNamesFromConf
// documents: from inside a base generic over the config these are unprovable
// slot names, while the concrete adapter's own reads stay typed.
function sharedAnchorsConf(adapter: BaseFeatureDataAdapter) {
  const pm = adapter.pluginManager
  return {
    assemblyNames: adapter.getConf('assemblyNames') as string[],
    bed1: openLocation(adapter.getConf('bed1Location') as FileLocation, pm),
    bed2: openLocation(adapter.getConf('bed2Location') as FileLocation, pm),
  }
}

/** The anchors file a format keeps its rows in, and how to read one of them. */
export interface AnchorsSource {
  anchors: GenericFilehandle
  parseRow: AnchorsRowParser
}

/**
 * Everything the two jcvi/MCScan anchors adapters do, which up to the row parser
 * is everything. `.anchors` names one orthologous gene pair per row and
 * `.anchors.simple` names the four genes bounding a block, so they differ in
 * which slot holds the file and how a row becomes a link — and in nothing else.
 * Both carried the same setup, the same getRefNames and the same getFeatures
 * verbatim.
 */
export abstract class McscanAnchorsAdapterBase<
  CONF extends AnyConfigurationModel = AnyConfigurationModel,
> extends ComparativeAdapterBase<CONF> {
  setup = createSharedSetup((opts: BaseOptions) => this.setupPre(opts))

  protected abstract anchorsSource(): AnchorsSource

  async setupPre(opts: BaseOptions) {
    const { assemblyNames, bed1, bed2 } = sharedAnchorsConf(this)
    const { anchors, parseRow } = this.anchorsSource()
    return {
      assemblyNames,
      feats: indexBlockRows(
        await readAnchorsPair({ bed1, bed2, anchors }, opts, parseRow),
      ),
    }
  }

  async getRefNames(opts: BaseOptions = {}) {
    // An assembly neither side of this file carries has the same answer
    // whatever the rows say, so it is answered before the setup rather than
    // after — reading it first downloaded and parsed the anchors file and both
    // BEDs to return [].
    const { assemblyNames } = sharedAnchorsConf(this)
    if (opts.assemblyName === undefined) {
      return []
    }
    if (!assemblyNames.includes(opts.assemblyName)) {
      return []
    }
    const { feats } = await this.setup(opts)
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
