import { TabixIndexedFile } from '@gmod/tabix'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export interface PlinkLDRecord {
  chrA: string
  bpA: number
  snpA: string
  chrB: string
  bpB: number
  snpB: string
  r2: number
  dprime?: number
  mafA?: number
  mafB?: number
}

export interface PlinkLDHeader {
  columns: string[]
  hasR2: boolean
  hasDprime: boolean
  hasMafA: boolean
  hasMafB: boolean
  chrAIdx: number
  bpAIdx: number
  snpAIdx: number
  chrBIdx: number
  bpBIdx: number
  snpBIdx: number
  r2Idx: number
  dprimeIdx: number
  mafAIdx: number
  mafBIdx: number
}

export default class PlinkLDAdapter extends BaseAdapter {
  private configured?: Promise<{
    ld: TabixIndexedFile
    header: PlinkLDHeader
  }>

  private async configurePre(_opts?: BaseOptions) {
    const ldLocation = this.getConf('ldLocation')
    const location = this.getConf(['index', 'location'])
    const indexType = this.getConf(['index', 'indexType'])

    const filehandle = openLocation(ldLocation, this.pluginManager)
    const isCSI = indexType === 'CSI'
    const ld = new TabixIndexedFile({
      filehandle,
      csiFilehandle: isCSI
        ? openLocation(location, this.pluginManager)
        : undefined,
      tbiFilehandle: !isCSI
        ? openLocation(location, this.pluginManager)
        : undefined,
      chunkCacheSize: 50 * 2 ** 20,
    })

    // Parse the header line to determine column positions
    const headerLine = await ld.getHeader()
    const header = this.parseHeader(headerLine)

    return { ld, header }
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

  protected async configurePre2() {
    if (!this.configured) {
      this.configured = this.configurePre().catch((e: unknown) => {
        this.configured = undefined
        throw e
      })
    }
    return this.configured
  }

  async configure(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
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
        const record = this.parseLine(line, header)
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

    // Filter for pairs where both SNPs are in the region
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
