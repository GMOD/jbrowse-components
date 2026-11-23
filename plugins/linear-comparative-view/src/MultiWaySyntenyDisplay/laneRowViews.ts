import { getConf, setConf } from '@jbrowse/core/configuration'
import { persistTrackConfigNow } from '@jbrowse/core/util'
import { isSameAssemblyName } from '@jbrowse/core/util/tracks'
import { sameAsLast } from '@jbrowse/display-kit/stableIdentityComputed'

import { isNamedRecord } from '../syntenyMate.ts'
import {
  anchorInBlocks,
  copyLaneFiling,
  copyLaneName,
  groupsOfField,
  laneFieldOf,
  laneKeyIn,
  touchesWindow,
} from './copyLane.ts'
import { pinsInForceOf } from './lanePins.ts'
import {
  anchorRowOf,
  answeredLaneTest,
  laneOrderOf,
  laneRowsOf,
  lanesInForce,
  pickedLanes,
  unalignedChosenLanesOf,
  withLaneHidden,
  withLaneShown,
} from './laneSelection.ts'
import { groupFeatures, laneIndelsOf } from './layoutMultiWay.ts'
import {
  headerDeclaresHaplotypeLanes,
  headerReadsAgainstAnchor,
  laneFetchesFor,
  rowsReadAgainstAnchor,
  stacksByStructure,
} from './sourceShape.ts'
import { laneProfiles, structureOrder } from './structureOrder.ts'

import type { WindowDeletion } from './MultiWayGetFeatures.ts'
import type { AlignmentOpsById } from './alignmentOps.ts'
import type { ConfigSlotSelf } from './configSlotViews.ts'
import type { FiledPiece, LaneAssemblies, LaneRowsField } from './copyLane.ts'
import type { Placeless } from './laneHeader.ts'
import type { LanePin } from './lanePins.ts'
import type { LaneChoice } from './laneSelection.ts'
import type { FetchRegion } from './layoutMultiWay.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * The structure order haplotype lanes read off a graph stack by while no
 * order is pinned, worked out once per window and lane selection so a pan
 * never reshuffles it
 */
export interface HeldLaneOrder {
  anchor: string
  window: FetchRegion[]
  drawn: string[]
  lanes: string[]
}

/**
 * What the lane rows read off the view: the regions it displays and the
 * blocks its settled viewport shows
 */
export interface LaneRowFrame {
  displayedRegions: readonly { assemblyName: string; refName: string }[]
  settledDynamicBlocks: readonly {
    refName: string
    start: number
    end: number
  }[]
}

/**
 * What the lane rows read off their host: the display's config, the view,
 * the anchor fetch, the adapter's capabilities, how the session spells a
 * lane, and the reader's hidden lanes, pins and held structure order
 */
export interface LaneRowInputs extends ConfigSlotSelf {
  lgv: LaneRowFrame
  anchorAssemblyName: string
  anchorCanon: (refName: string) => string
  laneAssemblies: LaneAssemblies
  trackAssemblyNames: readonly string[]
  features: Feature[]
  featureOps: AlignmentOpsById
  windowDeletions: readonly WindowDeletion[]
  anchorRecordsLoaded: boolean
  currentFetch: { lanes?: string[] }
  laneChoice: readonly string[]
  adapterCapabilities: readonly string[]
  adapterDeclaresLanes: boolean
  starAnchor: string | undefined
  laneKey: (lane: string) => string
  laneSpellings: (lane: string) => string[]
  hiddenLaneNames: readonly string[] | undefined
  lanePins: readonly LanePin[] | undefined
  heldLaneOrder: HeldLaneOrder | undefined
}

export type LaneGroupHost = ConfigSlotSelf &
  Pick<
    LaneRowInputs,
    | 'lgv'
    | 'anchorAssemblyName'
    | 'anchorCanon'
    | 'laneAssemblies'
    | 'trackAssemblyNames'
    | 'features'
  > & { adapterHeader: unknown }

