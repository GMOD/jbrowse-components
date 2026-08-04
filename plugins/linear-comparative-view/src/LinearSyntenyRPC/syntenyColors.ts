import { category10 } from '@jbrowse/core/ui/colors'
import { cssColorToABGR, packAbgr } from '@jbrowse/core/util/colorBits'
import {
  colorSchemes,
  continuousRampConfig,
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
// Boundary constant only — the `isCigar = kind >= KIND_CIGAR_MATCH` threshold.
// Never emitted as an instance kind: buildSyntenyGeometry paints matches as
// KIND_BASE (transparent mode) or leaves them to the pass-1 base (colored mode).
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

// identity + meanQueryIdentity share the viridis ramp; mappingQuality uses
// cividis. Each colormap is baked once over the normalized [0,1] domain — the
// per-mode maxValue is applied at lookup.
const IDENTITY_LUT = buildLut(continuousRampConfig.identity.toRgb)
const MAPQ_LUT = buildLut(continuousRampConfig.mappingQuality.toRgb)

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
  meanIdentities: Float32Array
}

function createColorFunction(
  colorBy: SyntenyColorBy,
  d: ColorInputs,
  trackColor: string,
  nameOrder?: readonly string[],
): (index: number) => number {
  switch (colorBy) {
    // One flat color for every alignment in this track, so overlaid tracks are
    // told apart by hue. The CIGAR indel instances below keep their own colors
    // (only 'strand' recolors those), so structural ops stay legible on top.
    case 'track': {
      const packed = cssColorToABGR(trackColor)
      return () => packed
    }
    case 'identity':
      return index => lutLookup(IDENTITY_LUT, d.identities[index]!)
    case 'meanQueryIdentity':
      return index => lutLookup(IDENTITY_LUT, d.meanIdentities[index]!)
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
      return nameColorFunction(d.refNames, nameOrder)
    case 'target':
      return nameColorFunction(d.mateRefNames, nameOrder)
    // 'reference' is resolved to 'query'/'target' per-level in the display
    // before it reaches here (see LinearSyntenyDisplay effectiveColorBy); this
    // arm only guards the type union and colors by query as a safe fallback.
    case 'reference':
      return nameColorFunction(d.refNames, nameOrder)
    case 'default':
      return () => DEFAULT_COLOR
  }
}

// Chromosome painting: a color per query/target refName.
//
// BY POSITION IN THE ASSEMBLY when the caller knows the chromosome order, which
// the display does — it reads the anchor assembly's own refName list. Each
// position takes the next hue on the golden angle, at the same 70%/50% the
// reference-position ramps elsewhere on the site use, so every chromosome gets
// its own well-separated color and neighbours never come out as neighbouring
// hues.
//
// The golden angle rather than an even spread over the circle, and that is not
// decoration: a refName list is not a chromosome list. Rice's chrom.sizes has 30
// entries — 12 chromosomes, two organelles and sixteen scaffolds — so `i/N*360`
// squeezed all twelve chromosomes into the first 132 degrees and painted the
// whole figure red through green. A stride does not care how long the list is.
// It repeats only after 144 entries (137.5 x 144 = 55 turns exactly), which no
// karyotype reaches.
//
// The hash below cannot do this and could not be made to. It buckets a name into
// nine slots, so any genome with ten or more chromosomes RE-USES colors, and by
// the birthday bound it re-uses them long before that: twelve rice chromosomes
// into nine slots is a guaranteed three-way collision, which is what review saw
// ("there might be some unexpected color re-use"). Widening the palette only
// moves the threshold — chicken has 40 chromosomes — so the fix has to be an
// assignment rather than a bigger bucket list.
//
// It stays as the fallback for the case the order genuinely is not available: an
// assembly still loading, or a refName the assembly does not list (a scaffold
// under an alias). There a stable arbitrary color beats no color.
// 360 x (1 - 1/phi). Successive multiples of it never bunch up, which is what
// makes it the standard way to hand out colors when the count is not known.
const GOLDEN_ANGLE_DEG = 137.50776405003785

function nameColorFunction(
  names: readonly string[],
  nameOrder?: readonly string[],
) {
  const orderOf = nameOrder?.length
    ? new Map(nameOrder.map((n, i) => [n, i]))
    : undefined
  const colorCache = new Map<string, number>()
  return (index: number) => {
    const name = names[index]!
    let c = colorCache.get(name)
    if (c === undefined) {
      const position = orderOf?.get(name)
      c =
        position === undefined
          ? nameColorPalette[hashString(name) % nameColorPalette.length]!
          : cssColorToABGR(
              `hsl(${(position * GOLDEN_ANGLE_DEG) % 360},70%,50%)`,
            )
      colorCache.set(name, c)
    }
    return c
  }
}

// I/D/N indel colors for the active scheme (strand recolors N/D purple). Both
// schemes always define I/D/N, so these are unconditional.
function buildIndelColors(colorBy: SyntenyColorBy) {
  const { cigarColors } =
    colorBy === 'strand' ? colorSchemes.strand : colorSchemes.default
  return {
    I: cssColorToABGR(cigarColors.I),
    D: cssColorToABGR(cigarColors.D),
    N: cssColorToABGR(cigarColors.N),
  }
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
  trackColor,
  opacityByIdentity,
  nameOrder,
}: {
  instanceData: InstanceInputs
  featureData: ColorInputs
  colorBy: SyntenyColorBy
  // the display's slot in the view's track palette; only read by colorBy:'track'
  trackColor: string
  opacityByIdentity?: boolean
  // Chromosome order of the assembly the chromosome-painting modes key on, so a
  // ribbon's color can be that chromosome's position rather than a hash bucket.
  // Only the display knows it — the assembly's refName list is a session fact,
  // not something in the feature data — so it is passed in rather than derived.
  nameOrder?: readonly string[]
}) {
  const { kinds, instanceFeatureIdx, instanceCount } = instanceData
  const colorFn = createColorFunction(
    colorBy,
    featureData,
    trackColor,
    nameOrder,
  )
  const { I: colorI, D: colorD, N: colorN } = buildIndelColors(colorBy)
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
