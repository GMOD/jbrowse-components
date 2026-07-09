import BED from '@gmod/bed'
import { TabixIndexedFile } from '@gmod/tabix'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  SimpleFeature,
  downloadStatus,
  unzip,
  updateStatus,
} from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  checkStopToken2,
  checkStopToken,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { bedFeatureLocus, featureData, parseNamesFromHeader } from '../util.ts'

import type { BedTabixAdapterConfig } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature, FileLocation, Region } from '@jbrowse/core/util'

// 0-based column offsets + coordinate conventions derived from the tabix index
// metadata. `hasEndColumn` is false when the index has a begin but no end
// column (`-b` only, e.g. LocusZoom GWAS / point data, where end column is 0) —
// those features are a single position, so callers use end = start + 1.
function resolveBedColumns(
  metadata: Awaited<ReturnType<TabixIndexedFile['getMetadata']>>,
) {
  const { columnNumbers, coordinateType } = metadata
  return {
    colRef: columnNumbers.ref - 1,
    colStart: columnNumbers.start - 1,
    colEnd: columnNumbers.end - 1,
    hasEndColumn: columnNumbers.end > 0,
    oneBased: coordinateType === '1-based-closed',
  }
}

export default class BedTabixAdapter extends BaseFeatureDataAdapter<BedTabixAdapterConfig> {
  private parser: BED

  private readonly bedGzLoc: FileLocation

  protected bed: TabixIndexedFile

  public static capabilities = ['getFeatures', 'getRefNames']

  setupP?: Promise<Awaited<ReturnType<TabixIndexedFile['getMetadata']>>>

  public constructor(
    config: BedTabixAdapterConfig,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    this.bedGzLoc = readConfObject(this.config, 'bedGzLocation') as FileLocation
    const type = readConfObject(this.config, ['index', 'indexType'])
    const loc = readConfObject(this.config, ['index', 'location'])
    const pm = this.pluginManager

    this.bed = new TabixIndexedFile({
      filehandle: openLocation(this.bedGzLoc, pm),
      ...openTabixIndexFilehandle(loc, type, pm),
      chunkCacheSize: 50 * 2 ** 20,
    })
    this.parser = new BED({ autoSql: readConfObject(this.config, 'autoSql') })
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
    this.setupP ??= this.bed.getMetadata().catch((e: unknown) => {
      this.setupP = undefined
      throw e
    })
    return this.setupP
  }

  async getMetadata(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts ?? {}
    return updateStatus('Downloading index', statusCallback, () =>
      this.configure(),
    )
  }

  async getNames() {
    const columnNames: string[] = readConfObject(this.config, 'columnNames')
    if (columnNames.length) {
      return columnNames
    }
    return (
      parseNamesFromHeader(await this.getHeader()) ??
      (await this.parseSkipLineHeader())
    )
  }

  // When a tabix file uses skipLines (not #-comment) for its header,
  // getHeader() returns empty. Read the raw first bgzf block to recover names.
  private async parseSkipLineHeader(): Promise<string[] | undefined> {
    const { skipLines } = await this.configure()
    if (!skipLines) {
      return undefined
    }
    const buf = await openLocation(this.bedGzLoc, this.pluginManager).read(
      65536,
      0,
    )
    const text = new TextDecoder().decode(await unzip(buf))
    const lines = text.split(/\n|\r\n|\r/).filter(Boolean)
    const defline = lines[skipLines - 1]
    return defline?.includes('\t')
      ? defline.split('\t').map(f => f.trim())
      : undefined
  }

  public getFeatures(query: Region, opts?: BaseOptions) {
    const { stopToken, statusCallback = () => {} } = opts ?? {}
    return ObservableCreate<Feature>(async observer => {
      const { colRef, colStart, colEnd, hasEndColumn, oneBased } =
        resolveBedColumns(await this.getMetadata())
      const names = await this.getNames()
      const scoreColumn = readConfObject(this.config, 'scoreColumn')
      const disableGeneHeuristic = readConfObject(
        this.config,
        'disableGeneHeuristic',
      )
      const stopTokenCheck = createStopTokenChecker(stopToken)
      checkStopToken(stopToken)
      await downloadStatus('Downloading features', statusCallback, onProgress =>
        this.bed.getLines(query.refName, query.start, query.end, {
          lineCallback: (line, fileOffset) => {
            checkStopToken2(stopTokenCheck)
            const splitLine = line.split('\t')
            observer.next(
              new SimpleFeature(
                featureData({
                  splitLine,
                  ...bedFeatureLocus({
                    splitLine,
                    colRef,
                    colStart,
                    colEnd,
                    oneBased,
                    hasEndColumn,
                  }),
                  scoreColumn,
                  parser: this.parser,
                  uniqueId: `${this.id}-${fileOffset}`,
                  names,
                  disableGeneHeuristic,
                }),
              ),
            )
          },
          onProgress,
        }),
      )
      observer.complete()
    }, stopToken)
  }
}
