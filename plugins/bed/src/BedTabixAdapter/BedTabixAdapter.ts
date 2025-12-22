import BED from '@gmod/bed'
import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { featureData } from '../util'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature, FileLocation, Region } from '@jbrowse/core/util'

export default class BedTabixAdapter extends BaseFeatureDataAdapter {
  private parser: BED

  protected bed: TabixIndexedFile

  protected columnNames: string[]

  protected scoreColumn: string

  public static capabilities = ['getFeatures', 'getRefNames']

  setupP?: Promise<{
    meta: Awaited<ReturnType<TabixIndexedFile['getMetadata']>>
  }>

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const bedGzLoc = this.getConf('bedGzLocation') as FileLocation
    const type = this.getConf(['index', 'indexType'])
    const loc = this.getConf(['index', 'location'])
    const autoSql = this.getConf('autoSql')
    const pm = this.pluginManager

    this.bed = new TabixIndexedFile({
      filehandle: openLocation(bedGzLoc, pm),
      csiFilehandle: type === 'CSI' ? openLocation(loc, pm) : undefined,
      tbiFilehandle: type !== 'CSI' ? openLocation(loc, pm) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
    })
    this.columnNames = this.getConf('columnNames')
    this.scoreColumn = this.getConf('scoreColumn')
    this.parser = new BED({ autoSql })
  }

  public async getRefNames(opts: BaseOptions = {}) {
    return this.bed.getReferenceSequenceNames(opts)
  }

  async getHeader(opts?: BaseOptions) {
    return this.bed.getHeader(opts)
  }

  async getMetadataPre2(_opts?: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.getMetadataPre().catch((e: unknown) => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  async getMetadataPre() {
    const meta = await this.bed.getMetadata()
    return { meta }
  }

  async getMetadata(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    return updateStatus('Downloading index', statusCallback, () =>
      this.getMetadataPre2(opts),
    )
  }

  async getNames() {
    if (this.columnNames.length) {
      return this.columnNames
    }
    const header = await this.getHeader()
    const defs = header.split(/\n|\r\n|\r/).filter(f => !!f)
    const defline = defs.at(-1)
    return defline?.includes('\t')
      ? defline
          .slice(1)
          .split('\t')
          .map(f => f.trim())
      : undefined
  }

  public getFeatures(query: Region, opts?: BaseOptions) {
    const { stopToken, statusCallback = () => {} } = opts || {}
    return ObservableCreate<Feature>(async observer => {
      const { meta } = await this.getMetadata()
      const { columnNumbers } = meta
      const colRef = columnNumbers.ref - 1
      const colStart = columnNumbers.start - 1
      const colEnd = columnNumbers.end - 1
      const names = await this.getNames()
      let start = performance.now()
      checkStopToken(stopToken)
      await updateStatus('Downloading features', statusCallback, () =>
        this.bed.getLines(query.refName, query.start, query.end, {
          lineCallback: (line, fileOffset) => {
            if (performance.now() - start > 500) {
              checkStopToken(stopToken)
              start = performance.now()
            }
            observer.next(
              new SimpleFeature(
                featureData({
                  line,
                  colRef,
                  colStart,
                  colEnd,
                  scoreColumn: this.scoreColumn,
                  parser: this.parser,
                  uniqueId: `${this.id}-${fileOffset}`,
                  names,
                }),
              ),
            )
          },
          stopToken,
        }),
      )
      observer.complete()
    }, stopToken)
  }
}
