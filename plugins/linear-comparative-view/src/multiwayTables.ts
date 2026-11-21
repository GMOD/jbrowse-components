import {
  fullConfSnapshot,
  readConfObject,
  refusingUndeclaredKeys,
} from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { rampKeyOf } from '@jbrowse/core/ui/rampKey'
import { dedupe } from '@jbrowse/core/util'
import calculateStaticBlocks, {
  MINIMUM_BLOCK_WIDTH,
} from '@jbrowse/core/util/calculateStaticBlocks'
import { cssColorToHex } from '@jbrowse/core/util/colorBits'
import { adapterAssemblyNames } from '@jbrowse/core/util/tracks'
import { colorSnapshotOf } from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'
import {
  PRESET_ATTRIBUTES,
  comparativeFrame,
  declaredAttributes,
  declaredLanesOf,
  featureAttributeRanges,
  isAttributeLabels,
  isInstanceInvisible,
  locateCum,
  orderAttributeLabels,
  readChannelValue,
  unpack,
} from '@jbrowse/synteny-core'
import { runInAction } from 'mobx'

import { ribbonThinFade } from './LinearSyntenyDisplay/syntenyRibbonPath.ts'
import { KIND_BASE_TILE } from './LinearSyntenyRPC/syntenyKinds.ts'
import {
  executeMultiWayFeatures,
  liftAlignmentOps,
  multiWayFeaturesOf,
} from './MultiWaySyntenyDisplay/MultiWayGetFeatures.ts'
import { NO_OPS } from './MultiWaySyntenyDisplay/alignmentOps.ts'
import { displayedRegionSpans } from './MultiWaySyntenyDisplay/anchorAxis.ts'
import { configSchemaFactory } from './MultiWaySyntenyDisplay/configSchema.ts'
import { configSlotViews } from './MultiWaySyntenyDisplay/configSlotViews.ts'
import {
  copyLaneName,
  laneGenome,
  laneKeyIn,
  laneOf,
} from './MultiWaySyntenyDisplay/copyLane.ts'
import {
  laneGroupsFetchSpecsOf,
  laneLinksFetchSpecsOf,
  lanePairsOf,
  starAnchorOf,
} from './MultiWaySyntenyDisplay/laneFetch.ts'
import {
  againstAnchorViews,
  laneNameKeyViews,
  laneNameViews,
} from './MultiWaySyntenyDisplay/laneNameViews.ts'
import {
  anchorRowViews,
  fetchLaneSelectionViews,
  filedGroupViews,
  laneDomainViews,
  laneFetchViews,
  laneGroupListViews,
  laneGroupViews,
  laneIndelViews,
  laneOrderHoldActions,
  laneOrderViews,
  laneRowAssemblyViews,
  laneSelectionViews,
  laneSourceViews,
  unalignedLaneViews,
} from './MultiWaySyntenyDisplay/laneRowViews.ts'
import { laneGeometry } from './MultiWaySyntenyDisplay/laneStack.ts'
import {
  decideLanesOn,
  laneFrameOn,
  laneStackOn,
  windowGroupsOn,
} from './MultiWaySyntenyDisplay/laneStage.ts'
import {
  anchorlessGroupsOf,
  frameOpenings,
  frameSegments,
  laneBpAt,
  laneBpOfOpened,
  laneFetchRegion,
  mergeContiguousRegions,
  rowAssembliesOf,
  tickIntervalFor,
} from './MultiWaySyntenyDisplay/layoutMultiWay.ts'
import { ribbonColorScales } from './MultiWaySyntenyDisplay/legend.ts'
import { buildRibbonGeometry } from './MultiWaySyntenyDisplay/multiwayGeometry.ts'
import { MULTIWAY_FADE_THIN } from './MultiWaySyntenyDisplay/multiwayRenderTypes.ts'
import { getMate, getRecordName } from './syntenyMate.ts'

