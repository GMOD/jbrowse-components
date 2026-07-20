import { getContainingView, openFeatureWidget } from '@jbrowse/core/util'
import { observable } from 'mobx'

import {
  computeAutoscaleDomain,
  computeScoreExtent,
  getNiceDomain,
} from '../util.ts'
import { WiggleScoreConfigMixin } from './WiggleScoreConfigMixin.ts'
import { wiggleFeatureWidgetData } from './wiggleComponentUtils.ts'

import type { WiggleDataResult, WiggleFeatureUnderMouse } from '../util.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
       * The visible per-source feature arrays that feed autoscale, clipped to
       * the coarse (500ms debounced) blocks so the domain doesn't recompute on
       * every animation frame during zoom. `undefined` until the view + data
       * are ready.
       */
      get visibleEntries() {
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
            .map(source => ({
              visStart,
              visEnd,
              data: source,
            }))
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get visibleScoreRange() {
        const entries = self.visibleEntries
        return entries
          ? computeAutoscaleDomain(
              self.autoscaleType,
              self.summaryScoreMode,
              self.numStdDev,
              entries,
              self.numQuantile,
            )
          : undefined
      },
      /**
       * #getter
       * The true, unclipped `[min, max]` of the visible data. The displayed
       * `domain` may clip this (localpercentile/localsd/fixed bounds), so the
       * score legend compares the two to flag clipped signal.
       */
      get dataRange() {
        const entries = self.visibleEntries
        return entries
          ? computeScoreExtent(self.summaryScoreMode, entries)
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
