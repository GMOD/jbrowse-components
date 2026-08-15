import { category10 } from '@jbrowse/core/ui/colors'
import { relight } from '@jbrowse/core/util/color'
import { cssColorToABGR, packAbgr } from '@jbrowse/core/util/colorBits'

import { rampNorm, resolveContinuousMode } from './colorRamps.ts'
import { colorSchemes, hashString } from './colorUtils.ts'

import type { AttributeRange, ContinuousMode, Rgb } from './colorRamps.ts'
import type { SyntenyColorBy } from './colorUtils.ts'

/**
 * The per-feature color function both comparative views build from a fetch
 * payload: `colorBy` plus the payload's lanes in, a packed-ABGR color per
 * feature index out.
 *
 * One module because the two views had drifted while each carried a comment
 * saying they could not. Chromosome painting was the visible one: this palette
 * with its laps is what a linear synteny view has used since a figure review
 * caught rice's twelve chromosomes colliding in nine hash buckets, and the
 * dotplot was still hashing — so the same two genomes were painted differently
 * by the two views, and the dotplot still had the collision. Continuous ramps
 * had drifted too, in a smaller way: the dotplot rebuilt its 256-entry LUT on
 * every recolor pass where synteny cached one per colormap.
 *
 * Every color here is fully OPAQUE. Plot-wide opacity is a render parameter —
 * a shader uniform, `a * alpha` in Canvas2D — never baked into these bytes; see
 * `DotplotRenderState.alpha`. Baking it in made an opacity drag recompute the
 * whole color array and re-upload the instance buffer once a frame.
 */

// Missing data. -1 is the worker's sentinel on every numeric channel, and a
// track carrying an attribute on no feature at all has no array; both paint
// this rather than the ramp's bottom, so "no data" cannot be misread as "the
// lowest value".
export const MISSING_VALUE_COLOR = cssColorToABGR(
  colorSchemes.default.cigarColors.M,
)

const STRAND_POS = cssColorToABGR(colorSchemes.strand.posColor)
const STRAND_NEG = cssColorToABGR(colorSchemes.strand.negColor)

// Query/target chromosome-painting palette. category10's grey (#7f7f7f) is
// dropped: a grey ribbon or point reads as "uncolored/broken", and a genome
// whose sole (or hashed) chromosome lands on that slot paints the whole view
// muddy grey — the exact failure a single-contig assembly named "chr" hits.
const nameColorHexes = category10.filter(hex => hex.toLowerCase() !== '#7f7f7f')
const nameColorPalette = nameColorHexes.map(hex => cssColorToABGR(hex))

// Nine do not cover a karyotype, so each LAP around the list re-lights the same
// hues: chromosome 10 is a deep version of chromosome 1's blue, chromosome 19 a
// pale one. Three laps is 27 colors, past every karyotype these figures anchor
// on (human 24, rice 12, bread wheat 21), and a fourth lap starts the tones
// again rather than fading to nothing — a repeat 27 positions away is one no
// reader is comparing.
//
// THE COLORS ARE THE PALETTE'S, not a ramp's. This spent a round as the next hue
// on the golden angle at a fixed HSL 70%/50%, which is collision-free for any
// karyotype and was rejected on sight by figure review ("the previous palette is
// better"): an even hue circle at one saturation is a rainbow, and a five-genome
// synteny figure drawn in one is a hundred thousand ribbons of pure red, green,
// blue and magenta. category10's nine are uneven on purpose — that is what makes
// them read as a set.
//
// It is not the weaker option for distinguishability either, which is what the
// ramp was reached for. Closest pair in OKLab over 24 positions: 0.077 for these
// laps, 0.019 for the golden angle at HSL 70%/50% — an even hue circle is even
// in HSL's hue, and HSL's hue is not perceptually even.
const PALETTE_LAP_TONES = [
  // lap 0 is the palette color itself, untouched
  undefined,
  // deep before pale, because these are drawn at a low alpha over white (the
  // OrthoFinder figures run at 0.06) and a pale color at 0.06 is a color a
  // reader cannot see. Chroma held, and the gamut takes what it must down here.
  { lightnessShift: -0.17, chromaScale: 1 },
  // pale. Chroma comes down with lightness: held at full, the light lap's reds
  // and pinks all pin against the top of the sRGB gamut and converge there.
  { lightnessShift: 0.18, chromaScale: 0.8 },
]

/** The palette color for a chromosome at `position` in its assembly. */
export function paletteColorAt(position: number) {
  const hex = nameColorHexes[position % nameColorHexes.length]!
  const lap =
    PALETTE_LAP_TONES[
      Math.floor(position / nameColorHexes.length) % PALETTE_LAP_TONES.length
    ]
  return cssColorToABGR(
    lap ? relight(hex, lap.lightnessShift, lap.chromaScale) : hex,
  )
}

/**
 * Chromosome painting against a dictionary-encoded refName lane.
 *
 * BY POSITION IN THE ASSEMBLY when the caller knows the chromosome order, which
 * both displays do — they read the relevant axis' assembly refName list. So the
 * palette is handed out rather than hashed into, and a genome cannot paint two
 * of its chromosomes the same color the way the hash below does: it buckets a
 * name into nine slots, so ten or more chromosomes RE-USE colors, and by the
 * birthday bound long before that.
 *
 * The hash stays as the fallback for the case the order genuinely is not
 * available: an assembly still loading, or a refName the assembly does not list
 * (a scaffold under an alias). There a stable arbitrary color beats no color.
 *
 * The dictionary is at most a scaffold count long, so its colors resolve once
 * into a LUT and the per-feature path is a double array index — no hash and no
 * Map probe. It used to hash each name and memoize in a `Map<string, number>`,
 * i.e. rebuild the dictionary the worker now ships, once per colorBy pass.
 */
