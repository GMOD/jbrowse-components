import { getConf } from '@jbrowse/core/configuration'
import { groupKeySpaceOf } from '@jbrowse/core/util/groupKeys'

import {
  connectorDipReservePx,
  connectorFilterOf,
  resolveConnectorsByGroup,
} from '../features/linkedReads/computeOverlay.ts'
import { facetForUnit, sectionOrder } from '../shared/groupFeatures.ts'
import { attachChainFields } from './chainFields.ts'
import { framesUnpairedChainStrand } from './colorUtils.ts'
import {
  applyChainStrandFrames,
  laneLayoutOf,
  layoutGroupsToViewport,
} from './groupLayout.ts'
import { buildRawDataByGroup, orderedGroups } from './groupedDataMaps.ts'

import type { RegionBounds } from '../RenderAlignmentDataRPC/sortLayout.ts'
import type {
  ChainedPileupData,
  GroupedAlignmentsResult,
  RowCap,
} from '../RenderAlignmentDataRPC/types.ts'
import type { CanonicalRefName } from '../features/arcs/arcTypes.ts'
import type { ConnectorScope } from '../features/linkedReads/computeOverlay.ts'
import type { InsertSizeBand } from '../shared/insertSizeStats.ts'
import type {
  ColorFieldKind,
  ConnectionFilter,
  Facet,
  LayoutOrder,
  SortColumn,
} from '../shared/types.ts'
import type { ConfigSlotSelf } from './configSlotViews.ts'
import type { AlignmentsUnit } from './constants.ts'
import type { GroupLayoutContext, LaidOutByGroup } from './groupLayout.ts'

/** What {@link facetLayoutViews} reads: the facet and unit settings. */
export interface FacetLayoutHost extends ConfigSlotSelf {
  facet: Facet | undefined
  unit: AlignmentsUnit
}

/**
 * The facet a display's reads partition by and whether its sections
 * collapse to one row, off its settings alone.
 */
export function facetLayoutViews(self: FacetLayoutHost) {
  return {
    /**
     * #getter
     * The facet the fetch partitions by. Chain mode turns a per-read
     * dimension into ungrouped without changing the slot, so the slot
     * alone does not determine which sections come back.
     */
    get effectiveFacet() {
      return facetForUnit(self.facet, self.unit)
    },

    /**
     * #getter
     * Identity of the key space the fetched group keys belong to, and so of
     * every collection this model keys by group key — see
     * `groupKeySpaceOf`.
     */
    get groupKeySpace() {
      return groupKeySpaceOf(this.effectiveFacet)
    },

    /**
     * #getter
     * Whether the grouping will be honored, decidable from settings alone
     * since chain mode drops a per-read dimension (`facetForUnit`).
     * Positions the track label, which is placed before data arrives and
     * must not jump afterwards.
     */
    get prefersOffset() {
      return this.effectiveFacet !== undefined
    },

    /**
     * #getter
     * Whether collapsing can take effect, so whether the "Show" menu
     * offers the toggle. Chain mode never collapses (`laneLayoutOf`).
     * The menu omits the row rather than disabling it: a click would
     * write a slot no getter reads.
     */
    get canCollapseSections() {
      return this.prefersOffset && self.unit !== 'chain'
    },

    /**
     * #getter
     * Whether each group draws as one row, overlap depth shown by the
     * tint layer — the collapse in effect. Reads `canCollapseSections`,
     * not the slot alone: a config default can be ticked where collapsing
     * is inert.
     */
    get collapseSections(): boolean {
      return this.canCollapseSections && getConf(self, ['pileup', 'collapsed'])
    },
  }
}

/** What {@link groupLayoutViews} reads: the fetch and the layout settings. */
export interface GroupLayoutHost {
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>
  hiddenGroups: ReadonlySet<string>
  pinnedInsertSizeBand: InsertSizeBand | undefined
  effectiveFacet: Facet | undefined
  unit: AlignmentsUnit
  sortColumn: SortColumn | undefined
  showSoftClips: boolean
  layoutOrder: LayoutOrder
  loadedRegions: ReadonlyMap<number, RegionBounds>
  collapseSections: boolean
}