export function laneGroupViews(self: LaneGroupHost) {
  return {
    /**
     * #getter
     * `rows.field` resolved: a lane per genome, or per copy of the window a
     * genome holds
     */
    get laneField(): LaneRowsField {
      const assemblies = self.laneAssemblies
      const anchor = self.anchorAssemblyName
      return laneFieldOf(
        getConf(self, ['rows', 'field']),
        self.trackAssemblyNames,
        name => isSameAssemblyName(name, anchor, assemblies),
        headerDeclaresHaplotypeLanes(self.adapterHeader),
      )
    },
    /** #getter */
    get groupedFeatures() {
      return groupFeatures(self.features)
    },
    /**
     * #method
     * how copy lanes file: `rows.kept` lifts the floor, and the anchor's
     * own contigs file nowhere, and only the groups the settled viewport
     * shows weigh against the floor
     */
    copyFiling() {
      const assemblies = self.laneAssemblies
      return copyLaneFiling(
        getConf(self, ['rows', 'kept']),
        self.lgv.displayedRegions.map(r =>
          copyLaneName(r.assemblyName, r.refName),
        ),
        lane => laneKeyIn(assemblies, lane),
        anchorInBlocks(self.lgv.settledDynamicBlocks, self.anchorCanon),
      )
    },
  }
}

export function filedGroupViews(
  self: ReturnType<typeof laneGroupViews> & Pick<LaneRowInputs, 'lgv'>,
) {
  let lastPieces: readonly FiledPiece[] = []
  return {
    /**
     * #getter
     * the groups as `rows.field` files them, in one pass with the copy
     * lanes the floor drops; a piece keeps the name of the piece it
     * overlaps in the last filing
     */
    get filedGroups() {
      const filed = groupsOfField(
        self.laneField,
        self.groupedFeatures,
        () => self.copyFiling(),
        self.lgv.settledDynamicBlocks.reduce(
          (bp, block) => bp + block.end - block.start,
          0,
        ),
        lastPieces,
      )
      lastPieces = filed.pieces
      return filed
    },
  }
}

export function laneGroupListViews(self: ReturnType<typeof filedGroupViews>) {
  return {
    /**
     * #getter
     * each mate filed under its genome's lane, or its copy lane
     */
    get groups() {
      return self.filedGroups.groups
    },
    /**
     * #getter
     * the copy lanes the window places too little of to draw, which the
     * lane dialog offers unticked
     */
    get copyLanesUnderFloor(): readonly string[] {
      return self.filedGroups.underFloor
    },
    /**
     * #getter
     * each lane's holes and stated changes against the anchor, read off
     * every fetched group rather than the viewport's, so one appears once
     * both its pieces arrive and not as the second scrolls in
     */
    get laneIndels() {
      return laneIndelsOf(self.filedGroups.groups)
    },
  }
}

export function laneIndelViews(self: ReturnType<typeof laneGroupListViews>) {
  return {
    /**
     * #getter
     * each lane's holes on the strand it is drawn on, where `laneIndels`
     * finds the anchor's side of a gap longer than the lane's
     */
    get laneOpenings() {
      return self.laneIndels.openings
    },
    /**
     * #getter
     * each lane's deletions, insertions, stretches replaced and inversions
     * as its records state them, read first on the strand it is drawn on,
     * for the header
     */
    get laneChanges() {
      return self.laneIndels.changes
    },
    /**
     * #getter
     * each lane's array records, stretches whose copies its records pair
     * with none of the anchor's, for the header
     */
    get laneRepeats() {
      return self.laneIndels.repeats
    },
  }
}

type LaneGroups = ReturnType<typeof laneGroupViews> &
  ReturnType<typeof laneGroupListViews>

export type LaneSourceHost = Pick<
  LaneRowInputs,
  'adapterCapabilities' | 'starAnchor' | 'features'
> & { adapterHeader: unknown } & Pick<LaneGroups, 'laneField'>

export function laneSourceViews(self: LaneSourceHost) {
  return {
    /**
     * #getter
     * whether each gutter draws its far lane against the anchor
     * (`rowsReadAgainstAnchor`)
     */
    get rowsVsAnchor(): boolean {
      return rowsReadAgainstAnchor(
        self.adapterCapabilities,
        self.starAnchor,
        self.laneField,
        headerReadsAgainstAnchor(self.adapterHeader),
      )
    },
  }
}

