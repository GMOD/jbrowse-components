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
import {
  SimpleFeature,
  assembleLocStringRaw,
  getBpRangeDisplayStr,
} from '@jbrowse/core/util'
import { cssColorToABGR, withAbgrAlpha } from '@jbrowse/core/util/colorBits'
import { RECT_FLAG_INSET, getFeatureName } from '@jbrowse/plugin-features'
import {
  attributeTooltipLines,
  colorSchemes,
  isAttributeLabels,
  parseAttributeValue,
  readAttribute,
  readChannelValue,
  syntenyBlockLines,
} from '@jbrowse/synteny-core'

import {
  KIND_BASE,
  KIND_BASE_TILE,
  KIND_MARKER,
} from '../LinearSyntenyRPC/syntenyKinds.ts'
import { getMate, isArrayRecord, isNamedRecord } from '../syntenyMate.ts'
import { lanePairKey } from './alignmentOps.ts'
import { laneGenome } from './copyLane.ts'
import { annotatedSpans, geneGlyphGeometry } from './geneGlyph.ts'
import { STRAND_GAP_PX, stackReach } from './laneStack.ts'
import {
  frameOpenings,
  frameReachPx,
  frameTickXs,
  groupSpansLanes,
} from './layoutMultiWay.ts'
import { PX_ORIGIN } from './multiwayRenderTypes.ts'
import { ribbonPaintOf } from './ribbonPaint.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { AlignmentOpsById, LaneLinks } from './alignmentOps.ts'
import type { GeneColors } from './geneColor.ts'
import type { LaneGene } from './geneGlyph.ts'
import type { NamedSpan } from './laneLabels.ts'
import type { Lane, LaneBand, LaneStack } from './laneStack.ts'
import type { PlacedGroup, MultiWayPlacement, Span } from './layoutMultiWay.ts'
import type {
  GlyphHit,
  GlyphLayer,
  LaneEnd,
  LaneGlyphData,
  MultiWayCell,
  RibbonLayer,
  RibbonRef,
  RibbonTarget,
} from './multiwayRenderTypes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type {
  AttributeRange,
  SyntenyColorPaint,
  SyntenyOpacitySnapshot,
} from '@jbrowse/synteny-core'

const BOX_ALPHA = 64
// a bridge crosses the skipped lane's genes, so it draws under adjacent ribbons
const BRIDGE_ALPHA = 0.4
// a source's block, under the ribbons of the pairs it chains
const UNDERLAY_ALPHA = 0.5

function underlayKey(row: number) {
  return `underlay:${row}`
}

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

function locOn(lane: Lane, refName: string, start: number, end: number) {
  return `${lane.assemblyName} ${lane.canon(refName)}:${getBpRangeDisplayStr(Math.round(start), Math.round(end))}`
}

function lines(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join('\n')
}

function holesOn(lane: Lane, refName: string) {
  return lane.frame && lane.canon(lane.frame.refName) === lane.canon(refName)
    ? frameOpenings(lane.frame).map(o => o.at)
    : []
}

/**
 * Adds the ribbon between `upper`'s `start1`..`end1` and `lower`'s
 * `from2`..`to2`, which runs the other way when `from2 > to2`, cut wherever
 * either lane opens a hole inside its stretch, so the hole stays open. The
 * cut lands on the other lane in proportion. Proportion misses the true
 * position by up to the stretches' length difference, so two holes that close
 * in it are one breakpoint, each kept at its own lane's `at`. `upperBelow`
 * draws `upper`'s side at the gutter's foot, as the anchor's record does
 * under a copy lane stacked above it.
 */
