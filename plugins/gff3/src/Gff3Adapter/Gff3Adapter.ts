import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import {
  groupLinesByRef,
  makeFeatureIntervalTreeMap,
} from '@jbrowse/core/util/parseLineByLine'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { parseLinesLazy } from 'gff-nostream'

import { Gff3Feature } from '../Gff3Feature.ts'

import type { IdentifiedGffFeature } from '../Gff3Feature.ts'
import type { Gff3AdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class Gff3Adapter extends BaseFeatureDataAdapter<Gff3AdapterConfig> {
  // the whole file is resident after one load, so the fetch/parse status comes
  // from inside the load itself rather than a label wrapped around it
  private loadData = cachedSetup({
    setup: async (opts: BaseOptions) => {
      const buffer = await fetchAndMaybeUnzip(
        openLocation(this.getConf('gffLocation'), this.pluginManager),
        opts,
      )

      const { headerLines, linesByRef } = groupLinesByRef(
        buffer,
        opts.statusCallback,
      )

      const intervalTreeMap = makeFeatureIntervalTreeMap<IdentifiedGffFeature>(
        linesByRef,
        // lines are already split and comment/FASTA-filtered by
        // groupLinesByRef, so feed them straight to parseLinesLazy rather than
        // re-joining and re-splitting through parseStringSync.
        //
        // Lazy because the whole file stays resident for the session: leaving
        // column 9 as text rather than an object per attribute is what keeps
        // that resident set small (8.5x on GENCODE-shaped input), and the
        // render path reads only a handful of attributes anyway — see
        // Gff3Feature.
        (lines, refName) => {
          const features = parseLinesLazy(lines) as IdentifiedGffFeature[]
          // stamped in place rather than through `{...feature, uniqueId}`:
          // these are freshly parsed objects nobody else holds, and the spread
          // copied every attribute of every top-level feature in the file to
          // add one key
          for (let i = 0; i < features.length; i++) {
            features[i]!.uniqueId = `${this.id}-${refName}-${i}`
          }
          return features
        },
        'Parsing GFF data',
      )

      return { header: headerLines.join('\n'), intervalTreeMap }
    },
  })

  public async getRefNames(opts: BaseOptions = {}) {
    const { intervalTreeMap } = await this.loadData(opts)
    return Object.keys(intervalTreeMap)
  }

  public async getHeader(opts: BaseOptions = {}) {
    const { header } = await this.loadData(opts)
    return header
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    // no try/catch: ObservableCreate forwards a rejected callback to
    // observer.error itself
    return ObservableCreate<Feature>(async observer => {
      const { start, end, refName } = query
      const { intervalTreeMap } = await this.loadData(opts)
      const tree = intervalTreeMap[refName]
      if (tree) {
        for (const f of tree(opts.statusCallback).search([start, end])) {
          observer.next(new Gff3Feature(f, f.uniqueId))
        }
      }
      observer.complete()
    }, opts.stopToken)
  }
}
