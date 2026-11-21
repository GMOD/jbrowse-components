import { joinTables } from '@jbrowse/core/data_adapters/tables'
import { cssColorToHex, normalizedRgbToHex } from '@jbrowse/core/util/colorBits'
import {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
} from '@jbrowse/render-core/scoreScale'
import {
  CONNECTOR_ARROW,
  CONNECTOR_BOW,
  CONNECTOR_LEADING_2,
  CONNECTOR_MINUS_1,
  CONNECTOR_MINUS_2,
} from '@jbrowse/render-core/shaders/connectorMarkConsts'
import { linkStrokeWidthPx } from '@jbrowse/render-core/shaders/linkMark'
import { LINK_SIZE_SCALED } from '@jbrowse/render-core/shaders/linkMarkConsts'

import {
  arcBandScale,
  readCloudDomainBp,
} from './LinearAlignmentsDisplay/renderers/arcMarks.ts'
import {
  arcsOverlayCoverage,
  laneBands,
  sectionDipFloor,
} from './LinearAlignmentsDisplay/sectionLayout.ts'
import {
  ARC_COLOR_INTERCHROM,
  arcColorSlot,
} from './features/arcs/arcColors.ts'
import {
  arcsToRegionResult,
  regionIndexOf,
} from './features/arcs/arcRegions.ts'
import {
  ARC_SPLIT_SWATCH,
  isArcSplitCategory,
} from './features/arcs/arcSplitCategory.ts'
import { arcOpacity } from './features/arcs/bandFeed.ts'
import { emptyArcsUploadData } from './features/arcs/types.ts'
import { junctionClass } from './features/junctions/junctionClass.ts'
import {
  connectorArrowPx,
  connectorInWindows,
  connectorInstance,
  connectorRgb,
  flooredBend,
  linePassInstance,
} from './features/linkedReads/connectorFeed.ts'
import { arcSlotCategory } from './shaders/palettes.ts'
import { paintedLevelOf } from './shared/alignmentsColor.ts'
import { oneRowPerSplitTwin } from './shared/legendUtils.ts'
import { getOrCreate } from './shared/util.ts'
import { rowsWhere, rowsAt, spanTouches } from './tableRows.ts'

import type { WorkerPileupData } from './RenderAlignmentDataRPC/types.ts'
import type { ArcSplitCategory } from './features/arcs/arcSplitCategory.ts'
import type { CrossRegionArc, RegionInfo } from './features/arcs/arcTypes.ts'
import type { ArcsUploadData } from './features/arcs/types.ts'
import type { LinkedPair } from './features/linkedReads/compute.ts'
import type { ColorPalette, RGBColor } from './shaders/colors.ts'
import type { ArcCategory } from './shaders/palettes.ts'
import type { AlignmentsTablesHostModel } from './tablesHost.ts'

/** The index of the region holding `bp`, -1 where none does. */
export function footRegion(
  regionInfos: RegionInfo[],
  refName: string,
  bp: number,
) {
  return regionIndexOf(regionInfos, refName, bp) ?? -1
}

const ARC_SHAPE_NAMES = ['arc', 'flat', 'flatSplit', 'unplaced'] as const

const INSERT_SIZE_LEVEL_OF = paintedLevelOf('insertSizeAndOrientation')

/**
 * The `insertSizeAndOrientation` level whose color an arc paints: a pair's
 * own, and a split read's that of the pair twin it shares a color with.
 */
export function arcLevelOf(category: ArcCategory) {
  return (
    INSERT_SIZE_LEVEL_OF.get(
      isArcSplitCategory(category) ? ARC_SPLIT_SWATCH[category] : category,
    ) ?? ''
  )
}

// A split read's arc's class: a junction's `junction.class`, and an
// insertion, which draws no junction.
const ARC_SPLIT_CLASS: Record<ArcSplitCategory, string> = {
  splitForward: junctionClass('splitForward'),
  splitBack: junctionClass('splitBack'),
  splitInvLL: junctionClass('splitInvLL'),
  splitInvRR: junctionClass('splitInvRR'),
  splitInsertion: 'insertion',
}

