import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, downloadStatus, updateStatus } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { calculateRedispatchRange } from '@jbrowse/core/util/range'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import {
  aggregateGtfFeatures,
  extractType,
  parseGtfToFeatures,
} from '../util.ts'

import type { GtfLineRecord } from '../util.ts'
import type { GtfTabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

// The parser only reads `line`; the extra fields are ours. `offset` (the tabix
// byte offset) mints a stable per-feature id that survives redispatch and
// panning, and start/end/type feed the redispatch calculation that runs before
// any line is parsed.
interface GtfLine extends GtfLineRecord {
  offset: number
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

  // true once the index has finished downloading; gates the status label so
  // pan/zoom re-entry into configure() doesn't re-flash "Downloading index"
  private configureReady = false

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
        .then(header => {
          this.configureReady = true
          return {
            gtf,
            dontRedispatchSet: new Set(dontRedispatch),
            header,
          }
        })
        .catch((e: unknown) => {
          this.configured = undefined
          throw e
        })
    }
    return this.configured
  }

  // Show "Downloading index" only while the index is genuinely downloading. Once
  // configured, callers (every getFeatures/byte-estimate on pan/zoom) await the
  // cached promise silently rather than re-flashing the label.
  async configure(opts?: BaseOptions) {
    return this.configureReady
      ? this.configureOnce()
      : updateStatus('Downloading index', opts?.statusCallback, () =>
          this.configureOnce(),
        )
  }

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
        const fetchLines = (region: Region) => readLines(gtf, region, opts)

        let lines = await fetchLines(query)

        // gene/transcript lines span their children, so if a feature extends
        // past the query, refetch the union of feature bounds once to pull in
        // child features (exon/CDS) that fall outside it. dontRedispatch types
        // (chromosome, region, ...) are excluded so one chromosome-spanning
        // feature can't force a whole-chromosome refetch.
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

function readLines(gtf: TabixIndexedFile, query: Region, opts: BaseOptions) {
  const lines: GtfLine[] = []
  return downloadStatus(
    'Downloading features',
    opts.statusCallback,
    onProgress =>
      gtf.getLines(query.refName, query.start, query.end, {
        lineCallback: (line, fileOffset, start, end) => {
          lines.push({
            line,
            offset: fileOffset,
            start,
            end,
            type: extractType(line),
          })
        },
        onProgress,
      }),
  ).then(() => lines)
}
