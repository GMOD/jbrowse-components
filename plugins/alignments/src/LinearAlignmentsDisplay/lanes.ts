import { groupClipSource, groupMaxY } from './groupLayout.ts'

import type {
  PileupDataResult,
  RowCapSource,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types.ts'
import type { CrossRegionArc } from '../features/arcs/arcTypes.ts'
import type { ArcsUploadData } from '../features/arcs/types.ts'
import type { GroupId } from './groupedDataMaps.ts'
import type { Section, SectionGroupInput } from './sectionLayout.ts'

/**
 * One stacked lane: its identity, every per-lane collection the section pipeline
 * and the overlays read, and the per-lane state the label chip acts on.
 *
 * A PROJECTION over the tiered computeds, never a store — each field is read from
 * the computed that owns it, so the fetch/layout/recolor split upstream is
 * untouched and a lane is rebuilt rather than mutated. Ungrouped is the one-lane
 * case (key `''`), which is what makes "grouped" a length question at every
 * consumer instead of a branch.
 *
 * The collections are non-optional, and that is the point: a lane's key comes
 * from `groupOrder` and every collection is keyed by the same filtered set, so a
 * miss was unreachable — but nothing said so, and each consumer carried its own
 * `?? new Map()` for it.
 */
export interface AlignmentLane {
  groupKey: string
  label: string
  rawPileupMap: ReadonlyMap<number, WorkerPileupData>
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>
  arcsRpcDataMap: ReadonlyMap<number, ArcsUploadData>
  crossRegionArcs: readonly CrossRegionArc[]
  hasArcs: boolean
  sashimiDownKeys: ReadonlySet<string>
  hasSashimiDownArcs: boolean
  maxY: number
  collapsed: boolean
  // The height (px) a drag or "show all" pinned this lane's pileup band at, or
  // `undefined` while it rides the shared fit budget. The px, not a flag: the
  // band pads out to it when the rows fall short, and the drag accumulates from
  // it.
  heightOverridePx: number | undefined
  clippedBy: RowCapSource | undefined
  // `clippedBy === 'ceiling'` with the display-wide suppressions already
  // applied, i.e. whether THIS lane draws `PileupTruncationRule`. Resolved on
  // the lane for the same reason `maxY` folds in `showPileup`: the overlay walks
  // sections and would otherwise ask the model per section, by key.
  ceilingClipped: boolean
}

// Whether the label chip's expand can do anything for this lane: two of the
// caps can be raised out of, and an absent lane has nothing to raise. One
// function so every caller answers it the same way.
export function laneExpandable(lane: AlignmentLane | undefined) {
  return lane?.clippedBy === 'budget' || lane?.clippedBy === 'collapse'
}

const EMPTY_RAW: ReadonlyMap<number, WorkerPileupData> = new Map()
const EMPTY_LAID_OUT: ReadonlyMap<number, PileupDataResult> = new Map()
const EMPTY_ARCS: ReadonlyMap<number, ArcsUploadData> = new Map()
const EMPTY_ARC_LIST: readonly CrossRegionArc[] = []
const EMPTY_KEYS: ReadonlySet<string> = new Set()

// The lane `sections` is handed before any fetch lands, and on a grouped fetch
// over a region with no reads — where the partition yields zero lanes and the
// pipeline below still has to produce one section (see `drawnLanes`).
const SYNTHETIC_LANE: AlignmentLane = {
  groupKey: '',
  label: '',
  rawPileupMap: EMPTY_RAW,
  laidOutPileupMap: EMPTY_LAID_OUT,
  arcsRpcDataMap: EMPTY_ARCS,
  crossRegionArcs: EMPTY_ARC_LIST,
  hasArcs: false,
  sashimiDownKeys: EMPTY_KEYS,
  hasSashimiDownArcs: false,
  maxY: 0,
  collapsed: false,
  heightOverridePx: undefined,
  clippedBy: undefined,
  ceilingClipped: false,
}

export interface BuildLanesInput {
  // Stacking order, hidden lanes already dropped (`groupOrder`). Every
  // collection below is keyed by the same filtered set, which is why a lookup
  // that misses can only mean an empty lane and never a dropped one.
  order: readonly GroupId[]
  rawByGroup: ReadonlyMap<string, ReadonlyMap<number, WorkerPileupData>>
  laidOutByGroup: ReadonlyMap<string, ReadonlyMap<number, PileupDataResult>>
  // The two arc feeds, which are two lists for the reason `CrossRegionArc`
  // states: no per-region buffer can join two displayed regions.
  arcsByGroup: ReadonlyMap<string, ReadonlyMap<number, ArcsUploadData>>
  crossRegionArcsByGroup: ReadonlyMap<string, readonly CrossRegionArc[]>
  // The lanes with arc-band INK in EITHER feed (`inkGroupKeys`), not the keys of
  // `arcsByGroup`: a lane whose every arc crosses a seam draws entirely in the
  // overlay and would otherwise reserve no band to draw into.
  arcInkKeys: ReadonlySet<string>
  sashimiDownKeysByGroup: ReadonlyMap<string, ReadonlySet<string>>
  collapsedKeys: ReadonlySet<string>
  // The overrides IN EFFECT (`groupHeightOverrides`), which fit mode empties.
  heightOverridesPx: ReadonlyMap<string, number>
  showPileup: boolean
  fitHeightToDisplay: boolean
}

/**
 * The stacked lanes, in stacking order: one `AlignmentLane` per drawn group.
 *
 * The single place a lane's key is turned into its data. Every per-lane
 * collection used to be looked up separately by each consumer — the raw map, the
 * laid-out map, the two arc feeds, the sashimi sides, the collapse/override
 * volatiles — so a lane's identity was a bare string indexed into as many keyed
 * collections as there were questions, each with its own `?? empty` for a key
 * that structurally cannot be missing.
 */
export function buildLanes(input: BuildLanesInput): AlignmentLane[] {
  const {
    order,
    rawByGroup,
    laidOutByGroup,
    arcsByGroup,
    crossRegionArcsByGroup,
    arcInkKeys,
    sashimiDownKeysByGroup,
    collapsedKeys,
    heightOverridesPx,
    showPileup,
    fitHeightToDisplay,
  } = input
  // The two display-wide suppressions on the ceiling notice, hoisted: they are
  // the same for every lane, so `ceilingClipped` below is the per-lane half
  // alone. Fit mode already clamps reads to a 1px floor and flags the scroll
  // instead; with the pileup hidden nothing is drawn for the ceiling to clip.
  const drawsCeilingNotice = showPileup && !fitHeightToDisplay
  return order.map(({ key, label }) => {
    const laidOutPileupMap = laidOutByGroup.get(key) ?? EMPTY_LAID_OUT
    const sashimiDownKeys = sashimiDownKeysByGroup.get(key) ?? EMPTY_KEYS
    const collapsed = collapsedKeys.has(key)
    const clippedBy = groupClipSource(laidOutPileupMap)
    return {
      groupKey: key,
      label,
      rawPileupMap: rawByGroup.get(key) ?? EMPTY_RAW,
      laidOutPileupMap,
      arcsRpcDataMap: arcsByGroup.get(key) ?? EMPTY_ARCS,
      crossRegionArcs: crossRegionArcsByGroup.get(key) ?? EMPTY_ARC_LIST,
      hasArcs: arcInkKeys.has(key),
      sashimiDownKeys,
      hasSashimiDownArcs: sashimiDownKeys.size > 0,
      // showPileup off collapses every pileup band to zero height (coverage +
      // arcs only), the same height-0 path a collapsed lane takes.
      maxY: !showPileup || collapsed ? 0 : groupMaxY(laidOutPileupMap),
      collapsed,
      heightOverridePx: heightOverridesPx.get(key),
      clippedBy,
      ceilingClipped: drawsCeilingNotice && clippedBy === 'ceiling',
    }
  })
}

/**
 * The lanes actually laid out, or the one SYNTHETIC lane. `computeStackedSections`
 * has to produce a section before any fetch lands — and a grouped fetch over an
 * empty region partitions to zero lanes — so the section pipeline is never
 * handed an empty list. Every collection on the synthetic lane is empty by
 * construction, `maxY` included.
 */
export function drawnLanesOf(lanes: AlignmentLane[]) {
  return lanes.length > 0 ? lanes : [SYNTHETIC_LANE]
}

// The lane fields `computeStackedSections` reads. Paired with `zipLaneSections`
// below, which puts the answer back on the lane it came from: both live here so
// the by-index correspondence between the two lists is one file's statement.
export function toSectionGroupInputs(
  lanes: readonly AlignmentLane[],
): SectionGroupInput[] {
  return lanes.map(lane => ({
    key: lane.groupKey,
    label: lane.label,
    maxY: lane.maxY,
    hasArcs: lane.hasArcs,
    hasSashimiDownArcs: lane.hasSashimiDownArcs,
    minPileupHeight: lane.heightOverridePx,
  }))
}

export interface LaneSection extends AlignmentLane {
  topOffset: number
  coverageTop: number
  coverageHeight: number
  // Bottom of this section's arc band (== top of its sashimi band), so the
  // arc-resize handle can anchor per group like coverage/pileup — and whether
  // this lane reserved that band at all, since a lane with no arcs has none to
  // resize.
  sashimiBandTop: number
  hasArcsBand: boolean
  // The arcs' DRAW band, which is not the same question as `hasArcsBand`
  // (whether a strip was reserved): up-mode arcs reserve nothing and draw over
  // the coverage histogram. This is the rect `buildSectionRenders` hands the
  // renderers, in content space, so the hover hit test measures against the band
  // the arcs were actually plotted into.
  arcBandTop: number
  arcBandHeight: number
  arcDown: boolean
  hasSashimiBand: boolean
  pileupHeight: number
  // The strip down to the next section, which is what the label chip heads —
  // see `Section.height`.
  height: number
}

/**
 * Every lane paired with its band geometry, in stacking order: the list the
 * overlays, the hit-test pipeline and both renderers all walk.
 *
 * The pairing is by INDEX and that is structural, not a coincidence —
 * `computeStackedSections` emits one section per lane in order, and both lists
 * come from `drawnLanesOf`. Deriving the two from different sources is what used
 * to let them disagree whenever a section was synthesized.
 *
 * Carrying the lane's own collections here is what retires the by-key lookup
 * every downstream pass used to do (`?? new Map()` for a key that structurally
 * cannot be missing, spelled once per consumer).
 */
export function zipLaneSections(
  lanes: readonly AlignmentLane[],
  sections: readonly Section[],
): LaneSection[] {
  return sections.map((sec, i) => ({
    ...lanes[i]!,
    topOffset: sec.pileupTop,
    coverageTop: sec.coverageTop,
    coverageHeight: sec.coverageHeight,
    sashimiBandTop: sec.sashimiBandTop,
    hasArcsBand: sec.hasArcsBand,
    arcBandTop: sec.arcBandTop,
    arcBandHeight: sec.arcBandHeight,
    arcDown: sec.arcDown,
    hasSashimiBand: sec.hasSashimiBand,
    pileupHeight: sec.pileupHeight,
    height: sec.height,
  }))
}
