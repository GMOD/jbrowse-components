import { getConf, getConfResolved } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
  measureText,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import type {
  AnyConfigurationModel,
  PromotableDisplay,
} from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The mixin composes onto a display that supplies `configuration`, but that
// prop is declared by the concrete display, not here, so `self` isn't typed
// with it. This is the shared read/write handle: `getConf` for reads,
// `setConf` (wrapping `configuration.setSlot`) for writes. Mirrors
// TrackHeightMixin's cast idiom.
interface ConfNode {
  configuration: AnyConfigurationModel & {
    setSlot: (slotName: string, value: unknown) => void
  }
}
const confNode = (self: unknown) => self as ConfNode
const setConf = (self: unknown, slot: string, val: unknown) => {
  confNode(self).configuration.setSlot(slot, val)
}
// `prefersOffset` is the optional per-display convention (BaseLinearDisplay)
// signalling the track label is drawn above the plot, not overlapping it.
const offsetNode = (self: unknown) => self as { prefersOffset?: boolean }
// lineWidth is a promotable slot, read through the session-wide default cascade;
// getConfResolved wants the display node itself (type + configuration + session).
const promotableNode = (self: unknown) => self as PromotableDisplay

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
      get scalebarOverlapLeft() {
        const view = getContainingView(self) as LinearGenomeViewModel
        // `prefersOffset` displays move the label above the plot, so the axis
        // no longer overlaps it and needn't dodge right (matches the label
        // placement in TrackContainer).
        if (
          view.effectiveTrackLabels === 'overlapping' &&
          !offsetNode(self).prefersOffset
        ) {
          const track = getContainingTrack(self)
          return measureText(getConf(track, 'name'), 12.8) + 100
        }
        return 0
      },
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
        return getConfResolved(promotableNode(self), 'scatterPointSize')
      },
      /**
       * #getter
       */
      get lineWidth(): number {
        return getConfResolved(promotableNode(self), 'lineWidth')
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
        setConf(self, 'scaleType', scaleType)
      },
      /**
       * #action
       */
      setBicolorPivot(val?: number) {
        setConf(self, 'bicolorPivot', val)
      },
      /**
       * #action
       */
      setMinScore(val?: number) {
        setConf(self, 'minScore', val)
      },
      /**
       * #action
       */
      setMaxScore(val?: number) {
        setConf(self, 'maxScore', val)
      },
      /**
       * #action
       */
      setRenderingType(type: string) {
        setConf(self, 'defaultRendering', type)
      },
      /**
       * #action
       */
      setSummaryScoreMode(val: string) {
        setConf(self, 'summaryScoreMode', val)
      },
      /**
       * #action
       */
      setScatterPointSize(val?: number) {
        setConf(self, 'scatterPointSize', val)
      },
      /**
       * #action
       */
      setLineWidth(val?: number) {
        setConf(self, 'lineWidth', val)
      },
      /**
       * #action
       */
      setAutoscale(val?: string) {
        setConf(self, 'autoscale', val)
      },
      /**
       * #action
       * Strict zoom equality: see adr-008.
       */
      isCacheValid(_displayedRegionIndex: number) {
        if (self.loadedBpPerPx === undefined) {
          return true
        }
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
