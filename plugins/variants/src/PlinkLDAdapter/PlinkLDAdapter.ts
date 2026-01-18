import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzipText, updateStatus } from '@jbrowse/core/util'

import type { PlinkLDHeader, PlinkLDRecord } from './types.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class PlinkLDAdapter extends BaseAdapter {
  private configured?: Promise<{
    records: PlinkLDRecord[]
    header: PlinkLDHeader
    refNames: string[]
  }>

  private async configurePre(opts?: BaseOptions) {
    const ldLocation = this.getConf('ldLocation')
    const text = await fetchAndMaybeUnzipText(ldLocation, opts)
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length === 0) {
      throw new Error('Empty LD file')
    }

    const header = this.parseHeader(lines[0]!)

    const records: PlinkLDRecord[] = []
    const refNamesSet = new Set<string>()

    for (let i = 1; i < lines.length; i++) {
      const record = this.parseLine(lines[i]!, header)
      if (record) {
        records.push(record)
        refNamesSet.add(record.chrA)
        refNamesSet.add(record.chrB)
      }
    }

    const refNames = [...refNamesSet].sort()
    return { records, header, refNames }
  }

  private parseHeader(headerLine: string): PlinkLDHeader {
    // PLINK header looks like: CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2
    // With optional: DP, MAF_A, MAF_B, PHASE
    const columns = headerLine.trim().split(/\s+/)

    const findIdx = (names: string[]) => {
      for (const name of names) {
        const idx = columns.indexOf(name)
        if (idx !== -1) {
          return idx
        }
      }
      return -1
    }

    const chrAIdx = findIdx(['CHR_A', 'CHR1'])
    const bpAIdx = findIdx(['BP_A', 'BP1', 'POS_A', 'POS1'])
    const snpAIdx = findIdx(['SNP_A', 'SNP1', 'ID_A', 'ID1'])
    const chrBIdx = findIdx(['CHR_B', 'CHR2'])
    const bpBIdx = findIdx(['BP_B', 'BP2', 'POS_B', 'POS2'])
    const snpBIdx = findIdx(['SNP_B', 'SNP2', 'ID_B', 'ID2'])
    const r2Idx = findIdx(['R2', 'R^2', 'RSQ'])
    const dprimeIdx = findIdx(['DP', 'DPRIME', "D'"])
    const mafAIdx = findIdx(['MAF_A', 'MAF1'])
    const mafBIdx = findIdx(['MAF_B', 'MAF2'])

    if (chrAIdx === -1 || bpAIdx === -1 || chrBIdx === -1 || bpBIdx === -1) {
      throw new Error(
        `Invalid PLINK LD header. Expected columns CHR_A, BP_A, CHR_B, BP_B. Got: ${columns.join(', ')}`,
      )
    }

    if (r2Idx === -1 && dprimeIdx === -1) {
      throw new Error(
        `Invalid PLINK LD header. Expected at least R2 or DP column. Got: ${columns.join(', ')}`,
      )
    }

    return {
      columns,
      hasR2: r2Idx !== -1,
      hasDprime: dprimeIdx !== -1,
      hasMafA: mafAIdx !== -1,
      hasMafB: mafBIdx !== -1,
      chrAIdx,
      bpAIdx,
      snpAIdx,
      chrBIdx,
      bpBIdx,
      snpBIdx,
      r2Idx,
      dprimeIdx,
      mafAIdx,
      mafBIdx,
    }
  }

  protected async configurePre2(opts?: BaseOptions) {
    if (!this.configured) {
      this.configured = this.configurePre(opts).catch((e: unknown) => {
        this.configured = undefined
        throw e
      })
    }
    return this.configured
  }

  async configure(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
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

    const filtered = records.filter(
      r => r.chrA === refName && r.bpA >= start && r.bpA <= end,
    )

    return filtered
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

    // Filter for pairs where both SNPs are in the region
    const filtered = records.filter(
      r =>
        r.chrB === refName &&
        r.bpB >= start &&
        r.bpB <= end &&
        r.chrA === refName &&
        r.bpA >= start &&
        r.bpA <= end,
    )

    return filtered
  }

  private parseLine(line: string, header: PlinkLDHeader): PlinkLDRecord | null {
    const fields = line.trim().split(/\s+/)

    const chrA = fields[header.chrAIdx]
    const bpA = Number.parseInt(fields[header.bpAIdx] ?? '', 10)
    const snpA = header.snpAIdx >= 0 ? fields[header.snpAIdx] : `${chrA}:${bpA}`
    const chrB = fields[header.chrBIdx]
    const bpB = Number.parseInt(fields[header.bpBIdx] ?? '', 10)
    const snpB = header.snpBIdx >= 0 ? fields[header.snpBIdx] : `${chrB}:${bpB}`

    if (!chrA || !chrB || Number.isNaN(bpA) || Number.isNaN(bpB)) {
      return null
    }

    const r2 =
      header.r2Idx >= 0
        ? Number.parseFloat(fields[header.r2Idx] ?? '')
        : undefined
    const dprime =
      header.dprimeIdx >= 0
        ? Number.parseFloat(fields[header.dprimeIdx] ?? '')
        : undefined
    const mafA =
      header.mafAIdx >= 0
        ? Number.parseFloat(fields[header.mafAIdx] ?? '')
        : undefined
    const mafB =
      header.mafBIdx >= 0
        ? Number.parseFloat(fields[header.mafBIdx] ?? '')
        : undefined

    return {
      chrA,
      bpA,
      snpA: snpA ?? `${chrA}:${bpA}`,
      chrB,
      bpB,
      snpB: snpB ?? `${chrB}:${bpB}`,
      r2: r2 ?? 0,
      dprime,
      mafA,
      mafB,
    }
  }

  public freeResources(): void {
    // nothing to free
  }
}
