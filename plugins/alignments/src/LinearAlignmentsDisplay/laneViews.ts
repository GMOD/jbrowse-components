import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'

import { attachLinkedReadLinesByGroup } from './groupLayout.ts'
import { hasNamedGroups } from './groupedDataMaps.ts'
import { buildLanes, drawnLanesOf, drawsPileupRows } from './lanes.ts'
import { computeStackedSections } from './sectionLayout.ts'

import type { GroupConnectors } from '../features/linkedReads/computeOverlay.ts'
import type { ColoredByGroup } from './groupLayout.ts'
import type { AlignmentLane, BuildLanesInput } from './lanes.ts'
import type { LaneBandHeights, LaneBandsInput } from './sectionLayout.ts'

/** What {@link linkedReadLinesViews} reads. */
export interface LinkedReadLinesHost {
  laidOutByGroupColored: ColoredByGroup
  connectorsByGroup: ReadonlyMap<string, GroupConnectors>
}

/** The colored layout with the straight-line connector pass spread on. */
export function linkedReadLinesViews(self: LinkedReadLinesHost) {
  return {
    /**
     * #getter
     * `laidOutByGroupColored` with the straight-line pass's records
     * spread on, so a curved-connector toggle re-spreads the lines and
     * keeps both the layout and the colors.
     */
    get laidOutByGroup() {
      return attachLinkedReadLinesByGroup(
        self.laidOutByGroupColored,
        self.connectorsByGroup,
      )
    },
  }
}

/** What {@link rowlessLaneViews} reads. */
export interface RowlessLaneHost {
  groupOrder: BuildLanesInput['order']
  collapsedGroups: BuildLanesInput['collapsedKeys']
  showPileup: boolean
}

/** The lanes that lay out no read rows. */
export function rowlessLaneViews(self: RowlessLaneHost) {
  return {
    /**
     * #getter
     * The drawn lanes that lay out no read rows: every one with "Show
     * pileup" off, else those collapsed to their coverage.
     */
    get rowlessLaneKeys(): ReadonlySet<string> {
      return new Set(
        self.groupOrder
          .map(g => g.key)
          .filter(
            key =>
              !drawsPileupRows(self.showPileup, self.collapsedGroups.has(key)),
          ),
      )
    },
  }
}

/** What {@link laneViews} reads: the drawn groups and their per-lane data. */
export interface LaneHost {
  groupOrder: BuildLanesInput['order']
  rawDataByGroup: BuildLanesInput['rawByGroup']
  laidOutByGroup: BuildLanesInput['laidOutByGroup']
  arcsResult: { inkGroupKeys: BuildLanesInput['arcInkKeys'] }
  junctionsStripKeysByGroup: BuildLanesInput['junctionsStripKeysByGroup']
  collapsedGroups: BuildLanesInput['collapsedKeys']
  groupSizesInEffect: BuildLanesInput['sizes']
  showPileup: boolean
  fitHeightToDisplay: boolean
}

/** The stacked lanes, and whether their sections are labelled. */
export function laneViews(self: LaneHost) {
  return {
    /**
     * #getter
     * The stacked lanes in stacking order, one `AlignmentLane` per drawn
     * group; ungrouped is the one-lane case. The one place a lane's key
     * resolves to its data.
     */
    get lanes(): AlignmentLane[] {
      return buildLanes({
        order: self.groupOrder,
        rawByGroup: self.rawDataByGroup,
        laidOutByGroup: self.laidOutByGroup,
        arcInkKeys: self.arcsResult.inkGroupKeys,
        junctionsStripKeysByGroup: self.junctionsStripKeysByGroup,
        collapsedKeys: self.collapsedGroups,
        sizes: self.groupSizesInEffect,
        showPileup: self.showPileup,
        fitHeightToDisplay: self.fitHeightToDisplay,
      })
    },

    /**
     * #getter
     * Whether the stacked section labels and dividers are drawn. Not
     * `isGrouped`: grouping that yields one section still reserves the
     * label offset (`prefersOffset`) and wants its section named and
     * collapsible. Reads the fetched sections, not `facet` — see
     * `hasNamedGroups`.
     */
    get showsGroupLabels() {
      return hasNamedGroups(self.groupOrder)
    },
  }
}

/** What {@link drawnLaneViews} reads. */
export interface DrawnLaneHost {
  lanes: AlignmentLane[]
  showsGroupLabels: boolean
}

/** The lanes the sections stack, and the least height a section takes. */
export function drawnLaneViews(self: DrawnLaneHost) {
  return {
    /**
     * #getter
     * The lanes laid out, or the one SYNTHETIC no-data lane: `sections`
     * must produce a section before any fetch lands, and a grouped fetch
     * over an empty region partitions to zero lanes. Every collection on it
     * is empty.
     */
    get drawnLanes(): AlignmentLane[] {
      return drawnLanesOf(self.lanes)
    },

    /**
     * #method
     * One lane by group key, for the per-key questions a component asks
     * with a `groupKey` in hand. `undefined` for a key that isn't drawn.
     */
    laneFor(key: string) {
      return self.lanes.find(l => l.groupKey === key)
    },

    /**
     * #getter
     * The least height a section takes, so its label chip has room.
     */
    get minSectionHeight() {
      return self.showsGroupLabels ? GROUP_LABEL_HEIGHT : 0
    },
  }
}

/** What {@link sectionViews} reads: the lanes, their bands and the row pitch. */
export interface SectionHost {
  drawnLanes: AlignmentLane[]
  drawnLaneBandsInput: LaneBandsInput
  bandHeights: LaneBandHeights
  rowHeight: number
  showPileup: boolean
  minSectionHeight: number
  laneSlot: number
}

/** The lanes stacked into sections. */
export function sectionViews(self: SectionHost) {
  return {
    /**
     * #getter
     * All vertical band geometry, one entry per lane; ungrouped is the
     * one-lane call. Runs over `drawnLanes` so a display with no data still
     * has a section. The sticky-coverage-vs-scroll distinction lives
     * downstream in `buildSectionRenders`. With the pileup hidden every
     * lane advances exactly its `laneSlot`, its bands filling it, so the
     * stack fits the track and never scrolls.
     */
    get sections() {
      return computeStackedSections(self.drawnLanes, self.drawnLaneBandsInput, {
        rowHeight: self.rowHeight,
        minSectionHeight: self.showPileup
          ? self.minSectionHeight
          : self.laneSlot,
        bandHeights: self.bandHeights,
      })
    },
  }
}