/** A split read's arc's class, '' for a pair's. */
export function arcClassOf(category: ArcCategory) {
  return isArcSplitCategory(category) ? ARC_SPLIT_CLASS[category] : ''
}

const DPR_PAST_THE_ANTIALIASING_FLOOR = Number.POSITIVE_INFINITY

export interface ArcPaint {
  slotColor: string[]
  widthOf: (support: number) => number
}

/** Arcs as the band paints them, each foot naming the region holding it. */
function arcRows(
  a: ArcsUploadData,
  { slotColor, widthOf }: ArcPaint,
  feet: (arc: number) => readonly [number, number],
) {
  const n = a.numArcs
  const start = Array.from(a.arcX1.subarray(0, n))
  const end = Array.from(a.arcX2.subarray(0, n))
  const shape = Array.from(a.arcShapeTypes.subarray(0, n))
  const colorSlot = Array.from(a.arcColorTypes.subarray(0, n), arcColorSlot)
  const support = Array.from(a.arcSupport.subarray(0, n))
  const arcFeet = start.map((_, i) => feet(i))
  return {
    start,
    end,
    shape: shape.map(s => ARC_SHAPE_NAMES[s] ?? 'arc'),
    level: colorSlot.map(c => arcLevelOf(arcSlotCategory(c))),
    class: colorSlot.map(c => arcClassOf(arcSlotCategory(c))),
    color: colorSlot.map(c => slotColor[c]!),
    opacity: shape.map(arcOpacity),
    y: Array.from(a.arcYBp.subarray(0, n)),
    span: Array.from(a.arcSpanBp.subarray(0, n)),
    support,
    width: support.map(widthOf),
    startRegion: arcFeet.map(f => f[0]),
    endRegion: arcFeet.map(f => f[1]),
  }
}

/**
 * One section's arcs and interchromosomal ticks in one region, in the band's
 * paint: the arcs the region draws, then those whose near foot it holds and
 * whose far foot another region holds, which the display draws across both.
 */
function sectionConnections(
  own: ArcsUploadData,
  crossing: CrossRegionArc[],
  ownFeet: (start: number, end: number) => [number, number],
  paint: ArcPaint,
) {
  const ownArcs = arcRows(own, paint, i =>
    ownFeet(own.arcX1[i]!, own.arcX2[i]!),
  )
  const crossArcs = arcRows(arcsToRegionResult(crossing, []), paint, i => [
    crossing[i]!.p1RegionIndex,
    crossing[i]!.p2RegionIndex,
  ])
  const ticks = own.numArcLines
  return {
    arcs: joinTables([
      { columns: {}, tables: { arcs: ownArcs } },
      { columns: {}, tables: { arcs: crossArcs } },
    ]).arcs,
    arcTicks: {
      position: own.arcLinePositions.subarray(0, ticks),
      support: own.arcLineSupport.subarray(0, ticks),
      partners: own.arcLinePartnerRefNames
        .slice(0, ticks)
        .map(names => names.join(',')),
      color: new Array<string>(ticks).fill(
        paint.slotColor[ARC_COLOR_INTERCHROM]!,
      ),
      width: Array.from(own.arcLineSupport.subarray(0, ticks), paint.widthOf),
    },
  }
}

/**
 * A region's arcs and ticks the window shows, of the ones the arc pass found
 * over the reads fetched with the view's margin.
 */
function connectionsInWindow(
  { arcs, arcTicks }: ReturnType<typeof sectionConnections>,
  window: { start: number; end: number },
) {
  return {
    arcs: rowsAt(arcs, i => spanTouches(window, arcs.start[i]!, arcs.end[i]!)),
    arcTicks: rowsWhere(
      arcTicks,
      position => position >= window.start && position < window.end,
    ),
  }
}

/**
 * The read-connection band the display draws under `readConnections`, from
 * the display's own arc pass over every section and region at once: each
 * section's mate-pair and split-read arcs, or the read cloud's bars, in the
 * colors and stroke widths the band paints them, its interchromosomal ticks,
 * and the band's key. `y` is where the band plots a connection, in bp: an
 * arc's genomic radius, or the read cloud's |TLEN| jittered as the display
 * jitters it so coincident pairs separate; `span` is the distance itself. An
 * arc is listed once, under the region holding its near foot, else its far
 * one, else the first its span crosses.
 */
