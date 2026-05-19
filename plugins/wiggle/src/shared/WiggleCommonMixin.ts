import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
  measureText,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { ConfigOverrideMixin } from '@jbrowse/plugin-linear-genome-view'
import { observable } from 'mobx'

import { computeAutoscaleDomain, getNiceDomain } from '../util.ts'

import type { WiggleDataResult } from '../util.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Shared mixin for LinearWiggleDisplay and MultiLinearWiggleDisplay. Owns
// score/scale/color config getters & setters, loadedBpPerPx, and the
// strict-zoom isCacheValid override (see adr-008). Composes
// ConfigOverrideMixin internally.
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
      loadedBpPerPx: undefined as number | undefined,
      rpcDataMap: observable.map<number, WiggleDataResult>(),
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
    .views(self => ({
      get hasResolution() {
        const { pluginManager } = getEnv(self)
        const adapterConfig = getConf(
          getContainingTrack(self),
          'adapter',
        ) as { type: string }
        return (
          pluginManager
            .getAdapterType(adapterConfig.type)
            ?.adapterCapabilities.includes('hasResolution') ?? false
        )
      },
    }))
    .views(self => ({
      get visibleScoreRange() {
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized || self.rpcDataMap.size === 0) {
          return undefined
        }
        const numStdDev = self.getConfWithOverride<number>('numStdDev')
        // Use coarseDynamicBlocks (500ms debounced) instead of visibleRegions
        // so autoscale doesn't recompute on every animation frame during zoom.
        const visibleEntries = view.coarseDynamicBlocks.flatMap(block => {
          const regionData = self.rpcDataMap.get(block.displayedRegionIndex!)
          if (!regionData) {
            return []
          }
          const visStart = Math.floor(block.start)
          const visEnd = Math.ceil(block.end)
          return regionData.sources.map(source => ({
            visStart,
            visEnd,
            data: source,
          }))
        })
        const allEntries = [...self.rpcDataMap.values()].flatMap(regionData =>
          regionData.sources.map(source => ({ data: source })),
        )
        return computeAutoscaleDomain(
          self.autoscaleType,
          self.summaryScoreMode,
          numStdDev,
          visibleEntries,
          allEntries,
        )
      },
    }))
    .views(self => ({
      get domain() {
        const range = self.visibleScoreRange
        if (!range) {
          return undefined
        }
        return getNiceDomain({
          domain: range,
          bounds: [self.minScoreConfig, self.maxScoreConfig],
          scaleType: self.scaleType,
        })
      },
    }))
    .actions(self => ({
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
        self.setLoadedBpPerPx(undefined)
      },
    }))
}
