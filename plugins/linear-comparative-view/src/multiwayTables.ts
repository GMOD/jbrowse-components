import { readConfObject } from '@jbrowse/core/configuration'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { rampKeyOf } from '@jbrowse/core/ui/rampKey'
import { dedupe } from '@jbrowse/core/util'
import { clipToDisplayedRegions } from '@jbrowse/core/util/Base1DUtils'
import { cssColorToHex } from '@jbrowse/core/util/colorBits'
import { colorSnapshotOf } from '@jbrowse/display-kit/colorConfigSchema'
import {
  PRESET_ATTRIBUTES,
  adapterAssemblyNames,
  colorPaintOf,
  comparativeAxis,
  declaredAttributes,
  declaredLanesOf,
  featureAttributeRanges,
  isAttributeLabels,
  locateCum,
  orderAttributeLabels,
  paintedField,
  readChannelValue,
  unpack,
} from '@jbrowse/synteny-core'

import { thinWidthFade } from './LinearSyntenyDisplay/shaders/syntenyTypes.js.generated.ts'
import { ribbonMaxPerpWidth } from './LinearSyntenyDisplay/syntenyRibbonPath.ts'
import { KIND_BASE_TILE } from './LinearSyntenyRPC/syntenyKinds.ts'
import {
  executeMultiWayFeatures,
  liftAlignmentOps,
  multiWayFeaturesOf,
} from './MultiWaySyntenyDisplay/MultiWayGetFeatures.ts'
import { lanePairKey } from './MultiWaySyntenyDisplay/alignmentOps.ts'
import {
  decideLaneFrames,
  frameFromDecision,
  laneBpAt,
} from './MultiWaySyntenyDisplay/laneDecision.ts'
import { starAnchorOf } from './MultiWaySyntenyDisplay/laneFetch.ts'
import { lanesInForce } from './MultiWaySyntenyDisplay/laneSelection.ts'
import {
  buildLanes,
  geneLabelRowPx,
  laneGeometry,
} from './MultiWaySyntenyDisplay/laneStack.ts'
import {
  anchorlessGroupsOf,
  clipGroupToAnchor,
  frameOpenings,
  frameSegments,
  groupFeatures,
  laneBpOfOpened,
  laneFetchRegion,
  laneOpeningsOf,
  rowAssembliesOf,
  tickIntervalFor,
} from './MultiWaySyntenyDisplay/layoutMultiWay.ts'
import { ribbonColorScales } from './MultiWaySyntenyDisplay/legend.ts'
import { buildRibbonGeometry } from './MultiWaySyntenyDisplay/multiwayGeometry.ts'
import { ribbonColorConfigSchema } from './MultiWaySyntenyDisplay/ribbonColorConfigSchema.ts'
import { getMate, isNamedRecord } from './syntenyMate.ts'

import type { LaneLinks } from './MultiWaySyntenyDisplay/alignmentOps.ts'
import type {
  LaneDecision,
  LanePin,
} from './MultiWaySyntenyDisplay/laneDecision.ts'
import type { Lane } from './MultiWaySyntenyDisplay/laneStack.ts'
import type {
  FetchRegion,
  MultiWayGroup,
  RowFrame,
  Span,
} from './MultiWaySyntenyDisplay/layoutMultiWay.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Feature } from '@jbrowse/core/util'
import type {
  AttributeRange,
  AxisArgs,
  ColorArg,
  ComparativeAxis,
} from '@jbrowse/synteny-core'

export interface MultiWayTablesArgs {
  adapterConfig: Record<string, unknown>
  /**
   * The anchor lane, the regions a linear genome view shows across `width`
   * px: its assembly is the view's, the adapter's first unless named. Every
   * other lane picks its own contig, block, zoom and orientation from the
   * alignments, as the display does.
   */
  anchor: AxisArgs
  /**
   * A lane's contig and, with `at`, a lane bp in the block it draws, as the
   * lane picker pins them, by assembly
   */
  pins?: Record<string, LanePin>
  /**
   * The display's settings, as a `MultiWaySyntenyDisplay` config writes
   * them: `ribbonColor` (a CSS color, or the color object's slots such as
   * `{ field: 'strand' }`), `rows` (`domain`, the lanes that stack first,
   * and `kept`, the lanes drawn), `hideUnlabelled`, `drawCurves`,
   * `bridgeSkippedLanes`, `splitStrands`, `showGeneLabels`,
   * `inlineLaneNames` and `height`, the stack's px.
   */
  display?: {
    ribbonColor?: ColorArg
    rows?: { domain?: string[]; kept?: string[] }
    hideUnlabelled?: boolean
    drawCurves?: boolean
    bridgeSkippedLanes?: boolean
    splitStrands?: boolean
    showGeneLabels?: boolean
    inlineLaneNames?: boolean
    height?: number
  }
}

