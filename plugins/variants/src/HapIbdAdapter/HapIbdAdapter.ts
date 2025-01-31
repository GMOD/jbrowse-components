import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  doesIntersect2,
  fetchAndMaybeUnzipText,
  SimpleFeature,
  updateStatus,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

interface Row {
  samp1: string
  hap1: number
  samp2: string
  hap2: number
  start: number
  end: number
  refName: string
  cm: number
  uniqueId: string
  [key: string]: unknown
}

export default class HapIbdAdapter extends BaseFeatureDataAdapter {
  private configured?: Promise<{
    rows: Row[]
  }>

  private async configurePre(opts?: BaseOptions) {
    const vcfGzLocation = this.getConf('hapIbdLocation')
    const filehandle = openLocation(vcfGzLocation, this.pluginManager)
    const hapIbd = await fetchAndMaybeUnzipText(filehandle, opts)

    const lines = hapIbd.split('\n')
    const rows = [] as Row[]
    let i = 0
    for (const line of lines) {
      const [samp1, hap1, samp2, hap2, chr, start, end, cm] = line.split('\t')
      rows.push({
        uniqueId: `row${i++}`,
        samp1: samp1!,
        hap1: +hap1!,
        samp2: samp2!,
        hap2: +hap2!,
        refName: chr!,
        start: +start!,
        end: +end!,
        cm: +cm!,
      })
    }

    return {
      rows,
    }
  }

  protected async configure(opts?: BaseOptions) {
    if (!this.configured) {
      this.configured = this.configurePre(opts).catch((e: unknown) => {
        this.configured = undefined
        throw e
      })
    }
    return this.configured
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { rows } = await this.configure(opts)
    return [...new Set(rows.map(r => r.refName))]
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { statusCallback = () => {} } = opts
      const { rows } = await this.configure()

      for (const row of rows) {
        if (
          query.refName === row.refName &&
          doesIntersect2(row.start, row.end, query.start, query.end)
        ) {
          observer.next(new SimpleFeature(row))
        }
      }

      observer.complete()
    }, opts.stopToken)
  }

  public freeResources(/* { region } */): void {}
}
