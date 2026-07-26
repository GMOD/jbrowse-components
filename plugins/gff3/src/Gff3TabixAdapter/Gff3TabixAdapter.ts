import { TabixIndexedFile } from '@gmod/tabix'
import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadStatus } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import {
  calculateRedispatchRange,
  doesIntersect2,
} from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { readTabixLines } from '@jbrowse/core/util/tabix'
import { parseRecords } from 'gff-nostream'

import type { Gff3TabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { Region } from '@jbrowse/core/util/types'

export default class Gff3TabixAdapter extends BaseFeatureDataAdapter<Gff3TabixAdapterConfig> {
  private configure = cachedSetup({
    label: 'Downloading index',
    setup: async (_opts, onProgress) => {
      const gff = new TabixIndexedFile({
        filehandle: openLocation(
          this.getConf('gffGzLocation'),
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
        gff,
        dontRedispatchSet: new Set(this.getConf('dontRedispatch')),
        // the index is a whole-file read, so its byte ticks turn the
        // "Downloading index" label into a determinate bar
        header: await gff.getHeader({ onProgress }),
      }
    },
  })

  public async getRefNames(opts: BaseOptions = {}) {
    const { gff } = await this.configure(opts)
    return downloadStatus(
      'Downloading index',
      opts.statusCallback,
      onProgress => gff.getReferenceSequenceNames({ ...opts, onProgress }),
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
    const { gff } = await this.configure(opts)
    return gff.bytesForRegions(regions, opts)
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        const { gff, dontRedispatchSet } = await this.configure(opts)
        const fetchLines = (region: Region) =>
          readTabixLines(
            gff,
            region.refName,
            region.start,
            region.end,
            opts.statusCallback,
          )

        let lines = await fetchLines(query)

        // a feature found in the query (e.g. a gene) may extend beyond it; if
        // so, refetch the union of the query and the feature bounds once so
        // parent/child relationships resolve fully. dontRedispatch types
        // (chromosome, region, ...) are excluded from the bounds so one
        // chromosome-spanning feature can't force a whole-chromosome refetch.
        const redispatch = calculateRedispatchRange(
          lines,
          dontRedispatchSet,
          query.start,
          query.end,
        )
        if (redispatch) {
          lines = await fetchLines({ ...query, ...redispatch })
        }

        // emit only top-level features intersecting the original query. the
        // byte offset stays on our own record and is used purely to mint a
        // stable id, so it never pollutes the feature's data
        for (const { feature, record } of parseRecords(lines)) {
          if (
            doesIntersect2(feature.start, feature.end, query.start, query.end)
          ) {
            observer.next(
              new SimpleFeature({
                data: feature,
                id: `${this.id}-offset-${record.offset}`,
              }),
            )
          }
        }
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    }, opts.stopToken)
  }
}