function addAcrossHoles(
  builder: RibbonBuilder,
  upper: Lane,
  refName1: string,
  start1: number,
  end1: number,
  lower: Lane,
  refName2: string,
  from2: number,
  to2: number,
  kind: number,
  featureIdx: number,
  color: number,
  upperBelow = false,
) {
  const length1 = end1 - start1
  const toLower = (bp1: number) =>
    from2 + ((bp1 - start1) / length1) * (to2 - from2)
  const toUpper = (bp2: number) =>
    start1 + ((bp2 - from2) / (to2 - from2)) * length1
  const lo2 = Math.min(from2, to2)
  const hi2 = Math.max(from2, to2)
  const slack = Math.abs(hi2 - lo2 - length1) + 1
  const cuts = holesOn(upper, refName1)
    .filter(at => at > start1 && at < end1)
    .map(at => ({ bp1: at, bp2: toLower(at), paired: false }))
  for (const at of holesOn(lower, refName2)) {
    if (at > lo2 && at < hi2) {
      const bp1 = toUpper(at)
      const same = cuts
        .filter(c => !c.paired && Math.abs(c.bp1 - bp1) < slack)
        .sort((a, b) => Math.abs(a.bp1 - bp1) - Math.abs(b.bp1 - bp1))[0]
      if (same) {
        same.bp2 = at
        same.paired = true
      } else {
        cuts.push({ bp1, bp2: at, paired: true })
      }
    }
  }
  cuts.sort((a, b) => a.bp1 - b.bp1)
  const bounds = [{ bp1: start1, bp2: from2 }, ...cuts, { bp1: end1, bp2: to2 }]
  for (let i = 1; i < bounds.length; i++) {
    const a = bounds[i - 1]!
    const b = bounds[i]!
    const s1 = upper.spanOf(refName1, a.bp1, b.bp1)
    const s2 = lower.spanOf(refName2, a.bp2, b.bp2)
    if (s1 && s2) {
      if (upperBelow) {
        builder.add(s2, s1, kind, featureIdx, color)
      } else {
        builder.add(s1, s2, kind, featureIdx, color)
      }
    }
  }
}

const ANCHOR_RULE_TICK_PX = 4

/** Where the anchor's rule sits in the gutter under `upper`: flush under that lane */
export function anchorRuleY(upper: Lane, bandHeight: number) {
  return upper.bandTop + bandHeight
}

/** Where the rule sits in the gutter over `lower`, above the anchor: flush over that lane */
export function anchorRuleAboveY(lower: Lane) {
  return lower.bandTop
}

export function anchorRowIn(lanes: readonly Lane[]) {
  return Math.max(
    lanes.findIndex(lane => lane.isAnchor),
    0,
  )
}

/**
 * Two placements of one group a source row states as a pair. A table folding
 * its rows by anchor gene puts both halves of a split gene in one group, and
 * only the rows say which half of one lane is which half of the next.
 */
function statedTogether(
  a: MultiWayPlacement | undefined,
  b: MultiWayPlacement | undefined,
) {
  const other = b?.rows
  return (
    a?.rows === undefined ||
    other === undefined ||
    a.rows.some(row => other.includes(row))
  )
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

function ascending([a, b]: Span): Span {
  return a <= b ? [a, b] : [b, a]
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
  colors: number[] = []
  records = new Map<number, Feature>()
  mismatchTiles = 0

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
      instanceCount: this.bp1.length,
      colors: Uint32Array.from(this.colors),
    }
    return { kind: 'ribbons', data }
  }
}

/**
 * A hovered ribbon's tooltip in the lines the synteny views print a block in:
 * the two lanes it joins, `Inverted`, then the channels its record carries.
 * A ribbon whose lanes do not each name one placement keeps `label`. An
 * array record's ribbon is never inverted and says it pairs no copies.
 */
