import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_RUN,
  CIGAR_X,
  visitCigarRenderedSegments,
} from '@jbrowse/cigar-utils'
import { assembleLocString } from '@jbrowse/core/util'
import { cssColorToABGR, withAbgrAlpha } from '@jbrowse/core/util/colorBits'
import {
  UTR_HEIGHT_FRACTION,
  centerShrink,
  getFeatureName,
} from '@jbrowse/plugin-canvas'
import {
  categoricalColor,
  colorSchemes,
  makeContinuousColorFunction,
  readChannelValue,
  resolveCategoricalMode,
  resolveContinuousMode,
} from '@jbrowse/synteny-core'

import {
  KIND_BASE,
  KIND_BASE_TILE,
  KIND_MARKER,
} from '../LinearSyntenyRPC/syntenyKinds.ts'
import { isNamedRecord } from '../syntenyMate.ts'
import { annotatedSpans, geneGlyphGeometry } from './geneGlyph.ts'
import { STRAND_GAP_PX } from './laneStack.ts'
import {
  frameMagnification,
  frameReachPx,
  frameTickXs,
  groupSpansLanes,
} from './layoutMultiWay.ts'
import { PX_ORIGIN } from './multiwayRenderTypes.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { AlignmentOpsById, LaneLinks } from './alignmentOps.ts'
import type { GeneColors } from './geneColor.ts'
import type { LaneGene } from './geneGlyph.ts'
import type { NamedSpan } from './laneLabels.ts'
import type { Lane, LaneBand, LaneStack } from './laneStack.ts'
import type {
  MultiWayGroup,
  MultiWayPlacement,
  Span,
} from './layoutMultiWay.ts'
import type {
  GlyphHit,
  LaneGlyphData,
  MultiWayCell,
  RibbonLayer,
  RibbonRef,
  RibbonTarget,
} from './multiwayRenderTypes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { AttributeRange, DeclaredRamp } from '@jbrowse/synteny-core'

// narrower ribbons are clutter; the boxes they join still draw in the lanes
const MIN_RIBBON_PX = 2
const BOX_ALPHA = 64
// a bridge crosses the skipped lane's genes, so it draws under adjacent ribbons
const BRIDGE_ALPHA = 0.4

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
export function outlineKey(key: string) {
  return `${key}:outline`
}

// magnified, since a transition can draw a span wider than it was packed
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

function locOn(lane: Lane, refName: string, start: number, end: number) {
  return `${lane.assemblyName} ${assembleLocString({
    refName: lane.canon(refName),
    start: Math.round(start),
    end: Math.round(end),
  })}`
}

function lines(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join('\n')
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
      y2: lower.layerTop,
    }
  }
}

/**
 * `bp1`→`bp4` is one edge and `bp2`→`bp3` the other, so a reversed span draws
 * the crossed parallelogram of an inversion.
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
  records = new Map<number, Feature>()

  get count() {
    return this.bp1.length
  }

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
 * `strand` colors by the record's strand against the anchor, not the drawn
 * twist, since a flipped lane draws its inversions straight.
 */
