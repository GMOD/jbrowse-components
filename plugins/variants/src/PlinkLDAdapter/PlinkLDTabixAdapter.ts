import { TabixIndexedFile } from '@gmod/tabix'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { parsePlinkLDLine, resolvePlinkLDHeader } from '@jbrowse/ld-core'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'
import type { PlinkLDHeader, PlinkLDRecord } from '@jbrowse/ld-core'

export default class PlinkLDTabixAdapter extends BaseAdapter {
  private configured?: Promise<{
    ld: TabixIndexedFile
    header: PlinkLDHeader
  }>

  private async configurePre(_opts?: BaseOptions) {
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

  protected async configurePre2() {
    this.configured ??= this.configurePre().catch((e: unknown) => {
      this.configured = undefined
      throw e
    })
    return this.configured
  }

  async configure(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts ?? {}
    return updateStatus('Downloading index', statusCallback, () =>
      this.configurePre2(),
    )
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { ld } = await this.configure(opts)
    return ld.getReferenceSequenceNames(opts)
  }

  async getHeader(opts?: BaseOptions) {
    const { header } = await this.configure(opts)
    return header
  }

  /**
   * Get LD records where the first SNP (A) falls within the query region.
   * Caller should additionally filter for snpB being in region if needed.
   */
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

  /**
   * Get LD records where BOTH SNPs fall within the query region.
   * This is what's needed for the LD triangle display.
   */
  public async getLDRecordsInRegion(
    query: NoAssemblyRegion,
    opts: BaseOptions = {},
  ): Promise<PlinkLDRecord[]> {
    const { refName, start, end } = query
    const records = await this.getLDRecords(query, opts)

    return records.filter(
      r =>
        r.chrB === refName &&
        r.bpB >= start &&
        r.bpB <= end &&
        r.chrA === refName &&
        r.bpA >= start &&
        r.bpA <= end,
    )
  }
}
