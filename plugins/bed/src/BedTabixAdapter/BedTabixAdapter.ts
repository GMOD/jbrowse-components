import BED from '@gmod/bed'
import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

// locals
import { featureData } from '../util'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { FileLocation, Region, Feature } from '@jbrowse/core/util'

export default class BedTabixAdapter extends BaseFeatureDataAdapter {
  private parser: BED

  protected bed: TabixIndexedFile

  protected columnNames: string[]

  protected scoreColumn: string

  public static capabilities = ['getFeatures', 'getRefNames']

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

  async getHeader() {
    return this.bed.getHeader()
  }

  async getNames() {
    if (this.columnNames.length) {
      return this.columnNames
    }
    const header = await this.bed.getHeader()
    const defs = header.split(/\n|\r\n|\r/).filter(f => !!f)
    const defline = defs.at(-1)
    return defline?.includes('\t')
      ? defline
          .slice(1)
          .split('\t')
          .map(f => f.trim())
      : undefined
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const meta = await this.bed.getMetadata()
      const { columnNumbers } = meta
      const colRef = columnNumbers.ref - 1
      const colStart = columnNumbers.start - 1
      const colEnd = columnNumbers.end - 1
      const names = await this.getNames()
      await this.bed.getLines(query.refName, query.start, query.end, {
        lineCallback: (line, fileOffset) => {
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
        stopToken: opts.stopToken,
      })
      observer.complete()
    }, opts.stopToken)
  }

  public freeResources(): void {}
}
