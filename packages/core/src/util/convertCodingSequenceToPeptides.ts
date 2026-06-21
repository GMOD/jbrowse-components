import { stitch } from './seqUtils.ts'

import type { TranslExcept } from './geneticCodes.ts'

// Maps a single position (in the same coordinate system as the cds array) to its
// codon index within the stitched CDS string. Returns undefined if the position
// falls outside all CDS segments or before the phase offset.
function posToCodonIndex(
  pos: number,
  cds: { start: number; end: number }[],
  phase: number,
): number | undefined {
  let offset = 0
  for (const seg of cds) {
    if (pos >= seg.start && pos < seg.end) {
      const stitchedPos = offset + (pos - seg.start)
      if (stitchedPos < phase) {
        return undefined
      }
      return Math.floor((stitchedPos - phase) / 3)
    }
    offset += seg.end - seg.start
  }
  return undefined
}

// phase > 0 prepends a leading '&' to the protein, shifting every codon's index
// in the protein string by one.
function proteinIndexShift(phase: number) {
  return phase > 0 ? 1 : 0
}

// Maps each in-range transl_except to its codon index within the stitched CDS.
function translExceptCodonOverrides(
  cds: { start: number; end: number }[],
  translExcept: TranslExcept[],
  phase: number,
) {
  const overrides = new Map<number, string>()
  for (const ex of translExcept) {
    const idx = posToCodonIndex(ex.start, cds, phase)
    if (idx !== undefined) {
      overrides.set(idx, ex.aa)
    }
  }
  return overrides
}

// Returns the 0-indexed positions in the final protein string where translExcept
// overrides were applied. Position 0 = first character of the returned protein string
// (which may be '&' if phase > 0). Callers use this to highlight those characters.
export function translExceptProteinPositions({
  cds,
  translExcept = [],
}: {
  cds: { start: number; end: number; phase?: number }[]
  translExcept?: TranslExcept[]
}): Set<number> {
  const phase = cds[0]?.phase ?? 0
  const shift = proteinIndexShift(phase)
  const codonIndexes = translExceptCodonOverrides(
    cds,
    translExcept,
    phase,
  ).keys()
  return new Set([...codonIndexes].map(idx => idx + shift))
}

export function convertCodingSequenceToPeptides({
  cds,
  sequence,
  codonTable,
  starts,
  translExcept = [],
}: {
  cds: { start: number; end: number; phase?: number }[]
  sequence: string
  codonTable: Record<string, string>
  // Valid initiator codons for the active genetic code. When provided, a
  // complete CDS (phase 0) whose first codon is an alternative initiator (e.g.
  // GTG/TTG under the bacterial code, ATA under the vertebrate-mito code)
  // translates as M, matching the NCBI convention for a translated CDS. Omit
  // for a raw frame translation that should report the literal residue.
  starts?: string[]
  // Optional transl_except overrides in the same coordinate system as `cds`.
  // Each entry replaces the normal codon translation at that position with `aa`.
  translExcept?: TranslExcept[]
}) {
  const phase = cds[0]?.phase ?? 0
  const str = stitch(cds, sequence)
  const overrides = translExceptCodonOverrides(cds, translExcept, phase)

  let protein = phase > 0 ? '&' : ''
  let codonIdx = 0
  for (let i = phase; i < str.length; i += 3, codonIdx++) {
    const codon = str.slice(i, i + 3)
    const isStart =
      codonIdx === 0 && phase === 0 && starts?.includes(codon.toUpperCase())
    protein +=
      overrides.get(codonIdx) ?? (isStart ? 'M' : codonTable[codon]) ?? '&'
  }
  return protein
}
