import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, downloadStatus, updateStatus } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import {
  aggregateGtfFeatures,
  extractType,
  featureData,
  parseGtf,
} from '../util.ts'

import type { GtfTabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'
import type { Observer } from 'rxjs'

interface GtfLine {
  line: string
  start: number
  end: number
  type: string
}

export default class GtfTabixAdapter extends BaseFeatureDataAdapter<GtfTabixAdapterConfig> {
  private configured?: Promise<{
    gtf: TabixIndexedFile
    dontRedispatchSet: Set<string>
    header: string
  }>

  private configureOnce() {
    if (!this.configured) {
      const gtfGzLocation = this.getConf('gtfGzLocation')
      const indexType = this.getConf(['index', 'indexType'])
      const loc = this.getConf(['index', 'location'])
      const dontRedispatch = this.getConf('dontRedispatch') as string[]
      const gtf = new TabixIndexedFile({
        filehandle: openLocation(gtfGzLocation, this.pluginManager),
        ...openTabixIndexFilehandle(loc, indexType, this.pluginManager),
        chunkCacheSize: 50 * 2 ** 20,
      })
      this.configured = gtf
        .getHeader()
        .then(header => ({
          gtf,
          dontRedispatchSet: new Set(dontRedispatch),
          header,
        }))
        .catch((e: unknown) => {
          this.configured = undefined
          throw e
        })
    }
    return this.configured
  }

  async configure(opts?: BaseOptions) {
    return updateStatus('Downloading index', opts?.statusCallback, () =>
      this.configureOnce(),
    )
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { gtf } = await this.configure(opts)
    return gtf.getReferenceSequenceNames(opts)
  }

  public async getHeader(opts: BaseOptions = {}) {
    const { header } = await this.configure(opts)
    return header
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      try {
        await this.configure(opts)
        await this.getFeaturesHelper(query, opts, observer, true)
      } catch (e) {
        observer.error(e)
      }
    }, opts.stopToken)
  }

  private async getFeaturesHelper(
    query: Region,
    opts: BaseOptions,
    observer: Observer<Feature>,
    allowRedispatch: boolean,
    originalQuery = query,
  ) {
    const { gtf, dontRedispatchSet } = await this.configureOnce()
    const lines: GtfLine[] = []

    await downloadStatus(
      'Downloading features',
      opts.statusCallback,
      onProgress =>
        gtf.getLines(query.refName, query.start, query.end, {
          lineCallback: (line, _fo, s, e) => {
            lines.push({ line, start: s, end: e, type: extractType(line) })
          },
          onProgress,
        }),
    )

    if (allowRedispatch && lines.length) {
      let minStart = Number.POSITIVE_INFINITY
      let maxEnd = Number.NEGATIVE_INFINITY
      for (const rec of lines) {
        // gene/transcript lines span their children, so expanding to their
        // bounds lets the redispatch pull in child features (exon/CDS) that
        // fall outside the original query
        if (!dontRedispatchSet.has(rec.type)) {
          const start = rec.start - 1 // gtf is 1-based
          if (start < minStart) {
            minStart = start
          }
          if (rec.end > maxEnd) {
            maxEnd = rec.end
          }
        }
      }
      if (maxEnd > query.end || minStart < query.start) {
        await this.getFeaturesHelper(
          { ...query, start: minStart, end: maxEnd },
          opts,
          observer,
          false,
          query,
        )
        return
      }
    }

    const aggregateField = this.getConf('aggregateField')
    const feats = parseGtf(lines.map(l => l.line).join('\n')).map(
      (f, i) =>
        featureData(
          f,
          `${this.id}-${query.refName}-${i}`,
        ) as SimpleFeatureSerialized,
    )

    const aggregated = aggregateGtfFeatures({
      feats,
      aggregateField,
      refName: query.refName,
      regionStart: originalQuery.start,
      regionEnd: originalQuery.end,
    })
    for (const feat of aggregated) {
      observer.next(new SimpleFeature({ id: feat.uniqueId, data: feat }))
    }
    observer.complete()
  }
}
