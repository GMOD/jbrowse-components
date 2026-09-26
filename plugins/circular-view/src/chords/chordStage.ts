import { MIN_RIBBON_END_PX } from './shaders/chordStage.generated.ts'
import {
  chordIsSpeck,
  ribbonEndPad,
} from './shaders/chordStage.js.generated.ts'

import type { SliceRegion } from '../CircularView/slices.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * One slice of the circle on the unrolled genome axis: every slice's bases laid
 * end to end, with no gaps. Nothing here moves with a zoom or a rotation, only
 * with the regions and which of them are elided.
 */
export interface AxisSlice {
  index: number
  cumBp: number
  widthBp: number
  start: number
  reversed: boolean
  elided: boolean
}

export interface ChordAxis {
  slices: readonly AxisSlice[]
  /** keyed by `sliceKey`; an elided slice answers to each region it swallowed */
  byKey: ReadonlyMap<string, AxisSlice>
}

export function sliceKey(assemblyName: string, refName: string) {
  return `${assemblyName}\u0000${refName}`
}

export function buildChordAxis(regions: readonly SliceRegion[]): ChordAxis {
  const slices: AxisSlice[] = []
  const byKey = new Map<string, AxisSlice>()
  let cumBp = 0
  for (const region of regions) {
    const slice: AxisSlice = region.elided
      ? {
          index: slices.length,
          cumBp,
          widthBp: region.widthBp,
          start: 0,
          reversed: false,
          elided: true,
        }
      : {
          index: slices.length,
          cumBp,
          widthBp: region.widthBp,
          start: region.start,
          reversed: !!region.reversed,
          elided: false,
        }
    slices.push(slice)
    for (const r of region.elided ? region.regions : [region]) {
      byKey.set(sliceKey(r.assemblyName, r.refName), slice)
    }
    cumBp += region.widthBp
  }
  return { slices, byKey }
}

/**
 * A base's place on the unrolled axis: counted backwards through a reversed
 * slice, and at the middle of an elided one, where no base can be told apart.
 */
export function axisX(slice: AxisSlice, bp: number) {
  const offset = bp - slice.start
  return slice.elided
    ? slice.cumBp + slice.widthBp / 2
    : slice.reversed
      ? slice.cumBp + slice.widthBp - offset
      : slice.cumBp + offset
}

/**
 * The polar stage as the marks across the circle read it: the scale from the
 * unrolled axis to radians, the rotation, and the radii the curves use.
 */
export interface ChordStage {
  radiansPerBp: number
  gapRadians: number
  offsetRadians: number
  radiusPx: number
  bezierRadiusPx: number
}

export function footRadians(x: number, gaps: number, stage: ChordStage) {
  return x * stage.radiansPerBp + gaps * stage.gapRadians
}

/**
 * A span's two angles grown to `MIN_RIBBON_END_PX` of arc about where it sits,
 * in its own direction, so a reversed slice's span keeps its first base at the
 * larger angle. A span of no width grows as a forward one does.
 */
export function widenedSpan(a: number, b: number, radiusPx: number) {
  const pad = ribbonEndPad(a, b, radiusPx, MIN_RIBBON_END_PX)
  const dir = b < a ? -1 : 1
  return { start: a - dir * pad, end: b + dir * pad }
}

/** The four angles a ribbon's boundary visits, in the order it visits them. */
export interface RibbonAngles {
  a1: number
  a2: number
  m1: number
  m2: number
}

/**
 * One alignment per instance: its span `x1`..`x2` and its mate's `y1`..`y2`,
 * each in genomic order on the unrolled axis, and which way they pair.
 */
export interface RibbonLanes {
  x1: Float32Array
  x2: Float32Array
  y1: Float32Array
  y2: Float32Array
  xSlice: Uint32Array
  ySlice: Uint32Array
  strand: Float32Array
  /** packed ABGR, the alpha a dimmed instance draws at */
  color: Uint32Array
  count: number
  features: readonly Feature[]
}

/** One record per instance, a link from `x` to `x2`. */
export interface ChordLanes {
  x: Float32Array
  x2: Float32Array
  xSlice: Uint32Array
  x2Slice: Uint32Array
  color: Uint32Array
  count: number
  features: readonly Feature[]
}

/**
 * Where ribbon `i`'s boundary goes: along its span, across to the mate, along
 * the mate's span, and back. The strand is in that order and nowhere else. A
 * forward alignment pairs the two spans start to start, so the mate's span is
 * walked from its last base back to its first and the two curves do not cross;
 * a reverse one pairs the span's start with the mate's end and takes the twist
 * that is how an inversion reads on a circle. Both are statements about genomic
 * ends, which is why a mirrored slice needs nothing here.
 */
export function ribbonAnglesAt(
  lanes: RibbonLanes,
  i: number,
  stage: ChordStage,
): RibbonAngles {
  const { radiusPx, offsetRadians } = stage
  const xs = lanes.xSlice[i]!
  const ys = lanes.ySlice[i]!
  const a = widenedSpan(
    footRadians(lanes.x1[i]!, xs, stage),
    footRadians(lanes.x2[i]!, xs, stage),
    radiusPx,
  )
  const m = widenedSpan(
    footRadians(lanes.y1[i]!, ys, stage),
    footRadians(lanes.y2[i]!, ys, stage),
    radiusPx,
  )
  const [m1, m2] = lanes.strand[i]! < 0 ? [m.start, m.end] : [m.end, m.start]
  return {
    a1: a.start + offsetRadians,
    a2: a.end + offsetRadians,
    m1: m1 + offsetRadians,
    m2: m2 + offsetRadians,
  }
}

/** The two angles a chord joins, in the order the record names them. */
export interface ChordEnds {
  startRadians: number
  endRadians: number
}

/**
 * Where chord `i`'s two ends sit, or undefined for two ends under a pixel
 * apart: every deletion and insertion of a whole-genome callset, which would be
 * an antialiased speck on the rim under the ideogram.
 */
export function chordEndsAt(
  lanes: ChordLanes,
  i: number,
  stage: ChordStage,
): ChordEnds | undefined {
  const startRadians =
    footRadians(lanes.x[i]!, lanes.xSlice[i]!, stage) + stage.offsetRadians
  const endRadians =
    footRadians(lanes.x2[i]!, lanes.x2Slice[i]!, stage) + stage.offsetRadians
  return chordIsSpeck(startRadians, endRadians, stage.radiusPx)
    ? undefined
    : { startRadians, endRadians }
}
