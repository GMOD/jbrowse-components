import { TabixIndexedFile } from '@gmod/tabix'
import { sharedBgzfWorkerPool } from '@jbrowse/core/util/bgzfWorkerPool'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { withStopTokenSignal } from '@jbrowse/core/util/stopToken'
import { readTabixHeaderLines } from '@jbrowse/core/util/tabix'
import {
  DEFAULT_PLINK_LD_HEADER,
  parsePlinkLDHeader,
  parsePlinkLDLine,
} from '@jbrowse/ld-core'

import { PlinkLDAdapterBase } from './PlinkLDAdapterBase.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'
import type { PlinkLDHeader, PlinkLDRecord } from '@jbrowse/ld-core'

interface Config {
  ld: TabixIndexedFile
  header: PlinkLDHeader
}

export default class PlinkLDTabixAdapter extends PlinkLDAdapterBase<Config> {
  protected statusLabel() {
    return 'Downloading index'
  }

  protected async loadConfig(): Promise<Config> {
    const ldLocation = this.getConf('ldLocation')
    const location = this.getConf(['index', 'location'])
    const indexType = this.getConf(['index', 'indexType'])

    const ld = new TabixIndexedFile({
      filehandle: openLocation(ldLocation, this.pluginManager),
      ...openTabixIndexFilehandle(location, indexType, this.pluginManager),
      chunkCacheBudget: decompressedBytesBudget,
      bgzfWorkerPool: sharedBgzfWorkerPool(),
    })

    // The column layout decides whether the file's D' column is found at all,
    // so `ldMetric: 'dprime'` lives or dies here.
    //
    // Every line readTabixHeaderLines returns is a header by declaration —
    // either the index's meta character marked it, or the index's skipLines
    // counted it — so it is parsed as one rather than pattern-matched. Content
    // matching is a guess, and it is one that misfires on a headerless file
    // whose chromosome column reads `CHR1`. The last line is the column
    // defline; a commented preamble may sit above it.
    const defline = (await readTabixHeaderLines(ld)).at(-1)
    let header = DEFAULT_PLINK_LD_HEADER
    if (defline) {
      try {
        header = parsePlinkLDHeader(defline)
      } catch {
        // a declared header this does not recognize: the default layout still
        // finds the position and r² columns
      }
    }

    return { ld, header }
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { ld } = await this.configure(opts)
    return ld.getReferenceSequenceNames(opts)
  }

  public async getLDRecords(
    query: NoAssemblyRegion,
    opts: BaseOptions = {},
  ): Promise<PlinkLDRecord[]> {
    const { refName, start, end } = query
    const { ld, header } = await this.configure(opts)

    const records: PlinkLDRecord[] = []

    await withStopTokenSignal(opts.stopToken, signal =>
      ld.getLines(refName, start, end, {
        lineCallback: (line: string) => {
          const record = parsePlinkLDLine(line, header)
          if (record) {
            records.push(record)
          }
        },
        ...opts,
        signal,
      }),
    )

    return records
  }
}
