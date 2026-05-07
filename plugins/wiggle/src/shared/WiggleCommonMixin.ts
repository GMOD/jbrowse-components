import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  measureText,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { ConfigOverrideMixin } from '@jbrowse/plugin-linear-genome-view'

/**
 * Shared MST mixin for both LinearWiggleDisplay and MultiLinearWiggleDisplay.
 * Owns the resolution / displayCrossHatches model fields, the loadedBpPerPx
 * volatile, the cross-display config getters/setters, and the strict-zoom
 * isCacheValid override (see adr-008-wiggle-strict-bpperpx-equality.md).
 *
 * Composes ConfigOverrideMixin internally — wiggle displays don't need to
 * add it again in their own compose() chain.
 */
export function WiggleCommonMixin() {
  return types
    .compose(
      'WiggleCommonMixin',
      ConfigOverrideMixin(),
      types.model({
        resolution: types.optional(types.number, 1),
        displayCrossHatches: types.optional(types.boolean, false),
      }),
    )
    .volatile(() => ({
      // bpPerPx of the most recent fetch. isCacheValid compares strictly
      // so any zoom change refetches every visible region together.
      loadedBpPerPx: undefined as number | undefined,
    }))
    .views(self => ({
      get scalebarOverlapLeft() {
        const view = getContainingView(self) as { trackLabelsSetting?: string }
        if (view.trackLabelsSetting === 'overlapping') {
          const track = getContainingTrack(self)
          return measureText(getConf(track, 'name'), 12.8) + 100
        }
        return 0
      },

      get posColor() {
        return self.getConfWithOverride<string>('posColor')
      },
      get negColor() {
        return self.getConfWithOverride<string>('negColor')
      },
      get bicolorPivot() {
        return self.getConfWithOverride<number>('bicolorPivot')
      },
      get scaleType() {
        return self.getConfWithOverride<string>('scaleType')
      },
      get autoscaleType() {
        return self.getConfWithOverride<string>('autoscale')
      },
      get summaryScoreMode() {
        return self.getConfWithOverride<string>('summaryScoreMode')
      },
      get renderingType() {
        return self.getConfWithOverride<string>('defaultRendering')
      },
      get minScore() {
        return self.getConfWithOverride<number>('minScore')
      },
      get maxScore() {
        return self.getConfWithOverride<number>('maxScore')
      },
      get minScoreConfig() {
        const val = self.getConfWithOverride<number>('minScore')
        return val === Number.MIN_VALUE ? undefined : val
      },
      get maxScoreConfig() {
        const val = self.getConfWithOverride<number>('maxScore')
        return val === Number.MAX_VALUE ? undefined : val
      },
    }))
    .actions(self => ({
      toggleCrossHatches() {
        self.displayCrossHatches = !self.displayCrossHatches
      },
      setResolution(res: number) {
        self.resolution = res
      },
      setLoadedBpPerPx(bpPerPx: number | undefined) {
        self.loadedBpPerPx = bpPerPx
      },
      setScaleType(scaleType: string) {
        self.setOverride('scaleType', scaleType)
      },
      setMinScore(val?: number) {
        self.setOverride('minScore', val)
      },
      setMaxScore(val?: number) {
        self.setOverride('maxScore', val)
      },
      setRenderingType(type: string) {
        self.setOverride('defaultRendering', type)
      },
      setSummaryScoreMode(val: string) {
        self.setOverride('summaryScoreMode', val)
      },
      setAutoscale(val?: string) {
        self.setOverride('autoscale', val)
      },
      // Strict zoom equality: see adr-008.
      isCacheValid(_displayedRegionIndex: number) {
        if (self.loadedBpPerPx === undefined) {
          return true
        }
        const view = getContainingView(self) as unknown as { bpPerPx: number }
        return view.bpPerPx === self.loadedBpPerPx
      },
    }))
}