function ribbonColorer(
  field: string,
  slotColor: number,
  attributeRanges: Record<string, AttributeRange>,
  hideUnlabelled: boolean,
  ramp?: DeclaredRamp,
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
  const continuous = resolveContinuousMode(field, attributeRanges, ramp)
  if (continuous) {
    const value = new Float32Array(1)
    const ramp = makeContinuousColorFunction(continuous, {
      [continuous.attribute]: value,
    })
    return (_strand: number, feature: Feature) => {
      value[0] = readChannelValue(feature, continuous.attribute)
      return withAbgrAlpha(ramp(0), alpha)
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
  /** indexed by a ribbon's `instanceFeatureIdx` */
  targets: RibbonTarget[]
  groupTarget: Map<string, number>
  linkTarget: Map<string, number>
  /** by gutter key and instance, the record a click opens over the target's */
  records: Map<string, ReadonlyMap<number, Feature>>
}

/** the 1-based feature id the passes compare for `ref`, or 0 for none */
export function ribbonFeatureId(
  { groupTarget, linkTarget }: RibbonGeometry,
  ref: RibbonRef | undefined,
) {
  const idx =
    ref?.groupKey !== undefined
      ? groupTarget.get(ref.groupKey)
      : ref?.linkId !== undefined
        ? linkTarget.get(ref.linkId)
        : undefined
  return idx === undefined ? 0 : idx + 1
}

interface LinkMate {
  refName: string
  start: number
  end: number
  assemblyName?: string
}

export function mismatchColor(field: string) {
  const { cigarColors } =
    field === 'strand' ? colorSchemes.strand : colorSchemes.default
  return cssColorToABGR(cigarColors.X)
}

/** False where the record carries no alignment, so the caller draws the ribbon. */
function addAlignmentDetail(
  builder: RibbonBuilder,
  feature: Feature,
  ops: Uint32Array | undefined,
  upper: Lane,
  lower: Lane,
  featureIdx: number,
  fill: number,
  mismatch: number,
) {
  const mate = feature.get('mate') as LinkMate | undefined
  if (
    ops &&
    mate &&
    (mate.assemblyName === undefined ||
      mate.assemblyName === lower.assemblyName)
  ) {
    const refName: string = feature.get('refName')
    const start: number = feature.get('start')
    const dir2 = feature.get('strand') === -1 ? -1 : 1
    const start2 = dir2 === -1 ? mate.end : mate.start
    const add = (
      bp1Start: number,
      bp1End: number,
      bp2Start: number,
      bp2End: number,
      kind: number,
      color: number,
    ) => {
      const s1 = upper.spanOf(refName, bp1Start, bp1End)
      const s2 = lower.spanOf(mate.refName, bp2Start, bp2End)
      if (s1 && s2) {
        builder.add(s1, s2, kind, featureIdx, color)
      }
    }
    visitCigarRenderedSegments(
      ops,
      start,
      start2,
      upper.bpPerPx,
      lower.bpPerPx,
      1,
      dir2,
      (op, bp1Start, bp1End, bp2Start, bp2End) => {
        if (op !== CIGAR_I && op !== CIGAR_D && op !== CIGAR_N) {
          add(bp1Start, bp1End, bp2Start, bp2End, KIND_BASE, fill)
        }
      },
    )
    let bp1 = start
    let bp2 = start2
    let markStart1 = 0
    let markStart2 = 0
    let markLen = 0
    const flushMark = () => {
      if (markLen > 0) {
        add(
          markStart1,
          markStart1 + markLen,
          markStart2,
          markStart2 + markLen * dir2,
          KIND_BASE_TILE,
          mismatch,
        )
        markLen = 0
      }
    }
    for (let k = 0; k < ops.length; k++) {
      const len = ops[k]! >>> 4
      const op = ops[k]! & 0xf
      if (op === CIGAR_X) {
        if (
          markLen > 0 &&
          Math.abs(bp1 + len - markStart1) <= upper.bpPerPx &&
          Math.abs(bp2 + len * dir2 - markStart2) <= lower.bpPerPx
        ) {
          markLen += len
        } else {
          flushMark()
          markStart1 = bp1
          markStart2 = bp2
          markLen = len
        }
      }
      if (op === CIGAR_RUN) {
        bp1 += len
        bp2 += (ops[++k]! >>> 4) * dir2
      } else if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
        bp1 += len
        bp2 += len * dir2
      } else if (op === CIGAR_D || op === CIGAR_N) {
        bp1 += len
      } else if (op === CIGAR_I) {
        bp2 += len * dir2
      }
    }
    flushMark()
    return true
  }
  return false
}

export function buildRibbonGeometry({
  stack,
  anchorOps = new Map(),
  laneLinks,
  ribbonColor,
  ribbonColorField = '',
  attributeRanges = {},
  hideUnlabelled = false,
  ramp,
  drawCurves,
  bridgeSkippedLanes,
}: {
  stack: LaneStack
  anchorOps?: AlignmentOpsById
  laneLinks: ReadonlyMap<string, LaneLinks> | undefined
  ribbonColor: string
  ribbonColorField?: string
  attributeRanges?: Record<string, AttributeRange>
  hideUnlabelled?: boolean
  ramp?: DeclaredRamp
  drawCurves: boolean
  bridgeSkippedLanes: boolean
}): RibbonGeometry {
  const { lanes, glyphHeight } = stack
  const color = cssColorToABGR(ribbonColor)
  const colorOf = ribbonColorer(
    ribbonColorField,
    color,
    attributeRanges,
    hideUnlabelled,
    ramp,
  )
  const mismatch = mismatchColor(ribbonColorField)
  const cells = new Map<string, MultiWayCell>()
  const layers: RibbonLayer[] = []
  const targets: RibbonTarget[] = []
  const groupTarget = new Map<string, number>()
  const linkTarget = new Map<string, number>()
  const records = new Map<string, ReadonlyMap<number, Feature>>()
  const anchor = lanes[0]
  const targetOfGroup = (key: string, group: MultiWayGroup) => {
    let idx = groupTarget.get(key)
    if (idx === undefined) {
      idx = targets.length
      const { refName, start, end, name } = group.anchor
      targets.push({
        feature: group.feature,
        groupKey: key,
        label: lines(name, anchor && locOn(anchor, refName, start, end)),
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
      const direct =
        upper.isAnchor &&
        !bridged &&
        spans.length === 1 &&
        far.spans.length === 1
      spans.forEach((s1, i) => {
        far.spans.forEach((s2, j) => {
          if (wideEnough(s1, s2, upper, farLane)) {
            const record = far.features[j]!
            const target = targetOfGroup(key, group)
            const painted = colorOf(
              orientations[i]! * far.orientations[j]!,
              record,
            )
            const fill = bridged
              ? withAbgrAlpha(
                  painted,
                  Math.round((painted >>> 24) * BRIDGE_ALPHA),
                )
              : painted
            const first = builder.count
            const tiled =
              direct &&
              fill >>> 24 !== 0 &&
              addAlignmentDetail(
                builder,
                record,
                anchorOps.get(record.id()),
                upper,
                farLane,
                target,
                fill,
                mismatch,
              )
            if (!tiled) {
              builder.add(s1, s2, KIND_BASE, target, fill)
            }
            if (record !== group.feature) {
              for (let k = first; k < builder.count; k++) {
                builder.records.set(k, record)
              }
            }
          }
        })
      })
    }
    const pairLinks =
      row > 0
        ? laneLinks?.get(`${upper.assemblyName}|${lower.assemblyName}`)
        : undefined
    for (const link of pairLinks?.links ?? []) {
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
        linkTarget.set(link.id(), idx)
        const via = link.get('composedThrough') as
          | { refName: string; start: number; end: number }
          | undefined
        targets.push({
          feature: link,
          linkId: link.id(),
          label: [
            locOn(
              upper,
              link.get('refName'),
              link.get('start'),
              link.get('end'),
            ),
            locOn(lower, mate.refName, mate.start, mate.end),
            ...(via && anchor
              ? [
                  `composed through ${locOn(anchor, via.refName, via.start, via.end)}, not aligned directly`,
                ]
              : []),
          ].join('\n'),
        })
        const fill = colorOf(link.get('strand') === -1 ? -1 : 1, link)
        const tiled =
          fill >>> 24 !== 0 &&
          addAlignmentDetail(
            ribbons,
            link,
            pairLinks?.ops.get(link.id()),
            upper,
            lower,
            idx,
            fill,
            mismatch,
          )
        if (!tiled) {
          ribbons.add(s1, ordered, KIND_BASE, idx, fill)
        }
      }
    }
    const key = ribbonsKey(row)
    cells.set(key, ribbons.build())
    if (ribbons.records.size > 0) {
      records.set(key, ribbons.records)
    }
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
      if (builder.records.size > 0) {
        records.set(bridgeKey, builder.records)
      }
      layers.push({
        kind: 'ribbons',
        key: bridgeKey,
        yTop: y1,
        height: lanes[toRow]!.layerTop - y1,
        curves: drawCurves,
        rows: [row, toRow],
      })
    }
  }
  return { cells, layers, targets, groupTarget, linkTarget, records }
}

export interface TickGeometry {
  cells: Map<string, MultiWayCell>
  layers: RibbonLayer[]
}

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

  line(x1: number, x2: number, y: number, direction: number, color: number) {
    this.linePositions.push(toU32(x1), toU32(x2))
    this.lineYs.push(y)
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
      lineColors: Uint32Array.from(this.lineColors),
      lineDirections: Int8Array.from(this.lineDirections),
      arrowXs: Uint32Array.from(this.arrowXs),
      arrowYs: Float32Array.from(this.arrowYs),
      arrowHeights: Float32Array.from(this.arrowHeights),
      arrowWidthsBp: Uint32Array.from(this.arrowWidths),
      arrowGene: new Uint8Array(this.arrowXs.length).fill(1),
      arrowDirections: Int8Array.from(this.arrowDirections),
      arrowColors: Uint32Array.from(this.arrowColors),
      outlineColor: this.outlineColor,
      hits: this.hits,
    }
  }
}

