import { TabixIndexedFile } from '@gmod/tabix'
import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, downloadStatus } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { calculateRedispatchRange } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { readTabixLines } from '@jbrowse/core/util/tabix'

import { aggregateGtfFeatures, parseGtfToFeatures } from '../util.ts'

import type { GtfTabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

export default class GtfTabixAdapter extends BaseFeatureDataAdapter<GtfTabixAdapterConfig> {
  private configure = cachedSetup({
    label: 'Downloading index',
    setup: async (_opts, onProgress) => {
      const gtf = new TabixIndexedFile({
        filehandle: openLocation(
          this.getConf('gtfGzLocation'),
          this.pluginManager,
        ),
        ...openTabixIndexFilehandle(
          this.getConf(['index', 'location']),
          this.getConf(['index', 'indexType']),
          this.pluginManager,
        ),
        chunkCacheSize: 50 * 2 ** 20,
      })
      return {
        gtf,
        dontRedispatchSet: new Set(this.getConf('dontRedispatch')),
        // the index is a whole-file read, so its byte ticks turn the
        // "Downloading index" label into a determinate bar
        header: await gtf.getHeader({ onProgress }),
      }
    },
  })

  public async getRefNames(opts: BaseOptions = {}) {
    const { gtf } = await this.configure(opts)
    return downloadStatus(
      'Downloading index',
      opts.statusCallback,
      onProgress => gtf.getReferenceSequenceNames({ ...opts, onProgress }),
    )
  }

  public async getHeader(opts: BaseOptions = {}) {
    const { header } = await this.configure(opts)
    return header
  }

  // Index-only compressed-byte estimate (no feature download), used by the
  // feature-fetch RPC to short-circuit an over-budget region before pulling
  // every line — see executeRenderFeatureData.
  public async getRegionByteSize(regions: Region[], opts: BaseOptions = {}) {
    const { gtf } = await this.configure(opts)
    return gtf.bytesForRegions(regions, opts)
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { gtf, dontRedispatchSet } = await this.configure(opts)
        const fetchLines = (region: Region) =>
          readTabixLines(
            gtf,
            region.refName,
            region.start,
            region.end,
            opts.statusCallback,
          )

        let lines = await fetchLines(query)

        // gene/transcript lines span their children, so if a feature extends
        // past the query, refetch the union of the query and the feature bounds
        // once to pull in child features (exon/CDS) that fall outside it.
        // dontRedispatch types (chromosome, region, ...) are excluded from the
        // bounds so one chromosome-spanning feature can't force a
        // whole-chromosome refetch.
        const redispatch = calculateRedispatchRange(
          lines,
          dontRedispatchSet,
          query.start,
          query.end,
        )
        if (redispatch) {
          lines = await fetchLines({ ...query, ...redispatch })
        }

        const feats = parseGtfToFeatures(
          lines,
          record => `${this.id}-offset-${record.offset}`,
        )
        const aggregated = aggregateGtfFeatures({
          feats,
          aggregateField: this.getConf('aggregateField'),
          refName: query.refName,
          idPrefix: this.id,
          regionStart: query.start,
          regionEnd: query.end,
        })
        for (const feat of aggregated) {
          observer.next(new SimpleFeature({ id: feat.uniqueId, data: feat }))
        }
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.stopToken)
  }
}
