import { category10 } from '@jbrowse/core/ui/colors'
import { relight } from '@jbrowse/core/util/color'
import { cssColorToABGR, packAbgr } from '@jbrowse/core/util/colorBits'
import {
  colorSchemes,
  hashString,
  rampNorm,
  resolveContinuousMode,
} from '@jbrowse/synteny-core'

import {
  KIND_CIGAR_MIN,
  KIND_MARKER,
} from '../LinearSyntenyDisplay/shaders/syntenyTypes.generated.ts'

import type {
  AttributeRange,
  ContinuousMode,
  Rgb,
  SyntenyColorBy,
} from '@jbrowse/synteny-core'

// Per-instance kind tag. Determines how the color for an instance is derived
// from the parent feature's strand/refName/featureIdx and the current colorBy
// scheme. Emitted by the worker once during geometry build; colors are
// recomputed on the main thread whenever colorBy changes, so a color-scheme
// toggle never triggers an RPC refetch.
//
// The shaders only ever test BASE-vs-CIGAR (`isCigarKind`, i.e. kind >= the
// boundary) and marker-vs-not, so those two numbers are the shader's and are
// generated in (adr-051). The rest are numbered off the boundary here, which is
// what keeps the CIGAR kinds contiguous and above it by construction rather
// than by a comment asking for it.
export const KIND_BASE = 0
export { KIND_MARKER }
// Boundary only — the `isCigar = kind >= KIND_CIGAR_MATCH` threshold. Never
// emitted as an instance kind: buildSyntenyGeometry paints matches as KIND_BASE
// (transparent mode) or leaves them to the pass-1 base (colored mode).
export const KIND_CIGAR_MATCH = KIND_CIGAR_MIN
export const KIND_CIGAR_I = KIND_CIGAR_MIN + 1
export const KIND_CIGAR_D = KIND_CIGAR_MIN + 2
export const KIND_CIGAR_N = KIND_CIGAR_MIN + 3

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
const nameColorHexes = category10.filter(hex => hex.toLowerCase() !== '#7f7f7f')
const nameColorPalette = nameColorHexes.map(hex => cssColorToABGR(hex))

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

// One LUT per colormap, cached by the colormap function itself rather than by
// mode: several modes share viridis, and an `attribute:<name>` mode has no fixed
// identity to key on. Built a handful of times for the life of the worker.
const lutCache = new Map<(norm: number) => Rgb, Uint32Array>()

function lutFor(toRgb: (norm: number) => Rgb) {
  let lut = lutCache.get(toRgb)
  if (!lut) {
    lut = buildLut(toRgb)
    lutCache.set(toRgb, lut)
  }
  return lut
}

// The whole continuous family in one function. A mode supplies its attribute,
// its colormap and its domain, so a measurement nobody anticipated needs no arm
// of its own — which is what stops the switch below growing once per number
// somebody wants to see.
//
// A missing value is -1, and a track carrying the attribute on no feature at all
// has no array: both paint the default color rather than the ramp's bottom, so
// "no data" cannot be misread as "the lowest value".
function continuousColorFunction(mode: ContinuousMode, d: ColorInputs) {
  const values = d.attributes[mode.attribute]
  const lut = lutFor(mode.toRgb)
  return (index: number) => {
    const value = values?.[index]
    return value === undefined || value < 0
      ? DEFAULT_COLOR
      : lut[Math.round(rampNorm(mode, value) * 255)]!
  }
}

interface ColorInputs {
  strands: Int8Array
  refNames: readonly string[]
  mateRefNames: readonly string[]
  // every numeric per-feature channel by name, which is what a continuous mode
  // indexes. The named presets are aliases into this, not separate arrays.
  attributes: Record<string, Float32Array>
  attributeRanges: Record<string, AttributeRange>
}

