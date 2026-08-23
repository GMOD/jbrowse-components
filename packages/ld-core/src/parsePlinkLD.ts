import type { PlinkLDHeader, PlinkLDRecord } from './plinkLDTypes.ts'

// Column layout of a headerless PLINK `--r2` file (the standard emit order).
// LocusZoom's hosted demo LD files (e.g. plink.ld.tab.gz) ship without the
// header row, so we fall back to these fixed indices.
export const DEFAULT_PLINK_LD_HEADER: PlinkLDHeader = {
  chrAIdx: 0,
  bpAIdx: 1,
  snpAIdx: 2,
  chrBIdx: 3,
  bpBIdx: 4,
  snpBIdx: 5,
  r2Idx: 6,
  dprimeIdx: -1,
  mafAIdx: -1,
  mafBIdx: -1,
}

// A header line names at least one of the chromosome or position columns; a
// data row never does. Used to tell a real header apart from a first data row.
function looksLikePlinkLDHeader(line: string) {
  return /\b(CHR_A|CHROM_A|CHR1|CHROM1|BP_A|BP1|POS_A|POS1)\b/.test(line)
}

// Resolve a file's column layout from its first line. A recognizable header is
// parsed (and reported as consumed so the caller skips it); anything else —
// empty (tabix files with no `#` comment header) or a bare data row — falls
// back to the default PLINK column order, leaving the line as data.
export function resolvePlinkLDHeader(firstLine: string): {
  header: PlinkLDHeader
  isHeaderLine: boolean
} {
  return looksLikePlinkLDHeader(firstLine)
    ? { header: parsePlinkLDHeader(firstLine), isHeaderLine: true }
    : { header: DEFAULT_PLINK_LD_HEADER, isHeaderLine: false }
}

// PLINK 1.9 header looks like: CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2
// With optional: DP, MAF_A, MAF_B, PHASE
//
// PLINK 2.0 writes a .vcor whose every column is spelled differently:
// #CHROM_A POS_A ID_A CHROM_B POS_B ID_B PHASED_R2, with ABS_DPRIME/DPRIME and
// NONMAJ_FREQ_A/_B under `cols=`. Same file otherwise, so the aliases below are
// what let one adapter read either.
export function parsePlinkLDHeader(headerLine: string): PlinkLDHeader {
  // A header row kept for tabix is commonly commented out (`#CHR_A …`) so that
  // the index's meta character covers it. The `#` is the comment marker, not
  // part of the first column's name, and leaving it attached made every such
  // file throw "Expected columns CHR_A, BP_A, CHR_B, BP_B" on load.
  const columns = headerLine.trim().replace(/^#/, '').split(/\s+/)

  const findIdx = (names: string[]) => {
    for (const name of names) {
      const idx = columns.indexOf(name)
      if (idx !== -1) {
        return idx
      }
    }
    return -1
  }

  const chrAIdx = findIdx(['CHR_A', 'CHR1', 'CHROM_A', 'CHROM1'])
  const bpAIdx = findIdx(['BP_A', 'BP1', 'POS_A', 'POS1'])
  const snpAIdx = findIdx(['SNP_A', 'SNP1', 'ID_A', 'ID1'])
  const chrBIdx = findIdx(['CHR_B', 'CHR2', 'CHROM_B', 'CHROM2'])
  const bpBIdx = findIdx(['BP_B', 'BP2', 'POS_B', 'POS2'])
  const snpBIdx = findIdx(['SNP_B', 'SNP2', 'ID_B', 'ID2'])
  const r2Idx = findIdx(['R2', 'R^2', 'RSQ', 'PHASED_R2', 'UNPHASED_R2'])
  const dprimeIdx = findIdx(['DP', "D'", 'ABS_DPRIME', 'DPRIME'])
  const mafAIdx = findIdx(['MAF_A', 'MAF1', 'NONMAJ_FREQ_A'])
  const mafBIdx = findIdx(['MAF_B', 'MAF2', 'NONMAJ_FREQ_B'])

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
  // 1.9's DP and plink2's ABS_DPRIME are already magnitudes, but plink2's
  // DPRIME is signed, and the pre-computed path has no genotypes to recover a
  // sign against, so it reads every cell as a magnitude. Taking |D'| here is
  // what stops a signed column rendering as a hole in the triangle.
  const dprime =
    header.dprimeIdx >= 0
      ? Math.abs(Number.parseFloat(fields[header.dprimeIdx] ?? ''))
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
    // parseFloat of a malformed/"nan" cell yields NaN, which `?? 0` does NOT
    // catch (only null/undefined) — guard on finiteness so callers never see a
    // NaN r² leak into the matrix.
    r2: r2 !== undefined && Number.isFinite(r2) ? r2 : 0,
    dprime,
    mafA,
    mafB,
  }
}
