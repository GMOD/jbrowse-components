import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import {
  groupLinesByRef,
  makeFeatureIntervalTreeMap,
} from '@jbrowse/core/util/parseLineByLine'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { parseRecords } from 'gff-nostream'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'
import type { GffFeature } from 'gff-nostream'

type Gff3Feature = GffFeature & { uniqueId: string }

export default class Gff3Adapter extends BaseFeatureDataAdapter {
  private gffFeatures?: ReturnType<Gff3Adapter['loadDataP']>

  private async loadDataP(opts?: BaseOptions) {
    const buffer = await fetchAndMaybeUnzip(
      openLocation(this.getConf('gffLocation'), this.pluginManager),
      opts,
    )

    const { headerLines, linesByRef } = groupLinesByRef(
      buffer,
      opts?.statusCallback,
    )

    const intervalTreeMap = makeFeatureIntervalTreeMap<Gff3Feature>(
      linesByRef,
      // lines are already split and comment/FASTA-filtered by groupLinesByRef,
      // so feed them straight to parseRecords rather than re-joining and
      // re-splitting through parseStringSync
      (lines, refName) =>
        parseRecords(lines.map(line => ({ line }))).map(({ feature }, i) => ({
          ...feature,
          uniqueId: `${this.id}-${refName}-${i}`,
        })),
      'Parsing GFF data',
    )

    return { header: headerLines.join('\n'), intervalTreeMap }
  }

  private async loadData(opts: BaseOptions) {
    this.gffFeatures ??= this.loadDataP(opts).catch((e: unknown) => {
      this.gffFeatures = undefined
      throw e
    })
    return this.gffFeatures
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { intervalTreeMap } = await this.loadData(opts)
    return Object.keys(intervalTreeMap)
  }

  public async getHeader(opts: BaseOptions = {}) {
    const { header } = await this.loadData(opts)
    return header
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { start, end, refName } = query
        const { intervalTreeMap } = await this.loadData(opts)
        const tree = intervalTreeMap[refName]
        if (tree) {
          for (const f of tree(opts.statusCallback).search([start, end])) {
            observer.next(new SimpleFeature({ data: f, id: f.uniqueId }))
          }
        }
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.stopToken)
  }
}
