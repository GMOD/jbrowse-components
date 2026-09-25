/**
 * What colour a MAF cell is, as a packed ABGR int, for the one walk both
 * backends draw from (`buildMafChannels`). `RESOLVE_PACKED_SKIP` for a
 * reference insertion column, which the insertion pass renders.
 */

import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { DASH, LOWER_BIT, SPACE } from '../util/asciiBytes.ts'

// Only ever used as stand-in reference bytes while filling `packedByRefAln`.
const LOWER_A = 97
const UPPER_A = 65
const UPPER_C = 67

export interface MafCellColorConfig {
  /** A/C/G/T/N → hex, derived from `theme.palette.bases`. */
  colorForBase: Record<string, string>
  /** The colour of a base matching the reference, unless `colorMatches`. */
  matchColor: string
  /** Color for alignment-gap cells (alnByte === '-' or ' '). */
  gapColor: string
  /** Fallback when the base isn't in `colorForBase`. */
  unknownBaseColor: string
  /** A matching base paints its own colour, as a mismatch does. */
  colorMatches: boolean
}

/**
 * The branch cascade behind the resolver, returning a category rather than a
 * representation. `Base` means "look up the aligned base's own color"; the
 * caller still holds `alnByte`.
 */
const CellCategory = {
  Skip: 0,
  Gap: 1,
  Match: 2,
  Base: 3,
} as const
type CellCategory = (typeof CellCategory)[keyof typeof CellCategory]

export function classifyCell(
  refByte: number,
  alnByte: number,
  colorMatches: boolean,
): CellCategory {
  return refByte === DASH
    ? CellCategory.Skip
    : alnByte === DASH || alnByte === SPACE
      ? CellCategory.Gap
      : !colorMatches && (refByte | LOWER_BIT) === (alnByte | LOWER_BIT)
        ? CellCategory.Match
        : CellCategory.Base
}

/**
 * Packed-ABGR mirror of `MafCellColorConfig`, built once per
 * `buildMafChannels` call, so the encode hot loop reads packed ints with no
 * Map lookup or string allocation.
 */
export interface MafCellPackedColors {
  /**
   * Indexed by lowercase ASCII byte, pre-filled with the unknown-base colour so
   * a miss needs no branch.
   */
  packedByLowerByte: Uint32Array
  match: number
  gap: number
  colorMatches: boolean
}

export interface MafCellPackedConfig extends MafCellPackedColors {
  /**
   * `resolvePackedUncached` over its whole input domain, indexed
   * `(refByte << 8) | alnByte`: 65536 entries, one array read per cell in
   * place of the cascade (3.3x on the main-thread encode, 16ns → 6ns a cell).
   * Built by stamping one resolved mismatch row per reference byte (~0.2ms),
   * since running the cascade 65536 times costs more than a narrow viewport
   * saves. Unsigned, so it cannot hold `RESOLVE_PACKED_SKIP`: white
   * `0xffffffff` is -1 as a signed int.
   */
  packedByRefAln: Uint32Array
}

/** The cascade, run only while filling the table, and the oracle it is swept against. */
export function resolvePackedUncached(
  refByte: number,
  alnByte: number,
  cfg: MafCellPackedColors,
) {
  const category = classifyCell(refByte, alnByte, cfg.colorMatches)
  return category === CellCategory.Gap
    ? cfg.gap
    : category === CellCategory.Match
      ? cfg.match
      : category === CellCategory.Base
        ? cfg.packedByLowerByte[(alnByte | LOWER_BIT) & 0x7f]!
        : 0
}

export function packMafCellColorConfig(
  cfg: MafCellColorConfig,
): MafCellPackedConfig {
  const packedByLowerByte = new Uint32Array(128).fill(
    cssColorToABGR(cfg.unknownBaseColor),
  )
  for (const [base, css] of Object.entries(cfg.colorForBase)) {
    const code = base.charCodeAt(0) | LOWER_BIT
    if (code < 128) {
      packedByLowerByte[code] = cssColorToABGR(css)
    }
  }
  const colors: MafCellPackedColors = {
    packedByLowerByte,
    match: cssColorToABGR(cfg.matchColor),
    gap: cssColorToABGR(cfg.gapColor),
    colorMatches: cfg.colorMatches,
  }
  // Every row of the table is one mismatch row with the two entries that
  // case-fold equal to its reference patched.
  const mismatchRow = new Uint32Array(256)
  for (let alnByte = 0; alnByte < 256; alnByte++) {
    const differingRef = (alnByte | LOWER_BIT) === LOWER_A ? UPPER_C : UPPER_A
    mismatchRow[alnByte] = resolvePackedUncached(differingRef, alnByte, colors)
  }
  const packedByRefAln = new Uint32Array(256 * 256)
  for (let refByte = 0; refByte < 256; refByte++) {
    const row = refByte << 8
    packedByRefAln.set(mismatchRow, row)
    const lower = refByte | LOWER_BIT
    const upper = refByte & ~LOWER_BIT
    packedByRefAln[row | lower] = resolvePackedUncached(refByte, lower, colors)
    packedByRefAln[row | upper] = resolvePackedUncached(refByte, upper, colors)
  }
  return { ...colors, packedByRefAln }
}

/** "Skip this cell" (a reference insertion); negative, so no packed ABGR is it. */
export const RESOLVE_PACKED_SKIP = -1

export function resolveCellPacked(
  refByte: number,
  alnByte: number,
  cfg: MafCellPackedConfig,
): number {
  return refByte === DASH
    ? RESOLVE_PACKED_SKIP
    : cfg.packedByRefAln[(refByte << 8) | alnByte]!
}
