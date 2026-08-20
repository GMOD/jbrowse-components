/**
 * Single source of truth for "what color should this MAF cell be".
 * Shared by the GPU instance-buffer encoder (`buildInstanceBuffer`) and
 * the Canvas2D fallback (`rendering/bases.ts`) so both paths produce
 * identical pixels.
 *
 * Returns `undefined` for cells that should not be drawn as a base rect
 * (reference insertions — those are rendered by the separate insertion
 * pass).
 *
 * Two flavors: `resolveCellColor` returns CSS strings (for ctx.fillStyle);
 * `resolveCellPacked` returns pre-packed ABGR integers (for the GPU instance
 * buffer). The packed variant avoids the per-cell CSS-string allocation +
 * Map lookup that bridged the gap before.
 */

import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { DASH, LOWER_BIT, SPACE } from '../util/asciiBytes.ts'

/**
 * Per-cell color decisions are resolved against the theme: matches reuse
 * MUI's `action.disabledBackground` (the canonical "neutral filler" tone),
 * alignment gaps reuse `palette.deletion`, off-mode mismatches reuse
 * `palette.mutedSnpBase`, and unknown bases fall back to `palette.text.primary`.
 * The lightblue used when `showAllLetters && !mismatchRendering` has no theme
 * equivalent, so it stays as the one explicit constant.
 */
const SHOW_ALL_NO_MISMATCH_FALLBACK = 'lightblue'

// Only ever used as stand-in reference bytes while filling `packedByRefAln`.
const LOWER_A = 97
const UPPER_A = 65
const UPPER_C = 67

export interface MafCellColorConfig {
  /** A/C/G/T/N → hex, derived from `theme.palette.bases`. */
  colorForBase: Record<string, string>
  /** Color for ref==aln cells when `showAllLetters` is off. */
  matchColor: string
  /** Color for alignment-gap cells (alnByte === '-' or ' '). */
  gapColor: string
  /** Color when `mismatchRendering` is off for mismatched bases. */
  mismatchOffColor: string
  /** Fallback when the base isn't in `colorForBase`. */
  unknownBaseColor: string
  showAllLetters: boolean
  mismatchRendering: boolean
}

/**
 * The single branch cascade behind both color resolvers, returning a category
 * rather than a representation. Both `resolveCellColor` (CSS strings) and
 * `resolveCellPacked` (ABGR ints) map this to their leaf value, so the decision
 * tree lives in exactly one place and the two paths can never silently diverge
 * (which would produce GPU-vs-Canvas2D pixel mismatches). `Base` means "look up
 * the aligned base's own color"; the caller still holds `alnByte`.
 */
const CellCategory = {
  Skip: 0, // reference insertion — drawn separately
  Gap: 1,
  Match: 2,
  ShowAllNoMismatch: 3,
  MismatchOff: 4,
  Base: 5,
} as const
type CellCategory = (typeof CellCategory)[keyof typeof CellCategory]

export function classifyCell(
  refByte: number,
  alnByte: number,
  showAllLetters: boolean,
  mismatchRendering: boolean,
): CellCategory {
  let category: CellCategory = CellCategory.Base
  if (refByte === DASH) {
    category = CellCategory.Skip
  } else if (alnByte === DASH || alnByte === SPACE) {
    category = CellCategory.Gap
  } else {
    const isMatch = (refByte | LOWER_BIT) === (alnByte | LOWER_BIT)
    if (isMatch && !showAllLetters) {
      category = CellCategory.Match
    } else if (isMatch && !mismatchRendering) {
      category = CellCategory.ShowAllNoMismatch
    } else if (!isMatch && !mismatchRendering) {
      category = CellCategory.MismatchOff
    }
  }
  return category
}

export function resolveCellColor(
  refByte: number,
  alnByte: number,
  cfg: MafCellColorConfig,
): string | undefined {
  const category = classifyCell(
    refByte,
    alnByte,
    cfg.showAllLetters,
    cfg.mismatchRendering,
  )
  let color: string | undefined
  if (category === CellCategory.Skip) {
    color = undefined
  } else if (category === CellCategory.Gap) {
    color = cfg.gapColor
  } else if (category === CellCategory.Match) {
    color = cfg.matchColor
  } else if (category === CellCategory.ShowAllNoMismatch) {
    color = SHOW_ALL_NO_MISMATCH_FALLBACK
  } else if (category === CellCategory.MismatchOff) {
    color = cfg.mismatchOffColor
  } else {
    const base = String.fromCharCode(alnByte | LOWER_BIT)
    color = cfg.colorForBase[base] ?? cfg.unknownBaseColor
  }
  return color
}

/**
 * Packed-ABGR mirror of `MafCellColorConfig`. Built once per
 * `buildInstanceBuffer` call via `packMafCellColorConfig`; the GPU hot loop
 * does a direct byte→packed-int lookup (no Map.get, no String allocation).
 */
export interface MafCellPackedColors {
  /**
   * Indexed by lowercase ASCII byte. Pre-filled with `unknownBase` so the
   * hot loop needs no fallback branch on miss. Known bases (a/c/g/t/n/u
   * from theme palette) overwrite their slots.
   */
  packedByLowerByte: Uint32Array
  match: number
  gap: number
  mismatchOff: number
  showAllNoMismatchFallback: number
  showAllLetters: boolean
  mismatchRendering: boolean
}