const DEFAULT_HEIGHT = 240
const SESSION = 'tables'

// `|| 0` drops the sign of a negative zero, which JSON cannot carry
const wholeBp = (bp: number) => Math.round(bp) || 0

const KIND_NAMES: Record<number, string> = {
  [KIND_BASE_TILE]: 'mismatch',
}

/** The anchor lane as the view places it: px of a span, clipped to its regions. */
function anchorPlacer(axis: ComparativeAxis, width: number) {
  const layout = {
    displayedRegions: axis.regions,
    bpPerPx: axis.bpPerPx,
    offsetPx: 0,
    width,
    minimumBlockWidth: 0,
  }
  const pxOf = (refName: string, coord: number) => {
    const k = axis.regions.findIndex(
      r => r.refName === refName && coord >= r.start && coord <= r.end,
    )
    const r = axis.regions[k]
    return r === undefined
      ? undefined
      : (axis.before[k]! + (r.reversed ? r.end - coord : coord - r.start)) /
          axis.bpPerPx
  }
  const placement = (refName: string, start: number, end: number) => {
    const clipped = clipToDisplayedRegions(layout, { refName, start, end })
    const a = clipped && pxOf(refName, clipped.start)
    const b = clipped && pxOf(refName, clipped.end)
    return clipped && a !== undefined && b !== undefined
      ? { clipped, span: [a, b] as Span }
      : undefined
  }
  return { pxOf, placement }
}

function anchorRegionSpans(axis: ComparativeAxis): Span[] {
  return axis.regions.map((r, k) => {
    const left = axis.before[k]! / axis.bpPerPx
    const right = (axis.before[k]! + r.end - r.start) / axis.bpPerPx
    return r.reversed ? [right, left] : [left, right]
  })
}

/** The groups a static view shows, each cut to the regions it meets. */
function shownGroups(groups: MultiWayGroup[], axis: ComparativeAxis) {
  return groups.flatMap(group => {
    const { refName, start, end } = group.anchor
    const met = axis.regions.filter(
      r => r.refName === refName && start < r.end && end > r.start,
    )
    return met.length
      ? [
          clipGroupToAnchor(
            group,
            Math.min(...met.map(r => r.start)),
            Math.max(...met.map(r => r.end)),
          ),
        ]
      : []
  })
}

function readDisplay(display: MultiWayTablesArgs['display'] = {}) {
  const color = display.ribbonColor
  const conf = ribbonColorConfigSchema.create(
    typeof color === 'string' ? { value: color } : (color ?? {}),
  )
  const setting = colorSnapshotOf(conf)
  return {
    value: String(readConfObject(conf, 'value')),
    field: paintedField(setting),
    paint: colorPaintOf(conf),
    domain: (readConfObject(conf, 'domain') as string[] | undefined) ?? [],
    range: readConfObject(conf, 'range') as string[] | undefined,
    labels: setting.labels,
    title: setting.title,
    descending: readConfObject(conf, 'descending') === true,
    rowsDomain: display.rows?.domain ?? [],
    kept: display.rows?.kept ?? [],
    hideUnlabelled: display.hideUnlabelled ?? false,
    drawCurves: display.drawCurves ?? false,
    bridgeSkippedLanes: display.bridgeSkippedLanes ?? true,
    splitStrands: display.splitStrands ?? true,
    showGeneLabels: display.showGeneLabels ?? true,
    inlineLaneNames: display.inlineLaneNames ?? false,
    height: display.height ?? DEFAULT_HEIGHT,
  }
}

/** The key the display shows for its ribbons: chips, and each ramp's bar. */
function ribbonKey(scales: ColorScale[]) {
  const legend = { label: [] as string[], color: [] as string[] }
  let legendTitle = ''
  const ramps = []
  for (const scale of scales) {
    if (scale.kind === 'categorical') {
      for (const { label, color } of scale.entries) {
        if (color !== undefined) {
          legendTitle ||= scale.title ?? ''
          legend.label.push(label)
          legend.color.push(cssColorToHex(color))
        }
      }
    } else {
      ramps.push(rampKeyOf(scale))
    }
  }
  return { legend, legendTitle, ramps }
}

