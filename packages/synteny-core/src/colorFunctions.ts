import { refNameColor, refNamePaletteColorAt } from '@jbrowse/core/ui/colors'
import { cssColorToABGR, packAbgr } from '@jbrowse/core/util/colorBits'

import { rampNorm, resolveContinuousMode } from './colorRamps.ts'
import { colorSchemes } from './colorUtils.ts'

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

/**
 * The palette color for a chromosome at `position` in its assembly, packed.
 *
 * The palette itself is core's (`refNamePaletteColorAt`), because the alignments
 * display's chromosome painting has to hand out the same colors — it used to
 * hash where this hands out, so the same contig took one color in a synteny view
 * and another in a pileup beside it.
 */
export function paletteColorAt(position: number) {
  return cssColorToABGR(refNamePaletteColorAt(position))
}

/**
 * Chromosome painting against a dictionary-encoded refName lane.
 *
 * BY POSITION IN THE ASSEMBLY when the caller knows the chromosome order, which
 * both displays do — they read the relevant axis' assembly refName list. So the
 * palette is handed out rather than hashed into, and a genome cannot paint two
 * of its chromosomes the same color the way a hash does. `refNameColor` is that
 * rule and its fallback; see it for what the hash costs.
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
  const lut = Uint32Array.from(dict, name =>
    cssColorToABGR(refNameColor(name, orderOf?.get(name))),
  )
  return (index: number) => lut[ids[index]!]!
}

/**
 * #api
 * One name's chromosome-painting color, resolved against an assembly's refName
 * list and handed back as CSS — what a Canvas2D overlay needs, where the
 * renderers want packed ABGR.
 *
 * The single-name form of the LUT above, because a second reader has turned up
 * that is not painting features: the off-screen mate marks stand for alignments
 * to a contig the facing row is not showing, and a mark colored like the ribbons
 * to that contig is what says a ribbon did not vanish, it moved. Two palettes
 * would put a mark and its ribbons in different colors, which is exactly the
 * drift this module exists to prevent — see the header.
 */
export function nameColorCss(
  refName: string,
  nameOrder: readonly string[] | undefined,
) {
  const position = nameOrder?.indexOf(refName)
  return refNameColor(
    refName,
    position === undefined || position < 0 ? undefined : position,
  )
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
  attributeRanges,
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
  // The domain an `attribute:<name>` ramp scales to. A VIEW-level input, like
  // `nameOrder` and for the same reason: a fetch's payload knows only the span
  // of the slice it holds, and painting from that re-maps every feature onto
  // the ramp each time the window rolls over — a ribbon in the middle of the
  // ramp turns into one at the bottom while the reader is scrolling, without
  // its value having changed. The view accumulates the span it has seen
  // (`TrackColorsMixin.attributeRanges`), which only ever widens, and hands it
  // down here. The named presets carry their own fixed domains and ignore this.
  attributeRanges: Record<string, AttributeRange>
}): (index: number) => number {
  // Every continuous mode in one arm, preset or attribute, so the switch below
  // does not grow per measurement.
  const continuous = resolveContinuousMode(colorBy, attributeRanges)
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