import type { WindowDeletion } from './MultiWaySyntenyDisplay/MultiWayGetFeatures.ts'
import type {
  AlignmentOpsById,
  LaneLinks,
} from './MultiWaySyntenyDisplay/alignmentOps.ts'
import type { ConfigSlotSelf } from './MultiWaySyntenyDisplay/configSlotViews.ts'
import type {
  LaneAssemblies,
  LaneRowsSetting,
} from './MultiWaySyntenyDisplay/copyLane.ts'
import type { LanePin } from './MultiWaySyntenyDisplay/lanePins.ts'
import type {
  HeldLaneOrder,
  LaneRowFrame,
} from './MultiWaySyntenyDisplay/laneRowViews.ts'
import type { Lane, LaneStack } from './MultiWaySyntenyDisplay/laneStack.ts'
import type { AnchorStage } from './MultiWaySyntenyDisplay/laneStage.ts'
import type {
  FetchRegion,
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
   * `ribbons.mark.interpolate`, `ribbons.filter`, `rows` (`field`, a lane
   * per genome, with `'refName'` per copy of the window, or `'auto'`, per
   * copy where the adapter names at most one genome besides the anchor, `sort`, the lanes
   * that stack first, `kept`, the lanes drawn, and `labels`, a label for a
   * lane by name), `labels.name.show`,
   * `labels.lanes.placement` and `height`, the stack's px.
   */
  display?: {
    ribbons?: {
      encoding?: { color?: ColorArg; opacity?: number | SyntenyOpacitySnapshot }
      mark?: { interpolate?: RibbonInterpolation }
      filter?: FieldPredicate[]
    }
    rows?: {
      field?: LaneRowsSetting
      sort?: string[]
      kept?: string[]
      labels?: Record<string, string>
    }
    labels?: {
      name?: { show?: boolean; field?: string }
      lanes?: { placement?: 'above' | 'overlay' }
    }
    height?: number
  }
  /**
   * A lane's assembly, by the lane's assembly name, as the session holds it
   * for the display: its contigs, each name its canonical spelling, the
   * canonical spelling of any name, and the name its label shows. A lane's
   * line stops at its contig's ends; a lane with none runs to the view's
   * edge.
   */
  laneAssemblyOf?: (assemblyName: string) => LaneAssembly | undefined
}

export interface LaneAssembly {
  regions: { refName: string; start: number; end: number }[]
  canonical: (refName: string) => string
  displayName?: string
}

const SESSION = 'tables'

// `|| 0` drops the sign of a negative zero, which JSON cannot carry
const wholeBp = (bp: number) => Math.round(bp) || 0

const KIND_NAMES: Record<number, string> = {
  [KIND_BASE_TILE]: 'mismatch',
}

/**
 * Refuses a `rows.kept` lane the file holds no sequence for, naming the lanes
 * it has here, as the adapter refuses an anchor assembly it lacks. A lane
 * compares by its key, and a copy lane needs its genome to hold its contig.
 */
async function refuseUnknownLanes(
  kept: readonly string[],
  known: readonly string[],
  dataAdapter: AnyDataAdapter,
  keyOf: (lane: string) => string,
) {
  const has = new Set(known.map(keyOf))
  const unknown: string[] = []
  for (const name of kept.filter(name => !has.has(keyOf(name)))) {
    const { assemblyName, refName } = laneOf(name)
    const contigs =
      dataAdapter instanceof BaseFeatureDataAdapter
        ? await dataAdapter.getRefNames({ assemblyName })
        : [refName ?? name]
    const contigKeys = new Set(
      contigs.map(contig => keyOf(copyLaneName(assemblyName, contig))),
    )
    if (
      refName === undefined
        ? contigs.length === 0
        : !contigKeys.has(keyOf(name))
    ) {
      unknown.push(name)
    }
  }
  if (unknown.length > 0) {
    throw new Error(
      `rows.kept names ${unknown.join(', ')}, which this file has no lane for; its lanes here are ${known.join(', ')}`,
    )
  }
}

const displayConfigSchema = configSchemaFactory()

/**
 * The display's settings its config views have no getter for, as its own
 * config reads them, defaults included
 */
function readDisplay(conf: ConfigSlotSelf['configuration']) {
  const setting = colorSnapshotOf(conf.ribbons.encoding.color)
  return {
    domain: setting.scale.domain,
    range: setting.scale.range,
    names: setting.scale.names,
    title: setting.legend.title,
    descending: setting.legend.descending,
    height: readConfObject(conf, 'height'),
    config: fullConfSnapshot(conf),
  }
}