function createColorFunction(
  colorBy: SyntenyColorBy,
  d: ColorInputs,
  trackColor: string,
  nameOrder?: readonly string[],
): (index: number) => number {
  const continuous = resolveContinuousMode(colorBy, d.attributeRanges)
  if (continuous) {
    return continuousColorFunction(continuous, d)
  }
  switch (colorBy) {
    // One flat color for every alignment in this track, so overlaid tracks are
    // told apart by hue. The CIGAR indel instances below keep their own colors
    // (only 'strand' recolors those), so structural ops stay legible on top.
    case 'track': {
      const packed = cssColorToABGR(trackColor)
      return () => packed
    }
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
    default:
      return () => DEFAULT_COLOR
  }
}

// Chromosome painting: a color per query/target refName.
//
// BY POSITION IN THE ASSEMBLY when the caller knows the chromosome order, which
// the display does — it reads the anchor assembly's own refName list. So the
// palette is handed out rather than hashed into, and a genome cannot paint two
// of its chromosomes the same color the way the hash below does: it buckets a
// name into nine slots, so ten or more chromosomes RE-USE colors, and by the
// birthday bound long before that — twelve rice chromosomes into nine slots is
// a guaranteed three-way collision, which is what a figure review saw ("there
// might be some unexpected color re-use").
//
// The hash stays as the fallback for the case the order genuinely is not
// available: an assembly still loading, or a refName the assembly does not list
// (a scaffold under an alias). There a stable arbitrary color beats no color.
//
// THE COLORS ARE THE PALETTE'S, not a ramp's. This spent a round as the next hue
// on the golden angle at a fixed HSL 70%/50%, which is collision-free for any
// karyotype and was rejected on sight by figure review ("the previous palette is
// better"): an even hue circle at one saturation is a rainbow, and a five-genome
// synteny figure drawn in one is a hundred thousand ribbons of pure red, green,
// blue and magenta. category10's nine are uneven on purpose — that is what makes
// them read as a set.
//
// Nine do not cover a karyotype, so each LAP around the list re-lights the same
// hues (see `relight`): chromosome 10 is a deep version of chromosome 1's blue,
// chromosome 19 a pale one. Three laps is 27 colors, past every karyotype these
// figures anchor on (human 24, rice 12, bread wheat 21), and a fourth lap starts
// the tones again rather than fading to nothing — a repeat 27 positions away is
// one no reader is comparing.
//
// This is not the weaker option for distinguishability, which is what the ramp
// was reached for. Closest pair in OKLab over 24 positions: 0.077 for the laps
// below, 0.019 for the golden angle at HSL 70%/50% — the even hue circle is
// even in HSL's hue, and HSL's hue is not perceptually even.
const PALETTE_LAP_TONES = [
  // lap 0 is the palette color itself, untouched
  undefined,
  // deep before pale, because these ribbons are drawn at a low alpha over white
  // (the OrthoFinder figures run at 0.06) and a pale color at 0.06 is a color a
  // reader cannot see. Chroma held, and the gamut takes what it must down here.
  { lightnessShift: -0.17, chromaScale: 1 },
  // pale. Chroma comes down with lightness: held at full, the light lap's reds
  // and pinks all pin against the top of the sRGB gamut and converge there.
  { lightnessShift: 0.18, chromaScale: 0.8 },
]

function paletteColorAt(position: number) {
  const hex = nameColorHexes[position % nameColorHexes.length]!
  const lap =
    PALETTE_LAP_TONES[
      Math.floor(position / nameColorHexes.length) % PALETTE_LAP_TONES.length
    ]
  return cssColorToABGR(
    lap ? relight(hex, lap.lightnessShift, lap.chromaScale) : hex,
  )
}

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
          : paletteColorAt(position)
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
  // identity fade is a separate channel from the color mode: a track can paint
  // by strand and still fade by identity, so this is read directly rather than
  // through the resolved mode
  const identities = featureData.attributes.identity
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
        const id = identities?.[f] ?? -1
        const alphaByte = id < 0 ? 0xff : Math.max(0x4c, Math.round(id * 255))
        out[i] = (base & 0x00ffffff) | (alphaByte << 24)
      } else {
        out[i] = base
      }
    }
  }
  return out
}
