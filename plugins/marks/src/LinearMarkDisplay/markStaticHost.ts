import { hiddenGroupsViews } from '@jbrowse/display-kit/HiddenGroupsMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { trackCanvasWidthPx } from '@jbrowse/display-kit/foundationView'
import { types } from '@jbrowse/mobx-state-tree'
import { RowHeightMixin } from '@jbrowse/tree-sidebar'
import {
  clusterableRowViews,
  bandedRowViews,
  bandedSourceViews,
  editableRowViews,
  expandedRowViews,
  hierarchyViews,
  resolvedRowColorViews,
  rowAliasViews,
  rowFocusLineViews,
  rowNarrowingShowsViews,
  rowOrderViews,
  rowTreeRootViews,
  rowTreeViews,
  rowsContentHeightViews,
  rowsTopOffsetViews,
  sourceViews,
  treeSidebarAxisConfigViews,
  treeSidebarRowHookDefaults,
  treeSidebarRowsConfigViews,
  treeSidebarTreeHookDefaults,
} from '@jbrowse/tree-sidebar/treeSidebarRowViews'
import { ScoreScaleMixin, ungroupedAutoscaleViews } from '@jbrowse/wiggle-core'

import { configSchemaFactory } from './configSchema.ts'
import {
  markChannelViews,
  markConfigViews,
  markEntryViews,
  markFacetViews,
  markRequestViews,
  markRowsViews,
} from './markConfigViews.ts'
import {
  markAutoscaleViews,
  markDiscoveredRowViews,
  markDomainViews,
  markListedSourceViews,
  markDrawnKeyViews,
  markRegionViews,
  markRowKeySpaceViews,
  markRowListingViews,
  markRowTableViews,
  markScaleViews,
  markSidebarViews,
  markStatsViews,
  markSvgSidebarViews,
} from './markResolveViews.ts'
import { MARK_Y_PATHS } from './markYPaths.ts'

import type { HiddenCategory } from './markColor.ts'
import type { MarkRegionData } from './markList.ts'
import type { MarkViewFrame } from './markResolveViews.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RowSourceListing } from '@jbrowse/core/data_adapters/BaseAdapter/rowSources'
import type { RegionHost } from '@jbrowse/display-kit/regionHost'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { RowSource } from '@jbrowse/tree-sidebar'

/**
 * What a static mark host reads off the view it stands in for: the zoom, the
 * regions, the settled blocks the axis and the key read, and the width its
 * plot canvas spans.
 */
export interface MarkStaticFrame
  extends MarkViewFrame, Pick<RegionHost, 'trackWidthPx' | 'visibleRegions'> {}

const NO_FRAME: MarkStaticFrame = {
  initialized: false,
  bpPerPx: 1,
  offsetPx: 0,
  displayedRegions: [],
  settledDynamicBlocks: [],
  visibleRegions: [],
  trackWidthPx: 0,
}

const MarkStaticHostModel = types
  .compose(
    'MarkStaticHost',
    TrackHeightMixin(),
    RowHeightMixin(),
    ScoreScaleMixin(MARK_Y_PATHS),
    LegendMixin(),
    types.model({
      id: types.string,
      configuration: configSchemaFactory(),
      hiddenCategories: types.frozen<readonly HiddenCategory[] | undefined>(),
    }),
  )
  .volatile(
    (): {
      host: MarkStaticFrame
      featurePayloads: ReadonlyMap<number, MarkRegionData>
      adapterListing: RowSourceListing | undefined
    } => ({
      host: NO_FRAME,
      featurePayloads: new Map(),
      adapterListing: undefined,
    }),
  )
  .actions(self => ({
    setFrame(host: MarkStaticFrame) {
      self.host = host
    },
    setFetched(
      featurePayloads: ReadonlyMap<number, MarkRegionData>,
      adapterListing: RowSourceListing | undefined,
    ) {
      self.featurePayloads = featurePayloads
      self.adapterListing = adapterListing
    },
  }))
  .views(self => ({
    get canvasWidthPx() {
      return trackCanvasWidthPx(self.host)
    },
    get trackVisibleRegions() {
      return self.host.visibleRegions
    },
    canonicalRefName(_assemblyName: string, refName: string) {
      return refName
    },
  }))
  .views(ungroupedAutoscaleViews)
  .views(self => treeSidebarAxisConfigViews(self))
  .views(self => treeSidebarRowsConfigViews(self))
  .views(() => treeSidebarRowHookDefaults<RowSource>())
  .views(self => expandedRowViews<RowSource>(self))
  .views(self => rowAliasViews<RowSource>(self))
  .views(self => rowTreeViews<RowSource>(self))
  .views(self => rowOrderViews<RowSource>(self))
  .views(self => resolvedRowColorViews<RowSource>(self))
  .views(self => editableRowViews<RowSource>(self))
  .views(self => clusterableRowViews<RowSource>(self))
  .views(self => bandedRowViews<RowSource>(self))
  .views(self => bandedSourceViews<RowSource>(self))
  .views(self => sourceViews<RowSource>(self))
  .views(self => rowNarrowingShowsViews<RowSource>(self))
  .views(self => rowFocusLineViews(self))
  .views(self => rowsTopOffsetViews(self))
  .views(self => rowTreeRootViews<RowSource>(self))
  .views(self => treeSidebarTreeHookDefaults(self))
  .views(self => rowsContentHeightViews(self))
  .views(self => hierarchyViews(self))
  .views(self => markConfigViews(self))
  .views(self => markChannelViews(self))
  .views(self => markFacetViews(self))
  .views(self => markEntryViews(self))
  .views(self => markRowsViews(self))
  .views(self => markRequestViews(self))
  .views(self => hiddenGroupsViews(self))
  .views(self => markRowListingViews(self))
  .views(self => markListedSourceViews(self))
  .views(self => markDiscoveredRowViews(self))
  .views(self => markRowKeySpaceViews(self))
  .views(self => markRegionViews(self))
  .views(self => markRowTableViews(self))
  .views(self => markDrawnKeyViews(self))
  .views(self => markStatsViews(self))
  .views(self => markAutoscaleViews(self))
  .views(self => markDomainViews(self))
  .views(self => markSidebarViews(self))
  .views(self => markScaleViews(self))
  .views(self => markSvgSidebarViews(self))

/**
 * The mark display reduced to its config, the categories its key hides, the
 * fetched layers and the frame they were fetched over, under the views the
 * display installs, in the display's order. No session, no view, no
 * autoruns: the rows keep their config's arrangement, the axis autoscales over
 * this track alone, and a link's far foot matches the view's regions by the
 * refName the adapter names.
 */
export interface MarkStaticHost extends Instance<typeof MarkStaticHostModel> {}

/**
 * The static host for a mark display, `display` its config as a track's
 * `displays` entry writes it.
 */
export function createMarkStaticHost(
  pluginManager: PluginManager,
  {
    id,
    display,
    hiddenCategories,
  }: {
    id: string
    display: Record<string, unknown>
    hiddenCategories?: readonly HiddenCategory[]
  },
) {
  return MarkStaticHostModel.create(
    {
      id,
      configuration: { ...display, type: 'LinearMarkDisplay', displayId: id },
      hiddenCategories,
    },
    { pluginManager },
  )
}
