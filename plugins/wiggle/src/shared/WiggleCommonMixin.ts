import { getContainingView, openFeatureWidget } from '@jbrowse/core/util'
import { observable } from 'mobx'

import {
  autoscaleDomainFromStats,
  computeScoreStats,
  getNiceDomain,
} from '../util.ts'
import { WiggleScoreConfigMixin } from './WiggleScoreConfigMixin.ts'
import { wiggleFeatureWidgetData } from './wiggleComponentUtils.ts'

import type { WiggleDataResult, WiggleFeatureUnderMouse } from '../util.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { ObservableMap } from 'mobx'

// The visible per-source feature arrays that feed autoscale, clipped to the
// coarse (500ms debounced) blocks so the domain doesn't recompute on every
// animation frame during zoom. `undefined` until the view + data are ready.
// A free function rather than a getter to keep the mixin's `.views` layering
// shallow enough for MST's compose type inference.
function visibleEntries(
  self: IAnyStateTreeNode & {
    rpcDataMap: ObservableMap<number, WiggleDataResult>
    autoscaleSourceNames: Set<string> | undefined
  },
) {
  const view = getContainingView(self) as LinearGenomeViewModel
  if (!view.initialized || self.rpcDataMap.size === 0) {
    return undefined
  }
  const names = self.autoscaleSourceNames
  return view.coarseDynamicBlocks.flatMap(block => {
    const regionData = self.rpcDataMap.get(block.displayedRegionIndex!)
    if (!regionData) {
      return []
    }
    const visStart = Math.floor(block.start)
    const visEnd = Math.ceil(block.end)
    return regionData.sources
      .filter(source => !names || names.has(source.name))
      .map(source => ({ visStart, visEnd, data: source }))
  })
}

/**
 * #stateModel WiggleCommonMixin
 * #category display
 *
 * Extends WiggleScoreConfigMixin with rpcDataMap, autoscale domain, and cache
 * reset. Used by LinearWiggleDisplay and MultiLinearWiggleDisplay. Displays
 * that own a different rpcDataMap type should compose WiggleScoreConfigMixin
 * directly instead.
 */
export function WiggleCommonMixin() {
  return WiggleScoreConfigMixin()
    .volatile(() => ({
      /**
       * #volatile
       */
      rpcDataMap: observable.map<number, WiggleDataResult>(),
      /**
       * #volatile
       */
      featureUnderMouse: undefined as WiggleFeatureUnderMouse | undefined,
    }))
    .views(() => ({
      /**
       * #getter
       * Source names to include when computing the autoscale domain;
       * `undefined` means every fetched source. Multi-wiggle always fetches all
       * sources and filters client-side, so it overrides this to the visible
       * subset — otherwise a subtree filter that hides sources would leave the
       * Y-axis scaled to the hidden ones.
       */
      get autoscaleSourceNames(): Set<string> | undefined {
        return undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The visible feature arrays plus their min/max/mean/stddev, walked once
       * per domain recompute rather than once per autoscale input.
       */
      get visibleScoreStats() {
        const entries = visibleEntries(self)
        return entries
          ? {
              entries,
              stats: computeScoreStats(self.effectiveSummaryScoreMode, entries),
            }
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get visibleScoreRange() {
        const visible = self.visibleScoreStats
        return visible?.stats
          ? autoscaleDomainFromStats({
              stats: visible.stats,
              autoscaleType: self.autoscaleType,
              summaryScoreMode: self.effectiveSummaryScoreMode,
              numStdDev: self.numStdDev,
              numQuantile: self.numQuantile,
              visibleEntries: visible.entries,
            })
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get domain() {
        const range = self.visibleScoreRange
        if (!range) {
          return undefined
        }
        return getNiceDomain({
          domain: range,
          bounds: [self.minScoreBound, self.maxScoreBound],
          scaleType: self.scaleType,
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
        self.setLoadedBpPerPx(undefined)
      },
      /**
       * #action
       */
      setFeatureUnderMouse(feat?: WiggleFeatureUnderMouse) {
        self.featureUnderMouse = feat
      },
      /**
       * #action
       */
      selectFeature(feat: WiggleFeatureUnderMouse) {
        openFeatureWidget(self, wiggleFeatureWidgetData(feat))
      },
    }))
}