export function laneFetchViews(
  self: Pick<LaneRowInputs, 'starAnchor' | 'features'> &
    ReturnType<typeof laneSourceViews>,
) {
  return {
    /**
     * #getter
     * the fetches beyond the anchor's that its records call for
     */
    get laneFetchKinds() {
      return laneFetchesFor(self.features, self.rowsVsAnchor, self.starAnchor)
    },
  }
}

export type LaneDomainHost = ConfigSlotSelf &
  Pick<
    LaneRowInputs,
    | 'laneKey'
    | 'anchorAssemblyName'
    | 'adapterDeclaresLanes'
    | 'trackAssemblyNames'
  > &
  Pick<LaneGroups, 'groups'>

export function laneDomainViews(self: LaneDomainHost) {
  return {
    /**
     * #getter
     * `rows.sort` in each placed lane's own spelling, so an order a config
     * wrote with an alias merges with one a drag writes
     */
    get domain(): string[] {
      const spelled = new Map<string, string>()
      for (const group of self.groups) {
        for (const name of group.mates.keys()) {
          const key = self.laneKey(name)
          if (!spelled.has(key)) {
            spelled.set(key, name)
          }
        }
      }
      const written = getConf(self, ['rows', 'sort'])
      return [
        ...new Set(
          written.map(name => spelled.get(self.laneKey(name)) ?? name),
        ),
      ]
    },
    /**
     * #getter
     * the track's assemblies beside the anchor for a source that declares the
     * lanes itself, empty for every other source
     */
    get configuredLanes(): string[] {
      const anchor = self.laneKey(self.anchorAssemblyName)
      return self.adapterDeclaresLanes
        ? self.trackAssemblyNames.filter(name => self.laneKey(name) !== anchor)
        : []
    },
  }
}

type LaneDomain = ReturnType<typeof laneDomainViews>

export type LaneSelectionHost = Pick<
  LaneRowInputs,
  'laneChoice' | 'hiddenLaneNames'
> &
  Pick<LaneDomain, 'configuredLanes'>

export function laneSelectionViews(self: LaneSelectionHost) {
  return {
    /**
     * #getter
     * undefined means every lane, and a hidden lane stays in force
     */
    get laneSelection(): readonly string[] | undefined {
      return lanesInForce(self.laneChoice, self.configuredLanes)
    },
    /** #getter */
    get hiddenLanes(): readonly string[] {
      return self.hiddenLaneNames ?? []
    },
  }
}

type LaneSelection = ReturnType<typeof laneSelectionViews>

export type FetchLaneSelectionHost = Pick<
  LaneRowInputs,
  'adapterDeclaresLanes' | 'laneSpellings'
> &
  Pick<LaneSelection, 'laneSelection'>

export function fetchLaneSelectionViews(self: FetchLaneSelectionHost) {
  return {
    /**
     * #getter
     * undefined unless the adapter declares its lanes, and lists each held
     * genome under every name the session knows it by
     */
    get fetchLaneSelection(): string[] | undefined {
      const selection = self.adapterDeclaresLanes
        ? self.laneSelection
        : undefined
      return selection && [...new Set(selection.flatMap(self.laneSpellings))]
    },
  }
}

export type UnalignedLaneHost = Pick<
  LaneRowInputs,
  | 'laneChoice'
  | 'anchorRecordsLoaded'
  | 'currentFetch'
  | 'laneKey'
  | 'windowDeletions'
> &
  Pick<LaneGroups, 'groups' | 'laneField'>

export function unalignedLaneViews(self: UnalignedLaneHost) {
  return {
    /**
     * #getter
     * the lanes `rows.kept` names that the held fetch answered for and
     * placed nothing in; an unchosen lane placing nothing draws no row
     */
    get unalignedChosenLanes(): string[] {
      return unalignedChosenLanesOf(
        self.laneChoice,
        self.groups,
        answeredLaneTest(
          self.anchorRecordsLoaded,
          self.currentFetch.lanes,
          self.laneKey,
        ),
        self.laneKey,
        self.laneField,
      )
    },
  }
}