/**
 * Each lane, and each stretch of its sequence across the view with the px it
 * spans: the anchor's regions end to end, or a mate lane's frame cut at the
 * holes it opens.
 */
function laneTables(lanes: Lane[], axis: ComparativeAxis, width: number) {
  const lane = {
    lane: [] as number[],
    assembly: [] as string[],
    label: [] as string[],
    anchor: [] as boolean[],
    chrom: [] as (string | null)[],
    flipped: [] as boolean[],
    bpPerPx: [] as number[],
    alsoOn: [] as string[],
  }
  const segments = {
    lane: [] as number[],
    chrom: [] as string[],
    start: [] as number[],
    end: [] as number[],
    x1: [] as number[],
    x2: [] as number[],
  }
  const segment = (
    i: number,
    chrom: string,
    start: number,
    end: number,
    [x1, x2]: Span,
  ) => {
    segments.lane.push(i)
    segments.chrom.push(chrom)
    segments.start.push(start)
    segments.end.push(end)
    segments.x1.push(x1)
    segments.x2.push(x2)
  }
  lanes.forEach((l, i) => {
    const { frame } = l
    lane.lane.push(i)
    lane.assembly.push(l.assemblyName)
    lane.label.push(l.label)
    lane.anchor.push(l.isAnchor)
    lane.chrom.push(
      l.isAnchor
        ? [...new Set(axis.regions.map(r => r.refName))].join(',')
        : (frame?.refName ?? null),
    )
    lane.flipped.push(frame?.flipped ?? false)
    lane.bpPerPx.push(l.bpPerPx)
    lane.alsoOn.push(frame?.alsoOn.join(',') ?? '')
    if (l.isAnchor) {
      anchorRegionSpans(axis).forEach((span, k) => {
        const r = axis.regions[k]!
        segment(
          i,
          r.refName,
          r.start,
          r.end,
          r.reversed ? [span[1], span[0]] : span,
        )
      })
    } else if (frame) {
      const openings = frameOpenings(frame)
      const lo = Math.max(0, Math.ceil(laneBpOfOpened(openings, frame.min)))
      const hi = Math.floor(laneBpOfOpened(openings, frame.max))
      for (const s of frameSegments(frame, lo, hi, width)) {
        segment(i, frame.refName, s.start, s.end, s.px)
      }
    }
  })
  return { lanes: lane, segments, ...blockRows(lanes) }
}

/** Each run of each group on each lane: the boxes the ribbons join. */
function blockRows(lanes: Lane[]) {
  const blocks = {
    lane: [] as number[],
    group: [] as string[],
    name: [] as (string | null)[],
    chrom: [] as string[],
    start: [] as number[],
    end: [] as number[],
    strand: [] as number[],
    x1: [] as number[],
    x2: [] as number[],
  }
  lanes.forEach((lane, i) => {
    for (const [key, { spans, intervals, orientations }] of lane.placements) {
      intervals.forEach((interval, j) => {
        const [x1, x2] = spans[j]!
        blocks.lane.push(i)
        blocks.group.push(key)
        blocks.name.push(interval.name ?? null)
        blocks.chrom.push(interval.refName)
        blocks.start.push(interval.start)
        blocks.end.push(interval.end)
        blocks.strand.push(orientations[j]!)
        blocks.x1.push(x1)
        blocks.x2.push(x2)
      })
    }
  })
  return { blocks }
}

function textOf(value: unknown) {
  return typeof value === 'string' ? value : null
}

/** The records the ribbons draw, each with its mate and the measurements it carries. */
function alignmentRows(
  features: Feature[],
  groups: string[],
  attributeRanges: Record<string, AttributeRange>,
) {
  const mates = features.map(f => getMate(f))
  const columns: Record<string, (number | string | null)[]> = {}
  for (const [name, range] of Object.entries(attributeRanges)) {
    columns[name === 'mappingQual' ? 'mapq' : name] = features.map(f => {
      const value: unknown = isAttributeLabels(range)
        ? f.get(name)
        : readChannelValue(f, name)
      return typeof value === 'string' ||
        (typeof value === 'number' && !Number.isNaN(value))
        ? value
        : null
    })
  }
  return {
    id: features.map(f => f.id()),
    group: groups,
    name: features.map(f => textOf(f.get('name'))),
    assembly: features.map(f => textOf(f.get('assemblyName'))),
    chrom: features.map((f): string => f.get('refName')),
    start: features.map((f): number => f.get('start')),
    end: features.map((f): number => f.get('end')),
    strand: features.map(f => (f.get('strand') === -1 ? -1 : 1)),
    mateAssembly: mates.map(m => m?.assemblyName ?? null),
    mateChrom: mates.map(m => m?.refName ?? null),
    mateStart: mates.map(m => m?.start ?? null),
    mateEnd: mates.map(m => m?.end ?? null),
    ...columns,
  }
}

