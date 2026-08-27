import { toLocale } from '@jbrowse/core/util'
import { cssColorToABGR, withAbgrAlpha } from '@jbrowse/core/util/colorBits'

import { KIND_BASE, KIND_MARKER } from '../LinearSyntenyRPC/syntenyColors.ts'
import {
  MIN_ARROW_GLYPH_PX,
  UTR_HEIGHT_FRACTION,
  geneGlyphGeometry,
  isAnnotated,
} from './geneGlyph.ts'
import { frameTickXs } from './layoutMultiWay.ts'
import { PX_ORIGIN } from './multiwayRenderTypes.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { Lane, LaneBand, LaneStack } from './laneStack.ts'
import type { Span } from './layoutMultiWay.ts'
import type {
  GlyphHit,
  LaneGlyphData,
  MultiWayCell,
  RibbonLayer,
  RibbonTarget,
} from './multiwayRenderTypes.ts'
import type { Feature } from '@jbrowse/core/util'

// ribbons narrower than this on both ends are clutter at alignment-record
// density; the boxes they connect are still drawn in the lanes
const MIN_RIBBON_PX = 2
const BOX_ALPHA = 64
// a ribbon bridging a lane that places nothing draws at half the pair
// ribbons' opacity: it crosses a lane it does not belong to
const BRIDGE_ALPHA_SCALE = 0.5

export function ribbonsKey(row: number, toRow = row + 1) {
  return toRow === row + 1 ? `ribbons:${row}` : `ribbons:${row}>${toRow}`
}
export function ticksKey(row: number) {
  return `ticks:${row}`
}
export function glyphsKey(row: number) {
  return `glyphs:${row}`
}
export const BANDS_KEY = 'bands'

function wideEnough(s1: Span, s2: Span) {
  return (
    Math.max(Math.abs(s1[1] - s1[0]), Math.abs(s2[1] - s2[0])) >= MIN_RIBBON_PX
  )
}

function fmt(n: number) {
  return toLocale(Math.round(n))
}

function* lanePairs(lanes: Lane[], glyphHeight: number) {
  for (let row = 0; row + 1 < lanes.length; row++) {
    const upper = lanes[row]!
    const lower = lanes[row + 1]!
    yield {
      row,
      upper,
      lower,
      y1: upper.glyphTop + glyphHeight,
      y2: lower.glyphTop,
    }
  }
}

/**
 * Ribbon corners the way the synteny passes read them: `bp1`→`bp4` is one
 * edge and `bp2`→`bp3` the other, so the two spans are ORDERED pairs joined
 * end to end. A reverse-strand placement hands its lower span reversed and
 * the parallelogram comes out crossed, which is the whole of drawing an
 * inversion.
 */
class RibbonBuilder {
  bp1: number[] = []
  bp2: number[] = []
  bp3: number[] = []
  bp4: number[] = []
  kinds: number[] = []
  featureIdx: number[] = []
  lengths: number[] = []
  colors: number[] = []

  add(s1: Span, s2: Span, kind: number, featureIdx: number, color: number) {
    this.bp1.push(s1[0])
    this.bp2.push(s1[1])
    this.bp4.push(s2[0])
    this.bp3.push(s2[1])
    this.kinds.push(kind)
    this.featureIdx.push(featureIdx)
    this.lengths.push(
      Math.max(Math.abs(s1[1] - s1[0]), Math.abs(s2[1] - s2[0]), 1),
    )
    this.colors.push(color)
  }

  build(): MultiWayCell {
    const data: SyntenyInstanceData = {
      bp1: Float32Array.from(this.bp1),
      bp2: Float32Array.from(this.bp2),
      bp3: Float32Array.from(this.bp3),
      bp4: Float32Array.from(this.bp4),
      base0: 0,
      base1: 0,
      kinds: Uint8Array.from(this.kinds),
      instanceFeatureIdx: Uint32Array.from(this.featureIdx),
      alignmentLengths: Float32Array.from(this.lengths),
      instanceCount: this.bp1.length,
      colors: Uint32Array.from(this.colors),
    }
    return { kind: 'ribbons', data }
  }
}

export interface RibbonGeometry {
  cells: Map<string, MultiWayCell>
  layers: RibbonLayer[]
  /** what a ribbon opens and names; a ribbon's `instanceFeatureIdx` indexes it */
  targets: RibbonTarget[]
  /** the target every ribbon of a group shares, so one hover lights the group in every gutter */
  groupTarget: Map<string, number>
}