export function placelessLaneViews(
  self: Pick<LaneRowInputs, 'laneKey' | 'windowDeletions'> &
    ReturnType<typeof unalignedLaneViews>,
) {
  return {
    /**
     * #method
     * why a lane the window shows none of draws a row, or undefined where it
     * draws none
     */
    placelessOf(assemblyName: string): Placeless | undefined {
      const key = self.laneKey(assemblyName)
      const spanning = self.windowDeletions.filter(
        d => self.laneKey(d.assemblyName) === key,
      )
      return spanning.length
        ? {
            kind: 'deletion',
            bp: spanning.reduce((most, d) => Math.max(most, d.bp), 0),
          }
        : self.unalignedChosenLanes.some(name => self.laneKey(name) === key)
          ? { kind: 'unaligned' }
          : undefined
    },
  }
}

export type LaneRowAssemblyHost = Pick<
  LaneRowInputs,
  'windowDeletions' | 'anchorAssemblyName' | 'heldLaneOrder' | 'laneKey'
> &
  Pick<LaneGroups, 'groups'> &
  Pick<LaneDomain, 'domain'> &
  LaneSelection &
  Pick<ReturnType<typeof unalignedLaneViews>, 'unalignedChosenLanes'>

export function laneRowAssemblyViews(self: LaneRowAssemblyHost) {
  const sameRows = sameAsLast<string[]>()
  return {
    /**
     * #getter
     * a paralogy mate on the anchor assembly draws on its axis, not as a
     * row
     */
    get rowAssemblies() {
      return sameRows(
        laneRowsOf({
          groups: self.groups,
          placeless: [
            ...self.windowDeletions.map(d => d.assemblyName),
            ...self.unalignedChosenLanes,
          ],
          anchor: self.anchorAssemblyName,
          preferred: [...self.domain, ...(self.heldLaneOrder?.lanes ?? [])],
          selection: self.laneSelection,
          hidden: self.hiddenLanes,
          keyOf: self.laneKey,
        }),
      )
    },
  }
}

type LaneRowAssemblies = ReturnType<typeof laneRowAssemblyViews>

export type AnchorRowHost = Pick<
  LaneRowInputs,
  'anchorAssemblyName' | 'laneKey'
> &
  Pick<LaneGroups, 'laneField'> &
  Pick<LaneDomain, 'domain'> &
  LaneRowAssemblies

export function anchorRowViews(self: AnchorRowHost) {
  return {
    /**
     * #getter
     * the anchor's row in the stack: first, or among copy lanes after the
     * lanes `rows.sort` places before its assembly (`anchorRowOf`)
     */
    get anchorRow(): number {
      return anchorRowOf({
        field: self.laneField,
        sort: self.domain,
        rows: self.rowAssemblies,
        anchor: self.anchorAssemblyName,
        keyOf: self.laneKey,
      })
    },
  }
}

export type LaneOrderHost = Pick<
  LaneRowInputs,
  | 'anchorAssemblyName'
  | 'lanePins'
  | 'laneKey'
  | 'features'
  | 'featureOps'
  | 'anchorRecordsLoaded'
> &
  LaneRowAssemblies &
  ReturnType<typeof anchorRowViews>

export function laneOrderViews(self: LaneOrderHost) {
  return {
    /**
     * #getter
     * every lane in the order it stacks, the anchor's included
     */
    get laneOrder(): string[] {
      return laneOrderOf(
        self.rowAssemblies,
        self.anchorAssemblyName,
        self.anchorRow,
      )
    },
    /**
     * #getter
     * the pins that hold under the anchor, each naming its lane as
     * `rowAssemblies` spells it
     */
    get pinsInForce(): LanePin[] {
      return pinsInForceOf(
        self.lanePins ?? [],
        self.rowAssemblies,
        self.anchorAssemblyName,
        self.laneKey,
      )
    },
    /**
     * #getter
     * every fetched lane's key, chained by its deletions and insertions
     * against the anchor
     */
    get structureLaneKeys(): string[] {
      return structureOrder(laneProfiles(self.features, self.featureOps)).map(
        self.laneKey,
      )
    },
    /**
     * #getter
     * each drawn lane's row name by its canonical name, for data keyed by
     * the records' spelling of a lane
     */
    get rowOfLane(): ReadonlyMap<string, string> {
      return new Map(self.rowAssemblies.map(r => [self.laneKey(r), r]))
    },
  }
}

