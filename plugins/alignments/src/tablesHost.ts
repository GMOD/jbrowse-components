import {
  coverageAutoscaleViews,
  coverageDomainViews,
  coverageStatsViews,
  coverageTicksViews,
} from '@jbrowse/alignments-core'
import {
  COVERAGE_Y_PATHS,
  coverageBandSlotViews,
} from '@jbrowse/alignments-core/coverageBandConfigSchema'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { adapterRefNameText } from '@jbrowse/core/util'
import { heightModeViews } from '@jbrowse/display-kit/HeightModeMixin'
import { hiddenGroupsViews } from '@jbrowse/display-kit/HiddenGroupsMixin'
import { keyWindowsOf } from '@jbrowse/display-kit/keyWindows'
import { regionBlocks } from '@jbrowse/display-kit/regionHost'
import { types } from '@jbrowse/mobx-state-tree'
import { ScoreScaleMixin, ungroupedAutoscaleViews } from '@jbrowse/wiggle-core'

import {
  alignmentsColorViews,
  detectedModificationsOf,
  readPaletteViews,
} from './LinearAlignmentsDisplay/alignmentsColorViews.ts'
import {
  bandStackViews,
  junctionsStripViews,
} from './LinearAlignmentsDisplay/bandStackViews.ts'
import { linearAlignmentsDisplayConfigSchema } from './LinearAlignmentsDisplay/configSchema.ts'
import { configSlotViews } from './LinearAlignmentsDisplay/configSlotViews.ts'
import { connectionKeyViews } from './LinearAlignmentsDisplay/connectionKeyViews.ts'
import {
  bandPlotViews,
  shownGroupCoverage,
} from './LinearAlignmentsDisplay/coverageScaleViews.ts'
import {
  MAX_LAYOUT_ROWS,
  ceilingCap,
} from './LinearAlignmentsDisplay/groupLayout.ts'
import {
  drawnLaneViews,
  laneViews,
  linkedReadLinesViews,
  rowlessLaneViews,
  sectionViews,
} from './LinearAlignmentsDisplay/laneViews.ts'
import { featureSpacingForHeight } from './LinearAlignmentsDisplay/menus/compactnessPresets.ts'
import {
  arcViews,
  connectorSettingViews,
  connectorViews,
  facetLayoutViews,
  groupLayoutViews,
  pileupLayoutViews,
} from './LinearAlignmentsDisplay/pileupLayoutViews.ts'
import {
  rpcPropsViews,
  sortTagViews,
} from './LinearAlignmentsDisplay/rpcPropsViews.ts'

import type { RefNamePosition } from './LinearAlignmentsDisplay/colorTagUtils.ts'
import type { GroupSize } from './LinearAlignmentsDisplay/groupLayout.ts'
import type { RegionBounds } from './RenderAlignmentDataRPC/sortLayout.ts'
import type {
  GroupedAlignmentsResult,
  RowCap,
} from './RenderAlignmentDataRPC/types.ts'
import type { RegionInfo } from './features/arcs/arcTypes.ts'
import type { SortColumn } from './shared/types.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { KeyWindow } from '@jbrowse/display-kit/keyWindows'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { SettledBlocksView } from '@jbrowse/wiggle-core'

/**
 * What `alignmentTables` fetched, the regions it fetched them over (each
 * window and the view's margin around it), the windows it reads them in, and
 * the displayed region each window is a slice of, which connectors are
 * placed in.
 */
export interface AlignmentsTablesInputs {
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>
  fetchedRegions: RegionBounds[]
  regionInfos: RegionInfo[]
  frames: RegionInfo[]
  paintedRefNamePosition: RefNamePosition | undefined
}

export const NO_KEYS: ReadonlySet<string> = new Set()
const NO_ROW_CAPS: ReadonlyMap<string, RowCap> = new Map()
const NO_GROUP_SIZES: ReadonlyMap<string, GroupSize> = new Map()

/**
 * The alignments display reduced to what its tables decide from: its config,
 * the fetched reads with the regions as the frame, the default theme, and
 * the views the display installs over its config-slot views, from its facet
 * and section layout through its connectors to its coverage scale and read
 * colors. No session, view or autoruns, and so no autoscale group. A
 * viewport's row caps, a lane's coverage-only chevron and a lane's dragged
 * size are the view's, so the tables lay every row out, at the configured
 * read height, and always build the key.
 */
