import { TabixIndexedFile } from '@gmod/tabix'
import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, downloadStatus } from '@jbrowse/core/util'
import { sharedBgzfWorkerPool } from '@jbrowse/core/util/bgzfWorkerPool'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { readTabixLinesRedispatched } from '@jbrowse/core/util/tabix'

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
        chunkCacheBudget: decompressedBytesBudget,
        bgzfWorkerPool: sharedBgzfWorkerPool(),
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
        // The type list alone, and `opts.topLevelOnly` is deliberately not
        // honoured — both for the same reason. A GTF line has no `ID`/`Parent`,
        // so there is no cheap "can this have children"; and a GTF top-level
        // feature is not a line at all, it is synthesized by
        // `aggregateGtfFeatures` from the transcripts in the FETCHED set, whose
        // span it takes from them. So the argument that lets GFF3 skip the
        // flanks — a top-level feature overlapping the query is already in the
        // query's own read — does not transfer, and a narrower bound could draw
        // a gene short rather than merely flat. Nothing is lost by declining:
        // no GTF record shape makes this bound expensive (the fixtures top out
        // at 19 kb, against GFF3's chromosome-long `match`).
        const lines = await readTabixLinesRedispatched(
          gtf,
          query,
          line => !dontRedispatchSet.has(line.type),
          opts,
        )

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