/**
 * The ortholog ribbons between each adjacent lane pair, one per pair of runs
 * both lanes place, and from the second gutter down the direct alignment
 * records an all-vs-all source fetched for that pair.
 */
export function buildRibbonGeometry({
  stack,
  laneLinks,
  ribbonColor,
  drawCurves,
  bridgeSkippedLanes,
}: {
  stack: LaneStack
  laneLinks: Map<string, Feature[]> | undefined
  ribbonColor: string
  drawCurves: boolean
  /**
   * join a group across a lane that does not place it, to the next lane down
   * that does; off, the chain breaks at every lane the group is missing from
   */
  bridgeSkippedLanes: boolean
}): RibbonGeometry {
  const { lanes, glyphHeight } = stack
  const color = cssColorToABGR(ribbonColor)
  const bridgeColor = withAbgrAlpha(
    color,
    Math.round((color >>> 24) * BRIDGE_ALPHA_SCALE),
  )
  const cells = new Map<string, MultiWayCell>()
  const layers: RibbonLayer[] = []
  const targets: RibbonTarget[] = []
  const groupTarget = new Map<string, number>()
  const targetOfGroup = (key: string, feature: Feature) => {
    let idx = groupTarget.get(key)
    if (idx === undefined) {
      idx = targets.length
      targets.push({ feature, groupKey: key, label: key })
      groupTarget.set(key, idx)
    }
    return idx
  }
  for (const { row, upper, lower, y1, y2 } of lanePairs(lanes, glyphHeight)) {
    const ribbons = new RibbonBuilder()
    const bridges = new Map<number, RibbonBuilder>()
    for (const [key, { group, spans }] of upper.placements) {
      let toRow = row + 1
      let far = lower.placements.get(key)
      while (!far && bridgeSkippedLanes && toRow + 1 < lanes.length) {
        far = lanes[++toRow]!.placements.get(key)
      }
      if (!far) {
        continue
      }
      const bridged = toRow !== row + 1
      let builder = ribbons
      if (bridged) {
        builder = bridges.get(toRow) ?? new RibbonBuilder()
        bridges.set(toRow, builder)
      }
      for (const s1 of spans) {
        for (const s2 of far.spans) {
          if (wideEnough(s1, s2)) {
            builder.add(
              s1,
              s2,
              KIND_BASE,
              targetOfGroup(key, group.feature),
              bridged ? bridgeColor : color,
            )
          }
        }
      }
    }
    for (const link of row > 0
      ? (laneLinks?.get(`${upper.assemblyName}|${lower.assemblyName}`) ?? [])
      : []) {
      const mate = link.get('mate') as {
        refName: string
        start: number
        end: number
      }
      const s1 = upper.spanOf(
        link.get('refName'),
        link.get('start'),
        link.get('end'),
      )
      const s2 = lower.spanOf(mate.refName, mate.start, mate.end)
      if (s1 && s2 && wideEnough(s1, s2)) {
        const ordered: Span = link.get('strand') === -1 ? [s2[1], s2[0]] : s2
        const idx = targets.length
        targets.push({
          feature: link,
          label: `${upper.assemblyName} ${link.get('refName')}:${fmt(link.get('start'))}-${fmt(link.get('end'))}\n${lower.assemblyName} ${mate.refName}:${fmt(mate.start)}-${fmt(mate.end)}`,
        })
        ribbons.add(s1, ordered, KIND_BASE, idx, color)
      }
    }
    const key = ribbonsKey(row)
    cells.set(key, ribbons.build())
    layers.push({
      kind: 'ribbons',
      key,
      yTop: y1,
      height: y2 - y1,
      curves: drawCurves,
    })
    for (const [toRow, builder] of bridges) {
      const bridgeKey = ribbonsKey(row, toRow)
      cells.set(bridgeKey, builder.build())
      layers.push({
        kind: 'ribbons',
        key: bridgeKey,
        yTop: y1,
        height: lanes[toRow]!.glyphTop - y1,
        curves: drawCurves,
      })
    }
  }
  return { cells, layers, targets, groupTarget }
}

export interface TickGeometry {
  cells: Map<string, MultiWayCell>
  layers: RibbonLayer[]
}

/**
 * Each lane's own ticks at one shared bp interval, as the synteny passes'
 * zero-width location markers: a marker's two corners coincide per axis, so
 * it draws as a 1px vertical line at its packed alpha, hover and all.
 */