const sameRefName = (refName: string) => refName

/**
 * What the static host reads off the call: the anchor's view, the track's
 * genomes, what the adapter can do and its header, and each lane's assembly
 */
interface MultiWayTablesFrame {
  lgv: LaneRowFrame
  anchorAssemblyName: string
  trackAssemblyNames: readonly string[]
  adapterCapabilities: readonly string[]
  header: unknown
  laneAssemblyOf: (assemblyName: string) => LaneAssembly | undefined
}

interface TablesFetch {
  features: Feature[]
  ops: AlignmentOpsById
  lanes?: string[]
  deletions: readonly WindowDeletion[]
}

const NO_FRAME: MultiWayTablesFrame = {
  lgv: { displayedRegions: [], settledDynamicBlocks: [] },
  anchorAssemblyName: '',
  trackAssemblyNames: [],
  adapterCapabilities: [],
  header: undefined,
  laneAssemblyOf: () => undefined,
}

const NO_TABLES_FETCH: TablesFetch = {
  features: [],
  ops: NO_OPS,
  deletions: [],
}

/**
 * The multi-way display reduced to its config, the reader's hidden lanes and
 * pins, the frame and the anchor fetch, under the lane row and lane name
 * views the display installs, in the display's order: which lanes draw, how
 * copy lanes file, their order, the anchor's row, the pins in force and each
 * lane's label. No session and no view: a lane's spellings and display name
 * are its assembly's as the call gives it, and the anchor's refNames are the
 * call's.
 */
const MultiWayTablesHost = types
  .model('MultiWayTablesHost', {
    configuration: displayConfigSchema,
    hiddenLaneNames: types.frozen<readonly string[] | undefined>(),
    lanePins: types.frozen<readonly LanePin[] | undefined>(),
  })
  .volatile(
    (): {
      frame: MultiWayTablesFrame
      fetched: TablesFetch | undefined
      heldLaneOrder: HeldLaneOrder | undefined
    } => ({ frame: NO_FRAME, fetched: undefined, heldLaneOrder: undefined }),
  )
  .actions(self => ({
    setFrame(frame: MultiWayTablesFrame) {
      self.frame = frame
    },
    setFeatures(fetched: TablesFetch) {
      self.fetched = fetched
    },
  }))
  .views(self => ({
    get lgv() {
      return self.frame.lgv
    },
    get anchorAssemblyName() {
      return self.frame.anchorAssemblyName
    },
    get anchorCanon() {
      return sameRefName
    },
    get laneAssemblies(): LaneAssemblies {
      const { laneAssemblyOf } = self.frame
      return {
        getCanonicalAssemblyName: name => name,
        has: name => laneAssemblyOf(name) !== undefined,
        get: name => {
          const assembly = laneAssemblyOf(name)
          return assembly && { getCanonicalRefName2: assembly.canonical }
        },
        getDisplayName: name => laneAssemblyOf(name)?.displayName || name,
      }
    },
    get trackAssemblyNames() {
      return self.frame.trackAssemblyNames
    },
    get adapterCapabilities() {
      return self.frame.adapterCapabilities
    },
    get adapterDeclaresLanes() {
      return self.frame.adapterCapabilities.includes('headerLanes')
    },
    get adapterHeader() {
      return self.frame.header
    },
    get declaredLanes() {
      return declaredLanesOf(self.frame.header)
    },
    get starAnchor() {
      return starAnchorOf(self.frame.header)
    },
    get currentFetch() {
      return self.fetched ?? NO_TABLES_FETCH
    },
    get anchorRecordsLoaded() {
      return self.fetched !== undefined
    },
  }))
  .views(self => ({
    get features() {
      return self.currentFetch.features
    },
    get featureOps() {
      return self.currentFetch.ops
    },
    get windowDeletions() {
      return self.currentFetch.deletions
    },
    laneKey(lane: string) {
      return laneKeyIn(self.laneAssemblies, lane)
    },
    laneSpellings(lane: string) {
      return [laneGenome(lane)]
    },
  }))
  .views(configSlotViews)
  .views(laneGroupViews)
  .views(filedGroupViews)
  .views(laneGroupListViews)
  .views(laneIndelViews)
  .views(laneSourceViews)
  .views(laneFetchViews)
  .views(laneDomainViews)
  .views(laneSelectionViews)
  .views(fetchLaneSelectionViews)
  .views(laneNameKeyViews)
  .views(laneNameViews)
  .views(againstAnchorViews)
  .views(unalignedLaneViews)
  .views(laneRowAssemblyViews)
  .views(anchorRowViews)
  .views(laneOrderViews)
  .actions(laneOrderHoldActions)

