import { fetchAndMaybeUnzipText } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { parsePlinkLDLine, resolvePlinkLDHeader } from '@jbrowse/ld-core'

import { PlinkLDAdapterBase } from './PlinkLDAdapterBase.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'
import type { PlinkLDHeader, PlinkLDRecord } from '@jbrowse/ld-core'

interface Config {
  records: PlinkLDRecord[]
  header: PlinkLDHeader
  refNames: string[]
}

export default class PlinkLDAdapter extends PlinkLDAdapterBase<Config> {
  protected statusLabel = 'Downloading LD data'

  protected async loadConfig(opts?: BaseOptions): Promise<Config> {
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

  public async getRefNames(opts: BaseOptions = {}) {
    const { refNames } = await this.configure(opts)
    return refNames
  }

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
}
