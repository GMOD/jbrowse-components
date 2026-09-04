import { getContainingView, getSession } from '@jbrowse/core/util'

import { arcApexY } from './arcShape.ts'

import type { ArcShape } from './arcShape.ts'
import type { Feature, Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// One arc, placed — screen px with `view.offsetPx` already subtracted. Both
// displays resolve their features into this and everything downstream of it is
// shared: the canvas stroke, the export's `<path>`, and the hit test.

/** A mate-direction tick: a short horizontal mark lying over one foot's arm. */
export interface ArcTick {
  x1: number
  x2: number
  y: number
}

export interface LaidOutArc {
  feature: Feature
  key: string
  shape: ArcShape
  /** The resting stroke; hover and selection are resolved by the painter. */
  color: string
  /** Finite and positive; `layOutArcs` is what makes that true. */
  strokeWidth: number
  /**
   * The arc's whole horizontal ink extent, ticks and stroke width included —
   * both the off-screen cull and the hit test's column prefilter.
   */
  xMin: number
  xMax: number
  selected: boolean
  ticks?: readonly ArcTick[]
  label?: string
  caption?: string
}

/**
 * How far the ink reaches either side. Both shapes are contained between their
 * own two feet — the bezier's control points share its feet's x — so only the
 * stroke and the ticks reach past them.
 */
export function arcExtent(
  shape: ArcShape,
  strokeWidth: number,
  ticks?: readonly ArcTick[],
) {
  const half = strokeWidth / 2
  let xMin = Math.min(shape.left, shape.right) - half
  let xMax = Math.max(shape.left, shape.right) + half
  for (const t of ticks ?? []) {
    xMin = Math.min(xMin, t.x1 - half, t.x2 - half)
    xMax = Math.max(xMax, t.x1 + half, t.x2 + half)
  }
  return { xMin, xMax }
}

/**
 * Whether any of this arc's ink lands in the viewport. On the extent rather than
 * on `left`/`right` as given: a reversed region puts `left` past `right`, and
 * culling on the raw pair dropped arcs that were on screen.
 */
export function arcOnScreen(arc: LaidOutArc, viewWidth: number) {
  return arc.xMax >= 0 && arc.xMin <= viewWidth
}

/** One genomic point placed on screen, with the region it landed in. */
export interface ArcPoint {
  x: number
  region: Region | undefined
}

/**
 * What a display supplies for one arc. The three fields `layOutArcs` derives are
 * spelled `never` rather than dropped, because TypeScript does not
 * excess-property-check a literal returned from a callback: under a plain
 * `Omit` a `toArc` could hand back a `selected` of its own, typecheck clean and
 * lose it to spread order — and hardcoding that field `false` is what left
 * paired arcs un-highlighted by their own click.
 */
export type ArcParts = Omit<LaidOutArc, 'selected' | 'xMin' | 'xMax'> & {
  selected?: never
  xMin?: never
  xMax?: never
}

interface ArcLayoutHost extends IStateTreeNode {
  selectedFeatureId: string | undefined
}

// What Canvas2D's `lineWidth` and SVG's `stroke-width` both default to, so a
// thickness that is no width at all draws what an absent one would. Shared with
// `logThickness`, which answers it for the same reason.
export const FALLBACK_STROKE_PX = 1

// A style slot is a jexl expression over the feature, so `arcHeight`'s default
// is `-Infinity` for a zero-length feature. The extent cannot see a bezier's
// height, so the arc counted as on screen while its curve was a Canvas2D no-op
// and its hit distance `Infinity`. Flat is what a 1bp feature already gets.
function finiteShape(shape: ArcShape): ArcShape {
  return shape.kind === 'bezier' && !Number.isFinite(shape.height)
    ? { ...shape, height: 0 }
    : shape
}

// Whether there is anything to stroke, asked after the flattening above and
// answered for the ticks too. A zero-length feature puts both feet on one pixel
// and takes `arcHeight`'s `-Infinity`, so flattened it is a point: no ink, but
// `arcDistancePx` measures 0 from it, and this list is the hit test's input as
// well as the painter's — a tooltip and a click target over nothing drawn.
function hasInk(shape: ArcShape, ticks: readonly ArcTick[] | undefined) {
  return shape.left !== shape.right || arcApexY(shape) !== 0 || !!ticks?.length
}

/**
 * Both displays' `laidOutArcs`: the view and assembly lookup, the ends placed
 * in screen px, and the three fields every arc derives the same way — the
 * selection flag, a paintable stroke (`thickness` over an attribute the feature
 * lacks is NaN, which culls the arc off a canvas still reporting itself drawn)
 * and the extent. `toArc` supplies only what the two displays disagree about,
 * and `undefined` for an arc with nowhere to go.
 *
 * Everything it returns paints: an arc asked for no stroke, or laid out with no
 * ink to stroke, is not in the list at all.
 */
export function layOutArcs<S>(
  self: ArcLayoutHost,
  styles: readonly S[] | undefined,
  toArc: (
    style: S,
    place: (refName: string, coord: number) => ArcPoint | undefined,
  ) => ArcParts | undefined,
) {
  const view = getContainingView(self) as LinearGenomeViewModel
  const [assemblyName] = view.assemblyNames
  const assembly = assemblyName
    ? getSession(self).assemblyManager.get(assemblyName)
    : undefined
  if (!assembly || !view.initialized) {
    return []
  }
  const place = (refName: string, coord: number) => {
    const p = view.bpToPx({
      refName: assembly.getCanonicalRefName2(refName),
      coord,
    })
    return (
      p && {
        x: p.offsetPx - view.offsetPx,
        region: view.displayedRegions[p.index],
      }
    )
  }
  const out: LaidOutArc[] = []
  for (const style of styles ?? []) {
    const parts = toArc(style, place)
    if (parts) {
      const shape = finiteShape(parts.shape)
      // A non-finite thickness is a broken expression and takes the default
      // width; a zero or negative one is `jexl:score>5?3:0` asking for this arc
      // to be hidden, and hiding it means leaving the list rather than being
      // painted at 1px.
      const strokeWidth = Number.isFinite(parts.strokeWidth)
        ? parts.strokeWidth
        : FALLBACK_STROKE_PX
      if (strokeWidth > 0 && hasInk(shape, parts.ticks)) {
        out.push({
          ...parts,
          shape,
          strokeWidth,
          selected: parts.feature.id() === self.selectedFeatureId,
          ...arcExtent(shape, strokeWidth, parts.ticks),
        })
      }
    }
  }
  return out
}

const LABEL_BASELINE_OFFSET_PX = 3

/**
 * Baseline y for this arc's label. One number, because the canvas painter and
 * the export's `<text>` both place it and a nudge to one is invisible until
 * someone compares a figure against the screen.
 */
export function arcLabelBaselineY(arc: LaidOutArc) {
  return arcApexY(arc.shape) + LABEL_BASELINE_OFFSET_PX
}
