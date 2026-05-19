import { CIGAR_D, CIGAR_I, CIGAR_N } from '@jbrowse/alignments-core'
import { category10 } from '@jbrowse/core/ui/colors'
import {
  cssColorToABGR,
  getBlue,
  getGreen,
  getRed,
  packAbgr,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'
import { colorSchemes, hashString, syriColors } from '@jbrowse/synteny-core'

import type { SyriType } from '@jbrowse/plugin-comparative-adapters'

// Per-instance kind tag. Determines how the color for an instance is derived
// from the parent feature's strand/refName/featureIdx and the current colorBy
// scheme. Emitted by the worker once during geometry build; colors are
// recomputed on the main thread whenever colorBy changes, so a color-scheme
// toggle never triggers an RPC refetch.
export const KIND_BASE = 0
export const KIND_BASE_HIDDEN = 1
export const KIND_MARKER = 2
export const KIND_CIGAR_MATCH = 3
export const KIND_CIGAR_I = 4
export const KIND_CIGAR_D = 5
export const KIND_CIGAR_N = 6
export const KIND_CIGAR_HIDDEN = 7

const STRAND_POS = cssColorToABGR(colorSchemes.strand.posColor)
const STRAND_NEG = cssColorToABGR(colorSchemes.strand.negColor)
const DEFAULT_COLOR = cssColorToABGR(colorSchemes.default.cigarColors.M)
const BLACK = packAbgr(0, 0, 0, 255)

const category10Packed = category10.map(hex => cssColorToABGR(hex))

// Precomputed 256-bin LUT mapping identity in [0,1] to packed ABGR. Bin 0 is
// red (hue 0), bin 255 is green (hue 120). Values <0 (unknown identity) map
// to DEFAULT_COLOR at the call site.
const IDENTITY_LUT = (() => {
  const lut = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    const hue = (i / 255) * 120
    const c = parseCssColor(`hsl(${hue}, 100%, 40%)`)
    lut[i] = packAbgr(getRed(c), getGreen(c), getBlue(c), 255)
  }
  return lut
})()

function identityToPacked(identity: number) {
  if (identity < 0) {
    return DEFAULT_COLOR
  }
  const bin = Math.min(255, Math.max(0, Math.round(identity * 255)))
  return IDENTITY_LUT[bin]!
}

const syriColorMap: Record<SyriType, number> = {
  SYN: cssColorToABGR(syriColors.SYN),
  INV: cssColorToABGR(syriColors.INV),
  TRANS: cssColorToABGR(syriColors.TRANS),
  DUP: cssColorToABGR(syriColors.DUP),
}

function createColorFunction(
  colorBy: string,
  syriTypes?: readonly SyriType[],
  identities?: Float32Array,
): (strand: number, refName: string, index: number) => number {
  if (colorBy === 'syri' && syriTypes) {
    return (_strand: number, _refName: string, index: number) =>
      syriColorMap[syriTypes[index]!]
  }

  if (colorBy === 'identity' && identities) {
    return (_strand: number, _refName: string, index: number) =>
      identityToPacked(identities[index]!)
  }

  if (colorBy === 'strand') {
    return (strand: number) => (strand === -1 ? STRAND_NEG : STRAND_POS)
  }

  if (colorBy === 'query') {
    const colorCache = new Map<string, number>()
    return (_strand: number, refName: string) => {
      let c = colorCache.get(refName)
      if (c === undefined) {
        const hash = hashString(refName)
        c = category10Packed[hash % category10Packed.length]!
        colorCache.set(refName, c)
      }
      return c
    }
  }

  return () => DEFAULT_COLOR
}

function buildIndelColors(colorBy: string) {
  const scheme =
    colorBy === 'strand' ? colorSchemes.strand : colorSchemes.default
  const cigarColors = scheme.cigarColors
  const indelColors: Partial<Record<number, number>> = {}
  for (const [op, key] of [
    [CIGAR_I, 'I'],
    [CIGAR_D, 'D'],
    [CIGAR_N, 'N'],
  ] as const) {
    const color = cigarColors[key as keyof typeof cigarColors]
    if (color) {
      indelColors[op] = cssColorToABGR(color)
    }
  }
  return indelColors
}

// Pure function: produce a fresh Uint32Array of packed ABGR colors from
// per-instance descriptors (`kinds`, `featureIdx`) plus per-feature
// strand/refName plus the current color scheme. Called both on the worker
// (initial colors) and on the main thread (color-scheme change).
export function computeSyntenyColors({
  kinds,
  featureIdx,
  strands,
  refNames,
  instanceCount,
  colorBy,
  syriTypes,
  identities,
}: {
  kinds: Uint8Array
  featureIdx: Uint32Array
  strands: Int8Array
  refNames: readonly string[]
  instanceCount: number
  colorBy: string
  syriTypes?: readonly SyriType[]
  identities?: Float32Array
}) {
  const colorFn = createColorFunction(colorBy, syriTypes, identities)
  const indelColors = buildIndelColors(colorBy)
  const colorI = indelColors[CIGAR_I] ?? DEFAULT_COLOR
  const colorD = indelColors[CIGAR_D] ?? DEFAULT_COLOR
  const colorN = indelColors[CIGAR_N] ?? DEFAULT_COLOR
  const out = new Uint32Array(instanceCount)

  for (let i = 0; i < instanceCount; i++) {
    const kind = kinds[i]!
    if (kind === KIND_MARKER) {
      out[i] = BLACK
    } else if (kind === KIND_CIGAR_HIDDEN) {
      out[i] = 0
    } else if (kind === KIND_CIGAR_I) {
      out[i] = colorI
    } else if (kind === KIND_CIGAR_D) {
      out[i] = colorD
    } else if (kind === KIND_CIGAR_N) {
      out[i] = colorN
    } else {
      const f = featureIdx[i]!
      const base = colorFn(strands[f]!, refNames[f]!, f)
      out[i] = kind === KIND_BASE_HIDDEN ? base & 0x00ffffff : base
    }
  }
  return out
}