/**
 * The fetched reads by section, in stacking order, and what laying them out
 * takes: the display and a static export read the same sections.
 */
export function groupLayoutViews(self: GroupLayoutHost) {
  return {
    /**
     * #getter
     * The drawn sections in stacking order, hidden ones left out.
     */
    get groupOrder() {
      const facet = self.effectiveFacet
      return orderedGroups(
        self.rpcDataMap,
        self.hiddenGroups,
        sectionOrder(facet?.field ?? '', facet?.sort),
      )
    },

    /**
     * #getter
     * Raw (un-laid-out) data regrouped as group key → (region idx →
     * data), insertion-ordered so the first key is the primary group;
     * ungrouped is the single key `''`. Hidden lanes are already gone,
     * like `groupOrder`, so a walk of every entry is a walk of every
     * DRAWN lane. See `buildRawDataByGroup`.
     */
    get rawDataByGroup() {
      return buildRawDataByGroup(
        self.rpcDataMap,
        self.hiddenGroups,
        self.pinnedInsertSizeBand,
      )
    },

    /**
     * #getter
     * `rawDataByGroup` with chain identity joined across every region and
     * lane (`attachChainFields`), in chain mode only. The worker knows no
     * chains, so toggling the mode is this getter changing, not a fetch.
     */
    get chainAttachment() {
      return self.unit === 'chain'
        ? attachChainFields(this.rawDataByGroup)
        : undefined
    },

    /**
     * #getter
     * The layout's input: `chainAttachment` in chain mode, else the
     * fetched data. `rawDataByGroup` stays chain-free, so the arcs,
     * sashimi, coverage and a split view overlaying this display do not
     * recompute on the toggle.
     */
    get chainedByGroup(): ReadonlyMap<
      string,
      ReadonlyMap<number, ChainedPileupData>
    > {
      return this.chainAttachment ?? this.rawDataByGroup
    },

    /**
     * #getter
     * The layout mechanics (grouping, sort, soft-clip) shared by the
     * viewport fit pass and ad-hoc layouts such as `fittedFeatureHeight`.
     * Excludes the fit policy (row caps) and the color inputs, which
     * invalidate a later tier.
     */
    get groupLayoutContext(): GroupLayoutContext {
      return {
        order: this.groupOrder,
        rawByGroup: this.chainedByGroup,
        unit: self.unit,
        sortColumn: self.sortColumn,
        showSoftClips: self.showSoftClips,
        layoutOrder: self.layoutOrder,
        regions: self.loadedRegions,
        collapseSections: self.collapseSections,
      }
    },
  }
}

/**
 * What {@link pileupLayoutViews} reads: the layout context and the row caps
 * a viewport sets, which a static export answers with none.
 */
export interface PileupLayoutHost {
  groupLayoutContext: GroupLayoutContext
  collapsedGroups: ReadonlySet<string>
  fitCeilingRows: number
  fitDefaultCap: RowCap
  groupRowCaps: ReadonlyMap<string, RowCap>
  bodyColorKind: ColorFieldKind
  unit: AlignmentsUnit
}

/**
 * Every section's reads on their rows, with each chain's strand frame
 * settled: the one layout the display draws and a static export reports.
 */
export function pileupLayoutViews(self: PileupLayoutHost) {
  return {
    /**
     * #getter
     * Per-group laid-out data: group key → (region index → laid-out
     * data). Each group lays out independently under a per-group cap, so a
     * dense group cannot starve the rest. Rows only; the per-read color
     * arrays bake one computed later, in `laidOutByGroup`.
     */
    get laidOutByGroupUncolored() {
      return layoutGroupsToViewport(self.groupLayoutContext, {
        collapsedKeys: self.collapsedGroups,
        // Reads only the resolved caps, not the track height, row pitch
        // or band overhead behind them, which move a px per drag frame.
        maxRows: self.fitCeilingRows,
        defaultCap: self.fitDefaultCap,
        overrideCaps: self.groupRowCaps,
      })
    },

    /**
     * #getter
     * Whether the unpaired chain-strand framing is on: the one answer the
     * consensus pass, the bake (`readColorOpts`) and the key read. A
     * boolean in a separate computed, so a field switch that leaves the
     * answer alone does not re-run the frame solve.
     */
    get framesChainStrand() {
      return framesUnpairedChainStrand(self.bodyColorKind, self.unit)
    },

    /**
     * #getter
     * The laid-out data with every chain's strand frame settled — see
     * `applyChainStrandFrames`.
     */
    get laidOutByGroupFramed(): LaidOutByGroup {
      return applyChainStrandFrames(
        this.laidOutByGroupUncolored,
        self.unit,
        this.framesChainStrand,
      )
    },
  }
}

