import { TabixIndexedFile } from '@gmod/tabix'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { parsePlinkLDLine, resolvePlinkLDHeader } from '@jbrowse/ld-core'

import { PlinkLDAdapterBase } from './PlinkLDAdapterBase.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'
import type { PlinkLDHeader, PlinkLDRecord } from '@jbrowse/ld-core'

interface Config {
  ld: TabixIndexedFile
  header: PlinkLDHeader
}

export default class PlinkLDTabixAdapter extends PlinkLDAdapterBase<Config> {
  protected statusLabel = 'Downloading index'

  protected async loadConfig(): Promise<Config> {
    const ldLocation = this.getConf('ldLocation')
    const location = this.getConf(['index', 'location'])
    const indexType = this.getConf(['index', 'indexType'])

    const ld = new TabixIndexedFile({
      filehandle: openLocation(ldLocation, this.pluginManager),
      ...openTabixIndexFilehandle(location, indexType, this.pluginManager),
      chunkCacheSize: 50 * 2 ** 20,
    })

    // LocusZoom-style files ship without a header row (getHeader returns ''),
    // so fall back to the default PLINK column order. tabix already skips any
    // real `#`/`-S` header, so getLines only yields data rows either way.
    const { header } = resolvePlinkLDHeader(await ld.getHeader())

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
