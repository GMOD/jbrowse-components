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

// Precomputed 256-bin LUTs mapping a normalized [0,1] value to packed ABGR
// across an HSL hue range. Hue scales chosen to match the dotplot view:
// 120° (red→green) for identity, 200° (red→cyan) for mean-score, 60°
// (red→yellow) for MAPQ. Negative inputs (missing data) fall back to
// DEFAULT_COLOR at the call site.
function buildHslLut(hueRange: number) {
  const lut = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    const hue = (i / 255) * hueRange
    const c = parseCssColor(`hsl(${hue}, 100%, 40%)`)
    lut[i] = packAbgr(getRed(c), getGreen(c), getBlue(c), 255)
  }
  return lut
}

const IDENTITY_LUT = buildHslLut(120)
const MEAN_SCORE_LUT = buildHslLut(200)
const MAPQ_LUT = buildHslLut(60)

function lutLookup(lut: Uint32Array, value: number, max = 1) {
  if (value < 0) {
    return DEFAULT_COLOR
  }
  const norm = Math.min(1, value / max)
  return lut[Math.round(norm * 255)]!
}

const syriColorMap: Record<SyriType, number> = {
  SYN: cssColorToABGR(syriColors.SYN),
  INV: cssColorToABGR(syriColors.INV),
  TRANS: cssColorToABGR(syriColors.TRANS),
  DUP: cssColorToABGR(syriColors.DUP),
}

function createColorFunction(
  colorBy: string,
  data: {
    syriTypes?: readonly SyriType[]
    identities?: Float32Array
    mappingQuals?: Float32Array
    meanScores?: Float32Array
  },
): (strand: number, refName: string, index: number) => number {
  const { syriTypes, identities, mappingQuals, meanScores } = data
  if (colorBy === 'syri' && syriTypes) {
    return (_strand: number, _refName: string, index: number) =>
      syriColorMap[syriTypes[index]!]
  }

  if (colorBy === 'identity' && identities) {
    return (_strand: number, _refName: string, index: number) =>
      lutLookup(IDENTITY_LUT, identities[index]!)
  }

  if (colorBy === 'mappingQuality' && mappingQuals) {
    return (_strand: number, _refName: string, index: number) =>
      lutLookup(MAPQ_LUT, mappingQuals[index]!, 60)
  }

  if (colorBy === 'meanQueryIdentity' && meanScores) {
    return (_strand: number, _refName: string, index: number) =>
      lutLookup(MEAN_SCORE_LUT, meanScores[index]!)
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
  mappingQuals,
  meanScores,
  opacityByIdentity,
}: {
  kinds: Uint8Array
  featureIdx: Uint32Array
  strands: Int8Array
  refNames: readonly string[]
  instanceCount: number
  colorBy: string
  syriTypes?: readonly SyriType[]
  identities?: Float32Array
  mappingQuals?: Float32Array
  meanScores?: Float32Array
  opacityByIdentity?: boolean
}) {
  const colorFn = createColorFunction(colorBy, {
    syriTypes,
    identities,
    mappingQuals,
    meanScores,
  })
  const indelColors = buildIndelColors(colorBy)
  const colorI = indelColors[CIGAR_I] ?? DEFAULT_COLOR
  const colorD = indelColors[CIGAR_D] ?? DEFAULT_COLOR
  const colorN = indelColors[CIGAR_N] ?? DEFAULT_COLOR
  const fadeByIdentity = opacityByIdentity && identities
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
      if (kind === KIND_BASE_HIDDEN) {
        out[i] = base & 0x00ffffff
      } else if (fadeByIdentity) {
        const id = identities[f]!
        // Identity in [0,1] -> alpha byte in [0x4c, 0xff] (30% floor so
        // low-identity blocks remain perceptible). Unknown identity (-1)
        // gets full alpha.
        const alphaByte =
          id < 0 ? 0xff : Math.max(0x4c, Math.round(id * 255))
        out[i] = (base & 0x00ffffff) | (alphaByte << 24)
      } else {
        out[i] = base
      }
    }
  }
  return out
}