/** What {@link connectorSettingViews} reads. */
export interface ConnectorSettingHost {
  unit: AlignmentsUnit
  showConnectors: boolean
}

/** Whether, and over which pairs, the pileup connectors draw. */
export function connectorSettingViews(self: ConnectorSettingHost) {
  return {
    /**
     * #getter
     * Whether the pileup connectors draw: always in chain layout, where a
     * connector is how a chain's reads join, and otherwise as
     * `pileup.connectors.show` says.
     */
    get drawsConnectors() {
      return self.unit === 'chain' || self.showConnectors
    },
    /**
     * #getter
     * Which pairs the connector mark draws — see `ConnectorScope`.
     */
    get connectorScope(): ConnectorScope {
      return this.drawsConnectors ? 'all' : 'none'
    },
  }
}

/** What {@link connectorViews} reads. */
export interface ConnectorHost {
  laidOutByGroupFramed: LaidOutByGroup
  groupLayoutContext: GroupLayoutContext
  groupRowCaps: ReadonlyMap<string, RowCap>
  collapsedGroups: ReadonlySet<string>
  drawsConnectors: boolean
  connectorScope: ConnectorScope
  canonicalRefName: CanonicalRefName | undefined
  loadedRegions: ReadonlyMap<number, RegionBounds>
  connectionFilter: ConnectionFilter
  arcCollection: { belowFloor: ReadonlySet<string> }
  fitHeightToDisplay: boolean
  featureHeight: number
  featureSpacing: number
  host: {
    displayedRegions: readonly { refName: string; reversed?: boolean }[]
  }
}

/**
 * The pileup's connectors over the laid-out sections, and the room each
 * section keeps below its rows for the deepest of them.
 */
export function connectorViews(self: ConnectorHost) {
  return {
    /**
     * #getter
     * Which pairs the connectors draw under `connectionFilter`. The
     * inter-chromosomal floor comes from the arc band's collection
     * stage, which runs only once a connector crosses chromosomes.
     */
    get connectorFilter() {
      return connectorFilterOf(
        self.connectionFilter,
        i => self.loadedRegions.get(i)?.refName,
        () => self.arcCollection.belowFloor,
      )
    },

    /**
     * #getter
     * Every read connector per group, from one walk of its reads: the
     * straight-line pass's records and the pairs the connector mark
     * draws. Reads the layout tier, so a band resize, height drag or
     * recolor reuses them.
     */
    get connectorsByGroup() {
      return resolveConnectorsByGroup(
        self.laidOutByGroupFramed,
        {
          lines: self.drawsConnectors,
          scope: self.connectorScope,
          canonicalRefName: self.canonicalRefName,
          refNameAt: i => self.loadedRegions.get(i)?.refName,
          admits: self.drawsConnectors ? this.connectorFilter : undefined,
        },
        key =>
          laneLayoutOf(
            self.groupLayoutContext,
            key,
            self.groupRowCaps,
            self.collapsedGroups,
          ) === 'stacked',
      )
    },

    /**
     * #method
     * The px a section keeps under its last row for its deepest dipping
     * connector, given its pileup band's height
     * (`connectorDipReservePx`); none under fit, whose pitch fills the
     * track, or for a section drawing no rows.
     */
    connectorDipReserve(groupKey: string, pileupHeight: number) {
      const pairs =
        self.fitHeightToDisplay || pileupHeight === 0
          ? undefined
          : this.connectorsByGroup.get(groupKey)?.overlayPairs
      return pairs?.length
        ? connectorDipReservePx({
            pairs,
            displayedRegions: self.host.displayedRegions,
            featureHeight: self.featureHeight,
            featureSpacing: self.featureSpacing,
            pileupHeight,
          })
        : 0
    },
  }
}