export function makeNameColorFunction(
  dict: readonly string[],
  ids: Uint32Array,
  nameOrder?: readonly string[],
) {
  const orderOf = nameOrder?.length
    ? new Map(nameOrder.map((n, i) => [n, i]))
    : undefined
  const lut = Uint32Array.from(dict, name => {
    const position = orderOf?.get(name)
    return position === undefined
      ? nameColorPalette[hashString(name) % nameColorPalette.length]!
      : paletteColorAt(position)
  })
  return (index: number) => lut[ids[index]!]!
}

function buildLut(toRgb: (norm: number) => Rgb) {
  const lut = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = toRgb(i / 255)
    lut[i] = packAbgr(r, g, b, 255)
  }
  return lut
}

// One LUT per colormap, cached by the colormap function itself rather than by
// mode: several modes share viridis, and an `attribute:<name>` mode has no fixed
// identity to key on. Built a handful of times for the life of the process,
// where the dotplot used to rebuild one per recolor pass.
const lutCache = new Map<(norm: number) => Rgb, Uint32Array>()

function lutFor(toRgb: (norm: number) => Rgb) {
  let lut = lutCache.get(toRgb)
  if (!lut) {
    lut = buildLut(toRgb)
    lutCache.set(toRgb, lut)
  }
  return lut
}

/**
 * The whole continuous family in one function. A mode supplies its attribute,
 * its colormap and its domain, so a measurement nobody anticipated needs no arm
 * of its own — which is what stops the switch below growing once per number
 * somebody wants to see.
 */
export function makeContinuousColorFunction(
  mode: ContinuousMode,
  attributes: Record<string, Float32Array>,
) {
  const values = attributes[mode.attribute]
  const lut = lutFor(mode.toRgb)
  return (index: number) => {
    const value = values?.[index]
    if (value === undefined || value < 0) {
      return MISSING_VALUE_COLOR
    }
    // Clamped on BOTH ends before truncating, and against the float rather than
    // an already-`| 0`'d int: `rampNorm` clamps to [0,1] itself only when the
    // mode has no custom `normalize`, and an unclamped value here indexes past
    // the LUT — or, negative, int32-truncates to a negative index. Either reads
    // `undefined`, which a Uint32Array store then writes as 0: a transparent
    // black feature, silently.
    const norm = Math.max(0, Math.min(255, rampNorm(mode, value) * 255))
    return lut[(norm + 0.5) | 0]!
  }
}

/** The payload lanes a color function reads, common to both views' fetches. */
export interface ColorFunctionInputs {
  strands: Int8Array
  refNameDict: readonly string[]
  refNameIds: Uint32Array
  mateRefNameDict: readonly string[]
  mateRefNameIds: Uint32Array
  // every numeric per-feature channel by name, which is what a continuous mode
  // indexes. The named presets are aliases into this, not separate arrays.
  attributes: Record<string, Float32Array>
  attributeRanges: Record<string, AttributeRange>
}

/**
 * `colorBy` resolved to a packed-ABGR color per FEATURE index.
 *
 * `defaultColor` is the one thing the two views legitimately disagree on: a
 * synteny ribbon's unpainted state is the red match block, a dotplot point's is
 * plain black (`colorSchemes.default.pointColor`, its conventional line color).
 * Everything above it is shared, including 'reference' — a stacked-view mode
 * that each synteny level resolves to query/target before it gets here, and
 * that a two-genome dotplot has no anchor for, so both fall back to query.
 */
export function createComparativeColorFunction({
  colorBy,
  data,
  trackColor,
  defaultColor,
  nameOrder,
}: {
  colorBy: SyntenyColorBy
  data: ColorFunctionInputs
  // the display's slot in the view's track palette; only read by colorBy:'track'
  trackColor: string
  defaultColor: number
  // Chromosome order of the assembly the chromosome-painting modes key on, so a
  // feature's color can be that chromosome's position rather than a hash bucket.
  // Only the display knows it — the assembly's refName list is a session fact,
  // not something in the feature data — so it is passed in rather than derived.
  nameOrder?: readonly string[]
}): (index: number) => number {
  // Every continuous mode in one arm, preset or attribute, so the switch below
  // does not grow per measurement.
  const continuous = resolveContinuousMode(colorBy, data.attributeRanges)
  if (continuous) {
    return makeContinuousColorFunction(continuous, data.attributes)
  }
  switch (colorBy) {
    // One flat color for every alignment in this track, so overlaid tracks are
    // told apart by hue rather than all painting the conventional default.
    case 'track': {
      const packed = cssColorToABGR(trackColor)
      return () => packed
    }
    case 'strand':
      return index => (data.strands[index] === -1 ? STRAND_NEG : STRAND_POS)
    case 'query':
    case 'reference':
      return makeNameColorFunction(data.refNameDict, data.refNameIds, nameOrder)
    case 'target':
      return makeNameColorFunction(
        data.mateRefNameDict,
        data.mateRefNameIds,
        nameOrder,
      )
    default:
      return () => defaultColor
  }
}
