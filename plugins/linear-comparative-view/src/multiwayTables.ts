import { fullConfSnapshot, readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { rampKeyOf } from '@jbrowse/core/ui/rampKey'
import { dedupe } from '@jbrowse/core/util'
import { cssColorToHex } from '@jbrowse/core/util/colorBits'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { colorSnapshotOf } from '@jbrowse/display-kit/colorConfigSchema'
import {
  PRESET_ATTRIBUTES,
  adapterAssemblyNames,
  colorPaintOf,
  comparativeAxis,
  declaredAttributes,
  declaredLanesOf,
  featureAttributeRanges,
  hidesUnlabelled,
  isAttributeLabels,
  locateCum,
  opacitySnapshotOf,
  orderAttributeLabels,
  readChannelValue,
  unpack,
} from '@jbrowse/synteny-core'

import { ribbonThinFade } from './LinearSyntenyDisplay/syntenyRibbonPath.ts'
import { KIND_BASE_TILE } from './LinearSyntenyRPC/syntenyKinds.ts'
import {
  executeMultiWayFeatures,
  liftAlignmentOps,
  multiWayFeaturesOf,
} from './MultiWaySyntenyDisplay/MultiWayGetFeatures.ts'
import { configSchemaFactory } from './MultiWaySyntenyDisplay/configSchema.ts'
import {
  laneGroupsFetchSpecsOf,
  laneLinksFetchSpecsOf,
  lanePairsOf,
  starAnchorOf,
} from './MultiWaySyntenyDisplay/laneFetch.ts'
import { pinsInForceOf } from './MultiWaySyntenyDisplay/lanePins.ts'
import {
  laneRowsOf,
  lanesInForce,
} from './MultiWaySyntenyDisplay/laneSelection.ts'
import {
  geneLabelRowPx,
  laneGeometry,
} from './MultiWaySyntenyDisplay/laneStack.ts'
import {
  anchorSpansOn,
  decideLanesOn,
  laneFrameOn,
  laneStackOn,
} from './MultiWaySyntenyDisplay/laneStage.ts'
import {
  anchorlessGroupsOf,
  clipGroupToAnchor,
  frameOpenings,
  frameSegments,
  groupFeatures,
  laneBpAt,
  laneBpOfOpened,
  laneFetchRegion,
  laneOpeningsOf,
  rowAssembliesOf,
  tickIntervalFor,
} from './MultiWaySyntenyDisplay/layoutMultiWay.ts'
import { ribbonColorScales } from './MultiWaySyntenyDisplay/legend.ts'
import { buildRibbonGeometry } from './MultiWaySyntenyDisplay/multiwayGeometry.ts'
import { MULTIWAY_FADE_THIN } from './MultiWaySyntenyDisplay/multiwayRenderTypes.ts'
import { paintedRibbonColor } from './MultiWaySyntenyDisplay/ribbonColorConfigSchema.ts'
import {
  laneFetchesFor,
  rowsReadAgainstAnchor,
  stacksByStructure,
} from './MultiWaySyntenyDisplay/sourceShape.ts'
import {
  laneProfiles,
  structureOrder,
} from './MultiWaySyntenyDisplay/structureOrder.ts'
import { getMate } from './syntenyMate.ts'

import type { LaneLinks } from './MultiWaySyntenyDisplay/alignmentOps.ts'
import type { LanePin } from './MultiWaySyntenyDisplay/lanePins.ts'
import type { Lane, LaneStack } from './MultiWaySyntenyDisplay/laneStack.ts'
import type { AnchorStage } from './MultiWaySyntenyDisplay/laneStage.ts'
import type {
  FetchRegion,
  MultiWayGroup,
  RowFrame,
  Span,
} from './MultiWaySyntenyDisplay/layoutMultiWay.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Feature } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type {
  AttributeRange,
  AxisArgs,
  ColorArg,
  ComparativeAxis,
  RibbonInterpolation,
  SyntenyOpacitySnapshot,
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
   * The reader's pins, as the display's `lanePins` holds them: `{ lane,
   * refName, at }` draws the lane on a contig and, with `at`, the block
   * holding that lane bp; `{ lane, refName, flipped, anchor }` sets which way
   * it faces there against the anchor's order, under `anchor` or, naming
   * none, any anchor
   */
  pins?: LanePin[]
  /** The lanes the reader hid, as the display's `hiddenLaneNames` holds them */
  hidden?: string[]
  /**
   * The display's settings, as a `MultiWaySyntenyDisplay` config writes
   * them: `ribbons.encoding.color` (a field such as `'strand'`, or the color
   * channel's slots such as `{ value: 'grey' }`), `ribbons.encoding.opacity`,
   * `ribbons.mark.interpolate`, `ribbons.filter`, `rows` (`sort`, the lanes
   * that stack first, and `kept`, the lanes drawn), `labels.name.show`,
   * `labels.lanes.placement` and `height`, the stack's px.
   */
  display?: {
    ribbons?: {
      encoding?: { color?: ColorArg; opacity?: number | SyntenyOpacitySnapshot }
      mark?: { interpolate?: RibbonInterpolation }
      filter?: FieldPredicate[]
    }
    rows?: { sort?: string[]; kept?: string[] }
    labels?: {
      name?: { show?: boolean; field?: string }
      lanes?: { placement?: 'above' | 'overlay' }
    }
    height?: number
  }
}