export const AlignmentsTablesHost = types
  .compose(
    'AlignmentsTablesHost',
    ScoreScaleMixin(COVERAGE_Y_PATHS),
    types.model({
      type: types.literal('LinearAlignmentsDisplay'),
      configuration: linearAlignmentsDisplayConfigSchema,
    }),
  )
  .volatile(
    (): AlignmentsTablesInputs & {
      sortColumn: SortColumn | undefined
      theme: JBrowsePalette
    } => ({
      rpcDataMap: new Map(),
      fetchedRegions: [],
      regionInfos: [],
      frames: [],
      sortColumn: undefined,
      paintedRefNamePosition: undefined,
      theme: resolvePalette(),
    }),
  )
  .actions(self => ({
    setSortColumn(sortColumn: SortColumn | undefined) {
      self.sortColumn = sortColumn
    },
    setInputs(inputs: AlignmentsTablesInputs) {
      self.rpcDataMap = inputs.rpcDataMap
      self.fetchedRegions = inputs.fetchedRegions
      self.regionInfos = inputs.regionInfos
      self.frames = inputs.frames
      self.paintedRefNamePosition = inputs.paintedRefNamePosition
    },
  }))
  .views(heightModeViews)
  .views(ungroupedAutoscaleViews)
  .views(coverageBandSlotViews)
  .views(configSlotViews)
  .views(self => ({
    get loadedRegions(): ReadonlyMap<number, RegionBounds> {
      return new Map(self.fetchedRegions.map((r, i) => [i, r]))
    },
    get loadedRegionInfos() {
      return regionBlocks(self.fetchedRegions)
    },
    get displayedRegionInfos() {
      return self.frames
    },
    get host() {
      return { displayedRegions: self.frames }
    },
    get view(): SettledBlocksView {
      return {
        initialized: self.regionInfos.length > 0,
        settledDynamicBlocks: self.regionInfos,
      }
    },
    get keyWindows(): readonly KeyWindow[] {
      return keyWindowsOf(self.regionInfos)
    },
    get featureHeight() {
      return self.markHeight
    },
    get featureSpacing() {
      return featureSpacingForHeight(self.markHeight)
    },
    get rowHeight() {
      return this.featureHeight + this.featureSpacing
    },
    get collapsedGroups() {
      return NO_KEYS
    },
    get groupSizesInEffect() {
      return NO_GROUP_SIZES
    },
    get groupRowCaps() {
      return NO_ROW_CAPS
    },
    get fitDefaultCap() {
      return ceilingCap(MAX_LAYOUT_ROWS)
    },
    get fitCeilingRows() {
      return MAX_LAYOUT_ROWS
    },
    get canonicalRefName() {
      return adapterRefNameText
    },
    get showLegend() {
      return true
    },
    get detectedModifications() {
      return detectedModificationsOf(self.rpcDataMap)
    },
    get fitTargetHeight(): number {
      return self.configuredHeight
    },
  }))
  .views(self => connectorSettingViews(self))
  .views(self => facetLayoutViews(self))
  .views(self => hiddenGroupsViews(self))
  .views(self => groupLayoutViews(self))
  .views(self => arcViews(self))
  .views(self => pileupLayoutViews(self))
  .views(self => connectorViews(self))
  .views(self => bandPlotViews(self))
  .views(self => junctionsStripViews(self))
  .views(self => bandStackViews(self))
  .views(self => coverageStatsViews(self, shownGroupCoverage(self)))
  .views(self => coverageAutoscaleViews(self))
  .views(self => coverageDomainViews(self))
  .views(self =>
    coverageTicksViews(self, () => self.bandHeights.coverageHeight),
  )
  .views(self => rowlessLaneViews(self))
  .views(self => alignmentsColorViews(self))
  .views(self => connectionKeyViews(self))
  .views(self => readPaletteViews(self))
  .views(self => linkedReadLinesViews(self))
  .views(self => laneViews(self))
  .views(self => drawnLaneViews(self))
  .views(self => sectionViews(self))
  .views(self => sortTagViews(self))
  .views(self => rpcPropsViews(self))
  .views(self => ({
    get colors() {
      return self.colorsIn(self.theme)
    },
  }))

export interface AlignmentsTablesHostModel extends Instance<
  typeof AlignmentsTablesHost
> {}
