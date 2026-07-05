import { CIGAR_D, CIGAR_I, CIGAR_N } from '@jbrowse/cigar-utils'
import { category10 } from '@jbrowse/core/ui/colors'
import { cssColorToABGR, packAbgr } from '@jbrowse/core/util/colorBits'
import {
  colorSchemes,
  continuousRampConfig,
  divergingIdentityRgb,
  hashString,
} from '@jbrowse/synteny-core'

import type { SyntenyColorBy } from '@jbrowse/synteny-core'

// Per-instance kind tag. Determines how the color for an instance is derived
// from the parent feature's strand/refName/featureIdx and the current colorBy
// scheme. Emitted by the worker once during geometry build; colors are
// recomputed on the main thread whenever colorBy changes, so a color-scheme
// toggle never triggers an RPC refetch.
// SYNC: the shaders only test BASE-vs-CIGAR via `isCigarKind` (kind >= 3) in
// syntenyTypes.slang. The CIGAR kinds must stay contiguous and above the
// non-CIGAR kinds, with KIND_CIGAR_MATCH as the boundary.
export const KIND_BASE = 0
export const KIND_MARKER = 2
export const KIND_CIGAR_MATCH = 3
export const KIND_CIGAR_I = 4
export const KIND_CIGAR_D = 5
export const KIND_CIGAR_N = 6

const STRAND_POS = cssColorToABGR(colorSchemes.strand.posColor)
const STRAND_NEG = cssColorToABGR(colorSchemes.strand.negColor)
const DEFAULT_COLOR = cssColorToABGR(colorSchemes.default.cigarColors.M)
// Location-marker tick: semi-transparent black, matching the legacy
// rgba(0,0,0,0.25) context lines. Renderers draw KIND_MARKER instances as 1px
// lines using this packed alpha directly (no colorBy/global-alpha scaling).
const MARKER_COLOR = packAbgr(0, 0, 0, 64)

// Query/target chromosome-painting palette. category10's grey (#7f7f7f) is
// dropped: a grey synteny ribbon reads as "uncolored/broken", and a genome
// whose sole (or hashed) chromosome lands on that slot paints the whole view
// muddy grey — the exact failure a single-contig assembly named "chr" hits.
const nameColorPalette = category10
  .filter(hex => hex.toLowerCase() !== '#7f7f7f')
  .map(hex => cssColorToABGR(hex))

// Precomputed 256-bin LUTs mapping a normalized [0,1] value to packed ABGR.
// The ramp math lives in @jbrowse/synteny-core so the dotplot view evaluates
// the identical curve per feature — the two views can no longer drift (they
// previously disagreed on MAPQ scaling). Negative inputs (missing data) fall
// back to DEFAULT_COLOR at the call site.
function buildLut(toRgb: (norm: number) => readonly [number, number, number]) {
  const lut = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = toRgb(i / 255)
    lut[i] = packAbgr(r, g, b, 255)
  }
  return lut
}

const IDENTITY_LUT = buildLut(continuousRampConfig.identity.toRgb)
const MEAN_MAPQ_LUT = buildLut(
  continuousRampConfig.meanQueryMappingQuality.toRgb,
)
const MAPQ_LUT = buildLut(continuousRampConfig.mappingQuality.toRgb)
// Diverging LUT is indexed by identity directly (0..1) since the pivot remap
// inside divergingIdentityRgb is non-linear — bin i encodes identity i/255.
const IDENTITY_DIVERGING_LUT = buildLut(divergingIdentityRgb)

function lutLookup(lut: Uint32Array, value: number, max = 1) {
  if (value < 0) {
    return DEFAULT_COLOR
  }
  const norm = Math.min(1, value / max)
  return lut[Math.round(norm * 255)]!
}

interface ColorInputs {
  strands: Int8Array
  refNames: readonly string[]
  mateRefNames: readonly string[]
  identities: Float32Array
  mappingQuals: Float32Array
  meanScores: Float32Array
  meanIdentities: Float32Array
}

function createColorFunction(
  colorBy: SyntenyColorBy,
  d: ColorInputs,
): (index: number) => number {
  switch (colorBy) {
    case 'identity':
      return index => lutLookup(IDENTITY_LUT, d.identities[index]!)
    case 'identityDiverging':
      return index => lutLookup(IDENTITY_DIVERGING_LUT, d.identities[index]!)
    case 'meanQueryIdentity':
      return index => lutLookup(IDENTITY_LUT, d.meanIdentities[index]!)
    case 'meanQueryMappingQuality':
      return index => lutLookup(MEAN_MAPQ_LUT, d.meanScores[index]!)
    case 'mappingQuality':
      return index =>
        lutLookup(
          MAPQ_LUT,
          d.mappingQuals[index]!,
          continuousRampConfig.mappingQuality.maxValue,
        )
    case 'strand':
      return index => (d.strands[index] === -1 ? STRAND_NEG : STRAND_POS)
    case 'query':
      return nameColorFunction(d.refNames)
    case 'target':
      return nameColorFunction(d.mateRefNames)
    // 'reference' is resolved to 'query'/'target' per-level in the display
    // before it reaches here (see LinearSyntenyDisplay effectiveColorBy); this
    // arm only guards the type union and colors by query as a safe fallback.
    case 'reference':
      return nameColorFunction(d.refNames)
    case 'default':
      return () => DEFAULT_COLOR
  }
}

// Hash a per-feature name (query or target refName) to a stable category10
// color, cached so repeated names don't re-hash.
function nameColorFunction(names: readonly string[]) {
  const colorCache = new Map<string, number>()
  return (index: number) => {
    const name = names[index]!
    let c = colorCache.get(name)
    if (c === undefined) {
      c = nameColorPalette[hashString(name) % nameColorPalette.length]!
      colorCache.set(name, c)
    }
    return c
  }
}

function buildIndelColors(colorBy: SyntenyColorBy) {
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
}: {
  instanceData: InstanceInputs
  featureData: ColorInputs
  colorBy: SyntenyColorBy
  opacityByIdentity?: boolean
}) {
  const { kinds, instanceFeatureIdx, instanceCount } = instanceData
  const colorFn = createColorFunction(colorBy, featureData)
  const indelColors = buildIndelColors(colorBy)
  const colorI = indelColors[CIGAR_I] ?? DEFAULT_COLOR
  const colorD = indelColors[CIGAR_D] ?? DEFAULT_COLOR
  const colorN = indelColors[CIGAR_N] ?? DEFAULT_COLOR
  const { identities } = featureData
  const out = new Uint32Array(instanceCount)

  for (let i = 0; i < instanceCount; i++) {
    const kind = kinds[i]!
    if (kind === KIND_MARKER) {
      out[i] = MARKER_COLOR
    } else if (kind === KIND_CIGAR_I) {
      out[i] = colorI
    } else if (kind === KIND_CIGAR_D) {
      out[i] = colorD
    } else if (kind === KIND_CIGAR_N) {
      out[i] = colorN
    } else {
      const f = instanceFeatureIdx[i]!
      const base = colorFn(f)
      if (opacityByIdentity) {
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
