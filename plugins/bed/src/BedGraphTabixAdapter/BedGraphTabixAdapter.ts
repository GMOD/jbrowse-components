import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BedGraphAdapter extends BaseFeatureDataAdapter {
  private configured?: Promise<{
    bedGraph: TabixIndexedFile
    header: string
    columnNames: string[]
  }>

  private async configurePre() {
    const pm = this.pluginManager
    const bedGraphGzLocation = this.getConf('bedGraphGzLocation')
    const location = this.getConf(['index', 'location'])
    const indexType = this.getConf(['index', 'indexType'])

    const filehandle = openLocation(bedGraphGzLocation, pm)
    const isCSI = indexType === 'CSI'
    const bedGraph = new TabixIndexedFile({
      filehandle,
      csiFilehandle: isCSI ? openLocation(location, pm) : undefined,
      tbiFilehandle: !isCSI ? openLocation(location, pm) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
    })
    const columnNames = this.getConf('columnNames')

    const header = await bedGraph.getHeader()
    return {
      columnNames,
      bedGraph,
      header,
    }
  }

  protected async configure() {
    if (!this.configured) {
      this.configured = this.configurePre().catch((e: unknown) => {
        this.configured = undefined
        throw e
      })
    }
    return this.configured
  }

  async getNames() {
    const { bedGraph, columnNames } = await this.configure()
    if (columnNames.length) {
      return columnNames
    }
    const header = await bedGraph.getHeader()
    const defs = header.split(/\n|\r\n|\r/).filter(f => !!f)
    const defline = defs.at(-1)
    return defline?.includes('\t')
      ? defline
          .slice(1)
          .split('\t')
          .map(f => f.trim())
      : undefined
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { bedGraph } = await this.configure()
    return bedGraph.getReferenceSequenceNames(opts)
  }

  async getHeader() {
    const { bedGraph } = await this.configure()
    return bedGraph.getHeader()
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { refName, start, end } = query
      const { bedGraph } = await this.configure()
      const names = (await this.getNames())?.slice(3) || []
      await bedGraph.getLines(refName, start, end, {
        lineCallback: (line, fileOffset) => {
          const [refName, s, e, ...rest] = line.split('\t')
          for (let j = 0; j < rest.length; j++) {
            const uniqueId = `${this.id}-${fileOffset}-${j}`
            const start = +s!
            const end = +e!
            const score = +rest[j]!
            const source = names[j] || `col${j}`
            if (score) {
              observer.next(
                new SimpleFeature({
                  id: uniqueId,
                  data: {
                    refName,
                    start,
                    end,
                    score,
                    source,
                  },
                }),
              )
            }
          }
        },
        ...opts,
      })
      observer.complete()
    })
  }

  public freeResources(): void {}
}