export function ribbonTooltip(
  label: string,
  sides: readonly RibbonSide[],
  record: Feature,
  attributeRanges: Record<string, AttributeRange>,
) {
  const attributes: Record<string, number | string> = {}
  for (const [name, range] of Object.entries(attributeRanges)) {
    const value = isAttributeLabels(range)
      ? parseAttributeValue(record.get(name))
      : readChannelValue(record, name)
    if (
      typeof value === 'string' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      attributes[name] = value
    }
  }
  return (
    sides.length === 2
      ? syntenyBlockLines({
          sides: sides.map(({ lane, placement }) => ({
            assemblyName: lane.label,
            name: placement.name,
            refName: lane.canon(placement.refName),
            start: Math.round(placement.start),
            end: Math.round(placement.end),
          })),
          inverted:
            !isArrayRecord(record) &&
            sides[0]!.orientation * sides[1]!.orientation < 0,
          attributes,
        })
      : [label, ...attributeTooltipLines(attributes)]
  )
    .concat(isArrayRecord(record) ? ['Repeat, copies not paired'] : [])
    .join('\n')
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
  /** whether a ribbon draws a stretch differing from its mate over equal length */
  mismatches: boolean
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

/**
 * The collinear blocks the pairs' source chains them into, as an MCScan
 * `.anchors` pair states its own: one record per block, spanning the block on
 * the pairs' side with its mate on the other and `strand` -1 where the block
 * runs against that side, and each pair's way to it. A block is painted,
 * hovered and clicked as this record, so it reads the block's own fields and
 * none of one pair's.
 */
function sourceBlocksOf(records: Iterable<Feature>) {
  const byKey = new Map<string, Feature>()
  const ofPair = new Map<Feature, Feature>()
  for (const record of records) {
    const name = record.get('block')
    const mate = getMate(record)
    const start = readAttribute(record, 'blockStart')
    const end = readAttribute(record, 'blockEnd')
    const mateStart = readAttribute(record, 'blockMateStart')
    const mateEnd = readAttribute(record, 'blockMateEnd')
    if (
      typeof name === 'string' &&
      mate &&
      [start, end, mateStart, mateEnd].every(Number.isFinite)
    ) {
      const refName = record.get('refName')
      const key = `block:${mate.assemblyName}:${mate.refName}:${refName}:${name}`
      let block = byKey.get(key)
      if (!block) {
        block = new SimpleFeature({
          uniqueId: key,
          assemblyName: record.get('assemblyName'),
          refName,
          start,
          end,
          strand: record.get('blockStrand') === -1 ? -1 : 1,
          block: name,
          blockSpan: record.get('blockSpan'),
          mate: {
            assemblyName: mate.assemblyName,
            refName: mate.refName,
            start: mateStart,
            end: mateEnd,
          },
        })
        byKey.set(key, block)
      }
      ofPair.set(record, block)
    }
  }
  return ofPair
}

interface LinkMate {
  refName: string
  start: number
  end: number
  assemblyName?: string
}

export function mismatchCss(field: string | undefined) {
  const { cigarColors } =
    field === 'strand' ? colorSchemes.strand : colorSchemes.default
  return cigarColors.X
}

export function mismatchColor(field: string | undefined) {
  return cssColorToABGR(mismatchCss(field))
}

/**
 * False where the record carries no alignment, so the caller draws the
 * ribbon. `upper` holds the record and `lower` its mate, each drawn on its
 * own side of the gutter (`upperBelow`).
 */
function addAlignmentDetail(
  builder: RibbonBuilder,
  feature: Feature,
  ops: Uint32Array | undefined,
  upper: Lane,
  lower: Lane,
  featureIdx: number,
  fill: number,
  mismatch: number,
  upperBelow = false,
) {
  const mate = feature.get('mate') as LinkMate | undefined
  if (
    ops &&
    mate &&
    (mate.assemblyName === undefined ||
      mate.assemblyName === laneGenome(lower.assemblyName))
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
      addAcrossHoles(
        builder,
        upper,
        refName,
        bp1Start,
        bp1End,
        lower,
        mate.refName,
        bp2Start,
        bp2End,
        kind,
        featureIdx,
        color,
        upperBelow,
      )
    }
    let match: [number, number, number, number] | undefined
    const flushMatch = () => {
      if (match) {
        const [s1, e1, s2, e2] = match
        add(s1, e1, s2, e2, KIND_BASE, fill)
        match = undefined
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
          match = match
            ? [match[0], bp1End, match[2], bp2End]
            : [bp1Start, bp1End, bp2Start, bp2End]
        } else {
          flushMatch()
        }
      },
    )
    flushMatch()
    const onePx = Math.min(upper.bpPerPx, lower.bpPerPx)
    let bp1 = start
    let bp2 = start2
    for (let k = 0; k < ops.length; k++) {
      const len = ops[k]! >>> 4
      const op = ops[k]! & 0xf
      if (op === CIGAR_X && len >= onePx) {
        add(bp1, bp1 + len, bp2, bp2 + len * dir2, KIND_BASE_TILE, mismatch)
        builder.mismatchTiles++
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
    return true
  }
  return false
}

/** by row, the next row down placing each of that row's groups */
function nextPlacedRows(lanes: Lane[]) {
  const below = new Map<string, number>()
  const out: Map<string, number>[] = []
  for (let row = lanes.length - 1; row >= 0; row--) {
    const next = new Map<string, number>()
    for (const key of lanes[row]!.placements.keys()) {
      const at = below.get(key)
      if (at !== undefined) {
        next.set(key, at)
      }
      below.set(key, row)
    }
    out[row] = next
  }
  return out
}

// Every record a ribbon can draw: each lane's placed runs and each lane
// pair's direct links
function* ribbonRecords(
  lanes: Lane[],
  laneLinks: ReadonlyMap<string, LaneLinks> | undefined,
) {
  for (const lane of lanes) {
    for (const { features } of lane.placements.values()) {
      yield* features
    }
  }
  for (const { links } of laneLinks?.values() ?? []) {
    yield* links
  }
}

export function buildRibbonGeometry({
  stack,
  anchorOps = new Map(),
  laneLinks,
  ribbonColor,
  ribbonColorField,
  attributeRanges = {},
  opacity = {},
  filter = [],
  paint,
  drawCurves,
  rowsVsAnchor = false,
}: {
  stack: LaneStack
  anchorOps?: AlignmentOpsById
  laneLinks: ReadonlyMap<string, LaneLinks> | undefined
  ribbonColor: string
  ribbonColorField?: string
  attributeRanges?: Record<string, AttributeRange>
  /** `ribbons.encoding.opacity` */
  opacity?: SyntenyOpacitySnapshot
  /** `ribbons.filter`: a ribbon failing it draws nothing */
  filter?: readonly FieldPredicate[]
  paint?: SyntenyColorPaint
  drawCurves: boolean
  /** each gutter draws its lower lane against the anchor, as a star source states it */
  rowsVsAnchor?: boolean
}): RibbonGeometry {
  const { lanes, glyphHeight } = stack
  const sourceBlocks = sourceBlocksOf(ribbonRecords(lanes, laneLinks))
  const painting = {
    field: ribbonColorField,
    ribbonColor,
    attributeRanges,
    opacity,
    paint,
  }
  const paintOf = ribbonPaintOf({
    ...painting,
    records: ribbonRecords(lanes, laneLinks),
    filter,
  })
  // a block draws where one of its pairs passes the filter, so it runs none
  let paintBlockOf: ReturnType<typeof ribbonPaintOf> | undefined
  const mismatch = mismatchColor(ribbonColorField)
  const cells = new Map<string, MultiWayCell>()
  const layers: RibbonLayer[] = []
  const underlayCells = new Map<string, MultiWayCell>()
  const underlayLayers: RibbonLayer[] = []
  const targets: RibbonTarget[] = []
  const groupTarget = new Map<string, number>()
  const linkTarget = new Map<string, number>()
  const records = new Map<string, ReadonlyMap<number, Feature>>()
  const anchorRow = anchorRowIn(lanes)
  const anchor = lanes[anchorRow]
  const nextRows = nextPlacedRows(lanes)
  let mismatches = false
  const targetOfGroup = (key: string, group: PlacedGroup) => {
    let idx = groupTarget.get(key)
    if (idx === undefined) {
      idx = targets.length
      const at = group.anchor
      targets.push({
        feature: group.feature,
        groupKey: key,
        get label() {
          return at
            ? lines(
                at.name,
                anchor && locOn(anchor, at.refName, at.start, at.end),
              )
            : lines(
                group.feature.get('name'),
                anchor && `not in ${anchor.label}`,
              )
        },
      })
      groupTarget.set(key, idx)
    }
    return idx
  }
  for (const pair of lanePairs(lanes, glyphHeight)) {
    const { row } = pair
    // read against the anchor, a gutter away from it draws its far lane
    // against the anchor's rule beside the near one
    const belowAnchor = rowsVsAnchor && row > anchorRow
    const aboveAnchor = rowsVsAnchor && row + 1 < anchorRow
    const upper = belowAnchor ? anchor! : pair.upper
    const lower = aboveAnchor ? anchor! : pair.lower
    const lowerRow = aboveAnchor ? anchorRow : row + 1
    const y1 = belowAnchor ? anchorRuleY(pair.upper, stack.bandHeight) : pair.y1
    const y2 = aboveAnchor ? anchorRuleAboveY(pair.lower) : pair.y2
    const ribbons = new RibbonBuilder()
    const bridges = new Map<number, RibbonBuilder>()
    const underlay = new RibbonBuilder()
    const underlaid = new Set<Feature>()
    for (const [
      key,
      { group, spans, orientations, intervals, features },
    ] of upper.placements) {
      const toRow = lower.placements.has(key)
        ? lowerRow
        : !rowsVsAnchor && groupSpansLanes(group)
          ? nextRows[row]!.get(key)
          : undefined
      const far =
        toRow === undefined ? undefined : lanes[toRow]!.placements.get(key)
      if (toRow === undefined || !far) {
        continue
      }
      const farLane = lanes[toRow]!
      const bridged = toRow !== lowerRow
      let builder = ribbons
      if (bridged) {
        builder = bridges.get(toRow) ?? new RibbonBuilder()
        bridges.set(toRow, builder)
      }
      const direct =
        (upper.isAnchor || farLane.isAnchor) &&
        !bridged &&
        spans.length === 1 &&
        far.spans.length === 1
      spans.forEach((s1, i) => {
        far.spans.forEach((s2, j) => {
          const record = farLane.isAnchor ? features[i]! : far.features[j]!
          const painted = statedTogether(intervals[i], far.intervals[j])
            ? paintOf(record, orientations[i]! * far.orientations[j]!)
            : undefined
          const block =
            painted !== undefined &&
            !bridged &&
            (upper.isAnchor || farLane.isAnchor)
              ? sourceBlocks.get(record)
              : undefined
          const blockMate = block && getMate(block)
          if (block && blockMate && !underlaid.has(block)) {
            underlaid.add(block)
            const reversed = block.get('strand') === -1
            paintBlockOf ??= ribbonPaintOf({
              ...painting,
              records: new Set(sourceBlocks.values()),
              filter: [],
            })
            const fill = paintBlockOf(block, reversed ? -1 : 1)
            if (fill !== undefined) {
              const own = {
                refName: block.get('refName'),
                start: block.get('start'),
                end: block.get('end'),
              }
              const [top, bottom] = upper.isAnchor
                ? [own, blockMate]
                : [blockMate, own]
              const idx = targets.length
              linkTarget.set(block.id(), idx)
              targets.push({
                feature: block,
                linkId: block.id(),
                get label() {
                  return [
                    locOn(upper, top.refName, top.start, top.end),
                    locOn(farLane, bottom.refName, bottom.start, bottom.end),
                  ].join('\n')
                },
              })
              addAcrossHoles(
                underlay,
                upper,
                top.refName,
                top.start,
                top.end,
                farLane,
                bottom.refName,
                reversed ? bottom.end : bottom.start,
                reversed ? bottom.start : bottom.end,
                KIND_BASE,
                idx,
                withAbgrAlpha(fill, Math.round((fill >>> 24) * UNDERLAY_ALPHA)),
              )
            }
          }
          if (painted !== undefined) {
            const target = targetOfGroup(key, group)
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
                farLane.isAnchor ? farLane : upper,
                farLane.isAnchor ? upper : farLane,
                target,
                fill,
                mismatch,
                farLane.isAnchor,
              )
            if (!tiled && isArrayRecord(record)) {
              builder.add(ascending(s1), ascending(s2), KIND_BASE, target, fill)
            } else if (!tiled) {
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
      !pair.upper.isAnchor && !pair.lower.isAnchor && !rowsVsAnchor
        ? laneLinks?.get(lanePairKey(upper.assemblyName, lower.assemblyName))
        : undefined
    for (const link of pairLinks?.links ?? []) {
      const mate = getMate(link)
      if (!mate) {
        continue
      }
      const s1 = upper.spanOf(
        link.get('refName'),
        link.get('start'),
        link.get('end'),
      )
      const s2 = lower.spanOf(mate.refName, mate.start, mate.end)
      const fill =
        s1 && s2 ? paintOf(link, link.get('strand') === -1 ? -1 : 1) : undefined
      if (s1 && s2 && fill !== undefined) {
        const idx = targets.length
        linkTarget.set(link.id(), idx)
        targets.push({
          feature: link,
          linkId: link.id(),
          get label() {
            return [
              locOn(
                upper,
                link.get('refName'),
                link.get('start'),
                link.get('end'),
              ),
              locOn(lower, mate.refName, mate.start, mate.end),
            ].join('\n')
          },
        })
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
          const reversed = link.get('strand') === -1
          addAcrossHoles(
            ribbons,
            upper,
            link.get('refName'),
            link.get('start'),
            link.get('end'),
            lower,
            mate.refName,
            reversed ? mate.end : mate.start,
            reversed ? mate.start : mate.end,
            KIND_BASE,
            idx,
            fill,
          )
        }
      }
    }
    if (underlay.count > 0) {
      underlayCells.set(underlayKey(row), underlay.build())
      underlayLayers.push({
        kind: 'ribbons',
        key: underlayKey(row),
        yTop: y1,
        height: y2 - y1,
        curves: drawCurves,
        rows: [belowAnchor ? anchorRow : row, lowerRow],
      })
    }
    const key = ribbonsKey(row)
    mismatches ||= ribbons.mismatchTiles > 0
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
      rows: [belowAnchor ? anchorRow : row, lowerRow],
    })
    for (const [toRow, builder] of bridges) {
      const bridgeKey = ribbonsKey(row, toRow)
      mismatches ||= builder.mismatchTiles > 0
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
  return {
    cells: new Map([...underlayCells, ...cells]),
    layers: [...underlayLayers, ...layers],
    targets,
    groupTarget,
    linkTarget,
    records,
    mismatches,
  }
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
  rectFlags: number[] = []
  linePositions: number[] = []
  lineYs: number[] = []
  lineColors: number[] = []
  lineHeights: number[] = []
  lineDirections: number[] = []
  arrowXs: number[] = []
  arrowYs: number[] = []
  arrowHeights: number[] = []
  arrowWidths: number[] = []
  arrowDirections: number[] = []
  arrowColors: number[] = []
  hits: GlyphHit[] = []
  outlineColor = 0

  rect(
    x1: number,
    x2: number,
    y: number,
    height: number,
    color: number,
    flags = 0,
  ) {
    this.rectPositions.push(toU32(Math.min(x1, x2)), toU32(Math.max(x1, x2)))
    this.rectYs.push(y)
    this.rectHeights.push(height)
    this.rectColors.push(color)
    this.rectStrands.push(0)
    this.rectFlags.push(flags)
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
      rectDensityFade: Uint32Array.from(this.rectFlags),
      linePositions: Uint32Array.from(this.linePositions),
      lineYs: Float32Array.from(this.lineYs),
      lineColors: Uint32Array.from(this.lineColors),
      lineHeights: Float32Array.from(this.lineHeights),
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
  const first = rows[0]
  const last = rows.at(-1)
  if (first && last) {
    const top =
      cssColorToABGR(page) === paperColor ? first.glyphTop + glyphHeight : 0
    glyphs.rect(0, width, top, last.bandEnd - top, paperColor)
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
  return lane.frame ? frameReachPx(lane.frame, width) : stackReach(width)
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
    const transcript = d.gene.drawn
    const ref = lane.canon(d.gene.feature.get('refName'))
    const genes = onRef.get(ref) ?? { spans: [], drawn: [] }
    genes.spans.push([transcript.get('start'), transcript.get('end')])
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

export const ANCHOR_RULE_KEY = 'anchorRule'

/**
 * The anchor's axis beside each lane whose gutter away from the anchor reads
 * it, on the anchor's map, so a lane's nudge or flip leaves it where the anchor
 * is.
 */
export function buildAnchorRule({
  stack,
  ticks,
  stroke,
}: {
  stack: LaneStack
  ticks: readonly number[]
  stroke: string
}) {
  const { lanes, bandHeight } = stack
  const anchorRow = anchorRowIn(lanes)
  const spans = lanes[anchorRow]?.baseline ?? []
  const color = cssColorToABGR(stroke)
  const glyphs = new GlyphBuilder()
  const rules = [
    ...lanes.slice(1, anchorRow).map(lane => ({
      y: anchorRuleAboveY(lane),
      tickTop: anchorRuleAboveY(lane),
    })),
    ...lanes.slice(anchorRow + 1, -1).map(lane => {
      const y = anchorRuleY(lane, bandHeight)
      return { y, tickTop: y - ANCHOR_RULE_TICK_PX }
    }),
  ]
  for (const { y, tickTop } of rules) {
    for (const [x1, x2] of spans) {
      glyphs.line(x1, x2, y, 0, 0, color)
    }
    for (const x of ticks) {
      glyphs.rect(x, x + 1, tickTop, ANCHOR_RULE_TICK_PX, color)
    }
  }
  const cells = new Map<string, MultiWayCell>([
    [ANCHOR_RULE_KEY, { kind: 'glyphs', data: glyphs.build() }],
  ])
  const layer: GlyphLayer = {
    kind: 'glyphs',
    key: ANCHOR_RULE_KEY,
    scrolled: true,
    row: anchorRow,
  }
  return { cells, layer }
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
    glyphs.line(x1, x2, centerY, glyphHeight, 0, divider)
  }

  const drawn: DrawnGene[] = []
  for (const gene of genes) {
    const transcript = gene.drawn
    const span = lane.spanOf(
      gene.feature.get('refName'),
      transcript.get('start'),
      transcript.get('end'),
    )
    if (span !== undefined && onCanvas(span, reach)) {
      drawn.push({ gene, span })
    }
  }
  const unclaimed = claimPlacements(lane, drawn)

  for (const { gene, span, cluster } of drawn) {
    const { feature } = gene
    const refName = feature.get('refName')
    const { left, right, pxDir, pieces, full, thin, introns } =
      geneGlyphGeometry(gene, span, (start, end) =>
        lane.spansOf(refName, start, end),
      )
    const fill = colors.genes.fill(feature, cluster)
    const utrColor = colors.genes.utr(feature, fill)
    const row = geneRow(lane, glyphHeight, pxDir)
    const rowCenter = row.top + row.height / 2
    for (const [x1, x2] of introns) {
      glyphs.line(x1, x2, rowCenter, row.height, pxDir, stroke)
    }
    for (const [x1, x2] of thin) {
      glyphs.rect(x1, x2, row.top, row.height, utrColor, RECT_FLAG_INSET)
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
    const name = getFeatureName(feature)
    const transcriptName = getFeatureName(gene.drawn)
    const label = () =>
      lines(
        name,
        transcriptName === name ? undefined : transcriptName,
        locOn(lane, refName, feature.get('start'), feature.get('end')),
      )
    const locus = {
      refName,
      start: feature.get('start'),
      end: feature.get('end'),
      name: name ?? transcriptName ?? refName,
    }
    for (const [x1, x2] of pieces) {
      glyphs.hits.push({
        x1,
        x2,
        y1: row.top,
        y2: row.top + row.height,
        feature,
        groupKey: cluster,
        get label() {
          return label()
        },
        fill,
        locus,
      })
    }
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
      get label() {
        return lines(
          name ?? key,
          locOn(lane, interval.refName, interval.start, interval.end),
        )
      },
      fill,
      locus: {
        refName: interval.refName,
        start: interval.start,
        end: interval.end,
        name: name ?? key,
      },
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

function laneEndOf(
  lane: Lane,
  { refName, start, end, name }: MultiWayPlacement,
): LaneEnd {
  return {
    assemblyName: lane.assemblyName,
    refName,
    start,
    end,
    name: name ?? assembleLocStringRaw({ refName, start, end }),
  }
}

/** one lane a ribbon joins: where it sits there, and which way it runs */
export interface RibbonSide {
  lane: Lane
  placement: MultiWayPlacement
  orientation: number
}

/**
 * Where a ribbon between `upper` and `lower` sits on each lane's genome: a
 * lane-pair record and its mate, the record's own side on the anchor where
 * the gutter has it, or the group's placement on each lane. A
 * lane placing the group more than once names the placement only where the
 * ribbon's own record picks it.
 */
export function ribbonSides(
  upper: Lane,
  lower: Lane,
  target: RibbonRef,
  record: Feature,
): RibbonSide[] {
  if (target.linkId !== undefined) {
    const mate = getMate(record)
    const own = {
      refName: record.get('refName'),
      start: record.get('start'),
      end: record.get('end'),
    }
    const orientation = record.get('strand') === -1 ? -1 : 1
    return mate
      ? lower.isAnchor
        ? [
            { lane: upper, placement: mate, orientation },
            { lane: lower, placement: own, orientation: 1 },
          ]
        : [
            { lane: upper, placement: own, orientation: 1 },
            { lane: lower, placement: mate, orientation },
          ]
      : []
  }
  const key = target.groupKey
  const placedOn = (lane: Lane) => {
    const placed = key === undefined ? undefined : lane.placements.get(key)
    const picked = placed?.features.indexOf(record) ?? -1
    const index = picked >= 0 ? picked : placed?.intervals.length === 1 ? 0 : -1
    const placement = placed?.intervals[index]
    const orientation = placed?.orientations[index]
    return placement && orientation !== undefined
      ? [{ lane, placement, orientation }]
      : []
  }
  return [...placedOn(upper), ...placedOn(lower)]
}

export function ribbonEnds(sides: readonly RibbonSide[]): LaneEnd[] {
  return sides.map(({ lane, placement }) => laneEndOf(lane, placement))
}
