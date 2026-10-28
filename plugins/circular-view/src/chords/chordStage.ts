import { MIN_RIBBON_END_PX } from './shaders/chordStage.generated.ts'
import {
  chordIsSpeck,
  footRadians as footRadiansBy,
  ribbonThinFade,
  widenedSpan,
} from './shaders/chordStage.js.generated.ts'

import type { Feature } from '@jbrowse/core/util'

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

/**
 * A point `dx`,`dy` CSS px from the circle's centre in the screen frame, on the
 * unrotated figure a rotation of `offsetRadians` turns.
 */
export function figurePoint(
  dx: number,
  dy: number,
  offsetRadians: number,
): [number, number] {
  const c = Math.cos(offsetRadians)
  const s = Math.sin(offsetRadians)
  return [dx * c + dy * s, dy * c - dx * s]
}

export function footRadians(x: number, gaps: number, stage: ChordStage) {
  return footRadiansBy(x, gaps, stage.radiansPerBp, stage.gapRadians)
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
  xGaps: Uint32Array
  yGaps: Uint32Array
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
  xGaps: Uint32Array
  x2Gaps: Uint32Array
  color: Uint32Array
  count: number
  features: readonly Feature[]
}

/**
 * Where ribbon `i`'s boundary goes: along its span, across to the mate, along
 * the mate's span, and back. The strand is in that order and nowhere else. A
 * forward alignment pairs the two spans start to start, so the mate's span is
 * walked from its last base back to its first; a reverse one pairs the span's
 * start with the mate's end. Which of the two twists depends on the arcs:
 * across a mirrored arc the reverse ribbon does, and across two arcs running
 * the same way the forward one does. Both are statements about genomic ends,
 * which is why a mirrored slice needs nothing here.
 */
export function ribbonAnglesAt(
  lanes: RibbonLanes,
  i: number,
  stage: ChordStage,
): RibbonAngles {
  const { radiusPx, offsetRadians } = stage
  const xs = lanes.xGaps[i]!
  const ys = lanes.yGaps[i]!
  const [a1, a2] = widenedSpan(
    footRadians(lanes.x1[i]!, xs, stage),
    footRadians(lanes.x2[i]!, xs, stage),
    radiusPx,
  )
  const [mStart, mEnd] = widenedSpan(
    footRadians(lanes.y1[i]!, ys, stage),
    footRadians(lanes.y2[i]!, ys, stage),
    radiusPx,
  )
  const [m1, m2] = lanes.strand[i]! < 0 ? [mStart, mEnd] : [mEnd, mStart]
  return {
    a1: a1 + offsetRadians,
    a2: a2 + offsetRadians,
    m1: m1 + offsetRadians,
    m2: m2 + offsetRadians,
  }
}

/**
 * The alpha ribbon `i` keeps under the thin fade at `floor`: its ends' true
 * width over the width the 2 px floor draws them at, as `ribbon.slang` fades it.
 */
export function ribbonFadeAt(
  lanes: RibbonLanes,
  i: number,
  stage: ChordStage,
  floor: number,
) {
  const xs = lanes.xGaps[i]!
  const ys = lanes.yGaps[i]!
  const span = (a: number, b: number, gaps: number) =>
    Math.abs(footRadians(b, gaps, stage) - footRadians(a, gaps, stage)) *
    stage.radiusPx
  return ribbonThinFade(
    span(lanes.x1[i]!, lanes.x2[i]!, xs),
    span(lanes.y1[i]!, lanes.y2[i]!, ys),
    MIN_RIBBON_END_PX,
    floor,
  )
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
    footRadians(lanes.x[i]!, lanes.xGaps[i]!, stage) + stage.offsetRadians
  const endRadians =
    footRadians(lanes.x2[i]!, lanes.x2Gaps[i]!, stage) + stage.offsetRadians
  return chordIsSpeck(startRadians, endRadians, stage.radiusPx)
    ? undefined
    : { startRadians, endRadians }
}