/**
 * The key the display shows for its ribbons: chips, and each ramp's bar. The
 * display's legend draws its chips opaque, so `legendAlpha` is 1.
 */
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
  return { legend, legendTitle, legendAlpha: 1, ramps }
}

/** Which of the anchor's regions a lane's px span lies on; 0 on a mate lane. */
type RegionOn = (lane: Lane, x1: number, x2: number) => number

/**
 * Each lane, and each stretch of its sequence across the view with the px it
 * spans and the region it lies on: the anchor's regions end to end, or a
 * mate lane's frame cut at the holes it opens.
 */
function laneTables(
  { lanes, glyphHeight }: LaneStack,
  axis: ComparativeAxis,
  width: number,
  regionOn: RegionOn,
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
    region: [] as number[],
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
    segments.region.push(regionOn(lanes[i]!, x1, x2))
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
      displayedRegionSpans(
        {
          displayedRegions: axis.regions,
          bpPerPx: axis.bpPerPx,
          offsetPx: 0,
          wholePx: false,
        },
        0,
      ).forEach((span, k) => {
        const r = axis.regions[k]!
        segment(i, r.refName, r.start, r.end, span)
      })
    } else if (frame) {
      const openings = frameOpenings(frame)
      const lo = Math.max(
        l.contig?.start ?? 0,
        Math.ceil(laneBpOfOpened(openings, frame.min)),
      )
      const hi = Math.min(
        l.contig?.end ?? Number.POSITIVE_INFINITY,
        Math.floor(laneBpOfOpened(openings, frame.max)),
      )
      for (const s of frameSegments(frame, lo, hi, width)) {
        segment(i, frame.refName, s.start, s.end, s.px)
      }
    }
  })
  return { lanes: lane, segments, ...blockRows(lanes, regionOn) }
}