/**
 * Reads the lane geometry alone, so a pan, zoom or settle keeps this cell's
 * identity and its upload. On a page of the paper, the paper starts at the
 * first gutter so every gutter sits on the same ground, and the stripes cover
 * lane bodies, never a gutter.
 */
export function buildBandCell({
  rows,
  glyphHeight,
  width,
  paper,
  stripe,
  page,
}: {
  rows: LaneBand[]
  glyphHeight: number
  width: number
  paper: string
  stripe: string
  page: string
}): LaneGlyphData {
  const paperColor = cssColorToABGR(paper)
  const stripeColor = cssColorToABGR(stripe)
  const glyphs = new GlyphBuilder()
  const anchor = rows[0]
  const bottom = rows.at(-1)
  if (anchor && bottom) {
    const top =
      cssColorToABGR(page) === paperColor ? anchor.glyphTop + glyphHeight : 0
    glyphs.rect(0, width, top, bottom.bandEnd - top, paperColor)
  }
  rows.forEach((band, row) => {
    if (row % 2 === 1) {
      const bodyEnd = band.glyphTop + glyphHeight
      glyphs.rect(0, width, band.layerTop, bodyEnd - band.layerTop, stripeColor)
    }
  })
  return glyphs.build()
}

export interface LaneGlyphColors {
  genes: GeneColors
  boxes: GeneColors
  stroke: string
  divider: string
}

