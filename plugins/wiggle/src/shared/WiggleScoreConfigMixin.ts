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

const WIGGLE_SCORE_CONFIG_KEYS = [
  'posColor',
  'negColor',
  'bicolorPivot',
  'scaleType',
  'autoscale',
  'numStdDev',
  'summaryScoreMode',
  'defaultRendering',
  'minScore',
  'maxScore',
  'color',
  'useBicolor',
] as const

/**
 * #stateModel WiggleScoreConfigMixin
 * #category display
 *
 * Score/scale/color config and isCacheValid for wiggle-family displays. Does
 * NOT include rpcDataMap or autoscale domain computation — those live in
 * WiggleCommonMixin, which composes this. Displays that own their own
 * rpcDataMap type (e.g. LinearManhattanDisplay) should compose this instead.
 */
export function WiggleScoreConfigMixin(extraKeys: string[] = []) {
  return types
    .compose(
      'WiggleScoreConfigMixin',
      ConfigOverrideMixin([...WIGGLE_SCORE_CONFIG_KEYS, ...extraKeys]),
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
        return self.getConfWithOverride('posColor')
      },
      /**
       * #getter
       */
      get negColor(): string {
        return self.getConfWithOverride('negColor')
      },
      /**
       * #getter
       */
      get bicolorPivot(): number {
        return self.getConfWithOverride('bicolorPivot')
      },
      /**
       * #getter
       */
      get scaleType(): string {
        return self.getConfWithOverride('scaleType')
      },
      /**
       * #getter
       */
      get autoscaleType(): string {
        return self.getConfWithOverride('autoscale')
      },
      /**
       * #getter
       */
      get numStdDev(): number {
        return self.getConfWithOverride('numStdDev')
      },
      /**
       * #getter
       */
      get summaryScoreMode(): string {
        return self.getConfWithOverride('summaryScoreMode')
      },
      /**
       * #getter
       */
      get renderingType(): string {
        return self.getConfWithOverride('defaultRendering')
      },
      /**
       * #getter
       */
      get minScore(): number {
        return self.getConfWithOverride('minScore')
      },
      /**
       * #getter
       */
      get maxScore(): number {
        return self.getConfWithOverride('maxScore')
      },
      /**
       * #getter
       */
      get minScoreBound(): number | undefined {
        const val: number = self.getConfWithOverride('minScore')
        return val === Number.MIN_VALUE ? undefined : val
      },
      /**
       * #getter
       */
      get maxScoreBound(): number | undefined {
        const val: number = self.getConfWithOverride('maxScore')
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
        return pluginManager
          .getAdapterType(adapterConfig.type)
          .adapterCapabilities.includes('hasResolution')
      },
    }))
}