export function readConnectionTables(
  host: AlignmentsTablesHostModel,
  colors: { palette: ColorPalette },
  slotColor: string[],
) {
  const { arcsResult: result, regionInfos } = host
  const stroke = host.readConnectionsStrokeScale
  const widthOf = (support: number) =>
    linkStrokeWidthPx(
      support,
      LINK_SIZE_SCALED,
      stroke.range[0],
      stroke.domain[0],
      stroke.domain[1],
      stroke.scale === 'log' ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR,
      stroke.range[0],
      stroke.range[1],
      DPR_PAST_THE_ANTIALIASING_FLOOR,
    )
  const paint = { slotColor, widthOf }
  const bySection = new Map(
    [...host.rawDataByGroup.keys()].map(key => [
      key,
      new Map(
        regionInfos.map((window, i) => [
          i,
          connectionsInWindow(
            sectionConnections(
              result.byGroup.get(key)?.get(i) ?? emptyArcsUploadData(),
              (result.crossRegionByGroup.get(key) ?? []).filter(
                arc => arc.p1RegionIndex === i,
              ),
              (start, end) => [
                footRegion(regionInfos, window.refName, start),
                footRegion(regionInfos, window.refName, end),
              ],
              paint,
            ),
            window,
          ),
        ]),
      ),
    ]),
  )
  const legend = oneRowPerSplitTwin(
    host.connectionLegendItems(colors.palette),
  ).filter(item => item.color !== undefined)
  return {
    bySection,
    arcLegend: {
      label: legend.map(item => item.label),
      color: legend.map(item => cssColorToHex(item.color!)),
    },
    arcLegendTitle: host.arcLegendTitle,
    arcSpanMax: result.maxFlatArcSpanBp,
    arcScale: arcScaleOf(host, result.maxFlatArcSpanBp),
  }
}

/**
 * The read-connection band's y scale as the display draws it
 * (`arcBandScale`), and where: `band` 'arcs', a band of its own, or under
 * placement 'overlay' with coverage shown 'coverage', whose top `heightPx` of
 * the coverage band's height, above the depth axis' baseline, the
 * connections draw in. Null while the band is off.
 */
function arcScaleOf(host: AlignmentsTablesHostModel, maxFlatArcSpanBp: number) {
  const mode = host.drawnReadConnections
  const { arcBand } = pooledLaneBands(host)
  return arcBand
    ? {
        band: arcsOverlayCoverage(host.drawnLaneBandsInput)
          ? 'coverage'
          : 'arcs',
        heightPx: arcBand.height,
        ...arcBandScale(
          arcBand,
          Math.max(...host.readConnectionsStrokeScale.range),
          mode === 'rule' ? readCloudDomainBp(maxFlatArcSpanBp) : undefined,
        ),
      }
    : null
}

// The pooled band stack as the display draws it, one lane holding every
// strip any lane reserves.
export function pooledLaneBands(host: AlignmentsTablesHostModel) {
  const s = host.drawnLaneBandsInput
  return laneBands(s, s, host.bandHeights)
}

/**
 * Each section's connectors as the display draws them (`connectorsByGroup`):
 * the straight-line pass's pairs (`linePassInstance`) and the connector
 * mark's (`connectorInstance`), those reaching into a window
 * (`connectorInWindows`), each filed by the region holding its first end. A
 * dip or loop is held above the bottom of the sections as the display
 * stacks them, scrolled to their end (`flooredBend`).
 */