export function buildTickGeometry({
  stack,
  tickIntervalBp,
  width,
  color,
}: {
  stack: LaneStack
  tickIntervalBp: number
  width: number
  color: string
}): TickGeometry {
  const packed = cssColorToABGR(color)
  const cells = new Map<string, MultiWayCell>()
  const layers: RibbonLayer[] = []
  stack.lanes.forEach((lane, row) => {
    if (!lane.frame) {
      return
    }
    const ticks = new RibbonBuilder()
    for (const x of frameTickXs(lane.frame, tickIntervalBp, width)) {
      ticks.add([x, x], [x, x], KIND_MARKER, 0, packed)
    }
    const key = ticksKey(row)
    cells.set(key, ticks.build())
    layers.push({
      kind: 'ribbons',
      key,
      yTop: lane.bandTop,
      height: stack.bandHeight,
      curves: false,
    })
  })
  return { cells, layers }
}

function toU32(px: number) {
  return Math.max(0, Math.round(PX_ORIGIN + px))
}

class GlyphBuilder {
  rectPositions: number[] = []
  rectYs: number[] = []
  rectHeights: number[] = []
  rectColors: number[] = []
  rectStrands: number[] = []
  linePositions: number[] = []
  lineYs: number[] = []
  lineHeights: number[] = []
  lineColors: number[] = []
  lineDirections: number[] = []
  arrowXs: number[] = []
  arrowYs: number[] = []
  arrowHeights: number[] = []
  arrowWidths: number[] = []
  arrowDirections: number[] = []
  arrowColors: number[] = []
  hits: GlyphHit[] = []
  outlineColor = 0

  rect(x1: number, x2: number, y: number, height: number, color: number) {
    this.rectPositions.push(toU32(Math.min(x1, x2)), toU32(Math.max(x1, x2)))
    this.rectYs.push(y)
    this.rectHeights.push(height)
    this.rectColors.push(color)
    this.rectStrands.push(0)
  }

  line(
    x1: number,
    x2: number,
    y: number,
    height: number,
    direction: number,
    color: number,
  ) {
    this.linePositions.push(toU32(x1), toU32(x2))
    this.lineYs.push(y)
    this.lineHeights.push(height)
    this.lineDirections.push(direction)
    this.lineColors.push(color)
  }

  arrow(
    x: number,
    widthPx: number,
    y: number,
    height: number,
    direction: number,
    color: number,
  ) {
    this.arrowXs.push(toU32(x))
    this.arrowYs.push(y)
    this.arrowHeights.push(height)
    this.arrowWidths.push(Math.round(widthPx))
    this.arrowDirections.push(direction)
    this.arrowColors.push(color)
  }

  build(): LaneGlyphData {
    return {
      rectPositions: Uint32Array.from(this.rectPositions),
      rectYs: Float32Array.from(this.rectYs),
      rectHeights: Float32Array.from(this.rectHeights),
      rectColors: Uint32Array.from(this.rectColors),
      rectStrands: Float32Array.from(this.rectStrands),
      rectDensityFade: new Uint32Array(this.rectYs.length),
      linePositions: Uint32Array.from(this.linePositions),
      lineYs: Float32Array.from(this.lineYs),
      lineHeights: Float32Array.from(this.lineHeights),
      lineColors: Uint32Array.from(this.lineColors),
      lineDirections: Int8Array.from(this.lineDirections),
      arrowXs: Uint32Array.from(this.arrowXs),
      arrowYs: Float32Array.from(this.arrowYs),
      arrowHeights: Float32Array.from(this.arrowHeights),
      arrowWidthsBp: Uint32Array.from(this.arrowWidths),
      arrowDirections: Int8Array.from(this.arrowDirections),
      arrowColors: Uint32Array.from(this.arrowColors),
      outlineColor: this.outlineColor,
      hits: this.hits,
    }
  }
}

/**
 * An opaque band per mate lane, tiling everything below the anchor so the
 * view's gridlines — true only at the anchor's scale — stop where the anchor
 * does. Unscrolled: a band is chrome pinned to the track. Built off the lane
 * geometry alone, so a pan, a zoom or a settle that moves every other cell
 * leaves this one's identity, and its upload, where it was.
 */
export function buildBandCell({
  bands,
  width,
  paper,
  stripe,
}: {
  bands: LaneBand[]
  width: number
  paper: string
  stripe: string
}): LaneGlyphData {
  const paperColor = cssColorToABGR(paper)
  const stripeColor = cssColorToABGR(stripe)
  const glyphs = new GlyphBuilder()
  bands.forEach((band, row) => {
    if (row === 0) {
      return
    }
    const height = band.bandEnd - band.bandStart
    glyphs.rect(0, width, band.bandStart, height, paperColor)
    if (row % 2 === 1) {
      glyphs.rect(0, width, band.bandStart, height, stripeColor)
    }
  })
  return glyphs.build()
}

