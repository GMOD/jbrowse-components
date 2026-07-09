import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
  measureText,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The mixin composes onto a display that supplies `configuration`, but that
// prop is declared by the concrete display, not here, so `self` isn't typed
// with it. This is the shared read/write handle: `getConf` for reads,
// `configuration.setSlot` for writes. Mirrors TrackHeightMixin's cast idiom.
interface ConfNode {
  configuration: AnyConfigurationModel & {
    setSlot: (slotName: string, value: unknown) => void
  }
}
const confNode = (self: unknown) => self as ConfNode

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
        if (view.trackLabels === 'overlapping') {
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
      get scatterPointSize(): number {
        return getConf(confNode(self), 'scatterPointSize')
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
        // clamp so repeated finer/coarser stepping can't drive unbounded RPC
        // fetches (finer) or degenerate binning (coarser)
        self.resolution = Math.min(16, Math.max(1 / 16, res))
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
        confNode(self).configuration.setSlot('scaleType', scaleType)
      },
      /**
       * #action
       */
      setMinScore(val?: number) {
        confNode(self).configuration.setSlot('minScore', val)
      },
      /**
       * #action
       */
      setMaxScore(val?: number) {
        confNode(self).configuration.setSlot('maxScore', val)
      },
      /**
       * #action
       */
      setRenderingType(type: string) {
        confNode(self).configuration.setSlot('defaultRendering', type)
      },
      /**
       * #action
       */
      setSummaryScoreMode(val: string) {
        confNode(self).configuration.setSlot('summaryScoreMode', val)
      },
      /**
       * #action
       */
      setScatterPointSize(val?: number) {
        confNode(self).configuration.setSlot('scatterPointSize', val)
      },
      /**
       * #action
       */
      setAutoscale(val?: string) {
        confNode(self).configuration.setSlot('autoscale', val)
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