export interface MafCellPackedConfig extends MafCellPackedColors {
  /**
   * `resolveCellPacked` memoized over its whole input domain, indexed
   * `(refByte << 8) | alnByte`. Both inputs are `Uint8Array` elements, so that
   * is 65536 entries — 256KB. It buys the encoder one array read per cell in
   * place of `classifyCell`'s branch cascade plus the five-way mapping after it,
   * which is worth doing because the encoder runs on the *main thread* over
   * every base of every row: 3.3x, 16ns → 6ns a cell, interleaved A/B over 2M
   * cells.
   *
   * Resolving all 65536 entries through the cascade is what would make that a
   * bad trade — 1.3-2ms of it on every encode, only earned back past ~78k cells,
   * so a narrow viewport would pay for a table it never amortizes. Hence the
   * memcpy build below, which lands the same table in ~0.2ms; breakeven drops to
   * ~19k cells, under a single 26-way screenful.
   *
   * Unsigned, so it cannot hold `RESOLVE_PACKED_SKIP`: a packed ABGR is a full
   * uint32, and as a signed int the pure-white `0xffffffff` *is* -1. Keeping the
   * table unsigned and testing for the skip case outside it is what stops an
   * unknown base in a white-on-dark theme from reading as "don't draw".
   */
  packedByRefAln: Uint32Array
}

/** The branch cascade, run only while filling the table above. */
function resolvePackedUncached(
  refByte: number,
  alnByte: number,
  cfg: MafCellPackedColors,
) {
  const category = classifyCell(
    refByte,
    alnByte,
    cfg.showAllLetters,
    cfg.mismatchRendering,
  )
  let packed = 0
  if (category === CellCategory.Gap) {
    packed = cfg.gap
  } else if (category === CellCategory.Match) {
    packed = cfg.match
  } else if (category === CellCategory.ShowAllNoMismatch) {
    packed = cfg.showAllNoMismatchFallback
  } else if (category === CellCategory.MismatchOff) {
    packed = cfg.mismatchOff
  } else if (category === CellCategory.Base) {
    packed = cfg.packedByLowerByte[(alnByte | LOWER_BIT) & 0x7f]!
  }
  return packed
}

export function packMafCellColorConfig(
  cfg: MafCellColorConfig,
): MafCellPackedConfig {
  const unknownBase = cssColorToABGR(cfg.unknownBaseColor)
  // 128 entries cover all 7-bit ASCII (alignment bases are always ASCII).
  // Pre-fill with the fallback so the hot loop is branchless on lookup.
  const packedByLowerByte = new Uint32Array(128).fill(unknownBase)
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
    mismatchOff: cssColorToABGR(cfg.mismatchOffColor),
    showAllNoMismatchFallback: cssColorToABGR(SHOW_ALL_NO_MISMATCH_FALLBACK),
    showAllLetters: cfg.showAllLetters,
    mismatchRendering: cfg.mismatchRendering,
  }
  // Every row of the table is the same 256 entries — one per aligned byte, all
  // of them mismatching — except the two that case-fold equal to that row's
  // reference. So resolve the mismatch row once and stamp it per reference with
  // `set`, which is a memcpy.
  const mismatchRow = new Uint32Array(256)
  for (let alnByte = 0; alnByte < 256; alnByte++) {
    // `A` mismatches every aligned byte except an A, where `C` does. Neither is
    // `-`, so neither strays into the skip branch.
    const differingRef = (alnByte | LOWER_BIT) === LOWER_A ? UPPER_C : UPPER_A
    mismatchRow[alnByte] = resolvePackedUncached(differingRef, alnByte, colors)
  }
  const packedByRefAln = new Uint32Array(256 * 256)
  for (let refByte = 0; refByte < 256; refByte++) {
    const row = refByte << 8
    packedByRefAln.set(mismatchRow, row)
    // The aligned bytes matching this reference are exactly the two that differ
    // from it in bit 5 alone.
    const lower = refByte | LOWER_BIT
    const upper = refByte & ~LOWER_BIT
    packedByRefAln[row | lower] = resolvePackedUncached(refByte, lower, colors)
    packedByRefAln[row | upper] = resolvePackedUncached(refByte, upper, colors)
  }
  return { ...colors, packedByRefAln }
}

/** Sentinel meaning "skip this cell" (reference insertion). Negative so it
 *  can never collide with a valid packed ABGR value. */
export const RESOLVE_PACKED_SKIP = -1

export function resolveCellPacked(
  refByte: number,
  alnByte: number,
  cfg: MafCellPackedConfig,
): number {
  // The one case the table cannot carry — see `packedByRefAln`. A predictable
  // branch in the hot loop, which never reaches it: `colForGpos` holds only
  // columns with a genomic position, and a `-` reference column has none.
  let packed = RESOLVE_PACKED_SKIP
  if (refByte !== DASH) {
    packed = cfg.packedByRefAln[(refByte << 8) | alnByte]!
  }
  return packed
}
