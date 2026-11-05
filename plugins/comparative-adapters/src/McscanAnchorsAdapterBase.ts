import { readConfObject } from '@jbrowse/core/configuration'
import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { ComparativeAdapterBase } from './ComparativeAdapterBase.ts'
import {
  getBlockRefNames,
  indexBlockRows,
  makeBlockFeatures,
  partnerCounts,
  readAnchorsPair,
  syntenicDepthOf,
} from './mcscanUtil.ts'

import type MCScanAnchorsAdapterSchema from './MCScanAnchorsAdapter/configSchema.ts'
import type { AnchorsRowParser } from './mcscanUtil.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { ConfigModelForSlots } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { GenericFilehandle } from 'generic-filehandle2'

// The three slots both anchors formats declare identically
type AnchorsConfigModel = ConfigModelForSlots<
  typeof MCScanAnchorsAdapterSchema,
  'assemblyNames' | 'bed1Location' | 'bed2Location'
>

function sharedAnchorsConf(
  conf: AnchorsConfigModel,
  pluginManager: PluginManager | undefined,
) {
  return {
    assemblyNames: readConfObject(conf, 'assemblyNames'),
    bed1: openLocation(readConfObject(conf, 'bed1Location'), pluginManager),
    bed2: openLocation(readConfObject(conf, 'bed2Location'), pluginManager),
  }
}

/**
 * The anchors file a format keeps its rows in, how to read one of them, and
 * whether a row names one gene pair, which is what a syntenic depth counts.
 */
export interface AnchorsSource {
  anchors: GenericFilehandle
  parseRow: AnchorsRowParser
  genePairs: boolean
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
  CONF extends AnchorsConfigModel,
> extends ComparativeAdapterBase<CONF> {
  protected override readonly recordsAreAlignments = false

  setup = cachedSetup({ setup: (opts: BaseOptions) => this.setupPre(opts) })

  protected abstract anchorsSource(): AnchorsSource

  async setupPre(opts: BaseOptions) {
    const { assemblyNames, bed1, bed2 } = sharedAnchorsConf(
      this.config,
      this.pluginManager,
    )
    const { anchors, parseRow, genePairs } = this.anchorsSource()
    const rows = await readAnchorsPair({ bed1, bed2, anchors }, opts, parseRow)
    const [assemblyA = '', assemblyB = ''] = assemblyNames
    const counts = genePairs
      ? partnerCounts(
          assemblyA,
          assemblyB,
          rows.map(({ a, b }) => [a.name, b.name] as const),
        )
      : undefined
    return {
      assemblyNames,
      feats: indexBlockRows(
        counts
          ? rows.map(row => ({
              ...row,
              syntenicDepth: syntenicDepthOf(
                counts,
                assemblyA,
                row.a.name,
                assemblyB,
                row.b.name,
              ),
            }))
          : rows,
      ),
    }
  }

  async getRefNames(opts: BaseOptions = {}) {
    // An assembly neither side of this file carries has the same answer
    // whatever the rows say, so it is answered before the setup rather than
    // after — reading it first downloaded and parsed the anchors file and both
    // BEDs to return [].
    const { assemblyNames } = sharedAnchorsConf(this.config, this.pluginManager)
    if (
      opts.assemblyName === undefined ||
      !assemblyNames.includes(opts.assemblyName)
    ) {
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