/** Each run of each group on each lane: the boxes the ribbons join. */
function blockRows(lanes: Lane[], regionOn: RegionOn) {
  const blocks = {
    lane: [] as number[],
    region: [] as number[],
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
        blocks.region.push(regionOn(lane, x1, x2))
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
    name: features.map(f => textOf(getRecordName(f))),
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
 * view, cut where a lane opens a hole for a deletion and stopped at the
 * ends of its contig where the lane's assembly is given, each with the px it
 * spans; `blocks`, each alignment's placement on each lane; `ribbons`, what
 * each gutter draws in paint order, a trapezoid from a span on its upper
 * lane to a span on its lower one, with its color and the alpha it
 * composites at; `alignments`, the records the ribbons draw; `legend`, the
 * key, and `legendAlpha`, the alpha the display draws its chips at; and
 * `config`, the display's config with its defaults filled. Positions are
 * genomic on each lane, and px across the view's `width`, where a lane's
 * own frame puts them. A segment's and a block's `region`, and a ribbon
 * foot's `upperRegion` and `lowerRegion`, is the 0-based index of the
 * anchor's region it is drawn on, read from its px; 0 on a mate lane, whose
 * frame is one stretch of one contig. Heights are px down from the
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
    laneAssemblyOf = () => undefined,
  }: MultiWayTablesArgs,
) {
  if (!Array.isArray(pins)) {
    throw new TypeError(
      'pins is a list of { lane, refName, at } and { lane, refName, flipped } records',
    )
  }
  const host = refusingUndeclaredKeys(() =>
    MultiWayTablesHost.create({
      configuration: {
        type: 'MultiWaySyntenyDisplay',
        displayId: SESSION,
        ...display,
      },
      hiddenLaneNames: hidden,
      lanePins: pins,
    }),
  )
  const settings = readDisplay(host.configuration)
  const {
    window: axis,
    frame: anchorFrame,
    offsetPx,
  } = comparativeFrame(anchorArgs, adapterConfig, 0)
  const anchor = axis.assemblyName
  const { width } = anchorArgs
  const { bpPerPx } = axis
  const unitBp = bpPerPx * width
  const stage: AnchorStage = {
    layout: {
      displayedRegions: anchorFrame.regions,
      bpPerPx,
      offsetPx,
      wholePx: false,
    },
    originPx: offsetPx,
    width,
    anchorReversed:
      anchorFrame.regions.length > 0 &&
      anchorFrame.regions.every(r => !!r.reversed),
    canon: sameRefName,
  }

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
    declaresLanes && dataAdapter instanceof BaseFeatureDataAdapter
      ? await dataAdapter.getHeader()
      : undefined
  host.setFrame({
    lgv: {
      displayedRegions: anchorFrame.regions,
      settledDynamicBlocks: axis.regions,
    },
    anchorAssemblyName: anchor,
    trackAssemblyNames: adapterAssemblyNames(adapterConfig),
    adapterCapabilities: capabilities,
    header,
    laneAssemblyOf,
  })
  const haplotypes = host.fetchLaneSelection

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

  const anchorRegions = mergeContiguousRegions(
    calculateStaticBlocks({
      offsetPx,
      width,
      displayedRegions: anchorFrame.regions,
      bpPerPx,
      minimumBlockWidth: MINIMUM_BLOCK_WIDTH,
    }).contentBlocks,
  )
  const fetched = await fetch(
    anchorRegions,
    { mateShape: 'grouped' },
    haplotypes,
  )
  const features = dedupe(fetched.features, f => f.id())
  host.setFeatures({
    features,
    ops: fetched.ops,
    lanes: haplotypes,
    deletions: fetched.deletions,
  })
  host.holdLaneOrder(anchorRegions)
  const {
    field,
    groups,
    openingsOf,
    rowsVsAnchor,
    fetches,
    kept,
    configured,
    rows,
    anchorRow,
    laneOrder,
    pinsInForce,
    declared,
    against,
    ribbon,
  } = runInAction(() => ({
    field: host.laneField,
    groups: host.groups,
    openingsOf: host.laneOpenings,
    rowsVsAnchor: host.rowsVsAnchor,
    fetches: host.laneFetchKinds,
    kept: host.laneChoice,
    configured: host.configuredLanes,
    rows: host.rowAssemblies,
    anchorRow: host.anchorRow,
    laneOrder: host.laneOrder,
    pinsInForce: host.pinsInForce,
    declared: host.declaredLanes,
    against: host.againstAnchor,
    ribbon: {
      value: host.ribbonColor,
      field: host.ribbonColorField,
      paint: host.ribbonPaint,
      opacity: host.ribbonOpacity,
      filter: host.ribbonFilter,
      hideUnlabelled: host.hideUnlabelled,
      curves: host.interpolate === 'bump',
      geneLabelPx: host.geneLabelPx,
      inlineLaneNames: host.inlineLaneNames,
    },
  }))
  const keyOf = host.laneKey
  await refuseUnknownLanes(
    kept,
    [
      anchor,
      ...declared.map(lane => lane.name),
      ...configured,
      ...rowAssembliesOf(
        groups,
        [],
        keyOf,
        fetched.deletions.map(d => d.assemblyName),
      ),
    ],
    dataAdapter,
    keyOf,
  )

  const { shown, fit } = windowGroupsOn(
    stage,
    groups,
    axis.regions,
    fetched.ops,
  )
  const decisions = decideLanesOn(stage, {
    groups: fit,
    assemblyNames: rows,
    anchorRow,
    vsAnchor: field === 'refName',
    previous: new Map(),
    pins: pinsInForce,
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
        regions: [
          { assemblyName: laneGenome(name), ...laneFetchRegion(frame) },
        ],
      })
    }
  }

  const laneLinks = new Map<string, LaneLinks>()
  if (fetches.lanePairs) {
    const specs = laneLinksFetchSpecsOf({
      pairs: lanePairsOf(laneOrder, anchor),
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

  const laneGeom = laneGeometry(
    settings.height,
    1 + rows.length,
    true,
    ribbon.geneLabelPx,
    0,
    ribbon.inlineLaneNames,
  )
  const stack = runInAction(() =>
    laneStackOn(stage, {
      assemblyNames: laneOrder,
      anchorRow,
      groups: [...shown, ...anchorless],
      rowFrames,
      contigOf: (name, refName) =>
        laneAssemblyOf(laneGenome(name))?.regions.find(
          r => r.refName === refName,
        ),
      refNameAliasOf: name => laneAssemblyOf(laneGenome(name))?.canonical,
      geometry: laneGeom,
      labelOf: name => host.laneLabel(name),
    }),
  )

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
    ribbonColor: ribbon.value,
    ribbonColorField: ribbon.field,
    attributeRanges,
    opacity: ribbon.opacity,
    filter: ribbon.filter,
    paint: ribbon.paint,
    drawCurves: ribbon.curves,
    rowsVsAnchor,
  })

  const onAnchor = (px: number, hint: number) =>
    locateCum(
      anchorFrame,
      (px + offsetPx) * bpPerPx,
      (hint + offsetPx) * bpPerPx,
    )
  const regionOn: RegionOn = (lane, x1, x2) =>
    lane.isAnchor ? onAnchor(x1, x2).region : 0
  const onLane = (lane: Lane, px: number, hint: number) => {
    const at = lane.isAnchor ? onAnchor(px, hint) : undefined
    return at
      ? {
          region: at.region,
          refName: anchorFrame.regions[at.region]!.refName,
          coord: at.coord,
        }
      : {
          region: 0,
          refName: lane.frame!.refName,
          coord: laneBpAt(lane.frame!, px, width),
        }
  }
  const footOn = (lane: Lane, a: number, b: number) => {
    const from = onLane(lane, a, b)
    const to = onLane(lane, b, a)
    return {
      region: from.region,
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
    upperRegion: [] as number[],
    upperChrom: [] as string[],
    upperStart: [] as number[],
    upperEnd: [] as number[],
    lowerRegion: [] as number[],
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
    const [upperRow, toRow] = layer.rows
    const gutter = rowsVsAnchor ? toRow - 1 : upperRow
    const upper = stack.lanes[upperRow]!
    const lower = stack.lanes[toRow]!
    const { bp1, bp2, bp3, bp4, kinds, colors, instanceFeatureIdx } = cell.data
    for (let i = 0; i < cell.data.instanceCount; i++) {
      const packed = colors[i] ?? 0
      if (isInstanceInvisible(packed, 1)) {
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
      ribbons.gutter.push(gutter)
      ribbons.upperLane.push(upperRow)
      ribbons.lowerLane.push(toRow)
      ribbons.upperRegion.push(top.region)
      ribbons.upperChrom.push(top.refName)
      ribbons.upperStart.push(top.start)
      ribbons.upperEnd.push(top.end)
      ribbons.lowerRegion.push(bottom.region)
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
      ribbons.bridge.push(toRow !== gutter + 1)
    }
  }

  return {
    ...laneTables(stack, axis, width, regionOn),
    ribbons,
    alignments: alignmentRows(
      geometry.targets.map(t => t.feature),
      geometry.targets.map(t => t.groupKey ?? t.linkId ?? ''),
      attributeRanges,
    ),
    ...ribbonKey(
      ribbonColorScales(ribbon.field, attributeRanges, {
        domain: settings.domain,
        hideUnlabelled: ribbon.hideUnlabelled,
        slotColor: ribbon.value,
        names: settings.names,
        title: settings.title,
        descending: settings.descending,
        paint: ribbon.paint,
        against,
      }),
    ),
    height: laneGeom.contentHeight,
    tickInterval: tickIntervalFor(unitBp),
    rowsVsAnchor,
    config: settings.config,
  }
}

export type MultiWayTables = Awaited<ReturnType<typeof multiwayTables>>