export function laneStructureOrderViews(
  self: Pick<LaneRowInputs, 'anchorRecordsLoaded' | 'features'> &
    ReturnType<typeof laneOrderViews>,
) {
  return {
    /**
     * #getter
     * the drawn lanes in `structureLaneKeys` order, for "Order lanes by
     * structure"; empty for a gene table
     */
    get laneStructureOrder(): string[] {
      const row = self.rowOfLane
      return self.anchorRecordsLoaded && !self.features.some(isNamedRecord)
        ? self.structureLaneKeys.flatMap(lane => row.get(lane) ?? [])
        : []
    },
  }
}

export type LaneOrderHoldHost = Pick<
  LaneRowInputs,
  | 'anchorRecordsLoaded'
  | 'adapterCapabilities'
  | 'laneKey'
  | 'anchorAssemblyName'
  | 'currentFetch'
  | 'heldLaneOrder'
> &
  Pick<ReturnType<typeof laneFetchViews>, 'laneFetchKinds'> &
  Pick<ReturnType<typeof laneOrderViews>, 'structureLaneKeys'>

export function laneOrderHoldActions(self: LaneOrderHoldHost) {
  return {
    /**
     * #action
     * runs when the anchor fetch for `regions` completes. Haplotype lanes read
     * off a graph stack by structure while no order is pinned, worked out
     * again only once a fetch leaves the window it was worked out on or asks
     * for other lanes, so panning never reshuffles the stack
     */
    holdLaneOrder(regions: FetchRegion[]) {
      if (
        !self.anchorRecordsLoaded ||
        !stacksByStructure(self.adapterCapabilities, self.laneFetchKinds)
      ) {
        self.heldLaneOrder = undefined
        return
      }
      const anchor = self.laneKey(self.anchorAssemblyName)
      const drawn = [
        ...new Set((self.currentFetch.lanes ?? []).map(self.laneKey)),
      ].sort()
      const held = self.heldLaneOrder
      const onWindow =
        held !== undefined && regions.some(r => touchesWindow(held.window, r))
      if (
        held?.anchor === anchor &&
        held.drawn.join('\t') === drawn.join('\t') &&
        onWindow
      ) {
        return
      }
      self.heldLaneOrder = {
        anchor,
        window: regions,
        drawn,
        lanes: self.structureLaneKeys,
      }
    },
  }
}

export type LaneSelectionActionsHost = ConfigSlotSelf &
  Pick<LaneRowInputs, 'laneKey' | 'laneChoice' | 'hiddenLaneNames'> &
  Pick<LaneDomain, 'configuredLanes'> &
  LaneSelection & {
    laneUniverse: LaneChoice[]
    setSelectedLanes: (names: readonly string[] | undefined) => void
  }

export function laneSelectionActions(self: LaneSelectionActionsHost) {
  return {
    /** #action */
    chooseLanes(names: string[]) {
      self.setSelectedLanes(
        pickedLanes(
          {
            picked: names,
            offered: self.laneUniverse
              .filter(lane => !lane.underFloor)
              .map(lane => lane.name),
            inForce: self.laneSelection,
            configured: self.configuredLanes,
          },
          self.laneKey,
        ),
      )
    },
    /** #action */
    hideLane(assemblyName: string) {
      self.hiddenLaneNames = withLaneHidden(
        self.hiddenLanes,
        assemblyName,
        self.laneKey,
      )
    },
    /** #action */
    showLane(assemblyName: string) {
      const choice = self.laneChoice
      const { kept, hidden } = withLaneShown(
        {
          kept: choice,
          hidden: self.hiddenLanes,
          configured: self.configuredLanes,
        },
        assemblyName,
        self.laneKey,
      )
      if (kept !== choice) {
        setConf(self, ['rows', 'kept'], kept)
      }
      self.hiddenLaneNames = hidden.length ? hidden : undefined
      persistTrackConfigNow(self)
    },
    /** #action */
    showHiddenLanes() {
      self.hiddenLaneNames = undefined
    },
  }
}
