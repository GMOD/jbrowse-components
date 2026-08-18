import { TabixIndexedFile } from '@gmod/tabix'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, downloadStatus, updateStatus } from '@jbrowse/core/util'
import { sharedBgzfWorkerPool } from '@jbrowse/core/util/bgzfWorkerPool'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  checkStopTokenThrottled,
  checkStopToken,
  createStopTokenChecker,
  withStopTokenSignal,
} from '@jbrowse/core/util/stopToken'
import { readTabixHeaderLines } from '@jbrowse/core/util/tabix'

import { featureData, makeParser, parseNamesFromHeader } from '../util.ts'

import type { BedTabixAdapterConfig } from './configSchema.ts'
import type BED from '@gmod/bed'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature, FileLocation, Region } from '@jbrowse/core/util'

export default class BedTabixAdapter extends BaseFeatureDataAdapter<BedTabixAdapterConfig> {
  // the parser needs the column names, which come from the file's header, so
  // it cannot be built in the constructor
  private parserP?: Promise<BED>

  private readonly bedGzLoc: FileLocation

  protected bed: TabixIndexedFile

  public static capabilities = ['getFeatures', 'getRefNames']

  setupP?: Promise<Awaited<ReturnType<TabixIndexedFile['getMetadata']>>>

  // undefined when the file declares no column names — parseNamesFromHeader's
  // answer for a header it can't read names out of
  private namesP?: Promise<string[] | undefined>

  // true once the index metadata has downloaded; gates the status label so
  // pan/zoom re-entry into getMetadata() doesn't re-flash "Downloading index"
  private setupReady = false

  public constructor(
    config: BedTabixAdapterConfig,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    this.bedGzLoc = readConfObject(this.config, 'bedGzLocation')
    const type = readConfObject(this.config, ['index', 'indexType'])
    const loc = readConfObject(this.config, ['index', 'location'])
    const pm = this.pluginManager

    this.bed = new TabixIndexedFile({
      filehandle: openLocation(this.bedGzLoc, pm),
      ...openTabixIndexFilehandle(loc, type, pm),
      chunkCacheBudget: decompressedBytesBudget,
      bgzfWorkerPool: sharedBgzfWorkerPool(),
    })
  }

  public async getRefNames(opts: BaseOptions = {}) {
    return downloadStatus(
      'Downloading index',
      opts.statusCallback,
      onProgress => this.bed.getReferenceSequenceNames({ ...opts, onProgress }),
    )
  }

  async getHeader(opts?: BaseOptions) {
    return this.bed.getHeader(opts)
  }

  /**
   * Estimate compressed bytes for regions straight from the tabix index — no
   * feature download. Lets wrapping adapters (e.g. MafTabix) byte-budget a
   * fetch before pulling the (potentially huge) per-line payload.
   */
  async getRegionByteSize(regions: Region[], opts?: BaseOptions) {
    return this.bed.bytesForRegions(regions, opts)
  }

  private async configure() {
    this.setupP ??= this.bed
      .getMetadata()
      .then(metadata => {
        this.setupReady = true
        return metadata
      })
      .catch((e: unknown) => {
        this.setupP = undefined
        throw e
      })
    return this.setupP
  }

  // Show "Downloading index" only while the index metadata is genuinely
  // downloading. Once loaded, callers (every getFeatures on pan/zoom) await the
  // cached promise silently rather than re-flashing the label.
  async getMetadata(opts?: BaseOptions) {
    const { statusCallback } = opts ?? {}
    return this.setupReady
      ? this.configure()
      : updateStatus('Downloading index', statusCallback, () =>
          this.configure(),
        )
  }

  // Memoized: getFeatures needs the names on every query, and reading them goes
  // to the file's leading blocks — a fetch and a decompress that was being
  // repeated on every pan and zoom.
  async getNames() {
    this.namesP ??= this.readNames().catch((e: unknown) => {
      this.namesP = undefined
      throw e
    })
    return this.namesP
  }

  private async getParser() {
    this.parserP ??= this.getNames()
      .then(columnNames =>
        makeParser({
          autoSql: readConfObject(this.config, 'autoSql'),
          columnNames,
        }),
      )
      .catch((e: unknown) => {
        this.parserP = undefined
        throw e
      })
    return this.parserP
  }

  private async readNames() {
    const columnNames: string[] = readConfObject(this.config, 'columnNames')
    if (columnNames.length) {
      return columnNames
    }
    // readTabixHeaderLines covers both ways a tabix file keeps a header: a
    // `#`-commented block, which getHeader() returns, and a plain row skipped
    // via `tabix -S N`, which it does not.
    return parseNamesFromHeader(
      (await readTabixHeaderLines(this.bed)).join('\n'),
    )
  }

  public getFeatures(query: Region, opts?: BaseOptions) {
    const { stopToken, statusCallback } = opts ?? {}
    return ObservableCreate<Feature>(async observer => {
      // warms the index under its own status label — getLines would otherwise
      // download it under "Downloading features"
      await this.getMetadata()
      const names = await this.getNames()
      const parser = await this.getParser()
      const scoreColumn = readConfObject(this.config, 'scoreColumn')
      const disableGeneHeuristic = readConfObject(
        this.config,
        'disableGeneHeuristic',
      )
      const stopTokenCheck = createStopTokenChecker(stopToken)
      checkStopToken(stopToken)
      await withStopTokenSignal(stopToken, signal =>
        downloadStatus('Downloading features', statusCallback, onProgress =>
          // start/end come from @gmod/tabix rather than being re-derived from
          // the line: it located the coordinate columns to find these lines at
          // all, and already applied the index's coordinate offset (-1 for a
          // 1-based-closed preset) and its no-end-column convention (a single
          // position becomes start..start+1). refName is likewise the query's
          // — getLines only calls back for lines whose ref column matches it.
          this.bed.getLines(query.refName, query.start, query.end, {
            lineCallback: (line, fileOffset, start, end) => {
              checkStopTokenThrottled(stopTokenCheck)
              const splitLine = line.split('\t')
              observer.next(
                new SimpleFeature(
                  featureData({
                    splitLine,
                    refName: query.refName,
                    start,
                    end,
                    scoreColumn,
                    parser,
                    uniqueId: `${this.id}-${fileOffset}`,
                    names,
                    disableGeneHeuristic,
                  }),
                ),
              )
            },
            onProgress,
            signal,
          }),
        ),
      )
      observer.complete()
    }, stopToken)
  }
}
