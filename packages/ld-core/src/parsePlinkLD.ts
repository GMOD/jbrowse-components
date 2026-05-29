import type { PlinkLDHeader, PlinkLDRecord } from './plinkLDTypes.ts'

// PLINK header looks like: CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2
// With optional: DP, MAF_A, MAF_B, PHASE
export function parsePlinkLDHeader(headerLine: string): PlinkLDHeader {
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

export function parsePlinkLDLine(
  line: string,
  header: PlinkLDHeader,
): PlinkLDRecord | null {
  const fields = line.trim().split(/\s+/)

  const chrA = fields[header.chrAIdx]
  const bpA = Number.parseInt(fields[header.bpAIdx] ?? '', 10)
  const chrB = fields[header.chrBIdx]
  const bpB = Number.parseInt(fields[header.bpBIdx] ?? '', 10)

  if (!chrA || !chrB || Number.isNaN(bpA) || Number.isNaN(bpB)) {
    return null
  }

  const snpA =
    (header.snpAIdx >= 0 ? fields[header.snpAIdx] : undefined) ??
    `${chrA}:${bpA}`
  const snpB =
    (header.snpBIdx >= 0 ? fields[header.snpBIdx] : undefined) ??
    `${chrB}:${bpB}`

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
    snpA,
    chrB,
    bpB,
    snpB,
    r2: r2 ?? 0,
    dprime,
    mafA,
    mafB,
  }
}