export function sectionConnectors(
  host: AlignmentsTablesHostModel,
  readPitch: number,
) {
  const regions = host.frames
  const windows = host.regionInfos
  const { featureHeight } = host
  const arrows = connectorArrowPx(featureHeight) > 0
  const layout = host.sections
  return new Map(
    layout.sections.map(sec => {
      const { groupKey: key, rowsHeight: pileupHeight } = sec
      const dipFloor = sectionDipFloor(layout, sec, 0)
      const connectors = host.connectorsByGroup.get(key)
      const byRegion = new Map<number, PlacedConnector[]>()
      const file = (pair: LinkedPair, placed: PlacedConnector['placed']) => {
        if (connectorInWindows(placed, regions, windows)) {
          getOrCreate(byRegion, placed.region, () => []).push({ pair, placed })
        }
      }
      for (const pair of connectors?.linePairs ?? []) {
        const placed = linePassInstance(pair, regions, pileupHeight, readPitch)
        if (placed) {
          file(pair, placed)
        }
      }
      for (const pair of connectors?.overlayPairs ?? []) {
        const placed = connectorInstance(
          pair,
          regions,
          pileupHeight,
          readPitch,
          arrows,
        )
        if (placed) {
          file(pair, {
            ...placed,
            bend: flooredBend(placed, featureHeight, readPitch, dipFloor),
          })
        }
      }
      return [key, byRegion]
    }),
  )
}

export interface PlacedConnector {
  pair: LinkedPair
  placed: NonNullable<ReturnType<typeof connectorInstance>>
}

/**
 * One region's connectors as the connector mark draws them: each end's
 * position, row and region (the second end may sit in another), the color of
 * the connection's arc at `opacity` (`colorThroughHidden` for a junction
 * through a region not shown, `connectorRgb`), the stroke `width` in px, and
 * the shape:
 * `straight`, a `curve` dipping `dip` px below its rows, a `bow` up over
 * them, or a `loop` where a read maps back over itself, dipping `dip` px and
 * ending in an `arrow`. A `dip` is the one the display draws: at most half
 * the room between its lower row's center and the bottom of the sections as
 * the display stacks them, scrolled to their end, so a host whose y axis ends
 * at the last row keeps every curve without reserving room under it.
 * `strand` and `endStrand` (1 or -1) and `leading`, the second end being a
 * split junction's leading edge, set which way each end's curve leaves its
 * read: `alignmentConnectorCurves` places the curve at a host's scale. `key`
 * and `mateKey` are the two reads' `key` in `reads`.
 */
export function connectorColumns(
  connected: readonly PlacedConnector[],
  slotRgb: readonly RGBColor[],
  palette: ColorPalette,
  keyOf: (readKey: WorkerPileupData['readKeys'][number]) => number,
) {
  const bits = connected.map(({ placed }) => placed.bits)
  return {
    connectors: {
      start: connected.map(({ placed }) => placed.x),
      end: connected.map(({ placed }) => placed.x2),
      endRegion: connected.map(({ placed }) => placed.x2Region),
      row: connected.map(({ placed }) => placed.row),
      endRow: connected.map(({ placed }) => placed.row2),
      color: connected.map(({ placed }) =>
        normalizedRgbToHex(connectorRgb(placed, slotRgb, palette)),
      ),
      opacity: connected.map(({ placed }) => placed.alpha),
      width: connected.map(({ placed }) => placed.width),
      kind: connected.map(({ placed }) =>
        placed.straight
          ? 'straight'
          : placed.loop
            ? 'loop'
            : placed.bend === CONNECTOR_BOW
              ? 'bow'
              : 'curve',
      ),
      dip: connected.map(({ placed }) =>
        placed.straight || placed.bend === CONNECTOR_BOW ? 0 : placed.bend,
      ),
      strand: bits.map(b => ((b & CONNECTOR_MINUS_1) !== 0 ? -1 : 1)),
      endStrand: bits.map(b => ((b & CONNECTOR_MINUS_2) !== 0 ? -1 : 1)),
      leading: bits.map(b => (b & CONNECTOR_LEADING_2) !== 0),
      arrow: bits.map(b => (b & CONNECTOR_ARROW) !== 0),
      key: connected.map(({ pair: p }) =>
        keyOf(p.e1.data.readKeys[p.e1.readIdx]!),
      ),
      mateKey: connected.map(({ pair: p }) =>
        keyOf(p.e2.data.readKeys[p.e2.readIdx]!),
      ),
    },
  }
}
