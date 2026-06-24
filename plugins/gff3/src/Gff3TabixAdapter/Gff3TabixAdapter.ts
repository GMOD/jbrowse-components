import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadStatus, updateStatus } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import {
  calculateRedispatchRange,
  doesIntersect2,
} from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { extractType, parseRecordsJBrowse } from 'gff-nostream'

import type { Gff3TabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { Region } from '@jbrowse/core/util/types'
import type { LineRecord } from 'gff-nostream'

export default class Gff3TabixAdapter extends BaseFeatureDataAdapter<Gff3TabixAdapterConfig> {
  private configured?: Promise<{
    gff: TabixIndexedFile
    dontRedispatchSet: Set<string>
    header: string
  }>

  private configureOnce() {
    if (!this.configured) {
      const gffGzLocation = this.getConf('gffGzLocation')
      const indexType = this.getConf(['index', 'indexType'])
      const loc = this.getConf(['index', 'location'])
      const dontRedispatch = this.getConf('dontRedispatch') as string[]
      const gff = new TabixIndexedFile({
        filehandle: openLocation(gffGzLocation, this.pluginManager),
        ...openTabixIndexFilehandle(loc, indexType, this.pluginManager),
        chunkCacheSize: 50 * 2 ** 20,
      })
      this.configured = gff
        .getHeader()
        .then(header => ({
          gff,
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
        const fetchLines = (region: Region) => readLines(gff, region, opts)

        let lines = await fetchLines(query)

        // a feature found in the query (e.g. a gene) may extend beyond it; if
        // so, refetch the union of feature bounds once so parent/child
        // relationships resolve fully. dontRedispatch types (chromosome,
        // region, ...) are excluded so one chromosome-spanning feature can't
        // force a whole-chromosome refetch.
        const redispatch = lines.length
          ? calculateRedispatchRange(
              lines,
              dontRedispatchSet,
              query.start,
              query.end,
            )
          : undefined
        if (redispatch) {
          lines = await fetchLines({ ...query, ...redispatch })
        }

        // emit only top-level features intersecting the original query
        for (const feature of parseRecordsJBrowse(lines)) {
          if (
            doesIntersect2(feature.start, feature.end, query.start, query.end)
          ) {
            observer.next(
              new SimpleFeature({
                data: feature,
                id: `${this.id}-offset-${feature._lineHash}`,
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

function readLines(gff: TabixIndexedFile, query: Region, opts: BaseOptions) {
  const lines: LineRecord[] = []
  return downloadStatus(
    'Downloading features',
    opts.statusCallback,
    onProgress =>
      gff.getLines(query.refName, query.start, query.end, {
        lineCallback: (line, fileOffset, start, end) => {
          lines.push({
            line,
            lineHash: fileOffset,
            start,
            end,
            hasEscapes: line.includes('%'),
            type: extractType(line),
          })
        },
        onProgress,
      }),
  ).then(() => lines)
}