function onCanvas(span: Span, [left, right]: Span) {
  return (
    Math.max(span[0], span[1]) >= left && Math.min(span[0], span[1]) <= right
  )
}

function laneReachPx(lane: Lane, width: number): Span {
  return lane.frame
    ? frameReachPx(lane.frame, width)
    : [-width / 2, 1.5 * width]
}

export interface LaneCells {
  glyphs: LaneGlyphData
  boxes: LaneGlyphData
  boxNames: NamedSpan[]
  geneGroups: Map<string, string>
}

interface DrawnGene {
  gene: LaneGene
  span: Span
  cluster?: string
}

interface LaneBox {
  key: string
  span: Span
  interval: MultiWayPlacement
  feature: Feature
}

/**
 * Claims in the lane's own bp, so a gene straddling the edge claims one group
 * whatever the frame clips off it.
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
  for (const [key, { group, spans, intervals, features }] of lane.placements) {
    intervals.forEach(({ refName, start, end }, i) => {
      const genes = covering.get(lane.canon(refName))
      const cover = genes?.cover([start, end])
      if (genes && cover) {
        const gene = genes.drawn[cover.index]!
        if (cover.overlap > (widest.get(gene) ?? 0)) {
          widest.set(gene, cover.overlap)
          gene.cluster = key
        }
      } else if (isNamedRecord(group.feature)) {
        boxes.push({
          key,
          span: spans[i]!,
          interval: intervals[i]!,
          feature: features[i]!,
        })
      }
    })
  }
  return boxes
}

/**
 * With strands split, a gene reading rightwards on screen takes the upper half
 * and one reading leftwards the lower; a strandless gene takes the upper.
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
 * Two cells, because `outlineColor` is a per-cell uniform: the boxes take the
 * lane's stroke and the genes none.
 */
export function buildLaneCells({
  lane,
  genes,
  glyphHeight,
  width,
  colors,
}: {
  lane: Lane
  genes: LaneGene[]
  glyphHeight: number
  width: number
  colors: LaneGlyphColors
}): LaneCells {
  const glyphs = new GlyphBuilder()
  const boxes = new GlyphBuilder()
  const y = lane.glyphTop
  // rect takes the box top, line and arrow its centre, as in the feature track
  const centerY = y + glyphHeight / 2
  const stroke = cssColorToABGR(colors.stroke)
  const reach = laneReachPx(lane, width)
  boxes.outlineColor = stroke
  const divider = cssColorToABGR(colors.divider)
  for (const [x1, x2] of lane.baseline) {
    glyphs.line(x1, x2, centerY, 0, divider)
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
      glyphs.line(x1, x2, rowCenter, pxDir, stroke)
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
    // every lane here is a gene, so the passes cull an arrow below the gene gate
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
      label: lines(
        getFeatureName(feature),
        locOn(lane, refName, feature.get('start'), feature.get('end')),
      ),
      fill,
    })
  }

  const boxNames: NamedSpan[] = []
  for (const { key, span, interval, feature } of unclaimed) {
    const { name } = interval
    const fill = colors.boxes.fill(feature, key)
    const [boxLeft, boxRight] = span[0] <= span[1] ? span : [span[1], span[0]]
    if (name) {
      boxNames.push({
        id: `box:${key}:${interval.refName}:${interval.start}`,
        name,
        group: key,
        left: boxLeft,
        right: boxRight,
      })
    }
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
      feature,
      groupKey: key,
      label: lines(
        name ?? key,
        locOn(lane, interval.refName, interval.start, interval.end),
      ),
      fill,
    })
  }
  const geneGroups = new Map<string, string>()
  for (const { gene, cluster } of drawn) {
    if (cluster !== undefined) {
      geneGroups.set(gene.feature.id(), cluster)
    }
  }
  return { glyphs: glyphs.build(), boxes: boxes.build(), boxNames, geneGroups }
}

/** render-origin px; boxes draw over genes, so the topmost hit wins */
export function glyphHitAt(hits: GlyphHit[], x: number, y: number) {
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i]!
    if (x >= h.x1 && x <= h.x2 && y >= h.y1 && y <= h.y2) {
      return h
    }
  }
  return undefined
}
