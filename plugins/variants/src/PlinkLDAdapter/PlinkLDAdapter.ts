import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzipText, updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { parsePlinkLDLine, resolvePlinkLDHeader } from '@jbrowse/ld-core'

import { filterRecordsInRegion } from './filterRecordsInRegion.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'
import type {
  LDRecordSource,
  PlinkLDHeader,
  PlinkLDRecord,
} from '@jbrowse/ld-core'

export default class PlinkLDAdapter
  extends BaseAdapter
  implements LDRecordSource
{
  private configured?: Promise<{
    records: PlinkLDRecord[]
    header: PlinkLDHeader
    refNames: string[]
  }>

  private async configurePre(opts?: BaseOptions) {
    const ldLocation = this.getConf('ldLocation')
    const text = await fetchAndMaybeUnzipText(
      openLocation(ldLocation, this.pluginManager),
      opts,
    )
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length === 0) {
      throw new Error('Empty LD file')
    }

    // Headerless (LocusZoom-style) files fall back to default PLINK columns
    // and keep line 0 as data; a real header is parsed and skipped.
    const { header, isHeaderLine } = resolvePlinkLDHeader(lines[0]!)

    const records: PlinkLDRecord[] = []
    const refNamesSet = new Set<string>()

    for (let i = isHeaderLine ? 1 : 0; i < lines.length; i++) {
      const record = parsePlinkLDLine(lines[i]!, header)
      if (record) {
        records.push(record)
        refNamesSet.add(record.chrA)
        refNamesSet.add(record.chrB)
      }
    }

    const refNames = [...refNamesSet].sort()
    return { records, header, refNames }
  }

  protected async configurePre2(opts?: BaseOptions) {
    this.configured ??= this.configurePre(opts).catch((e: unknown) => {
      this.configured = undefined
      throw e
    })
    return this.configured
  }

  async configure(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts ?? {}
    return updateStatus('Loading LD data', statusCallback, () =>
      this.configurePre2(opts),
    )
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { refNames } = await this.configure(opts)
    return refNames
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
    const { records } = await this.configure(opts)
    return records.filter(
      r => r.chrA === refName && r.bpA >= start && r.bpA <= end,
    )
  }

  /**
   * Get LD records where BOTH SNPs fall within the query region.
   * This is what's needed for the LD triangle display.
   */
  public async getLDRecordsInRegion(
    query: NoAssemblyRegion,
    opts: BaseOptions = {},
  ): Promise<PlinkLDRecord[]> {
    return filterRecordsInRegion(await this.getLDRecords(query, opts), query)
  }
}