export interface LaneGlyphColors {
  colorOf: (slot: 'color' | 'utrColor', feature: Feature) => string
  stroke: string
  divider: string
}

function onCanvas(span: Span, width: number) {
  return (
    Math.max(span[0], span[1]) >= -width / 2 &&
    Math.min(span[0], span[1]) <= 1.5 * width
  )
}

/**
 * What one lane draws on its baseline: its gene models where it has an
 * annotation, and the table's own placement box, outlined rather than filled,
 * where it does not — per GROUP, since a table pairing genes the lane's GFF3
 * does not name is the ordinary case. Culled to half a screen either side,
 * which is as far as a pan can carry the stack before it re-lays out.
 */
export function buildLaneGlyphCell({
  lane,
  glyphHeight,
  width,
  colors,
}: {
  lane: Lane
  glyphHeight: number
  width: number
  colors: LaneGlyphColors
}): LaneGlyphData {
  const glyphs = new GlyphBuilder()
  const y = lane.glyphTop
  const stroke = cssColorToABGR(colors.stroke)
  glyphs.line(
    -width,
    2 * width,
    y,
    glyphHeight,
    0,
    cssColorToABGR(colors.divider),
  )
  // a slot answers the same few strings for a whole lane; parse each once
  const packed = new Map<string, number>()
  const pack = (css: string) => {
    let color = packed.get(css)
    if (color === undefined) {
      color = cssColorToABGR(css)
      packed.set(css, color)
    }
    return color
  }

  const annotated: Span[] = []
  for (const gene of lane.genes) {
    const { feature } = gene
    const refName = feature.get('refName')
    const span = lane.spanOf(refName, feature.get('start'), feature.get('end'))
    if (span === undefined || !onCanvas(span, width)) {
      continue
    }
    annotated.push(span)
    const { left, right, pxDir, full, thin } = geneGlyphGeometry(
      gene,
      span,
      (start, end) => lane.spanOf(refName, start, end),
    )
    const color = pack(colors.colorOf('color', feature))
    const utrColor = pack(colors.colorOf('utrColor', feature))
    glyphs.line(left, right, y, glyphHeight, pxDir, stroke)
    const utrY = y + ((1 - UTR_HEIGHT_FRACTION) / 2) * glyphHeight
    for (const [x1, x2] of thin) {
      glyphs.rect(x1, x2, utrY, glyphHeight * UTR_HEIGHT_FRACTION, utrColor)
    }
    for (const [x1, x2] of full) {
      glyphs.rect(x1, x2, y, glyphHeight, color)
    }
    if (pxDir !== 0 && right - left >= MIN_ARROW_GLYPH_PX) {
      glyphs.arrow(
        pxDir === 1 ? right : left,
        right - left,
        y,
        glyphHeight,
        pxDir,
        stroke,
      )
    }
    glyphs.hits.push({
      x1: left,
      x2: right,
      y1: y,
      y2: y + glyphHeight,
      feature,
      label: feature.get('name') ?? feature.id(),
    })
  }

  for (const [key, { group, spans }] of lane.placements) {
    for (const span of spans) {
      if (isAnnotated(annotated, span)) {
        continue
      }
      const color = pack(colors.colorOf('color', group.feature))
      if (glyphs.outlineColor === 0) {
        glyphs.outlineColor = color
      }
      const [boxLeft, boxRight] = span[0] <= span[1] ? span : [span[1], span[0]]
      glyphs.rect(
        boxLeft,
        Math.max(boxLeft + 1, boxRight),
        y + 1,
        Math.max(1, glyphHeight - 2),
        withAbgrAlpha(color, BOX_ALPHA),
      )
      glyphs.hits.push({
        x1: boxLeft,
        x2: Math.max(boxLeft + 1, boxRight),
        y1: y,
        y2: y + glyphHeight,
        feature: group.feature,
        groupKey: key,
        label: key,
      })
    }
  }
  return glyphs.build()
}

/** the glyph hit under a render-origin px point, topmost first: boxes draw over genes */
export function glyphHitAt(hits: GlyphHit[], x: number, y: number) {
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i]!
    if (x >= h.x1 && x <= h.x2 && y >= h.y1 && y <= h.y2) {
      return h
    }
  }
  return undefined
}
