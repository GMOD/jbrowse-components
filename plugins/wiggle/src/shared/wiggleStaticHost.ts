import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { trackCanvasWidthPx } from '@jbrowse/display-kit/foundationView'
import { types } from '@jbrowse/mobx-state-tree'
import {
  hierarchyViews,
  rowsContentHeightViews,
  treeSidebarAxisConfigViews,
  treeSidebarRowsConfigViews,
  treeSidebarRowStages,
} from '@jbrowse/tree-sidebar/treeSidebarRowViews'
import {
  YFieldConfigMixin,
  ungroupedAutoscaleViews,
} from '@jbrowse/wiggle-core'

import linearWiggleDisplayConfigSchema from '../LinearWiggleDisplay/configSchema.ts'
import { multiQuantitativeWiggleConfigSchema } from '../MultiQuantitativeTrack/displaySchema.ts'
import {
  wiggleConfigViews,
  wiggleLabelViews,
  wiggleModeViews,
} from './wiggleConfigViews.ts'
import { wiggleScoreStages, wiggleSidebarStages } from './wiggleStages.ts'
import { WIGGLE_Y_PATHS } from './wiggleYPaths.ts'

import type { Source } from '../util.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { SettledBlocksView, WiggleDataResult } from '@jbrowse/wiggle-core'

/**
 * What a static wiggle host reads off the view it stands in for: the blocks
 * it autoscales over and the width its plot canvas spans.
 */
export interface WiggleStaticFrame extends SettledBlocksView {
  trackWidthPx: number
}

const NO_FRAME: WiggleStaticFrame = {
  initialized: false,
  settledDynamicBlocks: [],
  trackWidthPx: 0,
}

/**
 * The wiggle display reduced to its config, the fetched scores and the frame
 * they were fetched over, under the views the display installs, in the
 * display's order, its row views, row hooks and key among them. No session, no
 * view, no autoruns, and so no autoscale group: the axis autoscales over
 * this track alone. The tables and the static SVG export both run it.
 */
function wiggleStaticHost(
  configuration:
    | typeof linearWiggleDisplayConfigSchema
    | typeof multiQuantitativeWiggleConfigSchema,
) {
  const base = types
    .compose(
      'WiggleStaticHost',
      TrackHeightMixin(),
      YFieldConfigMixin(WIGGLE_Y_PATHS),
      LegendMixin(),
      types.model({ id: types.string, configuration }),
    )
    .volatile(
      (): {
        host: WiggleStaticFrame
        rpcDataMap: ReadonlyMap<number, WiggleDataResult>
      } => ({ host: NO_FRAME, rpcDataMap: new Map() }),
    )
    .actions(self => ({
      setFetched(
        host: WiggleStaticFrame,
        rpcDataMap: ReadonlyMap<number, WiggleDataResult>,
      ) {
        self.host = host
        self.rpcDataMap = rpcDataMap
      },
    }))
    .views(self => ({
      get canvasWidthPx() {
        return trackCanvasWidthPx(self.host)
      },
    }))
    .views(ungroupedAutoscaleViews)
    .views(self => wiggleConfigViews(self))
    .views(self => wiggleModeViews(self))
    .views(self => wiggleLabelViews(self))
    .views(self => treeSidebarAxisConfigViews(self))
    .views(self => treeSidebarRowsConfigViews(self))
  const scored = wiggleScoreStages(treeSidebarRowStages<Source>()(base))
    .views(self => rowsContentHeightViews(self))
    .views(self => hierarchyViews(self))
  return wiggleSidebarStages(scored)
}

const QuantitativeStaticHost = wiggleStaticHost(linearWiggleDisplayConfigSchema)
const MultiQuantitativeStaticHost = wiggleStaticHost(
  multiQuantitativeWiggleConfigSchema,
)

export interface WiggleStaticHost extends Instance<
  typeof QuantitativeStaticHost
> {}

export type WiggleTrackType = 'QuantitativeTrack' | 'MultiQuantitativeTrack'

/** The track type a quantitative adapter reads as when none is named. */
export function wiggleTrackTypeOf(adapterConfig: Record<string, unknown>) {
  return adapterConfig.type === 'MultiWiggleAdapter'
    ? 'MultiQuantitativeTrack'
    : 'QuantitativeTrack'
}

/**
 * The static host for a track type's display, `display` its config as a
 * track's `displays` entry writes it: a `MultiQuantitativeTrack` defaults to
 * a row per source and no min-max extent.
 */
export function createWiggleStaticHost({
  trackType,
  id,
  display,
}: {
  trackType: WiggleTrackType
  id: string
  display: Record<string, unknown>
}) {
  return (
    trackType === 'MultiQuantitativeTrack'
      ? MultiQuantitativeStaticHost
      : QuantitativeStaticHost
  ).create({
    id,
    configuration: { ...display, type: 'LinearWiggleDisplay', displayId: id },
  })
}