/**
 * #api
 * A multi-genome synteny track as the multi-way display stacks it under a
 * linear genome view, as tables: `lanes`, the anchor first and then each
 * mate lane in the order it stacks, with the contig, zoom and orientation
 * it picked; `segments`, the stretches of each lane's sequence across the
 * view, cut where a lane opens a hole for a deletion, each with the px it
 * spans; `blocks`, each alignment's placement on each lane; `ribbons`, what
 * each gutter draws in paint order, a trapezoid from a span on its upper
 * lane to a span on its lower one, with its color and the alpha it
 * composites at; `alignments`, the records the ribbons draw; and `legend`,
 * the key. Positions are genomic on each lane, and px across the view's
 * `width`, where a lane's own frame puts them.
 */
export async function multiwayTables(
  pluginManager: PluginManager,
  { adapterConfig, anchor: anchorArgs, pins = {}, display }: MultiWayTablesArgs,
) {
  const settings = readDisplay(display)
  const axis = comparativeAxis(anchorArgs, adapterConfig, 0)
  const anchor = axis.assemblyName
  const { width } = anchorArgs
  const unitBp = axis.bpPerPx * width

  const type = adapterConfig.type
  const capabilities =
    typeof type === 'string'
      ? pluginManager.getAdapterType(type).adapterCapabilities
      : []
  const declaresLanes = capabilities.includes('headerLanes')
  const pairsOnAnchor = capabilities.includes('lanePairsOnAnchor')
  const { dataAdapter } = await getAdapter(
    pluginManager,
    SESSION,
    adapterConfig,
  )
  const header: unknown =
    declaresLanes && 'getHeader' in dataAdapter
      ? await (dataAdapter as { getHeader: () => Promise<unknown> }).getHeader()
      : undefined
  const starAnchor = starAnchorOf(header)
  const declared = header === undefined ? [] : declaredLanesOf(header)
  const configured = declaresLanes
    ? adapterAssemblyNames(adapterConfig).filter(name => name !== anchor)
    : []
  const selection = lanesInForce(settings.kept, configured)

  const fetch = async (
    regions: FetchRegion[],
    opts: Parameters<typeof executeMultiWayFeatures>[0]['opts'],
    haplotypes?: string[],
  ) =>
    multiWayFeaturesOf(
      liftAlignmentOps(
        await executeMultiWayFeatures({
          pluginManager,
          sessionId: SESSION,
          adapterConfig,
          regions,
          ...(haplotypes === undefined ? {} : { haplotypes }),
          opts,
        }),
      ),
    )

  const anchorRegions = axis.regions.map(r => ({
    assemblyName: anchor,
    refName: r.refName,
    start: r.start,
    end: r.end,
  }))
  const fetched = await fetch(
    anchorRegions,
    { mateShape: 'grouped' },
    declaresLanes && selection ? [...selection] : undefined,
  )
  const features = dedupe(fetched.features, f => f.id())
  const groups = groupFeatures(features)
  const openingsOf = laneOpeningsOf(groups)
  const drawn = (name: string) =>
    selection === undefined || selection.includes(name)
  const rows = rowAssembliesOf(groups, settings.rowsDomain).filter(
    name => name !== anchor && drawn(name),
  )

  const shown = shownGroups(groups, axis)
  const place = anchorPlacer(axis, width)
  const anchorAbsX = new Map<
    string,
    { coord: { refName: string; coord: number }; x: number }
  >()
  const anchorSpans = new Map<string, Span>()
  for (const group of shown) {
    const p = place.placement(
      group.anchor.refName,
      group.anchor.start,
      group.anchor.end,
    )
    if (p) {
      anchorSpans.set(group.key, p.span)
      anchorAbsX.set(group.key, {
        coord: {
          refName: group.anchor.refName,
          coord: (p.clipped.start + p.clipped.end) / 2,
        },
        x: (p.span[0] + p.span[1]) / 2,
      })
    }
  }
  const reversed =
    axis.regions.length > 0 && axis.regions.every(r => !!r.reversed)
  const decisions = decideLaneFrames({
    groups: shown,
    assemblyNames: rows,
    anchorX: new Map([...anchorAbsX].map(([key, { x }]) => [key, x])),
    anchorCoordOf: group => anchorAbsX.get(group.key)!.coord,
    pxOfAnchor: coord => place.pxOf(coord.refName, coord.coord),
    unitBp,
    width,
    anchorReversed: reversed,
    previous: new Map(),
    pinned: new Map(Object.entries(pins)),
    openingsOf,
  })
  const frameOf = (decision: LaneDecision, assemblyName: string) => {
    const pivot = place.pxOf(
      decision.pivotAnchor.refName,
      decision.pivotAnchor.coord,
    )
    return pivot === undefined
      ? undefined
      : frameFromDecision(
          decision,
          pivot,
          unitBp,
          width,
          reversed,
          openingsOf(assemblyName, decision.refName),
        )
  }
  const rowFrames = new Map<string, RowFrame | undefined>(
    rows.map(name => {
      const decision = decisions.get(name)
      return [name, decision && frameOf(decision, name)]
    }),
  )
  const laneRegion = (name: string): FetchRegion[] => {
    const frame = rowFrames.get(name)
    return frame ? [{ assemblyName: name, ...laneFetchRegion(frame) }] : []
  }

  const nameless = features.length > 0 && !features.some(isNamedRecord)
  const rowsVsAnchor = !(pairsOnAnchor || starAnchor === undefined)
  const laneLinks = new Map<string, LaneLinks>()
  if (nameless && !rowsVsAnchor) {
    await Promise.all(
      rows.slice(1).map(async (lower, i) => {
        const upper = rows[i]!
        const regions = pairsOnAnchor
          ? rowFrames.get(upper) && rowFrames.get(lower)
            ? anchorRegions
            : []
          : rowFrames.get(lower)
            ? laneRegion(upper)
            : []
        const pair =
          regions.length > 0
            ? await fetch(regions, {
                ...(pairsOnAnchor ? { queryAssemblyName: upper } : {}),
                targetAssemblyName: lower,
              }).catch(() => undefined)
            : undefined
        if (pair?.features.length) {
          laneLinks.set(lanePairKey(upper, lower), {
            links: pair.features,
            ops: pair.ops,
          })
        }
      }),
    )
  }
  const anchorless =
    features.some(isNamedRecord) && starAnchor === undefined
      ? anchorlessGroupsOf(
          await Promise.all(
            rows.map(
              async lane =>
                [
                  lane,
                  laneRegion(lane).length
                    ? (await fetch(laneRegion(lane), { mateShape: 'grouped' }))
                        .features
                    : [],
                ] as const,
            ),
          ),
          name => name === anchor,
        )
      : []

  const labels = new Map(declared.map(lane => [lane.name, lane.label]))
  const stack = buildLanes({
    assemblyNames: [anchor, ...rows],
    groups: [...shown, ...anchorless],
    anchorSpans,
    rowFrames,
    axisSpanOf: (refName, start, end) =>
      place.placement(refName, start, end)?.span,
    anchorRegionSpans: anchorRegionSpans(axis),
    anchorBpPerPx: axis.bpPerPx,
    contigOf: () => undefined,
    refNameAliasOf: () => undefined,
    width,
    geometry: laneGeometry(
      settings.height,
      1 + rows.length,
      settings.splitStrands,
      geneLabelRowPx(settings.showGeneLabels),
      0,
      settings.inlineLaneNames,
    ),
    labelOf: name => labels.get(name) ?? name,
  })

  const channelNames = [
    ...PRESET_ATTRIBUTES,
    ...declaredAttributes(adapterConfig),
  ]
  const attributeRanges = orderAttributeLabels(
    featureAttributeRanges(features, channelNames),
    settings.domain,
    settings.range,
  )
  const geometry = buildRibbonGeometry({
    stack,
    anchorOps: fetched.ops,
    laneLinks,
    ribbonColor: settings.value,
    ribbonColorField: settings.field,
    attributeRanges,
    hideUnlabelled: settings.hideUnlabelled,
    paint: settings.paint,
    drawCurves: settings.drawCurves,
    bridgeSkippedLanes: settings.bridgeSkippedLanes,
    rowsVsAnchor,
  })

  const onLane = (lane: Lane, px: number) => {
    if (lane.isAnchor) {
      const at = locateCum(axis, px * axis.bpPerPx)
      return { refName: axis.regions[at.region]!.refName, coord: at.coord }
    }
    const frame = lane.frame!
    return { refName: frame.refName, coord: laneBpAt(frame, px, width) }
  }
  const footOn = (lane: Lane, a: number, b: number) => {
    const from = onLane(lane, a)
    const to = onLane(lane, b)
    return {
      refName: from.refName,
      start: wholeBp(from.coord),
      end: wholeBp(to.coord),
    }
  }

  const ribbons = {
    alignment: [] as number[],
    group: [] as string[],
    kind: [] as string[],
    gutter: [] as number[],
    upperLane: [] as number[],
    lowerLane: [] as number[],
    upperChrom: [] as string[],
    upperStart: [] as number[],
    upperEnd: [] as number[],
    lowerChrom: [] as string[],
    lowerStart: [] as number[],
    lowerEnd: [] as number[],
    upperX1: [] as number[],
    upperX2: [] as number[],
    lowerX1: [] as number[],
    lowerX2: [] as number[],
    color: [] as string[],
    alpha: [] as number[],
    thin: [] as boolean[],
    bridge: [] as boolean[],
  }
  const corners = { sx1: 0, sx2: 0, sx3: 0, sx4: 0 }
  for (const layer of geometry.layers) {
    const cell = geometry.cells.get(layer.key)
    if (cell?.kind !== 'ribbons') {
      continue
    }
    const [row, toRow] = layer.rows
    const upperRow = rowsVsAnchor && row > 0 ? 0 : row
    const upper = stack.lanes[upperRow]!
    const lower = stack.lanes[toRow]!
    const { bp1, bp2, bp3, bp4, kinds, colors, instanceFeatureIdx } = cell.data
    for (let i = 0; i < cell.data.instanceCount; i++) {
      const packed = colors[i] ?? 0
      if (packed >>> 24 === 0) {
        continue
      }
      corners.sx1 = bp1[i] ?? 0
      corners.sx2 = bp2[i] ?? 0
      corners.sx3 = bp3[i] ?? 0
      corners.sx4 = bp4[i] ?? 0
      const kind = kinds[i] ?? 0
      const perp = ribbonMaxPerpWidth(corners, layer.height, layer.curves)
      const thin = perp < 1
      const { color, alpha } = unpack(packed)
      const target = instanceFeatureIdx[i] ?? 0
      const top = footOn(upper, corners.sx1, corners.sx2)
      const bottom = footOn(lower, corners.sx4, corners.sx3)
      const ref = geometry.targets[target]
      ribbons.alignment.push(target)
      ribbons.group.push(ref?.groupKey ?? ref?.linkId ?? '')
      ribbons.kind.push(KIND_NAMES[kind] ?? 'match')
      ribbons.gutter.push(row)
      ribbons.upperLane.push(upperRow)
      ribbons.lowerLane.push(toRow)
      ribbons.upperChrom.push(top.refName)
      ribbons.upperStart.push(top.start)
      ribbons.upperEnd.push(top.end)
      ribbons.lowerChrom.push(bottom.refName)
      ribbons.lowerStart.push(bottom.start)
      ribbons.lowerEnd.push(bottom.end)
      ribbons.upperX1.push(corners.sx1)
      ribbons.upperX2.push(corners.sx2)
      ribbons.lowerX1.push(corners.sx4)
      ribbons.lowerX2.push(corners.sx3)
      ribbons.color.push(color)
      ribbons.alpha.push(alpha * (thin ? thinWidthFade(perp, kind, false) : 1))
      ribbons.thin.push(thin)
      ribbons.bridge.push(toRow !== row + 1)
    }
  }

  return {
    ...laneTables(stack.lanes, axis, width),
    ribbons,
    alignments: alignmentRows(
      geometry.targets.map(t => t.feature),
      geometry.targets.map(t => t.groupKey ?? t.linkId ?? ''),
      attributeRanges,
    ),
    ...ribbonKey(
      ribbonColorScales(settings.field, attributeRanges, {
        domain: settings.domain,
        hideUnlabelled: settings.hideUnlabelled,
        slotColor: settings.value,
        labels: settings.labels,
        title: settings.title,
        descending: settings.descending,
        paint: settings.paint,
        against: rowsVsAnchor ? anchor : undefined,
      }),
    ),
    field: settings.field,
    tickInterval: tickIntervalFor(unitBp),
    rowsVsAnchor,
    height: settings.height,
    curves: settings.drawCurves,
    assemblyNames: [anchor, ...rows],
  }
}

export type MultiWayTables = Awaited<ReturnType<typeof multiwayTables>>
