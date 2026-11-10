import { TabixIndexedFile } from '@gmod/tabix'
import { sharedBgzfWorkerPool } from '@jbrowse/core/util/bgzfWorkerPool'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import {
  DEFAULT_PLINK_LD_HEADER,
  parsePlinkLDLine,
  resolvePlinkLDHeader,
} from '@jbrowse/ld-core'

import { PlinkLDAdapterBase } from './PlinkLDAdapterBase.ts'

import type { PlinkLDTabixAdapterConfig } from './configSchemaTabix.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'
import type { PlinkLDHeader, PlinkLDRecord } from '@jbrowse/ld-core'

interface Config {
  ld: TabixIndexedFile
  header: PlinkLDHeader
}

export default class PlinkLDTabixAdapter extends PlinkLDAdapterBase<
  Config,
  PlinkLDTabixAdapterConfig
> {
  // set once the file is open, for dataAdapterCache's eviction to clear
  private file?: TabixIndexedFile

  freeResources() {
    this.file?.clearChunkCache()
  }

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
    this.file = ld

    // The column layout decides whether the file's D' column is found at all,
    // so `encoding.color.field: 'dprime'` lives or dies here.
    //
    // Every line getHeaderLines returns is a header by declaration —
    // either the index's meta character marked it, or the index's skipLines
    // counted it — so no data row is pattern-matched: that guess misfires on
    // a headerless file whose chromosome column reads `CHR1`. The last line
    // is the column defline; a commented preamble may sit above it. One
    // naming the position columns is the layout, and throws where it names
    // no r² or D′, as `plink --r`'s signed `R` does; any other comment
    // leaves the default layout.
    const defline = (await ld.getHeaderLines()).at(-1)
    const header = defline
      ? resolvePlinkLDHeader(defline).header
      : DEFAULT_PLINK_LD_HEADER
    return { ld, header }
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { ld } = await this.configure(opts)
    return ld.getReferenceSequenceNames(opts)
  }

  async getRegionByteSize(regions: NoAssemblyRegion[], opts?: BaseOptions) {
    const { ld } = await this.configure(opts)
    return ld.bytesForRegions(regions, opts)
  }

  public async getLDRecords(
    query: NoAssemblyRegion,
    opts: BaseOptions = {},
  ): Promise<PlinkLDRecord[]> {
    const { refName, start, end } = query
    const { ld, header } = await this.configure(opts)

    const records: PlinkLDRecord[] = []

    await ld.getLines(refName, start, end, {
      lineCallback: (line: string) => {
        const record = parsePlinkLDLine(line, header)
        if (record) {
          records.push(record)
        }
      },
      ...opts,
    })

    return records
  }
}
