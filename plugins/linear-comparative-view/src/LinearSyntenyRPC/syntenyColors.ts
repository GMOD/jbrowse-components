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

interface ColorInputs {
  strands: Int8Array
  refNames: readonly string[]
  identities: Float32Array
  mappingQuals: Float32Array
  meanScores: Float32Array
}

function createColorFunction(
  colorBy: string,
  d: ColorInputs,
  syriTypes: readonly SyriType[] | undefined,
): (index: number) => number {
  if (colorBy === 'syri' && syriTypes) {
    return index => syriColorMap[syriTypes[index]!]
  }
  if (colorBy === 'identity') {
    return index => lutLookup(IDENTITY_LUT, d.identities[index]!)
  }
  if (colorBy === 'mappingQuality') {
    return index => lutLookup(MAPQ_LUT, d.mappingQuals[index]!, 60)
  }
  if (colorBy === 'meanQueryIdentity') {
    return index => lutLookup(MEAN_SCORE_LUT, d.meanScores[index]!)
  }
  if (colorBy === 'strand') {
    return index => (d.strands[index] === -1 ? STRAND_NEG : STRAND_POS)
  }
  if (colorBy === 'query') {
    const colorCache = new Map<string, number>()
    return index => {
      const refName = d.refNames[index]!
      let c = colorCache.get(refName)
      if (c === undefined) {
        c = category10Packed[hashString(refName) % category10Packed.length]!
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

interface InstanceInputs {
  kinds: Uint8Array
  instanceFeatureIdx: Uint32Array
  instanceCount: number
}

// Pure function: produce a fresh Uint32Array of packed ABGR colors from
// per-instance descriptors plus per-feature data and the current color
// scheme. Called on the main thread whenever colorBy or featureData
// changes — no RPC round-trip.
export function computeSyntenyColors({
  instanceData,
  featureData,
  colorBy,
  opacityByIdentity,
  syriTypes,
}: {
  instanceData: InstanceInputs
  featureData: ColorInputs
  colorBy: string
  opacityByIdentity?: boolean
  syriTypes?: readonly SyriType[]
}) {
  const { kinds, instanceFeatureIdx, instanceCount } = instanceData
  const colorFn = createColorFunction(colorBy, featureData, syriTypes)
  const indelColors = buildIndelColors(colorBy)
  const colorI = indelColors[CIGAR_I] ?? DEFAULT_COLOR
  const colorD = indelColors[CIGAR_D] ?? DEFAULT_COLOR
  const colorN = indelColors[CIGAR_N] ?? DEFAULT_COLOR
  const { identities } = featureData
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
      const f = instanceFeatureIdx[i]!
      const base = colorFn(f)
      if (kind === KIND_BASE_HIDDEN) {
        out[i] = base & 0x00ffffff
      } else if (opacityByIdentity) {
        // Identity in [0,1] -> alpha byte in [0x4c, 0xff] (30% floor so
        // low-identity blocks remain perceptible). Unknown identity (-1)
        // gets full alpha.
        const id = identities[f]!
        const alphaByte = id < 0 ? 0xff : Math.max(0x4c, Math.round(id * 255))
        out[i] = (base & 0x00ffffff) | (alphaByte << 24)
      } else {
        out[i] = base
      }
    }
  }
  return out
}