const SESSION = 'tables'

// `|| 0` drops the sign of a negative zero, which JSON cannot carry
const wholeBp = (bp: number) => Math.round(bp) || 0

const KIND_NAMES: Record<number, string> = {
  [KIND_BASE_TILE]: 'mismatch',
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

/**
 * Refuses a `rows.kept` lane the file holds no sequence for, naming the lanes
 * it has here, as the adapter refuses an anchor assembly it lacks.
 */
async function refuseUnknownLanes(
  kept: readonly string[],
  known: readonly string[],
  dataAdapter: AnyDataAdapter,
) {
  const has = new Set(known)
  const unknown: string[] = []
  for (const name of kept.filter(name => !has.has(name))) {
    const contigs =
      dataAdapter instanceof BaseFeatureDataAdapter
        ? await dataAdapter.getRefNames({ assemblyName: name })
        : [name]
    if (contigs.length === 0) {
      unknown.push(name)
    }
  }
  if (unknown.length > 0) {
    throw new Error(
      `rows.kept names ${unknown.join(', ')}, which this file has no lane for; its lanes here are ${[...has].join(', ')}`,
    )
  }
}

const displayConfigSchema = configSchemaFactory()

/** The display's settings as its own config reads them, defaults included. */
function readDisplay(slots: MultiWayTablesArgs['display'] = {}) {
  const conf = displayConfigSchema.create({
    type: 'MultiWaySyntenyDisplay',
    displayId: SESSION,
    ...slots,
  })
  const color = conf.ribbons.encoding.color
  const setting = colorSnapshotOf(color)
  return {
    ...paintedRibbonColor(setting),
    paint: colorPaintOf(color),
    domain: setting.scale.domain,
    range: setting.scale.range,
    names: setting.scale.names,
    title: setting.legend.title,
    descending: setting.legend.descending,
    rowsSort: readConfObject(conf, ['rows', 'sort']),
    kept: readConfObject(conf, ['rows', 'kept']),
    opacity: opacitySnapshotOf(conf.ribbons.encoding.opacity),
    filter: predicatesOf(conf.ribbons.filter),
    curves: readConfObject(conf, ['ribbons', 'mark', 'interpolate']) === 'bump',
    showGeneLabels: readConfObject(conf, ['labels', 'name', 'show']),
    inlineLaneNames:
      readConfObject(conf, ['labels', 'lanes', 'placement']) === 'overlay',
    height: readConfObject(conf, 'height'),
    config: fullConfSnapshot(conf),
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
function laneTables(
  { lanes, glyphHeight }: LaneStack,
  axis: ComparativeAxis,
  width: number,
) {
  const lane = {
    lane: [] as number[],
    assembly: [] as string[],
    label: [] as string[],
    anchor: [] as boolean[],
    chrom: [] as (string | null)[],
    flipped: [] as boolean[],
    bpPerPx: [] as number[],
    alsoOn: [] as string[],
    yTop: [] as number[],
    yBottom: [] as number[],
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
    lane.yTop.push(l.glyphTop)
    lane.yBottom.push(l.glyphTop + glyphHeight)
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
 * mate lane in the order a fresh load stacks it, with the contig, zoom and orientation
 * it picked; `segments`, the stretches of each lane's sequence across the
 * view, cut where a lane opens a hole for a deletion, each with the px it
 * spans; `blocks`, each alignment's placement on each lane; `ribbons`, what
 * each gutter draws in paint order, a trapezoid from a span on its upper
 * lane to a span on its lower one, with its color and the alpha it
 * composites at; `alignments`, the records the ribbons draw; `legend`, the
 * key; and `config`, the display's config with its defaults filled. Positions are genomic on each lane, and px across the view's
 * `width`, where a lane's own frame puts them. Heights are px down from the
 * stack's top as the display lays it out over `display.height`: `height` is
 * the whole stack, each lane's `yTop` and `yBottom` bound its gene boxes,
 * and each ribbon's bound its gutter, the height its `thin` flag and fade
 * are measured at.
 */
export async function multiwayTables(
  pluginManager: PluginManager,
  {
    adapterConfig,
    anchor: anchorArgs,
    pins = [],
    hidden = [],
    display,
  }: MultiWayTablesArgs,
) {
  if (!Array.isArray(pins)) {
    throw new TypeError(
      'pins is a list of { lane, refName, at } and { lane, refName, flipped } records',
    )
  }
  const settings = readDisplay(display)
  const axis = comparativeAxis(anchorArgs, adapterConfig, 0)
  const anchor = axis.assemblyName
  const { width } = anchorArgs
  const unitBp = axis.bpPerPx * width
  const stage: AnchorStage = {
    layout: {
      displayedRegions: axis.regions,
      bpPerPx: axis.bpPerPx,
      offsetPx: 0,
      wholePx: false,
    },
    originPx: 0,
    width,
    anchorReversed:
      axis.regions.length > 0 && axis.regions.every(r => !!r.reversed),
    canon: refName => refName,
  }
  const keyOf = (name: string) => name

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
  const rowsVsAnchor = rowsReadAgainstAnchor(capabilities, starAnchor)
  const fetches = laneFetchesFor(features, rowsVsAnchor, starAnchor)
  const placeless = fetched.deletions.map(d => d.assemblyName)
  await refuseUnknownLanes(
    settings.kept,
    [
      anchor,
      ...declared.map(lane => lane.name),
      ...configured,
      ...rowAssembliesOf(groups, [], keyOf, placeless),
    ],
    dataAdapter,
  )
  const rows = laneRowsOf({
    groups,
    placeless,
    anchor,
    preferred: stacksByStructure(capabilities, fetches)
      ? [
          ...settings.rowsSort,
          ...structureOrder(laneProfiles(features, fetched.ops)),
        ]
      : settings.rowsSort,
    selection,
    hidden,
    keyOf,
  })

  const shown = shownGroups(groups, axis)
  const decisions = decideLanesOn(stage, {
    groups: shown,
    assemblyNames: rows,
    previous: new Map(),
    pins: pinsInForceOf(pins, rows, anchor, keyOf),
    openingsOf,
  })
  const rowFrames = new Map<string, RowFrame | undefined>(
    rows.map(name => {
      const decision = decisions.get(name)
      return [
        name,
        decision &&
          laneFrameOn(stage, decision, openingsOf(name, decision.refName)),
      ]
    }),
  )
  const windows = new Map<string, { regions: FetchRegion[] }>([
    [anchor, { regions: anchorRegions }],
  ])
  for (const [name, frame] of rowFrames) {
    if (frame) {
      windows.set(name, {
        regions: [{ assemblyName: name, ...laneFetchRegion(frame) }],
      })
    }
  }

  const laneLinks = new Map<string, LaneLinks>()
  if (fetches.lanePairs) {
    const specs = laneLinksFetchSpecsOf({
      pairs: lanePairsOf(rows),
      windows,
      rowFrames,
      anchor,
      onAnchor: pairsOnAnchor,
      lodTier: 'fine',
      nearViewport: () => true,
    })
    await Promise.all(
      specs.map(async spec => {
        const pair = await fetch(spec.regions, {
          ...(spec.onAnchor ? { queryAssemblyName: spec.assemblyName } : {}),
          targetAssemblyName: spec.lowerAssembly,
        })
        if (pair.features.length) {
          laneLinks.set(spec.lane, { links: pair.features, ops: pair.ops })
        }
      }),
    )
  }
  const anchorless = fetches.laneRows
    ? anchorlessGroupsOf(
        await Promise.all(
          laneGroupsFetchSpecsOf(rows, windows, 'fine').map(
            async spec =>
              [
                spec.lane,
                (await fetch(spec.regions, { mateShape: 'grouped' })).features,
              ] as const,
          ),
        ),
        name => name === anchor,
      )
    : []

  const labels = new Map(declared.map(lane => [lane.name, lane.label]))
  const laneGeom = laneGeometry(
    settings.height,
    1 + rows.length,
    true,
    geneLabelRowPx(settings.showGeneLabels),
    0,
    settings.inlineLaneNames,
  )
  const stack = laneStackOn(stage, {
    assemblyNames: [anchor, ...rows],
    groups: [...shown, ...anchorless],
    anchorSpans: anchorSpansOn(stage, shown),
    rowFrames,
    contigOf: () => undefined,
    refNameAliasOf: () => undefined,
    geometry: laneGeom,
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
    opacity: settings.opacity,
    filter: settings.filter,
    paint: settings.paint,
    drawCurves: settings.curves,
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
    yTop: [] as number[],
    yBottom: [] as number[],
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
      const { thin, fade } = ribbonThinFade(
        corners,
        layer.height,
        layer.curves,
        kind,
        MULTIWAY_FADE_THIN,
      )
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
      ribbons.yTop.push(layer.yTop)
      ribbons.yBottom.push(layer.yTop + layer.height)
      ribbons.color.push(color)
      ribbons.alpha.push(alpha * fade)
      ribbons.thin.push(thin)
      ribbons.bridge.push(toRow !== row + 1)
    }
  }

  return {
    ...laneTables(stack, axis, width),
    ribbons,
    alignments: alignmentRows(
      geometry.targets.map(t => t.feature),
      geometry.targets.map(t => t.groupKey ?? t.linkId ?? ''),
      attributeRanges,
    ),
    ...ribbonKey(
      ribbonColorScales(settings.field, attributeRanges, {
        domain: settings.domain,
        hideUnlabelled: hidesUnlabelled(settings.filter, settings.field),
        slotColor: settings.value,
        names: settings.names,
        title: settings.title,
        descending: settings.descending,
        paint: settings.paint,
        against: rowsVsAnchor ? anchor : undefined,
      }),
    ),
    height: laneGeom.contentHeight,
    tickInterval: tickIntervalFor(unitBp),
    rowsVsAnchor,
    config: settings.config,
  }
}

export type MultiWayTables = Awaited<ReturnType<typeof multiwayTables>>
