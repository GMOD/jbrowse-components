import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
  measureText,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { ConfigOverrideMixin } from '@jbrowse/plugin-linear-genome-view'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel WiggleScoreConfigMixin
 * #category display
 *
 * Score/scale/color config and isCacheValid for wiggle-family displays. Does
 * NOT include rpcDataMap or autoscale domain computation — those live in
 * WiggleCommonMixin, which composes this. Displays that own their own
 * rpcDataMap type (e.g. LinearManhattanDisplay) should compose this instead.
 *
 * extends
 * - [ConfigOverrideMixin](../configoverridemixin)
 */
export function WiggleScoreConfigMixin() {
  return types
    .compose(
      'WiggleScoreConfigMixin',
      ConfigOverrideMixin(),
      types.model({
        /**
         * #property
         */
        resolution: types.optional(types.number, 1),
        /**
         * #property
         */
        displayCrossHatches: types.optional(types.boolean, false),
      }),
    )
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
        if (view.trackLabelsSetting === 'overlapping') {
          const track = getContainingTrack(self)
          return measureText(getConf(track, 'name'), 12.8) + 100
        }
        return 0
      },
      /**
       * #getter
       */
      get posColor() {
        return self.getConfWithOverride<string>('posColor')
      },
      /**
       * #getter
       */
      get negColor() {
        return self.getConfWithOverride<string>('negColor')
      },
      /**
       * #getter
       */
      get bicolorPivot() {
        return self.getConfWithOverride<number>('bicolorPivot')
      },
      /**
       * #getter
       */
      get scaleType() {
        return self.getConfWithOverride<string>('scaleType')
      },
      /**
       * #getter
       */
      get autoscaleType() {
        return self.getConfWithOverride<string>('autoscale')
      },
      /**
       * #getter
       */
      get numStdDev() {
        return self.getConfWithOverride<number>('numStdDev')
      },
      /**
       * #getter
       */
      get summaryScoreMode() {
        return self.getConfWithOverride<string>('summaryScoreMode')
      },
      /**
       * #getter
       */
      get renderingType() {
        return self.getConfWithOverride<string>('defaultRendering')
      },
      /**
       * #getter
       */
      get minScore() {
        return self.getConfWithOverride<number>('minScore')
      },
      /**
       * #getter
       */
      get maxScore() {
        return self.getConfWithOverride<number>('maxScore')
      },
      /**
       * #getter
       */
      get minScoreConfig() {
        const val = self.getConfWithOverride<number>('minScore')
        return val === Number.MIN_VALUE ? undefined : val
      },
      /**
       * #getter
       */
      get maxScoreConfig() {
        const val = self.getConfWithOverride<number>('maxScore')
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
        self.resolution = res
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
        self.setOverride('scaleType', scaleType)
      },
      /**
       * #action
       */
      setColor(color?: string) {
        self.setOverride('color', color)
      },
      /**
       * #action
       */
      setMinScore(val?: number) {
        self.setOverride('minScore', val)
      },
      /**
       * #action
       */
      setMaxScore(val?: number) {
        self.setOverride('maxScore', val)
      },
      /**
       * #action
       */
      setRenderingType(type: string) {
        self.setOverride('defaultRendering', type)
      },
      /**
       * #action
       */
      setSummaryScoreMode(val: string) {
        self.setOverride('summaryScoreMode', val)
      },
      /**
       * #action
       */
      setAutoscale(val?: string) {
        self.setOverride('autoscale', val)
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
        return (
          pluginManager
            .getAdapterType(adapterConfig.type)
            ?.adapterCapabilities.includes('hasResolution') ?? false
        )
      },
    }))
}
