import { getConf, setConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The mixin composes onto a display that supplies `configuration`, but that
// prop is declared by the concrete display, not here, so `self` isn't typed
// with it. This is the shared read/write handle for both `getConf` and
// `setConf`. Mirrors TrackHeightMixin's cast idiom. Slot names go unchecked
// here because `AnyConfigurationModel` is widened, unlike in a display whose
// factory pins its schema.
interface ConfNode {
  configuration: AnyConfigurationModel
}
const confNode = (self: object) => self as ConfNode

/**
 * #stateModel WiggleScoreConfigMixin
 * #category display
 *
 * Score/scale/color config and isCacheValid for wiggle-family displays. Does
 * NOT include rpcDataMap or autoscale domain computation — those live in
 * WiggleCommonMixin, which composes this. Displays that own their own
 * rpcDataMap type (e.g. LinearManhattanDisplay) should compose this instead.
 */
export function WiggleScoreConfigMixin() {
  return types
    .model('WiggleScoreConfigMixin', {
      /**
       * #property
       */
      resolution: types.stripDefault(types.number, 1),
      /**
       * #property
       */
      displayCrossHatches: types.stripDefault(types.boolean, false),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      loadedBpPerPx: undefined as number | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get posColor(): string {
        return getConf(confNode(self), 'posColor')
      },
      /**
       * #getter
       */
      get negColor(): string {
        return getConf(confNode(self), 'negColor')
      },
      /**
       * #getter
       */
      get bicolorPivot(): number {
        return getConf(confNode(self), 'bicolorPivot')
      },
      /**
       * #getter
       */
      get scaleType(): string {
        return getConf(confNode(self), 'scaleType')
      },
      /**
       * #getter
       */
      get autoscaleType(): string {
        return getConf(confNode(self), 'autoscale')
      },
      /**
       * #getter
       */
      get numStdDev(): number {
        return getConf(confNode(self), 'numStdDev')
      },
      /**
       * #getter
       */
      get numQuantile(): number {
        return getConf(confNode(self), 'numQuantile')
      },
      /**
       * #getter
       */
      get scatterPointSize(): number {
        return getConf(confNode(self), 'scatterPointSize')
      },
      /**
       * #getter
       */
      get lineWidth(): number {
        return getConf(confNode(self), 'lineWidth')
      },
      /**
       * #getter
       */
      get summaryScoreMode(): string {
        return getConf(confNode(self), 'summaryScoreMode')
      },
      /**
       * #getter
       */
      get renderingType(): string {
        return getConf(confNode(self), 'defaultRendering')
      },
      /**
       * #getter
       */
      get minScore(): number {
        return getConf(confNode(self), 'minScore')
      },
      /**
       * #getter
       */
      get maxScore(): number {
        return getConf(confNode(self), 'maxScore')
      },
      /**
       * #getter
       */
      get minScoreBound(): number | undefined {
        const val: number = getConf(confNode(self), 'minScore')
        return val === Number.MIN_VALUE ? undefined : val
      },
      /**
       * #getter
       */
      get maxScoreBound(): number | undefined {
        const val: number = getConf(confNode(self), 'maxScore')
        return val === Number.MAX_VALUE ? undefined : val
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      toggleCrossHatches() {
        self.displayCrossHatches = !self.displayCrossHatches
      },
      /**
       * #action
       */
      setResolution(res: number) {
        // Only the coarser side needs a floor (1/16) to avoid degenerate
        // binning. The finer side is self-limiting: bbi caps at raw (per-base)
        // data, so past the raw threshold more resolution returns identical
        // data — a high ceiling lets whiskers reach raw at wider zooms.
        self.resolution = Math.min(1024, Math.max(1 / 16, res))
      },
      /**
       * #action
       */
      setLoadedBpPerPx(bpPerPx: number | undefined) {
        self.loadedBpPerPx = bpPerPx
      },
      /**
       * #action
       */
      setScaleType(scaleType: string) {
        setConf(confNode(self), 'scaleType', scaleType)
      },
      /**
       * #action
       */
      setBicolorPivot(val?: number) {
        setConf(confNode(self), 'bicolorPivot', val)
      },
      /**
       * #action
       */
      setMinScore(val?: number) {
        setConf(confNode(self), 'minScore', val)
      },
      /**
       * #action
       */
      setMaxScore(val?: number) {
        setConf(confNode(self), 'maxScore', val)
      },
      /**
       * #action
       */
      setRenderingType(type: string) {
        setConf(confNode(self), 'defaultRendering', type)
      },
      /**
       * #action
       */
      setSummaryScoreMode(val: string) {
        setConf(confNode(self), 'summaryScoreMode', val)
      },
      /**
       * #action
       */
      setScatterPointSize(val?: number) {
        setConf(confNode(self), 'scatterPointSize', val)
      },
      /**
       * #action
       */
      setLineWidth(val?: number) {
        setConf(confNode(self), 'lineWidth', val)
      },
      /**
       * #action
       */
      setAutoscale(val?: string) {
        setConf(confNode(self), 'autoscale', val)
      },
      /**
       * #action
       * Strict zoom equality: see adr-008.
       */
      isCacheValid(_displayedRegionIndex: number) {
        if (self.loadedBpPerPx === undefined) {
          return true
        }
        // An action, not a view, because it overrides MultiRegionDisplayMixin's
        // hook — so MobX untracks this read. Safe only because the one caller
        // (FetchVisibleRegions) already reads view.visibleRegions, which
        // changes on every zoom; don't make this the sole dependency on some
        // other observable.
        const view = getContainingView(self) as LinearGenomeViewModel
        return view.bpPerPx === self.loadedBpPerPx
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get hasResolution() {
        const { pluginManager } = getEnv(self)
        const adapterConfig = getConf(getContainingTrack(self), 'adapter') as {
          type: string
        }
        return pluginManager
          .getAdapterType(adapterConfig.type)
          .adapterCapabilities.includes('hasResolution')
      },
    }))
}
