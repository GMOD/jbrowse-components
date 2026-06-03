import BED from '@gmod/bed'
import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, updateStatus } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  checkStopToken2,
  checkStopToken,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { featureData, parseNamesFromHeader } from '../util.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature, FileLocation, Region } from '@jbrowse/core/util'

export default class BedTabixAdapter extends BaseFeatureDataAdapter {
  private parser: BED

  protected bed: TabixIndexedFile

  public static capabilities = ['getFeatures', 'getRefNames']

  setupP?: Promise<Awaited<ReturnType<TabixIndexedFile['getMetadata']>>>

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const bedGzLoc = this.getConf('bedGzLocation') as FileLocation
    const type = this.getConf(['index', 'indexType'])
    const loc = this.getConf(['index', 'location'])
    const pm = this.pluginManager

    this.bed = new TabixIndexedFile({
      filehandle: openLocation(bedGzLoc, pm),
      ...openTabixIndexFilehandle(loc, type, pm),
      chunkCacheSize: 50 * 2 ** 20,
    })
    this.parser = new BED({ autoSql: this.getConf('autoSql') })
  }

  public async getRefNames(opts: BaseOptions = {}) {
    return this.bed.getReferenceSequenceNames(opts)
  }

  async getHeader(opts?: BaseOptions) {
    return this.bed.getHeader(opts)
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
    const columnNames: string[] = this.getConf('columnNames')
    if (columnNames.length) {
      return columnNames
    }
    return parseNamesFromHeader(await this.getHeader())
  }

  public getFeatures(query: Region, opts?: BaseOptions) {
    const { stopToken, statusCallback = () => {} } = opts ?? {}
    return ObservableCreate<Feature>(async observer => {
      const { columnNumbers, coordinateType } = await this.getMetadata()
      const colRef = columnNumbers.ref - 1
      const colStart = columnNumbers.start - 1
      const colEnd = columnNumbers.end - 1
      const oneBased = coordinateType === '1-based-closed'
      const names = await this.getNames()
      const scoreColumn: string = this.getConf('scoreColumn')
      const disableGeneHeuristic: boolean = this.getConf('disableGeneHeuristic')
      const stopTokenCheck = createStopTokenChecker(stopToken)
      checkStopToken(stopToken)
      await updateStatus('Downloading features', statusCallback, () =>
        this.bed.getLines(query.refName, query.start, query.end, {
          lineCallback: (line, fileOffset) => {
            checkStopToken2(stopTokenCheck)
            const splitLine = line.split('\t')
            observer.next(
              new SimpleFeature(
                featureData({
                  splitLine,
                  refName: splitLine[colRef]!,
                  start: +splitLine[colStart]! - (oneBased ? 1 : 0),
                  end: +splitLine[colEnd]! + (colStart === colEnd && !oneBased ? 1 : 0),
                  scoreColumn,
                  parser: this.parser,
                  uniqueId: `${this.id}-${fileOffset}`,
                  names,
                  disableGeneHeuristic,
                }),
              ),
            )
          },
        }),
      )
      observer.complete()
    }, stopToken)
  }
}
