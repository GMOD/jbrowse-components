import { TabixIndexedFile } from '@gmod/tabix'
import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadStatus } from '@jbrowse/core/util'
import { sharedBgzfWorkerPool } from '@jbrowse/core/util/bgzfWorkerPool'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { withStopTokenSignal } from '@jbrowse/core/util/stopToken'
import { readTabixHeaderLines } from '@jbrowse/core/util/tabix'

import { makeBedGraphFeature } from '../bedGraphUtil.ts'
import { parseNamesFromHeader } from '../util.ts'

import type { BedGraphTabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class BedGraphTabixAdapter extends BaseFeatureDataAdapter<BedGraphTabixAdapterConfig> {
  // `label` because the index setup narrates nothing itself; the helper shows
  // it only while the first attempt is in flight, so pan/zoom re-entry (every
  // getFeatures/byte-estimate awaits it) doesn't re-flash "Downloading index"
  protected configure = cachedSetup({
    label: 'Downloading index',
    setup: () => this.configurePre(),
  })

  private async configurePre() {
    const pm = this.pluginManager
    const bedGraphGzLocation = this.getConf('bedGraphGzLocation')
    const location = this.getConf(['index', 'location'])
    const indexType = this.getConf(['index', 'indexType'])

    const bedGraph = new TabixIndexedFile({
      filehandle: openLocation(bedGraphGzLocation, pm),
      ...openTabixIndexFilehandle(location, indexType, pm),
      chunkCacheBudget: decompressedBytesBudget,
      bgzfWorkerPool: sharedBgzfWorkerPool(),
    })
    const columnNames = this.getConf('columnNames')

    // Not bedGraph.getHeader(): that returns only a `#`-commented header, so a
    // file whose header is a plain row skipped via `tabix -S 1` reported none
    // and quietly lost the names of its value columns.
    const header = (await readTabixHeaderLines(bedGraph)).join('\n')
    return {
      columnNames,
      bedGraph,
      header,
    }
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
      await withStopTokenSignal(opts.stopToken, signal =>
        downloadStatus(
          'Downloading features',
          opts.statusCallback,
          onProgress =>
            // `same` is a single-coordinate file — a GWAS-style txt with only a
            // start column, indexed `-b N -e N`. The widening is not slop: the
            // column value is used below as an interbase start (point p is
            // drawn at [p, p+1)), while the index reads that same column as a
            // 1-based position and places the record at [p-1, p). getLines
            // filters on the index's view, so the point at exactly query.start
            // — visible at the left edge of the view — is one the query would
            // otherwise not ask for. Widening by a base is what asks for it.
            //
            // For a file indexed `-0`, the two views agree and this instead
            // pulls in one extra point just left of the view, which is
            // harmless.
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
                signal,
              },
            ),
        ),
      )
      observer.complete()
    }, opts.stopToken)
  }
}
