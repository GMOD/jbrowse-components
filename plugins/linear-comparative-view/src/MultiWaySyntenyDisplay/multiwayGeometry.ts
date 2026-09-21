import { toLocale } from '@jbrowse/core/util'
import { cssColorToABGR, withAbgrAlpha } from '@jbrowse/core/util/colorBits'
import { UTR_HEIGHT_FRACTION, centerShrink } from '@jbrowse/plugin-canvas'
import {
  categoricalColor,
  colorSchemes,
  makeContinuousColorFunction,
  readChannelValue,
  resolveCategoricalMode,
  resolveContinuousMode,
} from '@jbrowse/synteny-core'

import { KIND_BASE, KIND_MARKER } from '../LinearSyntenyRPC/syntenyColors.ts'
import { annotatedSpans, geneGlyphGeometry } from './geneGlyph.ts'
import {
  frameMagnification,
  frameReachPx,
  frameTickXs,
  groupSpansLanes,
} from './layoutMultiWay.ts'
import { PX_ORIGIN } from './multiwayRenderTypes.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { GeneColors } from './geneColor.ts'
import type { LaneGene } from './geneGlyph.ts'
import type { Lane, LaneBand, LaneStack } from './laneStack.ts'
import type { MultiWayGroup, Span } from './layoutMultiWay.ts'
import type {
  GlyphHit,
  LaneGlyphData,
  MultiWayCell,
  RibbonLayer,
  RibbonTarget,
} from './multiwayRenderTypes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { AttributeRange } from '@jbrowse/synteny-core'

// ribbons narrower than this on both ends are clutter at alignment-record
// density; the boxes they connect are still drawn in the lanes
const MIN_RIBBON_PX = 2
const BOX_ALPHA = 64

export function ribbonsKey(row: number, toRow = row + 1) {
  return toRow === row + 1 ? `ribbons:${row}` : `ribbons:${row}>${toRow}`
}
export function ticksKey(row: number) {
  return `ticks:${row}`
}
export function glyphsKey(row: number) {
  return `glyphs:${row}`
}
export function boxesKey(row: number) {
  return `boxes:${row}`
}
export const BANDS_KEY = 'bands'
/** the clicked group's outline over the gutter `key` draws */
export function outlineKey(key: string) {
  return `${key}:outline`
}

// at the widest either lane draws it, which a transition can make wider than
// it was packed
function wideEnough(s1: Span, s2: Span, upper: Lane, lower: Lane) {
  return (
    Math.max(
      Math.abs(s1[1] - s1[0]) * magnification(upper),
      Math.abs(s2[1] - s2[0]) * magnification(lower),
    ) >= MIN_RIBBON_PX
  )
}

