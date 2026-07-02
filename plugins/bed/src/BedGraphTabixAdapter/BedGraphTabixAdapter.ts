import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadStatus, updateStatus } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { makeBedGraphFeature } from '../bedGraphUtil.ts'
import { parseNamesFromHeader } from '../util.ts'

import type { BedGraphTabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BedGraphTabixAdapter extends BaseFeatureDataAdapter<BedGraphTabixAdapterConfig> {
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

    const bedGraph = new TabixIndexedFile({
      filehandle: openLocation(bedGraphGzLocation, pm),
      ...openTabixIndexFilehandle(location, indexType, pm),
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

  private async configureOnce() {
    this.configured ??= this.configurePre().catch((e: unknown) => {
      this.configured = undefined
      throw e
    })
    return this.configured
  }

  protected async configure(opts?: BaseOptions) {
    return updateStatus('Downloading index', opts?.statusCallback, () =>
      this.configureOnce(),
    )
  }

  async getNames() {
    const { header, columnNames } = await this.configure()
    return columnNames.length ? columnNames : parseNamesFromHeader(header)
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { bedGraph } = await this.configure(opts)
    return downloadStatus(
      'Downloading index',
      opts.statusCallback,
      onProgress => bedGraph.getReferenceSequenceNames({ ...opts, onProgress }),
    )
  }

  async getHeader() {
    const { header } = await this.configure()
    return header
  }

  public getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { bedGraph } = await this.configure(opts)
      const meta = await bedGraph.getMetadata()
      const { columnNumbers } = meta
      const colRef = columnNumbers.ref - 1
      const colStart = columnNumbers.start - 1
      const colEnd = columnNumbers.end - 1
      const same = colStart === colEnd
      const names = (await this.getNames())?.slice(same ? 2 : 3) ?? []
      await downloadStatus(
        'Downloading features',
        opts.statusCallback,
        onProgress =>
          bedGraph.getLines(
            query.refName,
            query.start + (same ? -1 : 0),
            query.end,
            {
              lineCallback: (line, fileOffset) => {
                const cols = line.split('\t')
                const refName = cols[colRef]!
                const start = +cols[colStart]!
                const end = +(same ? start + 1 : cols[colEnd]!)
                const rest = cols.slice(colEnd + 1)
                if (Number.isNaN(start) || Number.isNaN(end)) {
                  throw new Error(
                    `start/end NaN on line "${line}", with colStart:${colStart} and colEnd:${colEnd}. run "tabix -p bed" to ensure bed preset`,
                  )
                }

                for (let j = 0; j < rest.length; j++) {
                  const feat = makeBedGraphFeature({
                    uniqueId: `${this.id}-${fileOffset}-${j}`,
                    refName,
                    start,
                    end,
                    names,
                    j,
                    value: rest[j]!,
                  })
                  if (feat) {
                    observer.next(feat)
                  }
                }
              },
              ...opts,
              onProgress,
            },
          ),
      )
      observer.complete()
    }, opts.stopToken)
  }
}