function magnification(lane: Lane) {
  return lane.frame ? frameMagnification(lane.frame) : 1
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

/**
 * A ribbon's color from what it joins. `strand` is the two runs' strands
 * against the anchor multiplied out — the record's strand, as the synteny
 * view means it — and not the drawn twist: a lane whose every placement is
 * inverted is drawn flipped, so its ribbons run straight while every one of
 * them is an inversion. A measurement or a numeric column paints the synteny
 * view's ramp and a text column one color per label, and a pair carrying no
 * value keeps the slot color, since the synteny view's missing-data red would
 * read as a value on a grey-ribbon stack. Every mode keeps the slot color's
 * alpha; an unlabelled pair the reader hid draws at none.
 */
function ribbonColorer(
  field: string,
  slotColor: number,
  attributeRanges: Record<string, AttributeRange>,
  hideUnlabelled: boolean,
) {
  const alpha = slotColor >>> 24
  if (field === 'strand') {
    const pos = withAbgrAlpha(
      cssColorToABGR(colorSchemes.strand.posColor),
      alpha,
    )
    const neg = withAbgrAlpha(
      cssColorToABGR(colorSchemes.strand.negColor),
      alpha,
    )
    return (strand: number) => (strand < 0 ? neg : pos)
  }
  const continuous = resolveContinuousMode(field, attributeRanges)
  if (continuous) {
    const value = new Float32Array(1)
    const ramp = makeContinuousColorFunction(continuous, {
      [continuous.attribute]: value,
    })
    return (_strand: number, feature: Feature) => {
      value[0] = readChannelValue(feature, continuous.attribute)
      return value[0] < 0 ? slotColor : withAbgrAlpha(ramp(0), alpha)
    }
  }
  const categorical = resolveCategoricalMode(field, attributeRanges)
  if (categorical) {
    const unlabelled = hideUnlabelled ? withAbgrAlpha(slotColor, 0) : slotColor
    const lut = new Map(
      categorical.labels.map(label => [
        label,
        withAbgrAlpha(
          cssColorToABGR(categoricalColor(categorical, label)),
          alpha,
        ),
      ]),
    )
    return (_strand: number, feature: Feature) => {
      const value: unknown = feature.get(categorical.attribute)
      const label =
        typeof value === 'string'
          ? value
          : typeof value === 'number'
            ? String(value)
            : undefined
      return (label === undefined ? undefined : lut.get(label)) ?? unlabelled
    }
  }
  return () => slotColor
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
 * records an alignment source fetched for that pair.
 */
export function buildRibbonGeometry({
  stack,
  laneLinks,
  ribbonColor,
  ribbonColorField = '',
  attributeRanges = {},
  hideUnlabelled = false,
  drawCurves,
  bridgeSkippedLanes,
}: {
  stack: LaneStack
  /** per `upper|lower` pair, the direct records fetched for it */
  laneLinks: ReadonlyMap<string, { links: Feature[] }> | undefined
  ribbonColor: string
  ribbonColorField?: string
  /** what the ramp and label modes paint from; see the model's `ribbonAttributeRanges` */
  attributeRanges?: Record<string, AttributeRange>
  hideUnlabelled?: boolean
  drawCurves: boolean
  /**
   * join a group across a lane that does not place it, to the next lane down
   * that does; off, the chain breaks at every lane the group is missing from
   */
  bridgeSkippedLanes: boolean
}): RibbonGeometry {
  const { lanes, glyphHeight } = stack
  const color = cssColorToABGR(ribbonColor)
  const colorOf = ribbonColorer(
    ribbonColorField,
    color,
    attributeRanges,
    hideUnlabelled,
  )
  const cells = new Map<string, MultiWayCell>()
  const layers: RibbonLayer[] = []
  const targets: RibbonTarget[] = []
  const groupTarget = new Map<string, number>()
  // One target per group, shared by every gutter — which is what lets one
  // hover light the whole chain, and also what stops the label naming a lane
  // PAIR. What it can name is the group's identity: its key and where the
  // anchor puts it. A bare key left the reader a gene name and nothing to
  // locate it by, where a direct-link ribbon has printed both loci all along
  const anchor = lanes[0]
  const targetOfGroup = (key: string, group: MultiWayGroup) => {
    let idx = groupTarget.get(key)
    if (idx === undefined) {
      idx = targets.length
      const { refName, start, end } = group.anchor
      targets.push({
        feature: group.feature,
        groupKey: key,
        label: anchor
          ? `${key}\n${anchor.assemblyName} ${anchor.canon(refName)}:${fmt(start)}-${fmt(end)}`
          : key,
      })
      groupTarget.set(key, idx)
    }
    return idx
  }
  for (const { row, upper, lower, y1, y2 } of lanePairs(lanes, glyphHeight)) {
    const ribbons = new RibbonBuilder()
    const bridges = new Map<number, RibbonBuilder>()
    for (const [key, { group, spans, orientations }] of upper.placements) {
      let toRow = row + 1
      let far = lower.placements.get(key)
      const bridging = bridgeSkippedLanes && groupSpansLanes(group)
      while (!far && bridging && toRow + 1 < lanes.length) {
        far = lanes[++toRow]!.placements.get(key)
      }
      if (!far) {
        continue
      }
      const bridged = toRow !== row + 1
      const farLane = lanes[toRow]!
      let builder = ribbons
      if (bridged) {
        builder = bridges.get(toRow) ?? new RibbonBuilder()
        bridges.set(toRow, builder)
      }
      spans.forEach((s1, i) => {
        far.spans.forEach((s2, j) => {
          if (wideEnough(s1, s2, upper, farLane)) {
            builder.add(
              s1,
              s2,
              KIND_BASE,
              targetOfGroup(key, group),
              colorOf(orientations[i]! * far.orientations[j]!, group.feature),
            )
          }
        })
      })
    }
    for (const link of row > 0
      ? (laneLinks?.get(`${upper.assemblyName}|${lower.assemblyName}`)?.links ??
        [])
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
      if (s1 && s2 && wideEnough(s1, s2, upper, lower)) {
        const ordered: Span = link.get('strand') === -1 ? [s2[1], s2[0]] : s2
        const idx = targets.length
        const via = link.get('composedThrough') as
          | { refName: string; start: number; end: number }
          | undefined
        targets.push({
          feature: link,
          label: [
            `${upper.assemblyName} ${upper.canon(link.get('refName'))}:${fmt(link.get('start'))}-${fmt(link.get('end'))}`,
            `${lower.assemblyName} ${lower.canon(mate.refName)}:${fmt(mate.start)}-${fmt(mate.end)}`,
            ...(via && anchor
              ? [
                  `composed through ${anchor.assemblyName} ${anchor.canon(via.refName)}:${fmt(via.start)}-${fmt(via.end)}, not aligned directly`,
                ]
              : []),
          ].join('\n'),
        })
        ribbons.add(
          s1,
          ordered,
          KIND_BASE,
          idx,
          colorOf(link.get('strand') === -1 ? -1 : 1, link),
        )
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
      rows: [row, row + 1],
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
        rows: [row, toRow],
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
 * Each lane's own ticks at one shared bp interval, over the stretch its
 * baseline draws, as the synteny passes' zero-width location markers: a
 * marker's two corners coincide per axis, so it draws as a 1px vertical line
 * at its packed alpha, hover and all.
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
      if (lane.baseline.some(([x1, x2]) => x >= x1 && x <= x2)) {
        ticks.add([x, x], [x, x], KIND_MARKER, 0, packed)
      }
    }
    const key = ticksKey(row)
    cells.set(key, ticks.build())
    layers.push({
      kind: 'ribbons',
      key,
      yTop: lane.bandTop,
      height: stack.bandHeight,
      curves: false,
      rows: [row, row],
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
  /** the lane's own genes */
  genes: GeneColors
  /** the placement boxes, off the groups' own records */
  boxes: GeneColors
  stroke: string
  divider: string
}

function onCanvas(span: Span, [left, right]: Span) {
  return (
    Math.max(span[0], span[1]) >= left && Math.min(span[0], span[1]) <= right
  )
}

// the anchor lane's half screen either side, and a mate lane's frame reach,
// which a transition widens to every frame it moves between
function laneReachPx(lane: Lane, width: number): Span {
  return lane.frame
    ? frameReachPx(lane.frame, width)
    : [-width / 2, 1.5 * width]
}

export interface LaneCells {
  glyphs: LaneGlyphData
  boxes: LaneGlyphData
}

interface DrawnGene {
  gene: LaneGene
  span: Span
  /** the group the gene carries, which `cluster` paints it by */
  cluster?: string
}

interface LaneBox {
  key: string
  group: MultiWayGroup
  span: Span
}

/**
 * Which placements a lane's drawn genes stand in for. A placement one of them
 * overlaps is that gene's, the widest overlap where several do; a placement no
 * gene overlaps is a box. A gene claimed twice — a tandem array, a clipped
 * edge — carries the widest claim, the group it is mostly made of.
 *
 * In bp on the lane's own sequence, so a gene straddling the edge claims the
 * same group whatever the frame clips off it.
 */
function claimPlacements(lane: Lane, drawn: DrawnGene[]) {
  const onRef = new Map<string, { spans: Span[]; drawn: DrawnGene[] }>()
  for (const d of drawn) {
    const { feature } = d.gene
    const ref = lane.canon(feature.get('refName'))
    const genes = onRef.get(ref) ?? { spans: [], drawn: [] }
    genes.spans.push([feature.get('start'), feature.get('end')])
    genes.drawn.push(d)
    onRef.set(ref, genes)
  }
  const covering = new Map(
    [...onRef].map(([ref, genes]) => [
      ref,
      { cover: annotatedSpans(genes.spans), drawn: genes.drawn },
    ]),
  )
  const widest = new Map<DrawnGene, number>()
  const boxes: LaneBox[] = []
  for (const [key, { group, spans, intervals }] of lane.placements) {
    intervals.forEach(({ refName, start, end }, i) => {
      const genes = covering.get(lane.canon(refName))
      const cover = genes?.cover([start, end])
      if (genes && cover) {
        const gene = genes.drawn[cover.index]!
        if (cover.overlap > (widest.get(gene) ?? 0)) {
          widest.set(gene, cover.overlap)
          gene.cluster = key
        }
      } else {
        boxes.push({ key, group, span: spans[i]! })
      }
    })
  }
  return boxes
}

// the line shows between a lane's two strand rows
const STRAND_GAP_PX = 2

/**
 * Where a gene sits on its lane: the whole glyph row, or with the strands split
 * the half above the line for one reading rightwards on screen and the half
 * below for one reading leftwards, as gggenomes' `position_strand` stacks them.
 * A strandless gene takes the upper row.
 */
function geneRow(lane: Lane, glyphHeight: number, pxDir: number) {
  if (lane.strandRows === undefined) {
    return { top: lane.glyphTop, height: glyphHeight }
  }
  const height = (glyphHeight - STRAND_GAP_PX) / 2
  return {
    top:
      pxDir * lane.strandRows < 0
        ? lane.glyphTop + glyphHeight - height
        : lane.glyphTop,
    height,
  }
}

/**
 * What one lane draws on its baseline: its gene models where it has an
 * annotation, and the table's own placement box, outlined rather than filled,
 * where it does not — per GROUP, since a table pairing genes the lane's GFF3
 * does not name is the ordinary case. Culled to half a screen either side of
 * what the lane shows, which is as far as a pan can carry the stack before it
 * re-lays out.
 *
 * TWO cells, because `outlineColor` is a per-cell uniform the rect pass applies
 * to every rect it holds: the boxes take the lane's stroke as their border,
 * so a box is distinguishable from a washed-out gene, and a
 * gene takes none, the feature track's own default.
 */
export function buildLaneCells({
  lane,
  genes,
  glyphHeight,
  width,
  colors,
}: {
  lane: Lane
  /** the lane's own gene models, none until its fetch lands */
  genes: LaneGene[]
  glyphHeight: number
  width: number
  colors: LaneGlyphColors
}): LaneCells {
  const glyphs = new GlyphBuilder()
  const boxes = new GlyphBuilder()
  const y = lane.glyphTop
  // rect takes the box top, line and arrow take its centre — the feature
  // track's own split, stated at featureGlyphShapes.ts's `centeredRowVisible`
  // and in line.slang/arrow.slang's `snapBoxCenterY`
  const centerY = y + glyphHeight / 2
  const stroke = cssColorToABGR(colors.stroke)
  const reach = laneReachPx(lane, width)
  boxes.outlineColor = stroke
  const divider = cssColorToABGR(colors.divider)
  for (const [x1, x2] of lane.baseline) {
    glyphs.line(x1, x2, centerY, glyphHeight, 0, divider)
  }

  const drawn: DrawnGene[] = []
  for (const gene of genes) {
    const { feature } = gene
    const span = lane.spanOf(
      feature.get('refName'),
      feature.get('start'),
      feature.get('end'),
    )
    if (span !== undefined && onCanvas(span, reach)) {
      drawn.push({ gene, span })
    }
  }
  const unclaimed = claimPlacements(lane, drawn)

  for (const { gene, span, cluster } of drawn) {
    const { feature } = gene
    const refName = feature.get('refName')
    const { left, right, pxDir, full, thin, introns } = geneGlyphGeometry(
      gene,
      span,
      (start, end) => lane.spanOf(refName, start, end),
    )
    const fill = colors.genes.fill(feature, cluster)
    const utrColor = colors.genes.utr(feature)
    const row = geneRow(lane, glyphHeight, pxDir)
    const rowCenter = row.top + row.height / 2
    for (const [x1, x2] of introns) {
      glyphs.line(x1, x2, rowCenter, row.height, pxDir, stroke)
    }
    const [utrY, utrHeight] = centerShrink(
      row.top,
      row.height,
      UTR_HEIGHT_FRACTION,
    )
    for (const [x1, x2] of thin) {
      glyphs.rect(x1, x2, utrY, utrHeight, utrColor)
    }
    for (const [x1, x2] of full) {
      glyphs.rect(x1, x2, row.top, row.height, fill.packed)
    }
    // no width gate here: the passes cull an arrow narrower than
    // ARROW_MIN_FEATURE_WIDTH_PX themselves, in px, and these cells are packed
    // at one px per bp so that gate reads the drawn width directly
    if (pxDir !== 0) {
      glyphs.arrow(
        pxDir === 1 ? right : left,
        right - left,
        rowCenter,
        row.height,
        pxDir,
        stroke,
      )
    }
    glyphs.hits.push({
      x1: left,
      x2: right,
      y1: row.top,
      y2: row.top + row.height,
      feature,
      groupKey: cluster,
      label: feature.get('name') ?? feature.id(),
      fill,
    })
  }

  for (const { key, group, span } of unclaimed) {
    const fill = colors.boxes.fill(group.feature, key)
    const [boxLeft, boxRight] = span[0] <= span[1] ? span : [span[1], span[0]]
    boxes.rect(
      boxLeft,
      Math.max(boxLeft + 1, boxRight),
      y + 1,
      Math.max(1, glyphHeight - 2),
      withAbgrAlpha(fill.packed, BOX_ALPHA),
    )
    boxes.hits.push({
      x1: boxLeft,
      x2: Math.max(boxLeft + 1, boxRight),
      y1: y,
      y2: y + glyphHeight,
      feature: group.feature,
      groupKey: key,
      label: key,
      fill,
    })
  }
  return { glyphs: glyphs.build(), boxes: boxes.build() }
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
